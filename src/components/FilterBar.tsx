/**
 * WoCow · FilterBar
 * Owner: Person 1 (UI)
 *
 * Search box, category chips and quick toggles. Purely controlled: it holds
 * no state of its own, so the page owns the filters and can persist them.
 */
import { ACTIVITY_CATEGORIES } from '../lib/types'

export interface FilterBarProps {
  search: string
  onSearchChange: (value: string) => void
  selectedCategories: string[]
  onToggleCategory: (category: string) => void
  onClearCategories: () => void
  hideFull: boolean
  onHideFullChange: (value: boolean) => void
  includePast: boolean
  onIncludePastChange: (value: boolean) => void
  /** Number of results currently shown, for the "N activities" label. */
  resultCount?: number
}

export function FilterBar({
  search,
  onSearchChange,
  selectedCategories,
  onToggleCategory,
  onClearCategories,
  hideFull,
  onHideFullChange,
  includePast,
  onIncludePastChange,
  resultCount,
}: FilterBarProps) {
  return (
    <section className="wocow-filters" aria-label="Filter activities">
      <div className="wocow-filters__row">
        <input
          type="search"
          className="wocow-input wocow-filters__search"
          placeholder="Search activities, places, categories…"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          aria-label="Search activities"
        />

        <label className="wocow-switch">
          <input
            type="checkbox"
            checked={hideFull}
            onChange={(event) => onHideFullChange(event.target.checked)}
          />
          <span>Hide full</span>
        </label>

        <label className="wocow-switch">
          <input
            type="checkbox"
            checked={includePast}
            onChange={(event) => onIncludePastChange(event.target.checked)}
          />
          <span>Show past</span>
        </label>
      </div>

      <div className="wocow-filters__chips">
        {ACTIVITY_CATEGORIES.map((category) => {
          const active = selectedCategories.includes(category.value)
          return (
            <button
              key={category.value}
              type="button"
              className={`wocow-chip${active ? ' is-active' : ''}`}
              onClick={() => onToggleCategory(category.value)}
              aria-pressed={active}
            >
              <span aria-hidden="true">{category.emoji}</span> {category.label}
            </button>
          )
        })}

        {selectedCategories.length > 0 && (
          <button
            type="button"
            className="wocow-chip wocow-chip--clear"
            onClick={onClearCategories}
          >
            Clear
          </button>
        )}

        {typeof resultCount === 'number' && (
          <span className="wocow-filters__count">
            {resultCount} activit{resultCount === 1 ? 'y' : 'ies'}
          </span>
        )}
      </div>
    </section>
  )
}

export default FilterBar
