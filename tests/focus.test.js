// Active mode and Focus (10 Nov 2026): the header switch and Active tabs, seeded areas, a 25+5 session with a parked thought,
// the block and break prompts, landing with a breadcrumb, the Done log, the bar in Home, the other phone's banner, phone notifications.
const { start, ok, done } = require('./helpers');
(async () => {
  const t = await start(), p = await t.open({ hash: 'focus', T: '2026-11-05T09:00:00' });
  const tabs = await t.text(p, '#tabs');
  ok(/Focus/.test(tabs) && /Areas/.test(tabs) && /Done/.test(tabs) && !/Meals/.test(tabs), '1 Active has its own tabs');
  ok(await p.$eval('#modesw a.on', a => a.textContent).then(x => /Active/.test(x), () => false), '2 the header switch shows Active');
  let s = await t.text(p);
  ok(/Photo editing/.test(s) && /UX portfolio/.test(s) && /Job search/.test(s), '3 Alex’s three areas are seeded');
  const stop = await p.evaluate(() => fxStopNext());
  console.log('   hard stop:', JSON.stringify(stop && { m: stop.m, why: stop.why }));

  await t.tap(p, '[data-act=fx-pick]'); s = await t.text(p);
  ok(/What you need/.test(s) && /Lightroom/.test(s) && /Done for now means/.test(s), '4 picking an area shows what you need and the session form');
  await p.fill('#fxIntent', 'Cull the first half'); await p.fill('#fxStep', 'Open the catalogue');
  await t.tap(p, '[data-act=fx-rhy][data-v=b25]'); await t.tap(p, '[data-act=fx-go]');
  s = await t.text(p);
  ok(/Cull the first half/.test(s) && /left in this block/.test(s) && /Not now/.test(s), '5 the session runs as a 25-minute block');
  ok(/●|Active/.test(await t.text(p, '#modesw')) && !!(await p.$('#modesw .fx-dot')), '6 the switch shows a session is on');

  await p.fill('.fx-catch input[name=text]', 'email Klára back'); await p.press('.fx-catch input[name=text]', 'Enter'); await p.waitForTimeout(250);
  ok(/email Klára back/.test(await t.text(p)), '7 a stray thought is parked');
  const items = await p.evaluate(() => fxNotify());
  ok(items.some(x => /^fx-blk-/.test(x.tag) && x.live), '8 the end of the block is a phone notification that always rings');

  await p.clock.runFor(26 * 60e3); await p.waitForTimeout(300); s = await t.text(p);
  ok(/Block done/.test(s), '9 after 25 minutes: block done');
  await t.tap(p, '[data-act=fx-brk]'); s = await t.text(p);
  ok(/break left/.test(s), '10 the break counts down');
  await p.clock.runFor(6 * 60e3); await p.waitForTimeout(300);
  ok(/Break’s over/.test(await t.text(p)), '11 the break ends with a prompt');
  await t.tap(p, '.fx-prompt [data-act=fx-back2]');
  ok(/left in this block/.test(await t.text(p)), '12 back to a new block');

  await p.clock.runFor(4 * 60e3); await t.tap(p, '.fx-ctl [data-act=fx-land]'); s = await t.text(p);
  ok(/Landing/i.test(s) && /30 min of focus/.test(s) && /Parked thoughts/.test(s), '13 landing counts focused time only (26 + 4 min, not the break), with the parked thought');
  await p.fill('#fxDid', 'Culled 300'); await p.fill('#fxCrumb', 'photo 312');
  await t.tap(p, '[data-act=fx-feel][data-v="3"]'); await t.tap(p, '[data-act=fx-c-inbox]');
  await t.tap(p, '[data-act=fx-save]'); s = await t.text(p);
  ok(/30 min of focus/.test(s) && /5-minute break/.test(s), '14 after landing: a break is offered');
  ok(/↳ photo 312/.test(s), '15 the breadcrumb shows on the area');
  const st = await t.st(p).catch(() => null);
  await t.go(p, 'focus-done'); s = await t.text(p);
  ok(/30 min of focus this week/.test(s) && /Culled 300/.test(s), '16 Done shows the session');

  await t.go(p, 'focus'); await t.tap(p, '[data-act=fx-ten]');
  await t.go(p, 'today'); s = await t.text(p);
  ok(/Focusing/.test(s) && /Something else/.test(s), '17 Home shows a bar for the running session');
  ok(/Home/.test(await p.$eval('#modesw a.on', a => a.textContent)) && /Meals/.test(await t.text(p, '#tabs')), '18 Home has its usual tabs');

  await t.go(p, 'focus-areas'); await t.tap(p, '[data-act=fx-ed]');
  await p.fill('form[data-form=fx-need] input[name=text]', 'Coffee'); await p.press('form[data-form=fx-need] input[name=text]', 'Enter'); await p.waitForTimeout(250);
  ok(/Coffee/.test(await t.text(p)), '19 Areas: add to what you need');

  const q = await t.open({ who: 'Sam', T: '2026-11-05T09:10:00', seed: { 'home/focus': { now: { 'Alex': { area: '_other', aname: 'Photo editing', start: Date.parse('2026-11-05T09:00:00'), phase: 'work', rhythm: 'flow', off: 0, offAt: 0, share: true, caught: [] } } } } });
  ok(/Alex is focusing/.test(await t.text(q)) && /Keep Alex company/.test(await t.text(q)), '20 the other phone sees the session and can keep her company');
  const fxOld = (extra, T) => t.open({ who: 'Sam', T, seed: { 'home/focus': { now: { 'Alex': { area: '_other', aname: 'Photo editing', start: Date.parse('2026-11-05T09:00:00'), phase: 'work', rhythm: 'flow', off: 0, offAt: 0, share: true, caught: [], ...extra } } } } });
  ok(!/is focusing/.test(await t.text(await fxOld({}, '2026-11-05T11:10:00'))), '20b a session untouched for over two hours (forgotten) no longer shows on the other phone');
  ok(/Alex is focusing/.test(await t.text(await fxOld({ touch: Date.parse('2026-11-05T10:30:00') }, '2026-11-05T11:10:00'))), '20c a long session touched recently still shows');
  ok(!/is focusing/.test(await t.text(await fxOld({ offAt: Date.parse('2026-11-05T09:05:00'), paused: true }, '2026-11-05T09:10:00'))), '20d a paused session doesn’t ask for a quiet house');

  // the picker lists your Trello tasks: In Progress and red first; a task matching an area's words brings that area along
  const gig = { id: 'ari:card/gig1', name: 'Cull and edit: Saturday gig', url: 'https://trello.example/c/gig1', list: { id: 'ari:list/todo', name: 'To-do' }, board: { id: 'ari:board/pro', name: 'Projekty' }, due: null, complete: false, closed: false, labels: [], members: [] };
  const r = await t.open({ hash: 'focus', T: '2026-11-05T13:00:00', cards: [gig] });
  await r.waitForFunction(() => document.querySelectorAll('.fx-tl li').length > 0, null, { timeout: 8000 }).catch(() => {});
  const rows = await r.$$eval('.fx-tl li:not([hidden]) b', xs => xs.map(x => x.textContent));
  console.log('   tasks:', rows.join(' | '));
  ok(rows[0] === 'Urgent pitch fix' && rows.includes('Research sources'), '21 the picker lists Trello tasks, In Progress and high priority first');
  await t.tap(r, '[data-act=fx-filter][data-k^="a:"]');
  ok(/Photo editing/.test(await r.$eval('[data-act=fx-task][data-id="ari:card/gig1"]', x => x.innerText).catch(() => '')) && (await r.$$('.fx-tl li')).length === 1, '22 a gig task is matched to Photo editing, and its chip filters to it');
  await t.tap(r, '[data-act=fx-task][data-id="ari:card/gig1"]'); s = await t.text(r);
  ok(/Cull and edit: Saturday gig/.test(s) && /Lightroom/.test(s) && /Open in Trello/.test(s), '23 picking a task brings its area’s checklist and a link to the card');
  await r.fill('#fxIntent', 'First 300 photos'); await t.tap(r, '[data-act=fx-go]'); s = await t.text(r);
  ok(/First 300 photos/.test(s) && /Trello: Cull and edit/.test(s), '24 the session names the card');
  await r.clock.runFor(20 * 60e3); await t.tap(r, '.fx-ctl [data-act=fx-land]');
  await r.fill('#fxCrumb', 'photo 301'); await t.tap(r, '[data-act=fx-save]');
  ok(/↳ photo 301/.test(await r.$eval('[data-act=fx-task][data-id="ari:card/gig1"]', x => x.textContent).catch(() => '')) && /20 min so far/.test(await r.$eval('[data-act=fx-task][data-id="ari:card/gig1"]', x => x.textContent).catch(() => '')), '25 the breadcrumb and time so far are kept on the card');
  await t.tap(r, '[data-act=fx-task][data-id="ari:card/gig1"]'); await t.tap(r, '[data-act=fx-go]'); await r.clock.runFor(5 * 60e3); await t.tap(r, '.fx-ctl [data-act=fx-land]');
  await t.tap(r, '#fxTrDone'); await t.tap(r, '[data-act=fx-save]'); await r.waitForTimeout(300);
  const log = await r.evaluate(() => window.__trLog.filter(x => x[0] === 'trelloWriteCard' && x[1].action === 'mark_done').map(x => x[1].cardId));
  ok(log.includes('ari:card/gig1') && !(await r.$('[data-act=fx-task][data-id="ari:card/gig1"]')), '26 “finished” marks the card done in Trello');
  await t.go(r, 'focus-done'); ok(/Cull and edit: Saturday gig/.test(await t.text(r)), '27 Done shows the task’s name');

  // Sam's side is built the same: his own tasks, a task Alex handed him on top, his own starting areas; Alex sees what she handed
  const SD = require('./helpers').SEED(), PM = SD['home/trello'].people['Sam'], DB = SD['home/trello'].board;
  const gate = { id: 'ari:card/gate', name: 'Fix the gate remote', url: 'https://trello.example/c/gate', list: { id: PM, name: 'Markovy tudůs' }, board: { id: DB, name: 'Domácnost' }, due: null, complete: false, closed: false, labels: [], members: [] };
  const lamp = { id: 'ari:card/lamp', name: 'Hang the lamp', url: 'https://trello.example/c/lamp', list: { id: SD['home/trello'].lists.home, name: 'Domácnost' }, board: { id: DB, name: 'Domácnost' }, due: null, complete: false, closed: false, labels: [], members: [] };
  const handedSeed = { 'home/tasks': { handed: { lamp: { cardId: 'ari:card/lamp', name: 'Hang the lamp', boardName: 'Domácnost', toId: 'ari:user/m', toName: 'Sam', by: 'Alex', byName: 'Alex', at: 1 } } } };
  const t2 = await start(); const mk = await t2.open({ who: 'Sam', hash: 'focus', T: '2026-11-05T18:30:00', cards: [gate, lamp], seed: handedSeed });
  await mk.waitForFunction(() => document.querySelectorAll('.fx-tl li').length > 0, null, { timeout: 8000 }).catch(() => {});
  s = await mk.$eval('#app', x => x.textContent);
  ok(/Handed to you/i.test(s) && /from Alex/.test(s) && s.indexOf('Hang the lamp') < s.indexOf('Fix the gate remote'), '28 Sam: a task Alex handed him is on top');
  ok(/Fix the gate remote/.test(s) && /House projects/.test(s) && /Admin & paperwork/.test(s), '29 Sam: his own tasks and his own starting areas');
  ok(/House projects/.test(await mk.$eval('[data-act=fx-task][data-id="ari:card/gate"]', x => x.textContent).catch(() => '')), '30 Sam: the gate task is matched to House projects');
  await t.tap(mk, '[data-act=fx-qs][data-id="ari:card/lamp"]');
  ok(/Hang the lamp/.test(await t.text(mk)) && /focused/.test(await t.text(mk)), '31 ▶ starts a session straight away');
  await done(t2);
  const an = await t.open({ hash: 'focus', T: '2026-11-05T13:00:00', cards: [lamp], seed: handedSeed });
  await an.waitForTimeout(800);
  ok(/Handed to Sam/.test(await t.text(an)), '32 Alex sees what she handed Sam');

  // areas seeded before Czech words were added get them, so "Upravit fotky…" finds Photo editing
  const t3 = await start(), czk = { id: 'ari:card/cz', name: 'Upravit fotky Ivo+Market', url: '', list: { id: 'ari:list/todo', name: 'To-do' }, board: { id: 'ari:board/pro', name: 'Projekty' }, due: null, complete: false, closed: false, labels: [], members: [] };
  const old = await t3.open({ hash: 'focus', T: '2026-11-05T13:00:00', cards: [czk], seed: { 'home/focus': { seeded: { 'Alex': true }, areas: { p1: { id: 'p1', owner: 'Alex', order: 0, name: 'Photo editing', match: 'focení, foto, photo, edit, cull, lightroom, gig', need: [], links: [] } } } } });
  await old.waitForTimeout(800);
  ok(/Photo editing/.test(await old.$eval('[data-act=fx-task][data-id="ari:card/cz"]', x => x.textContent).catch(() => '')), '33 older areas learn the Czech words');
  await done(t3);
  void st; await done(t);
})();
