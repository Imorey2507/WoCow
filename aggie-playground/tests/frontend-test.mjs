/**
 * Person 1 — pure UI state logic.
 *
 * Covers the states the acceptance criteria care about: loading / empty /
 * error / unconfigured, and the join control's label, accessible name and
 * disabled state (which is what stops a double submit).
 *
 * Node's built-in runner + type stripping, no dependencies.
 *   npm test        (or: node --test)
 *
 * Naming note: `-test.mjs`, not `.test.mjs` — see club-normalize-test.mjs.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { capacityPercent, feedState, joinButtonState, notesForViewer, spotsLabel } from "../src/lib/ui.ts";

describe("joinButtonState", () => {
  const base = { isHost: false, joined: false, full: false, busy: false };

  test("offers to join when there is room", () => {
    const s = joinButtonState(base);
    assert.equal(s.kind, "join");
    assert.equal(s.label, "Join Activity");
    assert.equal(s.disabled, false);
    assert.equal(s.ariaLabel, "Join this activity");
  });

  test("offers to leave once joined", () => {
    const s = joinButtonState({ ...base, joined: true });
    assert.equal(s.kind, "joined");
    assert.equal(s.label, "Leave");
    assert.equal(s.disabled, false);
  });

  test("disables and explains a full activity", () => {
    const s = joinButtonState({ ...base, full: true });
    assert.equal(s.kind, "full");
    assert.equal(s.disabled, true);
    assert.equal(s.ariaLabel, "This activity is full");
  });

  test("a host sees a static label, never a button", () => {
    const s = joinButtonState({ ...base, isHost: true, joined: true, full: true, busy: true });
    assert.equal(s.kind, "host");
    assert.equal(s.label, "You're hosting");
    assert.equal(s.disabled, true);
  });

  test("while joining: disabled, and the accessible name is not just an ellipsis", () => {
    const s = joinButtonState({ ...base, busy: true });
    assert.equal(s.label, "Joining…");
    assert.equal(s.disabled, true);
    assert.equal(s.ariaLabel, "Joining this activity");
    assert.ok(!/[.…]$/.test(s.ariaLabel), "aria label must not be a bare ellipsis");
  });

  test("while leaving: disabled and clearly labelled", () => {
    const s = joinButtonState({ ...base, joined: true, busy: true });
    assert.equal(s.label, "Leaving…");
    assert.equal(s.disabled, true);
    assert.equal(s.ariaLabel, "Leaving this activity");
  });

  test("busy takes priority over full, so a queued click cannot re-fire", () => {
    const s = joinButtonState({ ...base, full: true, busy: true });
    assert.equal(s.kind, "join");
    assert.equal(s.disabled, true);
  });

  test("disabled is exactly host|full|busy — never merely joined", () => {
    const cases = [
      [{ ...base, joined: true }, false],
      [{ ...base }, false],
      [{ ...base, full: true }, true],
      [{ ...base, busy: true }, true],
      [{ ...base, isHost: true }, true],
    ];
    for (const [input, expected] of cases) {
      assert.equal(joinButtonState(input).disabled, expected);
    }
  });

  test("every state has a non-empty accessible name", () => {
    for (const input of [base, { ...base, joined: true }, { ...base, full: true }, { ...base, busy: true }, { ...base, joined: true, busy: true }, { ...base, isHost: true }]) {
      const s = joinButtonState(input);
      assert.equal(typeof s.ariaLabel, "string");
      assert.ok(s.ariaLabel.length > 3, `weak aria label: ${s.ariaLabel}`);
    }
  });
});

describe("capacityPercent", () => {
  test("computes a rounded percentage", () => {
    assert.equal(capacityPercent(5, 10), 50);
    assert.equal(capacityPercent(1, 3), 33);
    assert.equal(capacityPercent(10, 10), 100);
    assert.equal(capacityPercent(0, 10), 0);
  });

  test("never exceeds 100 even if the feed over-reports", () => {
    assert.equal(capacityPercent(14, 10), 100);
  });

  test("survives a zero or missing limit instead of returning NaN/Infinity", () => {
    assert.equal(capacityPercent(3, 0), 0);
    assert.equal(capacityPercent(3, Number.NaN), 0);
    assert.equal(capacityPercent(Number.NaN, 10), 0);
    assert.equal(capacityPercent(Number.POSITIVE_INFINITY, 10), 0);
  });

  test("clamps negatives to zero", () => {
    assert.equal(capacityPercent(-4, 10), 0);
  });
});

describe("spotsLabel", () => {
  test("pluralises correctly", () => {
    assert.equal(spotsLabel(1), "1 spot left");
    assert.equal(spotsLabel(3), "3 spots left");
  });

  test("reports full at zero or below", () => {
    assert.equal(spotsLabel(0), "Full");
    assert.equal(spotsLabel(-2), "Full");
  });

  test("treats a bad value as full rather than printing NaN", () => {
    assert.equal(spotsLabel(Number.NaN), "Full");
  });
});

describe("feedState", () => {
  const base = { configured: true, loading: false, error: null, visibleCount: 0, hasActiveFilters: false };

  test("unconfigured wins over every other signal", () => {
    assert.equal(feedState(base), "empty");
    assert.equal(feedState({ ...base, configured: false, loading: true, error: "boom", visibleCount: 5 }), "unconfigured");
  });

  test("an error is not hidden by loading or by rows already on screen", () => {
    assert.equal(feedState({ ...base, error: "network", loading: true }), "error");
    assert.equal(feedState({ ...base, error: "network", visibleCount: 9 }), "error");
  });

  test("loading is reported before empty", () => {
    assert.equal(feedState({ ...base, loading: true }), "loading");
  });

  test("ready when there are visible rows", () => {
    assert.equal(feedState({ ...base, visibleCount: 2 }), "ready");
  });

  test("distinguishes a genuinely empty campus from an over-filtered one", () => {
    assert.equal(feedState(base), "empty");
    assert.equal(feedState({ ...base, hasActiveFilters: true }), "no-matches");
  });

  test("rows matching nothing but filters off is still 'empty'", () => {
    assert.equal(feedState({ ...base, visibleCount: 0, hasActiveFilters: false }), "empty");
  });
});

describe("notesForViewer — private state never crosses identities", () => {
  const A = "user-a";
  const B = "user-b";
  const rows = [{ id: "n1", title: "A's private notification" }];

  function input(overrides = {}) {
    return {
      stateViewerId: A,
      currentViewerId: A,
      notes: rows,
      error: null,
      loading: false,
      retrying: false,
      ...overrides,
    };
  }

  test("renders when the payload belongs to the current viewer", () => {
    const v = notesForViewer(input());
    assert.equal(v.isForCurrentViewer, true);
    assert.deepEqual(v.notes, rows);
  });

  test("A's notifications are not rendered after B signs in", () => {
    const v = notesForViewer(input({ currentViewerId: B }));
    assert.equal(v.isForCurrentViewer, false);
    assert.deepEqual(v.notes, [], "previous identity's rows must not be returned");
  });

  test("A's notifications are not rendered after A signs out", () => {
    const v = notesForViewer(input({ currentViewerId: null }));
    assert.equal(v.isForCurrentViewer, false);
    assert.deepEqual(v.notes, []);
  });

  test("a payload loaded for nobody is not shown to a newly signed-in viewer", () => {
    const v = notesForViewer(input({ stateViewerId: null, currentViewerId: A, notes: [] }));
    assert.equal(v.isForCurrentViewer, false);
  });

  test("A's error is not shown to B — including while B is still loading", () => {
    const stale = notesForViewer(input({ currentViewerId: B, notes: [], error: "A failed to load" }));
    assert.equal(stale.error, null);
    assert.equal(stale.loading, false);
    assert.equal(stale.retrying, false);
  });

  test("A's in-flight loading state does not make B look busy", () => {
    const v = notesForViewer(input({ currentViewerId: B, notes: [], loading: true }));
    assert.equal(v.loading, false);
  });

  test("A's Retry busy state does not disable or label B's button", () => {
    const v = notesForViewer(input({ currentViewerId: B, retrying: true }));
    assert.equal(v.retrying, false);
    assert.equal(v.isForCurrentViewer, false);
  });

  test("all four fields are released together, never partially", () => {
    const v = notesForViewer(input({ currentViewerId: B, loading: true, retrying: true, error: "boom" }));
    assert.deepEqual(v, { notes: [], error: null, loading: false, retrying: false, isForCurrentViewer: false });
  });

  test("two viewers with identical rows are still distinguished by the tag", () => {
    // Same shape, different owner: only the id decides.
    const asA = notesForViewer(input({ stateViewerId: A, currentViewerId: A }));
    const asB = notesForViewer(input({ stateViewerId: A, currentViewerId: B }));
    assert.equal(asA.isForCurrentViewer, true);
    assert.equal(asB.isForCurrentViewer, false);
    assert.notDeepEqual(asA.notes, asB.notes);
  });

  test("does not mutate its input", () => {
    const arg = input();
    const before = JSON.stringify(arg);
    notesForViewer(arg);
    assert.equal(JSON.stringify(arg), before);
  });
});
