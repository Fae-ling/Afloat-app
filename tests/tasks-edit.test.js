// Tasks grouped by list, editing a task (title, due, list, priority, checklist), priority from Trello labels,
// and a task linked to the calendar staying in step both ways.
const { chromium, devices } = require('playwright'), fs = require('fs'), path = require('path');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ ...devices['iPhone 13'], timezoneId: 'Europe/Prague' });
  const seed = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8'));
  const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.clock.install({ time: new Date('2026-11-03T15:00:00') }); /* first, so the pretend Trello's due dates use this clock */
  await p.addInitScript(`window.__SEED=${JSON.stringify(seed)};window.__TR_ME='a';`);
  await p.addInitScript(fs.readFileSync(__dirname + '/fakedb.js', 'utf8')); await p.addInitScript(fs.readFileSync(__dirname + '/fake-trello.js', 'utf8'));
  // Google: get_event reads the pretend calendar; count calls
  await p.addInitScript(() => { const base = window.claude.use; window.__gLog = [];
    window.claude = { use: async k => { const v = await base(k); if (k !== 'mcp' || !v) return v;
      return { callTool: async (s, t, a, o) => { if (s === 'Google Calendar') window.__gLog.push([t, JSON.parse(JSON.stringify(a))]);
        if (s === 'Google Calendar' && t === 'get_event') { const g = window.__G[a.eventId]; if (!g) throw { code: 'tool_error', message: 'not found' }; return { payload: JSON.parse(JSON.stringify(g)) }; }
        return v.callTool(s, t, a, o); } }; } };
    localStorage.clear(); localStorage.setItem('afloat.me', 'Alex'); localStorage.setItem('afloat.brief', 'x'); });
  await p.goto('file://' + path.resolve(__dirname, '../index.html') + '#tasks'); await p.waitForTimeout(1600);
  if (await p.$('[data-act=brief-close]')) { await p.tap('[data-act=brief-close]'); await p.waitForTimeout(150); }
  const secs = () => p.evaluate(() => [...document.querySelectorAll('#app section.card')].map(s => ({ eb: (s.querySelector('.eyebrow') || {}).textContent || '', h: (s.querySelector('h2') || {}).textContent || '', t: s.textContent })));
  let S = await secs();
  ok(S.some(x => x.h === 'Today' && /Pitch draft/.test(x.t) && !/Old overdue thing/.test(x.t)) && S.some(x => /^\s*From before/.test(x.t) && /Old overdue thing/.test(x.t)), '1 Today gathers what’s due today; anything whose date passed folds into From before');
  const prog = S.find(x => x.h === 'In Progress');
  ok(prog && /Entropie · Projekty/.test(prog.eb), '2 categories are named after the list, with board and workspace above');
  ok(prog && /Urgent pitch fix\s*High/.test(prog.t) && prog.t.indexOf('Urgent pitch fix') < prog.t.indexOf('Research sources'), '3 a red label in Trello shows as High and sorts first');
  await p.screenshot({ path: __dirname + '/shots/tasks-bylist.png', fullPage: true });
  // edit a task
  await p.tap('[data-act=task-open]:has-text("Research sources")'); await p.waitForTimeout(300);
  ok(!!(await p.$('.tsheet')), '4 tapping a task opens the editor');
  await p.fill('#tkName', 'Research sources for the prequel');
  await p.fill('#tkDue', '2026-11-06'); await p.waitForTimeout(100); await p.fill('#tkTime', '14:00');
  await p.tap('[data-act=tk-prio][data-v=med]');
  await p.tap('[data-act=tpick]'); await p.waitForTimeout(100); await p.tap('.pick-board:has-text("Projekty") [data-act=tpick-set]:has-text("To-do")'); await p.waitForTimeout(100);
  await p.fill('#tkNewItem', 'List three archives'); await p.tap('[data-act=tk-additem]'); await p.waitForTimeout(300);
  ok(/List three archives/.test(await p.evaluate(() => document.querySelector('.tk-cl').textContent)), '5 a checklist step is added on the card');
  await p.tap('.tk-cl [data-act=tk-item]'); await p.waitForTimeout(200);
  await p.screenshot({ path: __dirname + '/shots/tasks-editor.png', fullPage: true });
  await p.tap('[data-act=task-save]'); await p.waitForTimeout(600);
  const W = await p.evaluate(() => window.__trLog.filter(x => /Write/.test(x[0])).map(x => x[1]));
  ok(W.some(x => x.action === 'update' && x.name === 'Research sources for the prequel' && x.due === new Date('2026-11-06T14:00:00+01:00').toISOString()), '6 title and due date are saved to Trello');
  ok(W.some(x => x.action === 'move' && x.listId === 'ari:list/todo' && !x.boardId), '7 it moves to To-do on the same board');
  ok(W.some(x => x.action === 'attach_label' && x.labelId === 'ari:label/orange'), '8 Medium priority is the orange label');
  ok(W.some(x => x.action === 'update_item' && x.checked === true), '9 ticking a step ticks it in Trello');
  S = await secs();
  ok(/Research sources for the prequel\s*Medium/.test((S.find(x => x.h === 'To-do') || {}).t || ''), '10 it now shows under To-do with Medium');
  // calendar link
  await p.tap('[data-act=task-open]:has-text("Next week thing")'); await p.waitForTimeout(300);
  await p.check('#tkCal'); await p.waitForTimeout(150);
  ok(/all-day/.test(await p.evaluate(() => document.querySelector('.tk-cal').textContent)), '11 with no time it goes in as all-day');
  await p.fill('#tkTime', '10:00'); await p.waitForTimeout(150); await p.selectOption('#tkMins', '60');
  await p.tap('[data-act=task-save]'); await p.waitForTimeout(600);
  const ce = await p.evaluate(() => window.__gLog.filter(x => x[0] === 'create_event').map(x => x[1]));
  ok(ce.length === 1 && /^☐ Next week thing · Alex$/.test(ce[0].summary) && ce[0].startTime === '2026-11-08T10:00:00' && ce[0].endTime === '2026-11-08T11:00:00' && ce[0].calendarId, '12 a one-hour event goes on the family calendar');
  const link = await p.evaluate(() => Object.values(window.__st['home/tasks'].cal || {}).find(Boolean));
  ok(link && link.gId, '13 the link is remembered');
  ok(/📅/.test(await p.evaluate(() => [...document.querySelectorAll('.trow')].find(r => /Next week thing/.test(r.textContent)).textContent)), '14 the row shows it’s in the calendar');
  // Trello side changes → event follows
  await p.evaluate(() => { window.__trCards.find(c => c.name === 'Next week thing').due = new Date('2026-11-09T10:00:00+01:00').toISOString(); });
  await p.clock.fastForward(3 * 60e3); await p.tap('[data-act=tasks-refresh]'); await p.waitForTimeout(800);
  const ue = await p.evaluate(() => window.__gLog.filter(x => x[0] === 'update_event').map(x => x[1]));
  ok(ue.some(x => x.startTime === '2026-11-09T10:00:00'), '15 a new due date in Trello moves the calendar event');
  // Google side changes → Trello follows
  await p.evaluate(id => { const g = window.__G[id]; g.start = { dateTime: '2026-11-10T16:00:00+01:00' }; g.end = { dateTime: '2026-11-10T17:00:00+01:00' }; }, link.gId);
  await p.clock.fastForward(3 * 60e3); await p.tap('[data-act=tasks-refresh]'); await p.waitForTimeout(800);
  ok(await p.evaluate(() => window.__trLog.some(x => x[1].action === 'update' && x[1].due === new Date('2026-11-10T16:00:00+01:00').toISOString())), '16 moving the event in Google moves the due date in Trello');
  // done → ✓ in the calendar
  await p.tap('[data-act=task-open]:has-text("Next week thing")'); await p.waitForTimeout(200); await p.tap('[data-act=task-done]'); await p.waitForTimeout(300);
  await p.evaluate(() => { window.__trCards.find(c => c.name === 'Next week thing').complete = true; });
  await p.clock.fastForward(3 * 60e3); await p.tap('[data-act=tasks-refresh]'); await p.waitForTimeout(800);
  ok(await p.evaluate(() => window.__gLog.some(x => x[0] === 'update_event' && /^✓ Next week thing/.test(x[1].summary || ''))), '17 a finished task is marked ✓ in the calendar');
  // hand a shared chore to Sam from the editor, then take it back
  await p.tap('[data-act=tview][data-v=all]'); await p.waitForTimeout(200);
  await p.tap('[data-act=task-open]:has-text("Wipe shelves")'); await p.waitForTimeout(300);
  const pills = await p.evaluate(() => [...document.querySelectorAll('[data-act=tk-who]')].map(x => x.textContent));
  ok(pills.join(',') === 'Me,Sam', '19 Who’s on it offers you and the board’s other members: ' + pills);
  await p.tap('[data-act=tk-who]:has-text("Sam")'); await p.tap('[data-act=task-save]'); await p.waitForTimeout(600);
  ok(await p.evaluate(() => window.__trLog.some(x => x[1].action === 'add_comment' && /^@sam_t this one’s yours/.test(x[1].text))), '20 Sam gets an @mention on the card');
  ok(await p.evaluate(() => Object.values(window.__st['home/tasks'].handed || {}).some(v => v && v.name === 'Wipe shelves' && v.toName === 'Sam')), '21 the hand-over is recorded');
  await p.tap('[data-act=tview][data-v=mine]'); await p.waitForTimeout(200);
  ok(/Waiting on others[\s\S]*Wipe shelves/.test(await p.evaluate(() => document.querySelector('#app').textContent)), '22 it moves to Waiting on others in Mine');
  await p.tap('[data-act=tview][data-v=all]'); await p.waitForTimeout(200);
  await p.tap('[data-act=task-open]:has-text("Wipe shelves")'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.querySelector('[data-act=tk-who].on').textContent) === 'Sam', '23 the editor shows Sam is on it');
  await p.tap('[data-act=tk-who]:has-text("Me")'); await p.tap('[data-act=task-save]'); await p.waitForTimeout(500);
  ok(await p.evaluate(() => !Object.values(window.__st['home/tasks'].handed || {}).some(v => v && v.name === 'Wipe shelves')), '24 choosing Me takes it back');
  await p.tap('[data-act=task-open]:has-text("Pitch draft")'); await p.waitForTimeout(300);
  ok(/Only you are on Projekty/.test(await p.evaluate(() => document.querySelector('.tsheet').textContent)), '25 a board with nobody else explains how to add people');
  await p.tap('.tsheet [data-act=task-close]'); await p.waitForTimeout(150);
  // group by date still there
  await p.tap('[data-act=tgroup][data-v=date]'); await p.waitForTimeout(200);
  S = await secs();
  ok(S.some(x => /^\s*From before/.test(x.t)) && S.some(x => x.h === 'Later') && !/overdue/i.test(S.map(x => x.h).join(' ')), '18 By date: From before (folded) / Today / This week / Later, never “Overdue”');
  console.log(errs.length ? errs.join('\n') : 'NO PAGE ERRORS'); await b.close();
})();
