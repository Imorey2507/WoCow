/**
 * Deployment configuration guards.
 *
 * These exist because the things that break a Vercel deploy are invisible until
 * the deploy fails, and one of them (a non-daily cron on the Hobby plan) fails
 * the *build* rather than degrading at runtime.
 *
 * Node's built-in runner, no dependencies.
 * Naming note: `-test.mjs` (not `.test.mjs`) — see club-normalize-test.mjs.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, "..");
const REPO = resolve(APP, "..");

const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : "");
const json = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null);

describe("vercel.json (inside aggie-playground)", () => {
  const cfg = json(resolve(APP, "vercel.json"));

  test("exists, so Root Directory = aggie-playground picks up its crons", () => {
    assert.ok(cfg, "aggie-playground/vercel.json is missing");
  });

  test("cron schedules are daily, which the Hobby plan accepts", () => {
    // Vercel Hobby only allows cron jobs that run once a day. A "*/6" schedule
    // is rejected at deploy time, so this is a build-breaking setting, not a
    // cosmetic one. Daily runs on every plan.
    for (const cron of cfg.crons ?? []) {
      assert.equal(cron.schedule, "0 0 * * *", `cron "${cron.path}" must run daily, found "${cron.schedule}"`);
    }
  });

  test("the cron path is an existing API route", () => {
    for (const cron of cfg.crons ?? []) {
      const route = resolve(APP, "src", "app", cron.path.replace(/^\//, ""), "route.ts");
      assert.ok(existsSync(route), `cron target ${cron.path} has no route.ts`);
    }
  });
});

describe("the frozen Vite app must never be the Vercel root", () => {
  test("the repository root vercel.json is still the Vite one", () => {
    // If Vercel's Root Directory is left at the repo root it builds THIS config
    // and skips aggie-playground entirely. Asserting its shape documents the trap.
    const root = json(resolve(REPO, "vercel.json"));
    assert.ok(root, "root vercel.json is missing");
    assert.equal(root.framework, "vite");
  });
});

describe("next.config.ts is deploy-compatible", () => {
  const cfg = read(resolve(APP, "next.config.ts"));

  test("does not use output: 'export'", () => {
    // A static export would drop /auth/callback and /api/clubs/refresh.
    assert.doesNotMatch(cfg, /output:\s*["']export["']/);
  });

  test("no route uses a segment config that cacheComponents rejects", () => {
    // next.config.ts sets cacheComponents: true, which makes `export const dynamic`
    // a build error (we hit this for real). cookies() already forces dynamic.
    const routes = [
      resolve(APP, "src", "app", "auth", "callback", "route.ts"),
      resolve(APP, "src", "app", "api", "clubs", "refresh", "route.ts"),
    ];
    for (const r of routes) {
      assert.doesNotMatch(read(r), /export\s+const\s+dynamic\b/, `${r} sets a forbidden segment config`);
    }
  });
});

describe("environment contract", () => {
  const example = read(resolve(APP, ".env.example"));

  test("documents NEXT_PUBLIC_SITE_URL", () => {
    assert.match(example, /^NEXT_PUBLIC_SITE_URL=/m);
  });

  test("server-only secrets never get a NEXT_PUBLIC_ prefix", () => {
    for (const name of ["SUPABASE_SERVICE_ROLE_KEY", "CONTEXT_DEV_API_KEY", "CRON_SECRET"]) {
      assert.ok(example.includes(name), `.env.example is missing ${name}`);
      assert.ok(!example.includes(`NEXT_PUBLIC_${name}`), `${name} must never be public`);
    }
  });

  test("no real value is committed in .env.example", () => {
    for (const line of example.split(/\r?\n/)) {
      if (!line.includes("=") || line.trimStart().startsWith("#")) continue;
      const value = line.slice(line.indexOf("=") + 1).trim();
      assert.equal(value, "", `.env.example leaks a value for ${line.split("=")[0]}`);
    }
  });
});

describe("nothing hardcodes a local host in logic", () => {
  test("emailRedirectTo is derived, never hardcoded", () => {
    const auth = read(resolve(APP, "src", "components", "AuthProvider.tsx"));
    assert.match(auth, /NEXT_PUBLIC_SITE_URL/);
    assert.match(auth, /window\.location\.origin/);
    assert.doesNotMatch(auth, /emailRedirectTo:\s*["'`]https?:\/\//, "emailRedirectTo must not be a literal URL");
  });
});
