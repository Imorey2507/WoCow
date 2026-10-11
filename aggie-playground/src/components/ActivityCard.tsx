"use client";

import { useState } from "react";
import type { Activity } from "@/lib/types";
import { categoryOf } from "@/lib/categories";
import { durationLabel, relativeStart, timeLabel } from "@/lib/format";
import { useActivities } from "./ActivitiesProvider";
import { useAuth } from "./AuthProvider";
import { useUI } from "./UIProvider";

export function CategoryTag({ name, sub }: { name: string; sub?: string }) {
  const c = categoryOf(name);
  return (
    <span className="inline-flex items-center gap-1 rounded-full border-2 border-ink px-2.5 py-0.5 text-xs font-extrabold" style={{ background: c.color, color: c.ink }}>
      <span aria-hidden="true">{c.emoji}</span>
      {sub ?? c.name}
    </span>
  );
}

export function StatusBadge({ a }: { a: Activity }) {
  if (a.live_status === "live")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-white px-2 py-0.5 text-xs font-extrabold">
        <span className="live-dot h-2.5 w-2.5 rounded-full bg-red-500" /> LIVE
      </span>
    );
  return <span className="rounded-full border-2 border-ink bg-white px-2 py-0.5 text-xs font-extrabold">{relativeStart(a)}</span>;
}

export function JoinButton({ a, className = "" }: { a: Activity; className?: string }) {
  const { joinedIds, join, leave } = useActivities();
  const { user } = useAuth();
  const { showToast } = useUI();
  const [busy, setBusy] = useState(false);
  const joined = joinedIds.has(a.id);
  const isHost = user?.id === a.host_id;
  const full = a.spots_remaining <= 0;

  async function click() {
    setBusy(true);
    const err = joined ? await leave(a.id) : await join(a.id);
    setBusy(false);
    if (err) showToast(err);
    else showToast(joined ? "You left the activity" : "You're in! 🎉");
  }

  if (isHost)
    return <span className={`rounded-2xl border-2 border-ink bg-lavender px-4 py-2 text-center text-sm font-extrabold ${className}`}>You&apos;re hosting</span>;

  const disabled = busy || (!joined && full);
  return (
    <button onClick={click} disabled={disabled} className={`sticker-sm pop rounded-2xl px-4 py-2 font-display text-base font-bold disabled:cursor-not-allowed disabled:opacity-60 ${joined ? "bg-white" : full ? "bg-ink/10" : "bg-grass"} ${className}`}>
      {busy ? "…" : joined ? "Leave" : full ? "Full" : "Join Activity"}
    </button>
  );
}

export function ActivityCard({ a, compact = false }: { a: Activity; compact?: boolean }) {
  const { user } = useAuth();
  const { openEdit } = useUI();
  const { cancelActivity } = useActivities();
  const { showToast } = useUI();
  const c = categoryOf(a.category);
  const pct = Math.min(100, Math.round((a.participant_count / a.max_participants) * 100));
  const isHost = user?.id === a.host_id;

  return (
    <article className="sticker pop flex flex-col gap-2 rounded-3xl bg-white p-4" style={{ borderTopColor: c.color }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <CategoryTag name={a.category} sub={a.subcategory} />
          {a.skill_level && <span className="rounded-full border-2 border-ink bg-cream px-2 py-0.5 text-xs font-extrabold">{a.skill_level}</span>}
          {a.is_demo && <span className="rounded-full border-2 border-dashed border-ink px-2 py-0.5 text-xs font-extrabold">DEMO</span>}
        </div>
        <StatusBadge a={a} />
      </div>

      <h3 className="font-display text-xl font-bold leading-tight">{a.title}</h3>
      <p className="text-sm font-bold text-ink/75">📍 {a.location_name}</p>
      <p className="text-sm font-bold text-ink/75">🕒 {timeLabel(a.starts_at)} · {durationLabel(a.duration_min)}</p>
      {!compact && a.description && <p className="line-clamp-2 text-sm font-semibold text-ink/70">{a.description}</p>}

      <div className="mt-1">
        <div className="flex items-baseline justify-between text-sm font-extrabold">
          <span>{a.participant_count} / {a.max_participants} players</span>
          <span className={a.spots_remaining <= 2 ? "text-red-600" : "text-ink/70"}>
            {a.spots_remaining === 0 ? "Full" : `${a.spots_remaining} spot${a.spots_remaining === 1 ? "" : "s"} left`}
          </span>
        </div>
        <div className="mt-1 h-3 overflow-hidden rounded-full border-2 border-ink bg-cream" role="progressbar" aria-valuenow={a.participant_count} aria-valuemin={0} aria-valuemax={a.max_participants}>
          <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, background: c.color }} />
        </div>
      </div>

      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-extrabold text-ink/70">
          <span className="grid h-6 w-6 place-items-center rounded-full border-2 border-ink text-sm" style={{ background: a.host_color ?? "#ffd84d" }}>{a.host_emoji ?? "🐮"}</span>
          {a.host_name ?? "Aggie"}
        </span>
        <div className="flex gap-2">
          {isHost && (
            <>
              <button onClick={() => openEdit(a)} className="sticker-sm pop rounded-2xl bg-white px-3 py-2 text-sm font-extrabold">Edit</button>
              <button
                onClick={async () => {
                  if (!confirm("Cancel this activity? Everyone who joined will be notified.")) return;
                  const err = await cancelActivity(a.id);
                  showToast(err ?? "Activity cancelled");
                }}
                className="sticker-sm pop rounded-2xl bg-coral px-3 py-2 text-sm font-extrabold"
              >
                Cancel
              </button>
            </>
          )}
          <JoinButton a={a} />
        </div>
      </div>
    </article>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint: string; action?: React.ReactNode }) {
  return (
    <div className="sticker-sm rounded-3xl border-dashed bg-white/70 p-6 text-center">
      <div className="text-4xl" aria-hidden="true">🐄</div>
      <p className="mt-2 font-display text-lg font-bold">{title}</p>
      <p className="mx-auto max-w-sm text-sm font-semibold text-ink/70">{hint}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
