## What does this change?

<!-- One or two sentences. What can a user do now that they could not before? -->

## Who owns it?

- [ ] Person 1 — UI (`src/components/`, `src/pages/`, `src/index.css`)
- [ ] Person 2 — Map (`src/features/map/`)
- [ ] Person 3 — Data (`src/features/activities/`, `src/lib/`, `supabase/`)
- [ ] Person 4 — Matching (`src/features/matching/`)
- [ ] Person 5 — Integration (`src/App.tsx`, `src/main.tsx`, config)

## How to test it

<!-- Steps a reviewer can follow. Be specific: which tab, which button. -->

1.
2.

## Checklist

- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] `pnpm build` succeeds
- [ ] I tested this on a phone-width window, not just desktop
- [ ] No `.env.local`, API keys, or passwords in the diff
- [ ] If I changed the database, I added a **new** migration file (I did not
      edit an applied one) **and** updated `src/lib/types.ts`

## Screenshots

<!-- For anything visual. Drag images straight into this box. -->

## Anything the reviewer should worry about?

<!-- Tricky parts, follow-up work, known gaps. "None" is a fine answer. -->
