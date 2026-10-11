<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# WoCow — this is the official app

Everything below is hand-written project guidance. The block above is generated
by Next.js and must be left exactly as it is.

**Read [`../AGENTS.md`](../AGENTS.md) as well before changing anything.** It
carries the cross-repository rules: which app is official, the ban on mixing the
two migrations, the Git workflow, and the current verified/unverified status.
Where the two files overlap, the root file wins.

## What this directory is

- **This is the only WoCow submission.** The Vite app at the repository root is
  a frozen read-only backup: not developed, not built by CI, not deployed.
- **Never import across the two trees.** Both define an `activities` table and
  an `activity_feed` view with different columns.

## Toolchain

- Package manager: **npm**. Authoritative lockfile: `package-lock.json`.
- Do **not** add a pnpm lockfile or `pnpm-workspace.yaml` here; that would give
  the app two competing lockfiles.
- Deploys to Vercel with **Root Directory set to `aggie-playground`**. The
  default root would build the backup app instead.

## Secrets and the server boundary

Two variables are public and belong in the browser:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Three are **server-only** and must never receive a `NEXT_PUBLIC_` prefix:

- `SUPABASE_SERVICE_ROLE_KEY`
- `CONTEXT_DEV_API_KEY`
- `CRON_SECRET`

`src/lib/server/**` imports `server-only` on purpose, which **fails the build**
if a client component ever pulls it in. That failure is the safety mechanism —
do not remove the import or loosen it to silence an error.

Never commit `.env.local`. `.env.example` holds names and descriptions only.

## Database

- The only migration that may be applied is
  `supabase/migrations/0001_init.sql`. Add new timestamped files for later
  changes; never edit an applied migration in place.
- **Never run the repository root's `supabase/` migrations here.** They belong
  to the frozen backup and collide on `activities` / `activity_feed`.
- Keep `join_activity` atomic. Its `SELECT … FOR UPDATE` row lock is what stops
  two people taking the last slot at the same time. Never move the capacity
  check into client code.
- Do not mechanically switch `public_profiles` to `security_invoker`; its
  current controlled projection is what makes Buddy discovery work. Prove the
  privacy behaviour before changing it.
- RLS, Realtime, notification triggers and `public_profiles` changes need
  Person 3 to review.
- Behavioural database checks: `supabase/tests/rls_smoke.sql`. **It has never
  been executed.** Run it by hand against a real test project; it rolls back
  and writes nothing.

## Commands

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

- `npm run typecheck` is `next typegen && tsc --noEmit`. The `next typegen`
  half is **required** — `next-env.d.ts` is gitignored but imports generated
  `.next/types/` files, so bare `tsc` fails on a clean checkout. Do not
  simplify it away.
- `npm test` runs 18 unit tests over Context.dev normalisation.

## Do not overstate what has been verified

Compiling, passing typecheck, passing unit tests, and building successfully are
**not** evidence that the app works. Specifically, as of the last update:

- `npm ci` on a clean runner is unproven — it awaits GitHub Actions.
- No real Supabase project has been connected.
- `rls_smoke.sql` has never run.
- Context.dev has never been called with a real key.
- Realtime has never been observed.
- There is no browser end-to-end demo.
- Nothing is deployed.

A flow counts as E2E verified **only** after it has been watched working in a
real browser against a real Supabase project. Never write that something works
when it has only been read.

## Ownership

Paths are relative to this directory. Read anything, but coordinate before
editing something you do not own.

| Person | Branch | Owns |
| --- | --- | --- |
| 1 | `feature/frontend` | `src/app/discover/`, `src/app/profile/`, UI components, mobile UI, loading / empty / error states |
| 2 | `feature/map` | `src/app/map/`, `CampusMap*`, `src/lib/locations.ts` |
| 3 | `feature/backend` | `supabase/`, `src/lib/server/`, `src/lib/supabase/`, `src/app/api/`, auth and data integration |
| 4 | `feature/matching` | `src/app/buddies/`, matching logic and tests, discoverability privacy |
| 5 | `feature/integration` | layout and navigation, CI, environment contract, docs, PR review, Vercel, E2E coordination |

Announce before touching a shared file: `package.json`, `package-lock.json`,
`src/lib/types.ts`, `src/components/ActivitiesProvider.tsx`,
`src/components/AppShell.tsx`, or anything under `supabase/migrations/`.

## Git

Work on your own `feature/*` branch and merge through a Pull Request reviewed by
Person 5. Never commit or push to `main`, never force-push a shared branch, and
never overwrite someone else's uncommitted work. Never run remote migrations,
deploy, or change live configuration without Person 5's explicit approval.
