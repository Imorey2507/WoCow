/**
 * Person 3 — static consistency checks on the SQL.
 *
 * There is no Supabase project yet, so `rls_smoke.sql` cannot be executed and
 * PGlite is not a dependency of this app. These checks are deliberately modest
 * and honest: they prove the migration and the test file agree with each other
 * and that the hardening markers are present. They do NOT prove the policies
 * behave correctly — only a real database run can do that.
 *
 * Node's built-in runner, no dependencies.
 * Naming note: `-test.mjs` (not `.test.mjs`) — see club-normalize-test.mjs.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATION = resolve(HERE, "..", "supabase", "migrations", "0001_init.sql");
const SMOKE = resolve(HERE, "..", "supabase", "tests", "rls_smoke.sql");

const migration = readFileSync(MIGRATION, "utf8");
const smoke = readFileSync(SMOKE, "utf8");

/** Table names created by the migration. */
function createdTables(sql) {
  return new Set([...sql.matchAll(/create table\s+(?:if not exists\s+)?public\.(\w+)/gi)].map((m) => m[1]));
}

/**
 * Body of one `create or replace function`.
 *
 * The terminator matters: the functions are formatted as `... return new;\nend $$;`,
 * so anchoring on `\n$$;` runs past the end into the NEXT function and silently
 * picks up its attributes. Anchor on `\nend $$;` instead.
 */
function fnSource(sql, name) {
  const re = new RegExp(`create or replace function public\\.${name}\\b[\\s\\S]*?\\nend \\$\\$;`, "i");
  return sql.match(re)?.[0] ?? "";
}

describe("migration <-> rls_smoke consistency", () => {
  const tables = createdTables(migration);

  test("the migration creates the tables the official app uses", () => {
    for (const expected of ["profiles", "activities", "participants", "notifications", "buddy_requests", "club_events", "posts"]) {
      assert.ok(tables.has(expected), `migration is missing table "${expected}"`);
    }
  });

  test("rls_smoke only references tables the migration actually creates", () => {
    const referenced = new Set([...smoke.matchAll(/public\.(\w+)/g)].map((m) => m[1]));
    // Views, functions and sequences are also referenced with the public. prefix.
    const nonTables = new Set(["public_profiles", "activity_feed", "join_activity", "leave_activity", "is_discoverable", "handle_new_user", "host_auto_join", "enforce_activity_capacity", "notify_new_activity", "notify_activity_change", "touch_updated_at"]);
    const unknown = [...referenced].filter((n) => !tables.has(n) && !nonTables.has(n));
    assert.deepEqual(unknown, [], `rls_smoke references objects the migration does not define: ${unknown.join(", ")}`);
  });

  test("it uses the real column names, not the frozen Vite schema's", () => {
    // The old Vite schema used activity_participants / starts_at+ends_at.
    assert.ok(!/activity_participants/.test(migration), "migration references the frozen Vite table name");
    assert.ok(!/activity_participants/.test(smoke), "rls_smoke references the frozen Vite table name");
    assert.ok(/duration_min/.test(migration), "migration should use duration_min, not ends_at");
    assert.ok(!/\bends_at\b/.test(migration), "migration should not use the frozen Vite ends_at column");
  });
});

describe("hardening markers are present", () => {
  test("write privileges on participants are revoked, read is kept", () => {
    assert.match(migration, /revoke all on public\.participants from anon, authenticated, public;/i);
    assert.match(migration, /grant select on public\.participants to anon, authenticated;/i);
  });

  test("there is no INSERT/UPDATE/DELETE policy on participants", () => {
    const policies = [...migration.matchAll(/create policy\s+"[^"]+"\s+on public\.participants\s+for\s+(\w+)/gi)].map((m) => m[1].toLowerCase());
    assert.deepEqual(policies, ["select"], `participants should only have a SELECT policy, found: ${policies.join(", ")}`);
  });

  test("join_activity still takes the row lock", () => {
    const fn = fnSource(migration, "join_activity");
    assert.ok(fn.length > 0, "join_activity not found");
    assert.match(fn.toLowerCase(), /for update/, "join_activity no longer locks the activity row");
    assert.match(fn, /security definer/i, "join_activity must stay SECURITY DEFINER");
  });

  test("join_activity rejects duplicates and full activities with stable tokens", () => {
    const fn = fnSource(migration, "join_activity");
    assert.match(fn, /already_joined/);
    assert.match(fn, /full/);
    assert.match(fn, /not_authenticated/);
  });

  test("a capacity guard trigger exists and uses 23514", () => {
    assert.match(migration, /create trigger activities_capacity_guard before update of max_participants/i);
    const guard = fnSource(migration, "enforce_activity_capacity");
    assert.ok(guard.length > 0, "enforce_activity_capacity not found");
    assert.match(guard, /23514/);
    assert.match(guard, /is distinct from old\.max_participants/i);
  });

  test("the capacity guard is NOT security definer (it reads under the caller's RLS)", () => {
    const guard = fnSource(migration, "enforce_activity_capacity");
    assert.ok(!/security definer/i.test(guard), "the guard should run as the caller, not as the owner");
  });

  test("rls_smoke covers the new hardening", () => {
    assert.match(smoke, /has_table_privilege\('authenticated', 'public\.participants', 'INSERT'\)/);
    assert.match(smoke, /lowering max_participants below the joined count is rejected/);
    assert.match(smoke, /raising the capacity is allowed/);
    assert.match(smoke, /for update/);
  });

  test("the smoke test still wraps everything in a rollback", () => {
    assert.match(smoke, /^begin;/im);
    assert.match(smoke, /^rollback;/im);
  });
});
