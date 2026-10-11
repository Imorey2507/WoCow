/**
 * WoCow · ActivityCard
 * Owner: Person 1 (UI)
 *
 * One activity, in one card. Used by the feed, the match list and "My
 * activities". Fully presentational: it never touches Supabase, it only
 * raises callbacks, which keeps it trivial to restyle or reuse.
 */
import type { ActivityFeedRow } from '../lib/types'
import { categoryEmoji, categoryLabel } from '../lib/types'
import { formatCountdown, formatDateTime, formatTimeRange, isLive } from '../lib/format'
import type { ScoredActivity } from '../features/matching/scoring'

export interface ActivityCardProps {
  activity: ActivityFeedRow
  /** The signed-in user's id, used for the "Hosting" badge. */
  currentUserId?: string | null
  /** Optional Person 4 match result, shown as a score badge + reasons. */
  match?: ScoredActivity | null
  /** Disables the buttons while a join/leave request is in flight. */
  busy?: boolean
  onJoin?: (activity: ActivityFeedRow) => void
  onLeave?: (activity: ActivityFeedRow) => void
  onSelect?: (activity: ActivityFeedRow) => void
  onDelete?: (activity: ActivityFeedRow) => void
}

export function ActivityCard({
  activity,
  currentUserId,
  match,
  busy = false,
  onJoin,
  onLeave,
  onSelect,
  onDelete,
}: ActivityCardProps) {
  const live = isLive(activity.starts_at, activity.ends_at)
  const isHost = Boolean(currentUserId && activity.host_id === currentUserId)
  const fillPercent = Math.min(
    100,
    Math.round((activity.participant_count / activity.max_participants) * 100),
  )
  const canJoin = !activity.is_joined && !activity.is_full

  return (
    <article
      className={`wocow-card${live ? ' wocow-card--live' : ''}${
        activity.is_joined ? ' wocow-card--joined' : ''
      }`}
    >
      <header className="wocow-card__head">
        <span className="wocow-card__emoji" aria-hidden="true">
          {categoryEmoji(activity.category)}
        </span>

        <div className="wocow-card__titles">
          <h3 className="wocow-card__title">{activity.title}</h3>
          <p className="wocow-card__sub">
            {categoryLabel(activity.category)} · {activity.location_name}
          </p>
        </div>

        {match && (
          <span
            className="wocow-card__score"
            title={match.reasons.join(' · ') || 'Match score'}
          >
            {match.score}%
          </span>
        )}
      </header>

      <div className="wocow-card__times">
        <span>{formatDateTime(activity.starts_at)}</span>
        <span aria-hidden="true">·</span>
        <span>{formatTimeRange(activity.starts_at, activity.ends_at)}</span>
        <span className={`wocow-card__countdown${live ? ' is-live' : ''}`}>
          {formatCountdown(activity.starts_at, activity.ends_at)}
        </span>
      </div>

      <div className="wocow-card__capacity">
        <div
          className="wocow-card__bar"
          role="progressbar"
          aria-valuenow={activity.participant_count}
          aria-valuemin={0}
          aria-valuemax={activity.max_participants}
          aria-label="Participants"
        >
          <span
            className={`wocow-card__bar-fill${activity.is_full ? ' is-full' : ''}`}
            style={{ width: `${fillPercent}%` }}
          />
        </div>
        <span className="wocow-card__count">
          {activity.participant_count}/{activity.max_participants} going
          {activity.is_full && !activity.is_joined ? ' · full' : ''}
        </span>
      </div>

      {activity.description && (
        <p className="wocow-card__desc">{activity.description}</p>
      )}

      {match && match.reasons.length > 0 && (
        <ul className="wocow-card__reasons">
          {match.reasons.slice(0, 3).map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}

      <footer className="wocow-card__actions">
        {activity.is_joined ? (
          <button
            type="button"
            className="wocow-btn wocow-btn--ghost"
            onClick={() => onLeave?.(activity)}
            disabled={busy}
          >
            {busy ? 'Leaving…' : 'Leave'}
          </button>
        ) : (
          <button
            type="button"
            className="wocow-btn wocow-btn--primary"
            onClick={() => onJoin?.(activity)}
            disabled={busy || !canJoin}
          >
            {busy ? 'Joining…' : activity.is_full ? 'Full' : 'Join'}
          </button>
        )}

        {onSelect && (
          <button
            type="button"
            className="wocow-btn wocow-btn--link"
            onClick={() => onSelect(activity)}
          >
            Details
          </button>
        )}

        <span className="wocow-card__spacer" />

        {isHost && <span className="wocow-badge">Hosting</span>}

        {isHost && onDelete && (
          <button
            type="button"
            className="wocow-btn wocow-btn--danger"
            onClick={() => onDelete(activity)}
            disabled={busy}
          >
            Cancel
          </button>
        )}
      </footer>
    </article>
  )
}

export default ActivityCard
