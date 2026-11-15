// Together: the twice-yearly relationship check-up. Each answers alone (nine areas 1–5, up to two stars, three short
// questions); the other's answers stay hidden until both finish; the summary puts strengths first, then what's worth
// talking about; you pick one or two focus areas; the round is saved and the next is due in six months.
const { chromium, devices } = require('playwright'), fs = require('fs'), path = require('path');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ ...devices['iPhone 13'] }), errs = [];
  const base = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8')); base['home/situation'] = {}; base['home/household'].baseline = 1;
  const open = async (who, st) => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(`window.__SEED=${JSON.stringify(st)};`); await p.addInitScript(fs.readFileSync(__dirname + '/fakedb.js', 'utf8'));
    await p.addInitScript(n => { localStorage.setItem('afloat.me', n); localStorage.setItem('afloat.brief', 'x'); }, who);
    await p.clock.install({ time: new Date('2026-11-11T20:30:00') }); await p.goto('file://' + path.resolve(__dirname, '../index.html') + '#together'); await p.waitForTimeout(1200);
    if (await p.$('[data-act=brief-close]')) { await p.tap('[data-act=brief-close]'); await p.waitForTimeout(150); } return p; };
  const txt = p => p.evaluate(() => document.querySelector('#app').innerText);
  const answer = async (p, scores, star, more) => {
    const keys = ['time', 'close', 'fun', 'talk', 'team', 'load', 'money', 'touch', 'own'];
    for (let i = 0; i < keys.length; i++) { await p.tap(`[data-act=cu-rate][data-k=${keys[i]}][data-v="${scores[i]}"]`); await p.waitForTimeout(60); }
    for (const k of star) { await p.tap(`[data-act=cu-star][data-k=${k}]`); await p.waitForTimeout(60); }
    await p.fill('#cu_more', more); await p.dispatchEvent('#cu_more', 'change'); await p.waitForTimeout(100);
  };

  let p = await open('Alex', base), t = await txt(p);
  ok(/Relationship check-up/.test(t) && /Ready when you are/.test(t), '1 the first check-up is ready when you are');
  await p.tap('[data-act=cu-start]'); await p.waitForTimeout(200);
  ok(/Your check-up answers/.test(await txt(p)) && await p.isDisabled('[data-act=cu-done]'), '2 nine areas to rate; can’t finish until all are rated');
  await answer(p, [2, 4, 3, 4, 4, 2, 3, 3, 4], ['time', 'load'], 'Evenings just the two of us');
  await p.tap('[data-act=cu-star][data-k=fun]'); await p.waitForTimeout(150);
  ok(!(await p.$eval('[data-act=cu-star][data-k=fun]', e => e.getAttribute('aria-pressed') === 'true')), '3 at most two stars');
  await p.tap('[data-act=cu-done]'); await p.waitForTimeout(250); t = await txt(p);
  ok(/Waiting for Sam/.test(t), '4 done: waiting for Sam');
  const st1 = await p.evaluate(() => window.__st);

  p = await open('Sam', { ...base, 'home/checkup': st1['home/checkup'] }); t = await txt(p);
  ok(/Alex is done/.test(t) && !/Evenings just the two of us/.test(t), '5 Sam sees she’s done, not her answers');
  await p.tap('[data-act=cu-open]'); await p.waitForTimeout(200);
  await answer(p, [3, 4, 2, 4, 5, 4, 3, 4, 4], ['fun'], 'More silly fun');
  await p.tap('[data-act=cu-done]'); await p.waitForTimeout(300); t = await txt(p);
  ok(/Your check-up, together/.test(t) && /Going well for both of you/.test(t) && /Talking things through/.test(t), '6 both done: the summary opens, strengths first');
  ok(/Worth talking about/.test(t) && t.indexOf('Time together') > t.indexOf('Worth talking about') && t.indexOf('Fun and play') > t.indexOf('Worth talking about'), '7 low, far apart or starred areas are worth talking about');
  ok(/Evenings just the two of us/.test(t) && /More silly fun/.test(t), '8 now both see what the other would love more of');
  await p.tap('[data-act=cu-focus][data-k=time]'); await p.waitForTimeout(150);
  await p.tap('[data-act=cu-close-round]'); await p.waitForTimeout(250); t = await txt(p);
  ok(/Next: /.test(t) && /Your focus since/.test(t) && /Time together, just the two of us/.test(t), '9 saved: focus shown, next one in six months');
  await p.tap('[data-act=rel-step][data-v="1"]'); await p.waitForTimeout(150); await p.tap('[data-act=rel-step][data-v="2"]'); await p.waitForTimeout(150);
  ok(/Your focus from the check-up: Time together/.test(await txt(p)), '10 the weekly check-in reminds you of the focus');
  await p.screenshot({ path: __dirname + '/shots/checkup.png' });
  console.log(errs.length ? errs.join('\n') : 'NO PAGE ERRORS'); await b.close();
})();
