# Roadmap

## Delivered

- **Structure:** a single 755 KB page split into area modules with a generated code map, a one-second structural check and a smoke test, so changes stay small and cheap.
- **Reliable multi-device saving:** field-level saves that merge concurrent edits, verified against Firebase's emulator in CI.
- **Bounded reads:** only visible calendar events are subscribed to; older ones load on demand.
- **Own backend:** moved from a hosted-artifact prototype to Firebase with a tested server for Trello, Google Calendar and Claude.
- **Backups:** one-click JSON export and restore.
- **Multi-household:** invite-only households with rules-enforced isolation, per-household Claude keys and spending caps, module switches, a first-open welcome flow, and no household data in served code (enforced in CI).
- **Task connectors:** a common interface over Trello and Afloat's own lists.
- **Projects:** one planning system for events, trips and deadlines, including planning together across households, study plans from a photo, and live transit, route and flight data on travel legs.
- **Friends between households:** opt-in free/busy sharing and shared plans.

## Next

**Product**
- Google Tasks and Todoist adapters behind the task connector.
- Generalise "gigs" into events with prep before and follow-up after, for any kind of work or trip.
- Native Android app: home-screen widgets ("next thing, leave in N minutes"), then opt-in location for arrival notifications.
- Calendar import from university systems (iCal) as study plans.
- Push notifications when a planned train or flight is delayed or cancelled.
- A "Move" tab for exercise goals next to Focus.

**Engineering**
- Key list items by id so concurrent edits to the same list also merge.
- Move change/submit handlers out of `events.js` into the area files, as was done for taps.
- Migrate older tests to the shared `tests/helpers.js`.
- Add a smoke test for each Meals tab.

## Working agreements

- Start from `CLAUDE.md`, grep `docs/MAP.md`, read only the lines you need.
- Run the check, the smoke test and the area's tests before pushing; the full suite for larger changes.
- New behaviour ships with a test.
