# Aggie Playground — 2-minute demo runbook

Click-by-click script for the recorded submission demo (**2 minutes MAX**,
YouTube link). Everything below targets the official app in
[`aggie-playground/`](aggie-playground/) — the Next.js App Router build.

> ⚠️ **This script has never been executed end-to-end.** It is written from the
> source code, not from a rehearsal. Rehearse it against a real Supabase
> project before recording, and fix anything that does not match.

The event rules warn that **judges check for hard-coded functionality**, so
everything shown must be entered live. Never present a pre-seeded activity as
if you just created it.

---

## The app, as it actually is

| Route | Bottom-nav label | What is on it |
| --- | --- | --- |
| `/` | — | Landing page |
| `/discover` | 🔥 Discover | Search, category chips, status toggle, **🔴 Happening Now**, **⏰ Starting Soon**, **🎪 Campus Clubs**, **Discussions** |
| `/map` | 🗺️ Map | **🗺️ Campus Map**, pins labelled `emoji + count`, tap a pin → preview card with the join button |
| `/profile` | 🧑🎓 Profile | **🔔 Notifications**, **🎤 Hosting**, **🎟️ Joined**, and the profile form |
| `/buddies` | 🤝 Buddies | Matching buddies |

Key buttons, verbatim from the code:

- Header: **`+ Host Activity`**
- Create form title: **`Host an activity`**; submit button: **`Host it! 🎉`**
- Join button: **`Join Activity`** → **`…`** while in flight → **`Leave`** once joined; **`Full`** when there is no room
- Hosts see **`You're hosting`** on their own card, plus **`Edit`** / **`Cancel`**

---

## Pre-flight (do this before recording)

| # | Check |
| --- | --- |
| 1 | **Two windows, two accounts, both already signed in.** Use a normal window for **Account A** and a separate browser profile (or a normal + an incognito window you keep open) for **Account B**. |
| 2 | **Do not sign in on camera.** Pre-arranged sessions are the whole point — authentication is the riskiest part of any live demo. |
| 3 | Both windows on the **deployed URL**, both showing real data. No "⚙️ Backend not connected" banner. |
| 4 | **As Account A:** go to `/profile`, tick **`Competitive Sports`** under *Favorite categories*, press **`Save profile`**, and wait for the `Profile saved ✨` toast. This is what makes the notification land later. |
| 5 | **As Account B:** go to `/profile` and press **`Sign out`**, then sign back in, to confirm the session is solid. |
| 6 | **Clear old activities.** As each account, `Cancel` anything you host from `/profile` → **🎤 Hosting**. Judges may browse afterwards. |
| 7 | Phone landscape or 1080p screen recording. Text must survive the YouTube encode. |
| 8 | **Record one clean take in advance and upload it.** Always have a backup. |

> **Know this before you record:** the host is **automatically the first
> participant** (`host_auto_join` trigger). When A hosts a `Max people: 2`
> activity, the counter immediately reads **`1 / 2 players`**, not `0 / 2`.
> Script around it — it is good material, not a bug.

---

## The script

### 0:00 – 0:15 — The problem

> "It's 3pm at UC Davis and you want to play volleyball — but you're alone.
> Group chats are dead. **This is Aggie Playground.**"

Open `/discover`. Point at **🔴 Happening Now** and **⏰ Starting Soon** and the
counts in the round badges.

### 0:15 – 0:45 — Account A hosts

In **window A**:

1. Press **`+ Host Activity`** in the header.
2. **Title:** `Sand volleyball` · **Category:** `Competitive Sports` ·
   **Subcategory:** `Volleyball`
3. **Where:** pick a campus location from the dropdown (e.g. the ARC).
4. **Max people: `2`** ← deliberate. It makes the capacity limit visible later.
5. **Starts:** leave the default (it pre-fills to the next 5-minute mark).
6. Press **`Host it! 🎉`**.

The card appears with **`1 / 2 players`** and **`1 spot left`**.

> "The host counts as the first player. Ten seconds, real location, real limit."

### 0:45 – 1:15 — Account B sees it without refreshing

In **window B** (has been sitting open the whole time):

1. Tap **🗺️ Map** in the bottom nav.
2. **Do not refresh.** A new pin labelled `🏐 1/2` is already there — Realtime
   pushed it.
3. Tap the pin → the preview card slides up.
4. Press **`Join Activity`**. The button shows **`…`** while it works, then
   becomes **`Leave`**.

> "Window B never refreshed. Realtime put that pin on the map."

### 1:15 – 1:40 — The live head-count (the money shot)

Put **both windows side by side**.

1. Window A is on `/discover` (or `/profile` → **🎤 Hosting**). Watch the card:
   **`1 / 2 players` → `2 / 2 players`**, **`1 spot left` → `Full`**. No refresh.
2. Switch B to `/profile` and point at **🎟️ Joined** — the activity is listed
   there. This is the same `participants` table read through the new identity.

> "Two browsers, one shared count, updated by Postgres — not by the client."

### 1:40 – 2:00 — Why it cannot oversell

In **window A**, tap the join button on the now-full activity. The red full
state blocks it.

Then, if you have a third identity handy, try to join from it — the toast reads:

> **"Someone just grabbed the last spot — this one is full."**

> "The limit lives inside Postgres, behind a row lock, not in the browser. Two
> people tapping Join in the same instant cannot both get the last slot."

**Stop recording.**

---

## Optional segment A — notifications (+15s)

Do this only if you have time to spare, and only if Account A already favorited
the category in pre-flight.

1. Leave **window A** on `/profile`, looking at **🔔 Notifications**.
2. In **window B**, host another activity in **`Competitive Sports`**.
3. In window A, a new row appears **without a refresh**: **`🆕 New in
   Competitive Sports`**, with the activity title and location, and the unread
   badge on **🔔 Notifications** increments.

> "A database trigger matched this activity to her favourite category and
> pushed a notification. No polling."

Point out **`Mark all read`** and the ✏️ / ❌ notification kinds.

---

## Optional segment B — Context.dev degrades, the app does not (+15s)

This is the strongest answer to "does it break without the sponsor API?".

1. In **window B**, scroll `/discover` to **🎪 Campus Clubs**.
   With no `CONTEXT_DEV_API_KEY` set, it shows **`No club events yet`** —
   an empty state, not an error, and **nothing is fabricated**.
2. Press **`↻ Refresh from AggieLife`**.
3. The result is an explicit message, e.g. **"The last refresh failed:
   CONTEXT_DEV_API_KEY is not set on the server. Showing previously cached
   events only — nothing is substituted."**
4. Tap **Map**, then **Discover** — everything else still works.

> "The club feed is a cache that can fail. When it fails we say so and show
> what we had. The rest of the app never depends on it."

Use the real failure only if your deployment is genuinely missing the key.
Never stage a fake error.

---

## If something breaks on camera

| Failure | Recovery |
| --- | --- |
| Count does not update live | Refresh once and say *"that's the websocket reconnecting"* — still show the correct number |
| Join does nothing | Activity is already full from an earlier take → **reset and re-record this segment** |
| Map tiles blank | Pan once, or narrate from `/discover` instead |
| Session lost | **Switch to the backup recording.** |
| Notification never arrives | Skip segment A entirely. Do not improvise. |

---

## What the judges are scoring

- **Creativity** — spontaneous activity *formation*, not another event listing.
- **Technical impressiveness** — the `join_activity()` row lock, Row Level
  Security, database-derived counts, and Realtime. **Say the words "row lock"
  and "Row Level Security" out loud.** That is the difference between a CRUD
  app and this one.
- **Functionality** — nothing above is mocked. Emphasise that
  `participant_count` is *computed by the database*, never stored in a column.

If you show the Context.dev segment, name the bonus track explicitly: **"Best
Use of Context.dev — $750"**.
