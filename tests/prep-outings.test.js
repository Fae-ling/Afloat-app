// Evening prep for tomorrow's outings: short (the usual in one line), what's special as a checklist, Claude's
// suggestions for that outing (one tap adds them for this time), a grandparents drop-off with its own kit, and the
// routine pick-up left out when nothing about it is different.
const { chromium, devices } = require('playwright'), fs = require('fs'), path = require('path');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ ...devices['iPhone 13'] }), errs = [];
  const sd = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8')); sd['home/situation'] = {}; delete sd['home/household'].baseline;
  sd['events/p1'] = { title: 'Yoga class', kind: 'other', who: ['Alex'], date: '2026-11-12', endDate: '2026-11-12', start: '10:30', end: '11:30', place: 'Vinohradská 30, Praha', at: 1 };
  sd['events/p2'] = { title: 'Holky k babi', kind: 'grandma', gpGId: 'gp1', who: ['Mia', 'Zoe'], date: '2026-11-12', endDate: '2026-11-13', start: '16:30', end: '18:00', place: 'Kolovraty, Praha', at: 1 };
  sd['home/kits'] = { usualLog: { 'launch:Alex:i0jgu2g': [{ o: 'x1', s: true }, { o: 'x2', s: true }] } };
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(`window.__SEED=${JSON.stringify(sd)};window.__TR_ME="a";window.__EXTRA_CARDS=[];`);
  await p.addInitScript(fs.readFileSync(__dirname + '/fakedb.js', 'utf8')); await p.addInitScript(fs.readFileSync(__dirname + '/fake-trello.js', 'utf8'));
  await p.addInitScript(() => { localStorage.setItem('afloat.me', 'Alex'); localStorage.setItem('afloat.brief', 'x'); window.__prompts = [];
    window.__SAMPLE = i => { const t = String(i); window.__prompts.push(t); if (/grandparents/.test(t) && /Already on the list/.test(t)) return ['Winter hats for the girls']; if (/Already on the list/.test(t)) return ['Tissues']; return {}; }; });
  await p.clock.install({ time: new Date('2026-11-11T19:30:00') }); await p.goto('file://' + path.resolve(__dirname, '../index.html') + '#today'); await p.waitForTimeout(3500);
  if (await p.$('[data-act=brief-close]')) { await p.tap('[data-act=brief-close]'); await p.waitForTimeout(300); }
  const prep = () => p.evaluate(() => [...document.querySelectorAll('#app .prep-out')].map(x => x.textContent.replace(/\s+/g, ' ')));
  let t = await prep();
  const gp = t.find(x => /Girls to the grandparents · 16:30/.test(x)) || '';
  ok(/Girls to the grandparents · 16:30/.test(gp) && !/The girls’ clothes/.test(gp), '1 the grandparents-calendar event is the drop-off outing, and no kit is added to it: ' + gp.slice(0, 160));
  ok(/Winter hats for the girls/.test(gp), '2 Claude suggests something for this outing (a winter hat when it’s cold)');
  ok(t.some(x => /Yoga class · 10:30/.test(x) && /Tissues/.test(x)), '3 every real outing tomorrow gets its own suggestions');
  ok(!t.some(x => /Pick-up \(Mia\)/.test(x)), '4 the routine pick-up stays out: nothing about it is different');
  await p.tap('[data-act=go-sug][data-t="Winter hats for the girls"]'); await p.waitForTimeout(300); t = await prep();
  const gp2 = t.find(x => /Girls to the grandparents/.test(x)) || '';
  ok(/Winter hats for the girls/.test(gp2) && !/\+ Winter hats/.test(gp2) && await p.evaluate(() => !!document.querySelector('.prep-out .check')), '5 one tap puts it on the list, just for this time');
  const n = await p.evaluate(() => window.__prompts.length); await p.evaluate(() => { location.hash = 'tasks'; }); await p.waitForTimeout(300); await p.evaluate(() => { location.hash = 'today'; }); await p.waitForTimeout(1500);
  ok((await p.evaluate(() => window.__prompts.length)) === n, '6 suggestions are asked once, not on every visit');
  const pr = await p.evaluate(() => window.__prompts.find(x => /Yoga class/.test(x) && /Already on the list/.test(x)) || '');
  ok(/Going: only Alex/.test(pr) && /No children are coming/.test(pr) && !/Mia|Zoe/.test(pr), '7 Claude is told who’s going: only Alex to the class, no children');
  const pg = await p.evaluate(() => window.__prompts.find(x => /grandparents/.test(x) && /Already on the list/.test(x)) || '');
  ok(/with Mia \(aged \d\) and Zoe \(aged \d\)/.test(pg) && /Neither girl uses nappies/.test(pg), '8 and that both girls go to the grandparents, out of nappies');
  // the usual: leave something out just this time
  const psy = '.prep-out:has-text("Yoga class")';
  await p.tap(`${psy} [data-act=usual-edit]`); await p.waitForTimeout(200);
  await p.tap(`${psy} [data-act=usual-tog]:has-text("Glasses")`); await p.waitForTimeout(150);
  await p.tap(`${psy} [data-act=usual-done]`); await p.waitForTimeout(300);
  t = await p.textContent(psy);
  ok(/not this time: Glasses/.test(t) && !/The usual:[^(]*Glasses/.test(t), '9 Edit the usual: Glasses left out just this time');
  t = t;
  // the earlier two skips are in the seed: this was the third time in a row
  ok(/left out Glasses three times in a row/.test(await p.textContent(psy)), '10 after the third time in a row, it asks to take it off the usual');
  await p.tap(`${psy} [data-act=usual-yes]`); await p.waitForTimeout(300);
  ok(!(await p.evaluate(() => (window.__st['home/people'].people['Alex'].launch || []).some(x => /Glasses/.test(x.text)))), '11 and takes it off for good when you say yes');
  // adding something is for this one only, and never turns into a standing list
  await p.tap(`${psy} [data-act=go-edit]`); await p.waitForTimeout(150);
  ok(!(await p.$(`${psy} select[name=scope]`)), '12 there is no “every time” choice when adding');
  for (let i = 0; i < 3; i++) { await p.fill(`${psy} form[data-form=go-add] input`, 'Umbrella'); await p.tap(`${psy} form[data-form=go-add] button`); await p.waitForTimeout(300); if (i < 2) { const e = await p.$(`${psy} [data-act=go-edit]`); if (e) { await p.tap(`${psy} [data-act=go-edit]`); await p.waitForTimeout(150); } } }
  ok(!/third time you’ve added/.test(await p.textContent(psy)) && /Umbrella/.test(await p.textContent(psy)), '13 it is on this event’s list and never offered as a usual');
  ok(!/What’s for dinner/.test(await p.textContent('#app')), '14 no separate Mealtime box on Today any more');
  await p.evaluate(() => document.querySelector('.prep-outs').scrollIntoView()); await p.screenshot({ path: __dirname + '/shots/prep-outings.png', fullPage: false });
  console.log(errs.length ? errs.join('\n') : 'NO PAGE ERRORS'); await b.close();
})();
