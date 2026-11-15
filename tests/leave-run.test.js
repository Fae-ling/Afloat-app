// "Leaving soon" (9 Nov 2026): in the last 45 minutes before you leave for an outing (here Monday's drop-off, leave 07:40),
// the outing moves to the very top of Today with a live countdown, a bar, one gentle line for where you are, the small
// steps and the take-along list. Not before the lead, never twice, and the lead is 30, 45 or 60 minutes in Settings.
const { chromium, devices } = require('playwright'), fs = require('fs'), path = require('path');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ ...devices['iPhone 13'] }), errs = [];
  const open = async (T, { who = 'Alex', extraHome = {}, calm = true } = {}) => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    const sd = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8')); sd['home/situation'] = {}; Object.assign(sd, extraHome);
    await p.addInitScript(`window.__SEED=${JSON.stringify(sd)};${calm ? 'window.__CALM=1;' : ''}`); await p.addInitScript(fs.readFileSync(__dirname + '/fakedb.js', 'utf8'));
    await p.addInitScript(n => { localStorage.setItem('afloat.me', n); localStorage.setItem('afloat.brief', 'x'); }, who);
    await p.clock.install({ time: new Date(T) }); await p.goto('file://' + path.resolve(__dirname, '../index.html') + '#today'); await p.waitForTimeout(1500);
    if (await p.$('[data-act=brief-close]')) { await p.tap('[data-act=brief-close]'); await p.waitForTimeout(200); } return p; };
  const first = p => p.evaluate(() => { const c = document.querySelector('#app > .card, #app > section.card'); return c ? c.className : ''; });

  // 07:20: 20 minutes before the 07:40 drop-off, inside the 45-minute window
  let p = await open('2026-11-09T07:20:00');
  ok(await p.$('#app .card.leave-run'), '1 the drop-off sits on top of Today as a “leaving soon” card');
  ok(/leave-run/.test(await first(p)), '2 and it is the first card, above everything else');
  let t = await p.$eval('.card.leave-run', x => x.innerText);
  ok(/leaving soon/i.test(t) && /until you leave at 07:40/.test(t), '3 it says it is leaving soon and when');
  ok(/Getting out of the door/.test(t) && /Shoes and jackets on/.test(t) && /Next small step: Toilet for everyone/.test(t), '4 the small steps are there, with the next one named');
  ok(/Halfway/.test(t), '5 one gentle line for where you are in the run-up (20 of 45 minutes left)');
  ok(/Keys/.test(t) || /Phone/.test(t), '6 what to take is in the same card');
  const c0 = await p.$eval('.lr-count', x => x.textContent);
  await p.clock.runFor(5000); const c1 = await p.$eval('.lr-count', x => x.textContent);
  ok(/^\d+:\d\d$/.test(c0) && c0 !== c1, `7 the countdown moves every second without a redraw (${c0} → ${c1})`);
  ok(!(await p.$('.now-thing')), '8 no second “leave” card from the calm Today under it');
  const dup = await p.evaluate(() => [...document.querySelectorAll('.card.outing')].filter(x => /Drop-off/.test(x.textContent)).length);
  ok(dup === 1, '9 the drop-off appears once on Today, not again under Going out');
  // ticking a step still works
  await p.tap('.card.leave-run .ready .check'); await p.waitForTimeout(300);
  ok(/Next small step: Shoes and jackets on/.test(await p.$eval('.card.leave-run', x => x.innerText)), '10 ticking a step moves on to the next small step');

  // 06:50: 50 minutes before, outside the window
  p = await open('2026-11-09T06:50:00');
  ok(!(await p.$('.card.leave-run')), '11 not before the 45 minutes: nothing is on top yet');

  // 07:36: nearly time
  p = await open('2026-11-09T07:36:00'); t = await p.$eval('.card.leave-run', x => x.innerText).catch(() => '');
  ok(/Almost go time/.test(t), '12 in the last five minutes the line is about phone, keys and out of the door');

  // 07:00 with a 30-minute lead: not yet; 07:15: yes
  const P = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8'))['home/people'] || {};
  P.people = P.people || {}; P.people['Alex'] = { ...(P.people['Alex'] || {}), runLead: 30 };
  p = await open('2026-11-09T07:00:00', { extraHome: { 'home/people': P } });
  ok(!(await p.$('.card.leave-run')), '13 with a 30-minute lead, 07:00 is still too early');
  p = await open('2026-11-09T07:15:00', { extraHome: { 'home/people': P } });
  ok(!!(await p.$('.card.leave-run')), '14 and 07:15 is inside it');

  // Sam on his way to work is not an outing: nothing on top
  p = await open('2026-11-09T05:10:00', { who: 'Sam' });
  ok(!(await p.$('.card.leave-run')), '15 the commute is not an outing, so no leaving-soon card for it');

  // 10 Nov 2026: the countdown, the line above it and the bar agree; the bar fills toward "go"
  p = await open('2026-11-09T07:34:57');
  t = await p.$eval('.card.leave-run', x => x.innerText);
  ok(/\b5:0\d\b|\b4:5\d\b/.test(t) && !/Leave in \d+ min/.test(t), '16 at 07:34:57 it counts about 5 minutes and no longer has a rounded “Leave in 6 min” beside it');
  const w1 = await p.$eval('.lr-strip i', x => parseFloat(x.style.width)), ph1 = await p.$eval('.lr-strip', x => x.dataset.ph);
  ok(w1 > 85 && w1 < 95 && ph1 === 'soon', `17 the bar is nearly full (${w1}%) and amber (soon) with five minutes left`);
  await p.clock.runFor(60000); const w2 = await p.$eval('.lr-strip i', x => parseFloat(x.style.width));
  ok(w2 > w1, `18 a minute later the bar has filled further (${w1}% → ${w2}%)`);
  await p.clock.runFor(5 * 60000); t = await p.$eval('.card.leave-run', x => x.innerText).catch(() => '');
  ok(/Go/.test(t) && /past 07:40/.test(t) && !/Leave in/.test(t), '19 a little late: it says Go and how far past, gently');
  // 07:20: tick the step list is covered above; “on our way” folds the card away
  p = await open('2026-11-09T07:30:00');
  await p.tap('.card.leave-run [data-act=go-leaving]'); await p.waitForTimeout(400);
  ok(!(await p.$('.card.leave-run')), '20 “We’re on our way” folds the leaving-soon card away');
  ok(!(await p.$$eval('.card.outing', xs => xs.some(x => /Drop-off/.test(x.textContent)))), '21 and the drop-off does not come back under Going out');

  console.log(errs.length ? errs.join('\n') : 'NO PAGE ERRORS'); await b.close();
})();
