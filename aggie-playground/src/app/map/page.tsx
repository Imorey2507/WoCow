"use client";

import { useMemo, useState } from "react";
import { useActivities } from "@/components/ActivitiesProvider";
import { ActivityCard, EmptyState } from "@/components/ActivityCard";
import { CampusMap } from "@/components/CampusMap";
import { CategoryChips, StatusToggle, applyFilters, DEFAULT_FILTERS, type FilterState } from "@/components/Filters";
import { ErrorState, LoadingGrid, NotConfiguredNotice } from "@/components/States";
import { LOCATION_BY_KEY } from "@/lib/locations";
import { locationLabel, mapState, partitionByPosition } from "@/lib/map";
import { supabaseConfigured } from "@/lib/supabase/client";

const GRID = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";

export default function MapPage() {
  const { activities, loading, error, refresh } = useActivities();
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [selected, setSelected] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const filtered = useMemo(() => applyFilters(activities, filters), [activities, filters]);
  const { placeable, unplaceable } = useMemo(
    () => partitionByPosition(filtered, LOCATION_BY_KEY),
    [filtered],
  );
  const placedIds = useMemo(() => new Set(placeable.map((a) => a.id)), [placeable]);

  const hasFilters =
    filters.categories.length > 0 || filters.status !== "all" || filters.query.trim() !== "";

  const state = mapState({
    configured: supabaseConfigured,
    loading,
    error,
    total: filtered.length,
    hasFilters,
  });

  async function retry() {
    if (retrying) return;
    setRetrying(true);
    try {
      await refresh();
    } finally {
      setRetrying(false);
    }
  }

  function showOnMap(id: string) {
    setSelected(id);
    document.getElementById("campus-map")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h1 className="font-display text-3xl font-bold">🗺️ Campus Map</h1>
      <StatusToggle value={filters.status} onChange={(status) => setFilters((f) => ({ ...f, status }))} />
    </div>
  );

  const chips = (
    <CategoryChips value={filters.categories} onChange={(categories) => setFilters((f) => ({ ...f, categories }))} />
  );

  // No Supabase project: say so. Rendering the map with "no activities match"
  // here would look like a quiet campus rather than a missing database.
  if (state === "unconfigured") {
    return (
      <div className="space-y-3">
        {header}
        {chips}
        <NotConfiguredNotice />
      </div>
    );
  }

  const emptyCopy =
    state === "no-matches"
      ? { title: "No activities match your filters", hint: "Try clearing the category chips or the status filter." }
      : { title: "Nothing on campus yet", hint: "Use + Host Activity at the top to put the first pin on the map." };

  return (
    <div className="space-y-4">
      {header}
      {chips}

      {state === "error" ? (
        <ErrorState title="Couldn't load activities" message={error} onRetry={retry} retrying={retrying} />
      ) : state === "loading" ? (
        <div className="space-y-4">
          <div
            className="h-[45vh] min-h-[260px] animate-pulse rounded-3xl bg-white/60"
            role="status"
            aria-busy="true"
            aria-label="Loading campus map"
          />
          <LoadingGrid count={3} label="Loading activities…" />
        </div>
      ) : (
        <>
          <div className="relative" id="campus-map">
            <CampusMap
              activities={filtered}
              selectedId={selected}
              onSelect={setSelected}
              className="sticker scroll-mt-24 h-[55vh] max-h-[520px] min-h-[300px] rounded-3xl"
            />
            {placeable.length === 0 && (
              <p className="pointer-events-none absolute left-1/2 top-4 z-[900] w-max max-w-[90%] -translate-x-1/2 rounded-full border-2 border-ink bg-white px-4 py-2 text-center text-sm font-extrabold">
                {unplaceable.length > 0
                  ? "Nothing could be placed — see the list below."
                  : "No activities to show on the map yet."}
              </p>
            )}
          </div>

          {/* The list is always present, so a failed tile load or an activity with
              unusable coordinates is still reachable. */}
          <section aria-labelledby="map-list">
            <h2 id="map-list" className="mb-3 font-display text-2xl font-bold">
              📋 Activities
              {filtered.length > 0 && (
                <span className="ml-1 rounded-full border-2 border-ink bg-white px-2 py-0.5 align-middle text-sm">{filtered.length}</span>
              )}
            </h2>

            {unplaceable.length > 0 && (
              <p className="mb-3 rounded-2xl border-2 border-ink bg-sun/40 p-3 text-sm font-bold">
                {unplaceable.length === 1
                  ? "1 activity has no usable location and is shown in this list only."
                  : `${unplaceable.length} activities have no usable location and are shown in this list only.`}
              </p>
            )}

            {filtered.length === 0 ? (
              <EmptyState
                title={emptyCopy.title}
                hint={emptyCopy.hint}
                action={
                  hasFilters ? (
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
            ) : (
              <div className={GRID}>
                {filtered.map((a) => (
                  <div key={a.id} className="flex flex-col gap-2">
                    {placedIds.has(a.id) ? (
                      <button
                        type="button"
                        onClick={() => showOnMap(a.id)}
                        aria-label={`Show ${a.title} on the map`}
                        className="sticker-sm pop w-fit rounded-full border-2 border-ink bg-lavender px-3 py-1 text-sm font-extrabold"
                      >
                        📍 {locationLabel(a.location_name)} — show on map
                      </button>
                    ) : (
                      <p className="w-fit rounded-full border-2 border-dashed border-ink bg-white px-3 py-1 text-sm font-extrabold">
                        📍 {locationLabel(a.location_name)} — not on the map
                      </p>
                    )}
                    <ActivityCard a={a} />
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
