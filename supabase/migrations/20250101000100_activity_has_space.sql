-- =============================================================================
-- WoCow · Migration 2/7 — capacity helper
-- Owner: Person 3 (Data)
--
-- Why this exists as a SECURITY DEFINER function instead of an inline
-- subquery inside the RLS policy:
--
--   A policy on activity_participants that sub-queries activity_participants
--   re-enters the same policy, and Postgres aborts with
--   "infinite recursion detected in policy for relation".
--
-- A SECURITY DEFINER function runs with the owner's rights, so it reads the
-- table without re-triggering the policy. It is `stable` so the planner can
-- cache it within a statement.
-- =============================================================================

create or replace function public.activity_has_space(p_activity_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select (coalesce(count(p.user_id), 0) < a.max_participants)
  from public.activities a
  left join public.activity_participants p on p.activity_id = a.id
  where a.id = p_activity_id
  group by a.max_participants;
$$;

comment on function public.activity_has_space(uuid) is
  'True when the activity still has room. Returns NULL (=> false) for unknown ids.';

-- Only signed-in users may join, so only they need to call this.
revoke all on function public.activity_has_space(uuid) from public;
grant execute on function public.activity_has_space(uuid) to authenticated;
