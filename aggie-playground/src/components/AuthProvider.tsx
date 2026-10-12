"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase, supabaseConfigured } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

interface AuthCtx {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  configured: boolean;
  signInWithEmail: (email: string) => Promise<string | null>;
  signInWithPassword: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  requireAuth: () => boolean; // returns true if signed in, otherwise opens the sign-in sheet
  authOpen: boolean;
  setAuthOpen: (v: boolean) => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(supabaseConfigured);
  const [authOpen, setAuthOpen] = useState(false);

  const loadProfile = useCallback(async (u: User | null) => {
    if (!u) return setProfile(null);
    const { data } = await getSupabase().from("profiles").select("*").eq("id", u.id).maybeSingle();
    setProfile((data as Profile | null) ?? null);
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) return;
    const sb = getSupabase();
    sb.auth.getUser().then(({ data }) => {
      setUser(data.user);
      loadProfile(data.user).finally(() => setLoading(false));
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      loadProfile(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const signInWithEmail = useCallback(async (email: string) => {
    // Point at the PKCE callback route: the email link carries ?code=... and only
    // /auth/callback can exchange it for a session.
    const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;
    const { error } = await getSupabase().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    return error ? error.message : null;
  }, []);

  /**
   * Password sign-in, as a deliberate second path next to the magic link.
   *
   * Supabase's built-in SMTP is capped at a couple of emails per hour per
   * project, which can make the link flow impossible to use at all. This path
   * uses no email, but it is still real authentication — no anonymous sign-in,
   * and email confirmation stays on. The account is created out of band (the
   * Supabase dashboard's "Add user" with auto-confirm).
   */
  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await getSupabase().auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  }, []);

  const signOut = useCallback(async () => {
    await getSupabase().auth.signOut();
  }, []);

  const requireAuth = useCallback(() => {
    if (user) return true;
    setAuthOpen(true);
    return false;
  }, [user]);

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      profile,
      loading,
      configured: supabaseConfigured,
      signInWithEmail,
      signInWithPassword,
      signOut,
      refreshProfile: () => loadProfile(user),
      requireAuth,
      authOpen,
      setAuthOpen,
    }),
    [user, profile, loading, signInWithEmail, signInWithPassword, signOut, loadProfile, requireAuth, authOpen],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
