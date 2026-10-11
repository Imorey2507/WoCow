# Publish Aggie Playground on Vercel

This repository now contains one app. Use `aggie-playground/` as the Vercel
project root.

## Before importing the repo

1. Create a Supabase project for Aggie Playground. If the old Vite app's schema
   was applied to a Supabase project, use a separate project here; the two apps
   had incompatible schemas.
2. In the Supabase SQL Editor, run
   `aggie-playground/supabase/migrations/0001_init.sql` once.
3. From **Settings → API**, copy the project URL and anon key. Keep the
   service-role key private.
4. Create a Context.dev API key if you want club event imports.

## Import into Vercel

1. Sign in to [Vercel](https://vercel.com) with the GitHub account that can
   access this repository.
2. Choose **Add New → Project**, then import `Imorey2507/WoCow`.
3. Set **Root Directory** to `aggie-playground`.
4. Add these environment variables for Production, Preview, and Development:

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service-role key |
   | `CONTEXT_DEV_API_KEY` | Your Context.dev key |
   | `CRON_SECRET` | A long, randomly generated value |

   The two `NEXT_PUBLIC_` values are used in the browser. Keep all other
   values server-side; never rename them with a `NEXT_PUBLIC_` prefix.
5. Choose **Deploy**. Vercel detects Next.js from the selected app directory.

You can copy `aggie-playground/.env.example` to `aggie-playground/.env.local`
for local development. Never commit that local file or paste the service-role
key into chat.

## After the first deploy

In Supabase, open **Authentication → URL Configuration** and set the Site URL
to the Vercel URL. Add that URL and `http://localhost:3000` to Redirect URLs.
Then open the Vercel URL and check that sign-in and the map load.

Vercel builds production from the configured production branch and creates
preview deployments for pull requests. See [Vercel's Git deployment guide](https://vercel.com/docs/git).
