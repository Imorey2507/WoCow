import "server-only";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { ContextError, scrapeEvents, type RawEvent } from "./context";

export const CLUB_SOURCES = ["https://aggielife.ucdavis.edu/events"];

export interface NormalizedEvent {
  dedupe_key: string;
  title: string;
  organization: string | null;
  starts_at: string | null;
  location: string | null;
  description: string | null;
  event_url: string;
  source_site: string;
}

export function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server credentials are not configured.");
  return createClient(url, key, { auth: { persistSession: false } });
}

const clean = (s: unknown, max: number): string | null => {
  if (typeof s !== "string") return null;
  const t = s.replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
};

/**
 * Turn raw extractor output into rows we're willing to store.
 * Anti-fabrication rules:
 *  - a title is required;
 *  - the event URL must be http(s) and either appear in the scraped page's own links or be on the
 *    same site; otherwise we fall back to the listing page itself (never a made-up link);
 *  - unparseable dates become null (shown as "Date on original page"), never guessed.
 */
export function normalize(raw: RawEvent[], sourceUrl: string, pageMarkdown: string): NormalizedEvent[] {
  const source = new URL(sourceUrl);
  const out = new Map<string, NormalizedEvent>();

  for (const r of raw) {
    const title = clean(r.title, 160);
    if (!title) continue;

    let eventUrl = sourceUrl;
    if (typeof r.event_url === "string" && r.event_url.trim()) {
      try {
        const u = new URL(r.event_url.trim(), source);
        const sameSite = u.hostname === source.hostname;
        const onPage = pageMarkdown.includes(u.href) || pageMarkdown.includes(u.pathname);
        if ((u.protocol === "http:" || u.protocol === "https:") && (sameSite || onPage)) eventUrl = u.href;
      } catch {
        /* keep listing page */
      }
    }

    let startsAt: string | null = null;
    if (typeof r.starts_at === "string") {
      const d = new Date(r.starts_at);
      if (!Number.isNaN(d.getTime())) startsAt = d.toISOString();
    }

    const organization = clean(r.organization, 120);
    // Duplicate detection: same normalized title + same calendar day + same organization.
    const day = startsAt ? startsAt.slice(0, 10) : "undated";
    const key = createHash("sha256")
      .update([title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(), day, (organization ?? "").toLowerCase()].join("|"))
      .digest("hex")
      .slice(0, 32);

    if (!out.has(key)) {
      out.set(key, {
        dedupe_key: key,
        title,
        organization,
        starts_at: startsAt,
        location: clean(r.location, 160),
        description: clean(r.description, 600),
        event_url: eventUrl,
        source_site: source.hostname,
      });
    }
  }
  return [...out.values()];
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
