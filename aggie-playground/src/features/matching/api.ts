import { getSupabase } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import type { BuddyRequest } from "./buddies";

const PUBLIC_FIELDS = "id,display_name,avatar_emoji,avatar_color,bio,favorite_categories,preferred_activities,discoverable,is_demo";
const PAGE_SIZE = 100;

/** Read the public, opt-in view, never another student's private profile row. */
export async function getBuddyFeed(viewerId: string, signal: AbortSignal) {
  const sb = getSupabase();
  const people: Profile[] = [];
  // Paginate rather than score only the first arbitrary 100 students.
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await sb.from("public_profiles").select(PUBLIC_FIELDS)
      .eq("discoverable", true).neq("id", viewerId).order("id")
      .range(offset, offset + PAGE_SIZE - 1).abortSignal(signal);
    if (error) throw new Error(error.message);
    people.push(...(data ?? []) as Profile[]);
    if (!data || data.length < PAGE_SIZE) break;
  }
  const { data, error } = await sb.from("buddy_requests").select("id,from_user,to_user,status")
    .or(`from_user.eq.${viewerId},to_user.eq.${viewerId}`).abortSignal(signal);
  if (error) throw new Error(error.message);
  const requests = (data ?? []) as BuddyRequest[];
  const ids = [...new Set(requests.map((r) => r.from_user === viewerId ? r.to_user : r.from_user))]
    .filter((id) => !people.some((p) => p.id === id));
  const names: Record<string, Profile> = {};
  // Hidden users' name/avatar remain public; their bio/interests are redacted by the view.
  for (let offset = 0; offset < ids.length; offset += PAGE_SIZE) {
    const { data, error } = await sb.from("public_profiles").select(PUBLIC_FIELDS)
      .in("id", ids.slice(offset, offset + PAGE_SIZE)).abortSignal(signal);
    if (error) throw new Error(error.message);
    for (const p of (data ?? []) as Profile[]) names[p.id] = p;
  }
  return { people, requests, names };
}

export async function sendBuddyRequest(viewerId: string, targetId: string) {
  const { error } = await getSupabase().from("buddy_requests").insert({ from_user: viewerId, to_user: targetId });
  if (error) throw new Error(error.code === "23505" ? "Request already sent" : error.message);
}

export async function respondToBuddyRequest(viewerId: string, id: string, status: "accepted" | "declined") {
  const { data, error } = await getSupabase().from("buddy_requests").update({ status })
    .eq("id", id).eq("to_user", viewerId).eq("status", "pending").select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("This request has changed. Refresh and try again.");
}
