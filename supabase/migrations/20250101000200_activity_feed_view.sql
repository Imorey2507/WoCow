-- =============================================================================
-- WoCow · Migration 3/7 — activity_feed view
-- Owner: Person 3 (Data)
--
-- The single read model the whole front end consumes. It attaches the three
-- derived fields the UI cares about:
--
--   participant_count : how many people joined (never a stored counter)
--   is_full           : participant_count >= max_participants
--   is_joined         : has the *current* user already joined
--
-- security_invoker = on means the view runs with the CALLER's rights, so the
-- RLS policies on activities / activity_participants still apply. Without it
-- a view would silently act as a security hole that leaks every row.
-- =============================================================================

create or replace view public.activity_feed
with (security_invoker = on)
as
select
  a.id,
  a.title,
  a.description,
  a.category,
  a.location_name,
  a.latitude,
  a.longitude,
  a.max_participants,
  a.host_id,
  a.starts_at,
  a.ends_at,
  a.created_at,
  coalesce(count(p.user_id), 0)::integer            as participant_count,
  (coalesce(count(p.user_id), 0) >= a.max_participants) as is_full,
  exists (
    select 1
    from public.activity_participants me
    where me.activity_id = a.id
      and me.user_id = auth.uid()
  )                                                  as is_joined
from public.activities a
left join public.activity_participants p on p.activity_id = a.id
group by a.id;

comment on view public.activity_feed is
  'Activities plus derived head-count flags. Grouping by the PK lets us select a.*.';

grant select on public.activity_feed to anon, authenticated;
