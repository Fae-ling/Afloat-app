// Who holds what (Us → Together) and the day a job starts (Settings): a saved switch from freelance to set hours,
// drop-off on the way, back to freelance in one tap, and who stays home on sick days.
const { chromium, devices } = require('playwright'), fs = require('fs'), path = require('path');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ ...devices['iPhone 13'] }), errs = [];
  const base = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8')); base['home/situation'] = {}; base['home/household'].baseline = 1;
  const open = async (st, { hash = 'today', T = '2026-11-05T10:30:00' } = {}) => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(`window.__SEED=${JSON.stringify(st)};window.__TR_ME="a";window.__EXTRA_CARDS=[];`);
    await p.addInitScript(fs.readFileSync(__dirname + '/fakedb.js', 'utf8')); await p.addInitScript(fs.readFileSync(__dirname + '/fake-trello.js', 'utf8'));
    await p.addInitScript(() => { localStorage.setItem('afloat.me', 'Alex'); localStorage.setItem('afloat.brief', 'x'); });
    await p.clock.install({ time: new Date(T) }); await p.goto('file://' + path.resolve(__dirname, '../index.html') + '#' + hash); await p.waitForTimeout(2500);
    if (await p.$('button.btn[data-act=brief-close]')) { await p.tap('button.btn[data-act=brief-close]'); await p.waitForTimeout(150); } return p; };
  const homeOf = st => Object.fromEntries(Object.entries(st).filter(([k]) => k.startsWith('home/')));
  let p = await open(base, { hash: 'rhythms' }), st = await p.evaluate(() => window.__st); const up = { ...base, ...homeOf(st) };
  p = await open(up, { hash: 'together' }); let t = await p.$eval('.card.areas', x => x.textContent).catch(() => '');
  ok(/Who holds what/.test(t) && /Kindergarten or school logistics/.test(t) && /thinks of it/.test(t), '1 Together shows who holds what, with the thinking and the doing');
  await p.evaluate(() => document.querySelector('.card.areas details').open = true);
  await p.tap('.card.areas [data-act=area-set][data-id=a0][data-f=think][data-v="Alex"]'); await p.waitForTimeout(200);
  await p.tap('.card.areas [data-act=area-set][data-id=a0][data-f=act][data-v=both]'); await p.waitForTimeout(200);
  st = await p.evaluate(() => window.__st); const a0 = st['home/areas'].list.find(x => x.id === 'a0');
  ok(a0.think === 'Alex' && a0.act === 'both' && /Alex holds the thinking for 1/.test(await p.$eval('.card.areas', x => x.textContent)), '2 picking who thinks and who does is kept, with a gentle count');
  // the job switch
  p = await open({ ...up, ...homeOf(st) }); await p.evaluate(() => document.querySelector('[data-act=settings]').click()); await p.waitForTimeout(300);
  ok(/When I start a job/.test(await p.$eval('#sheet', x => x.textContent)), '3 Settings has “When I start a job”');
  await p.fill('#sheet form[data-form=job] input[name=start]', '08:30'); await p.fill('#sheet form[data-form=job] input[name=finish]', '16:30'); await p.fill('#sheet form[data-form=job] input[name=travel]', '30');
  await p.evaluate(() => document.querySelector('#sheet form[data-form=job]').requestSubmit()); await p.waitForTimeout(300);
  await p.tap('#sheet [data-act=job-on]'); await p.waitForTimeout(300); st = await p.evaluate(() => window.__st);
  const pa = st['home/people'].people['Alex'];
  ok(pa.workStyle === 'fixed' && pa.leave === '07:35' && pa.back === '17:00' && pa.dropsOff && pa.wasFlex && pa.wasFlex.workStyle === 'flex', '4 one tap switches to set hours: out 07:35 with drop-off, back 17:00 (old setup kept)');
  p = await open({ ...up, ...homeOf(st) }, { T: '2026-11-06T07:00:00' });
  ok(/Drop-off/.test(await p.evaluate(() => document.querySelector('#app').textContent)) && /Drop-off you/.test(await p.evaluate(() => document.querySelector('#app').textContent)), '5 with both at work, drop-off is yours on the way');
  await p.evaluate(() => document.querySelector('[data-act=settings]').click()); await p.waitForTimeout(300);
  await p.tap('#sheet [data-act=sick-carer][data-v="Sam"]'); await p.waitForTimeout(200);
  await p.tap('#sheet [data-act=job-off]'); await p.waitForTimeout(300); st = await p.evaluate(() => window.__st);
  ok(st['home/people'].people['Alex'].workStyle === 'flex' && !st['home/people'].people['Alex'].wasFlex && st['home/household'].sickCarer === 'Sam', '6 back to freelance in one tap; Sam is the sick-day carer');
  console.log(errs.length ? errs.join('\n') : 'NO PAGE ERRORS'); await b.close();
})();
