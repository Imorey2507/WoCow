#!/usr/bin/env node
/**
 * WoCow · database schema + security tests
 * Owner: Person 3 (Data). Run with `pnpm test:db`.
 *
 * Executes every file in supabase/migrations/ in filename order against a real
 * PostgreSQL (PGlite — PostgreSQL compiled to WebAssembly, running in-process)
 * and then exercises the RLS policies, the activity_feed view and the
 * join/leave RPCs the way the app actually uses them.
 *
 * WHY THIS EXISTS
 * ---------------
 * Five people edit SQL in parallel. A migration that only *looks* right is the
 * easiest way to lose an afternoon: RLS mistakes fail silently (a policy that
 * denies everything looks exactly like an empty table). This suite makes the
 * database's behaviour assertable in about two seconds, with no cloud project,
 * no Docker and no database server.
 *
 * WHAT IT CANNOT DO — read this before trusting a green run
 * ---------------------------------------------------------
 *  1. PGlite is SINGLE-CONNECTION. It cannot reproduce two clients racing to
 *     take the last slot, so the `SELECT … FOR UPDATE` lock in join_activity()
 *     is NOT covered here. That lock is the whole point of the RPC — verify it
 *     against a real Supabase project before you trust it.
 *  2. It runs against shim.sql, an emulation of Supabase's auth schema and
 *     roles, not Supabase itself. A divergence between the shim and the real
 *     platform would not be caught.
 *  3. It says nothing about Realtime delivery, only about the publication
 *     membership the delivery depends on.
 *
 * Everything else — constraints, RLS on both tables, the view's derived
 * fields, cascade deletes, capacity enforcement, migration re-runnability —
 * is covered for real.
 */
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = resolve(HERE, '..', 'migrations')

const db = new PGlite()

let pass = 0
const failures = []

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const OFF = '\x1b[0m'

function ok(name, extra = '') {
  pass++
  console.log(`  ${GREEN}PASS${OFF}  ${name}${extra ? `  ${DIM}${extra}${OFF}` : ''}`)
}

function bad(name, detail) {
  failures.push({ name, detail })
  console.log(`  ${RED}FAIL${OFF}  ${name}\n        ${RED}${detail}${OFF}`)
}

function check(name, condition, detail = '') {
  if (condition) ok(name)
  else bad(name, detail || 'condition was false')
}

function section(title) {
  console.log(`\n${BOLD}${title}${OFF}`)
}

/** Asserts that a statement is rejected, optionally matching the message. */
async function expectError(name, fn, pattern) {
  try {
    await fn()
    bad(name, 'expected an error, but the statement succeeded')
  } catch (err) {
    const message = String(err?.message ?? err).replace(/\s+/g, ' ').trim()
    if (pattern && !pattern.test(message)) {
      bad(name, `wrong error. expected ${pattern}, got: ${message.slice(0, 160)}`)
    } else {
      ok(name, `rejected: ${message.slice(0, 70)}`)
    }
  }
}

/**
 * Switches the session into the given Supabase role with the given JWT
 * subject, so auth.uid() and every RLS policy see what they would see in
 * production. Without this, RLS tests pass vacuously — see the note in
 * shim.sql.
 */
async function actAs(role, userId = null) {
  await db.exec('reset role')
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId ?? ''])
  await db.exec(`set role ${role}`)
}

async function scalar(sql, params = []) {
  const { rows } = await db.query(sql, params)
  return rows[0] ? Object.values(rows[0])[0] : undefined
}

async function feedRow(id) {
  const { rows } = await db.query(`select * from public.activity_feed where id = $1`, [id])
  return rows[0]
}

async function createActivity(hostId, overrides = {}) {
  const a = {
    title: 'Basketball at the ARC',
    category: 'basketball',
    location_name: 'UC Davis ARC',
    latitude: 38.5437,
    longitude: -121.7565,
    max_participants: 2,
    starts_at: new Date(Date.now() + 3_600_000).toISOString(),
    ends_at: new Date(Date.now() + 7_200_000).toISOString(),
    ...overrides,
  }
  await actAs('authenticated', hostId)
  const { rows } = await db.query(
    `insert into public.activities
       (title, category, location_name, latitude, longitude,
        max_participants, host_id, starts_at, ends_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     returning id`,
    [a.title, a.category, a.location_name, a.latitude, a.longitude,
     a.max_participants, hostId, a.starts_at, a.ends_at],
  )
  return rows[0].id
}

// =============================================================================
// 0. Boot
// =============================================================================
console.log(`${BOLD}WoCow database tests${OFF}`)
console.log(`${DIM}PostgreSQL via PGlite · migrations from ${MIGRATIONS_DIR}${OFF}`)

const version = await scalar('select version()')
console.log(`${DIM}${String(version).split(',')[0]}${OFF}`)

section('0. Supabase shim')
await db.exec(readFileSync(join(HERE, 'shim.sql'), 'utf8'))
ok('shim applied (auth schema, roles, realtime publication)')

const users = {}
for (const [key, email] of [
  ['A', 'a@ucdavis.edu'],
  ['B', 'b@ucdavis.edu'],
  ['C', 'c@ucdavis.edu'],
  ['D', 'd@ucdavis.edu'],
]) {
  const { rows } = await db.query(
    `insert into auth.users (email) values ($1) returning id`,
    [email],
  )
  users[key] = rows[0].id
}
ok('created 4 test accounts')

// =============================================================================
// 1. Migrations, pass 1
// =============================================================================
section('1. Apply all migrations in filename order')

const migrationFiles = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()
let migrationErrors = 0

for (const file of migrationFiles) {
  try {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))
    ok(file)
  } catch (err) {
    migrationErrors++
    bad(file, String(err.message).replace(/\s+/g, ' ').slice(0, 220))
  }
}

if (migrationErrors > 0) {
  console.log(
    `\n${RED}Migrations failed to apply — stopping so later results are not misleading.${OFF}`,
  )
  await db.close()
  process.exit(1)
}

// Supabase grants these to the API roles by default.
await db.exec(`
  grant usage on schema public to anon, authenticated;
  grant all on all tables in schema public to anon, authenticated;
  grant usage, select on all sequences in schema public to anon, authenticated;
`)
ok('granted default table privileges to anon + authenticated')

// =============================================================================
// 2. Re-runnability (docs/SETUP.md promises every file is safe to run twice)
// =============================================================================
section('2. Re-run every migration (idempotency)')

let rerunErrors = 0
for (const file of migrationFiles) {
  try {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))
  } catch (err) {
    rerunErrors++
    bad(`re-run ${file}`, String(err.message).replace(/\s+/g, ' ').slice(0, 220))
  }
}
if (rerunErrors === 0) ok(`all ${migrationFiles.length} migrations are safely re-runnable`)

const seededCount = await scalar('select count(*)::int from public.activities')
check(
  'seed did not duplicate rows on re-run',
  seededCount === 6,
  `expected 6 seeded activities, found ${seededCount}`,
)

// =============================================================================
// 3. Schema shape
// =============================================================================
section('3. Schema shape')

check(
  'RLS is enabled on both tables',
  (await scalar(`
    select count(*)::int from pg_tables
    where schemaname = 'public'
      and tablename in ('activities', 'activity_participants')
      and rowsecurity = true
  `)) === 2,
)

check(
  'no table in public is left without RLS',
  (await scalar(`
    select count(*)::int from pg_tables
    where schemaname = 'public' and rowsecurity = false
  `)) === 0,
  'a public table exists with RLS disabled',
)

check(
  'both tables are in the supabase_realtime publication',
  (await scalar(`
    select count(*)::int from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
  `)) === 2,
)

check(
  'all three functions exist and are SECURITY DEFINER',
  (await scalar(`
    select count(*)::int from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('join_activity', 'leave_activity', 'activity_has_space')
      and p.prosecdef = true
  `)) === 3,
  'a function is missing or is not SECURITY DEFINER (needed to avoid RLS recursion)',
)

check(
  'the feed view is declared security_invoker',
  (await scalar(`
    select coalesce(bool_or('security_invoker=on' = any(c.reloptions)), false)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'activity_feed'
  `)) === true,
  'the declaration is missing from the view',
)

// Declaring the option is not the same as it working. This proves it: a
// RESTRICTIVE policy denying anon everything must hide rows through the VIEW
// just as it does through the base table. With security_invoker off, the view
// would run as its owner and leak every row.
await db.exec(`
  create policy "diag restrictive" on public.activities
    as restrictive for select to anon using (false);
`)
await actAs('anon')
const anonBaseCount = await scalar(`select count(*)::int from public.activities`)
const anonViewCount = await scalar(`select count(*)::int from public.activity_feed`)
await db.exec('reset role')
await db.exec(`drop policy "diag restrictive" on public.activities`)

check(
  'RLS is genuinely enforced THROUGH the view, not bypassed',
  anonBaseCount === 0 && anonViewCount === 0,
  `base table returned ${anonBaseCount}, view returned ${anonViewCount} — the view bypassed RLS`,
)

check(
  'anon holds NO execute privilege on the write RPCs',
  (await scalar(`select has_function_privilege('anon', 'public.join_activity(uuid)', 'EXECUTE')`)) === false &&
    (await scalar(`select has_function_privilege('anon', 'public.leave_activity(uuid)', 'EXECUTE')`)) === false,
  'anon could invoke a write RPC directly',
)

check(
  'authenticated DOES hold execute on the write RPCs',
  (await scalar(`select has_function_privilege('authenticated', 'public.join_activity(uuid)', 'EXECUTE')`)) === true,
)

// =============================================================================
// 4. Check constraints
// =============================================================================
section('4. Check constraints')

await expectError(
  'rejects ends_at before starts_at',
  () => createActivity(users.A, {
    starts_at: new Date(Date.now() + 7_200_000).toISOString(),
    ends_at: new Date(Date.now() + 3_600_000).toISOString(),
  }),
  /activities_time_order|check constraint/i,
)

await expectError(
  'rejects max_participants = 0',
  () => createActivity(users.A, { max_participants: 0 }),
  /check constraint/i,
)

await expectError(
  'rejects a latitude outside -90..90',
  () => createActivity(users.A, { latitude: 999 }),
  /check constraint/i,
)

await expectError(
  'rejects a title shorter than 3 characters',
  () => createActivity(users.A, { title: 'ab' }),
  /check constraint/i,
)

// =============================================================================
// 5. RLS on activities
// =============================================================================
section('5. Row Level Security — activities')

// Clear the seed so the counts below are predictable.
await actAs('authenticated', users.A)
await db.query(`delete from public.activities where host_id <> $1`, [users.A])
await db.exec('reset role')

const activityId = await createActivity(users.A, { max_participants: 2, title: 'RLS Test Game' })

await actAs('anon')
check(
  'anon CAN read activities (the map works without signing in)',
  (await scalar(`select count(*)::int from public.activities where id = $1`, [activityId])) === 1,
)

await expectError(
  'anon CANNOT create an activity',
  async () => {
    await actAs('anon')
    await db.query(
      `insert into public.activities
         (title, category, location_name, latitude, longitude,
          max_participants, host_id, starts_at, ends_at)
       values ('Anon Hack','x','x',1,1,5,$1, now() + interval '1 hour', now() + interval '2 hours')`,
      [users.A],
    )
  },
  /row-level security|permission denied/i,
)

await expectError(
  'a signed-in user CANNOT create an activity hosted by someone else',
  async () => {
    await actAs('authenticated', users.B)
    await db.query(
      `insert into public.activities
         (title, category, location_name, latitude, longitude,
          max_participants, host_id, starts_at, ends_at)
       values ('Impersonation','x','x',1,1,5,$1, now() + interval '1 hour', now() + interval '2 hours')`,
      [users.A],
    )
  },
  /row-level security|permission denied/i,
)

await actAs('authenticated', users.B)
const updated = await db.query(
  `update public.activities set title = 'Hijacked' where id = $1 returning id`,
  [activityId],
)
check('a non-host cannot edit the activity', updated.rows.length === 0)

await actAs('authenticated', users.A)
const titleAfter = await scalar(`select title from public.activities where id = $1`, [activityId])
check("the host's title survived the edit attempt", titleAfter === 'RLS Test Game', `got "${titleAfter}"`)

// =============================================================================
// 6. join_activity — the atomic path
// =============================================================================
section('6. join_activity / leave_activity')

await actAs('authenticated', users.B)
const joined = (await db.query(`select * from public.join_activity($1)`, [activityId])).rows[0]
check('B joins successfully', joined?.participant_count === 1, `count = ${joined?.participant_count}`)
check('the returned row reports is_joined for B', joined?.is_joined === true)
check('is_full is false at 1/2', joined?.is_full === false)

await actAs('authenticated', users.B)
const again = (await db.query(`select * from public.join_activity($1)`, [activityId])).rows[0]
check('joining twice is idempotent (not an error)', again?.participant_count === 1,
  `count = ${again?.participant_count}`)

await actAs('authenticated', users.C)
const third = (await db.query(`select * from public.join_activity($1)`, [activityId])).rows[0]
check('C fills the last slot', third?.participant_count === 2)
check('is_full flips to true at 2/2', third?.is_full === true)

await expectError(
  'D is refused when the activity is full',
  async () => {
    await actAs('authenticated', users.D)
    await db.query(`select * from public.join_activity($1)`, [activityId])
  },
  /already full/i,
)

check(
  'the refused join did NOT create a row (capacity held)',
  (await scalar(`select count(*)::int from public.activity_participants where activity_id = $1`, [activityId])) === 2,
)

// anon is stopped one layer EARLIER than the function body: the migration
// revokes EXECUTE from PUBLIC and grants it only to `authenticated`, so the
// call never reaches the 'must be signed in' guard. That is stricter than the
// in-function check, which stays as defence in depth.
await expectError(
  'an anonymous caller cannot join (blocked at the GRANT layer)',
  async () => {
    await actAs('anon')
    await db.query(`select * from public.join_activity($1)`, [activityId])
  },
  /permission denied for function|must be signed in/i,
)

await expectError(
  'joining a non-existent activity is a clear error',
  async () => {
    await actAs('authenticated', users.D)
    await db.query(`select * from public.join_activity('00000000-0000-0000-0000-000000000000')`)
  },
  /no longer exists/i,
)

await actAs('authenticated', users.B)
const left = (await db.query(`select * from public.leave_activity($1)`, [activityId])).rows[0]
check('B leaves and the count drops', left?.participant_count === 1, `count = ${left?.participant_count}`)

await actAs('authenticated', users.A)
const freed = (await db.query(`select * from public.join_activity($1)`, [activityId])).rows[0]
check('a freed slot can be taken again (host joins their own activity)', freed?.participant_count === 2)

// =============================================================================
// 7. RLS on activity_participants
// =============================================================================
section('7. Row Level Security — activity_participants')

await actAs('anon')
check(
  'anon CAN read participants (needed for public head-counts)',
  (await scalar(`select count(*)::int from public.activity_participants where activity_id = $1`, [activityId])) === 2,
)

await expectError(
  'a user CANNOT insert a participation row for someone else',
  async () => {
    await actAs('authenticated', users.D)
    await db.query(
      `insert into public.activity_participants (activity_id, user_id) values ($1, $2)`,
      [activityId, users.B],
    )
  },
  /row-level security|permission denied/i,
)

// D tries to remove C, who is still a participant. A DELETE that RLS filters
// out is not an error — it matches zero rows, which is the correct outcome.
await actAs('authenticated', users.D)
const triedDelete = await db.query(
  `delete from public.activity_participants where activity_id = $1 and user_id = $2 returning user_id`,
  [activityId, users.C],
)
check("a user cannot delete someone else's participation", triedDelete.rows.length === 0)

check(
  "the victim's participation row is untouched",
  (await scalar(
    `select count(*)::int from public.activity_participants where activity_id = $1 and user_id = $2`,
    [activityId, users.C],
  )) === 1,
  'C was removed by a user who should not have been able to',
)

// =============================================================================
// 8. The view's derived fields
// =============================================================================
section('8. activity_feed derivations')

await actAs('anon')
const anonView = await feedRow(activityId)
check('anon sees the true participant_count', anonView?.participant_count === 2, `got ${anonView?.participant_count}`)
check('anon sees is_joined = false', anonView?.is_joined === false)

await actAs('authenticated', users.A)
const hostView = await feedRow(activityId)
check('the host sees is_joined = true for their own joined row', hostView?.is_joined === true)

await actAs('authenticated', users.D)
const strangerView = await feedRow(activityId)
check('a non-participant sees is_joined = false', strangerView?.is_joined === false)

// =============================================================================
// 9. Cascade behaviour
// =============================================================================
section('9. Cascade delete')

const before = await scalar(
  `select count(*)::int from public.activity_participants where activity_id = $1`,
  [activityId],
)
await actAs('authenticated', users.A)
await db.query(`delete from public.activities where id = $1`, [activityId])
const after = await scalar(
  `select count(*)::int from public.activity_participants where activity_id = $1`,
  [activityId],
)
check(
  'deleting an activity removes its participation rows',
  before === 2 && after === 0,
  `before=${before} after=${after}`,
)

await actAs('anon')
check(
  'the deleted activity is gone from the feed',
  (await scalar(`select count(*)::int from public.activity_feed where id = $1`, [activityId])) === 0,
)

// =============================================================================
// 10. Seed data sanity
// =============================================================================
section('10. Seed data')

await actAs('anon')
const seeded = await db.query(
  `select title, category, max_participants from public.activity_feed order by starts_at`,
)
check(`the seed produced ${seeded.rows.length} activities`, seeded.rows.length === 6)
check(
  'every seeded activity has valid coordinates',
  seeded.rows.length > 0 &&
    (await scalar(
      `select count(*)::int from public.activities
       where latitude between -90 and 90 and longitude between -180 and 180`,
    )) === 6,
)

// =============================================================================
// Summary
// =============================================================================
console.log(`\n${BOLD}${'-'.repeat(62)}${OFF}`)
if (failures.length === 0) {
  console.log(`${GREEN}${BOLD}ALL ${pass} CHECKS PASSED${OFF}`)
  console.log(
    `${DIM}Reminder: concurrent joins are NOT covered here (PGlite is single-connection).${OFF}`,
  )
} else {
  console.log(`${RED}${BOLD}${failures.length} FAILED${OFF}, ${pass} passed`)
  for (const f of failures) console.log(`  ${RED}x${OFF} ${f.name}\n    ${DIM}${f.detail}${OFF}`)
}
console.log(`${BOLD}${'-'.repeat(62)}${OFF}`)

await db.close()
process.exit(failures.length === 0 ? 0 : 1)
