// Events that have already ended drop out of Today's "Coming up" (and the calendar's Coming up list); ones still on stay.
const { chromium, devices } = require('playwright'), fs = require('fs'), path = require('path');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ ...devices['iPhone 13'], timezoneId: 'Europe/Prague' });
  const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
  const seed = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8'));
  const ev = (id, title, date, start, end) => seed['events/' + id] = { title, kind: 'doctor', who: ['Sam'], date, endDate: date, allDay: false, start, end, place: '', notes: '', at: 1 };
  ev('done', 'Morning check-up', '2026-11-03', '09:00', '10:00');
  ev('now', 'Afternoon check-up', '2026-11-03', '15:25', '16:25');
  ev('later', 'Evening class', '2026-11-03', '18:00', '19:00');
  ev('tmrw', 'Dentist for the girls', '2026-11-04', '08:15', '09:15');
  await p.addInitScript(`window.__SEED=${JSON.stringify(seed)};`);
  await p.addInitScript(fs.readFileSync(__dirname + '/fakedb.js', 'utf8'));
  await p.addInitScript(() => { localStorage.setItem('afloat.me', 'Alex'); localStorage.setItem('afloat.brief', 'x'); localStorage.setItem('afloat.calview', 'list'); });
  await p.clock.install({ time: new Date('2026-11-03T16:00:00') });
  await p.goto('file://' + path.resolve(__dirname, '../index.html') + '#today'); await p.waitForTimeout(1500);
  if (await p.$('[data-act=brief-close]')) { await p.tap('[data-act=brief-close]'); await p.waitForTimeout(200); }
  let t = await p.textContent('#app');
  ok(!/Morning check-up/.test(t) && /Afternoon check-up/.test(t) && /Evening class/.test(t) && /Dentist for the girls/.test(t), '1 at 16:00 the finished morning event is gone, the one still on stays');
  await p.clock.runFor(30 * 6e4); await p.waitForTimeout(300);
  t = await p.textContent('#app');
  ok(!/Afternoon check-up/.test(t) && /Evening class/.test(t), '2 a minute after it ends, the afternoon event drops off too');
  await p.clock.setFixedTime(new Date('2026-11-04T01:10:00')); await p.clock.runFor(61000); await p.waitForTimeout(300);
  t = await p.textContent('#app');
  ok(!/Evening class/.test(t) && /Dentist for the girls/.test(t), '3 after midnight, last night’s events are gone and tomorrow’s still shows');
  await p.goto('file://' + path.resolve(__dirname, '../index.html') + '#calendar'); await p.waitForTimeout(1200);
  if (await p.$('[data-act=brief-close]')) { await p.tap('[data-act=brief-close]'); await p.waitForTimeout(200); }
  t = await p.textContent('#app');
  ok(!/Evening class/.test(t) && /Dentist for the girls/.test(t), '4 the calendar’s Coming up list leaves them out as well');
  console.log(errs.length ? errs.join('\n') : 'NO PAGE ERRORS'); await b.close();
})();
