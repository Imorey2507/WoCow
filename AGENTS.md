# AGENTS.md — working on WoCow

Instructions for an AI coding agent (Cursor, Copilot, Claude Code, Codex, or
anything else) that has just been pointed at this repository. Read this file in
full before changing anything. Humans: this is also the fastest orientation
document here.

> **If you are working inside `aggie-playground/`, read
> [`aggie-playground/AGENTS.md`](aggie-playground/AGENTS.md) as well.** It
> carries the Next.js-version-specific warnings.

---

## 1. Which app is which

The decision is **settled**. Do not reopen it, and do not develop against the
wrong tree.

| | |
| --- | --- |
| **Official submission** | [`aggie-playground/`](aggie-playground/) |
| **Frozen backup** | the Vite + React SPA at this repository's root |

The root Vite app is **read-only reference**. It is not developed, not built by
CI, and not deployed. Do not add features to it, do not "fix it up", and do not
delete it.

Both trees were built independently, and **both define an `activities` table and
an `activity_feed` view — with different columns.** Nothing may be imported
across the boundary. If you find yourself writing an import that reaches from
one tree into the other, stop; that is a design error, not a shortcut.

### The official app

| | |
| --- | --- |
| Path | `aggie-playground/` |
| Stack | Next.js 16 App Router · React 19 · TypeScript · Supabase · Leaflet · Vercel |
| Package manager | **npm** |
| Authoritative lockfile | `aggie-playground/package-lock.json` |
| Vercel Root Directory | **`aggie-playground`** |

> ⚠️ Vercel defaults to the repository root. Left on the default it will try to
> build the frozen Vite backup instead of the official app. Root Directory
> **must** be set to `aggie-playground`.

Do not add a pnpm lockfile inside `aggie-playground/`. It uses npm, and a
second lockfile alongside the authoritative one is a trap. (The root Vite
backup uses pnpm; that is separate and frozen.)

---

## 2. Security rules

1. **Never commit `.env.local`** or any real key, token, or password. Only
   `.env.example` is tracked, and it contains names and descriptions only.
2. **The browser may only ever see these two variables:**
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

   Anything prefixed `NEXT_PUBLIC_` is inlined into the JavaScript every
   visitor downloads. It is public. The anon key is safe there **only**
   because Row Level Security protects the data.
3. **These are server-only. Never give them a `NEXT_PUBLIC_` prefix:**
   - `SUPABASE_SERVICE_ROLE_KEY` — bypasses Row Level Security entirely
   - `CONTEXT_DEV_API_KEY` — a paid API credential
   - `CRON_SECRET` — authorises the scheduled club refresh
4. **`aggie-playground/src/lib/server/**` must stay server-only.** Those
   modules import `server-only`, which deliberately **fails the build** if a
   client component ever imports them. Do not remove that import, and do not
   relax it to make an error go away — the error is the feature.
5. **Do not run remote migrations, deploy, or change any live service
   configuration without explicit approval from Person 5.** No exceptions, not
   even for a "quick test". Production credentials and the deployment are
   Person 5's call.

---

## 3. Database rules

1. **The only migrations that may be applied are in
   `aggie-playground/supabase/migrations/`.**
2. **The root `supabase/` directory belongs to the frozen Vite backup. It must
   never be run against the official Supabase project.** The two schemas
   collide on `activities` and `activity_feed`. Running both against one
   database will corrupt it.
3. **Never edit a migration that has already been applied.** Add a new
   timestamped migration instead. Someone's database has already run the old
   one, and the two will silently diverge.
4. **Keep `join_activity` atomic.** It takes a `SELECT … FOR UPDATE` row lock on
   the activity before counting participants. That lock is the only reason two
   students tapping Join simultaneously cannot both take the last slot. Never
   replace it with a client-side count-then-insert, and never "simplify" the
   capacity check into the calling code.
5. **Changes to RLS policies, Realtime publication membership, notification
   triggers, or the `public_profiles` view require review by Person 3.**
6. **Do not mechanically change `public_profiles` to `security_invoker`.** It
   is intentionally an owner-rights view that bypasses the RLS on `profiles`,
   because a plain subquery could never see another student's `discoverable`
   flag. The `CASE` expressions are the protection, and they are what makes
   Buddy discovery possible. Any change there must first demonstrate, with
   evidence, what the view does and does not expose.

For behavioural checks against a real database, use
`aggie-playground/supabase/tests/rls_smoke.sql`. It wraps everything in a
transaction and rolls back, so it writes nothing.

---

## 4. The official verification commands

Run these **inside `aggie-playground/`**:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

What each one really does — do not describe them inaccurately:

| Command | Actually runs |
| --- | --- |
| `npm run lint` | `eslint` |
| `npm run typecheck` | **`next typegen && tsc --noEmit`** |
| `npm test` | `node --test` |
| `npm run build` | `next build` |

Four things to be precise about:

- **`npm run typecheck` runs `next typegen` first, and that is load-bearing.**
  `next-env.d.ts` is gitignored but imports generated files under
  `.next/types/`. On a clean checkout, bare `tsc` fails with
  `Cannot find name 'LayoutProps'`. Do not "simplify" the script back to
  `tsc --noEmit`.
- **There are currently 18 unit tests**, covering Context.dev data
  normalisation and its anti-fabrication rules.
- **`supabase/tests/rls_smoke.sql` must be run by hand against a real test
  Supabase project.** It has **never been executed**. It is unproven SQL until
  somebody runs it and reports the notices.
- **Green typecheck / build / unit tests do NOT mean the app works.** They
  prove the code compiles and that some pure functions behave. They say nothing
  about the database, Realtime, or the browser.

### The only definition of "end-to-end verified"

A flow may be called **E2E verified only after it has been observed in a real
browser against a real Supabase project.** Nothing else counts. Compiling,
passing unit tests, or reasoning about the code is not verification. If you have
not watched it happen, do not write that it works.

---

## 5. Ownership

One person owns each area. Read anything; before *changing* something you do
not own, coordinate first. Paths are relative to `aggie-playground/`.

| Person | Branch | Owns |
| --- | --- | --- |
| 1 | `feature/frontend` | `src/app/discover/`, `src/app/profile/`, UI components, mobile UI, loading / empty / error states |
| 2 | `feature/map` | `src/app/map/`, `CampusMap*`, `src/lib/locations.ts` |
| 3 | `feature/backend` | `supabase/`, `src/lib/server/`, `src/lib/supabase/`, `src/app/api/`, authentication and data integration |
| 4 | `feature/matching` | `src/app/buddies/`, matching logic and tests, discoverability privacy |
| 5 | `feature/integration` | layout and navigation, CI, environment contract, docs, PR review, Vercel, E2E coordination |

### Shared files — announce before you touch them

These are edited by more than one person and are the realistic source of
conflicts:

- `package.json`
- `package-lock.json`
- `src/lib/types.ts`
- `src/components/ActivitiesProvider.tsx`
- `src/components/AppShell.tsx`
- `supabase/migrations/*`

Two people adding dependencies at the same time is the single most common way
this repository breaks. Say so in the group chat first.

---

## 6. Git rules

- **Never commit or push directly to `main`.**
- Work only on your own `feature/*` branch.
- Merge through a Pull Request.
- **Person 5 performs the final review and merge.**
- **Never force-push a shared branch.**
- **Never overwrite another person's uncommitted work.** Check the working tree
  before you start.
- **A "compare" URL is not a Pull Request.** Do not describe one as created.
  A PR exists only once it has actually been opened.
- **CI counts as remote verification only after a real PR has been opened and
  GitHub Actions has run on it.** A local run, or a workflow file that exists,
  proves nothing about the remote.

Keep commits small and say what changed and why — `Fix join race with row lock`,
not `update`.

---

## 7. Current real status

Read this before you claim anything works.

**Settled**
- The official app is `aggie-playground/`. The root Vite app is a frozen
  read-only backup.

**Verified locally, by running it**
- Person 5's integration branch passes `lint`, `typecheck`, `test` (18/18) and
  `build`.

**Not verified — open items**
- **`npm ci` on a clean runner is still unproven.** It awaits GitHub Actions.
  The local install used pnpm because npm was unavailable in the environment
  where that work was done, so a clean `npm ci` has never actually run.
- **No real Supabase project has ever been connected.**
- **`rls_smoke.sql` has never been executed.**
- **Context.dev has never been called** with a real key.
- **Realtime has never been observed** in a browser.
- **There is no browser end-to-end demo.**
- **Nothing is deployed.**

**Therefore: the demo-readiness condition is NOT met.** Do not report the
project as complete, working, or demo-ready. It is a well-tested codebase whose
runtime behaviour against real services is entirely unobserved.

---

## 8. Read next

| Document | For |
| --- | --- |
| [`aggie-playground/AGENTS.md`](aggie-playground/AGENTS.md) | Next.js-specific and app-specific rules |
| [`README.md`](README.md) | human-facing overview, setup, Supabase and Vercel steps |
| [`docs/DEMO.md`](docs/DEMO.md) | the two-minute demo runbook |
| [`docs/DATABASE.md`](docs/DATABASE.md) | schema reference (written for the frozen backup — treat as reference only) |
| [`docs/GIT_WORKFLOW.md`](docs/GIT_WORKFLOW.md) | branch and PR workflow |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | deployment notes |
