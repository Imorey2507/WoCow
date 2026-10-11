/**
 * WoCow · Campus locations
 * Owner: Person 2 (Map)
 *
 * A small gazetteer of UC Davis spots. Used to:
 *   - centre the map on first load
 *   - offer one-tap location choices when hosting an activity
 *   - snap a dropped pin to the nearest named place
 *
 * Add your own campus here — it is just data.
 */

export type LocationKind =
  | 'sports'
  | 'study'
  | 'food'
  | 'social'
  | 'outdoors'
  | 'arts'

export interface CampusLocation {
  id: string
  name: string
  latitude: number
  longitude: number
  kind: LocationKind
  emoji: string
}

/** Roughly the Memorial Union — the middle of campus. */
export const CAMPUS_CENTER = { latitude: 38.5418, longitude: -121.7503 }

export const CAMPUS_LOCATIONS: CampusLocation[] = [
  { id: 'arc',        name: 'UC Davis ARC',            latitude: 38.5437, longitude: -121.7565, kind: 'sports',   emoji: '🏋️' },
  { id: 'hutchison',  name: 'Hutchison Field',          latitude: 38.5395, longitude: -121.7555, kind: 'sports',   emoji: '⚽' },
  { id: 'shields',    name: 'Shields Library',          latitude: 38.5401, longitude: -121.7490, kind: 'study',    emoji: '📚' },
  { id: 'coho',       name: 'Davis CoHo',               latitude: 38.5421, longitude: -121.7495, kind: 'food',     emoji: '☕' },
  { id: 'quad',       name: 'Main Quad',                latitude: 38.5418, longitude: -121.7510, kind: 'outdoors', emoji: '🌳' },
  { id: 'arboretum',  name: 'UC Davis Arboretum',       latitude: 38.5360, longitude: -121.7530, kind: 'outdoors', emoji: '🥾' },
  { id: 'mondavi',    name: 'Mondavi Center',           latitude: 38.5350, longitude: -121.7480, kind: 'arts',     emoji: '🎭' },
  { id: 'silo',       name: 'The Silo',                 latitude: 38.5390, longitude: -121.7520, kind: 'food',     emoji: '🍜' },
  { id: 'wellman',    name: 'Wellman Hall',             latitude: 38.5405, longitude: -121.7510, kind: 'study',    emoji: '🏛️' },
  { id: 'tercero',    name: 'Tercero Housing',          latitude: 38.5352, longitude: -121.7570, kind: 'social',   emoji: '🏠' },
  { id: 'cuarto',     name: 'Cuarto Housing',           latitude: 38.5470, longitude: -121.7620, kind: 'social',   emoji: '🏠' },
  { id: 'downtown',   name: 'Downtown Davis',           latitude: 38.5449, longitude: -121.7405, kind: 'social',   emoji: '🎷' },
]

/** Great-circle kilometres between two coordinates. */
function kmBetween(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const R = 6371
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLon = toRad(bLon - aLon)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/**
 * Nearest named campus spot to a dropped pin.
 * @param withinKm only snap when the pin is this close; otherwise null.
 */
export function nearestCampusLocation(
  latitude: number,
  longitude: number,
  withinKm = 0.35,
): CampusLocation | null {
  let best: CampusLocation | null = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (const location of CAMPUS_LOCATIONS) {
    const distance = kmBetween(latitude, longitude, location.latitude, location.longitude)
    if (distance < bestDistance) {
      bestDistance = distance
      best = location
    }
  }

  return best && bestDistance <= withinKm ? best : null
}

/** URL for a static OpenStreetMap tile, handy for share previews. */
export function staticTileUrl(latitude: number, longitude: number, zoom = 16): string {
  const n = 2 ** zoom
  const x = Math.floor(((longitude + 180) / 360) * n)
  const latRad = (latitude * Math.PI) / 180
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  )
  return `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`
}

/** Google Maps directions link — opens the native app on a phone. */
export function directionsUrl(
  latitude: number,
  longitude: number,
  label?: string,
): string {
  const query = label
    ? `${encodeURIComponent(label)}@${latitude},${longitude}`
    : `${latitude},${longitude}`
  return `https://www.google.com/maps/search/?api=1&query=${query}`
}
