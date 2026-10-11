/**
 * WoCow · ActivityList
 * Owner: Person 1 (UI)
 *
 * Renders a collection of cards, plus the loading / empty / error states so
 * every page does not have to reinvent them.
 */
import type { ReactNode } from 'react'
import type { ActivityFeedRow } from '../lib/types'
import type { ScoredActivity } from '../features/matching/scoring'
import { ActivityCard } from './ActivityCard'

export interface ActivityListProps {
  activities: ActivityFeedRow[]
  /** Optional map of activity id -> match result, from Person 4. */
  matches?: Map<string, ScoredActivity>
  currentUserId?: string | null
  loading?: boolean
  error?: string | null
  busyId?: string | null
  emptyTitle?: string
  emptyHint?: string
  emptyAction?: ReactNode
  onJoin?: (activity: ActivityFeedRow) => void
  onLeave?: (activity: ActivityFeedRow) => void
  onSelect?: (activity: ActivityFeedRow) => void
  onDelete?: (activity: ActivityFeedRow) => void
}

export function ActivityList({
  activities,
  matches,
  currentUserId,
  loading = false,
  error = null,
  busyId = null,
  emptyTitle = 'Nothing here yet',
  emptyHint = 'Be the first to host something on campus.',
  emptyAction,
  onJoin,
  onLeave,
  onSelect,
  onDelete,
}: ActivityListProps) {
  if (error) {
    return (
      <div className="wocow-state wocow-state--error" role="alert">
        <strong>Something went wrong</strong>
        <p>{error}</p>
      </div>
    )
  }

  if (loading && activities.length === 0) {
    return (
      <div className="wocow-state" aria-busy="true">
        <div className="wocow-skeleton" />
        <div className="wocow-skeleton" />
        <div className="wocow-skeleton" />
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="wocow-state">
        <strong>{emptyTitle}</strong>
        <p>{emptyHint}</p>
        {emptyAction}
      </div>
    )
  }

  return (
    <div className="wocow-list">
      {activities.map((activity) => (
        <ActivityCard
          key={activity.id}
          activity={activity}
          currentUserId={currentUserId}
          match={matches?.get(activity.id) ?? null}
          busy={busyId === activity.id}
          onJoin={onJoin}
          onLeave={onLeave}
          onSelect={onSelect}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}

export default ActivityList
