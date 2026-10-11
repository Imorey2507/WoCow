import { createHash } from "node:crypto";

/**
 * Context.dev extraction → rows we are willing to store.
 *
 * Kept free of `server-only` and of any Supabase import so it can be unit
 * tested directly with `node --test` (see tests/club-normalize.test.mjs).
 * `src/lib/server/clubs.ts` owns the network and database side.
 *
 * ANTI-FABRICATION RULES — these exist because the event's rules say judges
 * check for hard-coded / invented functionality:
 *   - a title is required; anything without one is dropped
 *   - an event URL must be http(s) AND either on the same site or actually
 *     present in the scraped page; otherwise we fall back to the listing page
 *     and never store a made-up link
 *   - an unparseable date becomes null ("Date on original page"), never guessed
 */

/** Shape of one event as returned by the Context.dev extractor. */
export interface RawEvent {
  title?: string | null;
  organization?: string | null;
  starts_at?: string | null;
  location?: string | null;
  description?: string | null;
  event_url?: string | null;
}

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

/** Collapses whitespace, trims, and caps length. Blank → null. */
const clean = (s: unknown, max: number): string | null => {
  if (typeof s !== "string") return null;
  const t = s.replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
};

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
