// Today's setup: it opens by itself only for Alex (freelance) on a girls-at-home day, and has a Done that folds it away
// for the rest of the day; Sam (fixed hours) sees the small summary.
const { chromium, devices } = require('playwright'), fs = require('fs'), path = require('path');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ ...devices['iPhone 13'] }), errs = [];
  const sd = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8')); sd['home/household'].baseline = 2;
  sd['plans/2026-11-04'] = { situ: { girlsConfirmed: true } };
  const open = async who => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(`window.__SEED=${JSON.stringify(sd)};`); await p.addInitScript(fs.readFileSync(__dirname + '/fakedb.js', 'utf8'));
    await p.addInitScript(n => { localStorage.setItem('afloat.me', n); localStorage.setItem('afloat.brief', '2026-11-04day'); }, who);
    await p.clock.install({ time: new Date('2026-11-04T12:30:00') }); await p.goto('file://' + path.resolve(__dirname, '../index.html') + '#today'); await p.waitForTimeout(1300); return p; };
  let p = await open('Sam');
  ok(!(await p.$('#app section.situ')) && !!(await p.$('#app .situ-sum')), '1 Sam sees the small summary, not the open setup');
  p = await open('Alex');
  ok(!!(await p.$('#app section.situ')), '2 Alex gets it open on a girls-at-home day');
  await p.tap('#app section.situ [data-act=situ-ok]'); await p.waitForTimeout(300);
  ok(!(await p.$('#app section.situ')) && !!(await p.$('#app .situ-sum')), '3 Done folds it into the small box');
  ok(await p.evaluate(() => !!((window.__st['plans/2026-11-04'] || {}).situ || {}).ok?.['Alex']), '4 and it stays folded for the rest of the day (saved for today)');
  console.log(errs.length ? errs.join('\n') : 'NO PAGE ERRORS'); await b.close();
})();
