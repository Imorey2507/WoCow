import "server-only";

const ENDPOINT = "https://api.context.dev/v1/web/scrape";

export interface RawEvent {
  title?: string | null;
  organization?: string | null;
  starts_at?: string | null;
  location?: string | null;
  description?: string | null;
  event_url?: string | null;
}

export class ContextError extends Error {
  constructor(message: string, public code?: string, public status?: number) {
    super(message);
  }
}

const EVENT_SCHEMA = {
  type: "object",
  properties: {
    events: {
      type: "array",
      description: "Every distinct upcoming event listed on the page. Only include events actually shown on the page.",
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "Event title exactly as shown" },
          organization: { type: "string", description: "Hosting club or organization name as shown, if any" },
          starts_at: { type: "string", description: "Start date/time as ISO 8601 with the America/Los_Angeles UTC offset. Omit if no date is shown." },
          location: { type: "string", description: "Location as shown, if any" },
          description: { type: "string", description: "Short description as shown, if any" },
          event_url: { type: "string", description: "Link to this event's own page, if the page links one" },
        },
        required: ["title"],
      },
    },
  },
  required: ["events"],
};

/**
 * Scrape one public page with Context.dev and return the structured event list plus the page
 * markdown (used later to verify links). Throws ContextError with a user-presentable message.
 */
export async function scrapeEvents(sourceUrl: string): Promise<{ events: RawEvent[]; markdown: string; creditsUsed?: number }> {
  const key = process.env.CONTEXT_DEV_API_KEY;
  if (!key) throw new ContextError("CONTEXT_DEV_API_KEY is not set on the server.", "NOT_CONFIGURED");

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url: sourceUrl,
        formats: { json: true, markdown: true },
        jsonParams: {
          schema: EVENT_SCHEMA,
          instructions:
            "Extract only events that are literally listed on this page. Never invent or infer events, dates, or locations. Leave a field out when the page does not show it.",
        },
        markdownParams: { includeLinks: true },
        sharedParams: { waitFor: 4000, dismissCookies: true },
        maxAgeMs: 10 * 60 * 1000,
        timeoutOpts: { milliseconds: 60_000, behavior: "fail" },
        tags: ["aggie-playground-clubs"],
      }),
      signal: AbortSignal.timeout(75_000),
    });
  } catch (e) {
    throw new ContextError(`Could not reach Context.dev: ${e instanceof Error ? e.message : "network error"}`, "NETWORK");
  }

  interface ScrapeBody {
    error_code?: string;
    code?: string;
    message?: string;
    json?: { success?: boolean; error_code?: string; message?: string; data?: { events?: RawEvent[] } };
    markdown?: { data?: string };
    key_metadata?: { credits_consumed?: number };
  }
  const body = (await res.json().catch(() => null)) as ScrapeBody | null;

  if (!res.ok) {
    const code = body?.error_code ?? body?.code ?? String(res.status);
    const msg =
      res.status === 401 ? "Context.dev rejected the API key (or credits are exhausted)."
      : res.status === 429 ? "Context.dev rate limit hit — try again in a minute."
      : res.status === 408 ? "Context.dev timed out loading the page."
      : body?.message ?? `Context.dev returned HTTP ${res.status}.`;
    throw new ContextError(msg, code, res.status);
  }

  const jsonOut = body?.json;
  if (!jsonOut?.success) {
    throw new ContextError(
      jsonOut?.message ? `Context.dev could not extract events from this page: ${jsonOut.message}` : "Context.dev could not extract events from this page.",
      jsonOut?.error_code ?? "EXTRACT_FAILED",
    );
  }

  const events = Array.isArray(jsonOut.data?.events) ? (jsonOut.data.events as RawEvent[]) : [];
  return {
    events,
    markdown: typeof body?.markdown?.data === "string" ? body.markdown.data : "",
    creditsUsed: body?.key_metadata?.credits_consumed,
  };
}
