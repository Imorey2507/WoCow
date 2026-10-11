# Handoff — final hour sprint

> Written for whoever picks this up next, including a fresh agent with no chat
> history. Everything here is verifiable from Git. **Do not trust the SHAs in
> this file without re-checking them** — they were true when written.

Last updated: after commit `d280f1a` (code-completeness pass).

---

## 1. Where the work lives

| | |
| --- | --- |
| Worktree | `D:\300_Workspace\B@BHacks 2.0\_wt-sprint` |
| Branch | `sprint/final-hour` |
| HEAD at time of writing | `d280f1a32cd453ac6497ee7098c65fe426a5be5a` |
| Base | `origin/main` = `4d2158b3ff9fb1d1e249acf94aef2a13ad32f2c4` |
| Ahead of main by | 7 commits (0 behind) |

The sprint branch deliberately uses its **own worktree** so the older
`feature/frontend` worktree and its preview on port 3000 are undisturbed.

Other worktrees that exist and must not be deleted:

| Path | State |
| --- | --- |
| `wocow` | `feature/frontend` @ `98f258e` — already merged into main via PR #4 |
| `_wt-matching` | detached @ `9c4c1fb` — investigation only |
| `_wt-sprint` | this branch |
| `_hackhack-probe` | read-only clone, investigation only |

## 2. Commits on this branch

```
d280f1a  Fix the broken Magic Link flow and notify hosts about joins
9c2814c  Close Person 4 matching integration gaps                (Person 4 review)
dd6936d  Add the final-hour handoff document
624f002  Bind profile notifications to the signed-in viewer     (Person 1 follow-up fix)
043e17a  Harden Person 3 activity writes and capacity rules     (Person 3)
668c5ea  Complete Person 2 campus map experience                (Person 2)
4d2158b  Merge pull request #4 …                                (Person 1, already on main)
```

### Two release blockers fixed in `d280f1a`

- **Magic Link could never complete.** `@supabase/ssr@0.12.7`'s
  `createBrowserClient` hard-codes `flowType: "pkce"`, so the link returns
  `?code=…` and needs a server-side exchange. There was **no callback route**.
  Added `src/app/auth/callback/route.ts`; `emailRedirectTo` now targets it.
  ⚠️ `export const dynamic` is a **build error** in this repo because
  `next.config.ts` sets `cacheComponents: true` — do not add it back.
- **Joining/leaving were silent.** Added `participant_joined` /
  `participant_left` notifications to the host via `notify_participation()`.

## 3. Status by person

| Person | Scope | Status |
| --- | --- | --- |
| 1 | Discover / Profile / UI states | **Merged to main** via PR #4 (`4d2158b`). Identity leak fixed on this branch in `624f002`. |
| 2 | Map | **Done on this branch** in `668c5ea`. |
| 3 | Backend: RLS, RPC, capacity | **Done on this branch** in `043e17a`. |
| 4 | Buddies / matching | **Reviewed and patched on this branch** in `9c2814c`. Ten of twelve checks passed as-is; unconfigured state and viewer-owned action state were fixed. |
| 5 | Final integration PR, docs, Vercel | **Not started.** |

## 4. Verification results (real exit codes)

Run inside `aggie-playground/`. `npm` is **not available** in the environment
where this was prepared, so the underlying binaries were invoked directly. The
definitive `npm ci` evidence has to come from GitHub Actions on a PR.

| Check | Result |
| --- | --- |
| lint | **exit 0** — no errors, no warnings |
| typecheck | **exit 0** — `next typegen && tsc --noEmit` |
| test | **exit 0** — **119 passing, 0 failing, 19 suites** |
| build | **exit 0** — 8 routes (includes the new `ƒ /auth/callback`) |

Commands actually used:

```powershell
$node = "C:\Users\Ren\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
& $node 'node_modules\eslint\bin\eslint.js' .
& $node 'node_modules\next\dist\bin\next' typegen
& $node 'node_modules\typescript\bin\tsc' --noEmit
& $node --test
& $node 'node_modules\next\dist\bin\next' build
```

## 5. Previews running

| Port | Worktree | PID | Started |
| --- | --- | --- | --- |
| 3000 | `wocow` (`feature/frontend`) | 62364 | 16:07:01 |
| 3001 | `_wt-sprint` (`sprint/final-hour`) | 47740 | 16:20:22 |
| 19387 | DSH Web GUI | 22488 | 12:26:54 |

**Do not stop these**, and never run a blanket `Get-Process node | Stop-Process`
— that kills the DSH harness too. Stop one preview by PID only.

Observed on 3001 after the Person 2 work: `/` `/map` `/discover` all HTTP 200,
and `/map` rendered "Backend not connected" instead of the old misleading
"No activities match".

## 6. What is genuinely verified vs. not

**Verified by running it**

- lint / typecheck / test / build on this branch (exit 0, 102 tests)
- `/`, `/map`, `/discover` return HTTP 200 in a real browser session against a
  dev server with **no Supabase configured**
- The unconfigured state renders honestly on both Discover and Map

**NOT verified — do not claim otherwise**

- **No real Supabase project has ever been connected.** `.env.local` does not
  exist anywhere.
- **`supabase/tests/rls_smoke.sql` has never been executed.** It is ~380 lines of
  unproven SQL. Only a real database run can validate it.
- Every RLS / RPC / trigger conclusion is **static or textual** only.
- Realtime has never been observed.
- No browser end-to-end demo, no Context.dev call, nothing deployed.
- **The demo-readiness condition is NOT met.**

## 7. Known risks

1. **PR #3 is still open.** `feature/aggie-playground-only` → `main`. It would
   **delete 52 files** (the frozen root Vite backup: 31 `src/`, 9 `supabase/`,
   docs and config) and **add 19 `ios-app/` files**. It also ships an
   `.env.example` with variable names that do not match the code. **Close it.**
2. **`0001_init.sql` was amended, not superseded.** See §8.
3. `npm ci` on a clean runner is still unproven locally — it needs a PR.

## 8. Migration strategy (important)

`aggie-playground/supabase/migrations/0001_init.sql` was **amended in place**
rather than adding a `0002`. Evidence it had never been applied anywhere:

- no `.env.local` / `.env`, no `supabase/.temp`, no `supabase/config.toml`,
  no `.vercel`
- only `.env.example` is tracked
- the file had exactly **one commit in its entire history** (`07a3a8a`)

The repo also designates it the single initial migration, so a `0002` would be
silently skipped by anyone following the docs.

**Residual risk:** if some machine *did* apply the old `0001`, do **not** re-run
the whole file (the tables lack `IF NOT EXISTS`). Run only the two added blocks,
which are individually idempotent:

1. `revoke all on public.participants from anon, authenticated, public;`
   followed by `grant select on public.participants to anon, authenticated;`
2. `enforce_activity_capacity()` + the `activities_capacity_guard` trigger

## 9. How to resume

```powershell
$git = 'C:\Program Files\Git\cmd\git.exe'
Set-Location 'D:\300_Workspace\B@BHacks 2.0\_wt-sprint'
& $git fetch origin
& $git status --short          # must be empty
& $git rev-parse HEAD          # compare with §1; trust Git, not this file
& $git ls-remote --heads origin sprint/final-hour main
```

Then, to iterate:

```powershell
Set-Location 'aggie-playground'
# ... lint / typecheck / test / build as in §4 ...
```

`node_modules` in this worktree was installed with pnpm
(`pnpm install --ignore-workspace`) because npm is unavailable; the generated
`pnpm-lock.yaml` is gitignored and was deleted. **Do not commit a pnpm lockfile
into `aggie-playground/`** — npm owns that directory.

## 10. What is left

**Person 4 — buddies.** Reviewed in `9c2814c`. Two gaps closed: `/buddies` had
no unconfigured state (it offered a sign-in that could not work), and the
in-flight action marker was not owned by a viewer, so A's "Sending…" could
disable B's buttons. Confirmed unchanged and correct: reads go only to
`public_profiles`, the field allowlist has no email and matches the view
exactly, `discoverable=false` and the current user are filtered in both the
query and `rankBuddies`, responses are tagged by viewer with `AbortController`
cancellation, sends are guarded by a latch plus the `23505` unique constraint,
and every sort has an `id` tiebreak. **Not verified:** any of it against a real
database.

**Person 5 — final integration.** One single PR `sprint/final-hour → main`; that
is also the first place `npm ci` gets real remote evidence. Also: reconcile the
docs that still say the only migration is `0001`, run `docs/DEMO.md` as a
rehearsal, and set the Vercel Root Directory to `aggie-playground`.

**Person 1 — done here.** The notification identity leak is fixed in `624f002`.

## 11. Supabase setup — the human step

Nothing below can be done by an agent: it needs a real project and real
credentials. Do **not** paste any value into a chat, and do not let an agent read
the clipboard, a browser password store, or an OS credential store.

1. Create (or pick) a Supabase project.
2. In **SQL Editor**, run the whole of
   `aggie-playground/supabase/migrations/0001_init.sql`
   from this branch. If the project already ran an older `0001`, do **not**
   re-run it (the tables lack `IF NOT EXISTS`) — run only the blocks listed in
   §8, plus the `notify_participation()` trigger pair.
3. **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3001`
   - Redirect URLs: add **all four**
     `http://localhost:3001/auth/callback`
     `http://127.0.0.1:3001/auth/callback`
     `http://localhost:3000/auth/callback`
     `http://127.0.0.1:3000/auth/callback`
   The callback path is mandatory — Supabase returns `?code=…` and only that
   route can exchange it. Include both hostnames: the dev server is reachable as
   both `localhost` and `127.0.0.1`, and `emailRedirectTo` is built from
   `window.location.origin`, so whichever one the browser used must be allowlisted.
4. **Authentication → Providers → Email**: magic link / OTP enabled. If
   "Confirm email" is on, the link is what signs you in, which is what we want.
5. Create the file (never commit it):
   `D:\300_Workspace\B@BHacks 2.0\_wt-sprint\aggie-playground\.env.local`
   containing exactly:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   ```
   The **anon/publishable** key only. Never the service-role key — anything
   prefixed `NEXT_PUBLIC_` is inlined into the browser bundle.

Then reply: `Supabase已创建，migration已执行，env.local已填写`.

Next actions are §12.

## 12. After the credentials exist

1. Restart **only** the port 3001 dev server (`Stop-Process -Id <3001 pid>`),
   never a blanket node kill.
2. Confirm the pages no longer say "Backend not connected".
3. Run `aggie-playground/supabase/tests/rls_smoke.sql` by hand in the SQL
   Editor. It rolls back and writes nothing. **RLS only counts as verified once
   `ALL CHECKS PASSED` is actually observed.**
4. Two-account browser E2E (A hosts → B joins → A sees the count change without
   a manual refresh → duplicate join blocked → leave → capacity guard → tests
   1–16 in the sprint brief).
5. Then Context.dev, then the final PR and CI, then Vercel.

## 13. Hard rules (unchanged)

- Never push to `main`; never force-push; merge only through a PR reviewed by
  Person 5.
- Never run the **root** `supabase/` migrations — they belong to the frozen Vite
  backup and collide on `activities` / `activity_feed`.
- Never delete the frozen root Vite app, never add `ios-app/`.
- Never commit `.env.local` or any real key. `.env.example` holds names only.
- Server-only variables must never get a `NEXT_PUBLIC_` prefix:
  `SUPABASE_SERVICE_ROLE_KEY`, `CONTEXT_DEV_API_KEY`, `CRON_SECRET`.
- Stop and ask before: connecting real Supabase, merging on GitHub, using a
  Context.dev key, or deploying to Vercel.
