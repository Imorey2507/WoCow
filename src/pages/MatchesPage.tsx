/**
 * WoCow · MatchesPage
 * Owner: Person 4 (Match) — the visible payoff of the scoring module.
 *
 * Shows the ranked "for you" list plus the preference controls that shape it.
 * The ranking itself is done by useMatches/matchActivities; this file only
 * renders the result.
 */
import { ActivityList } from '../components/ActivityList'
import { PreferencesPanel } from '../components/PreferencesPanel'
import type { ActivityFeedRow } from '../lib/types'
import type { ScoredActivity } from '../features/matching/scoring'

export interface MatchesPageProps {
  allActivities: ActivityFeedRow[]
  matches: ScoredActivity[]
  loading: boolean
  error: string | null
  currentUserId: string | null
  busyId: string | null

  interests: string[]
  onToggleInterest: (category: string) => void
  maxDistanceKm: number
  onMaxDistanceChange: (km: number) => void
  hasPosition: boolean
  onUseMyLocation: () => void
  locating: boolean

  onJoin: (activity: ActivityFeedRow) => void
  onLeave: (activity: ActivityFeedRow) => void
  onSelect: (activity: ActivityFeedRow) => void
  onDelete: (activity: ActivityFeedRow) => void
  onHostClick: () => void
}

export function MatchesPage({
  allActivities,
  matches,
  loading,
  error,
  currentUserId,
  busyId,
  interests,
  onToggleInterest,
  maxDistanceKm,
  onMaxDistanceChange,
  hasPosition,
  onUseMyLocation,
  locating,
  onJoin,
  onLeave,
  onSelect,
  onDelete,
  onHostClick,
}: MatchesPageProps) {
  const matchMap = new Map(matches.map((match) => [match.activity.id, match]))
  const noPreferences = interests.length === 0

  return (
    <>
      <PreferencesPanel
        interests={interests}
        onToggleInterest={onToggleInterest}
        maxDistanceKm={maxDistanceKm}
        onMaxDistanceChange={onMaxDistanceChange}
        hasPosition={hasPosition}
        onUseMyLocation={onUseMyLocation}
        locating={locating}
      />

      {noPreferences && (
        <p className="wocow-hint wocow-hint--center">
          Pick a few interests above and this list re-ranks instantly. Showing
          everything for now.
        </p>
      )}

      <ActivityList
        activities={matches.map((match) => match.activity)}
        matches={matchMap}
        currentUserId={currentUserId}
        loading={loading}
        error={error}
        busyId={busyId}
        emptyTitle={
          allActivities.length === 0
            ? 'Nothing to match against yet'
            : 'No good matches right now'
        }
        emptyHint={
          allActivities.length === 0
            ? 'Once people host activities, your matches appear here.'
            : 'Widen your travel distance, add interests, or host something yourself.'
        }
        emptyAction={
          <button
            type="button"
            className="wocow-btn wocow-btn--primary"
            onClick={onHostClick}
          >
            + Host an activity
          </button>
        }
        onJoin={onJoin}
        onLeave={onLeave}
        onSelect={onSelect}
        onDelete={onDelete}
      />
    </>
  )
}

export default MatchesPage
