"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useActivities } from "@/components/ActivitiesProvider";
import { useAuth } from "@/components/AuthProvider";
import { useUI } from "@/components/UIProvider";
import { ActivityCard, EmptyState } from "@/components/ActivityCard";
import { CampusMap } from "@/components/CampusMap";
import { CategoryChips, applyFilters, DEFAULT_FILTERS } from "@/components/Filters";
import { Cow, Doodle, Student } from "@/components/Cow";

export default function Home() {
  const { activities, loading, error } = useActivities();
  const { requireAuth } = useAuth();
  const { openHost } = useUI();
  const [categories, setCategories] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = useMemo(() => applyFilters(activities, { ...DEFAULT_FILTERS, categories }), [activities, categories]);
  const live = filtered.filter((a) => a.live_status === "live");
  const soon = filtered.filter((a) => a.live_status === "upcoming").slice(0, 6);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="sticker relative overflow-hidden rounded-[2rem] bg-sun p-5 sm:p-8">
        <Doodle kind="sun" className="floaty absolute right-4 top-3 h-12 w-12 sm:h-16 sm:w-16" />
        <Doodle kind="star" className="wiggle absolute bottom-24 right-24 hidden h-8 w-8 sm:block" />
        <div className="flex items-end justify-between gap-4">
          <div className="max-w-xl">
            <h1 className="font-display text-3xl font-bold leading-[1.05] sm:text-5xl">Your campus. Your people. Your next adventure.</h1>
            <p className="mt-2 text-base font-bold text-ink/80 sm:text-lg">Discover what&apos;s happening around you, join spontaneous activities, and meet your people.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/map" className="sticker pop rounded-2xl bg-white px-5 py-3 font-display text-lg font-bold">🗺️ Explore Campus Map</Link>
              <button onClick={() => { if (requireAuth()) openHost(); }} className="sticker pop rounded-2xl bg-coral px-5 py-3 font-display text-lg font-bold">+ Host an Activity</button>
            </div>
          </div>
          <div className="relative hidden shrink-0 sm:block">
            <Cow size={150} className="floaty" />
            <Student className="absolute -left-10 bottom-0" shirt="#7ed68a" skin="#c68642" size={64} />
            <Student className="absolute -right-8 bottom-0" shirt="#b9a4ff" skin="#f2b37e" hair="#7a3b12" size={60} />
          </div>
        </div>
      </section>

      {error && <p role="alert" className="rounded-2xl border-2 border-ink bg-coral/40 p-3 font-bold">Couldn&apos;t load activities: {error}</p>}

      {/* Happening Now */}
      <section aria-labelledby="now">
        <SectionTitle id="now" emoji="🔴" title="Happening Now" count={live.length} />
        {loading ? (
          <SkeletonRow />
        ) : live.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{live.map((a) => <ActivityCard key={a.id} a={a} />)}</div>
        ) : (
          <EmptyState title="Quiet right now" hint="Nothing is live at the moment. Be the first to get something going!" action={<button onClick={() => { if (requireAuth()) openHost(); }} className="sticker-sm pop rounded-full bg-sun px-4 py-2 font-display font-bold">+ Host an Activity</button>} />
        )}
      </section>

      {/* Category filters */}
      <section aria-labelledby="cats">
        <SectionTitle id="cats" emoji="🎯" title="Find your thing" />
        <CategoryChips value={categories} onChange={setCategories} />
      </section>

      {/* Starting soon */}
      <section aria-labelledby="soon">
        <SectionTitle id="soon" emoji="⏰" title="Starting Soon" count={soon.length} href="/discover" />
        {loading ? (
          <SkeletonRow />
        ) : soon.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{soon.map((a) => <ActivityCard key={a.id} a={a} />)}</div>
        ) : (
          <EmptyState title="Nothing coming up" hint={categories.length ? "No upcoming activities match those categories. Try clearing a filter." : "No upcoming activities yet. Host one and it shows up here instantly."} />
        )}
      </section>

      {/* Map preview */}
      <section aria-labelledby="mappreview">
        <SectionTitle id="mappreview" emoji="📍" title="Campus map" href="/map" />
        <CampusMap activities={filtered} selectedId={selected} onSelect={setSelected} className="sticker h-[360px] rounded-3xl" />
      </section>

      {/* Campus clubs teaser */}
      <section aria-labelledby="clubs">
        <SectionTitle id="clubs" emoji="🎪" title="Campus Clubs" href="/discover#clubs" />
        <Link href="/discover#clubs" className="sticker pop block rounded-3xl bg-lavender p-5 font-display text-lg font-bold">
          Official club events from AggieLife, pulled live via Context.dev → See what clubs are up to
        </Link>
      </section>
    </div>
  );
}

function SectionTitle({ id, emoji, title, count, href }: { id: string; emoji: string; title: string; count?: number; href?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 id={id} className="font-display text-2xl font-bold">
        {emoji} {title} {count !== undefined && <span className="ml-1 rounded-full border-2 border-ink bg-white px-2 py-0.5 align-middle text-sm">{count}</span>}
      </h2>
      {href && <Link href={href} className="text-sm font-extrabold underline decoration-2 underline-offset-4">See all →</Link>}
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
      {[0, 1, 2].map((i) => <div key={i} className="h-44 animate-pulse rounded-3xl border-2 border-ink/30 bg-white/60" />)}
    </div>
  );
}
