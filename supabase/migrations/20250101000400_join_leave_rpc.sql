-- =============================================================================
-- WoCow · Migration 5/7 — atomic join / leave
-- Owner: Person 3 (Data)
--
-- THE RACE CONDITION THIS SOLVES
-- ------------------------------
-- The naive approach is:
--     select count(*) ...           -- both see "9 of 10"
--     insert ...                    -- both insert -> 11 people
-- Two users tapping "Join" at the same moment both pass the check.
--
-- The fix is `select ... for update` on the parent activity row. Postgres
-- takes an exclusive row lock, so the second caller blocks until the first
-- transaction commits, then re-counts and correctly sees the activity full.
--
-- Combined with the (activity_id, user_id) primary key, joining twice is a
-- harmless no-op rather than an error.
-- =============================================================================

create or replace function public.join_activity(p_activity_id uuid)
returns public.activity_feed
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_max     integer;
  v_count   integer;
  v_result  public.activity_feed;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to join an activity.'
      using errcode = '28000';
  end if;

  -- Exclusive lock on the activity: serialises concurrent joiners.
  select a.max_participants into v_max
  from public.activities a
  where a.id = p_activity_id
  for update;

  if not found then
    raise exception 'That activity no longer exists.' using errcode = 'P0002';
  end if;

  -- Idempotent: already joined -> just report current state.
  if not exists (
    select 1 from public.activity_participants p
    where p.activity_id = p_activity_id and p.user_id = v_user_id
  ) then
    select count(*) into v_count
    from public.activity_participants p
    where p.activity_id = p_activity_id;

    if v_count >= v_max then
      raise exception 'This activity is already full.' using errcode = 'P0001';
    end if;

    insert into public.activity_participants (activity_id, user_id)
    values (p_activity_id, v_user_id);
  end if;

  select * into v_result from public.activity_feed where id = p_activity_id;
  return v_result;
end;
$$;

comment on function public.join_activity(uuid) is
  'Atomically join an activity. Raises when full; no-op when already joined.';

-- -----------------------------------------------------------------------------
-- leave_activity — symmetric, and also returns the fresh feed row
-- -----------------------------------------------------------------------------
create or replace function public.leave_activity(p_activity_id uuid)
returns public.activity_feed
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_result  public.activity_feed;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to leave an activity.'
      using errcode = '28000';
  end if;

  delete from public.activity_participants p
  where p.activity_id = p_activity_id
    and p.user_id = v_user_id;

  select * into v_result from public.activity_feed where id = p_activity_id;
  return v_result;
end;
$$;

comment on function public.leave_activity(uuid) is
  'Remove the caller from an activity and return the refreshed feed row.';

revoke all on function public.join_activity(uuid)  from public;
revoke all on function public.leave_activity(uuid) from public;
grant execute on function public.join_activity(uuid)  to authenticated;
grant execute on function public.leave_activity(uuid) to authenticated;
