-- =============================================================================
-- WoCow · Migration 6/7 — Realtime
-- Owner: Person 3 (Data)
--
-- Adds both tables to the `supabase_realtime` publication so the browser gets
-- postgres_changes events and every open page updates without a refresh.
--
-- Wrapped in a catalogue check because `alter publication ... add table`
-- hard-errors if the table is already a member. This makes the migration
-- safely re-runnable, which matters when five people share one database.
-- =============================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'activity_participants'
  ) then
    alter publication supabase_realtime add table public.activity_participants;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'activities'
  ) then
    alter publication supabase_realtime add table public.activities;
  end if;
end
$$;

-- With the default replica identity, DELETE events carry only the primary key.
-- For activity_participants the PK is (activity_id, user_id), which is exactly
-- what the client needs to re-fetch a count, so the default is sufficient.
-- For activities we want the whole old row on an edit/delete toast, so upgrade
-- that one table to REPLICA IDENTITY FULL.
alter table public.activities replica identity full;
