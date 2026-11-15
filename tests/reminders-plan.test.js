// Plan tomorrow: "Plan for it" on an event with a time sets two reminders (start getting ready, leave now), always ringing;
// taking it off the plan removes them. No Trello card.
const { chromium, devices } = require('playwright'), fs = require('fs'), path = require('path');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ ...devices['iPhone 13'], timezoneId: 'Europe/Prague' }), errs = [];
  const base = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8')); base['home/situation'] = {}; base['home/household'].baseline = 1;
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(`window.__SEED=${JSON.stringify(base)};window.__TR_ME="a";window.__EXTRA_CARDS=[];window.__CAL=${JSON.stringify(base['home/calendar'].calId)};`);
  await p.addInitScript(fs.readFileSync(__dirname + '/fakedb.js', 'utf8')); await p.addInitScript(fs.readFileSync(__dirname + '/fake-trello.js', 'utf8'));
  await p.addInitScript(() => {
    window.__G.evd = { id: 'evd', cal: 'fam', summary: 'Dentist · Alex', start: { dateTime: '2026-11-06T10:00:00+01:00' }, end: { dateTime: '2026-11-06T11:00:00+01:00' }, status: 'confirmed', updated: '2026-11-05T07:00:00.000Z' };
    localStorage.setItem('afloat.me', 'Alex'); localStorage.setItem('afloat.brief', 'x');
  });
  await p.clock.install({ time: new Date('2026-11-05T20:00:00') }); await p.goto('file://' + path.resolve(__dirname, '../index.html') + '#today'); await p.waitForTimeout(2500);
  if (await p.$('button.btn[data-act=brief-close]')) { await p.tap('button.btn[data-act=brief-close]'); await p.waitForTimeout(150); }
  await p.evaluate(() => document.querySelectorAll('#app .grp-b[hidden]').forEach(x => x.hidden = false));
  await p.evaluate(() => document.querySelector('[data-act=plan-from-ev][data-g=evd]').click()); await p.waitForTimeout(400);
  let st = await p.evaluate(() => window.__st), R = ((st['home/reminders'] || {}).list || []).filter(x => x.src === 'plan');
  ok(R.length === 2 && R.every(x => x.date === '2026-11-06' && x.live && x.who === 'Alex') && R.some(x => x.at === '09:35' && /Leave now/.test(x.text)) && R.some(x => x.at === '09:05' && /getting ready/.test(x.text)), '1 “Plan for it” sets two reminders for tomorrow, always ringing: ready at 09:05, leave at 09:35, the same minute as the countdown');
  ok(!(await p.evaluate(() => window.__trLog.some(x => x[0] === 'trelloWriteCard' && x[1].action === 'create'))), '2 no Trello card');
  await p.evaluate(() => document.querySelector('[data-act=plan-rem]').click()); await p.waitForTimeout(300);
  st = await p.evaluate(() => window.__st); ok(!((st['home/reminders'] || {}).list || []).some(x => x.src === 'plan'), '3 “Turn off” removes the reminders but keeps the plan');
  await p.evaluate(() => document.querySelector('[data-act=plan-rem]').click()); await p.waitForTimeout(300);
  st = await p.evaluate(() => window.__st); ok(((st['home/reminders'] || {}).list || []).filter(x => x.src === 'plan').length === 2, '4 “Remind me” brings them back');
  await p.evaluate(() => document.querySelector('[data-act=plan-del][data-l=events]').click()); await p.waitForTimeout(300);
  st = await p.evaluate(() => window.__st); ok(!((st['home/reminders'] || {}).list || []).some(x => x.src === 'plan'), '5 taking the event off the plan removes its reminders');
  console.log(errs.length ? errs.join('\n') : 'NO PAGE ERRORS'); await b.close();
})();
