/**
 * Context.dev extraction → stored rows.
 *
 * The event rules state that judges check for hard-coded / invented
 * functionality, so these tests pin down the anti-fabrication guarantees:
 * nothing without a real title is stored, no link is ever invented, and no
 * date is ever guessed.
 *
 * Zero dependencies — Node's built-in test runner and type stripping.
 *   npm test        (or: node --test)
 *
 * NOTE the filename: `-test.mjs`, not `.test.mjs`. Node discovers both, but
 * vitest — which the frozen Vite backup at the repository root uses — globs for
 * dotted `.test.` filenames. A dotted name here gets picked up by that project
 * and fails there, because this file uses node:test, not vitest's API.
 * Keep the hyphen.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { normalize } from "../src/lib/club-normalize.ts";

const SOURCE = "https://aggielife.ucdavis.edu/events";
const PAGE = `
  Upcoming Events
  [Davis Boxing Club Open Mat](https://aggielife.ucdavis.edu/event/boxing-open-mat)
  [Picnic Day](https://example.org/picnic-day)
`;

describe("normalize — anti-fabrication", () => {
  test("drops an event with no title", () => {
    assert.equal(normalize([{ location: "ARC" }], SOURCE, PAGE).length, 0);
  });

  test("drops an event whose title is only whitespace", () => {
    assert.equal(normalize([{ title: "   " }], SOURCE, PAGE).length, 0);
  });

  test("never invents a link: an off-site URL absent from the page falls back to the listing", () => {
    const [e] = normalize([{ title: "Mystery Meetup", event_url: "https://evil.example/x" }], SOURCE, PAGE);
    assert.equal(e.event_url, SOURCE);
  });

  test("rejects a javascript: URL and falls back to the listing", () => {
    const [e] = normalize([{ title: "Clickbait", event_url: "javascript:alert(1)" }], SOURCE, PAGE);
    assert.equal(e.event_url, SOURCE);
  });

  test("accepts a same-site event URL", () => {
    const [e] = normalize(
      [{ title: "Boxing Open Mat", event_url: "https://aggielife.ucdavis.edu/event/boxing-open-mat" }],
      SOURCE,
      PAGE,
    );
    assert.equal(e.event_url, "https://aggielife.ucdavis.edu/event/boxing-open-mat");
  });

  test("accepts an off-site URL that really is present in the page", () => {
    const [e] = normalize([{ title: "Picnic Day", event_url: "https://example.org/picnic-day" }], SOURCE, PAGE);
    assert.equal(e.event_url, "https://example.org/picnic-day");
  });

  test("resolves a relative URL against the source", () => {
    const [e] = normalize([{ title: "Relative", event_url: "/event/relative" }], SOURCE, PAGE);
    assert.equal(e.event_url, "https://aggielife.ucdavis.edu/event/relative");
  });

  test("keeps starts_at null when the date cannot be parsed, rather than guessing", () => {
    const [e] = normalize([{ title: "Undated", starts_at: "sometime next week" }], SOURCE, PAGE);
    assert.equal(e.starts_at, null);
  });

  test("normalises a parseable date to ISO", () => {
    const [e] = normalize([{ title: "Dated", starts_at: "2026-10-11T15:00:00-07:00" }], SOURCE, PAGE);
    assert.equal(e.starts_at, "2026-10-11T22:00:00.000Z");
  });
});

describe("normalize — de-duplication", () => {
  const base = { organization: "Davis Boxing", starts_at: "2026-10-11T15:00:00-07:00" };

  test("collapses the same event listed twice", () => {
    const rows = normalize(
      [{ title: "Open Mat", ...base }, { title: "Open Mat", ...base }],
      SOURCE,
      PAGE,
    );
    assert.equal(rows.length, 1);
  });

  test("treats punctuation and case differences as the same event", () => {
    const rows = normalize(
      [{ title: "Open Mat!", ...base }, { title: "open mat", ...base }],
      SOURCE,
      PAGE,
    );
    assert.equal(rows.length, 1);
  });

  test("keeps the same title on a different day", () => {
    const rows = normalize(
      [{ title: "Open Mat", ...base }, { title: "Open Mat", ...base, starts_at: "2026-10-12T15:00:00-07:00" }],
      SOURCE,
      PAGE,
    );
    assert.equal(rows.length, 2);
  });

  test("keeps the same title and day from a different organization", () => {
    const rows = normalize(
      [{ title: "Open Mat", ...base }, { title: "Open Mat", ...base, organization: "Other Club" }],
      SOURCE,
      PAGE,
    );
    assert.equal(rows.length, 2);
  });

  test("dedupe keys are stable for identical input", () => {
    const [a] = normalize([{ title: "Open Mat", ...base }], SOURCE, PAGE);
    const [b] = normalize([{ title: "Open Mat", ...base }], SOURCE, PAGE);
    assert.equal(a.dedupe_key, b.dedupe_key);
    assert.equal(a.dedupe_key.length, 32);
  });
});

describe("normalize — field hygiene", () => {
  test("collapses whitespace in every text field", () => {
    const [e] = normalize(
      [{ title: "  Open   Mat  ", organization: " Davis\n Boxing ", location: " ARC  Court 2 ", description: "a  b" }],
      SOURCE,
      PAGE,
    );
    assert.equal(e.title, "Open Mat");
    assert.equal(e.organization, "Davis Boxing");
    assert.equal(e.location, "ARC Court 2");
    assert.equal(e.description, "a b");
  });

  test("caps title, location and description lengths", () => {
    const [e] = normalize(
      [{ title: "T".repeat(500), location: "L".repeat(500), description: "D".repeat(2000) }],
      SOURCE,
      PAGE,
    );
    assert.equal(e.title.length, 160);
    assert.equal(e.location.length, 160);
    assert.equal(e.description.length, 600);
  });

  test("records the source hostname, not the full URL", () => {
    const [e] = normalize([{ title: "Anything" }], SOURCE, PAGE);
    assert.equal(e.source_site, "aggielife.ucdavis.edu");
  });

  test("an empty result set is not an error", () => {
    assert.deepEqual(normalize([], SOURCE, PAGE), []);
  });
});
