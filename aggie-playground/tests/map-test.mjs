/**
 * Person 2 — pure campus-map logic.
 *
 * The demo must not break when an activity has unusable coordinates or an
 * unrecognised location, and an unconfigured backend must not look like a quiet
 * campus. Both are pure decisions, so they are tested directly.
 *
 * Node's built-in runner + type stripping, no dependencies.
 * Naming note: `-test.mjs` (not `.test.mjs`) — see club-normalize-test.mjs.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  isValidCoordinate,
  locationLabel,
  mapState,
  partitionByPosition,
  resolvePosition,
} from "../src/lib/map.ts";

const LOOKUP = {
  arc: { lat: 38.543, lng: -121.75915 },
  silo: { lat: 38.53933, lng: -121.7555 },
};

function act(overrides = {}) {
  return { id: "a1", location_key: "arc", location_name: "ARC", lat: 38.543, lng: -121.75915, ...overrides };
}

describe("isValidCoordinate", () => {
  test("accepts real campus coordinates", () => {
    assert.equal(isValidCoordinate(38.543, -121.75915), true);
    assert.equal(isValidCoordinate(0, 0), true);
    assert.equal(isValidCoordinate(-90, -180), true);
    assert.equal(isValidCoordinate(90, 180), true);
  });

  test("rejects NaN, Infinity and non-numbers", () => {
    assert.equal(isValidCoordinate(Number.NaN, -121), false);
    assert.equal(isValidCoordinate(38, Number.NaN), false);
    assert.equal(isValidCoordinate(Number.POSITIVE_INFINITY, 0), false);
    assert.equal(isValidCoordinate(Number.NEGATIVE_INFINITY, 0), false);
    assert.equal(isValidCoordinate(null, -121), false);
    assert.equal(isValidCoordinate(undefined, undefined), false);
    assert.equal(isValidCoordinate("38.5", "-121.7"), false);
  });

  test("rejects out-of-range values", () => {
    assert.equal(isValidCoordinate(91, 0), false);
    assert.equal(isValidCoordinate(-91, 0), false);
    assert.equal(isValidCoordinate(0, 181), false);
    assert.equal(isValidCoordinate(0, -181), false);
  });
});

describe("resolvePosition", () => {
  test("prefers the activity's own coordinates", () => {
    assert.deepEqual(resolvePosition(act({ lat: 1, lng: 2 }), LOOKUP), { lat: 1, lng: 2 });
  });

  test("falls back to the preset when coordinates are missing", () => {
    assert.deepEqual(resolvePosition(act({ lat: null, lng: null }), LOOKUP), { lat: 38.543, lng: -121.75915 });
  });

  test("falls back to the preset when coordinates are garbage", () => {
    assert.deepEqual(resolvePosition(act({ lat: Number.NaN, lng: Number.NaN }), LOOKUP), { lat: 38.543, lng: -121.75915 });
    assert.deepEqual(resolvePosition(act({ lat: 999, lng: 999 }), LOOKUP), { lat: 38.543, lng: -121.75915 });
  });

  test("returns null for an unrecognised location with no usable coordinates", () => {
    assert.equal(resolvePosition(act({ location_key: "mystery", lat: null, lng: null }), LOOKUP), null);
    assert.equal(resolvePosition(act({ location_key: "", lat: null, lng: null }), LOOKUP), null);
    assert.equal(resolvePosition(act({ location_key: null, lat: Number.NaN, lng: 3 }), LOOKUP), null);
  });

  test("never guesses — an empty lookup yields null rather than a default point", () => {
    assert.equal(resolvePosition(act({ lat: null, lng: null }), {}), null);
    assert.equal(resolvePosition(act({ lat: null, lng: null })), null);
  });

  test("an unknown key with valid coordinates is still placeable", () => {
    assert.deepEqual(resolvePosition(act({ location_key: "mystery", lat: 38.5, lng: -121.7 }), LOOKUP), { lat: 38.5, lng: -121.7 });
  });
});

describe("partitionByPosition", () => {
  test("splits, and preserves the input order in both halves", () => {
    const list = [
      act({ id: "p1" }),
      act({ id: "u1", location_key: "mystery", lat: null, lng: null }),
      act({ id: "p2", location_key: "silo", lat: null, lng: null }),
      act({ id: "u2", lat: Number.NaN, lng: Number.NaN, location_key: "nope" }),
    ];
    const { placeable, unplaceable } = partitionByPosition(list, LOOKUP);
    assert.deepEqual(placeable.map((a) => a.id), ["p1", "p2"]);
    assert.deepEqual(unplaceable.map((a) => a.id), ["u1", "u2"]);
  });

  test("does not mutate the input", () => {
    const list = [act({ id: "x" })];
    const before = JSON.stringify(list);
    partitionByPosition(list, LOOKUP);
    assert.equal(JSON.stringify(list), before);
  });

  test("loses nothing — every input id appears in exactly one half", () => {
    const list = [act({ id: "a" }), act({ id: "b", lat: null, lng: null, location_key: "zzz" }), act({ id: "c" })];
    const { placeable, unplaceable } = partitionByPosition(list, LOOKUP);
    assert.equal(placeable.length + unplaceable.length, list.length);
    assert.deepEqual([...placeable, ...unplaceable].map((a) => a.id).sort(), ["a", "b", "c"]);
  });

  test("is deterministic across repeated calls", () => {
    const list = [act({ id: "a" }), act({ id: "b", lat: null, lng: null, location_key: "zzz" })];
    const first = partitionByPosition(list, LOOKUP);
    const second = partitionByPosition(list, LOOKUP);
    assert.deepEqual(first.placeable.map((a) => a.id), second.placeable.map((a) => a.id));
    assert.deepEqual(first.unplaceable.map((a) => a.id), second.unplaceable.map((a) => a.id));
  });

  test("an empty list yields two empty halves", () => {
    assert.deepEqual(partitionByPosition([], LOOKUP), { placeable: [], unplaceable: [] });
  });
});

describe("locationLabel", () => {
  test("trims a real name", () => {
    assert.equal(locationLabel("  UC Davis ARC  "), "UC Davis ARC");
  });

  test("never returns an empty string — falls back explicitly", () => {
    assert.equal(locationLabel(""), "Location unavailable");
    assert.equal(locationLabel("   "), "Location unavailable");
    assert.equal(locationLabel(null), "Location unavailable");
    assert.equal(locationLabel(undefined), "Location unavailable");
    assert.equal(locationLabel(42), "Location unavailable");
  });
});

describe("mapState", () => {
  const base = { configured: true, loading: false, error: null, total: 0, hasFilters: false };

  test("unconfigured outranks every other signal", () => {
    assert.equal(mapState({ ...base, configured: false, loading: true, error: "boom", total: 7 }), "unconfigured");
  });

  test("an error is not hidden by loading or by rows already on screen", () => {
    assert.equal(mapState({ ...base, error: "network", loading: true }), "error");
    assert.equal(mapState({ ...base, error: "network", total: 4 }), "error");
  });

  test("loading is reported before empty", () => {
    assert.equal(mapState({ ...base, loading: true }), "loading");
  });

  test("ready when rows survive filtering", () => {
    assert.equal(mapState({ ...base, total: 3 }), "ready");
  });

  test("separates an over-filtered map from an empty campus", () => {
    assert.equal(mapState(base), "empty");
    assert.equal(mapState({ ...base, hasFilters: true }), "no-matches");
  });
});
