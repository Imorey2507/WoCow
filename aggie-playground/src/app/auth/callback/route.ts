import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Magic-link / OAuth callback.
 *
 * `@supabase/ssr`'s `createBrowserClient` defaults to `flowType: "pkce"`, so the
 * emailed link comes back as `?code=…` and a session is only created once that
 * code is exchanged. Nothing else in this app does that, so without this route
 * sign-in completes at Supabase but the browser stays signed out.
 *
 * The PKCE verifier lives in a cookie that `createBrowserClient` wrote, which is
 * why this has to run on the server: `createServerClient` reads the same cookie
 * back and completes the exchange, then the session cookie it sets is what the
 * browser client picks up on the next render.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
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
  if (error) {
    return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(error.message)}`);
  }
  return NextResponse.redirect(`${origin}${safeNext}`);
}
