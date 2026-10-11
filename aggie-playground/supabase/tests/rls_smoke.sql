-- =============================================================================
-- Aggie Playground — RLS / RPC smoke test
--
-- Covers the things a unit test cannot: activity capacity, duplicate joins,
-- host auto-join, and who is allowed to read or write what.
--
-- EVERYTHING RUNS INSIDE A TRANSACTION THAT ROLLS BACK. It creates test users
-- and activities, asserts on them, then `rollback` — so it leaves no rows
-- behind and is safe to run against a database you care about.
--
-- HOW TO RUN
--   Supabase Dashboard -> SQL Editor -> paste this file -> Run.
--   Read the notices: each PASS is printed; the first FAIL raises an exception
--   and prints the reason. A failing run still leaves nothing behind.
--
-- STATUS: written, NOT yet executed against a real Supabase project.
-- Do not treat a green run as verified until somebody has actually run it.
-- =============================================================================

begin;

-- Test identities. Fixed UUIDs so later statements can refer to them without
-- having to capture generated ids.
--   ...aa01 = host of the test activity
--   ...bb01 = joins, then leaves
--   ...cc01 = takes the last slot
--   ...dd01 = arrives when it is already full
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000aa01', 'a@aggie.test'),
  ('00000000-0000-0000-0000-0000000000bb01', 'b@aggie.test'),
  ('00000000-0000-0000-0000-0000000000cc01', 'c@aggie.test'),
  ('00000000-0000-0000-0000-0000000000dd01', 'd@aggie.test');

-- The handle_new_user trigger should have created a profile for each of them.
do $$
declare n int;
begin
  select count(*) into n from public.profiles
  where id in (
    '00000000-0000-0000-0000-0000000000aa01',
    '00000000-0000-0000-0000-0000000000bb01',
    '00000000-0000-0000-0000-0000000000cc01',
    '00000000-0000-0000-0000-0000000000dd01');
  if n <> 4 then raise exception 'FAIL: handle_new_user created % profiles, expected 4', n; end if;
  raise notice 'PASS  handle_new_user auto-creates a profile for each new account';
end $$;

-- ── act as the host ──────────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000aa01', true);
set local role authenticated;

do $$
declare n int;
begin
  insert into public.activities
    (id, host_id, title, category, subcategory, location_key, location_name,
     lat, lng, starts_at, duration_min, max_participants)
  values
    ('00000000-0000-0000-0000-0000000000ac01',
     '00000000-0000-0000-0000-0000000000aa01',
     'Smoke Test Basketball', 'Competitive Sports', 'Basketball', 'arc', 'UC Davis ARC',
     38.5437, -121.7565, now() + interval '1 hour', 60, 2);

  -- host_auto_join trigger
  select count(*) into n from public.participants
   where activity_id = '00000000-0000-0000-0000-0000000000ac01';
  if n <> 1 then raise exception 'FAIL: host was not auto-joined (participants=%)', n; end if;
  raise notice 'PASS  host_auto_join adds the host as the first participant';
end $$;

-- A user must not be able to create an activity on someone else's behalf.
do $$
begin
  begin
    insert into public.activities
      (host_id, title, category, subcategory, location_key, location_name,
       lat, lng, starts_at, duration_min, max_participants)
    values
      ('00000000-0000-0000-0000-0000000000bb01', 'Impersonation', 'x', 'y', 'z', 'z',
       1, 1, now() + interval '1 hour', 60, 4);
    raise exception 'FAIL: RLS allowed hosting an activity as another user';
  exception
    when insufficient_privilege then
      raise notice 'PASS  RLS blocks creating an activity hosted by someone else';
  end;
end $$;

-- ── act as student B ─────────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000bb01', true);

do $$
declare n int;
begin
  perform public.join_activity('00000000-0000-0000-0000-0000000000ac01');
  select participant_count into n from public.activity_feed
   where id = '00000000-0000-0000-0000-0000000000ac01';
  if n <> 2 then raise exception 'FAIL: participant_count is %, expected 2', n; end if;
  raise notice 'PASS  join_activity works and participant_count is derived (2/2)';
end $$;

-- Joining twice must not double-count.
do $$
begin
  begin
    perform public.join_activity('00000000-0000-0000-0000-0000000000ac01');
    raise exception 'FAIL: joining twice was allowed';
  exception
    when others then
      if sqlerrm not like '%already_joined%' then raise; end if;
      raise notice 'PASS  joining twice is rejected (already_joined)';
  end;
end $$;

-- ── act as student C — the activity is now full (max 2) ──────────────────────
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000cc01', true);

do $$
begin
  begin
    perform public.join_activity('00000000-0000-0000-0000-0000000000ac01');
    raise exception 'FAIL: capacity was not enforced — a 3rd person joined a 2-person activity';
  exception
    when others then
      if sqlerrm not like '%full%' then raise; end if;
      raise notice 'PASS  capacity is enforced atomically (full)';
  end;
end $$;

do $$
declare n int;
begin
  select count(*) into n from public.participants
   where activity_id = '00000000-0000-0000-0000-0000000000ac01';
  if n <> 2 then raise exception 'FAIL: % participant rows after a refused join, expected 2', n; end if;
  raise notice 'PASS  the refused join left no row behind';
end $$;

-- Participants are written only through the RPCs, never directly.
do $$
begin
  begin
    insert into public.participants (activity_id, user_id)
    values ('00000000-0000-0000-0000-0000000000ac01',
            '00000000-0000-0000-0000-0000000000dd01');
    raise exception 'FAIL: RLS allowed a direct insert into participants';
  exception
    when insufficient_privilege then
      raise notice 'PASS  RLS blocks direct inserts into participants';
  end;
end $$;

-- ── profiles are private; public_profiles is the curated projection ──────────
do $$
declare n int;
begin
  select count(*) into n from public.profiles
   where id = '00000000-0000-0000-0000-0000000000aa01';
  if n <> 0 then raise exception 'FAIL: another user''s profile row is readable'; end if;
  raise notice 'PASS  profiles are readable only by their owner';

  select count(*) into n from public.public_profiles
   where id = '00000000-0000-0000-0000-0000000000aa01';
  if n <> 1 then raise exception 'FAIL: public_profiles should expose the display name'; end if;
  raise notice 'PASS  public_profiles exposes the curated public projection';
end $$;

-- ── leaving frees the slot again ─────────────────────────────────────────────
do $$
declare n int;
begin
  perform public.leave_activity('00000000-0000-0000-0000-0000000000ac01');
  select participant_count into n from public.activity_feed
   where id = '00000000-0000-0000-0000-0000000000ac01';
  if n <> 1 then raise exception 'FAIL: participant_count is % after leaving, expected 1', n; end if;
  raise notice 'PASS  leave_activity frees the slot (1/2)';
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000dd01', true);

do $$
declare n int;
begin
  perform public.join_activity('00000000-0000-0000-0000-0000000000ac01');
  select participant_count into n from public.activity_feed
   where id = '00000000-0000-0000-0000-0000000000ac01';
  if n <> 2 then raise exception 'FAIL: participant_count is % after D joined, expected 2', n; end if;
  raise notice 'PASS  a freed slot can be taken by somebody else';
end $$;

-- ── notifications ────────────────────────────────────────────────────────────
-- Give A a favourite category, then have D host an activity in it.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000aa01', true);
update public.profiles set favorite_categories = array['Competitive Sports']
 where id = '00000000-0000-0000-0000-0000000000aa01';

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000dd01', true);
insert into public.activities
  (id, host_id, title, category, subcategory, location_key, location_name,
   lat, lng, starts_at, duration_min, max_participants)
values
  ('00000000-0000-0000-0000-0000000000ac02',
   '00000000-0000-0000-0000-0000000000dd01',
   'Notify Me Volleyball', 'Competitive Sports', 'Volleyball', 'arc', 'UC Davis ARC',
   38.5437, -121.7565, now() + interval '3 hours', 60, 6);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000aa01', true);
do $$
declare n int;
begin
  select count(*) into n from public.notifications
   where user_id = '00000000-0000-0000-0000-0000000000aa01'
     and activity_id = '00000000-0000-0000-0000-0000000000ac02';
  if n <> 1 then raise exception 'FAIL: interested student got % notifications, expected 1', n; end if;
  raise notice 'PASS  a new activity notifies students who favourited that category';
end $$;

-- The host must not notify themselves.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000dd01', true);
do $$
declare n int;
begin
  select count(*) into n from public.notifications
   where user_id = '00000000-0000-0000-0000-0000000000dd01';
  if n <> 0 then raise exception 'FAIL: host was notified about their own activity'; end if;
  raise notice 'PASS  the host is not notified about their own activity';
end $$;

-- Notifications are private to their owner.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000cc01', true);
do $$
declare n int;
begin
  select count(*) into n from public.notifications
   where user_id = '00000000-0000-0000-0000-0000000000aa01';
  if n <> 0 then raise exception 'FAIL: another user''s notifications are readable'; end if;
  raise notice 'PASS  notifications are readable only by their owner';
end $$;

-- ── realtime publication ─────────────────────────────────────────────────────
reset role;

do $$
declare n int;
begin
  select count(*) into n from pg_publication_tables
   where pubname = 'supabase_realtime'
     and schemaname = 'public'
     and tablename in ('activities', 'participants', 'notifications', 'posts');
  if n <> 4 then raise exception 'FAIL: % of 4 tables are in supabase_realtime', n; end if;
  raise notice 'PASS  activities, participants, notifications and posts are all published for realtime';
end $$;

-- ── the public_profiles projection, as an ANONYMOUS reader ───────────────────
-- `public_profiles` is a view WITHOUT security_invoker, so it runs with its
-- owner's rights and deliberately bypasses the RLS on public.profiles. That is
-- the intended design — the CASE expressions are the protection — but it is
-- also the classic RLS-leak shape, so pin down exactly what it exposes.
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;

do $$
declare
  n int;
  masked_bio text;
  masked_favs text[];
begin
  -- 1. The base table must be completely unreachable for an anonymous reader.
  select count(*) into n from public.profiles;
  if n <> 0 then raise exception 'FAIL: anon can read public.profiles directly (% rows)', n; end if;
  raise notice 'PASS  anon cannot read the profiles base table at all';

  -- 2. The curated projection is readable.
  select count(*) into n from public.public_profiles;
  if n < 1 then raise exception 'FAIL: anon cannot read public_profiles'; end if;
  raise notice 'PASS  anon can read the public_profiles projection';

  -- 3. Non-discoverable profile: interests and bio are masked even though the
  --    row genuinely holds them (aa01 favourited 'Competitive Sports' above).
  select bio, favorite_categories into masked_bio, masked_favs
    from public.public_profiles
   where id = '00000000-0000-0000-0000-0000000000aa01';

  if masked_bio <> '' then
    raise exception 'FAIL: bio leaked for a non-discoverable profile: %', masked_bio;
  end if;
  if masked_favs <> '{}'::text[] then
    raise exception 'FAIL: favorite_categories leaked for a non-discoverable profile: %', masked_favs;
  end if;
  raise notice 'PASS  a non-discoverable profile exposes no bio and no interests';
end $$;

-- Flip that student to discoverable, as the owner would.
reset role;
update public.profiles set discoverable = true, bio = 'Come play basketball with me'
 where id = '00000000-0000-0000-0000-0000000000aa01';
set local role anon;

do $$
declare
  n int;
  shown_bio text;
  shown_favs text[];
begin
  -- 4. Opting in DOES expose the fields — otherwise the masking above would be
  --    indistinguishable from the view being broken.
  select bio, favorite_categories into shown_bio, shown_favs
    from public.public_profiles
   where id = '00000000-0000-0000-0000-0000000000aa01';

  if shown_bio <> 'Come play basketball with me' then
    raise exception 'FAIL: an opted-in student''s bio is not visible (got %)', shown_bio;
  end if;
  if shown_favs <> array['Competitive Sports']::text[] then
    raise exception 'FAIL: an opted-in student''s interests are not visible (got %)', shown_favs;
  end if;
  raise notice 'PASS  opting in to matching does expose bio and interests';

  -- 5. The view is a curated projection, not `select *`. created_at exists on
  --    public.profiles and must NOT be reachable through the view.
  select count(*) into n
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'public_profiles'
     and column_name = 'created_at';
  if n <> 0 then
    raise exception 'FAIL: public_profiles exposes created_at — it is not a curated projection';
  end if;
  raise notice 'PASS  public_profiles is a curated projection, not a passthrough of profiles';
end $$;

reset role;

-- ── nothing is kept ──────────────────────────────────────────────────────────
rollback;

do $$ begin raise notice 'ALL CHECKS PASSED — transaction rolled back, no data was written'; end $$;
