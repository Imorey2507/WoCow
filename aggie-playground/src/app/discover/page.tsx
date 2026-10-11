"use client";

import { useMemo, useState } from "react";
import { useActivities } from "@/components/ActivitiesProvider";
import { useAuth } from "@/components/AuthProvider";
import { ActivityCard, EmptyState } from "@/components/ActivityCard";
import { CategoryChips, StatusToggle, applyFilters, DEFAULT_FILTERS, type FilterState } from "@/components/Filters";
import { ClubsSection } from "@/components/ClubsSection";
import { Discussions } from "@/components/Discussions";

export default function DiscoverPage() {
  const { activities, loading } = useActivities();
  const { profile } = useAuth();
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const filtered = useMemo(() => applyFilters(activities, filters), [activities, filters]);
  const live = filtered.filter((a) => a.live_status === "live");
  const soon = filtered.filter((a) => a.live_status === "upcoming");

  // Transparent recommendation: activities in your favorite categories, soonest first.
  const favs = useMemo(() => profile?.favorite_categories ?? [], [profile]);
  const recommended = useMemo(
    () => (favs.length ? activities.filter((a) => favs.includes(a.category) && a.spots_remaining > 0).slice(0, 6) : []),
    [activities, favs],
  );

  const grid = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-3xl font-bold">🔥 Discover</h1>
        <nav aria-label="Jump to" className="flex gap-2 text-sm font-extrabold">
          <a href="#clubs" className="sticker-sm pop rounded-full bg-lavender px-3 py-1">Clubs</a>
          <a href="#discussions" className="sticker-sm pop rounded-full bg-sky px-3 py-1">Discussions</a>
        </nav>
      </div>

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

      {favs.length > 0 && recommended.length > 0 && (
        <section aria-labelledby="rec">
          <h2 id="rec" className="mb-3 font-display text-2xl font-bold">✨ Recommended for You</h2>
          <p className="-mt-2 mb-3 text-sm font-bold text-ink/70">Because you picked: {favs.join(", ")}</p>
          <div className={grid}>{recommended.map((a) => <ActivityCard key={a.id} a={a} />)}</div>
        </section>
      )}

      <section aria-labelledby="now">
        <h2 id="now" className="mb-3 font-display text-2xl font-bold">🔴 Happening Now <span className="ml-1 rounded-full border-2 border-ink bg-white px-2 py-0.5 align-middle text-sm">{live.length}</span></h2>
        {loading ? <div className="h-32 animate-pulse rounded-3xl bg-white/60" /> : live.length ? <div className={grid}>{live.map((a) => <ActivityCard key={a.id} a={a} />)}</div> : <EmptyState title="Nothing live right now" hint="Check Starting Soon below, or host something yourself." />}
      </section>

      <section aria-labelledby="soon">
        <h2 id="soon" className="mb-3 font-display text-2xl font-bold">⏰ Starting Soon <span className="ml-1 rounded-full border-2 border-ink bg-white px-2 py-0.5 align-middle text-sm">{soon.length}</span></h2>
        {loading ? <div className="h-32 animate-pulse rounded-3xl bg-white/60" /> : soon.length ? <div className={grid}>{soon.map((a) => <ActivityCard key={a.id} a={a} />)}</div> : <EmptyState title="No upcoming activities match" hint="Try clearing filters or host the first one." />}
      </section>

      <ClubsSection />
      <Discussions />
    </div>
  );
}
