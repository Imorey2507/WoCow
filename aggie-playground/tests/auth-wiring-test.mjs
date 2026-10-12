/**
 * Auth wiring — the PKCE callback contract.
 *
 * This guards a real release blocker: `@supabase/ssr`'s `createBrowserClient`
 * defaults to `flowType: "pkce"`, so the emailed magic link comes back as
 * `?code=…` and a session only exists after that code is exchanged on the
 * server. The app had no callback route at all, so sign-in completed at Supabase
 * while the browser stayed signed out — silent, and impossible to demo.
 *
 * Node's built-in runner, no dependencies.
 * Naming note: `-test.mjs` (not `.test.mjs`) — see club-normalize-test.mjs.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, "..", "src");
const CALLBACK = resolve(SRC, "app", "auth", "callback", "route.ts");
const AUTH_PROVIDER = resolve(SRC, "components", "AuthProvider.tsx");
const BROWSER_CLIENT = resolve(SRC, "lib", "supabase", "client.ts");

const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : "");

/**
 * Assertions about what the code *does* must not trip over prose: the route's
 * doc comment legitimately names `createBrowserClient` to explain why the server
 * client is required.
 */
const code = (p) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

describe("pkce callback route", () => {
  test("exists at app/auth/callback/route.ts", () => {
    assert.ok(existsSync(CALLBACK), "the PKCE callback route is missing — magic-link sign-in cannot complete");
  });

  test("exports a GET handler", () => {
    assert.match(read(CALLBACK), /export\s+async\s+function\s+GET/);
  });

  test("actually exchanges the code for a session", () => {
    assert.match(read(CALLBACK), /exchangeCodeForSession/);
  });

  test("reads the PKCE verifier from cookies via the server client", () => {
    const src = code(CALLBACK);
    assert.match(src, /createServerClient/, "must use the server client to see the verifier cookie");
    assert.match(src, /cookies\(\)/, "must read the request cookies");
    assert.doesNotMatch(src, /createBrowserClient/, "the callback must not use the browser client");
  });

  test("does not set a route-segment config that cacheComponents rejects", () => {
    // next.config.ts sets cacheComponents: true, which makes `export const dynamic`
    // a build error. `cookies()` already forces this route to be dynamic.
    assert.doesNotMatch(code(CALLBACK), /export\s+const\s+dynamic\b/);
  });

  test("never redirects off-origin (no open redirect)", () => {
    assert.match(read(CALLBACK), /startsWith\("\/"\)/);
    assert.match(read(CALLBACK), /startsWith\("\/\/"\)/);
  });

  test("handles a missing code and a missing configuration without throwing", () => {
    const src = read(CALLBACK);
    assert.match(src, /missing_code/);
    assert.match(src, /not_configured/);
  });
});

describe("sign-in points at the callback", () => {
  test("emailRedirectTo targets /auth/callback, not the bare origin", () => {
    const src = read(AUTH_PROVIDER);
    assert.match(src, /signInWithOtp/);
    assert.match(src, /\/auth\/callback/, "the email must come back to the callback route");
  });

  test("the browser client is the PKCE one, which is why the route is required", () => {
    assert.match(read(BROWSER_CLIENT), /createBrowserClient/);
  });
});

describe("redirect origin is the host the browser actually used", () => {
  test("the callback does not trust new URL(request.url).origin", () => {
    // The Next dev server normalises a request that arrived on 127.0.0.1:3001 to
    // localhost:3001, so trusting request.url sends the browser to a different
    // host — and cookies are host-scoped, so the new session would vanish.
    const src = code(CALLBACK);
    assert.match(src, /headers\.get\("host"\)/, "must derive the origin from the Host header");
    assert.match(src, /x-forwarded-host/);
    assert.match(src, /x-forwarded-proto/);
  });

  test("still refuses to redirect off-origin", () => {
    const src = code(CALLBACK);
    assert.match(src, /startsWith\("\/"\)/);
    assert.match(src, /startsWith\("\/\/"\)/);
  });
});

describe("browser-side fallback", () => {
  const FINISH = resolve(SRC, "app", "auth", "finish", "page.tsx");

  test("exists, so a failed server exchange is not a dead end", () => {
    assert.ok(existsSync(FINISH), "the /auth/finish fallback page is missing");
  });

  test("retries the exchange with the browser client", () => {
    const src = code(FINISH);
    assert.match(src, /exchangeCodeForSession/);
    assert.match(src, /getSession/, "must check for a session even if the retry errors");
    assert.match(src, /createBrowserClient|getSupabase/);
  });

  test("the server route hands off instead of showing a dead end", () => {
    assert.match(read(CALLBACK), /\/auth\/finish/);
  });

  test("the fallback never renders or logs the code", () => {
    const src = code(FINISH);
    assert.doesNotMatch(src, /console\.(log|warn|error)/);
    assert.doesNotMatch(src, /\{code\}/, "the code must never be rendered");
  });
});
