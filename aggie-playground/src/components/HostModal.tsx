"use client";

import { useState } from "react";
import type { Activity } from "@/lib/types";
import { getSupabase } from "@/lib/supabase/client";
import { CATEGORIES, SKILL_LEVELS, SPORT_CATEGORIES, VIBES, categoryOf } from "@/lib/categories";
import { CAMPUS_LOCATIONS, LOCATION_BY_KEY } from "@/lib/locations";
import { toLocalInput } from "@/lib/format";
import { useAuth } from "./AuthProvider";
import { useActivities } from "./ActivitiesProvider";
import { useUI } from "./UIProvider";

const field =
  "w-full rounded-2xl border-2 border-ink bg-white px-3 py-2.5 text-base font-semibold outline-none focus:ring-4 focus:ring-sun/60";
const label = "mb-1 block text-sm font-extrabold";

export function HostModal() {
  const { hostOpen, editing } = useUI();
  if (!hostOpen) return null;
  // Mounted only while open, so the form's initial state is recomputed on every open.
  return <HostForm editing={editing} />;
}

function HostForm({ editing }: { editing: Activity | null }) {
  const { closeHost, showToast } = useUI();
  const { user, requireAuth } = useAuth();
  const { refresh } = useActivities();

  const soon = () => {
    const d = new Date(Date.now() + 30 * 60_000);
    d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
    return toLocalInput(d);
  };

  const [title, setTitle] = useState(editing?.title ?? "");
  const [categoryName, setCategoryName] = useState(editing?.category ?? CATEGORIES[4].name);
  const [subcategory, setSubcategory] = useState(editing?.subcategory ?? "Volleyball");
  const [locationKey, setLocationKey] = useState(editing?.location_key ?? CAMPUS_LOCATIONS[2].key);
  const [startsAt, setStartsAt] = useState(() => (editing ? toLocalInput(new Date(editing.starts_at)) : soon()));
  const [duration, setDuration] = useState(editing?.duration_min ?? 60);
  const [max, setMax] = useState(editing?.max_participants ?? 10);
  const [description, setDescription] = useState(editing?.description ?? "");
  const [skill, setSkill] = useState<string>(editing?.skill_level ?? "All Levels");
  const [vibe, setVibe] = useState<string>(editing?.vibe ?? "");
  const [bring, setBring] = useState(editing?.what_to_bring ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);


  const cat = categoryOf(categoryName);
  const isSport = SPORT_CATEGORIES.includes(categoryName);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!requireAuth() || !user) return;
    const loc = LOCATION_BY_KEY[locationKey];
    const start = new Date(startsAt);
    if (Number.isNaN(start.getTime())) return setErr("Pick a start time.");
    if (!editing && start.getTime() < Date.now() - 5 * 60_000) return setErr("Start time is in the past.");
    if (title.trim().length < 3) return setErr("Give your activity a title (3+ characters).");

    const payload = {
      title: title.trim(),
      category: categoryName,
      subcategory,
      location_key: loc.key,
      location_name: loc.name,
      lat: loc.lat,
      lng: loc.lng,
      starts_at: start.toISOString(),
      duration_min: duration,
      max_participants: max,
      description: description.trim(),
      skill_level: isSport ? skill : null,
      vibe: vibe || null,
      what_to_bring: bring.trim() || null,
    };

    setBusy(true);
    const sb = getSupabase();
    const res = editing
      ? await sb.from("activities").update(payload).eq("id", editing.id)
      : await sb.from("activities").insert({ ...payload, host_id: user.id });
    setBusy(false);
    if (res.error) return setErr(res.error.message);
    await refresh();
    showToast(editing ? "Activity updated ✨" : "Your activity is live! 🎉");
    closeHost();
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={editing ? "Edit activity" : "Host an activity"}>
      <form onSubmit={submit} className="slide-up sticker max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-cream p-5 sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold">{editing ? "Edit activity" : "Host an activity"}</h2>
          <button type="button" onClick={closeHost} className="sticker-sm pop grid h-9 w-9 place-items-center rounded-full bg-white font-black" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className={label} htmlFor="h-title">Title *</label>
            <input id="h-title" className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sand volleyball, anyone?" maxLength={80} required />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="h-cat">Category *</label>
              <select
                id="h-cat"
                className={field}
                value={categoryName}
                onChange={(e) => {
                  setCategoryName(e.target.value);
                  setSubcategory(categoryOf(e.target.value).subcategories[0]);
                }}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.key} value={c.name}>{c.emoji} {c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="h-sub">Subcategory *</label>
              <select id="h-sub" className={field} value={subcategory} onChange={(e) => setSubcategory(e.target.value)}>
                {cat.subcategories.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={label} htmlFor="h-loc">Where *</label>
            <select id="h-loc" className={field} value={locationKey} onChange={(e) => setLocationKey(e.target.value)}>
              {CAMPUS_LOCATIONS.map((l) => (
                <option key={l.key} value={l.key}>{l.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <label className={label} htmlFor="h-start">Starts *</label>
              <input id="h-start" type="datetime-local" className={field} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
            </div>
            <div>
              <label className={label} htmlFor="h-dur">Duration *</label>
              <select id="h-dur" className={field} value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                {[30, 45, 60, 90, 120, 180, 240].map((m) => (
                  <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60} hr`}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="h-max">Max people *</label>
              <input id="h-max" type="number" min={2} max={200} className={field} value={max} onChange={(e) => setMax(Number(e.target.value))} required />
            </div>
          </div>

          {isSport && (
            <div>
              <span className={label}>Skill level</span>
              <div className="flex flex-wrap gap-2">
                {SKILL_LEVELS.map((s) => (
                  <button key={s} type="button" onClick={() => setSkill(s)} className={`sticker-sm pop rounded-full px-3 py-1.5 text-sm font-extrabold ${skill === s ? "bg-sun" : "bg-white"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <span className={label}>Vibe</span>
            <div className="flex flex-wrap gap-2">
              {VIBES.map((v) => (
                <button key={v} type="button" onClick={() => setVibe(vibe === v ? "" : v)} className={`sticker-sm pop rounded-full px-3 py-1.5 text-sm font-extrabold ${vibe === v ? "bg-lavender" : "bg-white"}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={label} htmlFor="h-desc">Description</label>
            <textarea id="h-desc" className={field} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Anything people should know?" />
          </div>
          <div>
            <label className={label} htmlFor="h-bring">What to bring</label>
            <input id="h-bring" className={field} value={bring} onChange={(e) => setBring(e.target.value)} placeholder="Water bottle, your own ball…" />
          </div>

          {err && <p role="alert" className="rounded-2xl border-2 border-ink bg-coral/40 px-3 py-2 text-sm font-bold">{err}</p>}

          <button disabled={busy} className="sticker pop w-full rounded-2xl bg-sun py-3 font-display text-xl font-bold disabled:opacity-60">
            {busy ? "Saving…" : editing ? "Save changes" : "Host it! 🎉"}
          </button>
        </div>
      </form>
    </div>
  );
}
