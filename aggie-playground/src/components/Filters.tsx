"use client";

import { CATEGORIES } from "@/lib/categories";
import type { Activity } from "@/lib/types";

export type StatusFilter = "all" | "live" | "upcoming";

export interface FilterState {
  categories: string[]; // category names; empty = all
  status: StatusFilter;
  query: string;
}

export const DEFAULT_FILTERS: FilterState = { categories: [], status: "all", query: "" };

export function applyFilters(list: Activity[], f: FilterState): Activity[] {
  const q = f.query.trim().toLowerCase();
  return list.filter((a) => {
    if (f.categories.length && !f.categories.includes(a.category)) return false;
    if (f.status === "live" && a.live_status !== "live") return false;
    if (f.status === "upcoming" && a.live_status !== "upcoming") return false;
    if (q && !`${a.title} ${a.subcategory} ${a.location_name} ${a.description}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

export function CategoryChips({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (name: string) => onChange(value.includes(name) ? value.filter((n) => n !== name) : [...value, name]);
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2" role="group" aria-label="Filter by category">
      <button onClick={() => onChange([])} aria-pressed={value.length === 0} className={`sticker-sm pop shrink-0 rounded-full px-3 py-1.5 text-sm font-extrabold ${value.length === 0 ? "bg-ink text-cream" : "bg-white"}`}>
        ✨ All
      </button>
      {CATEGORIES.map((c) => {
        const on = value.includes(c.name);
        return (
          <button key={c.key} onClick={() => toggle(c.name)} aria-pressed={on} className="sticker-sm pop shrink-0 rounded-full px-3 py-1.5 text-sm font-extrabold" style={{ background: on ? c.color : "#fff", color: "#2b2118" }}>
            {c.emoji} {c.name}
          </button>
        );
      })}
    </div>
  );
}

export function StatusToggle({ value, onChange }: { value: StatusFilter; onChange: (v: StatusFilter) => void }) {
  const opts: { v: StatusFilter; label: string }[] = [
    { v: "all", label: "All" },
    { v: "live", label: "🔴 Live now" },
    { v: "upcoming", label: "⏰ Upcoming" },
  ];
  return (
    <div className="inline-flex rounded-full border-2 border-ink bg-white p-0.5" role="group" aria-label="Filter by status">
      {opts.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)} aria-pressed={value === o.v} className={`rounded-full px-3 py-1 text-sm font-extrabold ${value === o.v ? "bg-sun" : ""}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
