/**
 * WoCow · usePreferences hook
 * Owner: Person 4 (Match)
 *
 * Persists the user's interests and travel radius to localStorage so the
 * matching feed survives a refresh. This is intentionally client-side only:
 * for the MVP we do not want a third table and another set of RLS policies.
 *
 * UPGRADE PATH: move this to a `public.user_preferences` table keyed by
 * auth.users(id) once the core flow is stable.
 */
import { useCallback, useEffect, useState } from 'react'
import { isValidPosition } from './scoring'
import type { UserPreferences } from '../../lib/types'

const STORAGE_KEY = 'wocow.preferences.v1'

const DEFAULT_PREFERENCES: UserPreferences = {
  interests: [],
  maxDistanceKm: 5,
}

export function normalizePreferences(value: unknown): UserPreferences {
  const parsed = value && typeof value === 'object' ? value as Partial<UserPreferences> : {}
  const interests = Array.isArray(parsed.interests)
    ? [...new Set(parsed.interests.filter((item): item is string =>
        typeof item === 'string' && item.trim().length > 0))] : []
  const validPosition = isValidPosition(parsed.latitude, parsed.longitude)
  return {
    interests,
    maxDistanceKm: typeof parsed.maxDistanceKm === 'number' && Number.isFinite(parsed.maxDistanceKm)
      ? Math.min(25, Math.max(0.5, parsed.maxDistanceKm)) : 5,
    ...(validPosition ? { latitude: parsed.latitude, longitude: parsed.longitude } : {}),
  }
}

function readStored(): UserPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PREFERENCES
    return normalizePreferences(JSON.parse(raw))
  } catch {
    // Corrupt or unreadable storage should never break the app.
    return DEFAULT_PREFERENCES
  }
}

export interface UsePreferencesResult {
  preferences: UserPreferences
  /** Add or remove a category from the interest list. */
  toggleInterest: (category: string) => void
  setMaxDistanceKm: (km: number) => void
  /** Store the user's position so distance scoring can kick in. */
  setPosition: (latitude: number, longitude: number) => void
  /**
   * Ask the browser for the user's position. Resolves to null when the user
   * declines or geolocation is unavailable — never rejects.
   */
  requestGeolocation: () => Promise<{ latitude: number; longitude: number } | null>
  reset: () => void
}

export function usePreferences(): UsePreferencesResult {
  const [preferences, setPreferences] = useState<UserPreferences>(readStored)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
    } catch {
      // Private browsing / quota exceeded: preferences simply do not persist.
    }
  }, [preferences])

  const toggleInterest = useCallback((category: string) => {
    setPreferences((current) => {
      const has = current.interests.includes(category)
      return {
        ...current,
        interests: has
          ? current.interests.filter((item) => item !== category)
          : [...current.interests, category],
      }
    })
  }, [])

  const setMaxDistanceKm = useCallback((km: number) => {
    setPreferences((current) => normalizePreferences({ ...current, maxDistanceKm: km }))
  }, [])

  const setPosition = useCallback((latitude: number, longitude: number) => {
    if (!isValidPosition(latitude, longitude)) return
    setPreferences((current) => ({ ...current, latitude, longitude }))
  }, [])

  const requestGeolocation = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return null

    return new Promise<{ latitude: number; longitude: number } | null>((resolve) => {
      try {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const coords = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            }
            if (!isValidPosition(coords.latitude, coords.longitude)) {
              resolve(null)
              return
            }
            setPosition(coords.latitude, coords.longitude)
            resolve(coords)
          },
          () => resolve(null),
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 },
        )
      } catch {
        resolve(null)
      }
    })
  }, [setPosition])

  const reset = useCallback(() => setPreferences(DEFAULT_PREFERENCES), [])

  return {
    preferences,
    toggleInterest,
    setMaxDistanceKm,
    setPosition,
    requestGeolocation,
    reset,
  }
}
