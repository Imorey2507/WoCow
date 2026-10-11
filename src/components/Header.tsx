/**
 * WoCow · Header
 * Owner: Person 1 (UI)
 *
 * Brand, tab navigation, a live-connection dot and the account button.
 */
import type { User } from '@supabase/supabase-js'
import type { RealtimeStatus } from '../features/activities/realtime'

export type TabKey = 'discover' | 'matches' | 'map' | 'mine'

export interface HeaderProps {
  activeTab: TabKey
  onTabChange: (tab: TabKey) => void
  user: User | null
  realtimeStatus: RealtimeStatus
  /** How many activities are in the current feed, for the tab badge. */
  matchCount?: number
  onSignInClick: () => void
  onSignOut: () => void
  onHostClick: () => void
}

const TABS: { key: TabKey; label: string; emoji: string }[] = [
  { key: 'discover', label: 'Discover', emoji: '🧭' },
  { key: 'matches', label: 'For you', emoji: '✨' },
  { key: 'map', label: 'Map', emoji: '🗺️' },
  { key: 'mine', label: 'My plans', emoji: '🎒' },
]

export function Header({
  activeTab,
  onTabChange,
  user,
  realtimeStatus,
  matchCount,
  onSignInClick,
  onSignOut,
  onHostClick,
}: HeaderProps) {
  const live = realtimeStatus === 'SUBSCRIBED'
  const label = user?.email ?? (user ? 'Guest' : null)

  return (
    <header className="wocow-header">
      <div className="wocow-header__bar">
        <button
          type="button"
          className="wocow-brand"
          onClick={() => onTabChange('discover')}
        >
          <span className="wocow-brand__mark" aria-hidden="true">
            🐮
          </span>
          <span className="wocow-brand__name">WoCow</span>
        </button>

        <span
          className={`wocow-live${live ? ' is-live' : ''}`}
          title={live ? 'Realtime connected' : `Realtime: ${realtimeStatus}`}
        >
          <span className="wocow-live__dot" aria-hidden="true" />
          {live ? 'Live' : 'Offline'}
        </span>

        <div className="wocow-header__spacer" />

        <button
          type="button"
          className="wocow-btn wocow-btn--primary wocow-btn--sm"
          onClick={onHostClick}
        >
          + Host
        </button>

        {user ? (
          <div className="wocow-account">
            <span className="wocow-account__name" title={label ?? ''}>
              {label}
            </span>
            <button
              type="button"
              className="wocow-btn wocow-btn--ghost wocow-btn--sm"
              onClick={onSignOut}
            >
              Sign out
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="wocow-btn wocow-btn--ghost wocow-btn--sm"
            onClick={onSignInClick}
          >
            Sign in
          </button>
        )}
      </div>

      <nav className="wocow-tabs" aria-label="Sections">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`wocow-tab${activeTab === tab.key ? ' is-active' : ''}`}
            onClick={() => onTabChange(tab.key)}
            aria-current={activeTab === tab.key ? 'page' : undefined}
          >
            <span aria-hidden="true">{tab.emoji}</span>
            <span>{tab.label}</span>
            {tab.key === 'matches' && typeof matchCount === 'number' && matchCount > 0 && (
              <span className="wocow-tab__badge">{matchCount}</span>
            )}
          </button>
        ))}
      </nav>
    </header>
  )
}

export default Header
