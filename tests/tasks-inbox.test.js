// To-dos across all Trello boards: Today card, Tasks tab, Claude sorting, destination picker, handing over, inbox, survival filter.
const { chromium, devices } = require('playwright'), fs = require('fs'), path = require('path');
const APP = 'file://' + path.resolve(__dirname, '../index.html');
const fakedb = fs.readFileSync(__dirname + '/fakedb.js', 'utf8'), faketr = fs.readFileSync(__dirname + '/fake-trello.js', 'utf8');
const SORTER = `window.__SAMPLE = p => { const code = n => (p.match(new RegExp('\\\\[(D\\\\d+)\\\\] [^\\\\n]*› ' + n + '( \\\\(|$)', 'm')) || [])[1] || null;
  return [
    { line: 1, title: 'Call Klára about the photos', dest: code('Anežčiny To-Dos'), due: '2026-11-06', time: null, person: null, label: null, why: 'Your own errand' },
    { line: 2, title: 'Villain needs a motive', dest: code('Postavy'), due: null, person: null, label: 'prequel', why: 'Character note' },
    { line: 3, title: 'Fix the gate', dest: code('Chores'), due: '2026-11-05', time: '17:30', person: 'sam_t', label: null, why: 'House job for Sam' },
    { line: 4, title: 'pleny', dest: code('Nákupy'), why: 'Shopping' } ]; };`;
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
async function open(ctx, { who = 'Alex', tr = 'a', seed, sorter = true, extra = [] }) {
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.clock.install({ time: new Date('2026-11-03T15:00:00') }); /* first, so the pretend Trello's due dates use this clock */
  await p.addInitScript(`window.__SEED=${JSON.stringify(seed)};window.__TR_ME=${JSON.stringify(tr)};window.__EXTRA_CARDS=${JSON.stringify(extra)};${sorter ? SORTER : ''}`);
  await p.addInitScript(fakedb); await p.addInitScript(faketr);
  await p.addInitScript(w => { localStorage.clear(); localStorage.setItem('afloat.tgroup', 'date'); localStorage.setItem('afloat.me', w); localStorage.setItem('afloat.brief', 'x'); }, who);
  await p.goto(APP + '#today'); await p.waitForTimeout(1500);
  if (await p.$('[data-act=brief-close]')) { await p.tap('[data-act=brief-close]'); await p.waitForTimeout(150); }
  return p;
}
const txt = (p, sel) => p.evaluate(s => [...document.querySelectorAll(s)].map(x => x.textContent).join(' | '), sel);
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ ...devices['iPhone 13'], timezoneId: 'Europe/Prague' });
  const seed = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8'));
  const p = await open(ctx, { seed });
  // Today
  const todo = await p.evaluate(() => { const h = [...document.querySelectorAll('#app h2')].find(x => x.textContent === 'Due soon'); return h ? h.closest('section').textContent : ''; });
  ok(/Pitch draft/.test(todo) && !/Old overdue thing/.test(todo) && /1 from before/.test(todo) && !/Wipe shelves/.test(todo), '1 Today shows only to-dos with a near due date; house chores without a date live in Tasks; one from before is only counted');
  ok(!/Villain|Milk|Moody light/.test(todo), '2 reference lists and shopping stay out of Today');
  // Tasks tab
  await p.evaluate(() => { location.hash = 'tasks'; }); await p.waitForTimeout(400);
  ok(/Tasks/.test(await txt(p, '.subnav a.on')), '3 Tasks is a switch on the Today tab');
  const secs = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll('#app section.card')].map(s => [(s.querySelector('h2') || {}).textContent, s.textContent])));
  ok(/Old overdue/.test(await txt(p, '.card.from-before')) && /Pitch draft/.test(secs.Today || '') && /Next week thing/.test(secs['This week'] || ''), '4 From before, Today and This week are grouped by due date');
  ok(/Research sources/.test(secs.Later || '') && !/Villain|Moody light|Milk/.test(secs.Later || '') && /Wipe shelves/.test(await txt(p, 'details[data-grp=t-shared]')), '5 Later holds To-do/In Progress; unassigned Chores sit under Shared; no Postavy, inspiration or shopping');
  await p.screenshot({ path: __dirname + '/shots/tasks1.png', fullPage: true });
  await p.tap('summary:has-text("Which lists count")'); await p.waitForTimeout(100);
  await p.tap('[data-act=list-show][data-id="ari:list/char"]'); await p.waitForTimeout(300);
  ok(/Villain/.test(await txt(p, '#app')), '6 turning Postavy on shows its cards');
  ok(await p.evaluate(() => Object.values((window.__st['home/tasks'].show || {}).Alex || {}).includes(true)), '7 the list choice is saved for Alex only');
  await p.tap('[data-act=list-show][data-id="ari:list/char"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !!document.querySelector('details[data-grp="tasks-lists"]').open), '8 the open section stays open after a re-render');
  // Capture → Claude sort
  await p.tap('header [data-act=capture]'); await p.waitForTimeout(200);
  await p.fill('#dumpText', 'call Klára about the photos by Friday\nPostavy: the villain needs a motive\nSam fix the gate thursday 17:30\npleny');
  await p.tap('[data-act=cap-sort]'); await p.waitForTimeout(500);
  const prompt = await p.evaluate(() => window.__prompt || '');
  ok(/Entropie › Projekty › To-do/.test(prompt) && /Happy mind palace › Domácnost › Chores/.test(prompt), '9 Claude is shown every workspace, board and list');
  ok(!/› Done\b/.test(prompt) && /sam_t = Sam/.test(prompt) && /Projekty: prequel/.test(prompt), '10 Done lists are left out; people and labels are offered');
  ok(/wed 2026-11-04|Wed 2026-11-04/.test(prompt) && (await p.evaluate(() => window.__sampleOpts.modelTier)) === 'quick', '11 a date table and the quick model are used');
  const dests = await txt(p, '.rv .dest b');
  ok(dests === 'Domácnost › Anežčiny To-Dos | Projekty › Postavy | Domácnost › Chores | Domácnost › Nákupy', '12 review shows Claude’s destinations: ' + dests);
  ok(await p.evaluate(() => { const r = document.querySelectorAll('.rv'); return r[0].querySelector('[data-cap=due]').value === '2026-11-06' && r[1].querySelector('[data-cap=label]').value === 'ari:label/pq' && r[2].querySelector('[data-cap=person]').value === 'ari:user/m' && r[2].querySelector('[data-cap=time]').value === '17:30'; }), '13 due date, label, time and Sam are filled in');
  ok(await p.evaluate(() => /Only you are on Projekty/.test(document.querySelectorAll('.rv')[1].textContent)), '14 a board with nobody else says how to hand tasks over');
  await p.screenshot({ path: __dirname + '/shots/tasks2-review.png', fullPage: true });
  // picker
  await p.tap('.rv >> nth=0 >> .dest'); await p.waitForTimeout(200);
  ok(/Entropie/.test(await txt(p, '.ws h3')) && /Happy mind palace/.test(await txt(p, '.ws h3')), '15 the picker groups boards by workspace');
  await p.screenshot({ path: __dirname + '/shots/tasks3-picker.png', fullPage: true });
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  ok(!!(await p.$('.rv')), '16 Escape closes the picker but keeps the review');
  await p.tap('.rv >> nth=0 >> .dest'); await p.waitForTimeout(150);
  await p.tap('.pick-board:has-text("Projekty") [data-act=pick-set]:has-text("To-do")'); await p.waitForTimeout(150);
  ok((await txt(p, '.rv .dest b')).startsWith('Projekty › To-do'), '17 picking a list changes that item');
  await p.fill('.rv >> nth=0 >> .rv-title', 'Call Klára re photos');
  await p.tap('.rv >> nth=3 >> [data-act=cap-on]'); await p.waitForTimeout(100);
  ok(/Send 3 to Trello/.test(await txt(p, '[data-act=cap-send]')), '18 unticking leaves 3 to send');
  await p.tap('[data-act=cap-send]'); await p.waitForTimeout(800);
  const log = await p.evaluate(() => window.__trLog.filter(x => x[0] === 'trelloWriteCard'));
  const cr = log.filter(x => x[1].action === 'create');
  ok(cr.length === 3 && cr[0][1].listId === 'ari:list/todo' && cr[0][1].name === 'Call Klára re photos' && cr[0][1].due === new Date('2026-11-06T09:00:00+01:00').toISOString(), '19 cards are created where chosen, with the edited title and 9:00 due');
  ok(cr[2][1].due === new Date('2026-11-05T17:30:00+01:00').toISOString(), '20 a stated time is kept');
  ok(log.some(x => x[1].action === 'attach_label' && x[1].labelId === 'ari:label/pq'), '21 the prequel label is attached');
  ok(log.some(x => x[1].action === 'add_comment' && /^@sam_t this one’s yours/.test(x[1].text)), '22 Sam gets an @mention comment');
  const td = await p.evaluate(() => window.__st['home/tasks']);
  const h = Object.values(td.handed || {}).filter(Boolean);
  ok(h.length === 1 && h[0].toName === 'Sam' && h[0].by === 'Alex', '23 the hand-over is recorded');
  ok(JSON.stringify(td.inbox.Alex.map(x => x.text)) === '["pleny"]', '24 the unticked line waits in the inbox');
  ok(td.examples.Alex.length === 3 && td.examples.Alex.some(x => x.d === 'Projekty › To-do'), '25 choices are remembered for next time');
  ok(!(await p.$('.capsheet')), '26 the sheet closes when everything is sent');
  await p.waitForTimeout(400);
  const s2 = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll('#app section.card')].map(s => [(s.querySelector('h2') || {}).textContent, s.textContent])));
  ok(/Fix the gate/.test(s2['Waiting on others'] || '') && /Sam/.test(s2['Waiting on others'] || ''), '27 Waiting on others shows the gate with Sam');
  ok(/pleny/.test(s2.Inbox || ''), '28 the inbox shows on Tasks');
  await p.screenshot({ path: __dirname + '/shots/tasks4-after.png', fullPage: true });
  await p.tap('section.card:has(h2:text-is("Today")) [data-act=tr-done]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => window.__trLog.some(x => x[1].action === 'mark_done')), '29 ticking a task marks it done in Trello');
  // previous sort is learned in the next prompt
  await p.tap('[data-act=inbox-sort]'); await p.waitForTimeout(500);
  ok(/"Postavy: the villain needs a motive" → Projekty › Postavy/.test(await p.evaluate(() => window.__prompt)), '30 the next sort sees past choices');
  await p.tap('[data-act=cap-back]'); await p.waitForTimeout(100); await p.tap('.capsheet [data-act=close-capture]'); await p.waitForTimeout(100);
  // survival mode
  await p.evaluate(() => { location.hash = 'today'; }); await p.waitForTimeout(300);
  const sv = await p.$('[data-act=mode][data-m=survival]');
  /* calm Today folds the mode buttons away: the same switch, directly */
  if (sv) { await sv.tap(); await p.waitForTimeout(300); } else { await p.evaluate(() => { S.day = { ...S.day, modes: { ...(S.day.modes || {}), [me]: 'survival' } }; mergeDoc('days/' + dk, { modes: { [me]: 'survival' } }); render(true); }); await p.waitForTimeout(300); }
  await p.evaluate(() => { location.hash = 'tasks'; }); await p.waitForTimeout(300);
  const t3 = await txt(p, '#app');
  ok(/Survival mode: only/.test(t3) && !/Next week thing|Research sources/.test(t3) && /Old overdue/.test(t3), '31 survival mode shows only what’s due');
  const errs1 = p.errs;
  // Sam sees the task handed to him; he isn't on Projekty
  const st = await p.evaluate(() => JSON.parse(JSON.stringify(window.__st)));
  const gate = await p.evaluate(() => window.__trCards.find(c => c.name === 'Fix the gate'));
  const m = await open(ctx, { who: 'Sam', tr: 'm', seed: st, extra: [gate] });
  await m.evaluate(() => { location.hash = 'tasks'; }); await m.waitForTimeout(500);
  const ms = await m.evaluate(() => Object.fromEntries([...document.querySelectorAll('#app section.card')].map(s => [(s.querySelector('h2') || {}).textContent, s.textContent])));
  ok(/Fix the gate/.test(ms['Handed to you'] || '') && /from Alex/.test(ms['Handed to you'] || ''), '32 Sam sees “Handed to you · from Alex”');
  ok(!/Pitch draft|Projekty/.test(await txt(m, '#app')), '33 Sam only sees boards he’s on');
  // without Claude: choose yourself; keep in inbox
  const q = await open(ctx, { seed, sorter: false });
  await q.tap('header [data-act=capture]'); await q.waitForTimeout(200);
  ok(!(await q.$('[data-act=cap-sort]')) && /Choose where they go/.test(await txt(q, '[data-act=cap-manual]')), '34 without Claude the sheet offers choosing yourself');
  await q.fill('#dumpText', 'one\ntwo'); await q.tap('[data-act=cap-manual]'); await q.waitForTimeout(200);
  ok((await q.$$('.rv')).length === 2 && /Where should they go/.test(await txt(q, '.capsheet h2')), '35 manual review lists both lines');
  await q.tap('[data-act=cap-back]'); await q.waitForTimeout(100); await q.tap('[data-act=cap-keep]'); await q.waitForTimeout(200);
  ok(await q.evaluate(() => window.__st['home/tasks'].inbox['Alex'].length === 2), '36 Keep in my inbox saves them unsorted');
  const all = [...errs1, ...m.errs, ...q.errs];
  console.log(all.length ? all.join('\n') : 'NO PAGE ERRORS'); await b.close();
})();
