# 🐮 Aggie Playground

A playful, real-time campus social app for UC Davis: see what's happening **right now**, join spontaneous
activities from a live map, find people with shared interests, and discover official club events.

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · Supabase (Postgres, Auth, Realtime) ·
Leaflet + OpenStreetMap · Context.dev · deploys to Vercel.

## What works

| Area | How it's implemented |
|---|---|
| Activities | Stored in Postgres. Host creates / edits / cancels (RLS: only the host can modify). |
| Join / Leave | `join_activity()` RPC locks the activity row, so two students racing for the last spot are serialized. Duplicate joins are impossible (primary key). Direct inserts into `participants` are blocked by RLS. |
| Participant counts | Always derived from `participants` rows via the `activity_feed` view. Nothing hard-coded. |
| Real-time | Supabase Realtime on `activities`, `participants`, `notifications`, `posts`; clients refetch the view on change. |
| Map | Leaflet + OSM, real UC Davis coordinates, category-colored pins with live count, preview card with Join, category + status filters. Only public meeting spots are shown, never personal locations. |
| Context.dev | Server-only. `POST /api/clubs/refresh` scrapes AggieLife with Context.dev's `web/scrape` JSON extraction, normalizes, de-duplicates, caches in `club_events`, and logs every run in `club_sync_log`. Failures are shown to the user — nothing is substituted. |
| Notifications | DB triggers notify students whose favorite categories match a new activity, and joined students when an activity is updated or cancelled. In-app center on the Profile page. |
| Buddies | Opt-in only (off by default). Score = +1 per shared category, +2 per shared activity. Interests are exposed through the `public_profiles` view only when the student opted in. |
| Discussions | Basic posts by topic (signed-in users post; everyone reads). |
| PWA | Web manifest + icon so it can be added to a home screen. |

## Setup (≈10 minutes)

1. **Install**
   ```bash
   npm install
   cp .env.example .env.local
   ```
2. **Supabase** — create a project at supabase.com, then:
   - SQL Editor → paste and run `supabase/migrations/0001_init.sql`.
   - Authentication → Providers: Email enabled (magic link). Add your site URL(s) under URL Configuration
     (`http://localhost:3000` and your Vercel URL).
   - Project Settings → API: copy the URL, anon key, and service-role key into `.env.local`.
3. **Context.dev** — get an API key from context.dev and set `CONTEXT_DEV_API_KEY`.
4. **Run** `npm run dev` → http://localhost:3000

### Environment variables

| Variable | Where used | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | Public. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | Public; safe because every table has RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Used by the refresh route to write the club cache. Never prefix with `NEXT_PUBLIC_`. |
| `CONTEXT_DEV_API_KEY` | **server only** | Never reaches the browser. |
| `CRON_SECRET` | server only | Lets the scheduler call the refresh route. Set the same value in Vercel. |

### Deploy to Vercel

Import the repo, add the five variables above, deploy. `vercel.json` schedules a club refresh every 6 hours
(Vercel Cron sends `Authorization: Bearer $CRON_SECRET`). Students can also tap **Refresh from AggieLife**
(throttled to once per 5 minutes to protect your Context.dev credits).

## Demo flow (2 minutes)

You need **two accounts** (two browsers, or one normal + one private window). Real data only — nothing is seeded.

1. **Account A** signs in, opens Profile, picks *Competitive Sports* as a favorite category, and saves.
2. **Account B** signs in and taps **+ Host Activity** → "Sand volleyball", Competitive Sports → Volleyball, ARC, start now, max 6.
3. A gets an entry in the in-app notification center (Profile page; no push); the activity appears on Home under **Happening Now** and as a pin on **Map**.
4. A opens the map, taps the volleyball pin, taps **Join** → the count goes 1/6 → 2/6 on both screens without reloading.
5. Discover → **Campus Clubs** → **Refresh from AggieLife** → real events appear with **View Original Event ↗** links back to the source.

## Verified vs. not verified

Verified in development:
- `tsc`, ESLint and `next build` pass; all routes respond; no server secret appears in the client bundle; the refresh API returns 401 without a login.
- Against a scratch Postgres 16 with a minimal Supabase shim, the real migration applied cleanly and:
  10 simultaneous joins for 2 remaining spots → exactly 2 succeeded, 8 got `full`;
  duplicate join, joining a cancelled activity, anonymous join, non-host edit/cancel, and direct `participants` inserts are all rejected;
  cancellation notifies joined students; non-opted-in profiles expose no interests; buddy requests require the target's opt-in (this test caught and fixed a real policy bug).
- Event normalization: duplicates collapse, unverifiable or `javascript:` links fall back to the listing page, unparseable dates become "Date on original page".

**Not verified — you must check these:**
- The app has not been run against a real Supabase project (auth emails, Realtime delivery, and the browser UI were not exercised end to end).
- The Context.dev call has not been run against the live API (no key in this environment). AggieLife is a JavaScript-heavy site; if extraction returns nothing or the site blocks the scrape, the UI shows the error. Check `club_sync_log` and tweak `EVENT_SCHEMA` / `waitFor` in `src/lib/server/context.ts`.
- No visual pass in a real browser or on a phone yet.

## Known gaps

- Browser push notifications and an offline service worker are not implemented (in-app notifications only). The PWA is installable via manifest but uses an SVG icon; add 192/512 PNGs for the best iOS result.
- Sign-in accepts any email. To restrict to UC Davis, enable an email-domain check in Supabase (Auth hook) or add a `@ucdavis.edu` check.
- Recommendations are simple (your favorite categories, soonest first). Forum has no comments or moderation.
- No seeded activities or demo profiles: the empty states are real. Add test accounts and mark `profiles.is_demo = true` if you want them labeled "DEMO PROFILE" in Buddies.

## Project map

```
supabase/migrations/0001_init.sql   schema, RLS, atomic join, triggers, realtime
src/lib/{categories,locations}.ts   7 categories + subcategories; real campus coordinates
src/components/                     providers (auth, activities, UI), map, cards, filters, host modal
src/app/{page,map,discover,buddies,profile}
src/app/api/clubs/refresh/route.ts  authenticated refresh endpoint
src/lib/server/{context,clubs}.ts   Context.dev client, normalization, dedupe, caching
```
