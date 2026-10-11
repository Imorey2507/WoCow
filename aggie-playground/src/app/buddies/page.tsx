"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase/client";
import { categoryOf } from "@/lib/categories";
import type { Profile } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { useUI } from "@/components/UIProvider";
import { EmptyState } from "@/components/ActivityCard";
import { Cow } from "@/components/Cow";

interface Req {
  id: string;
  from_user: string;
  to_user: string;
  status: "pending" | "accepted" | "declined";
}

/** Transparent score: +1 per shared favorite category, +2 per shared preferred activity. */
function score(me: Profile, other: Profile) {
  const cats = other.favorite_categories.filter((c) => me.favorite_categories.includes(c));
  const acts = other.preferred_activities.filter((a) => me.preferred_activities.includes(a));
  return { cats, acts, total: cats.length + acts.length * 2 };
}

export default function BuddiesPage() {
  const { user, profile, setAuthOpen, loading } = useAuth();
  const { showToast } = useUI();
  const [others, setOthers] = useState<Profile[]>([]);
  const [reqs, setReqs] = useState<Req[]>([]);
  const [names, setNames] = useState<Record<string, Profile>>({});
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const sb = getSupabase();
    const [{ data: people }, { data: rq }] = await Promise.all([
      sb.from("public_profiles").select("*").eq("discoverable", true).neq("id", user.id).limit(100),
      sb.from("buddy_requests").select("*"),
    ]);
    const list = (people ?? []) as Profile[];
    const rlist = (rq ?? []) as Req[];
    setOthers(list);
    setReqs(rlist);
    // Names of people who requested me but may not be discoverable.
    const need = rlist.map((r) => (r.from_user === user.id ? r.to_user : r.from_user)).filter((id) => !list.some((p) => p.id === id));
    if (need.length) {
      const { data } = await sb.from("public_profiles").select("*").in("id", need);
      setNames(Object.fromEntries(((data ?? []) as Profile[]).map((p) => [p.id, p])));
    }
    setReady(true);
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch; state is set after the network call resolves
    void load();
  }, [load]);

  const ranked = useMemo(() => {
    if (!profile) return [];
    return others.map((p) => ({ p, s: score(profile, p) })).sort((a, b) => b.s.total - a.s.total);
  }, [others, profile]);

  if (loading) return <div className="h-40 animate-pulse rounded-3xl bg-white/60" />;
  if (!user || !profile)
    return (
      <div className="mx-auto max-w-md pt-6 text-center">
        <Cow size={120} className="floaty mx-auto" />
        <h1 className="mt-2 font-display text-3xl font-bold">Find your people</h1>
        <p className="font-semibold text-ink/75">Sign in to match with students who share your interests.</p>
        <button onClick={() => setAuthOpen(true)} className="sticker pop mt-4 rounded-2xl bg-sun px-6 py-3 font-display text-lg font-bold">Sign in</button>
      </div>
    );

  const relation = (id: string) => reqs.find((r) => (r.from_user === user.id && r.to_user === id) || (r.to_user === user.id && r.from_user === id));

  async function connect(id: string) {
    const { error } = await getSupabase().from("buddy_requests").insert({ from_user: user!.id, to_user: id });
    showToast(error ? (error.message.includes("duplicate") ? "Request already sent" : error.message) : "Buddy request sent 🤝");
    void load();
  }
  async function respond(id: string, status: "accepted" | "declined") {
    const { error } = await getSupabase().from("buddy_requests").update({ status }).eq("id", id);
    showToast(error ? error.message : status === "accepted" ? "You're buddies! 🎉" : "Request declined");
    void load();
  }

  const incoming = reqs.filter((r) => r.to_user === user.id && r.status === "pending");
  const buddies = reqs.filter((r) => r.status === "accepted");
  const nameOf = (id: string) => others.find((p) => p.id === id) ?? names[id];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">🤝 Matching Buddies</h1>
        <p className="font-semibold text-ink/75">Gym buddies, study partners, teammates. Only students who opted in appear here. Score = +1 per shared category, +2 per shared activity.</p>
      </div>

      {!profile.discoverable && (
        <div className="sticker-sm rounded-3xl bg-sun/70 p-4 font-bold">
          You&apos;re hidden from others right now. <Link href="/profile" className="underline decoration-2 underline-offset-4">Opt in on your profile</Link> if you want to be found.
        </div>
      )}
      {profile.favorite_categories.length === 0 && (
        <div className="sticker-sm rounded-3xl bg-white p-4 font-bold">
          Pick favorite categories on <Link href="/profile" className="underline decoration-2 underline-offset-4">your profile</Link> to get ranked matches.
        </div>
      )}

      {incoming.length > 0 && (
        <section aria-labelledby="inc">
          <h2 id="inc" className="mb-3 font-display text-2xl font-bold">📬 Requests for you</h2>
          <ul className="space-y-2">
            {incoming.map((r) => {
              const p = nameOf(r.from_user);
              return (
                <li key={r.id} className="sticker-sm flex items-center justify-between gap-3 rounded-2xl bg-white p-3">
                  <span className="font-bold">{p?.avatar_emoji ?? "🐮"} {p?.display_name ?? "An Aggie"} wants to connect</span>
                  <span className="flex gap-2">
                    <button onClick={() => void respond(r.id, "accepted")} className="sticker-sm pop rounded-full bg-grass px-3 py-1 text-sm font-extrabold">Accept</button>
                    <button onClick={() => void respond(r.id, "declined")} className="sticker-sm pop rounded-full bg-white px-3 py-1 text-sm font-extrabold">Decline</button>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {buddies.length > 0 && (
        <section aria-labelledby="bud">
          <h2 id="bud" className="mb-3 font-display text-2xl font-bold">🎉 Your buddies</h2>
          <div className="flex flex-wrap gap-2">
            {buddies.map((r) => {
              const p = nameOf(r.from_user === user.id ? r.to_user : r.from_user);
              return <span key={r.id} className="sticker-sm rounded-full bg-grass/70 px-3 py-1 font-extrabold">{p?.avatar_emoji ?? "🐮"} {p?.display_name ?? "Aggie"}</span>;
            })}
          </div>
        </section>
      )}

      <section aria-labelledby="disc">
        <h2 id="disc" className="mb-3 font-display text-2xl font-bold">People who share your interests</h2>
        {!ready ? (
          <div className="h-32 animate-pulse rounded-3xl bg-white/60" />
        ) : ranked.length === 0 ? (
          <EmptyState title="No one else has opted in yet" hint="As soon as other students turn on matching, they'll show up here. Invite a friend!" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ranked.map(({ p, s }) => {
              const rel = relation(p.id);
              return (
                <article key={p.id} className="sticker pop flex flex-col gap-2 rounded-3xl bg-white p-4">
                  <div className="flex items-center gap-3">
                    <div className="sticker-sm grid h-12 w-12 place-items-center rounded-full text-2xl" style={{ background: p.avatar_color }}>{p.avatar_emoji}</div>
                    <div className="min-w-0">
                      <h3 className="truncate font-display text-lg font-bold">{p.display_name}</h3>
                      {p.is_demo && <span className="rounded-full border-2 border-dashed border-ink px-2 text-xs font-extrabold">DEMO PROFILE</span>}
                    </div>
                  </div>
                  {p.bio && <p className="line-clamp-2 text-sm font-semibold text-ink/75">{p.bio}</p>}
                  <p className="text-xs font-extrabold text-ink/60">Interested in</p>
                  <div className="flex flex-wrap gap-1">
                    {[...p.favorite_categories.map((c) => ({ label: `${categoryOf(c).emoji} ${c}`, shared: s.cats.includes(c) })), ...p.preferred_activities.map((a) => ({ label: a, shared: s.acts.includes(a) }))].slice(0, 8).map((t) => (
                      <span key={t.label} className={`rounded-full border-2 border-ink px-2 py-0.5 text-xs font-extrabold ${t.shared ? "bg-grass" : "bg-cream"}`}>{t.label}</span>
                    ))}
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-1">
                    <span className="text-sm font-extrabold">{s.cats.length + s.acts.length} shared interest{s.cats.length + s.acts.length === 1 ? "" : "s"}</span>
                    {rel ? (
                      <span className="rounded-full border-2 border-ink bg-cream px-3 py-1 text-sm font-extrabold">{rel.status === "accepted" ? "Buddies ✓" : rel.status === "declined" ? "Declined" : rel.from_user === user.id ? "Request sent" : "Wants to connect"}</span>
                    ) : (
                      <button onClick={() => void connect(p.id)} className="sticker-sm pop rounded-full bg-sky px-4 py-1.5 font-display font-bold">Connect</button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
