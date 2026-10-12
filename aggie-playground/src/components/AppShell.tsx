"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { UIProvider, useUI } from "./UIProvider";
import { HostModal } from "./HostModal";
import { useAuth } from "./AuthProvider";
import { Cow } from "./Cow";

const NAV = [
  { href: "/profile", label: "Profile", emoji: "🧑‍🎓" },
  { href: "/map", label: "Map", emoji: "🗺️" },
  { href: "/discover", label: "Discover", emoji: "🔥" },
  { href: "/buddies", label: "Buddies", emoji: "🤝" },
];

function AuthSheet() {
  const { authOpen, setAuthOpen, signInWithEmail, signInWithPassword, configured } = useAuth();
  const [mode, setMode] = useState<"link" | "password">("link");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [err, setErr] = useState<string | null>(null);
  if (!authOpen) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "sending") return; // a second click must not fire a second request
    setErr(null);
    setState("sending");
    const msg =
      mode === "link"
        ? await signInWithEmail(email.trim())
        : await signInWithPassword(email.trim(), password);
    if (msg) {
      setErr(msg);
      setState("idle");
      return;
    }
    // The password path signs in straight away; onAuthStateChange updates the shell.
    if (mode === "link") setState("sent");
    else setAuthOpen(false);
  }

  const tab = (m: "link" | "password", label: string) => (
    <button
      type="button"
      key={m}
      aria-pressed={mode === m}
      onClick={() => {
        setMode(m);
        setErr(null);
        setState("idle");
      }}
      className={`rounded-full px-3 py-1 text-sm font-extrabold ${mode === m ? "bg-ink text-cream" : "bg-white"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[3000] flex items-end justify-center bg-ink/50 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Sign in">
      <div className="slide-up sticker w-full max-w-md rounded-t-3xl bg-cream p-6 sm:rounded-3xl">
        <div className="flex items-start justify-between">
          <Cow size={72} mood="wow" className="wiggle" />
          <button type="button" onClick={() => { setAuthOpen(false); setState("idle"); }} className="sticker-sm pop grid h-9 w-9 place-items-center rounded-full bg-white font-black" aria-label="Close">✕</button>
        </div>
        <h2 className="mt-2 font-display text-2xl font-bold">Join the herd</h2>
        <p className="mt-1 font-semibold text-ink/75">
          {mode === "link"
            ? "Sign in with your email — we'll send you a magic link. No password needed."
            : "Sign in with the email and password for your account."}
        </p>
        {!configured ? (
          <p className="mt-4 rounded-2xl border-2 border-ink bg-sun/60 p-3 text-sm font-bold">Supabase isn&apos;t configured yet — see the README to add your project keys.</p>
        ) : state === "sent" ? (
          <p className="mt-4 rounded-2xl border-2 border-ink bg-grass/50 p-3 font-bold">Check your inbox for the link! 📬</p>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-3">
            <div className="flex gap-2" role="group" aria-label="Sign-in method">
              {tab("link", "Magic link")}
              {tab("password", "Password")}
            </div>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@ucdavis.edu" className="w-full rounded-2xl border-2 border-ink bg-white px-3 py-2.5 text-base font-semibold outline-none focus:ring-4 focus:ring-sun/60" aria-label="Email address" />
            {mode === "password" && (
              <input type="password" required minLength={6} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" className="w-full rounded-2xl border-2 border-ink bg-white px-3 py-2.5 text-base font-semibold outline-none focus:ring-4 focus:ring-sun/60" aria-label="Password" />
            )}
            {err && <p role="alert" className="text-sm font-bold text-red-700">{err}</p>}
            <button disabled={state === "sending"} aria-busy={state === "sending" || undefined} className="sticker pop w-full rounded-2xl bg-sun py-3 font-display text-lg font-bold disabled:opacity-60">
              {state === "sending" ? "Signing in…" : mode === "link" ? "Send magic link" : "Sign in"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { openHost, toast } = useUI();
  const { user, profile, setAuthOpen, requireAuth, configured } = useAuth();

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col">
      <header className="sticky top-0 z-[1500] flex items-center justify-between gap-3 bg-cream/90 px-4 py-3 backdrop-blur">
        <Link href="/" className="flex items-center gap-2">
          <Cow size={40} />
          <span className="font-display text-xl font-bold leading-none">Aggie<br className="sm:hidden" /> Playground</span>
        </Link>
        <div className="flex items-center gap-2">
          <button onClick={() => { if (requireAuth()) openHost(); }} className="sticker-sm pop rounded-full bg-sun px-4 py-2 font-display text-base font-bold">
            + Host Activity
          </button>
          {user ? (
            <Link href="/profile" className="sticker-sm pop grid h-10 w-10 place-items-center rounded-full text-xl" style={{ background: profile?.avatar_color ?? "#ffd84d" }} aria-label="My profile">
              {profile?.avatar_emoji ?? "🐮"}
            </Link>
          ) : (
            <button onClick={() => setAuthOpen(true)} className="sticker-sm pop rounded-full bg-white px-4 py-2 font-display text-base font-bold">Sign in</button>
          )}
        </div>
      </header>

      {!configured && (
        <div className="mx-4 mb-2 rounded-2xl border-2 border-ink bg-tangerine/50 p-3 text-sm font-bold">
          ⚙️ Backend not connected: add your Supabase keys in <code>.env.local</code> (see README). Nothing below is mocked — it will show real data once connected.
        </div>
      )}

      <main className="flex-1 px-4 pb-28">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-[1500] border-t-[2.5px] border-ink bg-white pb-[env(safe-area-inset-bottom)]" aria-label="Primary">
        <ul className="mx-auto grid max-w-xl grid-cols-4">
          {NAV.map((n) => {
            const active = pathname.startsWith(n.href);
            return (
              <li key={n.href}>
                <Link href={n.href} aria-current={active ? "page" : undefined} className={`flex flex-col items-center gap-0.5 py-2 text-xs font-extrabold ${active ? "text-ink" : "text-ink/60"}`}>
                  <span className={`grid h-9 w-14 place-items-center rounded-full text-xl transition-colors ${active ? "bg-sun sticker-sm" : ""}`}>{n.emoji}</span>
                  {n.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <HostModal />
      <AuthSheet />
      {toast && (
        <div role="status" className="slide-up sticker fixed bottom-24 left-1/2 z-[4000] -translate-x-1/2 rounded-full bg-white px-5 py-2.5 text-sm font-extrabold">
          {toast}
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <UIProvider>
      <Shell>{children}</Shell>
    </UIProvider>
  );
}
