/**
 * WoCow · useMatches hook
 * Owner: Person 4 (Match)
 *
 * A thin, memoised wrapper so components can write:
 *
 *   const { matches, topMatch } = useMatches(activities, preferences)
 *
 * All the real logic lives in matchActivities.ts, which stays pure and tested.
 */
import { useMemo } from 'react'
import type { ActivityFeedRow, UserPreferences } from '../../lib/types'
import { matchActivities, type MatchOptions } from './matchActivities'
import type { ScoredActivity } from './scoring'

export interface UseMatchesResult {
  matches: ScoredActivity[]
  /** The single best match, or null when nothing qualifies. */
  topMatch: ScoredActivity | null
  /** Convenience: just the activities, in ranked order. */
  ranked: ActivityFeedRow[]
}

export function useMatches(
  activities: ActivityFeedRow[],
  preferences: UserPreferences,
  options: MatchOptions = {},
): UseMatchesResult {
  // Destructure the options so the dependency list is primitive values only —
  // an inline `{}` literal would otherwise re-run the ranking on every render.
  const { now, excludePast, excludeFull, minScore, limit } = options
  const interestsKey = preferences.interests.join('|')

  const matches = useMemo(
    () =>
      matchActivities(activities, preferences, {
        now,
        excludePast,
        excludeFull,
        minScore,
        limit,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      activities,
      interestsKey,
      preferences.latitude,
      preferences.longitude,
      preferences.maxDistanceKm,
      now,
      excludePast,
      excludeFull,
      minScore,
      limit,
    ],
  )

  const ranked = useMemo(() => matches.map((match) => match.activity), [matches])

  return {
    matches,
    topMatch: matches[0] ?? null,
    ranked,
  }
}
