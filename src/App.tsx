/**
 * WoCow · App
 * Owner: Person 5 (Integration)
 *
 * THE single integration point. Everything below this file is a module owned
 * by one person; everything that stitches modules together lives here.
 *
 * Data flows one way:
 *
 *   useAuth ─┐
 *   usePreferences ─┤
 *                   ├─> useActivities (one realtime subscription)
 *                   │        │
 *                   │        ├─> useMatches (Person 4, pure)
 *                   │        │
 *                   └────────┴─> pages (presentational)
 *
 * Because there is exactly one `useActivities` call, there is exactly one
 * websocket channel — mounting a second one per tab would leak connections.
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Header, type TabKey } from './components/Header'
import { SetupNotice } from './components/SetupNotice'
import { SignInPanel } from './components/SignInPanel'
import { CreateActivityForm } from './components/CreateActivityForm'

import { DiscoverPage } from './pages/DiscoverPage'
import { MatchesPage } from './pages/MatchesPage'
import { MyActivitiesPage } from './pages/MyActivitiesPage'

// Leaflet is ~150 kB. Splitting it out means the Discover and "For you" tabs
// load fast on a phone, and the map code only arrives if it is opened.
const MapPage = lazy(() => import('./pages/MapPage'))

import { useAuth } from './hooks/useAuth'
import { usePreferences } from './features/matching/usePreferences'
import { useActivities } from './features/activities/useActivities'
import { useMatches } from './features/matching/useMatches'
import {
  createActivity,
  deleteActivity,
  joinActivity,
  leaveActivity,
} from './features/activities/api'
import { isSupabaseConfigured } from './lib/supabase'
import type { ActivityFeedRow, NewActivityInput } from './lib/types'

interface Toast {
  kind: 'ok' | 'error'
  text: string
}

export default function App() {
  // ---- navigation + filters ------------------------------------------------
  const [tab, setTab] = useState<TabKey>('discover')
  const [search, setSearch] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [hideFull, setHideFull] = useState(false)
  const [includePast, setIncludePast] = useState(false)

  // ---- UI state ------------------------------------------------------------
  const [signInOpen, setSignInOpen] = useState(false)
  const [hostOpen, setHostOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [locating, setLocating] = useState(false)
  /** Set when a card's "Details" asks the map to fly to that activity. */
  const [focusActivity, setFocusActivity] = useState<ActivityFeedRow | null>(null)

  // ---- data ----------------------------------------------------------------
  const auth = useAuth()
  const preferences = usePreferences()

  const filters = useMemo(
    () => ({
      search,
      categories: selectedCategories,
      hideFull,
      includePast,
    }),
    [search, selectedCategories, hideFull, includePast],
  )

  const { activities, loading, error, realtimeStatus, refresh, upsertActivity } =
    useActivities(filters)

  // Score every activity in the feed, so Discover cards can show a match badge.
  // The "For you" tab then applies its own full/expired filter below.
  const { matches } = useMatches(activities, preferences.preferences, {
    excludePast: false,
    excludeFull: false,
  })

  const matchMap = useMemo(
    () => new Map(matches.map((match) => [match.activity.id, match])),
    [matches],
  )

  const forYou = useMemo(
    () => matches.filter((match) => !(match.activity.is_full && !match.activity.is_joined)),
    [matches],
  )

  // ---- re-read the feed when the signed-in user changes --------------------
  // `is_joined` and `host_id` are computed BY THE DATABASE from auth.uid(), so
  // the feed is only correct for the identity that fetched it. useActivities
  // refetches on filter changes, which sign-in/sign-out does not trigger —
  // without this, after signing in you would still see "Join" on activities
  // you are already in, and the "My plans" tab would look empty.
  //
  // The first settle is skipped because useActivities has already fetched once
  // on mount; this only reacts to an actual identity change.
  const currentUserId = auth.user?.id ?? null
  const settledUserId = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    if (auth.loading) return

    if (settledUserId.current === undefined) {
      settledUserId.current = currentUserId
      return
    }
    if (settledUserId.current === currentUserId) return

    settledUserId.current = currentUserId
    void refresh(true)
  }, [currentUserId, auth.loading, refresh])

  // ---- toast auto-dismiss --------------------------------------------------
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  // ---- actions -------------------------------------------------------------
  const requireAuth = useCallback(
    (action: () => void) => {
      if (!auth.user) {
        setSignInOpen(true)
        return
      }
      action()
    },
    [auth.user],
  )

  const handleJoin = useCallback(
    (activity: ActivityFeedRow) =>
      requireAuth(async () => {
        setBusyId(activity.id)
        try {
          const row = await joinActivity(activity.id)
          upsertActivity(row)
          setToast({ kind: 'ok', text: `You are going to ${activity.title}.` })
        } catch (err) {
          setToast({
            kind: 'error',
            text: err instanceof Error ? err.message : 'Could not join.',
          })
          // Someone else may have taken the last slot: resync.
          void refresh(true)
        } finally {
          setBusyId(null)
        }
      }),
    [requireAuth, upsertActivity, refresh],
  )

  const handleLeave = useCallback(
    (activity: ActivityFeedRow) =>
      requireAuth(async () => {
        setBusyId(activity.id)
        try {
          const row = await leaveActivity(activity.id)
          upsertActivity(row)
          setToast({ kind: 'ok', text: `Left ${activity.title}.` })
        } catch (err) {
          setToast({
            kind: 'error',
            text: err instanceof Error ? err.message : 'Could not leave.',
          })
        } finally {
          setBusyId(null)
        }
      }),
    [requireAuth, upsertActivity],
  )

  const handleDelete = useCallback(
    (activity: ActivityFeedRow) =>
      requireAuth(async () => {
        if (!window.confirm(`Cancel “${activity.title}”? This cannot be undone.`)) {
          return
        }
        setBusyId(activity.id)
        try {
          await deleteActivity(activity.id)
          await refresh(true)
          setToast({ kind: 'ok', text: 'Activity cancelled.' })
        } catch (err) {
          setToast({
            kind: 'error',
            text: err instanceof Error ? err.message : 'Could not cancel.',
          })
        } finally {
          setBusyId(null)
        }
      }),
    [requireAuth, refresh],
  )

  const handleCreate = useCallback(
    async (input: NewActivityInput) => {
      const row = await createActivity(input)
      upsertActivity(row)
      await refresh(true)
      setTab('discover')
      setToast({ kind: 'ok', text: `${row.title} is live!` })
    },
    [upsertActivity, refresh],
  )

  const handleHostClick = useCallback(
    () => requireAuth(() => setHostOpen(true)),
    [requireAuth],
  )

  const handleSelect = useCallback((activity: ActivityFeedRow) => {
    setFocusActivity(activity)
    setTab('map')
  }, [])

  const handleUseMyLocation = useCallback(async () => {
    setLocating(true)
    try {
      const coords = await preferences.requestGeolocation()
      if (!coords) {
        setToast({ kind: 'error', text: 'Could not read your location.' })
      }
    } finally {
      setLocating(false)
    }
  }, [preferences])

  // ---- early screens -------------------------------------------------------
  if (!isSupabaseConfigured) return <SetupNotice />

  if (auth.loading) {
    return (
      <div className="wocow-splash">
        <span className="wocow-splash__mark" aria-hidden="true">
          🐮
        </span>
        <p>Waking up WoCow…</p>
      </div>
    )
  }

  return (
    <div className="wocow-app">
      <Header
        activeTab={tab}
        onTabChange={setTab}
        user={auth.user}
        realtimeStatus={realtimeStatus}
        matchCount={forYou.length}
        onSignInClick={() => setSignInOpen(true)}
        onSignOut={() => void auth.signOut()}
        onHostClick={handleHostClick}
      />

      <main className="wocow-main">
        {tab === 'discover' && (
          <DiscoverPage
            activities={activities}
            matches={matchMap}
            loading={loading}
            error={error}
            currentUserId={currentUserId}
            busyId={busyId}
            search={search}
            onSearchChange={setSearch}
            selectedCategories={selectedCategories}
            onToggleCategory={(category) =>
              setSelectedCategories((current) =>
                current.includes(category)
                  ? current.filter((item) => item !== category)
                  : [...current, category],
              )
            }
            onClearCategories={() => setSelectedCategories([])}
            hideFull={hideFull}
            onHideFullChange={setHideFull}
            includePast={includePast}
            onIncludePastChange={setIncludePast}
            onJoin={handleJoin}
            onLeave={handleLeave}
            onSelect={handleSelect}
            onDelete={handleDelete}
            onHostClick={handleHostClick}
          />
        )}

        {tab === 'matches' && (
          <MatchesPage
            allActivities={activities}
            matches={forYou}
            loading={loading}
            error={error}
            currentUserId={currentUserId}
            busyId={busyId}
            interests={preferences.preferences.interests}
            onToggleInterest={preferences.toggleInterest}
            maxDistanceKm={preferences.preferences.maxDistanceKm ?? 5}
            onMaxDistanceChange={preferences.setMaxDistanceKm}
            hasPosition={
              preferences.preferences.latitude !== undefined &&
              preferences.preferences.longitude !== undefined
            }
            onUseMyLocation={() => void handleUseMyLocation()}
            locating={locating}
            onJoin={handleJoin}
            onLeave={handleLeave}
            onSelect={handleSelect}
            onDelete={handleDelete}
            onHostClick={handleHostClick}
          />
        )}

        {tab === 'map' && (
          <Suspense
            fallback={
              <div className="wocow-state" aria-busy="true">
                <div className="wocow-skeleton" />
                <p>Loading the map…</p>
              </div>
            }
          >
            <MapPage
              activities={activities}
              loading={loading}
              error={error}
              currentUserId={currentUserId}
              busyId={busyId}
              focusActivity={focusActivity}
              onJoin={handleJoin}
              onLeave={handleLeave}
            />
          </Suspense>
        )}

        {tab === 'mine' && (
          <MyActivitiesPage
            activities={activities}
            loading={loading}
            error={error}
            currentUserId={currentUserId}
            busyId={busyId}
            signedIn={Boolean(auth.user)}
            onJoin={handleJoin}
            onLeave={handleLeave}
            onSelect={handleSelect}
            onDelete={handleDelete}
            onHostClick={handleHostClick}
            onSignInClick={() => setSignInOpen(true)}
          />
        )}
      </main>

      <footer className="wocow-footer">
        <span>WoCow · real-time campus activity matching</span>
        {!auth.user && (
          <button
            type="button"
            className="wocow-btn wocow-btn--link wocow-btn--sm"
            onClick={() => setSignInOpen(true)}
          >
            Sign in to join activities
          </button>
        )}
      </footer>

      {toast && (
        <div className={`wocow-toast wocow-toast--${toast.kind}`} role="status">
          {toast.text}
        </div>
      )}

      <SignInPanel
        open={signInOpen}
        onClose={() => setSignInOpen(false)}
        onSignInWithPassword={auth.signInWithPassword}
        onSignUp={auth.signUp}
        onMagicLink={auth.signInWithMagicLink}
        onGuest={auth.signInAsGuest}
      />

      <CreateActivityForm
        open={hostOpen}
        onClose={() => setHostOpen(false)}
        onSubmit={handleCreate}
      />
    </div>
  )
}
