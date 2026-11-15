# Architecture

Afloat is a static progressive web app (no build step) talking to Firebase. This document covers how the pieces fit together and why.

## 1. Overview

```
Browser (PWA)                       Firebase
index.html + app/*.js   ─────►  Cloud Functions (callable, Node 22)
platform/claude.js                 ├─ tool       Trello + Google Calendar, with each user's own tokens
 window.claude.use(...)            ├─ sample     Claude via the Anthropic API (per-household key and cap)
meals/ (iframe module)             ├─ households create / invite / members
sw.js (offline cache)              ├─ links      free/busy and plans shared between households
                         ◄────►    ├─ travel     transit delays, routes, flight status
                      realtime     └─ pushDue    scheduled push notifications (FCM)
                                Firestore (rules-isolated)  ·  Storage  ·  Hosting
```

## 2. The client

- **No framework, no bundler.** `app/*.js` are plain scripts that share one scope and load in the order `index.html` lists them (start-up in `boot.js` loads last). One file per area keeps each change small and local.
- **Rendering.** Each screen is a template-string function (`vToday()`, `vPlans()`, …). `render()` rebuilds the screens and `setHtml()` only touches the DOM when the generated HTML changed, which avoids flicker and lost focus. Everything that originates from a person or a third party is passed through `esc()`.
- **Events.** Buttons carry `data-act`; handlers are `case` branches in the owning file's `tapX()`, chained from `events.js`. Forms use `data-form`.
- **State.** One object, `S`. Persistent data is read with `H('name')` (the Firestore document `home/name`) and written with `saveHome()` / `writeDoc()` / `mergeDoc()`.
- **Capability interface.** UI code never imports Firebase. It asks `window.claude.use('db' | 'mcp' | 'sample' | 'assets')`; `platform/claude.js` implements those on Firebase, and tests substitute fakes.
- **Offline.** `sw.js` caches the shell; the cache name is bumped on every new file. Without Firebase config the app runs on the device only.
- **Meals** is a separate page with its own shared scope (`meals/js/*.js`) embedded in an iframe, so a large, self-contained feature does not widen the main scope.

## 3. Saving without clobbering

`putDoc` keeps the last copy of each document this device saw (`known[path]`) and sends only the fields that differ, including nested maps and deletes, using Firestore `update` with field paths. Two phones changing different parts of the same document therefore merge instead of overwriting each other. Lists are replaced whole; if concurrent edits to one list become a problem, the planned fix is to key list items by id. The real-Firebase CI check includes a control proving that the older whole-document save loses a change.

## 4. Data model

Documents are grouped under an app root (`apps/<app>/…` for the first household, `households/<hid>/apps/<app>/…` for the others):

- `home/*`: settings, lists, profiles, calendar setup, household profile and module switches
- `days/<date>`, `weeks/<date>`, `months/<yyyy-mm>`: per-period state (ticks, reminders, plans for tomorrow)
- `events/*`: calendar events; only those ending within 60 days or repeating are subscribed to, and more load as the user browses back
- `plans/*`, `home/tasks`, `restlog`, and the Meals collections under their own app root

## 5. Server

Cloud Functions are callable endpoints. Each first resolves the caller's household and membership (`who()`), so integrations only work for invited people. Trello and Google tokens live in server-only `private/{uid}` documents. The `sample` function wraps the Anthropic API: per-household keys (kept server-only; the client sees the last four characters), a monthly spending cap, a cheap model by default and a larger one only for photos. Integration mappings (Trello, Google Calendar, travel, links) are plain modules covered by `node:test` unit tests with fake HTTP.

## 6. Households and isolation

One deployment serves many invite-only households. The first (legacy) household keeps its original paths; every other household lives under `households/<hid>/`, with members listed on the household document. `users/<email>` maps an address to its household and is only readable by that address. Only server code writes membership, invitations and keys. Firestore and Storage rules enforce that a verified member can read and write only their household's subtree, and a CI job runs the real rules in the Firebase emulator with two households to prove it.

Friends between households are explicit, per-person links. Only what a person chooses to share (for example free/busy windows) crosses households, via server functions; health information, sensitive topics and personal tasks never do.

## 7. Modules

A household switches features on or off (kids' days, trips, together/check-ins, signals, tasks, gigs). `modOn(key)` resolves each switch from the household profile with sensible defaults, and screens, reminders, briefings and Claude prompts all consult it. A first-open welcome form builds the profile.

## 8. Security

- Verified Google sign-in; optional blocking functions reject uninvited addresses at sign-in.
- Rules-enforced tenant isolation; server-only collections for tokens, keys, invitations and the access log.
- Headers on every page: `frame-ancestors 'self'`, `X-Frame-Options: SAMEORIGIN`, `nosniff`, strict referrer policy, restricted permissions policy.
- Output escaping everywhere; Claude output is treated as untrusted text.
- Deployment secrets live in the CI provider, never in the repository; web config values are public identifiers that the rules protect.

## 9. Testing and delivery

| Layer | Tooling |
|---|---|
| Structure | `tools/check.js`: every file loaded and cached, everything parses, no duplicate names, generated map current, optional private-word scan of served files |
| UI | Playwright (Chromium) against fake Firebase, Trello, Google and Claude; `smoke` opens every screen and fails on any page error |
| Server | `node:test` for integration mappings, households and links |
| Rules | Emulator-based check with the real SDK, two devices and two households |
| Delivery | GitHub Actions: check, server tests, config substitution, deploy hosting, functions and rules |
