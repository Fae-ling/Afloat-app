// Afloat keeps up with the calendar (6 Nov 2026): what's deleted or moved in Google leaves Today, the plan and the phone
// reminder; it looks again after a bad signal; and it says so when it can't check.
const { chromium, devices } = require('playwright'), fs = require('fs'), path = require('path');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const APP = 'file://' + path.resolve(__dirname, '../index.html');
const CAL = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8'))['home/calendar'].calId;
async function open(ctx, hash, now, extra) {
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  const seed = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8'));
  await p.addInitScript(`window.__SEED=${JSON.stringify(seed)};`);
  await p.addInitScript(fs.readFileSync(__dirname + '/fakedb.js', 'utf8'));
  await p.addInitScript(`window.__CAL=${JSON.stringify(CAL)};`);
  await p.addInitScript(() => {
    const base = window.claude.use; window.__fail = false; window.__lists = 0;
    /* two events that exist only in Google, tomorrow (4 Nov) */
    const g = (id, t, h) => ({ id, cal: 'fam', summary: t + ' · Alex', start: { dateTime: `2026-11-04T${h}:00+01:00` }, end: { dateTime: `2026-11-04T${String(+h.slice(0, 2) + 1).padStart(2, '0')}:${h.slice(3)}:00+01:00` }, status: 'confirmed', updated: '2026-11-03T07:00:00.000Z' });
    window.__G.evx = g('evx', 'Dentist', '09:00'); window.__G.evy = g('evy', 'Yoga', '14:00');
    window.claude = { whoami: () => ({ uid: 'u1' }), use: async k => { const v = await base(k); if (k !== 'mcp' || !v) return v;
      return { callTool: async (s, t, a, o) => {
        if (s === 'Google Calendar' && t === 'list_events') { window.__lists++; if (window.__fail) throw Object.assign(new Error('Google Calendar didn’t answer.'), { code: 'server_unavailable' }); }
        if (s === 'Google Calendar' && t === 'delete_event') delete window.__G[a.eventId];
        return v.callTool(s, t, a, o); } }; } };
    localStorage.setItem('afloat.me', 'Alex'); localStorage.setItem('afloat.brief', 'x'); localStorage.setItem('afloat.calview', 'list');
  });
  if (extra) await p.addInitScript(extra);
  await p.clock.install({ time: new Date(now || '2026-11-03T16:00:00') });
  await p.goto(APP + hash); await p.waitForTimeout(1500);
  if (await p.$('[data-act=brief-close]')) { await p.tap('[data-act=brief-close]'); await p.waitForTimeout(200); }
  return p;
}
const text = p => p.textContent('#app');
const mins = async (p, n) => { await p.clock.runFor(n * 6e4); await p.waitForTimeout(400); };
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ ...devices['iPhone 13'], timezoneId: 'Europe/Prague' });
  let p = await open(ctx, '#calendar');

  /* 1 deleted in Google while Afloat is open */
  ok(/Coffee/.test(await text(p)), '1a the Coffee event (5 Nov) shows');
  await p.evaluate(() => { delete window.__G.p1ujtsg95eq9et70ab5b7nglg0; });
  await mins(p, 2);
  ok(/Coffee/.test(await text(p)), '1b two minutes later it is not looked up again yet (3-minute rhythm)');
  await mins(p, 2.2);
  ok(!/Coffee/.test(await text(p)), '1c after the next check it is gone from the calendar');
  ok(await p.evaluate(() => !!window.__st['events/fw1144355921']), '1d its Afloat copy is kept after the first check (one odd answer is not enough)');
  await mins(p, 4.2);
  ok(await p.evaluate(() => !window.__st['events/fw1144355921']), '1e and removed after the second check');
  ok(await p.evaluate(() => !!window.__st['events/fw1125441004']), '1f other events are untouched');

  /* 2 a bad signal: it keeps trying, and says so once it has been ten minutes */
  await p.evaluate(() => { window.__fail = true; });
  await mins(p, 3.2);
  const afterFail = await p.evaluate(() => window.__lists);
  await mins(p, 1.1);
  ok((await p.evaluate(() => window.__lists)) > afterFail, '2a after a failed check it tries again a minute later, not never');
  await mins(p, 10);
  ok(/Couldn’t check Google Calendar since/.test(await text(p)), '2b after ten minutes without a check, the screen says so');
  await p.evaluate(() => { window.__fail = false; delete window.__G.q43k318urek462qr1e97s84al4; });
  await mins(p, 1.1);
  ok(!/Couldn’t check Google Calendar/.test(await text(p)), '2c when Google answers again the note is gone');
  await p.close();

  /* 3 plan entries follow their calendar event */
  p = await open(ctx, '#rhythms');
  const planTap = async g => { await p.tap(`.plan [data-act=plan-from-ev][data-g=${g}]`); await p.waitForTimeout(300); };
  await planTap('evx'); await planTap('evy');
  const plan = () => p.evaluate(() => ((window.__st['plans/2026-11-04'] || {})['Alex'] || {}).events || []);
  let pl = await plan();
  ok(pl.length === 2 && pl.every(e => e.from && e.from.g), '3a “Plan for it” remembers which event each entry came from');
  await p.evaluate(() => { delete window.__G.evx; const y = window.__G.evy; y.start = { dateTime: '2026-11-04T15:00:00+01:00' }; y.end = { dateTime: '2026-11-04T16:00:00+01:00' }; y.updated = '2026-11-03T15:59:00.000Z'; });
  await mins(p, 4.2);
  pl = await plan();
  ok(pl.length === 1 && /Yoga/.test(pl[0].title), '3b the deleted Dentist is off tomorrow’s plan');
  ok(pl[0] && pl[0].time === '15:00', '3c the moved Yoga moved on the plan too');
  ok(/Dentist” isn’t in the calendar any more|isn’t in the calendar any more/.test((await p.textContent('#toast')) || ''), '3d it said so, kindly');
  await p.close();

  /* 4 the other phone deletes or adds an event */
  p = await open(ctx, '#calendar');
  ok(/Appointment/.test(await text(p)), '4a Appointment (5 Nov) shows');
  await p.evaluate(() => { delete window.__st['events/fw1125441004']; window.__fire(); });   /* the other phone deleted it; Google has not caught up here */
  await p.clock.runFor(500); await p.waitForTimeout(400);
  ok(!/Appointment/.test(await text(p)), '4b it leaves this phone at once, not at the next check');
  await p.evaluate(() => { window.__G.newx = { id: 'newx', cal: 'fam', summary: 'Swimming · Alex', start: { dateTime: '2026-11-05T12:00:00+01:00' }, end: { dateTime: '2026-11-05T13:00:00+01:00' }, status: 'confirmed', updated: '2026-11-03T15:59:30.000Z' };
    window.__st['events/newdoc'] = { title: 'Swimming', kind: 'other', who: ['Alex'], date: '2026-11-05', endDate: '2026-11-05', allDay: false, start: '12:00', end: '13:00', place: '', notes: '', gId: 'newx', by: 'Sam', at: Date.now() - 10 * 6e4 }; window.__fire(); });
  await p.clock.runFor(2500); await p.waitForTimeout(500);
  ok(/Swimming/.test(await text(p)), '4c an event the other phone just added shows within seconds, not at the next check');
  await p.close();

  /* 5 the phone reminder is tied to its Google event */
  p = await open(ctx, '#today', '2026-11-04T16:00:00', `localStorage.setItem('afloat.push','1');`);
  await mins(p, 1.1);
  const items = await p.evaluate(() => ((window.__st['notify/u1'] || {}).items) || []);
  const go = items.find(i => /^go-/.test(i.tag) && /Appointment/.test(i.title));
  ok(!!go && go.ev && go.ev.g === 'sn4a8jfej3u8jdr5sg25jcebfs' && go.ev.s === '2026-11-05T10:30' && go.ev.c === CAL, '5 the leave-by notification carries its Google event and start, so the server can check it before sending');
  await p.close();

  /* 6 an older plan entry (made before entries remembered their event) whose event is gone */
  p = await open(ctx, '#rhythms');
  await p.evaluate(() => { window.__st['plans/2026-11-03'] = { 'Alex': { events: [{ id: 'o1', title: 'Gone thing · Alex', time: '12:00', travel: null }, { id: 'o2', title: 'My own thing', time: '17:00', travel: 10 }] } }; window.__fire(); });
  await mins(p, 4.2);
  const old = await p.evaluate(() => (((window.__st['plans/2026-11-03'] || {})['Alex'] || {}).events || []).map(e => e.id));
  ok(old.join() === 'o2', '6 an older leftover plan entry is taken off, one typed by hand stays');
  await p.close();

  const bad = [];
  console.log(bad.length ? bad.join('\n') : 'NO PAGE ERRORS'); await b.close();
})();
