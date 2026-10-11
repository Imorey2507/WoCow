/**
 * Pure UI state helpers.
 *
 * Deliberately dependency-free — no React, no Supabase, no imports of any kind —
 * so they can be unit tested directly with `node --test` and type stripping.
 * Anything that needs a component or a client belongs in `components/`.
 */

// ───────────────────────────── activity card ─────────────────────────────

export interface JoinButtonInput {
  isHost: boolean;
  joined: boolean;
  full: boolean;
  busy: boolean;
}

export interface JoinButtonState {
  kind: "host" | "joined" | "full" | "join";
  label: string;
  /**
   * Explicit accessible name. The visible label changes to "Joining…" while a
   * request is in flight, which on its own is a poor name for a screen reader.
   */
  ariaLabel: string;
  disabled: boolean;
  tone: "lavender" | "white" | "muted" | "grass";
}

/**
 * Single source of truth for what the join control says and whether it is
 * clickable. Order matters: hosting beats everything, and `busy` beats the
 * resting state so a second click cannot get through.
 */
export function joinButtonState(input: JoinButtonInput): JoinButtonState {
  const { isHost, joined, full, busy } = input;

  if (isHost) {
    return {
      kind: "host",
      label: "You're hosting",
      ariaLabel: "You are hosting this activity",
      disabled: true,
      tone: "lavender",
    };
  }

  if (busy) {
    return joined
      ? { kind: "joined", label: "Leaving…", ariaLabel: "Leaving this activity", disabled: true, tone: "white" }
      : { kind: "join", label: "Joining…", ariaLabel: "Joining this activity", disabled: true, tone: "grass" };
  }

  if (joined) {
    return { kind: "joined", label: "Leave", ariaLabel: "Leave this activity", disabled: false, tone: "white" };
  }
  if (full) {
    return { kind: "full", label: "Full", ariaLabel: "This activity is full", disabled: true, tone: "muted" };
  }
  return { kind: "join", label: "Join Activity", ariaLabel: "Join this activity", disabled: false, tone: "grass" };
}

/** Progress-bar fill as a 0–100 integer. Never NaN, never out of range. */
export function capacityPercent(participantCount: number, maxParticipants: number): number {
  if (!Number.isFinite(participantCount) || !Number.isFinite(maxParticipants) || maxParticipants <= 0) {
    return 0;
  }
  const pct = Math.round((participantCount / maxParticipants) * 100);
  if (!Number.isFinite(pct)) return 0;
  return Math.min(100, Math.max(0, pct));
}

/** "Full" / "1 spot left" / "3 spots left". */
export function spotsLabel(spotsRemaining: number): string {
  if (!Number.isFinite(spotsRemaining) || spotsRemaining <= 0) return "Full";
  return spotsRemaining === 1 ? "1 spot left" : `${Math.floor(spotsRemaining)} spots left`;
}

// ─────────────────────────────── feed state ───────────────────────────────

export interface FeedStateInput {
  /** Is a Supabase project wired up at all? */
  configured: boolean;
  loading: boolean;
  error: string | null;
  /** Rows left after filtering. */
  visibleCount: number;
  /** Are any search/category/status filters currently narrowing the feed? */
  hasActiveFilters: boolean;
}

export type FeedState = "unconfigured" | "error" | "loading" | "no-matches" | "empty" | "ready";

/**
 * Why this exists: with no Supabase configured the provider returns early,
 * leaving `loading === false` and `activities === []`. Without this the page
 * renders "Nothing live right now", which reads as a genuinely quiet campus
 * rather than an unconfigured backend. Priority is deliberate:
 * unconfigured > error > loading > empty.
 */
export function feedState(input: FeedStateInput): FeedState {
  const { configured, loading, error, visibleCount, hasActiveFilters } = input;

  if (!configured) return "unconfigured";
  if (error) return "error";
  if (loading) return "loading";
  if (visibleCount > 0) return "ready";
  return hasActiveFilters ? "no-matches" : "empty";
}
