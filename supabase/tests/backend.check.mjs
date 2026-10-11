import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const host = '00000000-0000-0000-0000-000000000001'
const guest = '00000000-0000-0000-0000-000000000002'
const activity = '00000000-0000-0000-0000-000000000003'

// Real Postgres engine; only Supabase-owned auth roles/publication are shimmed.
test('backend migrations enforce membership, capacity, ownership and expiration', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key, created_at timestamptz default now());
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
      create publication supabase_realtime;
      insert into auth.users(id) values ('${host}'), ('${guest}');`)
    for (const file of (await readdir(new URL('../migrations/', import.meta.url))).sort()) {
      if (file.includes('seed_demo')) continue
      const sql = await readFile(new URL(`../migrations/${file}`, import.meta.url), 'utf8')
      // gen_random_uuid is built into this engine; pgcrypto is not bundled.
      await db.exec(sql.replace('create extension if not exists "pgcrypto";', ''))
    }
    const asUser = async (user, sql) => {
      await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`)
      try { return await db.query(sql) } finally { await db.exec('reset role') }
    }
    const create = `insert into public.activities(id,title,category,location_name,latitude,longitude,max_participants,host_id,starts_at,ends_at)
      values ('${activity}','Volleyball','sports','ARC',38.54,-121.75,1,'${host}',now(),now()+interval '1 hour')`
    await asUser(host, create)
    await assert.rejects(asUser(guest, `insert into activity_participants(activity_id,user_id) values ('${activity}','${guest}')`), /permission denied|row-level security/)
    let result = await asUser(guest, `select * from join_activity('${activity}')`)
    assert.equal(result.rows[0].participant_count, 1)
    assert.equal(result.rows[0].is_joined, true)
    result = await asUser(guest, `select * from join_activity('${activity}')`)
    assert.equal(result.rows[0].participant_count, 1, 'duplicate join is idempotent')
    await assert.rejects(asUser(host, `select * from join_activity('${activity}')`), /already full/)
    const denied = await asUser(guest, `update activities set title='Stolen' where id='${activity}' returning id`)
    assert.equal(denied.rows.length, 0)
    const deniedDelete = await asUser(guest, `delete from activities where id='${activity}' returning id`)
    assert.equal(deniedDelete.rows.length, 0)
    await asUser(host, `update activities set max_participants=2 where id='${activity}'`)
    await asUser(host, `select * from join_activity('${activity}')`)
    await assert.rejects(asUser(host, `update activities set max_participants=1 where id='${activity}'`), /Capacity cannot/)
    result = await asUser(guest, `select * from leave_activity('${activity}')`)
    assert.equal(result.rows[0].participant_count, 1)
    assert.equal(result.rows[0].is_joined, false)
    await asUser(host, `update activities set starts_at=now()-interval '2 hours', ends_at=now()-interval '1 hour' where id='${activity}'`)
    await assert.rejects(asUser(guest, `select * from join_activity('${activity}')`), /already ended/)
    await assert.rejects(asUser('', `select * from join_activity('${activity}')`), /must be signed in/)
    await asUser(host, `delete from activities where id='${activity}'`)
    assert.equal((await db.query('select * from activity_participants')).rows.length, 0, 'deletion cascades')
    await assert.rejects(asUser(guest, `select * from leave_activity('${activity}')`), /no longer exists/)
  } finally { await db.close() }
})
