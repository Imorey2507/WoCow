-- =============================================================================
-- WoCow · Migration 4/7 — Row Level Security
-- Owner: Person 3 (Data)
--
-- The publishable/anon key ships inside the browser bundle, so it is PUBLIC.
-- RLS is the only thing standing between that key and your data. Rules:
--
--   activities            : world-readable, writable only by its host
--   activity_participants : world-readable, a user may only add/remove HERSELF
--
-- `(select auth.uid())` instead of bare `auth.uid()` is the Supabase
-- performance idiom: it becomes an InitPlan evaluated once per query rather
-- than once per row.
-- =============================================================================

alter table public.activities            enable row level security;
alter table public.activity_participants enable row level security;

-- -----------------------------------------------------------------------------
-- activities
-- -----------------------------------------------------------------------------
drop policy if exists "activities are publicly readable" on public.activities;
create policy "activities are publicly readable"
  on public.activities
  for select
  to anon, authenticated
  using (true);

drop policy if exists "users can create their own activities" on public.activities;
create policy "users can create their own activities"
  on public.activities
  for insert
  to authenticated
  with check (host_id = (select auth.uid()));

drop policy if exists "hosts can update their own activities" on public.activities;
create policy "hosts can update their own activities"
  on public.activities
  for update
  to authenticated
  using (host_id = (select auth.uid()))
  with check (host_id = (select auth.uid()));

drop policy if exists "hosts can delete their own activities" on public.activities;
create policy "hosts can delete their own activities"
  on public.activities
  for delete
  to authenticated
  using (host_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- activity_participants
-- -----------------------------------------------------------------------------
drop policy if exists "participants are publicly readable" on public.activity_participants;
create policy "participants are publicly readable"
  on public.activity_participants
  for select
  to anon, authenticated
  using (true);

-- You may only insert a row for yourself, and only if there is still room.
-- The capacity check here is defence in depth; the authoritative check is the
-- row lock inside public.join_activity() (migration 5).
drop policy if exists "users can join activities as themselves"
  on public.activity_participants;
create policy "users can join activities as themselves"
  on public.activity_participants
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and public.activity_has_space(activity_id)
  );

-- Leaving = deleting your own row. You can never remove someone else's.
drop policy if exists "users can leave activities" on public.activity_participants;
create policy "users can leave activities"
  on public.activity_participants
  for delete
  to authenticated
  using (user_id = (select auth.uid()));
