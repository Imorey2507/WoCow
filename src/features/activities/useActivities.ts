/**
 * WoCow · useActivities hook
 * Owner: Person 3 (Data)
 *
 * Loads the feed, keeps it live via Supabase Realtime, and patches single
 * rows in place so a join/leave feels instant instead of waiting on a refetch.
 *
 * Bursts of realtime events are coalesced with a short debounce: a room of
 * 20 people joining at once triggers one refresh, not twenty.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { getActivities, type ActivityFilters } from './api'
import { subscribeToActivityChanges, type RealtimeStatus } from './realtime'
import type { ActivityFeedRow } from '../../lib/types'
import { isSupabaseConfigured } from '../../lib/supabase'

const REFRESH_DEBOUNCE_MS = 250

export interface UseActivitiesResult {
  activities: ActivityFeedRow[]
  loading: boolean
  error: string | null
  /** Websocket state, surfaced as a "live" dot in the header. */
  realtimeStatus: RealtimeStatus
  lastSyncedAt: Date | null
  /** Force a refetch. Pass true to skip the loading spinner. */
  refresh: (silent?: boolean) => Promise<void>
  /** Splice a freshly returned row into the list without a refetch. */
  upsertActivity: (row: ActivityFeedRow) => void
}

export function useActivities(filters: ActivityFilters = {}): UseActivitiesResult {
  const [activities, setActivities] = useState<ActivityFeedRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('CLOSED')
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)

  // Hold the newest filters in a ref so `refresh` stays referentially stable
  // and does not tear down the realtime channel on every render.
  const filtersRef = useRef(filters)
  filtersRef.current = filters

  // Serialised so the effect below re-runs on a real filter change only.
  const filtersKey = JSON.stringify(filters)

  const refresh = useCallback(async (silent = false) => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    if (!silent) setLoading(true)

    try {
      const rows = await getActivities(filtersRef.current)
      setActivities(rows)
      setError(null)
      setLastSyncedAt(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load activities.')
    } finally {
      setLoading(false)
    }
  }, [])

  const upsertActivity = useCallback((row: ActivityFeedRow) => {
    setActivities((current) => {
      const index = current.findIndex((item) => item.id === row.id)
      if (index === -1) return current
      const next = [...current]
      next[index] = row
      return next
    })
  }, [])

  // Initial load, and reload whenever the filters change.
  useEffect(() => {
    void refresh()
    // filtersKey is the intended trigger; `filters` itself is read via ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh, filtersKey])

  // Realtime: one channel for the lifetime of the component.
  useEffect(() => {
    if (!isSupabaseConfigured) return

    let timer: ReturnType<typeof setTimeout> | null = null

    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        void refresh(true)
      }, REFRESH_DEBOUNCE_MS)
    }

    const unsubscribe = subscribeToActivityChanges({
      onParticipantsChanged: scheduleRefresh,
      onActivitiesChanged: scheduleRefresh,
      onStatus: setRealtimeStatus,
    })

    return () => {
      if (timer) clearTimeout(timer)
      unsubscribe()
    }
  }, [refresh])

  return {
    activities,
    loading,
    error,
    realtimeStatus,
    lastSyncedAt,
    refresh,
    upsertActivity,
  }
}
