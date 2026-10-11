/**
 * Pure campus-map logic.
 *
 * Dependency-free on purpose (no React, no Leaflet, no Supabase) so it can be
 * unit tested with `node --test`. The location preset table is passed in by the
 * caller, which keeps this module free of runtime imports.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** The subset of an activity the map cares about. */
export interface MappableActivity {
  id: string;
  location_key?: string | null;
  location_name?: string | null;
  lat?: number | null;
  lng?: number | null;
}

/** e.g. `{ arc: { lat, lng } }` — pass `LOCATION_BY_KEY` from `lib/locations`. */
export type LocationLookup = Record<string, { lat: number; lng: number } | undefined>;

/**
 * True only for a real, in-range WGS84 coordinate. Rejects NaN, Infinity,
 * null/undefined, strings and out-of-range values — Leaflet renders a marker at
 * `[NaN, NaN]` in a way that is worse than not rendering it at all.
 */
export function isValidCoordinate(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Where to draw this activity, or null when we genuinely cannot tell.
 *
 * Order: the row's own coordinates first; if those are unusable, fall back to
 * the coordinates of a known `location_key`. Never guesses — an unknown key
 * with no coordinates returns null so the caller can say "not on the map"
 * rather than dropping the activity silently.
 */
export function resolvePosition(a: MappableActivity, lookup: LocationLookup = {}): LatLng | null {
  if (isValidCoordinate(a.lat, a.lng)) {
    return { lat: a.lat as number, lng: a.lng as number };
  }
  const key = typeof a.location_key === "string" ? a.location_key.trim() : "";
  const preset = key ? lookup[key] : undefined;
  if (preset && isValidCoordinate(preset.lat, preset.lng)) {
    return { lat: preset.lat, lng: preset.lng };
  }
  return null;
}

/**
 * Splits a feed into what can be drawn and what cannot. Both halves are
 * preserved, in input order, so the caller can keep showing the unplaceable
 * ones in a list instead of losing them.
 */
export function partitionByPosition<T extends MappableActivity>(
  list: T[],
  lookup: LocationLookup = {},
): { placeable: T[]; unplaceable: T[] } {
  const placeable: T[] = [];
  const unplaceable: T[] = [];
  for (const activity of list) {
    if (resolvePosition(activity, lookup)) placeable.push(activity);
    else unplaceable.push(activity);
  }
  return { placeable, unplaceable };
}

/** A readable place name, or an explicit fallback — never an empty string. */
export function locationLabel(name: unknown, fallback = "Location unavailable"): string {
  return typeof name === "string" && name.trim() ? name.trim() : fallback;
}

export type MapState = "unconfigured" | "error" | "loading" | "no-matches" | "empty" | "ready";

export interface MapStateInput {
  configured: boolean;
  loading: boolean;
  error: string | null;
  /** Rows left after filtering — placeable or not; both are shown in the list. */
  total: number;
  hasFilters: boolean;
}

/**
 * Same priority as the Discover feed: unconfigured > error > loading > empty.
 * Without the `unconfigured` branch an unconnected backend renders as
 * "no activities match", which reads as a quiet campus rather than a missing
 * database.
 */
export function mapState(input: MapStateInput): MapState {
  const { configured, loading, error, total, hasFilters } = input;
  if (!configured) return "unconfigured";
  if (error) return "error";
  if (loading) return "loading";
  if (total > 0) return "ready";
  return hasFilters ? "no-matches" : "empty";
}
