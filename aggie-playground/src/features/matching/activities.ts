import type { Activity, Profile } from "../../lib/types";

export const ACTIVITY_MATCH_WEIGHTS = { interest: 0.6, timing: 0.3, space: 0.1 } as const;

export interface ActivityMatch {
  activity: Activity;
  score: number;
  reasons: string[];
  breakdown: { interest: number; timing: number; space: number };
}

/** Pure ranking using this app's profile and duration-based event contract. */
export function recommendActivities(
  activities: Activity[],
  profile: Profile | null,
  { now = new Date(), joinedIds = new Set<string>(), limit = 6 }: {
    now?: Date; joinedIds?: ReadonlySet<string>; limit?: number;
  } = {},
): ActivityMatch[] {
  if (!profile || !Number.isFinite(now.getTime())) return [];
  const matches: ActivityMatch[] = [];
  for (const activity of activities) {
    const start = new Date(activity.starts_at).getTime();
    const end = start + activity.duration_min * 60_000;
    if (activity.status !== "active" || activity.live_status === "cancelled" ||
        activity.live_status === "ended" || !Number.isFinite(start) ||
        !Number.isFinite(end) || activity.duration_min <= 0 || end <= now.getTime() ||
        !Number.isFinite(activity.max_participants) || activity.max_participants <= 0 ||
        !Number.isFinite(activity.spots_remaining) || activity.spots_remaining <= 0 ||
        joinedIds.has(activity.id) || activity.host_id === profile.id) continue;

    const category = profile.favorite_categories.includes(activity.category);
    const preferred = profile.preferred_activities.includes(activity.subcategory);
    if (!category && !preferred) continue;
    const live = start <= now.getTime();
    const hoursUntil = (start - now.getTime()) / 3_600_000;
    const breakdown = {
      interest: preferred ? 1 : 0.65,
      timing: live ? 0.9 : hoursUntil <= 0.5 ? 1 : Math.max(0, 1 - hoursUntil / 168),
      space: Number.isFinite(activity.max_participants) && activity.max_participants > 0
        ? Math.min(1, activity.spots_remaining / activity.max_participants) : 0,
    };
    const score = Math.round(100 * (
      breakdown.interest * ACTIVITY_MATCH_WEIGHTS.interest +
      breakdown.timing * ACTIVITY_MATCH_WEIGHTS.timing +
      breakdown.space * ACTIVITY_MATCH_WEIGHTS.space));
    const reasons = [preferred ? `You picked ${activity.subcategory}` : `You like ${activity.category}`];
    if (live) reasons.push("Happening now");
    else if (hoursUntil <= 0.5) reasons.push("Starting within 30 minutes");
    matches.push({ activity, score, reasons, breakdown });
  }
  return matches.sort((a, b) => b.score - a.score ||
    new Date(a.activity.starts_at).getTime() - new Date(b.activity.starts_at).getTime() ||
    a.activity.id.localeCompare(b.activity.id))
    .slice(0, Math.max(0, Math.floor(limit)));
}
