# Database reference

Everything here is created by the files in `supabase/migrations/`, applied in
filename order. Person 3 (Data) owns this.

---

## Tables

### `public.activities`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | PK, `gen_random_uuid()` |
| `title` | `text` | not null, 3–120 chars |
| `description` | `text` | nullable, ≤1000 chars — *addition to the original spec* |
| `category` | `text` | not null, free text, 2–40 chars |
| `location_name` | `text` | not null, 2–160 chars |
| `latitude` | `double precision` | not null, −90…90 |
| `longitude` | `double precision` | not null, −180…180 |
| `max_participants` | `integer` | not null, 1…500 |
| `host_id` | `uuid` | not null → `auth.users(id)` `on delete cascade` |
| `starts_at` | `timestamptz` | not null |
| `ends_at` | `timestamptz` | not null, must be **after** `starts_at` |
| `created_at` | `timestamptz` | not null, `now()` |

### `public.activity_participants`

| Column | Type | Notes |
| --- | --- | --- |
| `activity_id` | `uuid` | → `activities(id)` `on delete cascade` |
| `user_id` | `uuid` | → `auth.users(id)` `on delete cascade` |
| `joined_at` | `timestamptz` | not null, `now()` |

**Primary key: `(activity_id, user_id)`.**

Two things follow from that key, and both matter:

1. A user can only ever appear once per activity, so "join" is naturally
   idempotent.
2. It gives the capacity check an index, so counting is cheap.

### Why there is no `participant_count` column

A stored counter has to be updated by every join and leave. Two concurrent
joins can read the same value and both write back `n+1`, losing one — a
classic lost update. Counting rows instead makes the truth impossible to
corrupt. It is also why `activity_participants` has `on delete cascade`: if a
host cancels, the participation rows vanish with the activity, and no counter
is left stale.

---

## The `activity_feed` view

This is the read model the entire front end consumes. It is an `Activity` plus
three derived fields:

| Field | Meaning |
| --- | --- |
| `participant_count` | `count(activity_participants)` for this activity |
| `is_full` | `participant_count >= max_participants` |
| `is_joined` | has the **current** user joined (`auth.uid()`) |

```sql
create or replace view public.activity_feed
with (security_invoker = on)
as select a.*, … from public.activities a
left join public.activity_participants p on p.activity_id = a.id
group by a.id;
```

Two details worth knowing:

- **`security_invoker = on`** makes the view run with the *caller's* rights, so
  the RLS policies on the underlying tables still apply. Without it, a view is
  owned by whoever created it and silently bypasses RLS — a data-leak footgun
  that catches people out.
- **`group by a.id`** is legal because `id` is the primary key, so Postgres
  knows every other column of `a` is functionally dependent on it. That is why
  `a.*` can appear in the select list.

---

## Functions

### `public.join_activity(p_activity_id uuid) → activity_feed`

`security definer`, `stable`-free (it writes), `search_path` pinned.

1. Rejects anonymous callers (`auth.uid()` is null) with SQLSTATE `28000`.
2. `select … for update` on the activity row — **takes an exclusive lock**, so
   concurrent joiners are serialised.
3. If the caller is already a participant, it is a no-op.
4. Otherwise it counts participants and raises `P0001` ("already full") when
   `count >= max_participants`.
5. Returns the refreshed feed row.

### `public.leave_activity(p_activity_id uuid) → activity_feed`

Deletes the caller's own participation row and returns the refreshed feed row.
Deleting nothing is not an error.

### `public.activity_has_space(p_activity_id uuid) → boolean`

`security definer`, `stable`. Legacy helper; the insert policy is removed by the backend integrity migration.

It exists as a function rather than an inline subquery because a policy on
`activity_participants` that reads `activity_participants` re-enters its own
policy, and Postgres aborts the query with:

```
infinite recursion detected in policy for relation "activity_participants"
```

Running it `security definer` breaks that cycle.

---

## Row Level Security

Both tables have RLS **enabled**. With RLS on and no matching policy, access is
denied — so the policies below are the whole security model.

### `activities`

| Policy | Operation | Role | Rule |
| --- | --- | --- | --- |
| activities are publicly readable | SELECT | anon, authenticated | `true` |
| users can create their own activities | INSERT | authenticated | `host_id = auth.uid()` |
| hosts can update their own activities | UPDATE | authenticated | `host_id = auth.uid()` |
| hosts can delete their own activities | DELETE | authenticated | `host_id = auth.uid()` |

### `activity_participants`

| Policy | Operation | Role | Rule |
| --- | --- | --- | --- |
| participants are publicly readable | SELECT | anon, authenticated | `true` |
| direct participant inserts | INSERT | authenticated | Denied; use `join_activity()` |
| users can leave activities | DELETE | authenticated | `user_id = auth.uid()` |

### Why `(select auth.uid())` and not `auth.uid()`

Wrapping the call in a subquery turns it into an InitPlan that Postgres
evaluates **once per query** instead of once per row. This is Supabase's
documented performance idiom, and it matters as soon as a table has more than a
few hundred rows.

---

## Realtime

Migration 6 adds both tables to the `supabase_realtime` publication, inside a
catalogue check so the migration is re-runnable:

```sql
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
end $$;
```

`alter publication … add table` hard-errors if the table is already a member —
and with five people running the same script, that happens constantly.

`activities` is set to `REPLICA IDENTITY FULL` so UPDATE and DELETE events
carry the whole old row. For `activity_participants` the default replica
identity already sends `(activity_id, user_id)`, which is all the client needs
to re-fetch a count.

**Client side:** `src/features/activities/realtime.ts` subscribes, and the
unsubscribe function it returns must be called on unmount. `useActivities`
debounces the resulting refetches by 250 ms so a room full of people joining at
once causes one request, not fifty.

---

## Extending the schema

1. Add a new timestamped file — never edit an applied migration:
   `supabase/migrations/20250101000700_add_activity_tags.sql`
2. Update `src/lib/types.ts` in the **same pull request**.
3. Have Person 3 review it.

Conventions worth keeping:

- `enable row level security` on every new table, plus explicit policies.
- Add new columns as `NULL`-able or with a default, so the old code keeps
  working while the PR is in review.
- Add indexes for the columns you actually filter on.

## Backend integrity update

Apply `20261011000000_backend_integrity.sql` after the existing migrations.
This applies to the root Vite app only; do not apply the separate
`aggie-playground/` schema to the same database.

- Participant inserts and updates are denied to browser roles. The join RPC
  performs the capacity check while locking the activity row.
- New joins are rejected after `ends_at`; repeat joins remain idempotent.
- Leave takes the same activity lock and reports missing activities.
- Hosts cannot lower capacity below the existing participant count.
- Client edits allow only writable activity fields; edits and cancellations
  that affect no row report an error instead of a false success.
- The feed refreshes after authentication changes, reconnects, and every minute;
  stale requests cannot overwrite newer filter results.

Run `npm run test:backend` to apply the migrations to an embedded Postgres
engine and check RLS, capacity, duplicate joins, expiration, and cascading
cancellation. Supabase auth roles and the publication are shimmed for this
local test. This does not test concurrent database sessions or live Realtime.
Run `npm test` for the API and matching tests.

For the live check, configure Supabase, apply the migrations, and open two
accounts. Create an activity with one available place, join from both, and
verify only one succeeds and both screens update. Also verify a non-host
cannot edit/cancel, and sign-out clears the joined badges.
