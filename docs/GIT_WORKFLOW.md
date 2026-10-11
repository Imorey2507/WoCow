# GitHub workflow

The app code lives in `aggie-playground/`. Keep changes on a feature branch and
use a pull request so the production branch stays stable.

## Make a change

1. Create a branch on GitHub or locally, for example `feature/map-polish`.
2. Make and save the change.
3. Open a pull request from that branch into `main`.
4. Check the Vercel preview and the CI result on the pull request.
5. Merge after review. Vercel deploys the production branch automatically
   when the repository is connected.

## Local verification

Run these from `aggie-playground/`:

```bash
npm ci
npm run lint
npm run build
```

Keep `.env.local` and all server secrets out of GitHub. The pull request
template has the project-specific review checklist.
