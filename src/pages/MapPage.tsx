/**
 * WoCow · MapPage
 * Owner: Person 2 (Map)
 *
 * Full-height map plus a side list. Tapping a card flies the map to that pin;
 * tapping a pin's Details selects the card. Keeps selection in one place so
 * the two views never disagree.
 */
import { useEffect, useMemo, useState } from 'react'
import { MapView } from '../features/map/MapView'
import { CAMPUS_CENTER, CAMPUS_LOCATIONS } from '../features/map/campusLocations'
import type { ActivityFeedRow } from '../lib/types'
import { categoryEmoji } from '../lib/types'
import { formatCountdown, formatTimeRange } from '../lib/format'

export interface MapPageProps {
  activities: ActivityFeedRow[]
  loading: boolean
  error: string | null
  currentUserId: string | null
  busyId: string | null
  /**
   * Set by App when another tab asks to "see on map". The page selects that
   * activity and flies to it. Keeping the selection here (rather than in App)
   * means the list and the map can never disagree.
   */
  focusActivity?: ActivityFeedRow | null
  onJoin: (activity: ActivityFeedRow) => void
  onLeave: (activity: ActivityFeedRow) => void
}

export function MapPage({
  activities,
  loading,
  error,
  currentUserId,
  busyId,
  focusActivity = null,
  onJoin,
  onLeave,
}: MapPageProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [focus, setFocus] = useState<[number, number]>([
    CAMPUS_CENTER.latitude,
    CAMPUS_CENTER.longitude,
  ])

  // Honour an externally requested focus ("Details" from another tab).
  useEffect(() => {
    if (!focusActivity) return
    setSelectedId(focusActivity.id)
    setFocus([focusActivity.latitude, focusActivity.longitude])
  }, [focusActivity])

  const selected = useMemo(
    () => activities.find((activity) => activity.id === selectedId) ?? null,
    [activities, selectedId],
  )

  const goToActivity = (activity: ActivityFeedRow) => {
    setSelectedId(activity.id)
    setFocus([activity.latitude, activity.longitude])
  }

  const goToLocation = (latitude: number, longitude: number) => {
    setFocus([latitude, longitude])
  }

  return (
    <div className="wocow-map-page">
      <div className="wocow-map-page__map">
        <MapView
          activities={activities}
          center={focus}
          highlightId={selectedId}
          onSelect={goToActivity}
        />

        <div className="wocow-map-page__overlay">
          <select
            className="wocow-input wocow-input--sm"
            value=""
            onChange={(event) => {
              const location = CAMPUS_LOCATIONS.find((item) => item.id === event.target.value)
              if (location) goToLocation(location.latitude, location.longitude)
            }}
            aria-label="Jump to a campus location"
          >
            <option value="">Jump to…</option>
            {CAMPUS_LOCATIONS.map((location) => (
              <option key={location.id} value={location.id}>
                {location.emoji} {location.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <aside className="wocow-map-page__side">
        {selected && (
          <div className="wocow-map-page__selected">
            <h3>
              {categoryEmoji(selected.category)} {selected.title}
            </h3>
            <p className="wocow-card__sub">{selected.location_name}</p>
            <p className="wocow-card__times">
              {formatTimeRange(selected.starts_at, selected.ends_at)} ·{' '}
              {formatCountdown(selected.starts_at, selected.ends_at)}
            </p>
            <p className="wocow-card__count">
              {selected.participant_count}/{selected.max_participants} going
            </p>
            <div className="wocow-card__actions">
              {selected.is_joined ? (
                <button
                  type="button"
                  className="wocow-btn wocow-btn--ghost wocow-btn--sm"
                  onClick={() => onLeave(selected)}
                  disabled={busyId === selected.id}
                >
                  Leave
                </button>
              ) : (
                <button
                  type="button"
                  className="wocow-btn wocow-btn--primary wocow-btn--sm"
                  onClick={() => onJoin(selected)}
                  disabled={busyId === selected.id || selected.is_full}
                >
                  {selected.is_full ? 'Full' : 'Join'}
                </button>
              )}
              <a
                className="wocow-btn wocow-btn--link wocow-btn--sm"
                href={`https://www.google.com/maps/search/?api=1&query=${selected.latitude},${selected.longitude}`}
                target="_blank"
                rel="noreferrer"
              >
                Directions
              </a>
            </div>
          </div>
        )}

        <h3 className="wocow-map-page__heading">
          {loading ? 'Loading…' : `${activities.length} on the map`}
        </h3>

        {error && <p className="wocow-alert wocow-alert--error">{error}</p>}

        <ul className="wocow-map-page__list">
          {activities.map((activity) => (
            <li key={activity.id}>
              <button
                type="button"
                className={`wocow-map-item${
                  activity.id === selectedId ? ' is-active' : ''
                }`}
                onClick={() => goToActivity(activity)}
              >
                <span className="wocow-map-item__emoji" aria-hidden="true">
                  {categoryEmoji(activity.category)}
                </span>
                <span className="wocow-map-item__body">
                  <span className="wocow-map-item__title">{activity.title}</span>
                  <span className="wocow-map-item__meta">
                    {activity.location_name} · {activity.participant_count}/
                    {activity.max_participants}
                  </span>
                </span>
                {currentUserId === activity.host_id && (
                  <span className="wocow-badge wocow-badge--sm">Host</span>
                )}
              </button>
            </li>
          ))}
        </ul>

        {!loading && activities.length === 0 && !error && (
          <p className="wocow-hint">No activities to show on the map yet.</p>
        )}
      </aside>
    </div>
  )
}

export default MapPage
