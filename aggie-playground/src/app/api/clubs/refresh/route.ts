import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { serviceClient, syncClubEvents } from "@/lib/server/clubs";

export const maxDuration = 90;

/** Authorized callers: the scheduler (Bearer CRON_SECRET) or a signed-in student (Supabase access token). */
async function authorize(req: Request): Promise<"cron" | "user" | null> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  const secret = process.env.CRON_SECRET;
  if (secret && token === secret) return "cron";
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) return null;
    const { data } = await createClient(url, anon, { auth: { persistSession: false } }).auth.getUser(token);
    return data.user ? "user" : null;
  } catch {
    return null;
  }
}

async function handle(req: Request) {
  const who = await authorize(req);
  if (!who) return NextResponse.json({ error: "Sign in to refresh club events." }, { status: 401 });
  try {
    serviceClient(); // fail early with a clear message if server credentials are missing
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server not configured" }, { status: 503 });
  }
  const results = await syncClubEvents({ force: who === "cron" });
  const failed = results.filter((r) => !r.ok);
  return NextResponse.json({ results }, { status: failed.length === results.length && failed.length ? 502 : 200 });
}

export const POST = handle;
export const GET = handle; // Vercel Cron issues GET requests
