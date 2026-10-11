import type { Profile } from "../../lib/types";

export interface BuddyRequest {
  id: string;
  from_user: string;
  to_user: string;
  status: "pending" | "accepted" | "declined";
}

/** Count each shared preference once, retaining the viewer's preference order. */
function shared(a: string[], b: string[]): string[] {
  return [...new Set(a)].filter((value) => value.trim() && b.includes(value));
}

export function scoreBuddy(me: Profile, other: Profile) {
  const cats = shared(me.favorite_categories, other.favorite_categories);
  const acts = shared(me.preferred_activities, other.preferred_activities);
  return { cats, acts, total: cats.length + acts.length * 2 };
}

/** Only opted-in students with a real shared interest are recommendations. */
export function rankBuddies(me: Profile, people: Profile[]) {
  return people
    .filter((p) => p.id !== me.id && p.discoverable)
    .map((p) => ({ p, s: scoreBuddy(me, p) }))
    .filter(({ s }) => s.total > 0)
    .sort((a, b) => b.s.total - a.s.total || a.p.id.localeCompare(b.p.id));
}

/** Resolve reciprocal rows consistently; an accepted connection takes priority. */
export function buddyRelation(requests: BuddyRequest[], viewerId: string, otherId: string) {
  const priority = { accepted: 0, pending: 1, declined: 2 };
  return requests.filter((r) =>
    (r.from_user === viewerId && r.to_user === otherId) ||
    (r.to_user === viewerId && r.from_user === otherId))
    .sort((a, b) => priority[a.status] - priority[b.status] ||
      Number(b.to_user === viewerId) - Number(a.to_user === viewerId) ||
      a.id.localeCompare(b.id))[0];
}

/** An in-flight action marker, tagged with the viewer who started it. */
export interface BusyMarker {
  viewerId: string;
  key: string;
}

/**
 * A busy marker belongs to the viewer who started it.
 *
 * Without this, a request in flight for A would still render "Sending…" and
 * disable buttons after B signed in — a previous identity's action state leaking
 * into the current viewer's UI. Only the owning viewer ever sees the marker.
 */
export function busyForViewer(marker: BusyMarker | null, viewerId: string | null | undefined): string | null {
  if (!viewerId || !marker) return null;
  return marker.viewerId === viewerId ? marker.key : null;
}
