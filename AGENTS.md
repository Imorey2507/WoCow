# AGENTS.md — working on WoCow

Instructions for an AI coding agent (Cursor, Copilot, Claude Code, Codex, or
anything else) that has just been pointed at this repository. Read this file
first, in full, before changing anything.

Humans: this is also the fastest orientation document in the repo.

---

## 1. What this is

**WoCow** — a real-time campus activity discovery and matching platform. People
post things happening on campus (pickup basketball, a study jam, a sunset run),
see them on a map, get a personalised ranking of what suits them, and join with
one tap. When anyone joins, every open page updates within a moment.

Built by **five people in parallel** for the Berkeley hackathon on 11 October
2026. That fact drives most of the rules below: five agents editing one repo
needs more discipline than one.

**Stack:** React 19 + TypeScript + Vite · Supabase (PostgreSQL + Auth +
Realtime) · Leaflet + OpenStreetMap · Vitest · Vercel.

---

## 2. Hard rules

These are not stylistic preferences. Breaking them costs the team real time.

1. **NEVER commit `.env.local`, any API key, or the Supabase `service_role`
   key.** `.env.local` is gitignored. Only `.env.example` is tracked. The
   `service_role` key bypasses Row Level Security completely — if it reaches
   the browser bundle or the repo, the database is wide open.
2. **NEVER put a secret in a `VITE_*` variable.** Vite inlines every `VITE_*`
   value into the JavaScript that every visitor downloads. It is public.
   Only the publishable/anon key belongs there, because RLS protects the data.
3. **NEVER push to `main`.** Work on your assigned `feature/*` branch and open
   a Pull Request. See §8.
4. **NEVER edit a migration file that has already been applied.** Add a new
   timestamped file. Someone else's database already ran the old one, and the
   two will silently diverge.
5. **NEVER replace `join_activity()` with a client-side count-then-insert.**
   That reintroduces a race that lets an 11th person into a 10-person activity.
   See §7.
6. **NEVER write `supabase.from(...)` outside `src/features/activities/api.ts`.**
   That module is the single data layer. See §5.
7. **Do not edit another owner's folder without saying so.** See §4.

---

## 3. Environment setup

Do these in order. Steps 1–6 are what a fresh teammate (or their agent) needs.

### 3.1 Prerequisites

- **Node.js 20 or 22** — from <https://nodejs.org>. It must be on `PATH`;
  esbuild's install script literally shells out to `node`.
- **pnpm 11** — `npm install -g pnpm`
- **Git**
- Nothing else. No Docker, no database server, no Supabase CLI required.

### 3.2 Get the code and install

```bash
git clone https://github.com/Imorey2507/WoCow.git
cd WoCow
pnpm install
```

### 3.3 Connect a database

The app renders a "WoCow needs a database" screen until this is done. It is
designed to do that instead of crashing — that screen is not a bug.

```bash
cp .env.example .env.local
```

Fill in two values from the shared Supabase project
(**Settings → API**):

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Get these from the team lead or the shared password manager. **Do not create a
new Supabase project** — all five people share one.

Full walkthrough including the seven SQL migrations: **[docs/SETUP.md](docs/SETUP.md)**.

### 3.4 Run it

```bash
pnpm dev          # http://localhost:5173, also on your phone via LAN
```

Vite reads env files **only at startup**. After editing `.env.local`, restart
the dev server or you will chase a phantom bug.

---

## 4. Ownership map

One person owns each area. You may read anything. Before *changing* something
you do not own, ask in the team chat — five agents editing `App.tsx` at once is
how a hackathon loses an afternoon.

| Person | Branch | Owns |
| --- | --- | --- |
| 1 | `feature/frontend` | `src/components/`, `src/pages/`, `src/index.css` |
| 2 | `feature/map` | `src/features/map/` |
| 3 | `feature/backend` | `src/features/activities/`, `src/lib/`, `supabase/` |
| 4 | `feature/matching` | `src/features/matching/` |
| 5 | `feature/integration` | `src/App.tsx`, `src/main.tsx`, config, docs, review + merge |

**The three shared files** — expect conflicts here and coordinate first:

| File | Effective owner |
| --- | --- |
| `package.json` / `pnpm-lock.yaml` | whoever adds a dependency — announce it first |
| `src/App.tsx` | Person 5 |
| `src/lib/types.ts` | Person 3 |

---

## 5. Architecture

### Data flows one way

```
useAuth ─────────┐
usePreferences ──┤
                 ├──> useActivities ──> (exactly ONE realtime websocket)
                 │         │
                 │         ├──> useMatches   (pure, unit-tested)
                 │         │
                 └─────────┴──> pages        (presentational)
```

`useActivities` is called **once**, in `src/App.tsx`. Do not add a second call
inside a page or component — each one opens another websocket channel and
Supabase will eventually rate-limit the project.

### Where things live

| Path | Purpose |
| --- | --- |
| `src/lib/supabase.ts` | the single Supabase client. Never construct another. |
| `src/lib/types.ts` | the shared type contract. Change with the schema, same PR. |
| `src/features/activities/api.ts` | **the only place that queries the database** |
| `src/features/activities/realtime.ts` | `postgres_changes` subscriptions |
| `src/features/matching/scoring.ts` | four weighted signals, pure functions |
| `src/features/map/` | Leaflet map, tap-to-drop pin, campus gazetteer |
| `src/components/`, `src/pages/` | presentational UI, no data access |
| `supabase/migrations/` | the schema, applied in filename order |
| `supabase/tests/schema.mjs` | runs the migrations against real PostgreSQL |

### The shared interface

Person 3 owns these. Call them; do not re-implement them.

```ts
getActivities(filters?)      getActivity(id)         createActivity(input)
updateActivity(id, patch)    deleteActivity(id)      joinActivity(id)
leaveActivity(id)            getParticipants(id)     getMyActivities()
```

`getActivities` reads the `activity_feed` **view**, which already carries
`participant_count`, `is_full` and `is_joined`. Never re-derive those on the
client, and never issue a query per card.

---

## 6. Verifying your work

Run all four before you say you are done.

```bash
pnpm typecheck    # tsc --noEmit
pnpm test         # vitest — the matching algorithm (25 tests)
pnpm test:db      # the database schema + RLS, against real PostgreSQL (53 checks)
pnpm build        # tsc + vite build
```

`pnpm test:db` needs no cloud project and no Docker: it runs PostgreSQL
compiled to WebAssembly (PGlite) in-process, applies every migration, then
exercises the RLS policies and the RPCs the way the app does.

**Know what `pnpm test:db` cannot tell you** — it says so itself when it
passes:

- PGlite is **single-connection**, so it cannot reproduce two users racing for
  the last slot. The `SELECT … FOR UPDATE` lock in `join_activity()` is *not*
  covered. Verify that against the real Supabase project.
- It runs against `supabase/tests/shim.sql`, an emulation of Supabase's `auth`
  schema and roles, so a divergence between the shim and the platform would not
  be caught.
- It proves publication membership, not that Realtime actually delivers.

A green suite means the schema is sound. It does not mean the app works. Open
the browser.

---

## 7. Database changes

Add a new timestamped migration; never edit an applied one:

```
supabase/migrations/20250101000700_add_activity_tags.sql
```

Then:

1. Update `src/lib/types.ts` in the **same** PR.
2. Run `pnpm test:db` — it applies your new file automatically.
3. Add assertions for your change to `supabase/tests/schema.mjs` if it alters
   access control.
4. Ask Person 3 to review.

Conventions: `enable row level security` on every new table plus explicit
policies; add columns as nullable or defaulted so old code keeps working while
the PR is open; index the columns you filter on.

### Things that will bite you

- **RLS does not apply to a table's owner or a superuser.** A test that queries
  as owner passes no matter how broken the policies are. `schema.mjs` always
  does `set role anon|authenticated` first — copy that pattern.
- **A policy that reads its own table recurses infinitely** ("infinite
  recursion detected in policy"). That is why `activity_has_space()` exists as
  a `SECURITY DEFINER` function.
- **`security_invoker=on` on a view** is what makes it respect RLS. Without it
  the view runs as its owner and leaks every row.
- **`(select auth.uid())` beats `auth.uid()`** in a policy: it is evaluated
  once per query rather than once per row.

---

## 8. Git workflow

```bash
git switch main && git pull origin main
git switch feature/matching        # your branch
git merge main                     # pull in others' work daily
# ... work ...
git add . && git commit -m "Add distance weighting to matching score"
git push -u origin feature/matching
```

Then open a Pull Request into `main`. Person 5 reviews and merges. Resolve
conflicts on **your** branch, never in `main`.

Commit messages state what changed and why: `Fix join race with row lock`, not
`update`. Five people will read this log more than they expect.

`main` auto-deploys to production on Vercel. Every PR gets its own preview URL.

---

## 9. Gotchas worth knowing up front

| Symptom | Cause | Fix |
| --- | --- | --- |
| `ERR_PNPM_IGNORED_BUILDS` (esbuild) | pnpm blocks install scripts by default | already allow-listed in `pnpm-workspace.yaml`; run `pnpm approve-builds` if it persists |
| `'node' is not recognized` during install | Node not on `PATH` | install Node from nodejs.org, reopen the terminal |
| `ERR_PNPM_OUTDATED_LOCKFILE` | `package.json` edited by hand, or `CI=true` forces frozen lockfile | `pnpm install --no-frozen-lockfile` |
| "WoCow needs a database" screen | `.env.local` missing or placeholder | fill it in and **restart** `pnpm dev` |
| `relation "public.activity_feed" does not exist` | migration 3 not run | run it — the app reads the view, not the raw table |
| Counts frozen across browsers | migration 6 not run | run the realtime migration |
| `new row violates row-level security policy` | migration 4 not run, or `host_id ≠ auth.uid()` | run the RLS migration; set `host_id` from the session |
| Map blank in dev only | React StrictMode double-mount | React Leaflet v5 handles it; as a last resort remove `<StrictMode>` in `src/main.tsx` |
| pnpm install spins at high CPU | transient on Windows (AV scanning the WASM) | kill it and re-run; it completes in seconds |

Note on `pnpm` config: **pnpm 11 no longer reads the `pnpm` field in
`package.json`.** Settings live in `pnpm-workspace.yaml`.

---

## 10. Current state

**Done and verified**

- React + Vite + TS app, all five modules, mobile-first UI
- Seven Supabase migrations: schema, capacity helper, feed view, RLS, atomic
  join/leave RPCs, Realtime publication, demo seed
- `pnpm typecheck` clean · `pnpm test` 25/25 · `pnpm test:db` 53/53 ·
  `pnpm build` succeeds
- Git: `main` + five `feature/*` branches pushed to
  <https://github.com/Imorey2507/WoCow>
- Docs, GitHub Actions CI, and a PR template

**Still needs a human with credentials**

1. Create the shared Supabase project and run the seven migrations
   ([docs/SETUP.md](docs/SETUP.md))
2. Invite the other four as repository collaborators
3. Import into Vercel and set the two `VITE_*` environment variables
   ([docs/DEPLOY.md](docs/DEPLOY.md))
4. Enable **Anonymous sign-ins** in Supabase Auth — that powers the one-tap
   "Continue as guest" demo path
5. Make the repository **Public** before submission

---

## 11. Read next

| Document | For |
| --- | --- |
| [README.md](README.md) | the human-facing overview |
| [docs/SETUP.md](docs/SETUP.md) | creating the database, with verification SQL |
| [docs/DATABASE.md](docs/DATABASE.md) | every table, policy and function |
| [docs/GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md) | branches, PRs, conflict rules |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Vercel, env vars, rollback |
