/**
 * WoCow · CreateActivityForm
 * Owner: Person 1 (UI), with Person 2's LocationPicker embedded
 *
 * Modal for hosting an activity. Validates locally before it ever reaches the
 * database, so users get instant feedback instead of a Postgres check-violation.
 *
 * The map picker is optional: a user can pick a named campus spot from the
 * dropdown, or drop a pin for anywhere else.
 */
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ACTIVITY_CATEGORIES, type NewActivityInput } from '../lib/types'
import {
  defaultStartTime,
  toDateTimeLocalValue,
  toIsoString,
} from '../lib/format'
import {
  CAMPUS_CENTER,
  CAMPUS_LOCATIONS,
  type CampusLocation,
} from '../features/map/campusLocations'
import { LocationPicker } from '../features/map/LocationPicker'

export interface CreateActivityFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (input: NewActivityInput) => Promise<void>
  error?: string | null
}

interface FormState {
  title: string
  description: string
  category: string
  locationName: string
  latitude: number
  longitude: number
  maxParticipants: string
  startsAt: string
  endsAt: string
}

function initialState(): FormState {
  const start = defaultStartTime()
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000)
  return {
    title: '',
    description: '',
    category: ACTIVITY_CATEGORIES[0].value,
    locationName: '',
    latitude: CAMPUS_CENTER.latitude,
    longitude: CAMPUS_CENTER.longitude,
    maxParticipants: '10',
    startsAt: toDateTimeLocalValue(start),
    endsAt: toDateTimeLocalValue(end),
  }
}

export function CreateActivityForm({
  open,
  onClose,
  onSubmit,
  error,
}: CreateActivityFormProps) {
  const [form, setForm] = useState<FormState>(initialState)
  const [localError, setLocalError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showMap, setShowMap] = useState(false)

  // Fresh form every time the modal opens.
  useEffect(() => {
    if (open) {
      setForm(initialState())
      setLocalError(null)
      setShowMap(false)
    }
  }, [open])

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const maxParticipantsNumber = Number(form.maxParticipants)
  const timingInvalid = useMemo(
    () => new Date(form.endsAt).getTime() <= new Date(form.startsAt).getTime(),
    [form.startsAt, form.endsAt],
  )

  if (!open) return null

  const validate = (): string | null => {
    if (form.title.trim().length < 3) return 'Give the activity a title of at least 3 characters.'
    if (form.locationName.trim().length < 2) return 'Where is it happening?'
    if (!Number.isFinite(maxParticipantsNumber) || maxParticipantsNumber < 1) {
      return 'The participant limit must be at least 1.'
    }
    if (maxParticipantsNumber > 500) return 'Keep the limit at 500 or fewer.'
    if (timingInvalid) return 'The end time must be after the start time.'
    return null
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const validationError = validate()
    if (validationError) {
      setLocalError(validationError)
      return
    }

    setSubmitting(true)
    setLocalError(null)
    try {
      await onSubmit({
        title: form.title,
        description: form.description || null,
        category: form.category,
        location_name: form.locationName,
        latitude: form.latitude,
        longitude: form.longitude,
        max_participants: maxParticipantsNumber,
        starts_at: toIsoString(form.startsAt),
        ends_at: toIsoString(form.endsAt),
      })
      onClose()
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Could not create the activity.')
    } finally {
      setSubmitting(false)
    }
  }

  const applyCampusLocation = (location: CampusLocation) => {
    setForm((current) => ({
      ...current,
      locationName: location.name,
      latitude: location.latitude,
      longitude: location.longitude,
    }))
  }

  const displayedError = localError ?? error

  return (
    <div className="wocow-overlay" role="dialog" aria-modal="true" aria-label="Host an activity">
      <div className="wocow-modal">
        <header className="wocow-modal__head">
          <h2>Host an activity</h2>
          <button
            type="button"
            className="wocow-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <form onSubmit={handleSubmit} className="wocow-form">
          <label className="wocow-field">
            <span>Title</span>
            <input
              className="wocow-input"
              value={form.title}
              onChange={(event) => update('title', event.target.value)}
              placeholder="Basketball at the ARC"
              maxLength={120}
              required
            />
          </label>

          <label className="wocow-field">
            <span>Category</span>
            <select
              className="wocow-input"
              value={form.category}
              onChange={(event) => update('category', event.target.value)}
            >
              {ACTIVITY_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.emoji} {category.label}
                </option>
              ))}
            </select>
          </label>

          <label className="wocow-field">
            <span>Description (optional)</span>
            <textarea
              className="wocow-input"
              rows={3}
              value={form.description}
              onChange={(event) => update('description', event.target.value)}
              placeholder="Pickup 5v5, all skill levels welcome."
              maxLength={1000}
            />
          </label>

          <div className="wocow-grid-2">
            <label className="wocow-field">
              <span>Starts</span>
              <input
                type="datetime-local"
                className="wocow-input"
                value={form.startsAt}
                onChange={(event) => update('startsAt', event.target.value)}
                required
              />
            </label>

            <label className="wocow-field">
              <span>Ends</span>
              <input
                type="datetime-local"
                className="wocow-input"
                value={form.endsAt}
                onChange={(event) => update('endsAt', event.target.value)}
                required
              />
            </label>
          </div>

          {timingInvalid && (
            <p className="wocow-alert wocow-alert--error">
              The end time must be after the start time.
            </p>
          )}

          <label className="wocow-field">
            <span>Max participants</span>
            <input
              type="number"
              className="wocow-input"
              min={1}
              max={500}
              value={form.maxParticipants}
              onChange={(event) => update('maxParticipants', event.target.value)}
              required
            />
          </label>

          <fieldset className="wocow-fieldset">
            <legend>Location</legend>

            <div className="wocow-location-presets">
              {CAMPUS_LOCATIONS.slice(0, 6).map((location) => (
                <button
                  key={location.id}
                  type="button"
                  className={`wocow-chip${
                    form.locationName === location.name ? ' is-active' : ''
                  }`}
                  onClick={() => applyCampusLocation(location)}
                >
                  <span aria-hidden="true">{location.emoji}</span> {location.name}
                </button>
              ))}
            </div>

            <label className="wocow-field">
              <span>Place name</span>
              <input
                className="wocow-input"
                value={form.locationName}
                onChange={(event) => update('locationName', event.target.value)}
                placeholder="UC Davis ARC"
                maxLength={160}
                required
              />
            </label>

            <button
              type="button"
              className="wocow-btn wocow-btn--ghost wocow-btn--sm"
              onClick={() => setShowMap((value) => !value)}
            >
              {showMap ? 'Hide map' : '📍 Drop a pin instead'}
            </button>

            {showMap && (
              <LocationPicker
                value={{ latitude: form.latitude, longitude: form.longitude }}
                onChange={({ latitude, longitude }) =>
                  setForm((current) => ({ ...current, latitude, longitude }))
                }
                onSuggestion={(location) =>
                  setForm((current) => ({ ...current, locationName: location.name }))
                }
              />
            )}

            <p className="wocow-hint">
              Coordinates: {form.latitude.toFixed(5)}, {form.longitude.toFixed(5)}
            </p>
          </fieldset>

          {displayedError && (
            <p className="wocow-alert wocow-alert--error" role="alert">
              {displayedError}
            </p>
          )}

          <div className="wocow-modal__actions">
            <button
              type="button"
              className="wocow-btn wocow-btn--ghost"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="wocow-btn wocow-btn--primary"
              disabled={submitting}
            >
              {submitting ? 'Creating…' : 'Create activity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateActivityForm
