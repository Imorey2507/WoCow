"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase/client";
import { CATEGORIES } from "@/lib/categories";
import type { AppNotification } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { useActivities } from "@/components/ActivitiesProvider";
import { useUI } from "@/components/UIProvider";
import { ActivityCard, EmptyState } from "@/components/ActivityCard";
import { Cow } from "@/components/Cow";

const EMOJIS = ["🐮", "😎", "🤓", "🏐", "🏀", "🥏", "🎨", "📚", "💪", "🧋", "🌻", "🚴"];
const COLORS = ["#ffd84d", "#7cc4ff", "#7ed68a", "#ff8fa3", "#b9a4ff", "#ffb454"];

const input = "w-full rounded-2xl border-2 border-ink bg-white px-3 py-2.5 text-base font-semibold outline-none focus:ring-4 focus:ring-sun/60";

export default function ProfilePage() {
  const { user, profile, loading, setAuthOpen, refreshProfile, signOut } = useAuth();
  const { activities, joinedIds } = useActivities();
  const { showToast } = useUI();

  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🐮");
  const [color, setColor] = useState("#ffd84d");
  const [bio, setBio] = useState("");
  const [favs, setFavs] = useState<string[]>([]);
  const [prefs, setPrefs] = useState<string[]>([]);
  const [discoverable, setDiscoverable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState<AppNotification[]>([]);

  // Hydrate the form once per loaded profile (adjusting state during render, not in an effect).
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);
  if (profile && hydratedFor !== profile.id) {
    setHydratedFor(profile.id);
    setName(profile.display_name);
    setEmoji(profile.avatar_emoji);
    setColor(profile.avatar_color);
    setBio(profile.bio);
    setFavs(profile.favorite_categories);
    setPrefs(profile.preferred_activities);
    setDiscoverable(profile.discoverable);
  }

  const loadNotes = useCallback(async () => {
    if (!user) return;
    const { data } = await getSupabase().from("notifications").select("*").order("created_at", { ascending: false }).limit(30);
    setNotes((data ?? []) as AppNotification[]);
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch; state is set after the network call resolves
    void loadNotes();
    if (!user) return;
    const sb = getSupabase();
    const ch = sb.channel(`notes-${user.id}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => void loadNotes()).subscribe();
    return () => {
      void sb.removeChannel(ch);
    };
  }, [user, loadNotes]);

  const hosted = useMemo(() => activities.filter((a) => a.host_id === user?.id), [activities, user]);
  const joined = useMemo(() => activities.filter((a) => joinedIds.has(a.id) && a.host_id !== user?.id), [activities, joinedIds, user]);
  const favSubs = useMemo(() => CATEGORIES.filter((c) => favs.includes(c.name)).flatMap((c) => c.subcategories), [favs]);

  if (loading) return <div className="h-40 animate-pulse rounded-3xl bg-white/60" />;
  if (!user)
    return (
      <div className="mx-auto max-w-md pt-6 text-center">
        <Cow size={120} mood="wow" className="floaty mx-auto" />
        <h1 className="mt-2 font-display text-3xl font-bold">Your profile awaits</h1>
        <p className="font-semibold text-ink/75">Sign in to track the activities you join and host, pick your interests, and meet your people.</p>
        <button onClick={() => setAuthOpen(true)} className="sticker pop mt-4 rounded-2xl bg-sun px-6 py-3 font-display text-lg font-bold">Sign in</button>
      </div>
    );

  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await getSupabase()
      .from("profiles")
      .update({ display_name: name.trim() || "Aggie", avatar_emoji: emoji, avatar_color: color, bio: bio.trim(), favorite_categories: favs, preferred_activities: prefs.filter((p) => favSubs.includes(p)), discoverable })
      .eq("id", user.id);
    setSaving(false);
    if (error) return showToast(error.message);
    await refreshProfile();
    showToast("Profile saved ✨");
  }

  async function markRead(id?: string) {
    const q = getSupabase().from("notifications").update({ read: true });
    await (id ? q.eq("id", id) : q.eq("read", false));
    void loadNotes();
  }

  const unread = notes.filter((n) => !n.read).length;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,26rem)_1fr]">
      <form onSubmit={save} className="sticker space-y-4 self-start rounded-3xl bg-white p-5">
        <div className="flex items-center gap-3">
          <div className="sticker grid h-16 w-16 place-items-center rounded-full text-3xl" style={{ background: color }}>{emoji}</div>
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl font-bold">{name || "Aggie"}</h1>
            <p className="truncate text-xs font-bold text-ink/60">Your email stays private.</p>
          </div>
        </div>

        <div><label className="mb-1 block text-sm font-extrabold" htmlFor="p-name">Display name</label><input id="p-name" className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} /></div>

        <div>
          <span className="mb-1 block text-sm font-extrabold">Avatar</span>
          <div className="flex flex-wrap gap-2">{EMOJIS.map((e) => <button type="button" key={e} onClick={() => setEmoji(e)} aria-pressed={emoji === e} aria-label={`Avatar ${e}`} className={`sticker-sm pop h-10 w-10 rounded-full text-xl ${emoji === e ? "bg-sun" : "bg-cream"}`}>{e}</button>)}</div>
          <div className="mt-2 flex gap-2">{COLORS.map((c) => <button type="button" key={c} onClick={() => setColor(c)} aria-pressed={color === c} aria-label={`Color ${c}`} className={`h-8 w-8 rounded-full border-2 border-ink ${color === c ? "ring-4 ring-ink/30" : ""}`} style={{ background: c }} />)}</div>
        </div>

        <div><label className="mb-1 block text-sm font-extrabold" htmlFor="p-bio">Bio</label><textarea id="p-bio" className={input} rows={2} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={200} placeholder="Major, vibe, what you're into…" /></div>

        <div>
          <span className="mb-1 block text-sm font-extrabold">Favorite categories <span className="font-semibold text-ink/60">(drives notifications &amp; matching)</span></span>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => {
              const on = favs.includes(c.name);
              return <button type="button" key={c.key} aria-pressed={on} onClick={() => setFavs(toggle(favs, c.name))} className="sticker-sm pop rounded-full px-3 py-1 text-sm font-extrabold" style={{ background: on ? c.color : "#fff" }}>{c.emoji} {c.name}</button>;
            })}
          </div>
        </div>

        {favSubs.length > 0 && (
          <div>
            <span className="mb-1 block text-sm font-extrabold">Preferred activities</span>
            <div className="flex flex-wrap gap-1.5">{favSubs.map((s) => <button type="button" key={s} aria-pressed={prefs.includes(s)} onClick={() => setPrefs(toggle(prefs, s))} className={`rounded-full border-2 border-ink px-2.5 py-0.5 text-xs font-extrabold ${prefs.includes(s) ? "bg-grass" : "bg-cream"}`}>{s}</button>)}</div>
          </div>
        )}

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-ink bg-cream p-3">
          <input type="checkbox" checked={discoverable} onChange={(e) => setDiscoverable(e.target.checked)} className="mt-1 h-5 w-5 accent-black" />
          <span className="text-sm font-bold">Let other students find me in Matching Buddies<br /><span className="font-semibold text-ink/70">Only your name, avatar, bio and interests are shown. Off by default.</span></span>
        </label>

        <div className="flex gap-2">
          <button disabled={saving} className="sticker pop flex-1 rounded-2xl bg-sun py-2.5 font-display text-lg font-bold disabled:opacity-60">{saving ? "Saving…" : "Save profile"}</button>
          <button type="button" onClick={() => void signOut()} className="sticker-sm pop rounded-2xl bg-white px-4 font-display font-bold">Sign out</button>
        </div>
      </form>

      <div className="space-y-8">
        <section aria-labelledby="notif">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="notif" className="font-display text-2xl font-bold">🔔 Notifications {unread > 0 && <span className="ml-1 rounded-full border-2 border-ink bg-coral px-2 py-0.5 align-middle text-sm">{unread}</span>}</h2>
            {unread > 0 && <button onClick={() => void markRead()} className="text-sm font-extrabold underline decoration-2 underline-offset-4">Mark all read</button>}
          </div>
          {notes.length === 0 ? (
            <EmptyState title="All quiet" hint="Pick favorite categories and you'll be notified when matching activities appear, or when something you joined changes." />
          ) : (
            <ul className="space-y-2">
              {notes.map((n) => (
                <li key={n.id}>
                  <button onClick={() => void markRead(n.id)} className={`sticker-sm w-full rounded-2xl p-3 text-left ${n.read ? "bg-white/70" : "bg-white"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display font-bold">{n.kind === "activity_cancelled" ? "❌" : n.kind === "activity_updated" ? "✏️" : "🆕"} {n.title}</span>
                      {!n.read && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-coral" aria-label="unread" />}
                    </div>
                    {n.body && <p className="text-sm font-semibold text-ink/75">{n.body}</p>}
                    <time className="text-xs font-bold text-ink/50">{new Date(n.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="hosted">
          <h2 id="hosted" className="mb-3 font-display text-2xl font-bold">🎤 Hosting <span className="ml-1 rounded-full border-2 border-ink bg-white px-2 py-0.5 align-middle text-sm">{hosted.length}</span></h2>
          {hosted.length ? <div className="grid gap-4 sm:grid-cols-2">{hosted.map((a) => <ActivityCard key={a.id} a={a} compact />)}</div> : <EmptyState title="Not hosting anything yet" hint="Use + Host Activity at the top to start something." />}
        </section>

        <section aria-labelledby="joined">
          <h2 id="joined" className="mb-3 font-display text-2xl font-bold">🎟️ Joined <span className="ml-1 rounded-full border-2 border-ink bg-white px-2 py-0.5 align-middle text-sm">{joined.length}</span></h2>
          {joined.length ? <div className="grid gap-4 sm:grid-cols-2">{joined.map((a) => <ActivityCard key={a.id} a={a} compact />)}</div> : <EmptyState title="Nothing joined yet" hint="Find something on the map and tap Join." action={<Link href="/map" className="sticker-sm pop rounded-full bg-sun px-4 py-2 font-display font-bold">Open map</Link>} />}
        </section>
      </div>
    </div>
  );
}
