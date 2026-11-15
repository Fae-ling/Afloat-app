// Today, tidied (10 Nov 2026): the tank check-in sits at the top of Self-care and leaves Today once answered (the overview keeps one line);
// only to-dos with a near due date show on Today; only current reminders show, and ticked ones leave Today for the Reminders editor.
const { chromium, devices } = require('playwright'), fs = require('fs'), path = require('path');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ ...devices['iPhone 13'] }), errs = [];
  const base = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8')); base['home/situation'] = {}; base['home/household'].baseline = 1;
  const open = async (st, { hash = 'today', T = '2026-11-10T10:30:00', who = 'Alex' } = {}) => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(`window.__SEED=${JSON.stringify(st)};window.__TR_ME="a";window.__EXTRA_CARDS=[];`);
    await p.addInitScript(fs.readFileSync(__dirname + '/fakedb.js', 'utf8')); await p.addInitScript(fs.readFileSync(__dirname + '/fake-trello.js', 'utf8'));
    await p.addInitScript(([n]) => { localStorage.setItem('afloat.me', n); localStorage.setItem('afloat.brief', 'x'); }, [who]);
    await p.clock.install({ time: new Date(T) }); await p.goto('file://' + path.resolve(__dirname, '../index.html') + '#' + hash); await p.waitForTimeout(2500);
    if (await p.$('button.btn[data-act=brief-close]')) { await p.tap('button.btn[data-act=brief-close]'); await p.waitForTimeout(150); } return p; };
  const txt = (p, sel) => p.evaluate(s => (document.querySelector(s) || {}).textContent || '', sel);
  let p = await open(base);
  ok(!/How’s everyone’s tank\?/.test(await txt(p, '#app')), '1 Today no longer has the energy box (the check-in lives in Self-care)');
  await p.evaluate(() => { location.hash = 'care'; }); await p.waitForTimeout(400);
  const first = await p.evaluate(() => { const h = [...document.querySelectorAll('#app section.card h2')][0]; return h ? h.textContent : ''; });
  ok(/How’s everyone’s tank\?/.test(first), '2 the check-in is the first card on Self-care');
  await p.evaluate(() => document.querySelector('[data-act=mode][data-m=low]').click()); await p.waitForTimeout(400);
  await p.evaluate(() => { location.hash = 'today'; }); await p.waitForTimeout(400);
  ok(/Tank:\s*Running low/.test(await txt(p, '#app')), '4 the overview at the top keeps one line about it');
  await p.evaluate(() => { location.hash = 'today'; }); await p.waitForTimeout(400);
  ok(!/Nothing due and nothing waiting|Later today:/.test(await txt(p, '#app')), '5 Today has no empty to-do card and no "later today" list');
  console.log(errs.length ? errs.join('\n') : 'NO PAGE ERRORS'); await b.close();
})();
