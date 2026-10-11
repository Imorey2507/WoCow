"use client";

import { useState } from "react";
import type { Activity } from "@/lib/types";
import { categoryOf } from "@/lib/categories";
import { durationLabel, relativeStart, timeLabel } from "@/lib/format";
import { capacityPercent, joinButtonState, spotsLabel, type JoinButtonState } from "@/lib/ui";
import { useActivities } from "./ActivitiesProvider";
import { useAuth } from "./AuthProvider";
import { useUI } from "./UIProvider";

const TONES: Record<JoinButtonState["tone"], string> = {
  lavender: "bg-lavender",
  white: "bg-white",
  muted: "bg-ink/10",
  grass: "bg-grass",
};

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
  const state = joinButtonState({ isHost, joined, full, busy });

  async function click() {
    // The button is disabled while busy, but a click already queued in the same
    // tick can still land before React re-renders.
    if (busy) return;
    setBusy(true);
    try {
      const err = joined ? await leave(a.id) : await join(a.id);
      showToast(err ?? (joined ? "You left the activity" : "You're in! 🎉"));
    } finally {
      setBusy(false);
    }
  }

  if (state.kind === "host")
    return (
      <span className={`rounded-2xl border-2 border-ink px-4 py-2 text-center text-sm font-extrabold ${TONES[state.tone]} ${className}`}>
        {state.label}
      </span>
    );

  return (
    <button
      type="button"
      onClick={click}
      disabled={state.disabled}
      aria-label={state.ariaLabel}
      aria-busy={busy || undefined}
      className={`sticker-sm pop rounded-2xl px-4 py-2 font-display text-base font-bold disabled:cursor-not-allowed disabled:opacity-60 ${TONES[state.tone]} ${className}`}
    >
      {state.label}
    </button>
  );
}

export function ActivityCard({ a, compact = false }: { a: Activity; compact?: boolean }) {
  const { user } = useAuth();
  const { openEdit } = useUI();
  const { cancelActivity } = useActivities();
  const { showToast } = useUI();
  const [cancelling, setCancelling] = useState(false);
  const c = categoryOf(a.category);
  const pct = capacityPercent(a.participant_count, a.max_participants);
  const isHost = user?.id === a.host_id;

  async function cancel() {
    // Guarded so a double-click cannot send two cancel writes.
    if (cancelling) return;
    if (!confirm("Cancel this activity? Everyone who joined will be notified.")) return;
    setCancelling(true);
    try {
      const err = await cancelActivity(a.id);
      showToast(err ?? "Activity cancelled");
    } finally {
      setCancelling(false);
    }
  }

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
        <div className="flex items-baseline justify-between gap-2 text-sm font-extrabold">
          <span>{a.participant_count} / {a.max_participants} players</span>
          <span className={a.spots_remaining <= 2 ? "text-red-600" : "text-ink/70"}>{spotsLabel(a.spots_remaining)}</span>
        </div>
        <div
          className="mt-1 h-3 overflow-hidden rounded-full border-2 border-ink bg-cream"
          role="progressbar"
          aria-label="Participants"
          aria-valuenow={a.participant_count}
          aria-valuemin={0}
          aria-valuemax={a.max_participants}
          aria-valuetext={`${a.participant_count} of ${a.max_participants} players`}
        >
          <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, background: c.color }} aria-hidden="true" />
        </div>
      </div>

      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-extrabold text-ink/70">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-ink text-sm" style={{ background: a.host_color ?? "#ffd84d" }} aria-hidden="true">{a.host_emoji ?? "🐮"}</span>
          <span className="truncate">{a.host_name ?? "Aggie"}</span>
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {isHost && (
            <>
              <button type="button" onClick={() => openEdit(a)} className="sticker-sm pop rounded-2xl bg-white px-3 py-2 text-sm font-extrabold">Edit</button>
              <button
                type="button"
                onClick={cancel}
                disabled={cancelling}
                aria-busy={cancelling || undefined}
                className="sticker-sm pop rounded-2xl bg-coral px-3 py-2 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-60"
              >
                {cancelling ? "Cancelling…" : "Cancel"}
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
