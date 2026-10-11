/**
 * WoCow · MyActivitiesPage
 * Owner: Person 1 (UI)
 *
 * Two lists: what you are hosting, and what you joined. Both are derived from
 * the same live feed, so a realtime update moves an activity between the two
 * lists without a refetch.
 */
import { useMemo } from 'react'
import { ActivityList } from '../components/ActivityList'
import type { ActivityFeedRow } from '../lib/types'

export interface MyActivitiesPageProps {
  activities: ActivityFeedRow[]
  loading: boolean
  error: string | null
  currentUserId: string | null
  busyId: string | null
  signedIn: boolean
  onJoin: (activity: ActivityFeedRow) => void
  onLeave: (activity: ActivityFeedRow) => void
  onSelect: (activity: ActivityFeedRow) => void
  onDelete: (activity: ActivityFeedRow) => void
  onHostClick: () => void
  onSignInClick: () => void
}

export function MyActivitiesPage({
  activities,
  loading,
  error,
  currentUserId,
  busyId,
  signedIn,
  onJoin,
  onLeave,
  onSelect,
  onDelete,
  onHostClick,
  onSignInClick,
}: MyActivitiesPageProps) {
  const { hosting, joined } = useMemo(() => {
    if (!currentUserId) return { hosting: [], joined: [] }
    return {
      hosting: activities.filter((activity) => activity.host_id === currentUserId),
      joined: activities.filter(
        (activity) => activity.is_joined && activity.host_id !== currentUserId,
      ),
    }
  }, [activities, currentUserId])

  if (!signedIn) {
    return (
      <div className="wocow-state">
        <strong>Sign in to track your plans</strong>
        <p>Your hosted and joined activities live here once you have an account.</p>
        <button
          type="button"
          className="wocow-btn wocow-btn--primary"
          onClick={onSignInClick}
        >
          Sign in
        </button>
      </div>
    )
  }

  return (
    <>
      <section className="wocow-section">
        <h2 className="wocow-section__title">You are hosting ({hosting.length})</h2>
        <ActivityList
          activities={hosting}
          currentUserId={currentUserId}
          loading={loading}
          error={error}
          busyId={busyId}
          emptyTitle="You are not hosting anything yet"
          emptyHint="Hosting is the fastest way to get people together."
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
      </section>

      <section className="wocow-section">
        <h2 className="wocow-section__title">You are going ({joined.length})</h2>
        <ActivityList
          activities={joined}
          currentUserId={currentUserId}
          loading={loading}
          busyId={busyId}
          emptyTitle="No plans yet"
          emptyHint="Join an activity from Discover and it shows up here."
          onJoin={onJoin}
          onLeave={onLeave}
          onSelect={onSelect}
          onDelete={onDelete}
        />
      </section>
    </>
  )
}

export default MyActivitiesPage
