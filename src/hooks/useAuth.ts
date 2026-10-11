/**
 * WoCow · useAuth hook
 * Owner: Person 5 (Integration) — every module reads the session from here.
 *
 * Supports three ways in:
 *   signUp / signInWithPassword   email + password
 *   signInWithMagicLink           passwordless email link
 *   signInAsGuest                 anonymous session, one tap, great for demos
 *
 * For judging day, "Continue as guest" is the fastest path — but it must be
 * enabled once in the Supabase Dashboard (Authentication -> Sign In /
 * Providers -> Anonymous sign-ins). See docs/SETUP.md.
 */
import { useCallback, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

export interface UseAuthResult {
  user: User | null
  session: Session | null
  /** True until the persisted session has been restored on first load. */
  loading: boolean
  signUp: (email: string, password: string) => Promise<{ needsEmailConfirm: boolean }>
  signInWithPassword: (email: string, password: string) => Promise<void>
  signInWithMagicLink: (email: string) => Promise<void>
  signInAsGuest: () => Promise<void>
  signOut: () => Promise<void>
}

export function useAuth(): UseAuthResult {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    let active = true

    // Restore any session persisted in localStorage.
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
    })

    // Keep in sync with sign-in, sign-out and token refresh.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    // With "Confirm email" on (the Supabase default) no session comes back.
    return { needsEmailConfirm: !data.session }
  }, [])

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signInWithMagicLink = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) throw error
  }, [])

  const signInAsGuest = useCallback(async () => {
    const { error } = await supabase.auth.signInAnonymously()
    if (error) {
      throw new Error(
        'Guest sign-in is off. Enable it in Supabase: Authentication -> Sign In / Providers -> Anonymous sign-ins.',
      )
    }
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }, [])

  return {
    user: session?.user ?? null,
    session,
    loading,
    signUp,
    signInWithPassword,
    signInWithMagicLink,
    signInAsGuest,
    signOut,
  }
}
