"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase, supabaseConfigured } from "@/lib/supabase/client";
import { FORUM_TOPICS } from "@/lib/categories";
import { useAuth } from "./AuthProvider";
import { EmptyState } from "./ActivityCard";

interface Post {
  id: string;
  author_id: string;
  topic: string;
  title: string;
  body: string;
  created_at: string;
  public_profiles: { display_name: string; avatar_emoji: string; avatar_color: string } | null;
}

export function Discussions() {
  const { user, requireAuth } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [topic, setTopic] = useState<string>(FORUM_TOPICS[1]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabaseConfigured) return;
    const sb = getSupabase();
    const { data: rows } = await sb.from("posts").select("*").order("created_at", { ascending: false }).limit(30);
    const list = (rows ?? []) as Omit<Post, "public_profiles">[];
    const ids = [...new Set(list.map((p) => p.author_id))];
    const { data: profs } = ids.length ? await sb.from("public_profiles").select("id,display_name,avatar_emoji,avatar_color").in("id", ids) : { data: [] };
    const byId = new Map(((profs ?? []) as { id: string; display_name: string; avatar_emoji: string; avatar_color: string }[]).map((p) => [p.id, p]));
    setPosts(list.map((p) => ({ ...p, public_profiles: byId.get(p.author_id) ?? null })));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch; state is set after the network call resolves
    void load();
    if (!supabaseConfigured) return;
    const sb = getSupabase();
    const ch = sb.channel("posts-live").on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => void load()).subscribe();
    return () => {
      void sb.removeChannel(ch);
    };
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!requireAuth() || !user) return;
    setBusy(true);
    setErr(null);
    const { error } = await getSupabase().from("posts").insert({ author_id: user.id, topic, title: title.trim(), body: body.trim() });
    setBusy(false);
    if (error) return setErr(error.message);
    setTitle("");
    setBody("");
    void load();
  }

  return (
    <section id="discussions" aria-labelledby="disc-h" className="scroll-mt-24">
      <h2 id="disc-h" className="mb-3 font-display text-2xl font-bold">💬 Student Discussions</h2>
      <form onSubmit={submit} className="sticker mb-4 space-y-2 rounded-3xl bg-white p-4">
        <div className="flex flex-wrap gap-2">
          {FORUM_TOPICS.map((t) => (
            <button type="button" key={t} onClick={() => setTopic(t)} aria-pressed={topic === t} className={`sticker-sm pop rounded-full px-3 py-1 text-xs font-extrabold ${topic === t ? "bg-sky" : "bg-cream"}`}>{t}</button>
          ))}
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Start a conversation…" maxLength={120} required minLength={3} aria-label="Post title" className="w-full rounded-2xl border-2 border-ink bg-white px-3 py-2 font-semibold outline-none focus:ring-4 focus:ring-sun/60" />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Add details (optional)" aria-label="Post details" className="w-full rounded-2xl border-2 border-ink bg-white px-3 py-2 font-semibold outline-none focus:ring-4 focus:ring-sun/60" />
        {err && <p role="alert" className="text-sm font-bold text-red-700">{err}</p>}
        <button disabled={busy} className="sticker-sm pop rounded-full bg-sun px-4 py-2 font-display font-bold disabled:opacity-60">{busy ? "Posting…" : "Post"}</button>
      </form>

      {posts.length === 0 ? (
        <EmptyState title="No posts yet" hint="Ask who's free tonight or look for hackathon teammates — be the first to post!" />
      ) : (
        <ul className="space-y-3">
          {posts.map((p) => (
            <li key={p.id} className="sticker-sm rounded-3xl bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full border-2 border-ink bg-sky/60 px-2 py-0.5 text-xs font-extrabold">{p.topic}</span>
                <time className="text-xs font-bold text-ink/60" dateTime={p.created_at}>{new Date(p.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time>
              </div>
              <h3 className="mt-1 font-display text-lg font-bold">{p.title}</h3>
              {p.body && <p className="whitespace-pre-wrap text-sm font-semibold text-ink/80">{p.body}</p>}
              <p className="mt-1 text-xs font-extrabold text-ink/70">{p.public_profiles?.avatar_emoji ?? "🐮"} {p.public_profiles?.display_name ?? "Aggie"}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
