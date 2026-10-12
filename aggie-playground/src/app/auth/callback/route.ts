import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Same-origin base URL for redirects.
 *
 * `new URL(request.url).origin` is NOT trustworthy here: the Next dev server
 * normalises a request that arrived on 127.0.0.1:3001 to `localhost:3001`.
 * Redirecting there moves the browser to a different host, and cookies are
 * host-scoped — so the session the callback just created for 127.0.0.1 would be
 * invisible on localhost. Always echo back the host the browser actually used.
 */
function originOf(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host) {
    const proto = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
    return `${proto}://${host}`;
  }
  return new URL(request.url).origin;
}

/**
 * Magic-link / OAuth callback.
 *
 * `@supabase/ssr`'s `createBrowserClient` defaults to `flowType: "pkce"`, so the
 * emailed link comes back as `?code=…` and a session only exists once that code
 * is exchanged. The PKCE verifier lives in a cookie, so the exchange is tried
 * here first (this route can set the session cookie for the server).
 *
 * If it fails, the browser may still be able to complete it: the verifier is in
 * the browser's own cookie jar. Rather than showing a dead end we hand the code
 * to /auth/finish, which retries with the browser client. That turns "PKCE code
 * verifier not found in storage" — which we hit for real — from a hard failure
 * into a transparent retry.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = originOf(request);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  // Only ever bounce to a same-origin path.
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/?auth_error=missing_code`);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return NextResponse.redirect(`${origin}/?auth_error=not_configured`);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (!error) {
    return NextResponse.redirect(`${origin}${safeNext}`);
  }

  // Diagnostic. Cookie NAMES only — never values. `(none)` here means the browser
  // never sent the verifier, i.e. the link was opened in a different cookie jar
  // (another browser, or a mail client's in-app browser).
  const authCookieNames = cookieStore
    .getAll()
    .map((c) => c.name)
    .filter((n) => n.includes("auth-token"));
  console.warn(
    `[auth/callback] server exchange failed: ${error.message} | auth cookies on this request: ${
      authCookieNames.length ? authCookieNames.join(", ") : "(none)"
    } | handing off to /auth/finish`,
  );

  const handoff = new URLSearchParams({ code });
  if (safeNext !== "/") handoff.set("next", safeNext);
  return NextResponse.redirect(`${origin}/auth/finish?${handoff.toString()}`);
}
