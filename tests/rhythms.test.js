// Rhythms rebuilt (5 Nov 2026): three cards side by side (Today's itinerary, This week, This month), tap a job to give it
// a day and a time (it then shows on Today's timeline), every-few-days jobs that come due, minutes and what fits the gap,
// owners, survival mode showing only glass balls, the one-time upgrade of the lists, and Claude's season check.
const { chromium, devices } = require('playwright'), fs = require('fs'), path = require('path');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ ...devices['iPhone 13'] }), errs = [];
  const base = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8')); base['home/situation'] = {}; base['home/household'].baseline = 1;
  const open = async (who, st, { hash = 'rhythms', T = '2026-11-05T10:30:00', claude = false } = {}) => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(`window.__SEED=${JSON.stringify(st)};window.__TR_ME="a";window.__EXTRA_CARDS=[];`);
    await p.addInitScript(fs.readFileSync(__dirname + '/fakedb.js', 'utf8')); await p.addInitScript(fs.readFileSync(__dirname + '/fake-trello.js', 'utf8'));
    await p.addInitScript(n => { localStorage.setItem('afloat.me', n); localStorage.setItem('afloat.brief', 'x'); }, who);
    if (claude) await p.addInitScript(() => { window.__prompts = []; window.__SAMPLE = input => { window.__prompts.push(String(typeof input === 'string' ? input : JSON.stringify(input)));
      return { summary: 'Winter is coming: a couple of small changes.', items: [{ op: 'add', list: 'weekly', text: 'Check the gutters after a storm', day: 6, min: 10, why: 'Grown trees' }, { op: 'remove', list: 'weekly', id: 'w2-kitchen', why: 'Covered by closing duties' }, { op: 'change', list: 'every', id: 'e2-mop', every: 14, why: 'Less often in winter' }] }; }; });
    await p.clock.install({ time: new Date(T) }); await p.goto('file://' + path.resolve(__dirname, '../index.html') + '#' + hash); await p.waitForTimeout(2200);
    if (await p.$('[data-act=brief-close]')) { await p.tap('[data-act=brief-close]'); await p.waitForTimeout(150); } return p; };
  const pane = (p, i) => p.$eval(`.rj-pane[data-i="${i}"]`, x => x.innerText);

  let p = await open('Alex', base), st = await p.evaluate(() => window.__st), R = st['home/rhythms'];
  ok(await p.$$eval('[data-act=rj-pane]', a => a.map(x => x.textContent).join('|')) === 'Today|This week|This month' && (await p.$$('.rj-pane')).length === 3, '1 three cards: Today, This week, This month');
  ok(R.v === 2 && R.weekly.some(x => x.id === 'w2-laundry2' && x.day === 5 && x.owner === 'Sam') && !R.weekly.some(x => /^Pip: fresh food/.test(x.text)) && !R.weekly.some(x => /^Pick one bathroom/.test(x.text)), '2 the upgrade: laundry twice (Saturday is Sam’s), Pip’s feeding only as a home reminder, bathrooms moved');
  ok((R.every || []).length === 11 && (R.everyMonth || []).length === 6 && R.monthly.some(x => /Winter tyres/.test(x.text)) && R.weekly.find(x => /^Laundry, round one/.test(x.text)).min === 20, '3 every-few-days, monthly and seasonal jobs added; minutes on known jobs');
  const lg = st['home/rlog'] || {}; ok(Object.keys(lg).length === 11 && new Set(Object.values(lg).map(x => x.last)).size > 3, '4 every-few-days jobs start staggered, not all due at once');
  let t = await pane(p, 0);
  ok(/18:20/.test(t) && /Five-minute pick-up with the girls/.test(t) && /18:30\s*Closing duties/.test(t), '5 Today is an itinerary in time order: the girls’ pick-up at 18:20, closing duties at 18:30');
  ok(/Any time today/.test(t) && /Wash the grown-ups/.test(t) && /~10 min/.test(t), '6 Thursday’s weekly jobs under “Any time today”, with minutes');
  ok(/About \d+ (min|h) free/.test(t), '7 it says how much free time there is before the next thing');

  // tap a job, give it a time
  await p.tap('.rj-pane[data-i="0"] [data-act=rj-open]:has-text("Wash the grown-ups")'); await p.waitForTimeout(200);
  ok(!!await p.$('.rj-sch') && /After bedtime/.test(await p.textContent('.rj-sch')), '8 tapping a job opens “When?” with good moments in the day');
  await p.tap('.rj-sch [data-act=rj-at]:has-text("After bedtime")'); await p.tap('.rj-sch [data-act=rj-save]'); await p.waitForTimeout(300);
  st = await p.evaluate(() => window.__st); const sv = Object.entries(st['home/sched'] || {}).find(([k, v]) => v && /sheets/.test(v.text));
  ok(sv && sv[1].date === '2026-11-05' && sv[1].at === '19:45' && sv[1].who === 'Alex', '9 saved for today at 19:45, for you');
  t = await pane(p, 0); ok(/19:45\s*Wash the grown-ups/.test(t), '10 it moves into the itinerary at that time');
  const job = sv[0];
  p = await open('Alex', { ...base, ...Object.fromEntries(Object.entries(st).filter(([k]) => k.startsWith('home/'))) }, { hash: 'today', T: '2026-11-05T19:00:00' });
  ok(/Wash the grown-ups/.test(await p.evaluate(() => document.body.innerText)), '11 and on Today’s timeline');

  // ticking: weekly and every-few-days
  p = await open('Alex', { ...base, ...Object.fromEntries(Object.entries(st).filter(([k]) => k.startsWith('home/'))) });
  await p.tap(`.rj-pane[data-i="0"] [data-act=rj-tick][data-id="${job}"]`); await p.waitForTimeout(200);
  st = await p.evaluate(() => window.__st); ok(Object.entries(st).some(([k, v]) => k.startsWith('weeks/') && v.done && v.done['r:' + job.split(':')[1]]), '12 ticking a weekly job counts for the week');

  // This week and This month
  await p.tap('[data-act=rj-pane][data-v="1"]'); await p.waitForTimeout(600);
  ok(await p.evaluate(() => { const c = document.getElementById('rjCar'); return Math.round(c.scrollLeft / c.clientWidth) === 1; }), '13 tapping This week slides to it');
  t = await pane(p, 1);
  ok(/Earlier this week · \d+ of \d+ done/.test(t) && ['Thursday', 'Friday', 'Saturday', 'Sunday'].every(d => t.includes(d)) && /Saturday[\s\S]*Laundry, round two[\s\S]*Sam/.test(t), '14 the week: earlier days folded into one line, the rest day by day; Saturday has laundry round two, Sam’s');
  ok(/Saturday[\s\S]*Fireplace: ash out/.test(t) && /Every few days/.test(t) && /Vacuum where the cats sleep/.test(t) && /every ~4 days/.test(t), '15 November brings the fireplace; every-few-days jobs say when they were last done');
  const eid = await p.$eval('.rj-pane[data-i="1"] .rj.st-due [data-act=rj-tick], .rj-pane[data-i="1"] [data-act=rj-tick][data-id^="e:"]', x => x.dataset.id);
  await p.tap(`.rj-pane[data-i="1"] [data-act=rj-tick][data-id="${eid}"]`); await p.waitForTimeout(200);
  st = await p.evaluate(() => window.__st); ok(st['home/rlog'][eid.slice(2)].last === '2026-11-05', '16 ticking an every-few-days job resets its clock');
  await p.evaluate(() => { const c = document.getElementById('rjCar'); c.scrollLeft = c.clientWidth * 2; }); await p.waitForTimeout(500);
  ok(await p.evaluate(() => document.querySelector('[data-act=rj-pane][data-v="2"]').classList.contains('on')), '17 swiping the cards moves the pills along');
  t = await pane(p, 2);
  ok(/November/.test(t) && /Every month/.test(t) && /Money check-in together/.test(t) && /Mikuláš/.test(t) && /Coming in December/.test(t), '18 this month: monthly jobs, November’s seasonal ones, and a peek at December');
  await p.screenshot({ path: __dirname + '/shots/rhythms.png' });

  // survival mode: only the glass balls
  const sv2 = JSON.parse(JSON.stringify({ ...base, ...Object.fromEntries(Object.entries(st).filter(([k]) => k.startsWith('home/'))) })); sv2['days/2026-11-07'] = { mode: 'survival', done: {} };
  p = await open('Alex', sv2, { T: '2026-11-07T10:00:00' }); await p.tap('[data-act=rj-pane][data-v="1"]'); await p.waitForTimeout(500); t = await pane(p, 1);
  ok(/Survival mode/.test(t) && /Cats: full litter change/.test(t) && !/Toy rotation/.test(t), '19 survival mode: only the glass balls show');

  // the lists editor
  p = await open('Alex', { ...base, ...Object.fromEntries(Object.entries(st).filter(([k]) => k.startsWith('home/'))) });
  await p.tap('#sec-r-l-weekly .grp-h'); await p.waitForTimeout(150); await p.tap('#sec-r-l-weekly [data-act=edit]'); await p.waitForTimeout(150);
  await p.selectOption('#rjd_weekly_w2-paper', '4'); await p.waitForTimeout(250);
  st = await p.evaluate(() => window.__st); ok(st['home/rhythms'].weekly.find(x => x.id === 'w2-paper').day === 4, '20 the weekly list can be edited: day, minutes, who, season');

  // Claude's season check (from 15 November)
  p = await open('Alex', { ...base, ...Object.fromEntries(Object.entries(st).filter(([k]) => k.startsWith('home/'))) }, { T: '2026-11-20T10:00:00', claude: true });
  await p.tap('[data-act=rj-pane][data-v="2"]'); await p.waitForTimeout(2500); t = await pane(p, 2);
  const pr = await p.evaluate(() => (window.__prompts || []).join('\n'));
  ok(/Winter is coming/.test(t) && /Add to weekly: Check the gutters/.test(t) && /Drop from weekly: Kitchen: wipe the hob/.test(t), '21 from mid-November Claude’s season check is there, with suggestions to add and drop');
  ok(/KC Davis/.test(pr) && /w2-paper: Paper basket/.test(pr) && /winter/.test(pr), '22 Claude is given the book’s principles, every list with ids, and the season');
  await p.tap('.rj-review [data-act=rj-rv-pick][data-id="1"]'); await p.waitForTimeout(200); await p.tap('[data-act=rj-rv-apply]'); await p.waitForTimeout(300);
  st = await p.evaluate(() => window.__st); R = st['home/rhythms'];
  ok(R.weekly.some(x => /Check the gutters/.test(x.text) && x.day === 6) && R.weekly.some(x => x.id === 'w2-kitchen') && R.every.find(x => x.id === 'e2-mop').every === 14 && R.review.closed, '23 only the ticked ones are applied');
  console.log(errs.length ? errs.join('\n') : 'NO PAGE ERRORS'); await b.close();
})();
