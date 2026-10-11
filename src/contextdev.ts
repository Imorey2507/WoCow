import { createHash } from "node:crypto";
import ContextDev from "context.dev";
import {
  ALL_SUBCATEGORIES,
  CATEGORIES,
  type Category,
  type WocowEvent,
} from "./categories.js";

// Server-side only. Never ship this key to the mobile/web client.
export const client = new ContextDev({ apiKey: process.env.CONTEXT_DEV_API_KEY });

const AGGIELIFE_EVENTS = "https://aggielife.ucdavis.edu/events";

// ---------------------------------------------------------------------------
// Shared extraction schema. `category` is an enum of WoCow's 7 categories, so
// the model classifies while it extracts. Everything a page may omit is
// nullable, which the docs recommend so we don't get invented values.
// ---------------------------------------------------------------------------
const nullableString = { type: ["string", "null"] } as const;

const eventsSchema = {
  type: "object",
  properties: {
    events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          category: { type: "string", enum: CATEGORIES },
          subcategory: { type: ["string", "null"], enum: [...ALL_SUBCATEGORIES, null] },
          start_time: nullableString,
          end_time: nullableString,
          location: nullableString,
          host_club: nullableString,
          description: nullableString,
          url: nullableString,
          attendee_count: { type: ["number", "null"] },
          is_free: { type: ["boolean", "null"] },
        },
        required: ["title", "category"],
      },
    },
  },
  required: ["events"],
} as const;

const EXTRACT_INSTRUCTIONS =
  "List every upcoming event on the page. Use only facts stated on the page; " +
  "use null when a fact is missing. Times must be ISO 8601 in America/Los_Angeles. " +
  "Pick the closest category; use 'Social & Hangouts' > 'Campus Events' for general " +
  "club meetings. Skip online-only events.";

interface RawEvent {
  title: string;
  category: Category;
  subcategory?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  host_club?: string | null;
  description?: string | null;
  url?: string | null;
  attendee_count?: number | null;
  is_free?: boolean | null;
}

function toWocow(raw: RawEvent, source: WocowEvent["source"], sourceUrl: string): WocowEvent {
  return {
    title: raw.title,
    category: raw.category,
    subcategory: raw.subcategory ?? null,
    startTime: raw.start_time ?? null,
    endTime: raw.end_time ?? null,
    location: raw.location ?? null,
    hostClub: raw.host_club ?? null,
    description: raw.description ?? null,
    url: raw.url ?? null,
    attendeeCount: raw.attendee_count ?? null,
    isFree: raw.is_free ?? null,
    source,
    sourceUrl,
  };
}

// Stable id so re-scrapes and monitor webhooks never create duplicate pins.
export function eventKey(e: Pick<WocowEvent, "title" | "startTime" | "hostClub">): string {
  const norm = [e.title, e.startTime ?? "", e.hostClub ?? ""]
    .join("|")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return createHash("sha1").update(norm).digest("hex").slice(0, 16);
}

export function dedupe(events: WocowEvent[]): WocowEvent[] {
  const seen = new Map<string, WocowEvent>();
  for (const e of events) if (!seen.has(eventKey(e))) seen.set(eventKey(e), e);
  return [...seen.values()];
}

// ---------------------------------------------------------------------------
// 1) Bulk source: scrape a page of events into WoCow's schema.
//    AggieLife (CampusGroups) renders its list with JavaScript; Context.dev's
//    scraper runs a real browser, so `waitFor` on the list is enough. We avoid
//    browser `actions` (e.g. clicking "More") because they need a paid plan.
// ---------------------------------------------------------------------------
export async function scrapeEvents(
  url: string = AGGIELIFE_EVENTS,
  source: WocowEvent["source"] = "aggielife",
): Promise<WocowEvent[]> {
  const page = await client.web.scrape({
    url,
    formats: { json: true },
    jsonParams: { schema: eventsSchema as any, instructions: EXTRACT_INSTRUCTIONS },
    sharedParams: { waitFor: 5000, mainContentOnly: true },
    maxAgeMs: 15 * 60 * 1000, // reuse a cached copy for 15 min: saves credits, still fresh
  });

  // A 200 can still hold a failed output, so check before reading data.
  if (!page.json?.success) {
    console.warn(`[scrapeEvents] extraction failed for ${url}`, page.json);
    return [];
  }
  const data = page.json.data as { events?: RawEvent[] } | null;
  return (data?.events ?? []).map((e) => toWocow(e, source, url));
}

// ---------------------------------------------------------------------------
// 2) The gap filler (the "main function" of Context.dev in WoCow):
//    when the live map is thin for a category/time window, research the web for
//    real club activities and return pins. Answers 'fast' costs 10 credits.
// ---------------------------------------------------------------------------
export async function findClubEvents(opts: {
  category: Category;
  subcategory?: string;
  when?: string; // e.g. "this week", "today after 5pm"
}): Promise<WocowEvent[]> {
  const topic = opts.subcategory ?? opts.category;
  const res = await client.web.answers({
    mode: "fast",
    task:
      `Find real, upcoming UC Davis student club or campus activities about "${topic}" ` +
      `happening ${opts.when ?? "this week"} in Davis, CA. Start from aggielife.ucdavis.edu, ` +
      `then check club websites. Only include events whose details are stated on a page; ` +
      `never invent times or locations. Return at most 8.`,
    json_format: {
      events: [
        {
          title: "",
          start_time: "",
          end_time: "",
          location: "",
          host_club: "",
          url: "",
        },
      ],
    },
    timeoutOpts: { milliseconds: 30000, behavior: "return-partial" },
  });

  const rows = ((res.json_content as any)?.events ?? []) as RawEvent[];
  const sourceUrl = res.sources?.[0] ?? AGGIELIFE_EVENTS;
  return rows
    .filter((r) => r.title)
    .map((r) => toWocow({ ...r, category: opts.category, subcategory: opts.subcategory ?? null }, "answers", r.url ?? sourceUrl));
}

// Decide whether to call the gap filler. Wire `currentCount` to your DB query.
export function needsMoreEvents(currentCount: number, threshold = 5): boolean {
  return currentCount < threshold;
}

// ---------------------------------------------------------------------------
// 3) Live updates: watch a page and get a signed webhook when something new is
//    posted. Semantic detection ignores noise (counters, timestamps).
// ---------------------------------------------------------------------------
export async function watchClubPage(opts: { name: string; url: string; webhookUrl: string }) {
  const monitor = await client.monitors.create({
    name: opts.name,
    target: {
      type: "page",
      url: opts.url,
      instructions:
        "Report newly added or rescheduled events (title, date, time, location). " +
        "Ignore attendee counts, timestamps, and layout changes.",
    },
    webhook: { url: opts.webhookUrl, retry: {} },
  });
  // Store monitor.webhook.secret and verify signatures in your receiver:
  // https://docs.context.dev/webhooks#verify-signatures
  return { id: monitor.id, secret: monitor.webhook?.secret };
}
