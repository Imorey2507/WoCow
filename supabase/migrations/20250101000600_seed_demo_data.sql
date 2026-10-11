-- =============================================================================
-- WoCow · Migration 7/7 — optional demo seed
-- Owner: Person 3 (Data)
--
-- Gives the team something to look at on day one, so Person 1, 2 and 4 can
-- build UI against real rows instead of an empty table.
--
-- Safe to run repeatedly: it exits early if activities already exist, and it
-- exits with a notice if nobody has signed up yet (activities.host_id
-- references auth.users, so there must be at least one real account).
--
-- >>> To seed: sign up once in the app, then re-run this file. <<<
-- =============================================================================

do $$
declare
  v_host     uuid;
  v_existing integer;
begin
  select count(*) into v_existing from public.activities;
  if v_existing > 0 then
    raise notice 'Seed skipped: public.activities already has % row(s).', v_existing;
    return;
  end if;

  select u.id into v_host from auth.users u order by u.created_at limit 1;

  if v_host is null then
    raise notice 'Seed skipped: no auth.users row yet. Sign up in the app, then re-run this file.';
    return;
  end if;

  insert into public.activities
    (title, description, category, location_name,
     latitude, longitude, max_participants, host_id, starts_at, ends_at)
  values
    ('Basketball at the ARC',
     'Pickup 5v5. Bring a light and dark shirt. All skill levels welcome.',
     'basketball', 'UC Davis ARC', 38.5437, -121.7565, 10, v_host,
     now() + interval '3 hours', now() + interval '5 hours'),

    ('Study Jam: Midterm Cram',
     'Silent study for the first hour, then we quiz each other on the hard parts.',
     'study', 'Shields Library, 2nd floor', 38.5401, -121.7490, 8, v_host,
     now() + interval '1 day 2 hours', now() + interval '1 day 6 hours'),

    ('Sunset Run around the Arboretum',
     'Easy 5k, conversational pace. We regroup at the footbridge.',
     'running', 'UC Davis Arboretum', 38.5360, -121.7530, 12, v_host,
     now() + interval '8 hours', now() + interval '10 hours'),

    ('Coffee & Board Games',
     'Catan, Codenames, and whatever else people bring. First coffee is on the host.',
     'social', 'Davis CoHo', 38.5421, -121.7495, 6, v_host,
     now() + interval '2 days', now() + interval '2 days 3 hours'),

    ('Intramural Soccer Pickup',
     'Full pitch, 7v7. Cleats recommended, shin guards optional.',
     'soccer', 'Hutchison Field', 38.5395, -121.7555, 22, v_host,
     now() + interval '2 days 5 hours', now() + interval '2 days 7 hours'),

    ('Jazz Night Meetup',
     'Catch the student ensemble, then grab food downtown afterwards.',
     'music', 'Mondavi Center', 38.5350, -121.7480, 15, v_host,
     now() + interval '3 days', now() + interval '3 days 4 hours');

  raise notice 'Seeded 6 demo activities hosted by %.', v_host;
end
$$;
