# Afloat

**A calm, installable planner for households: today's plan, calendar, tasks, meals and projects in one place, built to guide rather than nag.**

Afloat is a full-stack progressive web app with a serverless backend. It brings a household's calendar, to-do lists, reminders, meal planning and trip planning together on one screen, and uses Claude to turn messy input (a brain dump, a photo of a recipe, an invitation or a study plan) into structured, editable items.

Its guiding principle is *gentleness, not guilt*: nothing is "overdue", nothing piles up, and each screen shows only what is relevant right now.

> This repository is a portfolio-ready snapshot of a production app. All sample data in the tests is fictional.

---

## Highlights

| Area | What it does |
|---|---|
| **Today** | A briefing that picks what matters now: leave-by times, weather, due tasks, reminders and a short checklist for the day. |
| **Calendar** | Two-way Google Calendar sync, invitations, repeating events, colour-coding, and per-event leave times and weather. |
| **Tasks** | Trello integration plus Afloat's own lists behind a single task-connector layer. A "brain dump" box sorts free text into the right lists using Claude. |
| **Meals** | Recipes from text or photos (units normalised to metric), an "at home" pantry view built from receipts or screenshots, shopping lists and a weekly menu. |
| **Projects** | One planning system for any event, trip or deadline: prep before, journey, what to do there, tasks after. Live public-transport delays and flight status on travel legs. |
| **Focus mode** | An "active" state for focus sessions that draws on your open tasks and a per-activity "what you need to start" checklist. |
| **Households & friends** | Invite-only multi-household support with per-household data isolation, module switches, and opt-in free/busy sharing between households. |
| **Offline & installable** | Service-worker caching and a web app manifest; works as an installed app on Android and desktop. |

## Tech stack

- **Frontend:** vanilla HTML, CSS and JavaScript. No framework and no build step; ~45 area-scoped modules share one scope and are loaded in a fixed order.
- **Backend:** Firebase: Authentication (Google sign-in), Firestore, Cloud Storage, Hosting, Cloud Functions (Node.js 22), Cloud Messaging for push notifications.
- **Integrations:** Google Calendar API, Trello API, Anthropic API (Claude), Open-Meteo (weather), Golemio / PID (Prague transit), Google Routes, AeroDataBox (flights).
- **Testing:** Playwright browser tests against fake Firebase, Trello, Google and Claude back-ends; `node:test` for the server; an emulator-based check of the real security rules.
- **CI/CD:** GitHub Actions: fast static checks, server tests, then deploy to Firebase on every push to `main`.

## Architecture at a glance

```
 Phone / desktop (PWA)                         Firebase
┌──────────────────────────┐        ┌───────────────────────────────────┐
│ index.html + app/*.js    │        │ Cloud Functions (Node 22)         │
│  one file per area       │ ─────► │  tool: Trello / Google Calendar   │
│ platform/claude.js       │ callable│  sample: Claude via Anthropic API │
│  window.claude.use(...)  │        │  households, links, travel, push  │
│ meals/ (iframe module)   │        ├───────────────────────────────────┤
│ sw.js (offline cache)    │ ◄────► │ Firestore  (rules-isolated        │
└──────────────────────────┘ realtime│  per household)  ·  Storage      │
                                     └───────────────────────────────────┘
```

The UI asks for services through a small capability interface, `window.claude.use('db' | 'mcp' | 'sample' | 'assets')`. `platform/claude.js` implements it on Firebase, which keeps the UI independent of the backend and makes it straightforward to swap in fakes for tests.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for data flow, the saving strategy, multi-household isolation and the security model.

## Engineering notes

A few decisions worth calling out:

- **Conflict-free saves.** Each save sends only the fields that changed compared with the last copy the device saw (including nested maps), so two phones editing different parts of the same document never overwrite each other. A test demonstrates that a whole-document save would have lost a change.
- **Bounded reads.** Only calendar events that can appear on screen are subscribed to; older ones load when the user browses back.
- **Tenant isolation by construction.** Firestore and Storage rules scope every read and write to a verified member of that household. An emulator-based CI check starts two households and asserts that neither can read or write the other's data, add members or read API keys.
- **Secrets stay on the server.** Users' Trello and Google tokens and each household's Claude key are server-only; the client only ever sees the last four characters of a key. Claude spend is capped per household per month.
- **Privacy guard in CI.** A check fails the build if configured private words (names, places) appear in the files served to browsers, so personal data lives in the database rather than the code.
- **Escaped output everywhere.** All user, Trello, Google and Claude text is escaped before rendering.
- **Cheap to change.** A generated code map (`docs/MAP.md`), a one-second structural check (`tools/check.js`) and a ~15-second smoke test that opens every screen keep the feedback loop short in a no-build codebase.

## Project layout

```
app/          Application modules, one file per area (today, calendar, tasks, plans, focus, ...)
meals/        Meals module (separate page, loaded in an iframe), with its own scripts and styles
platform/     Firebase layer behind window.claude.use(...), config, shared helpers
functions/    Cloud Functions: integrations, households, links between households, travel, push
tests/        Playwright browser tests, fakes (Firebase, Trello) and sample data (seed.json)
tools/        check.js (structural check), map.js (code map generator)
docs/         ARCHITECTURE.md, ROADMAP.md, MAP.md (generated)
help/         In-app how-to pages for connecting third-party API keys
```

## Getting started

### Run the tests (no Firebase needed)

```bash
npm install -g playwright && npx playwright install chromium   # once
node tools/check.js                       # ~1 s: files load, parse, no duplicate names, map current
node tests/smoke.test.js                  # ~15 s: opens every screen, fails on any page error
node tests/run-all.js -j 2                # full browser suite
cd functions && npm ci && npm test        # server tests
```

### Deploy your own copy

1. Create a Firebase project (Blaze plan) and enable Google sign-in, Firestore, Storage and Hosting.
2. In your GitHub repository, set these **variables**: `FIREBASE_PROJECT`, `FIREBASE_WEB_CONFIG` (the web-app config as JSON), `OWNER_EMAIL`, `TRELLO_KEY`, `GOOGLE_CLIENT_ID`; optional: `SIGNIN_GATE`, `PUSH`, `FIREBASE_VAPID_KEY`.
3. Set these **secrets**: `FIREBASE_SERVICE_ACCOUNT`, `GOOGLE_CLIENT_SECRET`, `ANTHROPIC_API_KEY`; optional: `PRIVATE_WORDS` (one per line, enforced by `tools/check.js`).
4. Push to `main`. [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) runs the checks, tests the server, substitutes configuration, and deploys hosting, functions and security rules.

The owner (`OWNER_EMAIL`) can then invite other people by Google address from **Settings → Connections**.

## Security model

- Verified Google sign-in; optional blocking functions turn away uninvited addresses at sign-in.
- Rules-enforced per-household data isolation (see above), with server-only collections for tokens, keys and invitations.
- Hardened headers on every page: `frame-ancestors 'self'`, `nosniff`, strict referrer policy, no location, microphone or payment access.
- Rejected access attempts are logged for the owner.

## Roadmap

See [docs/ROADMAP.md](docs/ROADMAP.md). Next up: Google Tasks and Todoist adapters, a native Android app with widgets, and a generalised "events with prep and follow-up" planner.

## Contributing / working in the code

[CLAUDE.md](CLAUDE.md) is the short developer guide (where things are, how state and saving work, the check-test-deploy loop). The project was built with Claude as a pair-programming partner.
