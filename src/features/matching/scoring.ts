/**
 * WoCow · Matching score
 * Owner: Person 4 (Match)
 *
 * Pure, dependency-free scoring so it is trivially testable and can be reused
 * by the UI, the map and the feed without touching the network.
 *
 * The score is a weighted blend of four signals, each normalised to 0..1:
 *
 *   interest  0.45  category the user picked, earlier picks score higher
 *   timing    0.25  starts soon, and is not already over
 *   distance  0.20  closer is better, falls back to neutral when unknown
 *   space     0.10  has free slots, and is not almost empty
 *
 * Weights are exported so the team can tune them in one place.
 */
import { haversineKm } from '../../lib/format'
import type { ActivityFeedRow, UserPreferences } from '../../lib/types'

export const MATCH_WEIGHTS = {
  interest: 0.45,
  timing: 0.25,
  distance: 0.2,
  space: 0.1,
} as const

export interface MatchBreakdown {
  interest: number
  timing: number
  distance: number
  space: number
}

export interface ScoredActivity {
  activity: ActivityFeedRow
  /** 0..100, higher is a better match. */
  score: number
  breakdown: MatchBreakdown
  /** Short human-readable reasons, best first, for a "why this?" tooltip. */
  reasons: string[]
  /** Straight-line kilometres from the user, when their position is known. */
  distanceKm: number | null
}

/** Clamps to the 0..1 range. */
function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0
  return Math.min(1, Math.max(0, value))
}

/**
 * Interest: 1.0 for the first preferred category, decaying with position.
 * An activity in the user's 3rd choice still beats one they never picked.
 */
export function interestScore(category: string, interests: string[]): number {
  if (interests.length === 0) return 0.5 // no stated preference -> neutral
  const index = interests.indexOf(category)
  if (index === -1) return 0
  return clamp01(1 - index / (interests.length + 1))
}

/**
 * Timing: rewards activities starting soon, decays across a 7-day horizon,
 * and drops to zero once they are over. Something starting in the next 10
 * minutes is maximally urgent.
 */
export function timingScore(
  startsAt: string,
  endsAt: string,
  now: Date = new Date(),
): number {
  const start = new Date(startsAt).getTime()
  const end = new Date(endsAt).getTime()
  const t = now.getTime()

  if (t >= end) return 0
  if (t >= start) return 0.9 // already running: still very relevant

  const hoursUntil = (start - t) / 3_600_000
  if (hoursUntil <= 0.5) return 1

  const HORIZON_HOURS = 24 * 7
  return clamp01(1 - hoursUntil / HORIZON_HOURS)
}

/**
 * Distance: 1.0 next door, 0 at or beyond the travel limit. When the user has
 * no position we return a neutral 0.5 rather than penalising them.
 */
export function distanceScore(
  distanceKm: number | null,
  maxDistanceKm: number,
): number {
  if (distanceKm === null) return 0.5
  if (maxDistanceKm <= 0) return 0.5
  return clamp01(1 - distanceKm / maxDistanceKm)
}

/**
 * Space: an activity with free slots beats a full one, and one that is not
 * nearly empty beats a lonely one — a "matched" activity should have company.
 * A full activity scores 0 so it sinks unless the user already joined it.
 */
export function spaceScore(activity: ActivityFeedRow): number {
  if (activity.is_joined) return 1 // already in: always relevant
  if (activity.is_full) return 0

  const fill = activity.participant_count / activity.max_participants
  // Peaks around 50-80% full: enough people, still room to join.
  const headroom = 1 - fill
  const buzz = Math.min(1, fill / 0.5)
  return clamp01(0.6 * buzz + 0.4 * headroom * 2)
}

/** Computes the full weighted score plus a breakdown and explanations. */
export function scoreActivity(
  activity: ActivityFeedRow,
  preferences: UserPreferences,
  now: Date = new Date(),
): ScoredActivity {
  const distanceKm =
    preferences.latitude !== undefined && preferences.longitude !== undefined
      ? haversineKm(
          preferences.latitude,
          preferences.longitude,
          activity.latitude,
          activity.longitude,
        )
      : null

  const breakdown: MatchBreakdown = {
    interest: interestScore(activity.category, preferences.interests),
    timing: timingScore(activity.starts_at, activity.ends_at, now),
    distance: distanceScore(distanceKm, preferences.maxDistanceKm ?? 5),
    space: spaceScore(activity),
  }

  const weighted =
    breakdown.interest * MATCH_WEIGHTS.interest +
    breakdown.timing * MATCH_WEIGHTS.timing +
    breakdown.distance * MATCH_WEIGHTS.distance +
    breakdown.space * MATCH_WEIGHTS.space

  const reasons: string[] = []
  if (breakdown.interest >= 0.8) reasons.push('Matches your top interest')
  else if (breakdown.interest > 0) reasons.push(`You like ${activity.category}`)

  if (breakdown.timing >= 0.9) reasons.push('Starting very soon')
  else if (breakdown.timing >= 0.5) reasons.push('Coming up soon')

  if (distanceKm !== null && distanceKm < 0.5) reasons.push('Right by you')
  else if (distanceKm !== null && breakdown.distance >= 0.6) {
    reasons.push(`${distanceKm.toFixed(1)} km away`)
  }

  if (activity.is_joined) reasons.push('You are going')
  else if (breakdown.space >= 0.7) reasons.push('Good group size')
  if (activity.is_full && !activity.is_joined) reasons.push('Full — waitlist only')

  return {
    activity,
    score: Math.round(clamp01(weighted) * 100),
    breakdown,
    reasons,
    distanceKm,
  }
}
