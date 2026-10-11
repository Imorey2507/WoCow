# WoCow — 2-minute demo runbook

The submission requires a **recorded demo, 2 minutes MAX** (YouTube link). This
is the click-by-click script. The event rules also warn that *judges check for
hard-coded functionality*, so **everything shown must be real data entered live**
— never a pre-seeded activity you pretend to create.

---

## Pre-flight (do this 5 minutes before)

| # | Check | Why |
| --- | --- | --- |
| 1 | Two browsers side by side: **normal** + **private/incognito** | Two identities, so "someone else joined" is visibly real |
| 2 | Signed in as **different accounts** in each | Same account cannot demonstrate realtime |
| 3 | Both on the **deployed URL**, same Wi-Fi or both on cellular | Mixed networks still work; be consistent |
| 4 | Header shows a green **Live** dot in *both* windows | If it says "Offline", realtime is down — fix before recording |
| 5 | Database has **no leftover test junk** | Judges may browse afterwards |
| 6 | Phone in landscape propped up, or screen recorder at 1080p | Text must be legible in the YouTube upload |
| 7 | **Do a full run-through once, then reset** | Never record a first attempt |

> **Timing reality:** 2 minutes is ~300 spoken words. Rehearse to **1:45** so you
> have slack. Practise the reset, too.

**Reset between takes:** in window A, cancel every activity you host
(*My plans → Cancel*), and leave anything you joined.

---

## The script

Tab names below are the **Vite app** (repo root); the equivalent Next.js tab in
`aggie-playground/` is in brackets.

### 0:00 – 0:15 — The problem

> "It's 3pm at UC Davis and you want to play basketball — but you're alone.
> Group chats are dead and nobody answers. **WoCow fixes exactly that.**"

Show the **Discover** [`discover`] list already populated with real activities.

### 0:15 – 0:45 — Host an activity (window A)

1. Click **+ Host**.
2. Title: **`Pickup basketball`** · Category: **Basketball**
3. Tap **📍 Drop a pin** and click on the map on campus — **or** pick **UC Davis ARC** from the chips.
4. **Max participants: 2** ← *(deliberate: it makes the capacity limit visible later)*
5. Starts in ~1 hour, ends 2 hours later → **Create activity**.

> "Anyone can host in about ten seconds — real location, real time, real limit."

The card appears immediately. Note the counter reads **0/2**.

### 0:45 – 1:15 — It's on the map (window B)

1. Switch to window B and go to the **Map** [`map`] tab.
2. **Do not refresh** — the new pin should already be there.
3. Click the pin → popup shows title, time, and **0/2 going**.
4. Click **Join**.

> "Window B never refreshed. Realtime pushed it straight onto the map."

### 1:15 – 1:40 — The live head-count (the money shot)

Keep **both windows visible** side by side.

1. Window A is still on Discover. Watch that card: **0/2 → 1/2** with no refresh.
2. Now, in window A, click **Join** on the same activity.
3. Both windows now read **2/2** and the card shows **full**.

> "Two people, two browsers, one shared count — and it updated itself, live."

### 1:40 – 2:00 — Why it can't oversell

1. Open a **third** window, signed in as anyone else.
2. Click **Join** on the now-full activity.

A red toast appears: **"That activity just filled up — try another one."**

> "The limit is enforced inside Postgres with a row lock, not in the browser.
> Two people tapping Join at the same instant can't both get the last slot."

**End on the full card.** Stop recording.

---

## If something breaks on camera

| Failure | Recovery (say this, keep moving) |
| --- | --- |
| Count doesn't update live | Refresh once, say *"that's the websocket reconnecting"* — then **still show** the correct count |
| Join button greyed out | Activity is already full from an earlier take → **reset and re-record this segment** |
| Map tiles blank | Pan once, or fall back to the **Discover** list and narrate the pin location |
| Login fails | **Switch to the backup recording.** Always have one. |

**Always record a clean take in advance and have it uploaded.** Live demos fail;
a backup is the difference between a score and a zero.

---

## What the judges are scoring

- **Creativity** — spontaneous activity *formation*, not just event listing.
- **Technical impressiveness** — the `join_activity()` row lock, RLS, derived
  counts, Realtime. Say the words "row lock" and "Row Level Security" out loud;
  they are the difference between a CRUD app and this.
- **Functionality** — nothing above is mocked. Emphasise that the count is
  computed by the database, not stored in a column.

If you also ship the Context.dev club scraping, add **10 seconds**: open the
Discover tab and point at a *real scraped AggieLife club event* next to a
student-hosted activity — same map, same filters. That is the $750 bonus track.
