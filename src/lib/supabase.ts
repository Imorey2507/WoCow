/**
 * WoCow · Supabase client
 * Owner: Person 3 (Data) — this file is the single shared database connection.
 *
 * All five modules import `supabase` from here. Nobody creates their own
 * client, so there is exactly one auth session and one realtime socket.
 *
 * SECURITY
 * --------
 * `VITE_*` variables are inlined into the browser bundle, so the publishable
 * key is PUBLIC. That is fine and intended: Supabase protects the data with
 * Row Level Security, not with key secrecy.
 *
 * Never put these in a VITE_ variable:
 *   - the `service_role` / secret key  (bypasses RLS entirely)
 *   - the database password
 *   - any third-party API secret
 * Anything in this file ships to every visitor's browser.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

/** True once a real Supabase project is wired up via `.env.local`. */
export const isSupabaseConfigured = Boolean(
  url && key && !url.includes('YOUR_PROJECT_REF') && !key.includes('YOUR_PUBLISHABLE'),
)

/**
 * When the env vars are missing we still hand back a client so that every
 * `import { supabase }` works and TypeScript stays happy. Requests simply
 * fail, and the UI gates on `isSupabaseConfigured` and shows setup
 * instructions instead of a crashed white screen.
 */
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(url as string, key as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : createClient('http://localhost:54321', 'missing-anon-key', {
      auth: { persistSession: false, autoRefreshToken: false },
    })

/** Clears the "not configured" banner once the team is set up. */
export const missingEnvVars: string[] = [
  ...(url ? [] : ['VITE_SUPABASE_URL']),
  ...(key ? [] : ['VITE_SUPABASE_PUBLISHABLE_KEY']),
]
