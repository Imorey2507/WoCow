/**
 * WoCow · SignInPanel
 * Owner: Person 1 (UI) / Person 5 (Integration)
 *
 * Modal for getting a user into the app. Three routes, in the order a judge
 * will try them:
 *
 *   1. Continue as guest   — one tap, no email, perfect for a live demo
 *   2. Email + password    — the normal path
 *   3. Magic link          — passwordless
 *
 * Guest mode must be switched on once in Supabase:
 * Authentication -> Sign In / Providers -> Anonymous sign-ins.
 */
import { useState, type FormEvent } from 'react'

export interface SignInPanelProps {
  open: boolean
  onClose: () => void
  onSignInWithPassword: (email: string, password: string) => Promise<void>
  onSignUp: (email: string, password: string) => Promise<{ needsEmailConfirm: boolean }>
  onMagicLink: (email: string) => Promise<void>
  onGuest: () => Promise<void>
}

type Mode = 'password' | 'signup' | 'magic'

export function SignInPanel({
  open,
  onClose,
  onSignInWithPassword,
  onSignUp,
  onMagicLink,
  onGuest,
}: SignInPanelProps) {
  const [mode, setMode] = useState<Mode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const reset = () => {
    setMessage(null)
    setError(null)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    reset()

    try {
      if (mode === 'magic') {
        await onMagicLink(email.trim())
        setMessage('Check your inbox — the sign-in link is on its way.')
      } else if (mode === 'signup') {
        const { needsEmailConfirm } = await onSignUp(email.trim(), password)
        if (needsEmailConfirm) {
          setMessage('Account created. Confirm your email, then sign in.')
        } else {
          onClose()
        }
      } else {
        await onSignInWithPassword(email.trim(), password)
        onClose()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const handleGuest = async () => {
    setBusy(true)
    reset()
    try {
      await onGuest()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Guest sign-in failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="wocow-overlay" role="dialog" aria-modal="true" aria-label="Sign in">
      <div className="wocow-modal wocow-modal--sm">
        <header className="wocow-modal__head">
          <h2>Welcome to WoCow</h2>
          <button
            type="button"
            className="wocow-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <button
          type="button"
          className="wocow-btn wocow-btn--primary wocow-btn--block"
          onClick={handleGuest}
          disabled={busy}
        >
          🎟️ Continue as guest
        </button>
        <p className="wocow-hint">
          No email needed. Needs “Anonymous sign-ins” enabled in Supabase Auth.
        </p>

        <div className="wocow-divider">
          <span>or use email</span>
        </div>

        <div className="wocow-segmented">
          <button
            type="button"
            className={mode === 'password' ? 'is-active' : ''}
            onClick={() => {
              setMode('password')
              reset()
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            className={mode === 'signup' ? 'is-active' : ''}
            onClick={() => {
              setMode('signup')
              reset()
            }}
          >
            Sign up
          </button>
          <button
            type="button"
            className={mode === 'magic' ? 'is-active' : ''}
            onClick={() => {
              setMode('magic')
              reset()
            }}
          >
            Magic link
          </button>
        </div>

        <form onSubmit={handleSubmit} className="wocow-form">
          <label className="wocow-field">
            <span>Email</span>
            <input
              type="email"
              className="wocow-input"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              placeholder="you@ucdavis.edu"
            />
          </label>

          {mode !== 'magic' && (
            <label className="wocow-field">
              <span>Password</span>
              <input
                type="password"
                className="wocow-input"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                placeholder="At least 6 characters"
              />
            </label>
          )}

          {error && (
            <p className="wocow-alert wocow-alert--error" role="alert">
              {error}
            </p>
          )}
          {message && <p className="wocow-alert wocow-alert--ok">{message}</p>}

          <button
            type="submit"
            className="wocow-btn wocow-btn--primary wocow-btn--block"
            disabled={busy}
          >
            {busy
              ? 'Working…'
              : mode === 'magic'
                ? 'Email me a link'
                : mode === 'signup'
                  ? 'Create account'
                  : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default SignInPanel
