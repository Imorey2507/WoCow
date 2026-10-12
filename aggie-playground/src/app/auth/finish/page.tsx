"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabase, supabaseConfigured } from "@/lib/supabase/client";

/**
 * Browser-side PKCE finish line.
 *
 * `/auth/callback` runs the exchange on the server and normally succeeds. When
 * it cannot — in practice "PKCE code verifier not found in storage", which we hit
 * against the live project — the verifier may still be sitting in *this* browser's
 * cookie jar. Only the browser client can read that, so this page retries the
 * exchange here before giving up.
 *
 * This is deliberately narrow: it exchanges a one-time code that the server
 * already failed to redeem, on the same origin, and never renders the code.
 */
export default function AuthFinishPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Finishing sign-in…");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const next = params.get("next");
    const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

    if (!supabaseConfigured) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- terminal configuration error, surfaced once
      setMessage("Supabase is not configured, so sign-in cannot complete.");
      return;
    }
    if (!code) {
      setMessage("That sign-in link is missing its code. Request a new one.");
      return;
    }

    void (async () => {
      const sb = getSupabase();
      // The browser client may already have redeemed the code automatically
      // (detectSessionInUrl), so a failure here is not decisive — check for a
      // session either way.
      const { error } = await sb.auth.exchangeCodeForSession(code);
      const { data } = await sb.auth.getSession();
      if (data.session) {
        router.replace(safeNext);
        return;
      }
      setMessage(error?.message ?? "Sign-in could not be completed. Request a new link.");
    })();
  }, [router]);

  const failed = !message.startsWith("Finishing");

  return (
    <div className="mx-auto max-w-md space-y-4 pt-10 text-center">
      <h1 className="font-display text-3xl font-bold">{failed ? "Sign-in didn’t finish" : "Signing you in…"}</h1>
      <p role="status" aria-live="polite" className="font-semibold text-ink/75">
        {message}
      </p>
      {failed && (
        <div className="sticker-sm rounded-3xl bg-white p-4 text-left text-sm font-semibold text-ink/80">
          <p className="font-extrabold">Most common cause</p>
          <p className="mt-1">
            The link was opened in a different browser than the one that requested it, or on a different host. Open{" "}
            <code className="rounded bg-cream px-1">localhost</code> and{" "}
            <code className="rounded bg-cream px-1">127.0.0.1</code> are <em>different</em> hosts, and a mail app’s
            built-in browser has its own cookies.
          </p>
          <p className="mt-2 font-extrabold">What to do</p>
          <p className="mt-1">
            Go back to the page where you asked for the link, request a new one, then copy the link out of the email
            and paste it into that same browser window.
          </p>
        </div>
      )}
      <Link href="/" className="sticker-sm pop inline-block rounded-full bg-sun px-4 py-2 font-display font-bold">
        Back to WoCow
      </Link>
    </div>
  );
}
