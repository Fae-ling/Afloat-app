// Updates never jump you to the top: the briefing and the page keep their scroll when data changes (the other phone,
// the minute tick), nothing is rebuilt while a finger is down, and unchanged screens aren't rebuilt at all.
const { chromium, devices } = require('playwright'), fs = require('fs'), path = require('path');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ ...devices['iPhone 13'] }), errs = [];
  const sd = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8')); sd['home/household'].baseline = 2;
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(`window.__SEED=${JSON.stringify(sd)};`); await p.addInitScript(fs.readFileSync(__dirname + '/fakedb.js', 'utf8'));
  await p.addInitScript(() => { localStorage.setItem('afloat.me', 'Alex'); });
  await p.clock.install({ time: new Date('2026-11-04T19:30:00') }); await p.goto('file://' + path.resolve(__dirname, '../index.html') + '#today'); await p.waitForTimeout(1500);
  ok(!!(await p.$('.brief-ov')), '0 the briefing is open');
  await p.evaluate(() => { document.querySelector('.brief-ov').scrollTop = 400; });
  const change = () => p.evaluate(() => { window.__st['events/nj' + Math.random()] = { title: 'Something new', kind: 'other', who: ['Alex'], date: '2026-11-04', endDate: '2026-11-04', start: '21:00', end: '21:30', at: 3 }; window.__fire(); });
  await change(); await p.waitForTimeout(400);
  ok((await p.evaluate(() => document.querySelector('.brief-ov').scrollTop)) >= 390, '1 a change from the other phone keeps the briefing where it was');
  await p.tap('[data-act=brief-close]'); await p.waitForTimeout(300);
  await p.evaluate(() => window.scrollTo(0, 900)); await p.waitForTimeout(100); const y0 = await p.evaluate(() => scrollY);
  await change(); await p.waitForTimeout(400); await p.clock.runFor(61000); await p.waitForTimeout(300);
  ok(Math.abs((await p.evaluate(() => scrollY)) - y0) < 5, '2 the page keeps its place through updates and the minute tick (' + y0 + ')');
  const tag = () => p.evaluate(() => { const a = document.querySelector('#app section.card'); if (a) a.dataset.tag = 'x'; return !!a; });
  await tag(); await p.evaluate(() => { window.__st['home/unrelated'] = { x: Math.random() }; window.__fire(); }); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !!document.querySelector('#app [data-tag=x]')), '3 nothing changed → the page isn’t rebuilt');
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 400 }] });
  await change(); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !!document.querySelector('#app [data-tag=x]')), '4 while a finger is down, updates wait');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(300);
  ok(!(await p.evaluate(() => !!document.querySelector('#app [data-tag=x]'))), '5 and land right after it lifts');
  console.log(errs.length ? errs.join('\n') : 'NO PAGE ERRORS'); await b.close();
})();
