"use client";

import dynamic from "next/dynamic";
import type { Activity } from "@/lib/types";
import { categoryOf } from "@/lib/categories";
import { durationLabel, timeLabel } from "@/lib/format";
import { CategoryTag, JoinButton, StatusBadge } from "./ActivityCard";

const Inner = dynamic(() => import("./CampusMapInner"), {
  ssr: false,
  loading: () => <div className="grid h-full w-full place-items-center bg-[#e9f3d8] font-display text-lg font-bold">Loading campus… 🗺️</div>,
});

export function CampusMap({
  activities,
  selectedId,
  onSelect,
  interactive = true,
  className = "",
}: {
  activities: Activity[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  interactive?: boolean;
  className?: string;
}) {
  const selected = activities.find((a) => a.id === selectedId) ?? null;
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Inner activities={activities} selectedId={selectedId} onSelect={onSelect} interactive={interactive} />
      {interactive && selected && <PreviewCard a={selected} onClose={() => onSelect(null)} />}
    </div>
  );
}

function PreviewCard({ a, onClose }: { a: Activity; onClose: () => void }) {
  const c = categoryOf(a.category);
  return (
    <div className="slide-up sticker absolute inset-x-3 bottom-3 z-[1000] mx-auto max-w-md rounded-3xl bg-white p-4" style={{ borderTop: `8px solid ${c.color}` }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <CategoryTag name={a.category} sub={a.subcategory} />
          <StatusBadge a={a} />
        </div>
        <button onClick={onClose} className="sticker-sm grid h-7 w-7 shrink-0 place-items-center rounded-full bg-cream text-sm font-black" aria-label="Close preview">✕</button>
      </div>
      <h3 className="mt-2 font-display text-xl font-bold leading-tight">{a.title}</h3>
      <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-sm font-bold text-ink/80">
        <dt className="sr-only">Host</dt>
        <dd>{a.host_emoji ?? "🐮"} {a.host_name ?? "Aggie"}</dd>
        <dt className="sr-only">Location</dt>
        <dd>📍 {a.location_name}</dd>
        <dt className="sr-only">Start</dt>
        <dd>🕒 {timeLabel(a.starts_at)}</dd>
        <dt className="sr-only">Duration</dt>
        <dd>⏱ {durationLabel(a.duration_min)}</dd>
      </dl>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="text-sm font-extrabold">
          {a.participant_count} / {a.max_participants} players
          <div className="text-xs text-ink/70">{a.spots_remaining === 0 ? "Full" : `${a.spots_remaining} spot${a.spots_remaining === 1 ? "" : "s"} remaining`}</div>
        </div>
        <JoinButton a={a} />
      </div>
    </div>
  );
}
