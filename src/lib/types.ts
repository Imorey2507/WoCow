/**
 * WoCow · Shared types
 * Owner: Person 3 (Data) — the contract every other module codes against.
 *
 * These mirror supabase/migrations/20250101000000_init_schema.sql and the
 * `activity_feed` view. If you change a column, change it in both places in
 * the same Pull Request.
 */

/** A row of `public.activities` exactly as stored. */
export interface Activity {
  id: string
  title: string
  description: string | null
  category: string
  location_name: string
  latitude: number
  longitude: number
  max_participants: number
  host_id: string
  /** ISO-8601 timestamp with timezone. */
  starts_at: string
  ends_at: string
  created_at: string
}

/**
 * A row of the `activity_feed` view: an Activity plus the three derived
 * fields. This is what nearly all UI code should consume, because
 * `participant_count` is computed by the database and can never drift.
 */
export interface ActivityFeedRow extends Activity {
  participant_count: number
  is_full: boolean
  is_joined: boolean
}

/** Payload for creating an activity. host_id is set from the auth session. */
export interface NewActivityInput {
  title: string
  description?: string | null
  category: string
  location_name: string
  latitude: number
  longitude: number
  max_participants: number
  starts_at: string
  ends_at: string
}

/** A row of `public.activity_participants`. */
export interface ActivityParticipant {
  activity_id: string
  user_id: string
  joined_at: string
}

/** Suggested categories. `category` is free text in the database. */
export const ACTIVITY_CATEGORIES = [
  { value: 'basketball', label: 'Basketball', emoji: '🏀' },
  { value: 'soccer', label: 'Soccer', emoji: '⚽' },
  { value: 'running', label: 'Running', emoji: '🏃' },
  { value: 'gym', label: 'Gym', emoji: '🏋️' },
  { value: 'study', label: 'Study', emoji: '📚' },
  { value: 'social', label: 'Social', emoji: '☕' },
  { value: 'music', label: 'Music', emoji: '🎷' },
  { value: 'gaming', label: 'Gaming', emoji: '🎮' },
  { value: 'food', label: 'Food', emoji: '🍜' },
  { value: 'outdoors', label: 'Outdoors', emoji: '🥾' },
] as const

export type ActivityCategoryValue = (typeof ACTIVITY_CATEGORIES)[number]['value']

/** Looks up the emoji for a category, falling back to a generic pin. */
export function categoryEmoji(category: string): string {
  return ACTIVITY_CATEGORIES.find((c) => c.value === category)?.emoji ?? '📍'
}

/** Looks up the pretty label for a category. */
export function categoryLabel(category: string): string {
  return ACTIVITY_CATEGORIES.find((c) => c.value === category)?.label ?? category
}

/** A user's stated preference, fed into the Person 4 matching algorithm. */
export interface UserPreferences {
  /** Categories the user likes, most preferred first. */
  interests: string[]
  /** Optional: the user's own position, used for a distance score. */
  latitude?: number
  longitude?: number
  /** How far the user is willing to travel, in kilometres. */
  maxDistanceKm?: number
}
