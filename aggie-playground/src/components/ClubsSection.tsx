"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase, supabaseConfigured } from "@/lib/supabase/client";
import type { ClubEvent } from "@/lib/types";
import { useAuth } from "./AuthProvider";
import { EmptyState } from "./ActivityCard";

interface SyncLog {
  ran_at: string;
  ok: boolean;
  error: string | null;
}

function when(iso: string | null) {
  if (!iso) return "Date on original page";
  return new Date(iso).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function ClubsSection() {
  const { user, requireAuth } = useAuth();
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [lastSync, setLastSync] = useState<SyncLog | null>(null);
  const [loading, setLoading] = useState(supabaseConfigured);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabaseConfigured) return;
    const sb = getSupabase();
    const since = new Date(Date.now() - 12 * 3600_000).toISOString();
    const [ev, log] = await Promise.all([
      sb.from("club_events").select("*").or(`starts_at.gte.${since},starts_at.is.null`).order("starts_at", { ascending: true, nullsFirst: false }).limit(60),
      sb.from("club_sync_log").select("ran_at,ok,error").order("ran_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setEvents((ev.data ?? []) as ClubEvent[]);
    setLastSync((log.data as SyncLog | null) ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch; state is set after the network call resolves
    void load();
  }, [load]);

  async function refresh() {
    if (!requireAuth()) return;
    setRefreshing(true);
    setMessage(null);
    try {
      const { data } = await getSupabase().auth.getSession();
      const res = await fetch("/api/clubs/refresh", {
        method: "POST",
        headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setMessage(body.error ?? body.results?.[0]?.error ?? "Refresh failed.");
      else {
        const r = body.results?.[0];
        if (r?.throttled) setMessage("Already refreshed in the last few minutes — showing the latest.");
        else if (r && !r.ok) setMessage(r.error);
        else setMessage(`Found ${r?.stored ?? 0} upcoming club events.`);
      }
    } catch {
      setMessage("Couldn't reach the server. Try again.");
    }
    await load();
    setRefreshing(false);
  }

  return (
    <section id="clubs" aria-labelledby="clubs-h" className="scroll-mt-24">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="clubs-h" className="font-display text-2xl font-bold">🎪 Campus Clubs</h2>
          <p className="text-sm font-bold text-ink/70">Official events from AggieLife, fetched with Context.dev. Not student-hosted — registration happens on the original site.</p>
        </div>
        <button onClick={refresh} disabled={refreshing} className="sticker-sm pop rounded-full bg-lavender px-4 py-2 font-display font-bold disabled:opacity-60">
          {refreshing ? "Fetching…" : "↻ Refresh from AggieLife"}
        </button>
      </div>

      {message && <p role="status" className="mb-3 rounded-2xl border-2 border-ink bg-white p-3 text-sm font-bold">{message}</p>}
      {lastSync && !lastSync.ok && (
        <p role="alert" className="mb-3 rounded-2xl border-2 border-ink bg-coral/40 p-3 text-sm font-bold">
          The last refresh failed: {lastSync.error}. Showing previously cached events only — nothing is substituted.
        </p>
      )}

      {loading ? (
        <div className="h-32 animate-pulse rounded-3xl bg-white/60" />
      ) : events.length === 0 ? (
        <EmptyState
          title={lastSync ? "No club events cached" : "No club events yet"}
          hint={lastSync ? "The last fetch didn't return any upcoming events." : "Hit refresh to pull the latest events from AggieLife."}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => (
            <article key={e.id} className="sticker pop flex flex-col gap-2 rounded-3xl bg-white p-4">
              <span className="w-fit rounded-full border-2 border-ink bg-lavender px-2.5 py-0.5 text-xs font-extrabold">OFFICIAL CLUB EVENT</span>
              <h3 className="font-display text-xl font-bold leading-tight">{e.title}</h3>
              {e.organization && <p className="text-sm font-extrabold text-ink/80">🏛️ {e.organization}</p>}
              <p className="text-sm font-bold text-ink/75">🕒 {when(e.starts_at)}</p>
              {e.location && <p className="text-sm font-bold text-ink/75">📍 {e.location}</p>}
              {e.description && <p className="line-clamp-3 text-sm font-semibold text-ink/70">{e.description}</p>}
              <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                <span className="text-xs font-bold text-ink/60">Source: {e.source_site}</span>
                <a href={e.event_url} target="_blank" rel="noopener noreferrer" className="sticker-sm pop rounded-2xl bg-sun px-3 py-2 text-sm font-extrabold">
                  View Original Event ↗
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
      {!user && <p className="mt-2 text-xs font-bold text-ink/60">Sign in to refresh the list.</p>}
    </section>
  );
}
