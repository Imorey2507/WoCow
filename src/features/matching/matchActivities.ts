/**
 * WoCow · Matching entry point
 * Owner: Person 4 (Match)
 *
 * Turns "everything happening on campus" into "the five things you should
 * actually go to", using the weights in scoring.ts.
 */
import type { ActivityFeedRow, UserPreferences } from '../../lib/types'
import { scoreActivity, type ScoredActivity } from './scoring'

export interface MatchOptions {
  /** Current time, injectable so tests are deterministic. */
  now?: Date
  /** Drop activities that have already ended. Defaults to true. */
  excludePast?: boolean
  /** Drop activities with no free slots the user has not joined. Defaults to true. */
  excludeFull?: boolean
  /** Minimum score (0..100) to be considered a match. Defaults to 0. */
  minScore?: number
  /** Cap the result length. Defaults to no limit. */
  limit?: number
}

/**
 * Ranks activities for one user.
 *
 * Pure and synchronous: same inputs, same output. No network; pass `now` to avoid reading the clock, which makes it safe to call on every keystroke.
 */
export function matchActivities(
  activities: ActivityFeedRow[],
  preferences: UserPreferences,
  options: MatchOptions = {},
): ScoredActivity[] {
  const {
    now = new Date(),
    excludePast = true,
    excludeFull = true,
    minScore = 0,
    limit,
  } = options

  const nowMs = now.getTime()

  const scored = activities
    .filter((activity) => {
      const start = new Date(activity.starts_at).getTime()
      const end = new Date(activity.ends_at).getTime()
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return false
      if (excludePast && end <= nowMs) return false
      // A full activity the user is already in is still a match for them.
      if (excludeFull && activity.is_full && !activity.is_joined) return false
      return true
    })
    .map((activity) => scoreActivity(activity, preferences, now))
    .filter((match) => match.score >= minScore)
    .sort((a, b) => {
      // Highest score first; break ties by soonest start so the list is stable.
      if (b.score !== a.score) return b.score - a.score
      return (
        new Date(a.activity.starts_at).getTime() -
        new Date(b.activity.starts_at).getTime()
      ) || a.activity.id.localeCompare(b.activity.id)
    })

  return typeof limit === 'number' ? scored.slice(0, Math.max(0, Math.floor(limit))) : scored
}

/**
 * Compares two events by category, overlapping time windows and venue.
 * This compares events only; it does not infer compatibility between people.
 */
export function similarityBetween(
  a: ActivityFeedRow,
  b: ActivityFeedRow,
): number {
  const sameCategory = a.category === b.category ? 1 : 0
  const aStart = new Date(a.starts_at).getTime()
  const aEnd = new Date(a.ends_at).getTime()
  const bStart = new Date(b.starts_at).getTime()
  const bEnd = new Date(b.ends_at).getTime()

  const overlapMs = Math.min(aEnd, bEnd) - Math.max(aStart, bStart)
  const overlaps = overlapMs > 0 ? 1 : 0
  const sameSpot = a.location_name === b.location_name ? 1 : 0

  return 0.5 * sameCategory + 0.3 * overlaps + 0.2 * sameSpot
}

/**
 * Given what the user already joined, suggests the closest alternatives —
 * the "if that one is full, try this" helper.
 */
export function recommendSimilar(
  target: ActivityFeedRow,
  candidates: ActivityFeedRow[],
  limit = 3,
): ActivityFeedRow[] {
  return candidates
    .filter((candidate) => candidate.id !== target.id)
    .map((candidate) => ({ candidate, similarity: similarityBetween(target, candidate) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, Math.max(0, Math.floor(limit)))
    .map((entry) => entry.candidate)
}

export type { ScoredActivity }
