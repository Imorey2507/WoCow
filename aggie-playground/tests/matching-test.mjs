import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { scoreBuddy, rankBuddies, buddyRelation, busyForViewer } from "../src/features/matching/buddies.ts";
import { recommendActivities, ACTIVITY_MATCH_WEIGHTS } from "../src/features/matching/activities.ts";

const NOW = new Date("2026-10-11T18:00:00Z");
function profile(overrides = {}) {
  return { id: "me", display_name: "Aggie", avatar_emoji: "🐮", avatar_color: "#fff", bio: "", favorite_categories: ["Competitive Sports"], preferred_activities: ["Basketball"], discoverable: true, is_demo: false, ...overrides };
}
function activity(overrides = {}) {
  return { id: "event", host_id: "host", title: "Basketball", category: "Competitive Sports", subcategory: "Basketball", location_key: "arc", location_name: "ARC", lat: 38.54, lng: -121.75, starts_at: "2026-10-11T18:10:00Z", duration_min: 60, max_participants: 10, description: "", skill_level: null, vibe: null, what_to_bring: null, status: "active", is_demo: false, created_at: NOW.toISOString(), participant_count: 5, spots_remaining: 5, host_name: null, host_emoji: null, host_color: null, live_status: "upcoming", ...overrides };
}
const recommend = (events, p = profile(), options = {}) => recommendActivities(events, p, { now: NOW, ...options });

describe("buddy matching", () => {
  test("weights shared categories by one and activities by two", () => {
    assert.deepEqual(scoreBuddy(profile(), profile({ id: "other" })), { cats: ["Competitive Sports"], acts: ["Basketball"], total: 3 });
  });
  test("counts each interest only once", () => {
    const p = profile({ favorite_categories: ["Competitive Sports", "Competitive Sports", ""], preferred_activities: ["Basketball", "Basketball"] });
    assert.equal(scoreBuddy(p, p).total, 3);
  });
  test("excludes self, opted-out people, and people with no shared interests", () => {
    assert.equal(rankBuddies(profile(), [profile(), profile({ id: "hidden", discoverable: false }), profile({ id: "none", favorite_categories: [], preferred_activities: [] })]).length, 0);
  });
  test("retains activity-only matches", () => {
    assert.equal(rankBuddies(profile(), [profile({ id: "other", favorite_categories: [] })])[0].s.total, 2);
  });
  test("ranks by score then stable ID without mutating the feed", () => {
    const people = [profile({ id: "b" }), profile({ id: "category", preferred_activities: [] }), profile({ id: "a" })];
    assert.deepEqual(rankBuddies(profile(), people).map(({ p }) => p.id), ["a", "b", "category"]);
    assert.equal(people[0].id, "b");
  });
  test("no stated interests produces no invented matches", () => {
    assert.deepEqual(rankBuddies(profile({ favorite_categories: [], preferred_activities: [] }), [profile({ id: "other" })]), []);
  });
  test("hidden viewer can still find opted-in people", () => {
    assert.equal(rankBuddies(profile({ discoverable: false }), [profile({ id: "other" })]).length, 1);
  });
  test("resolves reciprocal requests and ignores unrelated rows", () => {
    const rows = [
      { id: "a", from_user: "me", to_user: "other", status: "declined" },
      { id: "b", from_user: "other", to_user: "me", status: "pending" },
      { id: "c", from_user: "stranger", to_user: "other", status: "accepted" },
    ];
    assert.equal(buddyRelation(rows, "me", "other").id, "b");
    rows.push({ id: "d", from_user: "me", to_user: "other", status: "accepted" });
    assert.equal(buddyRelation(rows, "me", "other").id, "d");
    assert.equal(buddyRelation(rows, "me", "unknown"), undefined);
  });
});

describe("activity recommendations", () => {
  test("weights sum to one and score has a breakdown and truthful reasons", () => {
    assert.ok(Math.abs(Object.values(ACTIVITY_MATCH_WEIGHTS).reduce((a,b) => a+b) - 1) < 1e-10);
    const [result] = recommend([activity()]);
    assert.ok(result.score >= 0 && result.score <= 100);
    assert.deepEqual(Object.keys(result.breakdown), ["interest", "timing", "space"]);
    assert.deepEqual(result.reasons, ["You picked Basketball", "Starting within 30 minutes"]);
  });
  test("prioritizes a preferred subcategory over a broad category", () => {
    const [best] = recommend([activity({ id: "broad", subcategory: "Soccer" }), activity({ id: "preferred" })]);
    assert.equal(best.activity.id, "preferred");
  });
  test("does not invent preferences for signed-out or unconfigured students", () => {
    assert.deepEqual(recommend([activity()], null), []);
    assert.deepEqual(recommend([activity()], profile({ favorite_categories: [], preferred_activities: [] })), []);
  });
  test("supports category-only and activity-only preferences", () => {
    assert.equal(recommend([activity()], profile({ preferred_activities: [] })).length, 1);
    assert.equal(recommend([activity()], profile({ favorite_categories: [] })).length, 1);
  });
  test("excludes unrelated activities", () => {
    assert.deepEqual(recommend([activity({ category: "Academic & Study", subcategory: "Study Buddies" })]), []);
  });
  test("excludes full, cancelled, ended, joined and hosted events", () => {
    const events = [activity({ id: "full", spots_remaining: 0 }), activity({ id: "cancelled", status: "cancelled" }), activity({ id: "ended", live_status: "ended" }), activity({ id: "joined" }), activity({ id: "hosted", host_id: "me" })];
    assert.deepEqual(recommend(events, profile(), { joinedIds: new Set(["joined"]) }), []);
  });
  test("excludes the exact ending boundary even with a stale live_status", () => {
    assert.deepEqual(recommend([activity({ starts_at: "2026-10-11T17:00:00Z", live_status: "live" })]), []);
  });
  test("recomputes relevance when the injected clock advances", () => {
    const event = activity();
    assert.equal(recommend([event]).length, 1);
    assert.deepEqual(recommend([event], profile(), { now: new Date("2026-10-11T19:10:00Z") }), []);
  });
  test("rejects invalid times, durations and capacities", () => {
    for (const overrides of [{ starts_at: "invalid" }, { duration_min: NaN }, { duration_min: 0 }, { spots_remaining: NaN }, { max_participants: 0 }, { max_participants: Infinity }]) {
      assert.deepEqual(recommend([activity(overrides)]), []);
    }
    assert.deepEqual(recommend([activity()], profile(), { now: new Date("invalid") }), []);
  });
  test("explains live events using dates even if feed status lags", () => {
    const [result] = recommend([activity({ starts_at: "2026-10-11T17:30:00Z" })]);
    assert.ok(result.reasons.includes("Happening now"));
    assert.ok(!result.reasons.includes("Starting within 30 minutes"));
  });
  test("uses stable score/start/ID ties and respects limits without mutation", () => {
    const events = [activity({ id: "b" }), activity({ id: "a" })];
    assert.deepEqual(recommend(events).map(({ activity }) => activity.id), ["a", "b"]);
    assert.equal(events[0].id, "b");
    assert.equal(recommend(events, profile(), { limit: 1 }).length, 1);
    assert.deepEqual(recommend(events, profile(), { limit: -1 }), []);
  });
  test("earlier starts win when scores round to a tie", () => {
    assert.equal(recommend([activity({ id: "late", starts_at: "2026-10-11T18:20:00Z" }), activity({ id: "early" })])[0].activity.id, "early");
  });
});

describe("busyForViewer — an action marker never crosses identities", () => {
  const A = "user-a";
  const B = "user-b";

  test("the owner sees their own marker", () => {
    assert.equal(busyForViewer({ viewerId: A, key: "target-1" }, A), "target-1");
  });

  test("another signed-in viewer does not see it", () => {
    assert.equal(busyForViewer({ viewerId: A, key: "target-1" }, B), null);
  });

  test("a signed-out viewer sees nothing", () => {
    assert.equal(busyForViewer({ viewerId: A, key: "target-1" }, null), null);
    assert.equal(busyForViewer({ viewerId: A, key: "target-1" }, undefined), null);
  });

  test("no marker is no marker", () => {
    assert.equal(busyForViewer(null, A), null);
  });

  test("an empty viewer id never matches, so nothing is disabled by accident", () => {
    assert.equal(busyForViewer({ viewerId: "", key: "x" }, ""), null);
  });

  test("is deterministic and does not mutate the marker", () => {
    const marker = { viewerId: A, key: "target-1" };
    const before = JSON.stringify(marker);
    assert.equal(busyForViewer(marker, A), busyForViewer(marker, A));
    assert.equal(JSON.stringify(marker), before);
  });
});
