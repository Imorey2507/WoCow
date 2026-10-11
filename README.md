# 🐮 WoCow

**Real-time campus activity discovery and matching platform.**

Find out what's happening on campus right now, see it on a map, join in one
tap — and watch the head-count update live when somebody else joins.

Team **HackHack** · Berkeley hackathon, 11 October 2026 ·
<https://github.com/Imorey2507/WoCow>

---

## ✅ The official app is [`aggie-playground/`](aggie-playground/)

**Decision made 2026-10-11.** The Next.js app in `aggie-playground/` is the one
WoCow submission. Everything in this README describes it.

| | |
| --- | --- |
| **Official app** | [`aggie-playground/`](aggie-playground/) — Next.js 16 App Router |
| **Backup, frozen** | this directory's Vite + React SPA — read-only, no new features, kept for reference |
| **Database** | [`aggie-playground/supabase/migrations/`](aggie-playground/supabase/migrations/) **only** |

### 🚫 Never mix the two

The two apps were built independently and **both define `activities` and
`activity_feed`**. They are different schemas.

- Do **not** run this repo's root `supabase/migrations/` against the same
  Supabase project as `aggie-playground/supabase/migrations/`. They will
  collide.
- The root `supabase/` directory belongs to the frozen Vite backup. Treat it as
  reference material only.
- Nothing imports across the two trees. Keep it that way.

### Why Next.js won

The event rules state that judges **check for hard-coded functionality**, and
Context.dev is a **$750 + $5k credit** bonus track. Context.dev needs
`CONTEXT_DEV_API_KEY` and a `SUPABASE_SERVICE_ROLE_KEY` held **server-side**.
A Vite SPA has no server, so those keys would have to sit in the browser
bundle. Only the Next.js app can hold them safely — and it already scrapes
AggieLife into a real `club_events` cache.

---

## Local setup

Requires **Node.js 22+** and **npm**.

```bash
git clone https://github.com/Imorey2507/WoCow.git
cd WoCow/aggie-playground

npm install
cp .env.example .env.local     # then fill in the values (see below)
npm run dev                    # http://localhost:3000
```

### Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on :3000 |
| `npm run build` | Production build (runs TypeScript as part of it) |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` on its own |
| `npm test` | Unit tests (Node's built-in runner, no extra deps) |
| `npm run build` **after** `supabase/tests/rls_smoke.sql` | see Database below |

The app renders a "Backend not connected" banner when Supabase is not
configured. That is intentional, not a crash.

---

## Environment variables

Copy [`aggie-playground/.env.example`](aggie-playground/.env.example) to
`.env.local`. **Never commit `.env.local`.**

| Variable | Exposure | Needed for |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | **public** (inlined into the browser bundle) | everything |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **public** | everything |
| `SUPABASE_SERVICE_ROLE_KEY` | **server-only** — bypasses RLS | club-events cache |
| `CONTEXT_DEV_API_KEY` | **server-only** | AggieLife scraping |
| `CRON_SECRET` | **server-only** | authorising the scheduled refresh |

The three server-only values are protected by `import "server-only"` in
`aggie-playground/src/lib/server/`. That makes the **build fail** if a client
component ever imports them — they cannot leak into the browser by accident.
Never give one a `NEXT_PUBLIC_` prefix.

Without the Context.dev values the app still runs. The Campus Clubs section
shows "No club events yet" and the refresh button reports that the server is
not configured. **It never substitutes fake events.**

---

## Supabase setup

1. Create a project at <https://supabase.com/dashboard>.
2. **SQL Editor → New query**, then paste and run
   [`aggie-playground/supabase/migrations/0001_init.sql`](aggie-playground/supabase/migrations/0001_init.sql).
   That single file creates every table, view, policy, trigger and RPC.
3. **Authentication → URL Configuration** — add `http://localhost:3000` and
   your Vercel URL. Magic-link sign-in fails without this.
4. **Authentication → Sign In / Providers** — Email must be enabled. This app
   signs in with a **magic link**; there is no password and no anonymous
   sign-in (see *Not yet verified* below).
5. **Settings → API** — copy the Project URL and the anon key into
   `.env.local`.

Optional but recommended — prove the schema actually enforces what it claims:

6. Paste and run
   [`aggie-playground/supabase/tests/rls_smoke.sql`](aggie-playground/supabase/tests/rls_smoke.sql).
   It creates test users, checks capacity, duplicate joins, RLS and
   notifications, then **rolls back** — it writes nothing. Read the notices.

---

## Deploying to Vercel

> ⚠️ **Set Root Directory to `aggie-playground`.** Pointed at this repo with
> the default root, Vercel will build the frozen Vite backup instead.

| Setting | Value |
| --- | --- |
| Framework Preset | Next.js (auto-detected) |
| **Root Directory** | **`aggie-playground`** |
| Build Command | `npm run build` |
| Install Command | `npm ci` |
| Node.js Version | 22.x |

Environment variables: all five from the table above, for Production, Preview
and Development.

`aggie-playground/vercel.json` registers a cron that hits
`/api/clubs/refresh` every 6 hours. Vercel sends
`Authorization: Bearer $CRON_SECRET` automatically — set the **same**
`CRON_SECRET` value in Vercel, or scheduled refreshes will get a 401.

After the first deploy, add the deployed URL to Supabase's redirect allow-list
(step 3 above) or magic links will fail in production.

---

## What has actually been verified

Honesty matters more than optimism here. "Code exists" and "it compiles" are
not "it works".

### ✅ Verified locally, by running it

| Check | Command | Result |
| --- | --- | --- |
| Dependencies install | `npm install` | completes |
| Lint | `npm run lint` | **exit 0** |
| Typecheck | `npm run typecheck` | **exit 0** |
| Production build | `npm run build` | **exit 0** — 9 routes |
| Unit tests | `npm test` | **18/18 pass** |

The unit tests cover Context.dev data normalisation: the anti-fabrication rules
(no event without a real title, never an invented link, never a guessed date),
de-duplication, and field hygiene.

### ❌ NOT verified — nobody has done these

- **No end-to-end demo in a real browser.** The flow *sign in → create an
  activity → a second user joins → the head-count updates live* has never been
  observed. It requires a configured Supabase project.
- **Nothing has ever run against a real Supabase project.** No migration has
  been applied to a hosted database.
- `supabase/tests/rls_smoke.sql` is **written but has never been executed**.
  It is unproven SQL.
- **Context.dev has never been called** — no API key has been used. The
  scraping path is code-reviewed only.
- **Realtime has never been observed.** The publication membership is declared
  in the migration; delivery to a browser is untested.
- **Nothing is deployed.** No Vercel project exists for this app.
- **No test covers activity capacity, duplicate joins or identity changes.**
  Those are database behaviours and need either a real Supabase project (run
  `rls_smoke.sql`) or a local PostgreSQL. See the note below.

### Why there is no local database test in CI

Unit tests deliberately add **zero dependencies** so that
`aggie-playground/package-lock.json` stays authoritative and `npm ci` keeps
working. A local PostgreSQL harness (PGlite) would mean adding a dependency,
which requires regenerating that lockfile with npm. Until somebody does that
deliberately, database behaviour is covered by `rls_smoke.sql` against a real
project — which is stronger evidence anyway, since it runs on the actual
engine.

---

## Repository layout

```
.
├── aggie-playground/          ← THE OFFICIAL APP
│   ├── src/app/               4 tabs: profile · map · discover · buddies
│   ├── src/lib/server/        server-only: Context.dev + service-role writes
│   ├── supabase/migrations/   0001_init.sql — the only migration to run
│   ├── supabase/tests/        rls_smoke.sql — manual RLS/RPC check
│   ├── tests/                 unit tests (node --test)
│   └── scripts/               standalone Context.dev prototype (not built)
├── src/, supabase/, docs/     ← FROZEN VITE BACKUP — reference only
└── .github/workflows/ci.yml   CI for aggie-playground only
```

---

## The frozen Vite backup

The Vite app at this root is kept **for reference only**. It is not built by
CI, not deployed, and receives no new features. Do not delete it and do not
develop against it.

It is not without value: its database test suite
(`supabase/tests/schema.mjs`) is a working example of running RLS and RPC
assertions against a local PostgreSQL with no cloud project, if the team later
wants that for `aggie-playground`.
