import { describe, expect, it } from 'vitest'
import { normalizePreferences } from './usePreferences'

describe('persisted preferences', () => {
  it('recovers defaults from null and malformed fields', () => {
    expect(normalizePreferences(null)).toEqual({ interests: [], maxDistanceKm: 5 })
    expect(normalizePreferences({ interests: 'study', maxDistanceKm: NaN })).toEqual({ interests: [], maxDistanceKm: 5 })
  })
  it('keeps ordered, unique, nonempty string interests, including custom categories', () => {
    expect(normalizePreferences({ interests: ['study', null, 42, '', ' ', 'study', 'custom'] }).interests)
      .toEqual(['study', 'custom'])
  })
  it('accepts coordinates only as a valid pair', () => {
    for (const value of [{ latitude: 38 }, { latitude: 91, longitude: 0 }, { latitude: 0, longitude: Infinity }]) {
      expect(normalizePreferences(value).latitude).toBeUndefined()
      expect(normalizePreferences(value).longitude).toBeUndefined()
    }
    expect(normalizePreferences({ latitude: 0, longitude: 0 })).toMatchObject({ latitude: 0, longitude: 0 })
  })
  it('keeps the travel radius within the supported range', () => {
    expect(normalizePreferences({ maxDistanceKm: -1 }).maxDistanceKm).toBe(0.5)
    expect(normalizePreferences({ maxDistanceKm: 100 }).maxDistanceKm).toBe(25)
  })
})
