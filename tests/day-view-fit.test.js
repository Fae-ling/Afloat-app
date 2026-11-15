// Day timetable: short events show their title, time and who's going without anything cut off.
const { chromium, devices } = require('playwright'), fs = require('fs'), path = require('path');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ ...devices['iPhone 13'], timezoneId: 'Europe/Prague' });
  const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
  const seed = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8'));
  const ev = (id, title, start, end) => seed['events/' + id] = { title, kind: 'doctor', who: ['Alex', 'Mia', 'Zoe'], date: '2026-11-03', endDate: '2026-11-03', allDay: false, start, end, place: '', notes: '', at: 1 };
  ev('t30', 'Quick call about the photos', '07:00', '07:30');
  ev('t60', 'Dentist appointment', '08:15', '09:15');
  ev('t120', 'Long outing', '10:00', '12:00');
  await p.addInitScript(`window.__SEED=${JSON.stringify(seed)};`);
  await p.addInitScript(fs.readFileSync(__dirname + '/fakedb.js', 'utf8'));
  await p.addInitScript(() => { localStorage.setItem('afloat.me', 'Alex'); localStorage.setItem('afloat.brief', 'x'); localStorage.setItem('afloat.calview', 'today'); });
  await p.clock.install({ time: new Date('2026-11-03T06:30:00') });
  await p.goto('file://' + path.resolve(__dirname, '../index.html') + '#calendar'); await p.waitForTimeout(1500);
  if (await p.$('[data-act=brief-close]')) { await p.tap('[data-act=brief-close]'); await p.waitForTimeout(200); }
  const r = await p.evaluate(() => [...document.querySelectorAll('.tt.wide .tt-ev')].map(el => {
    const box = el.getBoundingClientRect(), kids = [...el.querySelectorAll('b, .tt-meta, .whochip, .tt-dots i')];
    const out = kids.filter(k => { const q = k.getBoundingClientRect(); return q.bottom > box.bottom + 1 || q.right > box.right + 1; }).map(k => k.textContent || k.tagName);
    return { t: el.querySelector('b').textContent, cls: el.className, out, chips: el.querySelectorAll('.whochip').length, dots: el.querySelectorAll('.tt-dots i').length };
  }));
  for (const x of r) ok(!x.out.length, `nothing spills out of “${x.t}” (${x.cls.split(' ').slice(-1)}) ${x.out.join(',')}`);
  ok(r.find(x => /Dentist/.test(x.t)).chips === 3, 'the one-hour event shows all three names');
  ok(r.find(x => /Quick/.test(x.t)).dots === 3, 'the 30-minute event shows a dot per person');
  ok(r.find(x => /Long/.test(x.t)).chips === 3, 'the two-hour event keeps the full layout');
  await p.screenshot({ path: __dirname + '/shots/day-fit.png' });
  // two multi-day "background" events on the same Saturday sit side by side
  const s2 = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8'));
  s2['events/bgA'] = { title: 'Weekend away', kind: 'outing', who: ['Sam', 'Jo'], date: '2026-11-06', endDate: '2026-11-08', allDay: false, start: '17:00', end: '20:00', place: '', notes: '', at: 1 };
  s2['events/bgB'] = { title: 'Mia & Zoe with grandparents', kind: 'grandma', gpGId: 'gpx', who: ['Mia', 'Zoe'], date: '2026-11-06', endDate: '2026-11-08', allDay: false, start: '17:00', end: '18:00', gpOnly: true, place: '', notes: '', at: 1 };
  const q = await ctx.newPage(); q.on('pageerror', e => errs.push(e.message));
  await q.addInitScript(`window.__SEED=${JSON.stringify(s2)};`);
  await q.addInitScript(fs.readFileSync(__dirname + '/fakedb.js', 'utf8'));
  await q.addInitScript(() => { localStorage.setItem('afloat.me', 'Alex'); localStorage.setItem('afloat.brief', 'x'); localStorage.setItem('afloat.calview', 'today'); });
  await q.clock.install({ time: new Date('2026-11-07T06:30:00') });
  await q.goto('file://' + path.resolve(__dirname, '../index.html') + '#calendar'); await q.waitForTimeout(1500);
  if (await q.$('[data-act=brief-close]')) { await q.tap('[data-act=brief-close]'); await q.waitForTimeout(200); }
  const bg = await q.evaluate(() => [...document.querySelectorAll('.tt.wide .tt-bg')].map(el => { const r = el.getBoundingClientRect(), s = el.querySelector('span').getBoundingClientRect(); return { l: r.left, r: r.right, sl: s.left, sr: s.right, t: el.querySelector('span').textContent }; }));
  ok(bg.length >= 2 && bg.some(x => x.t === 'Weekend away'), 'every weekend event is drawn: ' + bg.map(x => x.t).join(' | '));
  ok(bg.every((a, i) => bg.every((b2, j) => i === j || a.r <= b2.l + 1 || b2.r <= a.l + 1)), 'they sit side by side without overlapping');
  ok(bg.every(x => x.sl >= x.l - 1), 'each label starts inside its own band');
  await q.screenshot({ path: __dirname + '/shots/day-bg.png' });
  console.log(errs.length ? errs.join('\n') : 'NO PAGE ERRORS'); await b.close();
})();
