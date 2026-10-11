"use client";

import { useEffect, useMemo, useState } from "react";
import type { Activity, Profile } from "@/lib/types";
import { recommendActivities } from "./activities";

/** Reuses the existing activity feed; opens no extra database subscription. */
export function useActivityMatches(activities: Activity[], profile: Profile | null, joinedIds: ReadonlySet<string>) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const refresh = () => setNow(new Date());
    // Next.js cacheComponents cannot read the current time during prerender.
    const initialTick = setTimeout(refresh, 0);
    const timer = setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    return () => {
      clearTimeout(initialTick);
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  return useMemo(() => now ? recommendActivities(activities, profile, { now, joinedIds }) : [], [activities, profile, joinedIds, now]);
}
