import "server-only";
import { createClient } from "@supabase/supabase-js";
import { ContextError, scrapeEvents } from "./context";
import { normalize, type NormalizedEvent } from "@/lib/club-normalize";

// Re-exported so existing callers keep importing from one place.
export { normalize };
export type { NormalizedEvent };

export const CLUB_SOURCES = ["https://aggielife.ucdavis.edu/events"];

export function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server credentials are not configured.");
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface SyncResult {
  ok: boolean;
  source: string;
  found: number;
  stored: number;
  error?: string;
  throttled?: boolean;
}

/** Refresh the cache from every source. Failures are logged and reported — never papered over with fake data. */
export async function syncClubEvents(opts: { force?: boolean } = {}): Promise<SyncResult[]> {
  const db = serviceClient();
  const results: SyncResult[] = [];

  for (const source of CLUB_SOURCES) {
    // Throttle: protect the Context.dev credit budget from refresh-button spam.
    if (!opts.force) {
      const { data: last } = await db
        .from("club_sync_log")
        .select("ran_at")
        .eq("source_url", source)
        .eq("ok", true)
        .order("ran_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (last && Date.now() - new Date(last.ran_at).getTime() < 5 * 60_000) {
        results.push({ ok: true, source, found: 0, stored: 0, throttled: true });
        continue;
      }
    }

    try {
      const { events, markdown } = await scrapeEvents(source);
      const rows = normalize(events, source, markdown);
      // Drop events that already ended (keep undated ones; the original page is the source of truth).
      const cutoff = Date.now() - 12 * 3600_000;
      const upcoming = rows.filter((r) => !r.starts_at || new Date(r.starts_at).getTime() >= cutoff);

      if (upcoming.length) {
        const { error } = await db
          .from("club_events")
          .upsert(upcoming.map((r) => ({ ...r, fetched_at: new Date().toISOString() })), { onConflict: "dedupe_key" });
        if (error) throw new Error(error.message);
      }
      await db.from("club_sync_log").insert({ source_url: source, ok: true, events_found: upcoming.length });
      results.push({ ok: true, source, found: events.length, stored: upcoming.length });
    } catch (e) {
      const message = e instanceof ContextError || e instanceof Error ? e.message : "Unknown error";
      await db.from("club_sync_log").insert({ source_url: source, ok: false, events_found: 0, error: message });
      results.push({ ok: false, source, found: 0, stored: 0, error: message });
    }
  }
  return results;
}
