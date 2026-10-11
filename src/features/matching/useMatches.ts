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
import { useEffect, useMemo, useState } from 'react'
import type { ActivityFeedRow, UserPreferences } from '../../lib/types'
import { matchActivities, type MatchOptions } from './matchActivities'
import type { ScoredActivity } from './scoring'

export interface UseMatchesResult {
  matches: ScoredActivity[]
  /** Active, joinable recommendations even when Discover includes past/full rows. */
  recommendations: ScoredActivity[]
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
  const interestsKey = JSON.stringify(preferences.interests)
  const [clock, setClock] = useState(() => new Date())
  useEffect(() => {
    if (now !== undefined) return
    const refresh = () => setClock(new Date())
    refresh()
    const timer = setInterval(refresh, 30_000)
    window.addEventListener('focus', refresh)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [now])
  const effectiveNow = now ?? clock

  const matches = useMemo(
    () =>
      matchActivities(activities, preferences, {
        now: effectiveNow,
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
      effectiveNow,
      excludePast,
      excludeFull,
      minScore,
      limit,
    ],
  )

  const recommendations = useMemo(
    () => matches.filter(({ activity }) =>
      new Date(activity.ends_at).getTime() > effectiveNow.getTime() &&
      (!activity.is_full || activity.is_joined)),
    [matches, effectiveNow],
  )

  const ranked = useMemo(() => matches.map((match) => match.activity), [matches])

  return {
    matches,
    recommendations,
    topMatch: matches[0] ?? null,
    ranked,
  }
}
