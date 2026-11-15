// While closing duties are due (from 15 minutes before bedtime), they are the first section on Today for whoever has
// them; whoever has bedtime sees Tonight first. "In play today" is gone.
const { chromium, devices } = require('playwright'), fs = require('fs'), path = require('path');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ ...devices['iPhone 13'] }), errs = [];
  const sd = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8')); sd['home/situation'] = {}; sd['home/lists'] = { ...(sd['home/lists'] || {}), bedtime: (sd['home/lists'] || {}).bedtime && sd['home/lists'].bedtime.length ? sd['home/lists'].bedtime : [{ id: 'b1', text: 'Teeth' }] }; sd['home/household'].baseline = 2;
  const open = async (who, T) => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(`window.__SEED=${JSON.stringify(sd)};`); await p.addInitScript(fs.readFileSync(__dirname + '/fakedb.js', 'utf8'));
    await p.addInitScript(([n, k]) => { localStorage.setItem('afloat.me', n); localStorage.setItem('afloat.brief', k); }, [who, T.slice(0, 10) + 'evening']);
    await p.clock.install({ time: new Date(T) }); await p.goto('file://' + path.resolve(__dirname, '../index.html') + '#today'); await p.waitForTimeout(1300); return p; };
  const first = p => p.evaluate(() => (document.querySelector('#app .grp .grp-h span') || {}).textContent || '');
  let p = await open('Alex', '2026-11-14T18:40:00');
  ok(/Closing duties/.test(await first(p)), '1 Saturday 18:40, Alex has closing duties (Sam has bedtime): they come first: ' + await first(p));
  p = await open('Sam', '2026-11-14T18:40:00');
  ok(/Bedtime/.test(await first(p)), '2 Sam has bedtime: Bedtime comes first: ' + await first(p));
  p = await open('Alex', '2026-11-12T16:00:00');
  ok(!/Closing duties/.test(await first(p)), '3 before bedtime, the usual order');
  ok(!/In play today/.test(await p.textContent('#app')), '4 no “In play today” box');
  console.log(errs.length ? errs.join('\n') : 'NO PAGE ERRORS'); await b.close();
})();
