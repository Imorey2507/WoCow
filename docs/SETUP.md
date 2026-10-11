# Supabase setup

One project, shared by all five people. Nobody creates their own.

Budget about five minutes. You need a free Supabase account.

---

## 1. Create the project

1. Sign in at [supabase.com/dashboard](https://supabase.com/dashboard).
2. **New project**.
3. Pick or create an Organization.
4. **Project name:** `WoCow`
5. **Database password:** generate a strong one and save it in your password
   manager. You will not need it for this app, but you cannot recover it.
6. **Region:** the US region closest to your campus.
7. **Create new project** and wait for provisioning (~2 minutes).

---

## 2. Create the database

All the SQL lives in `supabase/migrations/`, in filename order. Every file is
safe to re-run, so a mistake is never fatal.

1. Open **SQL Editor → New query**.
2. For **each file**, in this exact order, paste the contents and click **Run**:

| # | File | What it does |
| --- | --- | --- |
| 1 | `20250101000000_init_schema.sql` | `activities` + `activity_participants`, constraints, indexes |
| 2 | `20250101000100_activity_has_space.sql` | Capacity helper used by RLS |
| 3 | `20250101000200_activity_feed_view.sql` | `activity_feed` view with participant counts |
| 4 | `20250101000300_rls_policies.sql` | Row Level Security — **the important one** |
| 5 | `20250101000400_join_leave_rpc.sql` | `join_activity()` / `leave_activity()` |
| 6 | `20250101000500_realtime.sql` | Adds both tables to the realtime publication |
| 7 | `20250101000600_seed_demo_data.sql` | Optional demo data (see step 5) |

> **With the Supabase CLI instead:** `supabase link --project-ref <ref>` then
> `supabase db push`. It applies every file in order automatically.

**Do not skip file 4.** Files 1–3 create the tables; without RLS policies the
publishable key in the browser would be able to read and write anything.

---

## 3. Get the connection values

**Settings → API** (older dashboards: **Settings → API Keys**).

Copy two values:

| Dashboard label | Goes into |
| --- | --- |
| Project URL | `VITE_SUPABASE_URL` |
| `anon` / `publishable` key | `VITE_SUPABASE_PUBLISHABLE_KEY` |

Then, in the repo root:

```bash
cp .env.example .env.local
```

and fill it in:

```dotenv
VITE_SUPABASE_URL=https://abcdefghijklm.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOi...
```

Restart `pnpm dev` — **Vite only reads env files at startup.**

> ⚠️ Never copy the **`service_role`** key or the database password into
> `.env.local`. Those bypass Row Level Security completely. Anything named
> `VITE_*` is compiled into the JavaScript that every visitor downloads.

---

## 4. Configure authentication

**Authentication → Sign In / Providers.**

### For fast local development

Turn **Confirm email** off (**Authentication → Sign In / Providers → Email**).
Otherwise every test account needs a real inbox before it can sign in. Turn it
back on before the demo.

### For the one-tap demo

Enable **Anonymous sign-ins**. That is what powers the **"Continue as guest"**
button — the fastest way to get a judge into the app without typing an email.

### Redirect URLs

**Authentication → URL Configuration.** Add every origin that will sign users
in:

```
http://localhost:5173
https://your-app.vercel.app
https://your-app-git-main-yourteam.vercel.app
```

Magic links fail with a confusing error if the current origin is missing here.

---

## 5. Seed demo data (optional, recommended)

Judges should not see an empty app. The seed creates six activities around
UC Davis.

It needs at least one row in `auth.users` because `activities.host_id`
references it, so:

1. Start the app, sign up (or use guest sign-in) once.
2. Re-run `20250101000600_seed_demo_data.sql` in the SQL Editor.
3. Refresh — six activities appear.

The script is idempotent: it exits with a notice if activities already exist or
if no user has signed up yet.

---

## 6. Verify it worked

Run this in the SQL Editor:

```sql
-- Should return 2 (both tables) — proves RLS is on.
select tablename
from pg_tables
where schemaname = 'public' and rowsecurity = true;

-- Should return the four functions.
select proname
from pg_proc
where proname in ('join_activity', 'leave_activity', 'activity_has_space');

-- Should list activity_participants and activities.
select tablename
from pg_publication_tables
where pubname = 'supabase_realtime';

-- Should return 6 after seeding.
select count(*) from public.activities;
```

Then, in the app: the header should show a green **Live** dot. Join an activity
in one browser and watch the count update in another — that is Realtime
working.

---

## 7. Share with the team

Everyone needs the **same two values**. Do not commit `.env.local`; send them
over a private channel, or have each teammate paste them in themselves.

They cannot use the app without them, and they should each create their own
account through the app.

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| "WoCow needs a database" screen | `.env.local` missing/placeholder | Fill it in, restart `pnpm dev` |
| `new row violates row-level security policy` | Migration 4 not run | Run `20250101000300_rls_policies.sql` |
| `permission denied for function join_activity` | Migration 5 not run | Run `20250101000400_join_leave_rpc.sql` |
| Participant counts frozen across browsers | Realtime migration not run | Run `20250101000500_realtime.sql` |
| `function public.activity_feed does not exist` | Migration 3 not run | Run it — the app reads this view, not the raw table |
| Guest sign-in fails | Anonymous sign-ins disabled | Enable in Auth settings |
| Magic link "redirect not allowed" | Origin not whitelisted | Add it in URL Configuration |
| `duplicate key value violates unique constraint` on join | Already joined | Expected — the app treats this as success |

### The join race condition, and why it matters

Naively checking "is there room?" in the browser and then inserting lets two
people who tap **Join** at the same instant both pass the check, overshooting
`max_participants`. `join_activity()` instead locks the parent activity row
with `SELECT … FOR UPDATE`, so the second caller waits, re-counts, and is
correctly told the activity is full. Do not replace the RPC with a
client-side count.
