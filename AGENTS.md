# WoCow repository instructions

## The app

This repository uses the Next.js app in `aggie-playground/`. The old root Vite
app has been removed. Read `aggie-playground/AGENTS.md` before editing Next.js
code; that file requires consulting the installed Next.js 16 documentation
before making source changes.

## Safety and Git

- Never commit `.env.local`, API secrets, database passwords, or Supabase
  service-role keys.
- Never put server secrets in `NEXT_PUBLIC_*` variables.
- Work on a `feature/*` branch and use a pull request; do not push to `main`.
- Do not deploy until the Supabase schema and required environment variables
  are configured.

## Commands

Run from `aggie-playground/`:

```bash
npm ci
npm run lint
npm run build
```

The app's migration is `aggie-playground/supabase/migrations/0001_init.sql`.
Do not apply the removed root app's migrations to this app's database.
