/**
 * WoCow · PreferencesPanel
 * Owner: Person 4 (Match)
 *
 * Collects the two inputs the matching algorithm actually needs: which
 * categories the user likes, and how far they will travel. Also offers
 * "use my location" so distance scoring can kick in.
 */
import { ACTIVITY_CATEGORIES } from '../lib/types'

export interface PreferencesPanelProps {
  interests: string[]
  onToggleInterest: (category: string) => void
  maxDistanceKm: number
  onMaxDistanceChange: (km: number) => void
  hasPosition: boolean
  onUseMyLocation: () => void
  locating?: boolean
}

export function PreferencesPanel({
  interests,
  onToggleInterest,
  maxDistanceKm,
  onMaxDistanceChange,
  hasPosition,
  onUseMyLocation,
  locating = false,
}: PreferencesPanelProps) {
  return (
    <section className="wocow-prefs" aria-label="Your preferences">
      <div className="wocow-prefs__block">
        <h3>What are you into?</h3>
        <p className="wocow-hint">
          Pick a few. The order you tap them in becomes your priority order.
        </p>
        <div className="wocow-filters__chips">
          {ACTIVITY_CATEGORIES.map((category) => {
            const index = interests.indexOf(category.value)
            const active = index !== -1
            return (
              <button
                key={category.value}
                type="button"
                className={`wocow-chip${active ? ' is-active' : ''}`}
                onClick={() => onToggleInterest(category.value)}
                aria-pressed={active}
              >
                <span aria-hidden="true">{category.emoji}</span> {category.label}
                {active && <span className="wocow-chip__rank">#{index + 1}</span>}
              </button>
            )
          })}
        </div>
      </div>

      <div className="wocow-prefs__block">
        <h3>How far will you go?</h3>
        <label className="wocow-field">
          <span>{maxDistanceKm} km</span>
          <input
            type="range"
            min={0.5}
            max={25}
            step={0.5}
            value={maxDistanceKm}
            onChange={(event) => onMaxDistanceChange(Number(event.target.value))}
          />
        </label>

        <button
          type="button"
          className="wocow-btn wocow-btn--ghost wocow-btn--sm"
          onClick={onUseMyLocation}
          disabled={locating}
        >
          {locating
            ? 'Locating…'
            : hasPosition
              ? '📍 Location set — update'
              : '📍 Use my location'}
        </button>
        {!hasPosition && (
          <p className="wocow-hint">
            Optional. Without it, distance is treated as neutral rather than bad.
          </p>
        )}
      </div>
    </section>
  )
}

export default PreferencesPanel
