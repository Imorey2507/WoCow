# Deploying to Vercel

Person 5 owns this. Budget ten minutes for the first deploy; after that every
push is automatic.

---

## Before you deploy

- [ ] `main` is up to date and `pnpm build` passes locally
- [ ] The Supabase migrations have all been run against the **production**
      Supabase project
- [ ] You know your `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`
- [ ] `.env.local` is **not** committed (it is gitignored — verify with
      `git status`)

---

## 1. Import the repository

1. Sign in at [vercel.com](https://vercel.com) **with GitHub**.
2. **Add New → Project**.
3. Find `wocow` in the list and click **Import**.
   - If it is missing, click **Adjust GitHub App Permissions** and grant access
     to the repository.
4. Vercel detects Vite automatically. Confirm:

   | Setting | Value |
   | --- | --- |
   | Framework Preset | `Vite` |
   | Root Directory | `./` |
   | Build Command | `pnpm build` |
   | Output Directory | `dist` |
   | Install Command | `pnpm install` |
   | Node.js Version | 20.x or 22.x |

   These are also pinned in `vercel.json`, so the defaults should already be
   right.

5. **Do not click Deploy yet** — add the environment variables first, or the
   build will produce a site that shows the "needs a database" screen.

---

## 2. Environment variables

Open **Environment Variables** on the import screen (or
**Project → Settings → Environment Variables** afterwards) and add:

| Name | Value | Environments |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` | Production, Preview, Development |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | your publishable/anon key | Production, Preview, Development |

Two things that catch people out:

- **`VITE_` prefix is required.** Vite only exposes variables with that prefix
  to the browser. Without it, `import.meta.env.VITE_SUPABASE_URL` is
  `undefined` and the build silently ships a broken app.
- **These are baked in at build time**, not read at runtime. Changing a value
  requires a **redeploy**, not just a save.

> ⚠️ Never add the `service_role` key here. It bypasses Row Level Security, and
> anything in a `VITE_*` variable is visible to every visitor in the browser
> bundle.

---

## 3. Deploy

Click **Deploy**. The first build takes 1–2 minutes. You get a URL like
`https://wocow-abc123.vercel.app`.

Open it on your phone and on your laptop.

---

## 4. Add the deployed URL to Supabase

Now that you have a real origin, tell Supabase it is allowed.

**Supabase → Authentication → URL Configuration:**

- **Site URL:** `https://wocow-abc123.vercel.app`
- **Redirect URLs:** add
  ```
  https://wocow-abc123.vercel.app
  https://wocow-*.vercel.app
  http://localhost:5173
  ```

The wildcard covers the per-branch preview deployments, so teammates can sign
in on a preview URL too.

---

## 5. Automatic deploys from here on

| Branch | Result |
| --- | --- |
| `main` | Deployment to your **production** URL |
| any other branch / PR | A **preview** deployment with its own URL, commented on the PR |

So Person 5's merge is the deploy. Nobody runs a deploy command by hand.

`vercel.json` also rewrites all paths to `index.html`, so if you later add
`react-router` deep links will still work.

---

## 6. Before you submit

1. **Make the GitHub repo public.** The hackathon requires it:
   GitHub → the `wocow` repo → **Settings → General → Danger Zone → Change
   repository visibility → Public.**

   Check the repo has no secrets first:
   ```bash
   git log --all --full-history -- .env.local
   git grep -n "service_role\|SUPABASE_SERVICE" $(git rev-list --all) -- 2>/dev/null | head
   ```
   If either returns anything, rotate the key in Supabase before going public.

2. **Turn email confirmation back on** if you disabled it
   (Supabase → Authentication → Sign In / Providers → Email).

3. **Keep anonymous sign-ins on** — the judges' fastest path into the app is
   the **Continue as guest** button.

4. Seed some activities so the app is not empty.

5. Test on a real phone, on cellular data — not just the venue Wi-Fi.

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Deployed site shows "needs a database" | Env vars missing at build time | Add them, then **Redeploy** |
| Build fails: `ERR_PNPM_IGNORED_BUILDS` | esbuild install script blocked | `pnpm-workspace.yaml` already allow-lists it; ensure that file is committed |
| Build succeeds but every request 401s | Wrong key pasted (secret instead of publishable) | Re-copy from Settings → API |
| Magic link redirects to an error page | Deployed URL not in Supabase redirect allow-list | Step 4 |
| Realtime works locally, not in production | Nothing — check the browser console for a websocket block, and confirm the tables are in the publication | Run the realtime migration |
| Old data still shown after a change | Browser or CDN cache | Hard refresh; Vercel invalidates on deploy |
| `404` on refresh of a sub-path | SPA rewrite missing | Confirm `vercel.json` is committed |

---

## Rollback

**Vercel → Deployments →** pick a previous good deployment **→ Promote to
Production**. That is instant and does not require a revert commit, which is
exactly what you want during a live demo.
