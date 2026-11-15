// Gentle delivery (5 Nov 2026): every list reaches you at the right moment without piling up. Today's beat on the Today tab
// (today's weekly jobs, at most two "if there's room" extras inside a daily house time; no carry-over), "Not today",
// three skips → a kind offer to take it off the list or make it less often, welcome back after time away, survival shows
// glass balls only, the month's notes in its first week, the restock run with a supply check that sends to Nákupy, the room
// lists at the end of a reset, and the briefing line.
const { chromium, devices } = require('playwright'), fs = require('fs'), path = require('path');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ ...devices['iPhone 13'] }), errs = [];
  const base = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8')); base['home/situation'] = {}; base['home/household'].baseline = 1;
  const shopId = base['home/trello'].lists.shop;
  const open = async (st, { hash = 'today', T = '2026-11-05T10:30:00', who = 'Alex', seen = null, brief = false, cards = [] } = {}) => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(`window.__SEED=${JSON.stringify(st)};window.__TR_ME="a";window.__EXTRA_CARDS=${JSON.stringify(cards)};`);
    await p.addInitScript(fs.readFileSync(__dirname + '/fakedb.js', 'utf8')); await p.addInitScript(fs.readFileSync(__dirname + '/fake-trello.js', 'utf8'));
    await p.addInitScript(([n, sn, br]) => { localStorage.setItem('afloat.me', n); if (!br) localStorage.setItem('afloat.brief', 'x'); if (sn) localStorage.setItem('afloat.seen.' + n, sn); }, [who, seen, brief]);
    await p.clock.install({ time: new Date(T) }); await p.goto('file://' + path.resolve(__dirname, '../index.html') + '#' + hash); await p.waitForTimeout(2500);
    if (!brief && await p.$('button.btn[data-act=brief-close]')) { await p.tap('button.btn[data-act=brief-close]'); await p.waitForTimeout(150); } return p; };
  const beat = p => p.$eval('.card.beat', x => x.innerText).catch(() => '');
  const homeOf = st => Object.fromEntries(Object.entries(st).filter(([k]) => k.startsWith('home/')));

  // a first visit upgrades the lists; then Today's beat
  let p = await open(base, { hash: 'rhythms' }), st = await p.evaluate(() => window.__st); const up = { ...base, ...homeOf(st) };
  p = await open(up); let t = await beat(p), all = await p.evaluate(() => document.querySelector('#app').innerText);
  ok(/Today’s beat/.test(all) && /Wash the grown-ups' sheets/.test(t) && /~10 min/.test(t), '1 Today’s beat shows Thursday’s weekly job, with minutes');
  ok(!/Still open from earlier this week/.test(all) && !/This month’s bigger job/.test(all), '2 nothing carries over from earlier days, and no month-long “bigger job” card');
  const extras = await p.$$eval('.card.beat .beat-h + .rj-l > li.rj', a => a.length).catch(() => 0);
  ok(/If there’s room/.test(t) ? extras >= 1 && extras <= 2 : true, '3 at most two “if there’s room” extras: ' + extras);
  ok(/House time a day/.test(t) && /Not today/.test(t) && !/overdue/i.test(all.replace('Old overdue thing', '')), '4 a daily house time to choose, “Not today” on each job, and no “overdue” anywhere');

  // Not today
  await p.tap('.card.beat [data-act=beat-skip][data-id^="w:"]'); await p.waitForTimeout(250);
  st = await p.evaluate(() => window.__st); let sk = Object.entries(st['home/beat'] || {}).find(([k]) => k.startsWith('s:w:'));
  ok(sk && sk[1].until === '2026-11-06' && sk[1].n === 1 && !/Wash the grown-ups' sheets/.test(await beat(p)), '5 “Not today” moves a weekly job to next week, quietly');
  // three times in a row → a kind question
  const k3 = sk[0]; p = await open({ ...up, 'home/beat': { [k3]: { until: '2026-10-30', n: 3, last: '2026-10-29' } } }); t = await beat(p);
  ok(/has been put off three times/.test(t) && /Take it off the list/.test(t) && /Every other week instead/.test(t) && /Keep it/.test(t), '6 after three skips: take it off, less often, or keep it');
  await p.tap('.card.beat [data-act=beat-less]'); await p.waitForTimeout(300); st = await p.evaluate(() => window.__st);
  const id3 = k3.slice(4); ok(!st['home/rhythms'].weekly.some(x => x.id === id3) && st['home/rhythms'].every.some(x => x.id === id3 && x.every === 14), '7 “Every other week instead” turns it into an every-two-weeks job');
  p = await open({ ...up, 'home/beat': { [k3]: { until: '2026-10-30', n: 3, last: '2026-10-29' } } });
  await p.tap('.card.beat [data-act=beat-off]'); await p.waitForTimeout(300); st = await p.evaluate(() => window.__st);
  ok(!st['home/rhythms'].weekly.some(x => x.id === id3) && !(await beat(p)).includes('put off three times'), '8 “Take it off the list” removes it, kindly');

  // welcome back; low energy; survival; the month's notes; bigger house time brings this month's jobs
  p = await open(up, { seen: '2026-10-30' }); ok(/Welcome back\. Nothing piled up/.test(await beat(p)), '9 after days away: welcome back, nothing piled up');
  const big = { ...up, 'home/rhythms': { ...up['home/rhythms'], budget: { 'Alex': 45 } } };
  p = await open(big); t = await beat(p);
  ok(/If there’s room/.test(t) && /(Mikuláš|Clear gutters|Washing machine|Vacuum|Bathroom|toilet|Mop|towels|Duster|Getz|Cooker)/.test(t), '10 with more house time, a monthly, seasonal or every-few-days job joins as an extra');
  const low = JSON.parse(JSON.stringify(big)); low['days/2026-11-05'] = { mode: 'low', done: {} };
  p = await open(low); t = await beat(p); ok(/Optional today/.test(t) && !/If there’s room/.test(t), '11 low energy: 10 minutes, optional, no extras');
  const sv = JSON.parse(JSON.stringify(up)); sv['days/2026-11-07'] = { mode: 'survival', done: {} };
  p = await open(sv, { hash: 'rhythms', T: '2026-11-07T10:00:00' }); ok(/Survival mode/.test(await p.evaluate(() => document.querySelector('.rj-pane').innerText)), '12 survival mode keeps to the glass balls');
  p = await open(up, { T: '2027-04-02T10:00:00' }); ok(/Tick season starts/.test(await beat(p)), '13 the month’s notes show in its first week (tick season in April)');

  // restock day: the run, the supply check, Nákupy
  const cards = [{ id: 'ari:card/tp', name: 'Toaletní papír', url: 'https://trello.example/c/tp', list: { id: shopId, name: 'Nákupy' }, board: { id: 'ari:board/dom', name: 'Domácnost' }, complete: false }];
  p = await open(up, { T: '2026-11-08T10:00:00', cards }); t = await p.$eval('.card.restock', x => x.innerText).catch(() => '');
  ok(/more from today’s rhythm, if you feel like it/.test(await beat(p)), '13b Sunday’s many weekly jobs keep inside the house time; the rest fold away');
  await p.evaluate(() => document.querySelectorAll('.card.restock details').forEach(d => d.open = true)); t = await p.$eval('.card.restock', x => x.innerText).catch(() => '');
  ok(/Restock run/.test(t) && /Supply check/.test(t) && /Prací prostředek/.test(t) && /Podpalovač/.test(t) && !/Opalovací krém/.test(t), '14 Sunday: the restock run with a supply check (seasonal: kindling yes, sun cream not in November)');
  ok(await p.$eval('.card.restock .shopchip[data-text="Toaletní papír"]', x => x.classList.contains('on')), '15 what’s already on Nákupy shows ticked');
  await p.tap('.card.restock .supply .shopchip[data-text="Stelivo"]'); await p.waitForTimeout(500);
  ok(await p.evaluate(sid => window.__trCards.some(c => c.name === 'Stelivo' && c.list && c.list.id === sid), shopId), '16 tapping what’s running low puts it straight onto Nákupy');
  ok(await p.$eval('.card.restock .supply .shopchip[data-text="Stelivo"]', x => x.classList.contains('on')), '17 and it shows ticked at once');
  await p.tap('[data-act=rs-done]'); await p.waitForTimeout(250); st = await p.evaluate(() => window.__st);
  ok(Object.entries(st).some(([k, v]) => k.startsWith('weeks/') && v.done && v.done['rs:run']) && /Restocked/.test(await p.$eval('.card.restock', x => x.textContent)) && !!(await p.$('details.done-fold .card.restock')), '18 “That’s enough restocking” counts the run as done, and the finished card folds away');
  p = await open(up, { T: '2026-11-09T10:00:00' }); ok(!(await p.$('.card.restock')), '19 the next day the restock card is gone; nothing piles up');
  p = await open(up, { hash: 'rhythms' }); await p.tap('#sec-r-supplies .grp-h'); await p.waitForTimeout(200);
  ok(/Supply check/.test(await p.textContent('#sec-r-supplies')) && !!(await p.$('#sec-r-supplies .shopchip')), '20 the supply check is in Rhythms any day too');

  // the briefing names today's beat and the restock run
  p = await open(up, { T: '2026-11-08T08:30:00', brief: true });
  const bt = await p.evaluate(() => (document.querySelector('.brief-ov') || {}).innerText || '');
  ok(/Today’s beat:/.test(bt) && /Restock run today/.test(bt), '21 the morning briefing mentions today’s beat and the restock run');
  // a reset ends with what livable means in that room
  p = await open(up, { hash: 'focus' }); await p.tap('[data-act=hm-open]'); await p.tap('.floorpick .pill:has-text("Playroom")'); await p.tap('[data-act=hm-way][data-v=reset]'); await p.tap('[data-act=hm-start]'); await p.waitForTimeout(150);
  for (let i = 0; i < 5; i++) { await p.tap('[data-act=hm-next]'); await p.waitForTimeout(120); }
  ok(/What livable means here/.test(await p.textContent('#app')) && /Toys into bins/.test(await p.textContent('#app')), '22 a room reset ends with that room’s livable list, all optional');
  await p.screenshot({ path: __dirname + '/shots/beat.png' });
  console.log(errs.length ? errs.join('\n') : 'NO PAGE ERRORS'); await b.close();
})();
