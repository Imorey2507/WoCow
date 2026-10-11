# 🐮 WoCow

**Real-time campus activity discovery and matching platform.**

Find out what's happening on campus right now, see it on a map, and get told
which events actually fit you — then join in one tap. When someone else joins,
your page updates instantly.

Built by a five-person team for a hackathon, with one shared GitHub repo, one
shared Supabase database and one Vercel deployment.

> **Team HackHack** — Berkeley hackathon, 11 October 2026.
> Upstream repository: https://github.com/Imorey2507/WoCow

---

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Front end | React 19 + TypeScript + Vite | Fast dev server, typed contracts between five people |
| Database | Supabase (PostgreSQL) | Postgres + Auth + Realtime + a JS SDK in one free project |
| Maps | Leaflet / react-leaflet + OpenStreetMap | No API key, no billing account |
| Tests | Vitest | Same config as Vite, no extra setup |
| Hosting | Vercel | Git push to deploy, preview URL per pull request |

---

## The five roles

One person owns one branch and one area of the code. You may read anything;
coordinate before editing someone else's area.

| Person | Branch | Owns | Folder |
| --- | --- | --- | --- |
| 1 | `feature/frontend` | UI, pages, styling | `src/components/`, `src/pages/`, `src/index.css` |
| 2 | `feature/map` | Map, campus locations | `src/features/map/` |
| 3 | `feature/backend` | Database, activities API, realtime | `src/features/activities/`, `src/lib/`, `supabase/` |
| 4 | `feature/matching` | Matching algorithm | `src/features/matching/` |
| 5 | `feature/integration` | Wiring, review, deploy | `src/App.tsx`, `src/main.tsx`, `vite.config.ts`, `vercel.json` |

Person 5 is the Tech Lead and the only person who merges into `main`.

---

## Quick start

```bash
git clone https://github.com/YOUR_USERNAME/wocow.git
cd wocow
pnpm install
cp .env.example .env.local     # then fill in your Supabase values
pnpm dev
```

Open http://localhost:5173.

> **Before the app will do anything**, you need a Supabase project. It takes
> about five minutes: follow **[docs/SETUP.md](docs/SETUP.md)**.
> Until then the app shows a "WoCow needs a database" screen — that is by
> design, not a crash.

### Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server on :5173, also reachable from your phone on the same Wi-Fi |
| `pnpm build` | Typecheck, then build to `dist/` |
| `pnpm preview` | Serve the production build locally |
| `pnpm typecheck` | `tsc --noEmit` only |
| `pnpm test` | Run the matching-algorithm unit tests |
| `pnpm test:watch` | Tests in watch mode |

---

## Project structure

```
wocow/
├── src/
│   ├── components/            Person 1 — presentational UI
│   │   ├── ActivityCard.tsx
│   │   ├── ActivityList.tsx
│   │   ├── CreateActivityForm.tsx
│   │   ├── FilterBar.tsx
│   │   ├── Header.tsx
│   │   ├── PreferencesPanel.tsx
│   │   ├── SetupNotice.tsx
│   │   └── SignInPanel.tsx
│   ├── pages/                 Person 1 — one file per tab
│   │   ├── DiscoverPage.tsx
│   │   ├── MapPage.tsx
│   │   ├── MatchesPage.tsx
│   │   └── MyActivitiesPage.tsx
│   ├── features/
│   │   ├── activities/        Person 3 — THE data layer
│   │   │   ├── api.ts             getActivities, joinActivity, …
│   │   │   ├── realtime.ts        postgres_changes subscriptions
│   │   │   └── useActivities.ts   feed + live updates
│   │   ├── map/               Person 2
│   │   │   ├── MapView.tsx
│   │   │   ├── LocationPicker.tsx
│   │   │   └── campusLocations.ts
│   │   └── matching/          Person 4
│   │       ├── scoring.ts         the four weighted signals
│   │       ├── matchActivities.ts ranking entry point
│   │       ├── useMatches.ts
│   │       ├── usePreferences.ts
│   │       └── matchActivities.test.ts
│   ├── hooks/
│   │   └── useAuth.ts         Person 5
│   ├── lib/
│   │   ├── supabase.ts        Person 3 — the ONE client
│   │   ├── types.ts           Person 3 — the shared contract
│   │   └── format.ts          Person 1 — dates, distance
│   ├── App.tsx                Person 5 — integration
│   ├── main.tsx               Person 5
│   └── index.css              Person 1
├── supabase/migrations/       Person 3 — database, applied in filename order
├── docs/
│   ├── SETUP.md               Supabase walkthrough
│   ├── DATABASE.md            schema + RPC reference
│   ├── GIT_WORKFLOW.md        branches, PRs, conflict rules
│   └── DEPLOY.md              Vercel
├── scripts/
│   ├── setup-branches.ps1     create the five branches (Windows)
│   └── setup-branches.sh      same, for macOS/Linux
└── .env.example
```

---

## The shared interface

Person 3 owns these functions in `src/features/activities/api.ts`. Everyone
else calls them; nobody else writes `supabase.from(...)` queries.

```ts
getActivities(filters?)      // the feed, with participant counts
getActivity(id)              // one activity
createActivity(input)        // host a new one
updateActivity(id, patch)    // host edits their own
deleteActivity(id)           // host cancels their own
joinActivity(id)             // atomic, capacity-safe
leaveActivity(id)            // leave
getParticipants(id)          // who is coming
getMyActivities()            // hosted + joined
```

`joinActivity` deliberately goes through a Postgres function that takes a row
lock. Counting participants in the browser and then inserting is the classic
way to let an 11th person into a 10-person activity when two people tap Join at
the same moment. See [docs/DATABASE.md](docs/DATABASE.md).

---

## How the pieces fit together

```
useAuth ─────────┐
usePreferences ──┤
                 ├──> useActivities ──> (one realtime websocket)
                 │         │
                 │         ├──> useMatches  (pure, tested)
                 │         │
                 └─────────┴──> pages      (presentational)
```

There is exactly **one** `useActivities` call, in `App.tsx`, so there is
exactly one websocket channel. Mounting a feed inside each tab would leak
connections and eventually get the project rate-limited.

---

## Troubleshooting

**`pnpm install` fails with `ERR_PNPM_IGNORED_BUILDS` (esbuild)**
pnpm blocks install scripts by default. This repo allow-lists esbuild in
`pnpm-workspace.yaml`. If you still see it, run `pnpm approve-builds` and pick
esbuild.

**`'node' is not recognized` during `pnpm install`**
esbuild's postinstall shells out to `node`, so Node must be on your `PATH`.
Reinstall Node from [nodejs.org](https://nodejs.org) and reopen your terminal.

**A blank "WoCow needs a database" page**
`.env.local` is missing or still has placeholder values. Vite only reads env
files at startup — restart `pnpm dev` after editing it.

**"Guest sign-in is off"**
Enable it: Supabase Dashboard → Authentication → Sign In / Providers →
Anonymous sign-ins.

**Realtime shows "Offline" in the header**
The tables are not in the `supabase_realtime` publication. Run
`supabase/migrations/20250101000500_realtime.sql`.

**The map is blank in dev but works in production**
React StrictMode double-mounts effects. React Leaflet v5 handles it, but if you
hit it, remove `<StrictMode>` from `src/main.tsx` — see the note there.

**Wrong time on a card**
`starts_at` is `timestamptz`; Postgres stores UTC and the browser renders your
local zone. That is correct behaviour.

---

## Security model

- The Supabase **publishable / anon key ships in the browser bundle**. That is
  intended — it is not a secret. Protection comes from Row Level Security.
- RLS is enabled on both tables. Anyone may read; you may only insert rows
  where `user_id = auth.uid()` or `host_id = auth.uid()`.
- The **`service_role` key and the database password must never** appear in
  this repo, in a `VITE_*` variable, or in Vercel's client config.
- `.env.local` is gitignored. `.env.example` documents the variable names.

---

## License

Unlicensed hackathon project. Add a `LICENSE` file before publishing.
