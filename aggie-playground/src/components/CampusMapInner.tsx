"use client";

import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import type { Activity } from "@/lib/types";
import { categoryOf } from "@/lib/categories";
import { CAMPUS_CENTER, CAMPUS_LOCATIONS } from "@/lib/locations";

function pinIcon(a: Activity, selected: boolean) {
  const c = categoryOf(a.category);
  const live = a.live_status === "live";
  const full = a.spots_remaining <= 0;
  const html = `
    <div style="position:relative;transform:translate(-50%,-100%);filter:${full ? "grayscale(0.7)" : "none"}">
      <div style="display:flex;align-items:center;gap:4px;background:${c.color};border:2.5px solid #2b2118;border-radius:999px;padding:3px 9px 3px 6px;box-shadow:2px 2px 0 #2b2118;font-weight:800;font-size:12px;color:#2b2118;white-space:nowrap;${selected ? "transform:scale(1.18);" : ""}">
        <span style="font-size:16px">${c.emoji}</span>
        <span>${a.participant_count}/${a.max_participants}</span>
        ${live ? '<span style="width:9px;height:9px;border-radius:50%;background:#ef4444;border:1.5px solid #2b2118"></span>' : ""}
      </div>
      <div style="width:0;height:0;margin:0 auto;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid #2b2118"></div>
    </div>`;
  return L.divIcon({ html, className: "pin-wrap", iconSize: [0, 0], iconAnchor: [0, 0] });
}

function landmarkIcon(name: string) {
  return L.divIcon({
    html: `<div style="transform:translate(-50%,-50%);font:800 11px var(--font-nunito),sans-serif;color:#2b2118;background:rgba(255,255,255,.85);border:1.5px solid #2b2118;border-radius:8px;padding:1px 6px;white-space:nowrap">${name.replace(/\s*\(.*\)/, "")}</div>`,
    className: "pin-wrap",
    iconSize: [0, 0],
  });
}

function Resize() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 120);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

/** Activities at the same spot would stack exactly; fan them out slightly so every pin is tappable. */
function spread(activities: Activity[]) {
  const seen = new Map<string, number>();
  return activities.map((a) => {
    const k = a.location_key;
    const i = seen.get(k) ?? 0;
    seen.set(k, i + 1);
    const angle = (i * 2 * Math.PI) / 6;
    const r = i === 0 ? 0 : 0.00028 * (1 + Math.floor(i / 6));
    return { a, pos: [a.lat + Math.sin(angle) * r, a.lng + Math.cos(angle) * r * 1.3] as [number, number] };
  });
}

export default function CampusMapInner({
  activities,
  selectedId,
  onSelect,
  interactive = true,
}: {
  activities: Activity[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  interactive?: boolean;
}) {
  return (
    <MapContainer
      center={CAMPUS_CENTER}
      zoom={15}
      minZoom={13}
      scrollWheelZoom={interactive}
      dragging={interactive}
      zoomControl={interactive}
      doubleClickZoom={interactive}
      touchZoom={interactive}
      className="h-full w-full"
      style={{ height: "100%", width: "100%" }}
    >
      <Resize />
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {CAMPUS_LOCATIONS.map((l) => (
        <Marker key={l.key} position={[l.lat, l.lng]} icon={landmarkIcon(l.name)} interactive={false} keyboard={false} />
      ))}
      {spread(activities).map(({ a, pos }) => (
        <Marker
          key={a.id}
          position={pos}
          icon={pinIcon(a, a.id === selectedId)}
          zIndexOffset={a.id === selectedId ? 1000 : 0}
          eventHandlers={{ click: () => onSelect(a.id) }}
          title={`${a.title} — ${a.participant_count}/${a.max_participants}`}
        />
      ))}
    </MapContainer>
  );
}
