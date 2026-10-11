"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getSupabase, supabaseConfigured } from "@/lib/supabase/client";
import type { Activity } from "@/lib/types";
import { useAuth } from "./AuthProvider";

interface ActivitiesCtx {
  activities: Activity[];
  joinedIds: Set<string>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  join: (id: string) => Promise<string | null>;
  leave: (id: string) => Promise<string | null>;
  cancelActivity: (id: string) => Promise<string | null>;
}

const Ctx = createContext<ActivitiesCtx | null>(null);

export function useActivities() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useActivities must be used inside ActivitiesProvider");
  return v;
}

const JOIN_ERRORS: Record<string, string> = {
  full: "Someone just grabbed the last spot — this one is full.",
  already_joined: "You're already in this one!",
  cancelled: "This activity was cancelled.",
  ended: "This activity has already ended.",
  not_found: "That activity no longer exists.",
  not_authenticated: "Please sign in first.",
};

function friendlyError(message: string): string {
  for (const key of Object.keys(JOIN_ERRORS)) if (message.includes(key)) return JOIN_ERRORS[key];
  return message;
}

export function ActivitiesProvider({ children }: { children: React.ReactNode }) {
  const { user, requireAuth } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(supabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    if (!supabaseConfigured) return;
    const sb = getSupabase();
    // The feed shows only live and upcoming activities; ended and cancelled ones drop out.
    const { data, error: err } = await sb
      .from("activity_feed")
      .select("*")
      .neq("live_status", "cancelled")
      .neq("live_status", "ended")
      .order("starts_at", { ascending: true });
    if (err) {
      setError(err.message);
    } else {
      setError(null);
      setActivities((data ?? []) as Activity[]);
    }
    if (user) {
      const { data: mine } = await sb.from("participants").select("activity_id").eq("user_id", user.id);
      setJoinedIds(new Set((mine ?? []).map((r: { activity_id: string }) => r.activity_id)));
    } else {
      setJoinedIds(new Set());
    }
    setLoading(false);
  }, [user]);

  // Coalesce bursts of realtime events into one refetch.
  const scheduleRefresh = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void refresh(), 150);
  }, [refresh]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch; state is set after the network call resolves
    void refresh();
    if (!supabaseConfigured) return;
    const sb = getSupabase();
    const channel = sb
      .channel("campus-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "activities" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "participants" }, scheduleRefresh)
      .subscribe();
    // Statuses (upcoming → live → ended) change with time, so re-evaluate every minute.
    const tick = setInterval(() => void refresh(), 60_000);
    return () => {
      clearInterval(tick);
      if (timer.current) clearTimeout(timer.current);
      void sb.removeChannel(channel);
    };
  }, [refresh, scheduleRefresh]);

  const join = useCallback(
    async (id: string) => {
      if (!requireAuth()) return "Sign in to join.";
      const { error: err } = await getSupabase().rpc("join_activity", { p_activity_id: id });
      await refresh();
      return err ? friendlyError(err.message) : null;
    },
    [requireAuth, refresh],
  );

  const leave = useCallback(
    async (id: string) => {
      const { error: err } = await getSupabase().rpc("leave_activity", { p_activity_id: id });
      await refresh();
      return err ? friendlyError(err.message) : null;
    },
    [refresh],
  );

  const cancelActivity = useCallback(
    async (id: string) => {
      // RLS guarantees only the host's update succeeds.
      const { error: err } = await getSupabase().from("activities").update({ status: "cancelled" }).eq("id", id);
      await refresh();
      return err ? err.message : null;
    },
    [refresh],
  );

  const value = useMemo(
    () => ({ activities, joinedIds, loading, error, refresh, join, leave, cancelActivity }),
    [activities, joinedIds, loading, error, refresh, join, leave, cancelActivity],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
