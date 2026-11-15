// The opening briefing: leave-home list only in the window before leaving, a now/next card with a countdown,
// one timeline with past events faded, tomorrow and Plan tomorrow in the evening; Settings shows the connections.
const { chromium, devices } = require('playwright'), fs = require('fs'), path = require('path');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ ...devices['iPhone 13'] }), errs = [];
  const open = async T => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    const sd = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8')); sd['home/situation'].girlsHome.until = '2026-11-06';
    sd['events/b1'] = { title: 'Dentist', kind: 'doctor', who: ['Alex'], date: '2026-11-09', endDate: '2026-11-09', start: '10:30', end: '11:15', place: 'Vinohradská 12, Praha', at: 1 };
    sd['events/b2'] = { title: 'Standup', kind: 'work', who: ['Alex'], date: '2026-11-09', endDate: '2026-11-09', start: '06:30', end: '06:45', at: 1 };
    sd['events/b3'] = { title: 'Swimming', kind: 'family', who: ['Alex', 'Mia'], date: '2026-11-10', endDate: '2026-11-10', start: '17:00', end: '18:00', at: 1 };
    await p.addInitScript(`window.__SEED=${JSON.stringify(sd)};`); await p.addInitScript(fs.readFileSync(__dirname + '/fakedb.js', 'utf8'));
    await p.addInitScript(() => { localStorage.setItem('afloat.me', 'Alex'); });
    await p.clock.install({ time: new Date(T) }); await p.goto('file://' + path.resolve(__dirname, '../index.html') + '#today'); await p.waitForTimeout(1200); return p; };
  const txt = p => p.evaluate(() => (document.querySelector('.brief-ov') || {}).textContent || '');
  let p = await open('2026-11-09T07:10:00'), t = await txt(p);
  ok(/Before you leave/.test(t) && /Out the door in 30 min/.test(t), '1 at 07:10 the launch list is up, 30 min before leaving');
  ok(/Next\s*Dentist\s*10:30 · in 3 h 20 min/.test(t), '2 Next: Dentist with a countdown');
  ok(await p.evaluate(() => [...document.querySelectorAll('.brief-ov .tl-row.past')].some(r => /Standup/.test(r.textContent))) && !!(await p.$('.brief-ov .tl-nowline')), '3 the timeline fades what’s over and marks now');
  ok(await p.evaluate(() => !!document.querySelector('.brief-ov a.tl-map[href*="google.com/maps"]')), '4 the dentist’s address opens in maps');
  await p.screenshot({ path: __dirname + '/shots/brief-morning.png' });
  p = await open('2026-11-09T08:05:00'); t = await txt(p);
  ok(!/Before you leave/.test(t), '5 after leaving (07:40 + 10 min), the launch list is gone');
  p = await open('2026-11-09T10:45:00'); t = await txt(p);
  ok(/Now\s*Dentist\s*until 11:15/.test(t), '6 during the dentist it says Now, until 11:15');
  p = await open('2026-11-09T19:30:00'); t = await txt(p);
  ok(/Tonight/.test(t) && /Tomorrow/.test(t) && /Swimming/.test(t) && !!(await p.$('.brief-ov [data-act=go-plan]')), '7 evening: tonight, tomorrow’s timeline and Plan tomorrow');
  ok(!/Before you leave/.test(t) && !/How’s your tank/.test(t), '8 evening drops the launch list and the energy check-in');
  await p.screenshot({ path: __dirname + '/shots/brief-evening.png' });
  await p.tap('[data-act=brief-close]'); await p.waitForTimeout(150); await p.tap('[data-act=settings]'); await p.waitForTimeout(200);
  ok(/Connections/.test(await p.evaluate(() => document.querySelector('#sheet').textContent)) && !!(await p.$('#sheet .conn')), '9 Settings shows the connections with fixes');
  console.log(errs.length ? errs.join('\n') : 'NO PAGE ERRORS'); await b.close();
})();
