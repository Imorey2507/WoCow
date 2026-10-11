-- Keep all joins on the locked RPC path; a capacity-only RLS predicate races.
drop policy if exists "users can join activities as themselves" on public.activity_participants;
revoke insert, update on public.activity_participants from anon, authenticated;
grant select on public.activities, public.activity_participants to anon, authenticated;
grant insert, update, delete on public.activities to authenticated;
grant delete on public.activity_participants to authenticated;

-- Parent UPDATE already holds the same lock as join_activity, so lowering the
-- capacity cannot race a join or leave the activity over capacity.
create or replace function public.enforce_activity_capacity()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.max_participants < (select count(*) from public.activity_participants where activity_id = old.id) then
    raise exception 'Capacity cannot be below the current participant count.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger activities_capacity_guard before update of max_participants on public.activities
for each row execute function public.enforce_activity_capacity();

create or replace function public.join_activity(p_activity_id uuid)
returns public.activity_feed language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_user uuid := auth.uid();
  v_activity public.activities;
  v_result public.activity_feed;
begin
  if v_user is null then
    raise exception 'You must be signed in to join an activity.' using errcode = '28000';
  end if;
  select * into v_activity from public.activities where id = p_activity_id for update;
  if not found then
    raise exception 'That activity no longer exists.' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.activity_participants where activity_id = p_activity_id and user_id = v_user) then
    if v_activity.ends_at <= now() then
      raise exception 'This activity has already ended.' using errcode = 'P0001';
    end if;
    if (select count(*) from public.activity_participants where activity_id = p_activity_id) >= v_activity.max_participants then
      raise exception 'This activity is already full.' using errcode = 'P0001';
    end if;
    insert into public.activity_participants(activity_id, user_id) values (p_activity_id, v_user);
  end if;
  select * into v_result from public.activity_feed where id = p_activity_id;
  return v_result;
end;
$$;

create or replace function public.leave_activity(p_activity_id uuid)
returns public.activity_feed language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_user uuid := auth.uid();
  v_result public.activity_feed;
begin
  if v_user is null then
    raise exception 'You must be signed in to leave an activity.' using errcode = '28000';
  end if;
  perform 1 from public.activities where id = p_activity_id for update;
  if not found then
    raise exception 'That activity no longer exists.' using errcode = 'P0002';
  end if;
  delete from public.activity_participants where activity_id = p_activity_id and user_id = v_user;
  select * into v_result from public.activity_feed where id = p_activity_id;
  return v_result;
end;
$$;
revoke all on function public.join_activity(uuid), public.leave_activity(uuid) from public;
grant execute on function public.join_activity(uuid), public.leave_activity(uuid) to authenticated;
