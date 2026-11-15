// Swiping: tick a checklist row, a task done (right) or to tomorrow (left), screens left/right in tab order,
// the calendar's weeks, back to Support from a tool, a sheet down to close, and nothing while typing.
const { chromium, devices } = require('playwright'), fs = require('fs'), path = require('path');
const APP = 'file://' + path.resolve(__dirname, '../index.html');
const fakedb = fs.readFileSync(__dirname + '/fakedb.js', 'utf8'), faketr = fs.readFileSync(__dirname + '/fake-trello.js', 'utf8');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ ...devices['Pixel 7'], timezoneId: 'Europe/Prague' });
  const seed = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8')); seed['home/household'].baseline = 1; /* without the our-days seeding (tested in our-days.test.js) */
  const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(`window.__SEED=${JSON.stringify(seed)};window.__TR_ME="a";window.__EXTRA_CARDS=[];`);
  await p.addInitScript(fakedb); await p.addInitScript(faketr);
  await p.addInitScript(() => { localStorage.setItem('afloat.me', 'Alex'); localStorage.setItem('afloat.brief', 'x'); localStorage.setItem('afloat.calview', 'week'); });
  await p.clock.install({ time: new Date('2026-11-03T15:00:00') });
  const cdp = await ctx.newCDPSession(p);
  const swipe = async (x, y, dx, dy, steps = 8) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * i / steps, y: y + dy * i / steps }] }); await p.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(450);
  };
  const box = async sel => { await p.evaluate(s => document.querySelector(s).scrollIntoView({ block: 'center' }), sel); await p.waitForTimeout(150); return p.locator(sel).first().boundingBox(); };
  const shut = async () => { if (await p.$('[data-act=brief-close]')) { await p.tap('[data-act=brief-close]'); await p.waitForTimeout(150); } };
  await p.goto(APP + '#today'); await p.waitForTimeout(1500); await shut();
  // a checklist row
  const sel = '#app section.card:not(.remind) li[data-sw-r=".check"]'; /* a reminder disappears once ticked, so test a list that stays */
  let bx = await box(sel), before = await p.getAttribute(sel + ' .check', 'aria-pressed');
  await swipe(bx.x + 20, bx.y + bx.height / 2, 220, 4);
  ok(await p.getAttribute(sel + ' .check', 'aria-pressed') !== before, '1 swiping a checklist row right ticks it');
  await swipe(bx.x + 20, bx.y + bx.height / 2, 30, 2);
  ok(await p.evaluate(() => location.hash) === '#today', '2 a short drag does nothing');
  // a row that only swipes right lets a left swipe change screens
  bx = await box(sel); await swipe(bx.x + bx.width - 30, bx.y + bx.height / 2, -220, 4);
  ok(await p.evaluate(() => location.hash) === '#tasks', '2b swiping left over a checklist row still goes on to Tasks');
  await p.evaluate(() => { location.hash = 'today'; }); await p.waitForTimeout(500);
  // the tab bar jumps whole tabs
  bx = await box('nav.tabs'); await swipe(330, bx.y + bx.height / 2, -200, 6);
  ok(await p.evaluate(() => location.hash) === '#calendar', '2c swiping along the tab bar jumps from Today to Plan (Calendar is its first tab)');
  bx = await box('nav.tabs'); await swipe(60, bx.y + bx.height / 2, 200, 6);
  ok(await p.evaluate(() => location.hash) === '#today', '2d and back to Today');
  bx = await box('.hero');
  await swipe(300, bx.y + 20, -220, 6);
  ok(await p.evaluate(() => location.hash) === '#tasks', '3 swiping left on Today goes to Tasks');
  await p.waitForTimeout(1200);
  // tasks
  const tr = '#app li.trow';
  bx = await box(tr); const n0 = await p.textContent(tr + ' .txt');
  await swipe(bx.x + bx.width - 30, bx.y + bx.height / 2, -230, 4);
  let log = await p.evaluate(() => (window.__trLog || []).filter(x => /Write/.test(x[0])).map(x => x[1]));
  const upd = log.find(a => a.action === 'update' && a.due);
  ok(upd && new Date(upd.due).getDate() === 4, '4 swiping a task left moves it to tomorrow: ' + n0.slice(0, 30));
  bx = await box(tr);
  await swipe(bx.x + 20, bx.y + bx.height / 2, 230, 4);
  log = await p.evaluate(() => (window.__trLog || []).filter(x => /Write/.test(x[0])).map(x => x[1]));
  ok(log.some(a => a.action === 'mark_done'), '5 swiping a task right marks it done');
  bx = await box('.hero');
  await swipe(60, bx.y + 20, 220, 6);
  ok(await p.evaluate(() => location.hash) === '#today', '6 swiping right goes back to Today');
  // calendar weeks
  await p.evaluate(() => { location.hash = 'calendar'; }); await p.waitForTimeout(800); await shut();
  const lab0 = await p.textContent('.callabel');
  bx = await box('.calbody');
  await swipe(bx.x + bx.width - 40, bx.y + 60, -220, 6);
  ok(await p.textContent('.callabel') !== lab0 && await p.evaluate(() => location.hash) === '#calendar', '7 swiping the calendar shows the next week, not another screen: ' + lab0 + ' → ' + await p.textContent('.callabel'));
  const day0 = await p.textContent('.dayp h2');
  bx = await box('.dayp'); await swipe(bx.x + bx.width - 30, bx.y + 30, -200, 6);
  const day1 = await p.textContent('.dayp h2');
  bx = await box('.dayp'); await swipe(bx.x + 30, bx.y + 30, 200, 6);
  ok(day1 !== day0 && await p.textContent('.dayp h2') === day0, '7b the day panel swipes to the next day and back: ' + day0 + ' → ' + day1);
  bx = await box('.calbody'); await swipe(bx.x + 30, bx.y + 60, 220, 6);
  ok(await p.textContent('.callabel') === lab0, '7c and the calendar swipes back a week');
  // support tools
  await p.evaluate(() => { location.hash = 'breathe'; }); await p.waitForTimeout(600);
  bx = await box('.hero'); await swipe(60, bx.y + 20, 220, 6);
  ok(await p.evaluate(() => location.hash) === '#support', '8 on a Support tool, swiping right goes back to Support');
  await p.evaluate(() => { location.hash = 'breathe'; }); await p.waitForTimeout(500);
  await p.tap('[data-act=sp-gr][data-i="0"]'); await p.waitForTimeout(200);
  let gb = await box('[data-act=sp-gr][data-i="1"]'); await swipe(gb.x + 200, gb.y - 40, -200, 6);
  ok(/4 things you can feel/.test(await p.textContent('#app')), '8b five senses: swipe left for the next one');
  gb = await box('[data-act=sp-gr][data-i="2"]'); await swipe(gb.x + 20, gb.y - 40, 200, 6);
  ok(/Name 5 things/.test(await p.textContent('#app')) && await p.evaluate(() => location.hash) === '#breathe', '8c and right to go back, without leaving Breathe');
  await p.evaluate(() => { location.hash = 'priorities'; }); await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelector('[data-act=prev][data-m=full]').click()); await p.waitForTimeout(200);
  let pb = await box('.legend'); await swipe(pb.x + pb.width - 30, pb.y, -200, 6);
  const on1 = await p.evaluate(() => document.querySelector('[data-act=prev].on').dataset.m);
  pb = await box('.legend'); await swipe(pb.x + 30, pb.y, 200, 6);
  ok(on1 === 'low' && await p.evaluate(() => document.querySelector('[data-act=prev].on').dataset.m) === 'full', '8d Priorities: swipe the preview from Full to Running low and back');
  await p.evaluate(() => { location.hash = 'focus'; }); await p.waitForTimeout(400);
  await p.tap('[data-act=hm-open]'); await p.tap('[data-act=hm-way][data-v=reset]'); await p.tap('[data-act=hm-start]'); await p.waitForTimeout(300);
  pb = await box('.stepcard'); await swipe(pb.x + pb.width - 30, pb.y + 60, -200, 6);
  ok(/step 2 of 5/.test(await p.textContent('#app')), '8e Room reset: swipe a step left when it’s done');
  await p.evaluate(() => { location.hash = 'support'; }); await p.waitForTimeout(400);
  // a sheet
  await p.evaluate(() => document.querySelector('[data-act=settings]').click()); await p.waitForTimeout(400);
  ok(!!(await p.$('#sheet .sheet')), '9a the household sheet is open');
  bx = await box('#sheet .sheet h2, #sheet .sheet h3');
  await p.evaluate(() => { const s = document.querySelector('#sheet .sheet'); s.scrollTop = 0; });
  await swipe(200, bx.y + 5, 0, 240, 8);
  ok(!(await p.$('#sheet .sheet')), '9 swiping a sheet down from the top closes it');
  // typing
  await p.evaluate(() => { location.hash = 'breakdown'; }); await p.waitForTimeout(500);
  bx = await box('#bdTask'); await swipe(bx.x + 40, bx.y + bx.height / 2, 220, 6);
  ok(await p.evaluate(() => location.hash) === '#breakdown', '10 a swipe that starts in a text field does nothing');
  console.log(errs.length ? errs.join('\n') : 'NO PAGE ERRORS'); await b.close();
})();
