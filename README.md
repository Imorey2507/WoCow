# WoCow

This repository contains **Aggie Playground**, a UC Davis campus activity app.
The website and backend live in [`aggie-playground/`](aggie-playground/), and the
native iPhone app lives in [`ios-app/`](ios-app/). The old Vite app has been
removed.

## Run the native iPhone app

Install **Expo Go** from the App Store on your iPhone. On your computer, open a
terminal in `ios-app/` and run:

```bash
npm ci
npm start
```

Scan the QR code with your iPhone camera and open it in Expo Go. The app opens
to an interactive UC Davis map using Apple Maps; no map API key is needed.
See [`ios-app/README.md`](ios-app/README.md) for details.

## Run it locally

1. Install [Node.js 20 or newer](https://nodejs.org/).
2. Open a terminal in `aggie-playground/` and run:

   ```bash
   npm ci
   cp .env.example .env.local
   ```

3. Fill in the Supabase values in `.env.local` and set the server-side values
   for Context.dev features. See [`aggie-playground/README.md`](aggie-playground/README.md)
   for setup details. Never share or publish `.env.local`.
4. Start the app:

   ```bash
   npm run dev
   ```

5. Open <http://localhost:3000>.

## Publish the app

Import this GitHub repository into Vercel and set **Root Directory** to
`aggie-playground`. Add the environment variables listed in
[`docs/DEPLOY.md`](docs/DEPLOY.md), then deploy. The database migration and
Supabase Auth URL setup are also required for the map and sign-in features to
work online.

For product details, environment variables, and database setup, see
[`aggie-playground/README.md`](aggie-playground/README.md).
