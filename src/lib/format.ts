/**
 * WoCow · Date + number formatting helpers
 * Owner: Person 1 (UI) — used by every card and detail view.
 */

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
})

/** "Sat, Mar 8, 3:00 PM" */
export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso))
}

/** "3:00 PM – 5:00 PM" */
export function formatTimeRange(startsAt: string, endsAt: string): string {
  return `${timeFormatter.format(new Date(startsAt))} – ${timeFormatter.format(new Date(endsAt))}`
}

/** "in 2h" / "in 3d" / "now" / "ended" — a compact countdown for cards. */
export function formatCountdown(startsAt: string, endsAt: string, now: Date = new Date()): string {
  const start = new Date(startsAt).getTime()
  const end = new Date(endsAt).getTime()
  const t = now.getTime()

  if (t >= end) return 'ended'
  if (t >= start) return 'happening now'

  const minutes = Math.round((start - t) / 60000)
  if (minutes < 60) return `in ${minutes}m`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `in ${hours}h`

  return `in ${Math.round(hours / 24)}d`
}

/** True once the activity's end time has passed. */
export function isPast(endsAt: string, now: Date = new Date()): boolean {
  return new Date(endsAt).getTime() < now.getTime()
}

/** True while the activity is running. */
export function isLive(startsAt: string, endsAt: string, now: Date = new Date()): boolean {
  const t = now.getTime()
  return t >= new Date(startsAt).getTime() && t < new Date(endsAt).getTime()
}

/**
 * Converts a `Date` or local datetime-local input value into the ISO string
 * Supabase expects. `<input type="datetime-local">` gives "2025-03-08T15:00",
 * which JS parses as *local* time — correct here, since the user typed their
 * own wall clock.
 */
export function toIsoString(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  return date.toISOString()
}

/** Rounds a datetime to the next 30 minutes, for form defaults. */
export function defaultStartTime(from: Date = new Date()): Date {
  const d = new Date(from)
  d.setMinutes(d.getMinutes() + 60 - (d.getMinutes() % 30), 0, 0)
  return d
}

/** Formats a Date for a `datetime-local` input's `value` attribute. */
export function toDateTimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

/** Great-circle distance in kilometres. Used by the Person 4 matching score. */
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}
