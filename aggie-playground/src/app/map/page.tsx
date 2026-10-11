"use client";

import { useMemo, useState } from "react";
import { useActivities } from "@/components/ActivitiesProvider";
import { CampusMap } from "@/components/CampusMap";
import { CategoryChips, StatusToggle, applyFilters, type FilterState } from "@/components/Filters";

export default function MapPage() {
  const { activities, loading } = useActivities();
  const [filters, setFilters] = useState<FilterState>({ categories: [], status: "all", query: "" });
  const [selected, setSelected] = useState<string | null>(null);
  const filtered = useMemo(() => applyFilters(activities, filters), [activities, filters]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-3xl font-bold">🗺️ Campus Map</h1>
        <StatusToggle value={filters.status} onChange={(status) => setFilters((f) => ({ ...f, status }))} />
      </div>
      <CategoryChips value={filters.categories} onChange={(categories) => setFilters((f) => ({ ...f, categories }))} />
      <div className="relative">
        <CampusMap activities={filtered} selectedId={selected} onSelect={setSelected} className="sticker h-[calc(100dvh-17rem)] min-h-[380px] rounded-3xl" />
        {!loading && filtered.length === 0 && (
          <p className="pointer-events-none absolute left-1/2 top-4 z-[900] -translate-x-1/2 rounded-full border-2 border-ink bg-white px-4 py-2 text-sm font-extrabold">
            No activities match — try clearing filters, or host one! 🐄
          </p>
        )}
      </div>
    </div>
  );
}
