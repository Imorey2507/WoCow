-- Aggie Playground — initial schema
-- Run in the Supabase SQL editor (or `supabase db push`).

create extension if not exists "pgcrypto";

-- ───────────────────────── profiles ─────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Aggie',
  avatar_emoji text not null default '🐮',
  avatar_color text not null default '#FFD84D',
  bio text not null default '',
  favorite_categories text[] not null default '{}',
  preferred_activities text[] not null default '{}',
  discoverable boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- A profile row is private to its owner. Everyone else reads through public_profiles.
create policy "own profile read" on public.profiles for select using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);

-- Public view: name/avatar always; interests + bio only when the student opted in to matching.
create view public.public_profiles as
select
  id,
  display_name,
  avatar_emoji,
  avatar_color,
  is_demo,
  discoverable,
  case when discoverable then bio else '' end as bio,
  case when discoverable then favorite_categories else '{}' end as favorite_categories,
  case when discoverable then preferred_activities else '{}' end as preferred_activities
from public.profiles;
grant select on public.public_profiles to authenticated, anon;

-- Auto-create a profile on sign-up.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(split_part(new.email, '@', 1), 'Aggie'))
  on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ───────────────────────── activities ─────────────────────────
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 80),
  category text not null,
  subcategory text not null,
  location_key text not null,
  location_name text not null,
  lat double precision not null,
  lng double precision not null,
  starts_at timestamptz not null,
  duration_min int not null check (duration_min between 10 and 720),
  max_participants int not null check (max_participants between 2 and 200),
  description text not null default '',
  skill_level text check (skill_level in ('Competitive','Casual','Beginners Welcome','All Levels')),
  vibe text,
  what_to_bring text,
  status text not null default 'active' check (status in ('active','cancelled')),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index activities_starts_at_idx on public.activities (starts_at);
create index activities_category_idx on public.activities (category);

alter table public.activities enable row level security;
create policy "activities readable" on public.activities for select using (true);
create policy "host creates" on public.activities for insert with check (auth.uid() = host_id);
create policy "host edits" on public.activities for update using (auth.uid() = host_id) with check (auth.uid() = host_id);
-- No delete policy: hosts cancel (status = 'cancelled') so joined students can be notified.

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger activities_touch before update on public.activities
for each row execute function public.touch_updated_at();

-- ───────────────────────── participants ─────────────────────────
create table public.participants (
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (activity_id, user_id)          -- duplicate joins impossible
);
create index participants_user_idx on public.participants (user_id);

alter table public.participants enable row level security;
create policy "participants readable" on public.participants for select using (true);
-- No insert/delete policies: all writes go through join_activity / leave_activity below,
-- which enforce capacity atomically.

-- Participant counts are always derived from participation rows.
create view public.activity_feed with (security_invoker = true) as
select
  a.*,
  coalesce(c.n, 0)::int as participant_count,
  greatest(a.max_participants - coalesce(c.n, 0), 0)::int as spots_remaining,
  hp.display_name as host_name,
  hp.avatar_emoji as host_emoji,
  hp.avatar_color as host_color,
  case
    when a.status = 'cancelled' then 'cancelled'
    when now() >= a.starts_at + make_interval(mins => a.duration_min) then 'ended'
    when now() >= a.starts_at then 'live'
    else 'upcoming'
  end as live_status
from public.activities a
left join (select activity_id, count(*) n from public.participants group by activity_id) c
  on c.activity_id = a.id
left join public.public_profiles hp on hp.id = a.host_id;
grant select on public.activity_feed to authenticated, anon;

-- Atomic join: locks the activity row so two students racing for the last spot
-- are serialized and the loser gets a clean 'full' error.
create or replace function public.join_activity(p_activity_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  a public.activities%rowtype;
  n int;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select * into a from public.activities where id = p_activity_id for update;
  if not found then raise exception 'not_found'; end if;
  if a.status <> 'active' then raise exception 'cancelled'; end if;
  if now() >= a.starts_at + make_interval(mins => a.duration_min) then raise exception 'ended'; end if;

  if exists (select 1 from public.participants where activity_id = p_activity_id and user_id = auth.uid()) then
    raise exception 'already_joined';
  end if;

  select count(*) into n from public.participants where activity_id = p_activity_id;
  if n >= a.max_participants then raise exception 'full'; end if;

  insert into public.participants (activity_id, user_id) values (p_activity_id, auth.uid());
end $$;

create or replace function public.leave_activity(p_activity_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  delete from public.participants where activity_id = p_activity_id and user_id = auth.uid();
end $$;

revoke all on function public.join_activity(uuid), public.leave_activity(uuid) from public;
grant execute on function public.join_activity(uuid), public.leave_activity(uuid) to authenticated;

-- The host is automatically the first participant.
create or replace function public.host_auto_join() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.participants (activity_id, user_id) values (new.id, new.host_id)
  on conflict do nothing;
  return new;
end $$;
create trigger activities_host_join after insert on public.activities
for each row execute function public.host_auto_join();

-- ───────────────────────── notifications ─────────────────────────
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('new_activity','activity_updated','activity_cancelled')),
  title text not null,
  body text not null default '',
  activity_id uuid references public.activities(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
create policy "own notifications read" on public.notifications for select using (auth.uid() = user_id);
create policy "own notifications update" on public.notifications for update using (auth.uid() = user_id);

-- New activity → notify students who favorited that category (except the host).
create or replace function public.notify_new_activity() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, kind, title, body, activity_id)
  select p.id, 'new_activity', 'New in ' || new.category, new.title || ' · ' || new.location_name, new.id
  from public.profiles p
  where new.category = any (p.favorite_categories) and p.id <> new.host_id;
  return new;
end $$;
create trigger activities_notify_new after insert on public.activities
for each row execute function public.notify_new_activity();

-- Update / cancel → notify joined students (except the host).
create or replace function public.notify_activity_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    insert into public.notifications (user_id, kind, title, body, activity_id)
    select pt.user_id, 'activity_cancelled', 'Cancelled: ' || new.title, 'The host cancelled this activity.', new.id
    from public.participants pt where pt.activity_id = new.id and pt.user_id <> new.host_id;
  elsif new.status = 'active' and (
      new.starts_at is distinct from old.starts_at or
      new.location_key is distinct from old.location_key or
      new.title is distinct from old.title) then
    insert into public.notifications (user_id, kind, title, body, activity_id)
    select pt.user_id, 'activity_updated', 'Updated: ' || new.title, 'Time or place changed — check the details.', new.id
    from public.participants pt where pt.activity_id = new.id and pt.user_id <> new.host_id;
  end if;
  return new;
end $$;
create trigger activities_notify_change after update on public.activities
for each row execute function public.notify_activity_change();

-- ───────────────────────── buddy requests ─────────────────────────
create table public.buddy_requests (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles(id) on delete cascade,
  to_user uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  check (from_user <> to_user),
  unique (from_user, to_user)
);
alter table public.buddy_requests enable row level security;

-- profiles rows are private (RLS), so a plain subquery in the policy could never see another
-- student's opt-in flag. This helper exposes exactly one bit — "has this student opted in?" —
-- and nothing else about the profile.
create or replace function public.is_discoverable(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select discoverable from public.profiles where id = p_id), false)
$$;
revoke all on function public.is_discoverable(uuid) from public;
grant execute on function public.is_discoverable(uuid) to authenticated;

create policy "buddy read own" on public.buddy_requests for select using (auth.uid() in (from_user, to_user));
create policy "buddy send" on public.buddy_requests for insert with check (
  auth.uid() = from_user and public.is_discoverable(to_user)
);
create policy "buddy respond" on public.buddy_requests for update using (auth.uid() = to_user);

-- ───────────────────────── campus club events (Context.dev cache) ─────────────────────────
create table public.club_events (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  title text not null,
  organization text,
  starts_at timestamptz,
  location text,
  description text,
  event_url text not null,
  source_site text not null,
  fetched_at timestamptz not null default now()
);
create index club_events_starts_idx on public.club_events (starts_at);
alter table public.club_events enable row level security;
create policy "club events readable" on public.club_events for select using (true);
-- Writes only via the server (service role key), never from the browser.

create table public.club_sync_log (
  id uuid primary key default gen_random_uuid(),
  ran_at timestamptz not null default now(),
  source_url text not null,
  ok boolean not null,
  events_found int not null default 0,
  error text
);
alter table public.club_sync_log enable row level security;
create policy "sync log readable" on public.club_sync_log for select using (true);

-- ───────────────────────── discussions ─────────────────────────
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  topic text not null check (topic in ('Looking for teammates','Anyone free tonight?','Campus recommendations','Upcoming events','Study groups')),
  title text not null check (char_length(title) between 3 and 120),
  body text not null default '',
  created_at timestamptz not null default now()
);
alter table public.posts enable row level security;
create policy "posts readable" on public.posts for select using (true);
create policy "posts create" on public.posts for insert with check (auth.uid() = author_id);
create policy "posts delete own" on public.posts for delete using (auth.uid() = author_id);

-- ───────────────────────── realtime ─────────────────────────
alter publication supabase_realtime add table public.activities, public.participants, public.notifications, public.posts;
