"use client";

import { useMemo, useState } from "react";
import { useActivities } from "@/components/ActivitiesProvider";
import { useAuth } from "@/components/AuthProvider";
import { ActivityCard, EmptyState } from "@/components/ActivityCard";
import { CategoryChips, StatusToggle, applyFilters, DEFAULT_FILTERS, type FilterState } from "@/components/Filters";
import { ClubsSection } from "@/components/ClubsSection";
import { Discussions } from "@/components/Discussions";
import { ErrorState, LoadingGrid, NotConfiguredNotice } from "@/components/States";
import { useActivityMatches } from "@/features/matching/useActivityMatches";
import { supabaseConfigured } from "@/lib/supabase/client";
import { feedState } from "@/lib/ui";

const GRID = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";

export default function DiscoverPage() {
  const { activities, joinedIds, loading, error, refresh } = useActivities();
  const { profile } = useAuth();
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [retrying, setRetrying] = useState(false);

  const filtered = useMemo(() => applyFilters(activities, filters), [activities, filters]);
  const live = filtered.filter((a) => a.live_status === "live");
  const soon = filtered.filter((a) => a.live_status === "upcoming");
  const recommended = useActivityMatches(activities, profile, joinedIds);

  const hasActiveFilters =
    filters.categories.length > 0 || filters.status !== "all" || filters.query.trim() !== "";

  const state = feedState({
    configured: supabaseConfigured,
    loading,
    error,
    visibleCount: filtered.length,
    hasActiveFilters,
  });

  async function retry() {
    // Guarded: the button is disabled while retrying, and this stops a queued
    // second click from firing another request.
    if (retrying) return;
    setRetrying(true);
    try {
      await refresh();
    } finally {
      setRetrying(false);
    }
  }

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h1 className="font-display text-3xl font-bold">🔥 Discover</h1>
      <nav aria-label="Jump to" className="flex gap-2 text-sm font-extrabold">
        <a href="#clubs" className="sticker-sm pop rounded-full bg-lavender px-3 py-1">Clubs</a>
        <a href="#discussions" className="sticker-sm pop rounded-full bg-sky px-3 py-1">Discussions</a>
      </nav>
    </div>
  );

  // No Supabase project: say so plainly. Rendering two empty sections here would
  // read as a genuinely quiet campus, which is a different thing entirely.
  if (state === "unconfigured") {
    return (
      <div className="space-y-8">
        {header}
        <NotConfiguredNotice />
        <ClubsSection />
        <Discussions />
      </div>
    );
  }

  const emptyCopy =
    state === "no-matches"
      ? { title: "No activities match your filters", hint: "Try clearing the search box, category chips, or status filter." }
      : { title: "Nothing on campus yet", hint: "Be the first — use + Host Activity at the top to start something." };

  return (
    <div className="space-y-8">
      {header}

      <div className="space-y-3">
        <input
          type="search"
          value={filters.query}
          onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
          placeholder="Search activities, places, sports…"
          aria-label="Search activities"
          className="w-full rounded-2xl border-2 border-ink bg-white px-4 py-3 text-base font-semibold shadow-[3px_3px_0_#2b2118] outline-none focus:ring-4 focus:ring-sun/60"
        />
        <CategoryChips value={filters.categories} onChange={(categories) => setFilters((f) => ({ ...f, categories }))} />
        <StatusToggle value={filters.status} onChange={(status) => setFilters((f) => ({ ...f, status }))} />
      </div>

      {state === "error" ? (
        <ErrorState title="Couldn't load activities" message={error} onRetry={retry} retrying={retrying} />
      ) : (
        <>
          {recommended.length > 0 && (
            <section aria-labelledby="rec">
              <h2 id="rec" className="mb-3 font-display text-2xl font-bold">✨ Recommended for You</h2>
              <p className="-mt-2 mb-3 text-sm font-bold text-ink/70">Based on your favorite categories and preferred activities, starting time, and open spots.</p>
              <div className={GRID}>{recommended.map(({ activity, score, reasons }) => (
                <div key={activity.id} className="flex flex-col gap-2">
                  <p className="text-sm font-extrabold text-ink/75">Match score: {score}/100 · {reasons.join(" · ")}</p>
                  <ActivityCard a={activity} />
                </div>
              ))}</div>
            </section>
          )}

          <section aria-labelledby="now">
            <h2 id="now" className="mb-3 font-display text-2xl font-bold">
              🔴 Happening Now
              <span className="ml-1 rounded-full border-2 border-ink bg-white px-2 py-0.5 align-middle text-sm">{live.length}</span>
            </h2>
            {state === "loading" ? (
              <LoadingGrid label="Loading live activities…" />
            ) : live.length ? (
              <div className={GRID}>{live.map((a) => <ActivityCard key={a.id} a={a} />)}</div>
            ) : (
              <EmptyState
                title={emptyCopy.title}
                hint={emptyCopy.hint}
                action={
                  hasActiveFilters ? (
                    <button
                      type="button"
                      onClick={() => setFilters(DEFAULT_FILTERS)}
                      className="sticker-sm pop rounded-full bg-sun px-4 py-2 font-display font-bold"
                    >
                      Clear filters
                    </button>
                  ) : undefined
                }
              />
            )}
          </section>

          <section aria-labelledby="soon">
            <h2 id="soon" className="mb-3 font-display text-2xl font-bold">
              ⏰ Starting Soon
              <span className="ml-1 rounded-full border-2 border-ink bg-white px-2 py-0.5 align-middle text-sm">{soon.length}</span>
            </h2>
            {state === "loading" ? (
              <LoadingGrid count={2} label="Loading upcoming activities…" />
            ) : soon.length ? (
              <div className={GRID}>{soon.map((a) => <ActivityCard key={a.id} a={a} />)}</div>
            ) : (
              <EmptyState title={emptyCopy.title} hint={emptyCopy.hint} />
            )}
          </section>
        </>
      )}

      <ClubsSection />
      <Discussions />
    </div>
  );
}
