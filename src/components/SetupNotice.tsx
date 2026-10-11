/**
 * WoCow · SetupNotice
 * Owner: Person 5 (Integration)
 *
 * Shown instead of the app when `.env.local` has no Supabase credentials.
 *
 * This exists because the most common day-one failure is a white screen with
 * a cryptic "supabaseUrl is required" in the console. A new teammate should
 * instead see exactly which values are missing and where to get them.
 */
import { missingEnvVars } from '../lib/supabase'

export function SetupNotice() {
  return (
    <div className="wocow-setup">
      <div className="wocow-setup__card">
        <span className="wocow-setup__emoji" aria-hidden="true">
          🐮
        </span>
        <h1>WoCow needs a database</h1>
        <p>
          The app is running, but it is not connected to Supabase yet. Create
          the project, then fill in two values.
        </p>

        <ol className="wocow-setup__steps">
          <li>
            Create a project at{' '}
            <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">
              supabase.com/dashboard
            </a>{' '}
            named <code>WoCow</code>.
          </li>
          <li>
            Open <strong>SQL Editor</strong> and run every file in{' '}
            <code>supabase/migrations/</code> in filename order.
          </li>
          <li>
            Copy <code>.env.example</code> to <code>.env.local</code>.
          </li>
          <li>
            From <strong>Settings → API</strong>, paste the Project URL and the
            publishable (anon) key, then restart{' '}
            <code>pnpm dev</code>.
          </li>
        </ol>

        {missingEnvVars.length > 0 && (
          <p className="wocow-alert wocow-alert--error">
            Missing: <code>{missingEnvVars.join(', ')}</code>
          </p>
        )}

        <pre className="wocow-setup__code">
          {`VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY`}
        </pre>

        <p className="wocow-hint">
          Full walkthrough: <code>docs/SETUP.md</code>. Vite only reads{' '}
          <code>.env.local</code> at startup, so restart the dev server after
          editing it.
        </p>
      </div>
    </div>
  )
}

export default SetupNotice
