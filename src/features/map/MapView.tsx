/**
 * WoCow · MapView
 * Owner: Person 2 (Map)
 *
 * An OpenStreetMap-backed map of every activity, with emoji pins per category.
 * Deliberately dependency-light: Leaflet + react-leaflet, no API key, no
 * billing account — important for a hackathon.
 *
 * WHY divIcon INSTEAD OF THE DEFAULT MARKER
 * -----------------------------------------
 * Leaflet's default marker loads PNGs by relative URL, which breaks under
 * Vite's bundler (the classic "broken marker image" bug). Rendering a styled
 * <span> with a category emoji sidesteps it entirely and looks better.
 */
import { useEffect } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

import type { ActivityFeedRow } from '../../lib/types'
import { categoryEmoji } from '../../lib/types'
import { formatCountdown, formatTimeRange } from '../../lib/format'
import { CAMPUS_CENTER } from './campusLocations'

export interface MapViewProps {
  activities: ActivityFeedRow[]
  /** [latitude, longitude]. Defaults to the campus centre. */
  center?: [number, number]
  zoom?: number
  /** Draws the highlighted pin larger. */
  highlightId?: string | null
  /** Called when the user clicks "Details" inside a popup. */
  onSelect?: (activity: ActivityFeedRow) => void
  className?: string
}

const DEFAULT_ZOOM = 15

// divIcon instances are cheap but recreated on every render otherwise, which
// makes Leaflet rebuild the DOM for each pin.
const iconCache = new Map<string, L.DivIcon>()

function pinIcon(emoji: string, highlight: boolean, full: boolean): L.DivIcon {
  const key = `${emoji}:${highlight}:${full}`
  const cached = iconCache.get(key)
  if (cached) return cached

  const classes = [
    'wocow-pin',
    highlight ? 'wocow-pin--active' : '',
    full ? 'wocow-pin--full' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const icon = L.divIcon({
    className: 'wocow-marker',
    html: `<span class="${classes}">${emoji}</span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -32],
  })

  iconCache.set(key, icon)
  return icon
}

/** Re-centres the map when the `center` prop changes (e.g. "near me"). */
function MapFocus({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap()

  useEffect(() => {
    map.setView(center, zoom, { animate: true })
    // Depend on the primitives, not the array identity, so a new array with
    // the same coordinates does not cause a needless camera move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center[0], center[1], zoom, map])

  return null
}

/** Leaflet measures its container once; a flex/async layout can change it. */
function ResizeFix() {
  const map = useMap()

  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 200)
    return () => clearTimeout(timer)
  }, [map])

  return null
}

export function MapView({
  activities,
  center,
  zoom = DEFAULT_ZOOM,
  highlightId = null,
  onSelect,
  className,
}: MapViewProps) {
  const mapCenter: [number, number] = center ?? [
    CAMPUS_CENTER.latitude,
    CAMPUS_CENTER.longitude,
  ]

  return (
    <div className={className ?? 'wocow-map'}>
      <MapContainer
        center={mapCenter}
        zoom={zoom}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          // OpenStreetMap's public tiles. Fine for a hackathon demo; swap in a
          // keyed provider (MapTiler, Stadia) before any real traffic, and
          // respect the tile usage policy either way.
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
        />

        <MapFocus center={mapCenter} zoom={zoom} />
        <ResizeFix />

        {activities.map((activity) => (
          <Marker
            key={activity.id}
            position={[activity.latitude, activity.longitude]}
            icon={pinIcon(
              categoryEmoji(activity.category),
              activity.id === highlightId,
              activity.is_full && !activity.is_joined,
            )}
          >
            <Popup>
              <div className="wocow-popup">
                <strong className="wocow-popup__title">{activity.title}</strong>
                <span className="wocow-popup__meta">{activity.location_name}</span>
                <span className="wocow-popup__meta">
                  {formatTimeRange(activity.starts_at, activity.ends_at)}
                </span>
                <span className="wocow-popup__meta">
                  {activity.participant_count}/{activity.max_participants} going ·{' '}
                  {formatCountdown(activity.starts_at, activity.ends_at)}
                </span>
                {onSelect && (
                  <button
                    type="button"
                    className="wocow-popup__button"
                    onClick={() => onSelect(activity)}
                  >
                    {activity.is_joined ? 'You are going — details' : 'View details'}
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}

export default MapView
