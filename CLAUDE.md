# Afloat: how to work on it (read this first, it's short)

Afloat is a household planning app: a vanilla-JS progressive web app on Firebase, with Claude-powered input sorting. Guiding rule: gentleness, not guilt; nothing is "overdue", nothing piles up; relevance over detail. Every push to `main` deploys (see README → Deploy your own copy).

**Multi-household rule:** nothing about any household goes into the served files (`app/`, `meals/`, `platform/`, `index.html`, `sw.js`): names, places and birthdays come from the household's data (`houseFacts()`, `kidsList()`, `theKids()`, `modOn()`). `node tools/check.js` fails on private words if `.private-words` (local, git-ignored) or `PRIVATE_WORDS` (CI secret) is set. `ourHome()` is true only for the first (legacy) household. Test a new household with `t.open({ fresh: true, init: () => { window.claude.household = () => ({ hid: 'h2', legacy: false }); } })`.

## Where things are

- `index.html`: the page shell (header, tabs, empty containers) and the list of scripts. Almost no code.
- `app/*.js`: the app, **one file per area**. They are plain scripts that share one scope, loaded in the order index.html lists them. Any file can use any name from any other file once the app is running.
- `app/afloat.css`: all styles.
- `docs/MAP.md`: generated map of every file: what it holds, its sections, every top-level function/constant with its line number, and which files use each `home/*` document. **Grep it first** instead of reading code.
- `meals/`: the Meals tab (Mealtime), a separate page in an iframe: `meals/index.html` (shell), `meals/js/*.js` (its own shared scope), `meals/meals.css`. Also in docs/MAP.md.
- `platform/`: Firebase layer (`claude.js` provides `window.claude.use('db'|'mcp'|'sample'|'assets')`), `food.js`, `swipe.js`.
- `functions/`: the server (Trello, Google Calendar, Claude through the Anthropic API, push notifications).
- `tests/`: Playwright tests against a pretend database, Trello, Google and Claude. New tests use `tests/helpers.js` (see `tests/smoke.test.js` for the shape).
- `docs/ARCHITECTURE.md`: data flow, saving, households, security. `docs/ROADMAP.md`: what's done and what's next.

| Area | File |
|---|---|
| helpers, dates, state `S` | core.js |
| reading/writing data, boot, refresh, toast, icons, tabs | store.js |
| render(), setHtml(), list helpers | render.js |
| Today screen / calm Today / briefing | today.js, calm.js, briefing.js |
| going out, weather | going-out.js |
| reminders, phone notifications | reminders.js |
| Today's setup, situation, evenings | situation.js |
| drop-offs, pick-ups, bedtime, gigs | our-days.js |
| self-care, mornings, My setup | self-care.js |
| sick-day mode | sick-day.js |
| Trello, tasks, + button, From a photo | trello.js, tasks.js, capture.js |
| Together, check-up, date ideas, job switch | together.js, checkup.js, date-ideas.js, job.js |
| trips | trips.js |
| family, friends, food profiles | family.js |
| Plan tomorrow | plan-tomorrow.js |
| calendar: colours, sync + invitations, repeats + hlídání, event form, views | colours.js, calendar-sync.js, recurring.js, event-form.js, calendar-ui.js |
| Support tools | support.js |
| Rhythms, Today's beat, restock | rhythms.js, beat.js |
| Settings, priorities, timer, Download a copy | settings.js |
| What's new | news.js |
| taps | `case 'act-name':` inside the `tapX()` handler of the file that draws the button (e.g. `tapRhythms` in rhythms.js); a few general ones in events.js |
| changes, form submits, keys | events.js |
| swipe, routing, start-up (runs last) | boot.js |

## How the code works (enough to change it)

- State lives in `S`. `H('name')` reads Firestore doc `home/name`. Save with `saveHome('name', obj)` / `writeDoc(path, obj)`: pass the whole new object; only the fields that changed are sent (`putDoc` compares with `known[path]`, nested maps included, lists whole), so two phones don't undo each other. `mergeDoc(path, partial)` deep-merges a part (set a tick to `null` to undo it).
- Calendar events: `S.events` holds only events ending 60 days ago or later plus repeating ones (`subscribeEvents` in store.js, widened when the calendar is browsed back); Google's copy covers older months.
- Screens are template strings: `vToday()`, `vRhythms()`… `render()` rebuilds them; `setHtml` only touches the DOM when the HTML changed. **Always `esc()` anything that came from a person, Trello, Google or Claude.**
- Buttons carry `data-act="..."`; the handler is `case '...':` in that file's `tapX(a, el, e, r)` (return `true` when handled). A new area file with buttons adds its `tapX` to the chain in events.js. Forms carry `data-form` and are handled in the submit listener in events.js.
- Errors on the phones land in `home/errors` (file:line, screen, who); "Copy them all" in the ✎ Note sheet includes them. Start a bug fix from that line when the person pastes it.
- Claude calls go through `askClaude(prompt, { feature: 'name' })` (Haiku by default) or `sample.json`. The server tracks cost per month and stops at the cap.
- The day turns over at 4:00 (`dayKey()`), so late-evening things count for "today".

## Fixing something cheaply (do it in this order)

1. Find it: `grep -n "name" docs/MAP.md`, or `grep -rn "data-act=\"x\"\|case 'x'" app/`, or `grep -rn "visible text" app/ meals/js/`.
2. Read only the lines you need (Read with offset/limit around the hit). Don't read whole files over ~20 KB, and don't read index.html whole.
3. Make the smallest edit. Don't reformat or rewrap lines: the long lines are on purpose and small diffs are cheap to review.
4. `node tools/check.js` (1 s): files loaded and cached, everything parses, no name defined twice, MAP current.
5. `node tests/smoke.test.js` (~15 s): opens every screen, fails on any page error.
6. The tests for that area only: `node tests/run-all.js beat` (file names containing "beat"; smoke runs too). The full suite takes about 8 minutes two at a time: `node tests/run-all.js -j 2`, for bigger changes.
7. Something people will notice? Add one line at the top of `NEWS` in app/news.js. Then commit to `main` and push (it deploys).

**Real Firebase:** saving code, `platform/claude.js` and the rules are also checked on GitHub against Firebase's emulator with the real SDK, two phones and the real rules (`tests/real-firebase/check.js`, workflow "Real Firebase check"; runs by itself when those files change). After pushing such a change: `gh run list --workflow real-firebase.yml -L 1`. It uses a throwaway emulator project and never touches real data.

If `require('playwright')` fails, prefix test commands with `NODE_PATH=$(npm root -g)` (Playwright installed globally).

## Rules when adding code

- Put it in the file for its area. A new file needs a `<script src="app/x.js">` line in index.html (or `js/x.js` in meals/index.html) **and** an entry in `SHELL` in sw.js (bump `CACHE`); `tools/check.js` reminds you. Then `node tools/map.js`.
- All files share one scope: pick names that aren't taken (check.js catches duplicates).
- Code that runs while the files are loading (not inside a function) may only use names from the same or earlier files. Start-up calls belong in boot.js, which loads last.
- New behaviour gets a test, ideally in the existing test file for that area; a new test file uses `tests/helpers.js` (`start`, `t.open({ seed, hash, T, who, init })`, `ok`, `done`).
- Server changes (`functions/`): `cd functions && npm test`. The server is rebuilt only when `functions/` changes.

