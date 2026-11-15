// The event form follows Google Calendar: start and end date + time (multi-day), address suggestions with map links,
// guests by email with guest permissions, description; all of it reaches Google.
const { chromium, devices } = require('playwright'), fs = require('fs'), path = require('path');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ ...devices['iPhone 13'], timezoneId: 'Europe/Prague' });
  const seed = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8'));
  seed['events/old1'] = { title: 'Swim', kind: 'family', who: ['Mia'], date: '2026-10-20', endDate: '2026-10-20', start: '17:00', end: '18:00', place: 'Plavecký stadion Podolí, Podolská 74, Praha', at: 1 };
  const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(`window.__SEED=${JSON.stringify(seed)};`);
  await p.addInitScript(fs.readFileSync(__dirname + '/fakedb.js', 'utf8'));
  await p.addInitScript(() => { const base = window.claude.use; window.__gLog = [];
    window.claude = { use: async k => { const v = await base(k); if (k !== 'mcp' || !v) return v;
      return { callTool: async (s, t, a, o) => { if (s === 'Google Calendar') window.__gLog.push([t, JSON.parse(JSON.stringify(a))]); return v.callTool(s, t, a, o); } }; } };
    localStorage.setItem('afloat.me', 'Alex'); localStorage.setItem('afloat.brief', 'x'); localStorage.setItem('afloat.calview', 'list'); });
  await p.clock.install({ time: new Date('2026-11-03T16:00:00') });
  await p.goto('file://' + path.resolve(__dirname, '../index.html') + '#calendar'); await p.waitForTimeout(1500);
  if (await p.$('[data-act=brief-close]')) { await p.tap('[data-act=brief-close]'); await p.waitForTimeout(200); }
  await p.tap('[data-act=ev-new]'); await p.waitForTimeout(200);
  const legends = await p.$$eval('.evform legend', l => l.map(x => x.textContent));
  ok(legends.join(',') === 'When,Where,Who,Details,Project', '1 sections follow Google: ' + legends);
  ok(!!(await p.$('#evStart')) && !!(await p.$('#evEnd')) && !!(await p.$('#evEndT')), '2 timed events have an end date as well as an end time');
  await p.fill('#evTitle', 'Writing retreat');
  await p.fill('#evDate', '2026-11-13'); await p.dispatchEvent('#evDate', 'change'); await p.waitForTimeout(150);
  ok(await p.inputValue('#evEnd') === '2026-11-13', '3 moving the start date pulls the end date along');
  await p.fill('#evStart', '18:00'); await p.fill('#evEnd', '2026-11-15'); await p.dispatchEvent('#evEnd', 'change'); await p.fill('#evEndT', '14:00');
  await p.tap('[data-act=ev-who][data-n="Alex"]'); await p.waitForTimeout(100);
  const opts = await p.$$eval('#evPlaces option', o => o.map(x => x.value));
  ok(opts.includes('Plavecký stadion Podolí, Podolská 74, Praha'), '4 places used before are suggested as you type');
  await p.fill('#evPlace', 'Chata Jizerka, Kořenov'); await p.waitForTimeout(100);
  const links = await p.$$eval('#evMap a', a => a.map(x => x.href));
  ok(links.some(h => h.startsWith('https://www.google.com/maps/search/?api=1&query=Chata%20Jizerka')) && links.some(h => h.startsWith('https://mapy.cz/zakladni?q=Chata%20Jizerka')), '5 the address opens in Google Maps or Mapy.cz');
  await p.fill('#evGuest', 'Editor@Example.com'); await p.tap('[data-act=ev-guest-add]'); await p.waitForTimeout(150);
  ok(/editor@example.com/.test(await p.textContent('.evform')), '6 a guest can be added by email');
  ok((await p.$$('[data-gp]')).length === 3, '7 with guests, Google’s three guest permissions appear');
  await p.check('[data-gp=guestsCanModify]');
  await p.fill('#evNotes', 'Bring the laptop charger');
  await p.screenshot({ path: __dirname + '/shots/event-form.png', fullPage: true });
  await p.tap('.evform button[type=submit]'); await p.waitForTimeout(700);
  const ce = await p.evaluate(() => window.__gLog.filter(x => x[0] === 'create_event').map(x => x[1]).pop());
  ok(ce && ce.startTime === '2026-11-13T18:00:00' && ce.endTime === '2026-11-15T14:00:00', '8 Google gets Fri 18:00 → Sun 14:00: ' + (ce && ce.startTime + ' → ' + ce.endTime));
  ok(ce && ce.location === 'Chata Jizerka, Kořenov', '9 the address goes to Google’s location (with its map)');
  ok(ce && (ce.attendees || []).some(a => a.email === 'editor@example.com') && ce.guestPermissions && ce.guestPermissions.guestsCanModify === true, '10 the email guest is invited with the chosen permissions');
  ok(ce && /Bring the laptop charger/.test(ce.description), '11 the description goes along');
  const days = await p.evaluate(() => [...document.querySelectorAll('.aday')].filter(d => /Writing retreat/.test(d.textContent)).map(d => d.querySelector('h3').textContent));
  ok(days.length >= 1, '12 it shows in the calendar: ' + days.join(' | '));
  // end before start is refused
  await p.tap('[data-act=ev-new]'); await p.waitForTimeout(150);
  await p.fill('#evTitle', 'Oops'); await p.fill('#evDate', '2026-11-20'); await p.dispatchEvent('#evDate', 'change'); await p.waitForTimeout(100);
  await p.fill('#evEnd', '2026-11-18'); await p.dispatchEvent('#evEnd', 'change');
  const n = await p.evaluate(() => window.__gLog.filter(x => x[0] === 'create_event').length);
  await p.tap('.evform button[type=submit]'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => window.__gLog.filter(x => x[0] === 'create_event').length) === n && !!(await p.$('.evform')), '13 an end before the start is not saved');
  console.log(errs.length ? errs.join('\n') : 'NO PAGE ERRORS'); await b.close();
})();
