// No Rest tab any more (5 Nov 2026): a Rest breaks box in Self-care (four 15-minute breaks a day, each a star, with a timer);
// evenings come from the calendar (one of you out = a solo evening for the other; Wednesday with nobody out = date night);
// no lie-in rota; the bedtime time lives in Rhythms → Closing duties.
const { chromium, devices } = require('playwright'), fs = require('fs'), path = require('path');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ ...devices['iPhone 13'] }), errs = [];
  const base = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8')); base['home/situation'] = {}; base['home/household'].baseline = 1;
  const open = async (who, st, hash, T) => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(`window.__SEED=${JSON.stringify(st)};`); await p.addInitScript(fs.readFileSync(__dirname + '/fakedb.js', 'utf8'));
    await p.addInitScript(n => { localStorage.setItem('afloat.me', n); localStorage.setItem('afloat.brief', 'x'); }, who);
    await p.clock.install({ time: new Date(T) }); await p.goto('file://' + path.resolve(__dirname, '../index.html') + '#' + hash); await p.waitForTimeout(1800);
    if (await p.$('[data-act=brief-close]')) { await p.tap('[data-act=brief-close]'); await p.waitForTimeout(150); } return p; };
  const txt = p => p.evaluate(() => document.body.innerText);

  let p = await open('Alex', base, 'care', '2026-11-09T10:00:00');
  const sub = await p.$$eval('.subnav a', a => a.map(x => x.textContent));
  ok(!sub.includes('Rest') && sub.includes('Self-care') && sub.includes('Trips'), '1 Us has no Rest tab: ' + sub.join(', '));
  let t = await txt(p);
  ok(/Rest breaks/.test(t) && /0 of 4/.test(t) && /15 minutes/.test(t), '2 Self-care has a Rest breaks box: four a day, about 15 minutes');
  const stars = () => p.$eval('.sc.me .stars', x => parseInt(x.textContent.replace(/\D+/, '')));
  const s0 = await stars();
  for (let i = 0; i < 3; i++) { await p.tap('[data-act=rest][data-d="1"]'); await p.waitForTimeout(120); }
  ok((await stars()) === s0 + 3 && /3 of 4/.test(await txt(p)), '3 each break earns a star');
  await p.tap('[data-act=rest-timer]'); await p.waitForTimeout(300);
  let st = await p.evaluate(() => window.__st);
  ok(st['days/2026-11-09'].care['Alex'].rest === 4 && await p.evaluate(() => !document.querySelector('#timer').hidden), '4 Start a 15-minute break counts it and starts a timer');
  ok(/Four breaks today/.test(t = await txt(p)) || /4 of 4/.test(t), '5 four breaks: done for the day');

  p = await open('Sam', { ...base, 'days/2026-11-09': st['days/2026-11-09'] }, 'care', '2026-11-09T11:00:00');
  ok(/Alex: 4 of 4/.test(await txt(p)), '6 each sees how the other is doing');

  // evenings from the calendar, not a weekly pattern
  p = await open('Alex', base, 'today', '2026-11-09T18:20:00'); t = await txt(p);
  ok(!/Solo evening/.test(t) && !/own-time evening/i.test(t), '7 Monday with nothing in the calendar: both home (the old pattern is ignored)');
  const mon = JSON.parse(JSON.stringify(base)); mon['events/m1'] = { title: 'Deskovky', kind: 'other', who: ['Sam'], date: '2026-11-09', endDate: '2026-11-09', start: '19:00', end: '23:00', at: 1 };
  p = await open('Alex', mon, 'today', '2026-11-09T18:20:00');
  ok(!/Tonight is for the two of you/.test(await txt(p)), '8 Sam has an evening event: no date night for Alex');
  p = await open('Alex', base, 'today', '2026-11-11T18:20:00');
  ok(/Date night/i.test(await txt(p)), '9 Wednesday with nobody out: date night');
  const wed = JSON.parse(JSON.stringify(base)); wed['events/w1'] = { title: 'Kafe s Robinm', kind: 'other', who: ['Alex'], date: '2026-11-11', endDate: '2026-11-11', start: '19:00', end: '22:00', at: 1 };
  p = await open('Sam', wed, 'today', '2026-11-11T18:20:00'); t = await txt(p);
  ok(!/Tonight is for the two of you/.test(t), '10 Wednesday with Alex out: not date night');

  // weekends: no lie-in lines; #rest goes to Today; bedtime in Rhythms
  p = await open('Alex', base, 'today', '2026-11-14T08:00:00');
  ok(!/lie-in|sleeps in today|early shift/i.test(await txt(p)), '11 no lie-in rota on weekend mornings');
  p = await open('Alex', base, 'rest', '2026-11-09T10:00:00');
  ok(await p.evaluate(() => location.hash === '#rest' && !!document.querySelector('.subnav a[href="#today"].on')), '12 an old link to Rest opens Today');
  p = await open('Alex', base, 'rhythms', '2026-11-09T18:40:00');
  ok(await p.evaluate(() => !!document.querySelector('#bedtime')), '13 the girls’ bedtime time is set in Rhythms');
  console.log(errs.length ? errs.join('\n') : 'NO PAGE ERRORS'); await b.close();
})();
