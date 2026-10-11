/**
 * WoCow · Matching tests
 * Owner: Person 4 (Match)
 *
 * Run with `pnpm test`. These are pure-function tests: no network, no
 * Supabase, no mocking. If the algorithm changes, these must still pass —
 * and if the intended behaviour changes, update the test in the same PR.
 */
import { describe, expect, it } from 'vitest'
import {
  distanceScore,
  interestScore,
  scoreActivity,
  spaceScore,
  timingScore,
} from './scoring'
import { matchActivities, recommendSimilar, similarityBetween } from './matchActivities'
import type { ActivityFeedRow, UserPreferences } from '../../lib/types'

const NOW = new Date('2025-03-08T12:00:00.000Z')

function makeActivity(overrides: Partial<ActivityFeedRow> = {}): ActivityFeedRow {
  return {
    id: overrides.id ?? 'a1',
    title: 'Basketball at the ARC',
    description: null,
    category: 'basketball',
    location_name: 'UC Davis ARC',
    latitude: 38.5437,
    longitude: -121.7565,
    max_participants: 10,
    host_id: 'host-1',
    starts_at: '2025-03-08T15:00:00.000Z',
    ends_at: '2025-03-08T17:00:00.000Z',
    created_at: '2025-03-01T00:00:00.000Z',
    participant_count: 5,
    is_full: false,
    is_joined: false,
    ...overrides,
  }
}

const basePrefs: UserPreferences = { interests: ['basketball', 'study'] }

describe('interestScore', () => {
  it('gives a perfect score to the top interest', () => {
    expect(interestScore('basketball', ['basketball', 'study'])).toBe(1)
  })

  it('scores a lower-ranked interest below the top one but above zero', () => {
    const second = interestScore('study', ['basketball', 'study'])
    expect(second).toBeGreaterThan(0)
    expect(second).toBeLessThan(1)
  })

  it('scores an unpicked category at zero', () => {
    expect(interestScore('gaming', ['basketball', 'study'])).toBe(0)
  })

  it('is neutral when the user has stated no interests', () => {
    expect(interestScore('anything', [])).toBe(0.5)
  })
})

describe('timingScore', () => {
  it('is zero once the activity has ended', () => {
    expect(timingScore('2025-03-08T08:00:00Z', '2025-03-08T10:00:00Z', NOW)).toBe(0)
  })

  it('is high for an activity currently running', () => {
    expect(timingScore('2025-03-08T11:00:00Z', '2025-03-08T14:00:00Z', NOW)).toBe(0.9)
  })

  it('is maximal for something starting within half an hour', () => {
    expect(timingScore('2025-03-08T12:10:00Z', '2025-03-08T13:00:00Z', NOW)).toBe(1)
  })

  it('decays as the start moves further out', () => {
    const soon = timingScore('2025-03-08T18:00:00Z', '2025-03-08T20:00:00Z', NOW)
    const later = timingScore('2025-03-11T18:00:00Z', '2025-03-11T20:00:00Z', NOW)
    expect(soon).toBeGreaterThan(later)
    expect(later).toBeGreaterThan(0)
  })
})

describe('distanceScore', () => {
  it('is neutral when the user position is unknown', () => {
    expect(distanceScore(null, 5)).toBe(0.5)
  })

  it('is 1 at zero distance and 0 beyond the travel limit', () => {
    expect(distanceScore(0, 5)).toBe(1)
    expect(distanceScore(5, 5)).toBe(0)
    expect(distanceScore(12, 5)).toBe(0)
  })
})

describe('spaceScore', () => {
  it('is 1 for an activity the user already joined', () => {
    expect(spaceScore(makeActivity({ is_full: true, is_joined: true }))).toBe(1)
  })

  it('is 0 for a full activity the user has not joined', () => {
    expect(spaceScore(makeActivity({ is_full: true, participant_count: 10 }))).toBe(0)
  })

  it('prefers a partly-filled activity over an empty one', () => {
    const empty = spaceScore(makeActivity({ participant_count: 0 }))
    const busy = spaceScore(makeActivity({ participant_count: 7 }))
    expect(busy).toBeGreaterThan(empty)
  })
})

describe('scoreActivity', () => {
  it('returns a 0..100 score with a full breakdown', () => {
    const result = scoreActivity(makeActivity(), basePrefs, NOW)
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
    expect(Object.keys(result.breakdown).sort()).toEqual([
      'distance',
      'interest',
      'space',
      'timing',
    ])
  })

  it('explains itself with human-readable reasons', () => {
    const result = scoreActivity(makeActivity(), basePrefs, NOW)
    expect(result.reasons).toContain('Matches your top interest')
  })

  it('computes distance when the user shares a position', () => {
    const result = scoreActivity(
      makeActivity(),
      { ...basePrefs, latitude: 38.5437, longitude: -121.7565 },
      NOW,
    )
    expect(result.distanceKm).toBeCloseTo(0, 5)
    expect(result.reasons).toContain('Right by you')
  })
})

describe('matchActivities', () => {
  it('drops activities that have already ended', () => {
    const past = makeActivity({
      id: 'past',
      starts_at: '2025-03-01T10:00:00Z',
      ends_at: '2025-03-01T12:00:00Z',
    })
    const result = matchActivities([past, makeActivity({ id: 'future' })], basePrefs, { now: NOW })
    expect(result.map((r) => r.activity.id)).toEqual(['future'])
  })

  it('drops full activities the user has not joined', () => {
    const full = makeActivity({ id: 'full', is_full: true, participant_count: 10 })
    const result = matchActivities([full, makeActivity({ id: 'open' })], basePrefs, { now: NOW })
    expect(result.map((r) => r.activity.id)).toEqual(['open'])
  })

  it('keeps a full activity the user already joined', () => {
    const joined = makeActivity({ id: 'joined', is_full: true, is_joined: true })
    const result = matchActivities([joined], basePrefs, { now: NOW })
    expect(result.map((r) => r.activity.id)).toEqual(['joined'])
  })

  it('ranks a preferred category above an uninteresting one', () => {
    const liked = makeActivity({ id: 'liked', category: 'basketball' })
    const meh = makeActivity({ id: 'meh', category: 'gaming' })
    const result = matchActivities([meh, liked], basePrefs, { now: NOW })
    expect(result[0].activity.id).toBe('liked')
  })

  it('honours the limit option', () => {
    const many = Array.from({ length: 5 }, (_, i) => makeActivity({ id: `a${i}` }))
    expect(matchActivities(many, basePrefs, { now: NOW, limit: 2 })).toHaveLength(2)
  })

  it('filters by minScore', () => {
    const meh = makeActivity({ id: 'meh', category: 'gaming', participant_count: 0 })
    expect(matchActivities([meh], basePrefs, { now: NOW, minScore: 90 })).toHaveLength(0)
  })

  it('is deterministic for the same inputs', () => {
    const activities = [makeActivity({ id: 'x' }), makeActivity({ id: 'y', category: 'study' })]
    const first = matchActivities(activities, basePrefs, { now: NOW })
    const second = matchActivities(activities, basePrefs, { now: NOW })
    expect(first.map((r) => r.activity.id)).toEqual(second.map((r) => r.activity.id))
  })
})

describe('similarity + recommendations', () => {
  it('scores an identical activity higher than an unrelated one', () => {
    const target = makeActivity({ id: 'target' })
    const twin = makeActivity({ id: 'twin' })
    const unrelated = makeActivity({
      id: 'other',
      category: 'music',
      location_name: 'Mondavi Center',
      starts_at: '2025-04-01T15:00:00Z',
      ends_at: '2025-04-01T17:00:00Z',
    })
    expect(similarityBetween(target, twin)).toBeGreaterThan(
      similarityBetween(target, unrelated),
    )
  })

  it('never recommends the target itself, and respects the limit', () => {
    const target = makeActivity({ id: 'target' })
    const others = Array.from({ length: 5 }, (_, i) => makeActivity({ id: `o${i}` }))
    const result = recommendSimilar(target, [target, ...others], 3)
    expect(result).toHaveLength(3)
    expect(result.map((r) => r.id)).not.toContain('target')
  })
})
