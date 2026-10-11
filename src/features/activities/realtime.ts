/**
 * WoCow · Realtime subscriptions
 * Owner: Person 3 (Data)
 *
 * Pushes a "something changed" signal whenever anyone anywhere joins, leaves,
 * creates, edits or cancels an activity. Listeners then re-read the feed, so
 * the client never has to guess at incremental state.
 *
 * ALWAYS use the returned unsubscribe function in a useEffect cleanup —
 * otherwise every remount leaks a websocket channel and Supabase starts
 * rate-limiting the project.
 */
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import type { Activity, ActivityParticipant } from '../../lib/types'

export type ParticipantsPayload = RealtimePostgresChangesPayload<ActivityParticipant>
export type ActivitiesPayload = RealtimePostgresChangesPayload<Activity>

export type RealtimeStatus =
  | 'SUBSCRIBED'
  | 'TIMED_OUT'
  | 'CLOSED'
  | 'CHANNEL_ERROR'

export interface ActivityRealtimeHandlers {
  /** Someone joined or left — a head-count changed. */
  onParticipantsChanged?: (payload: ParticipantsPayload) => void
  /** An activity was created, edited or deleted. */
  onActivitiesChanged?: (payload: ActivitiesPayload) => void
  /** Connection lifecycle, handy for a "live" indicator in the header. */
  onStatus?: (status: RealtimeStatus) => void
}

/**
 * Subscribes to activity + participant changes.
 * @returns an unsubscribe function — call it on unmount.
 */
export function subscribeToActivityChanges(
  handlers: ActivityRealtimeHandlers,
): () => void {
  const channel: RealtimeChannel = supabase
    .channel('wocow-activity-updates')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'activity_participants' },
      (payload) => handlers.onParticipantsChanged?.(payload as ParticipantsPayload),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'activities' },
      (payload) => handlers.onActivitiesChanged?.(payload as ActivitiesPayload),
    )
    .subscribe((status) => handlers.onStatus?.(status as RealtimeStatus))

  return () => {
    void supabase.removeChannel(channel)
  }
}
