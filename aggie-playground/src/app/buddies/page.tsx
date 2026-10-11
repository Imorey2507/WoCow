"use client";

import { useMemo } from "react";
import Link from "next/link";
import { categoryOf } from "@/lib/categories";
import { useAuth } from "@/components/AuthProvider";
import { useUI } from "@/components/UIProvider";
import { EmptyState } from "@/components/ActivityCard";
import { Cow } from "@/components/Cow";
import { buddyRelation, rankBuddies } from "@/features/matching/buddies";
import { useBuddyFeed } from "@/features/matching/useBuddyFeed";

export default function BuddiesPage() {
  const { user, profile, setAuthOpen, loading } = useAuth();
  const { showToast } = useUI();
  const { others, reqs, names, ready, error, busy, refresh, connect: send, respond: reply } = useBuddyFeed(user?.id);
  const ranked = useMemo(() => profile ? rankBuddies(profile, others) : [], [others, profile]);

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

  const relation = (id: string) => buddyRelation(reqs, user.id, id);

  async function connect(id: string) {
    const error = await send(id);
    showToast(error ?? "Buddy request sent 🤝");
  }
  async function respond(id: string, status: "accepted" | "declined") {
    const error = await reply(id, status);
    showToast(error ?? (status === "accepted" ? "You're buddies! 🎉" : "Request declined"));
  }

  const incoming = reqs.filter((r) => r.to_user === user.id && r.status === "pending" && relation(r.from_user)?.id === r.id);
  const buddies = reqs.filter((r) => r.status === "accepted" && relation(r.from_user === user.id ? r.to_user : r.from_user)?.id === r.id);
  const nameOf = (id: string) => others.find((p) => p.id === id) ?? names[id];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">🤝 Matching Buddies</h1>
        <p className="font-semibold text-ink/75">Gym buddies, study partners, teammates. Only students who opted in appear here. Score = +1 per shared category, +2 per shared activity.</p>
      </div>

      {error && (
        <div role="alert" className="rounded-2xl border-2 border-ink bg-coral/40 p-3 font-bold">
          Couldn&apos;t refresh matches: {error}
          <button onClick={() => void refresh()} className="ml-3 underline">Retry</button>
        </div>
      )}

      {!profile.discoverable && (
        <div className="sticker-sm rounded-3xl bg-sun/70 p-4 font-bold">
          You&apos;re hidden from others right now. <Link href="/profile" className="underline decoration-2 underline-offset-4">Opt in on your profile</Link> if you want to be found.
        </div>
      )}
      {profile.favorite_categories.length === 0 && profile.preferred_activities.length === 0 && (
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
                    <button disabled={busy !== null} onClick={() => void respond(r.id, "accepted")} className="sticker-sm pop rounded-full bg-grass px-3 py-1 text-sm font-extrabold disabled:opacity-60">{busy === r.id ? "Updating…" : "Accept"}</button>
                    <button disabled={busy !== null} onClick={() => void respond(r.id, "declined")} className="sticker-sm pop rounded-full bg-white px-3 py-1 text-sm font-extrabold disabled:opacity-60">Decline</button>
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
        ) : error && others.length === 0 ? (
          <EmptyState title="Matches unavailable" hint="Retry above to load students and requests." />
        ) : ranked.length === 0 ? (
          <EmptyState
            title={others.length ? "No shared interests yet" : "No one else has opted in yet"}
            hint={others.length ? "Update your favorite categories and preferred activities on your profile, or check back as more students join." : "As soon as other students turn on matching, they'll show up here. Invite a friend!"}
          />
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
                    {[...p.favorite_categories.map((c) => ({ label: `${categoryOf(c).emoji} ${c}`, shared: s.cats.includes(c) })), ...p.preferred_activities.map((a) => ({ label: a, shared: s.acts.includes(a) }))].sort((a, b) => Number(b.shared) - Number(a.shared)).slice(0, 8).map((t) => (
                      <span key={t.label} className={`rounded-full border-2 border-ink px-2 py-0.5 text-xs font-extrabold ${t.shared ? "bg-grass" : "bg-cream"}`}>{t.label}</span>
                    ))}
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-1">
                    <span className="text-sm font-extrabold" title={`${s.cats.length} shared categories + 2 × ${s.acts.length} shared activities`}>
                      {s.cats.length + s.acts.length} shared interest{s.cats.length + s.acts.length === 1 ? "" : "s"} · {s.total} points
                    </span>
                    {rel ? (
                      <span className="rounded-full border-2 border-ink bg-cream px-3 py-1 text-sm font-extrabold">{rel.status === "accepted" ? "Buddies ✓" : rel.status === "declined" ? "Declined" : rel.from_user === user.id ? "Request sent" : "Wants to connect"}</span>
                    ) : (
                      <button disabled={busy !== null} onClick={() => void connect(p.id)} className="sticker-sm pop rounded-full bg-sky px-4 py-1.5 font-display font-bold disabled:opacity-60">{busy === p.id ? "Sending…" : "Connect"}</button>
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
