-- =============================================================================
-- WoCow · Migration 1/7 — core schema
-- Owner: Person 3 (Data / activities + database)
--
-- Run this in the Supabase Dashboard -> SQL Editor, or push it with the
-- Supabase CLI (`supabase db push`). Every file in supabase/migrations/ is
-- applied in filename order.
--
-- Design note: activity head-count is NEVER stored in a mutable counter.
-- It is always derived by counting rows in activity_participants. That makes
-- concurrent joins safe and keeps a single source of truth.
-- =============================================================================

-- gen_random_uuid() has been built into PostgreSQL core since 13, which is far
-- older than any Supabase project. pgcrypto is only needed on pre-13 servers,
-- and some PostgreSQL builds ship without it — so a missing extension is a
-- notice, not a fatal error. Never let a no-op convenience break the schema.
do $$
begin
  begin
    create extension if not exists "pgcrypto";
  exception when others then
    raise notice 'pgcrypto unavailable (%); using the built-in gen_random_uuid()', sqlerrm;
  end;
end
$$;

-- -----------------------------------------------------------------------------
-- activities — one row per campus activity
-- -----------------------------------------------------------------------------
create table if not exists public.activities (
  id               uuid primary key default gen_random_uuid(),
  title            text not null
                     check (char_length(btrim(title)) between 3 and 120),
  description      text
                     check (description is null or char_length(description) <= 1000),
  category         text not null
                     check (char_length(btrim(category)) between 2 and 40),
  location_name    text not null
                     check (char_length(btrim(location_name)) between 2 and 160),
  latitude         double precision not null
                     check (latitude between -90 and 90),
  longitude        double precision not null
                     check (longitude between -180 and 180),
  max_participants integer not null
                     check (max_participants > 0 and max_participants <= 500),
  host_id          uuid not null references auth.users (id) on delete cascade,
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  created_at       timestamptz not null default now(),

  constraint activities_time_order check (ends_at > starts_at)
);

comment on table  public.activities is
  'Campus activities. Participant counts are derived from activity_participants.';
comment on column public.activities.host_id is
  'The auth.users row that created the activity. Only the host may edit/delete it.';

-- -----------------------------------------------------------------------------
-- activity_participants — who joined what
-- -----------------------------------------------------------------------------
create table if not exists public.activity_participants (
  activity_id uuid not null references public.activities (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  joined_at   timestamptz not null default now(),

  -- The composite primary key is what makes "join" idempotent: a user can
  -- only ever appear once per activity.
  primary key (activity_id, user_id)
);

comment on table public.activity_participants is
  'Join table between activities and auth.users. Drives every head-count.';

-- -----------------------------------------------------------------------------
-- Indexes for the queries the app actually runs
-- -----------------------------------------------------------------------------
create index if not exists activities_starts_at_idx on public.activities (starts_at);
create index if not exists activities_category_idx  on public.activities (category);
create index if not exists activities_host_idx      on public.activities (host_id);
create index if not exists activities_geo_idx       on public.activities (latitude, longitude);

-- (activity_id, user_id) is already the PK; this covers "activities I joined".
create index if not exists activity_participants_user_idx
  on public.activity_participants (user_id);
