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
