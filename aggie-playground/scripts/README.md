# `aggie-playground/scripts/` — Context.dev prototype

Standalone Node scripts used to develop and probe the Context.dev integration.
**They are not part of the Next.js app's build**, and nothing in `src/` imports
them.

These scripts are kept separate from the Next.js application source because
they are exploratory CLI tools, not part of the deployed app.

| File | What it is |
| --- | --- |
| `categories.ts` | WoCow's 7-category taxonomy and subcategories. Used as a JSON Schema `enum` so Context.dev classifies each scraped event into a real WoCow category during extraction, instead of needing a second classification pass. |
| `contextdev.ts` | The Context.dev client: scrape AggieLife, normalise, dedupe, and a `needsMoreEvents()` helper that decides when a category is too thin and asks Context.dev to find more. |
| `run.ts` | CLI smoke test that exercises the three above. |

## Running them

These scripts import the `context.dev` npm package and `tsx`, neither of which
is a dependency of the Next.js app — the app talks to the Context.dev REST API
over `fetch` instead (`aggie-playground/src/lib/server/context.ts`). Install
them on demand:

```bash
cd aggie-playground
npm install --no-save context.dev tsx
export CONTEXT_DEV_API_KEY=ctxt_secret_...
npx tsx scripts/run.ts
```

## Why this matters for the hackathon

Context.dev is a **bonus track worth $750 + $5k credits**, and the event rules
warn that judges will check for hard-coded functionality. The taxonomy here is
what makes the scraping genuinely useful rather than decorative: a scraped club
event lands directly in the same category vocabulary the rest of the app uses,
so club events and student-hosted activities appear on one map with one filter
system.
