# Git workflow — five people, one repository

The goal is simple: five people write code in parallel for two days without
ever destroying each other's work. That only works if `main` is always
deployable and nobody commits to it directly.

---

## The one rule

> **Only Person 5 (integration) merges into `main`, and only through a Pull
> Request.** Everyone else works on their own branch.

If you push directly to `main`, you can overwrite a teammate's merged work and
Git will not warn you.

---

## One-time setup

Person 5 creates the repository and invites the other four:

1. GitHub → **New repository**
   - Name: `wocow`
   - Description: `Real-time campus activity discovery and matching platform.`
   - Visibility: **Private** during development. Switch to **Public** before
     submission — the hackathon requires a public repo.
   - Add a README: **yes** (this gives you a `main` branch immediately)
   - Add .gitignore: **Node**
   - License: **None** for now
2. **Settings → Collaborators → Add people** → invite the other four by
   username or email. Everyone uses their **own** GitHub account.

Then, from this folder, one person creates the five branches:

```powershell
# Windows
pwsh -File scripts/setup-branches.ps1
```

```bash
# macOS / Linux
bash scripts/setup-branches.sh
```

---

## Daily loop

```bash
# 1. Start from the latest main
git switch main
git pull origin main

# 2. Get on your own branch (first time only: git switch -c feature/matching)
git switch feature/matching

# 3. Bring in whatever landed on main since you branched
git merge main

# 4. Work. Commit small and often.
git add .
git commit -m "Add distance weighting to matching score"

# 5. Push
git push -u origin feature/matching
```

Then open a Pull Request on GitHub: **Compare & pull request**, base `main`,
compare `feature/matching`.

---

## Branch map

| Person | Branch | Area |
| --- | --- | --- |
| 1 | `feature/frontend` | `src/components/`, `src/pages/`, `src/index.css` |
| 2 | `feature/map` | `src/features/map/` |
| 3 | `feature/backend` | `src/features/activities/`, `src/lib/`, `supabase/` |
| 4 | `feature/matching` | `src/features/matching/` |
| 5 | `feature/integration` | `src/App.tsx`, `src/main.tsx`, config, docs |

---

## Review checklist

Before Person 5 clicks Merge:

- [ ] `pnpm typecheck` passes locally
- [ ] `pnpm test` passes
- [ ] `pnpm build` succeeds
- [ ] The Vercel preview URL for this PR actually works
- [ ] Create → join → leave → count updates **without a refresh**
- [ ] No `.env.local`, keys or passwords in the diff
- [ ] New or changed database columns are reflected in
      `supabase/migrations/` **and** `src/lib/types.ts`

If it touches the database, Person 3 reviews it. If it touches `App.tsx`,
Person 5 reviews it.

---

## Avoiding conflicts

Conflicts happen when two people edit the same file. The folder split above is
designed so that almost never happens. The three files that *are* shared:

| File | Who edits | How to avoid pain |
| --- | --- | --- |
| `package.json` | anyone adding a dependency | Say so in the group chat first. Two people adding dependencies at once is the #1 conflict. |
| `src/App.tsx` | Person 5 mostly | If you need a page wired up, send Person 5 the props rather than editing it yourself. |
| `src/lib/types.ts` | Person 3 | Person 3 lands type changes early so others can build against them. |

Person 3 should land `src/lib/types.ts`, `src/lib/supabase.ts` and
`src/features/activities/api.ts` **on day one**, before anyone else starts.
Then the other four have a stable contract to code against.

### When you do get a conflict

```bash
git switch main
git pull origin main
git switch feature/matching
git merge main          # conflict appears here, not in the PR
# edit the files, remove the <<<<<<< ======= >>>>>>> markers
git add .
git commit -m "Merge main into feature/matching"
git push
```

Resolve it on your own branch, never in `main`.

---

## Commits that are actually useful

```
Add activity matching algorithm          ← what changed
Fix join race condition with row lock    ← why it matters
Update RLS so only hosts can delete      ← scope
```

Avoid `update`, `fix`, `stuff`, `final`. In two days you will read this log
more than you expect.

---

## Sync rhythm

Every 1–2 hours, as a team:

1. Everyone merges the latest `main` into their branch.
2. Everyone pushes and opens a PR for something that **works**, even if small.
3. Person 5 reviews and merges.
4. Someone opens the deployed site and tests create / join / leave / match.

Frequent small merges are far safer than one giant merge at 3 a.m.

---

## Database changes

Never edit a table in the Supabase Dashboard without writing the SQL into
`supabase/migrations/` in the same PR. Otherwise the other four have a database
that no longer matches the code, and a fresh Supabase project cannot be
recreated from the repo.

Use the next timestamped filename:

```
supabase/migrations/20250101000700_add_activity_tags.sql
```
