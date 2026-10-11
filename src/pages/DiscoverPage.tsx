/**
 * WoCow · DiscoverPage
 * Owner: Person 1 (UI)
 *
 * The default tab: everything happening on campus, with search and filters.
 * Presentational only — App.tsx owns the data and the filter state so that
 * one realtime subscription serves every tab.
 */
import { ActivityList } from '../components/ActivityList'
import { FilterBar } from '../components/FilterBar'
import type { ActivityFeedRow } from '../lib/types'
import type { ScoredActivity } from '../features/matching/scoring'

export interface DiscoverPageProps {
  activities: ActivityFeedRow[]
  matches: Map<string, ScoredActivity>
  loading: boolean
  error: string | null
  currentUserId: string | null
  busyId: string | null

  search: string
  onSearchChange: (value: string) => void
  selectedCategories: string[]
  onToggleCategory: (category: string) => void
  onClearCategories: () => void
  hideFull: boolean
  onHideFullChange: (value: boolean) => void
  includePast: boolean
  onIncludePastChange: (value: boolean) => void

  onJoin: (activity: ActivityFeedRow) => void
  onLeave: (activity: ActivityFeedRow) => void
  onSelect: (activity: ActivityFeedRow) => void
  onDelete: (activity: ActivityFeedRow) => void
  onHostClick: () => void
}

export function DiscoverPage({
  activities,
  matches,
  loading,
  error,
  currentUserId,
  busyId,
  search,
  onSearchChange,
  selectedCategories,
  onToggleCategory,
  onClearCategories,
  hideFull,
  onHideFullChange,
  includePast,
  onIncludePastChange,
  onJoin,
  onLeave,
  onSelect,
  onDelete,
  onHostClick,
}: DiscoverPageProps) {
  return (
    <>
      <FilterBar
        search={search}
        onSearchChange={onSearchChange}
        selectedCategories={selectedCategories}
        onToggleCategory={onToggleCategory}
        onClearCategories={onClearCategories}
        hideFull={hideFull}
        onHideFullChange={onHideFullChange}
        includePast={includePast}
        onIncludePastChange={onIncludePastChange}
        resultCount={activities.length}
      />

      <ActivityList
        activities={activities}
        matches={matches}
        currentUserId={currentUserId}
        loading={loading}
        error={error}
        busyId={busyId}
        emptyTitle="No activities match yet"
        emptyHint="Try clearing a filter, or host the first one yourself."
        emptyAction={
          <button
            type="button"
            className="wocow-btn wocow-btn--primary"
            onClick={onHostClick}
          >
            + Host an activity
          </button>
        }
        onJoin={onJoin}
        onLeave={onLeave}
        onSelect={onSelect}
        onDelete={onDelete}
      />
    </>
  )
}

export default DiscoverPage
