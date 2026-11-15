// The baseline from the Home project doc claude/our-days.md: Today's setup that fits real days (out alone / with the girls,
// no "day off"), who goes to kindergarten, drop-off and pick-up as outings with their own kit, who does pick-up and bedtime
// from the calendar (Sam's overnight at Jo's), the afternoon dip, Sam coming home, the bedtime flow, timed reminders,
// the post-gig photo count, battery prep before a gig, Czech holidays and kindergarten prázdniny.
const { chromium, devices } = require('playwright'), fs = require('fs'), path = require('path');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ ...devices['iPhone 13'] }), errs = [];
  const open = async (T, who = 'Alex', hash = 'today', extra = {}) => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    const sd = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8')); sd['home/situation'] = {};
    sd['events/o1'] = { title: 'Jo', kind: 'other', who: ['Sam', 'Jo'], date: '2026-11-09', endDate: '2026-11-10', start: '17:30', end: '08:00', at: 1 };
    sd['events/o2'] = { title: 'Focení Novákovi', kind: 'work', who: ['Alex'], date: '2026-11-07', endDate: '2026-11-07', start: '10:00', end: '12:00', place: 'Stromovka, Praha', at: 1 };
    sd['events/o3'] = { title: 'Focení svatba', kind: 'work', who: ['Alex'], date: '2026-11-10', endDate: '2026-11-10', start: '13:00', end: '18:00', place: 'Průhonice', at: 1 };
    sd['events/o4'] = { title: 'Prázdniny ve školce', kind: 'kinder', who: ['Mia', 'Zoe'], date: '2026-11-12', endDate: '2026-11-12', allDay: true, at: 1 };
    Object.assign(sd, extra);
    await p.addInitScript(`window.__SEED=${JSON.stringify(sd)};`); await p.addInitScript(fs.readFileSync(__dirname + '/fakedb.js', 'utf8'));
    await p.addInitScript(n => { localStorage.setItem('afloat.me', n); }, who);
    await p.clock.install({ time: new Date(T) }); await p.goto('file://' + path.resolve(__dirname, '../index.html') + '#' + hash); await p.waitForTimeout(1300); return p; };
  const txt = p => p.evaluate(() => document.body.innerText);
  const close = async p => { if (await p.$('[data-act=brief-close]')) { await p.tap('[data-act=brief-close]'); await p.waitForTimeout(200); } };

  // Monday morning: kindergarten day, Sam stays at Jo's tonight
  let p = await open('2026-11-09T07:20:00'), t = await txt(p);
  ok(/Drop-off \(Mia, then Zoe\)/.test(t), '1 the drop-off is an outing: Mia first, then Zoe');
  ok(!/Zoe’s water bottle|Check the spare clothes|Winter overalls to kindergarten/.test(t), '2 no standing kindergarten kit any more: what’s needed is added per event, with Claude’s suggestions');
  ok(/Getting out of the door/.test(t) && /Shoes and jackets on/.test(t), '3 leaving with the girls gets small steps, started early');
  await p.screenshot({ path: __dirname + '/shots/ourdays-dropoff.png' });
  await close(p); t = await txt(p);
  ok(/Drop-off you/i.test(t) && /pick-up you/i.test(t) && /bedtime you/i.test(t), '4 Sam is away overnight, so the setup gives you drop-off, pick-up and bedtime');
  ok(/Sam is away overnight today, so pick-up and bedtime are yours/.test(t), '5 and the day’s facts say so');
  await p.tap('.situ-sum'); await p.waitForTimeout(200); t = await txt(p);
  ok(/Out with the girls/.test(t) && /Out alone/.test(t) && /Free without the girls/.test(t) && !/Day off/.test(t), '6 your options fit real days: out alone or with the girls, no “day off”');
  await p.screenshot({ path: __dirname + '/shots/ourdays-setup.png', fullPage: false });

  // 11:10: Zoe's lunch pick-up, and the morning tablet reminder
  p = await open('2026-11-09T11:10:00'); await close(p); t = await txt(p);
  ok(/Zoe’s pick-up/.test(t) && /(Leave in 15 min, at 11:25|until you leave at 11:25)/.test(t), '7 Zoe’s pick-up after lunch: leave at 11:25 for 11:45');
  ok(/Breakfast first, then vitamins/.test(t), '8 the 9:00 reminder shows until ticked');

  // 14:30 at home: the afternoon dip
  p = await open('2026-11-09T14:30:00'); await close(p); t = await txt(p);
  ok(/The afternoon dip/.test(t), '9 a gentle check-in in the afternoon dip');
  await p.tap('[data-act=dip][data-v=snack]'); await p.waitForTimeout(200);
  ok(/Afternoon dip: A snack/.test(await txt(p)), '10 picking one thing folds it away');
  ok(/After Focení Novákovi/.test(t), '11 after Saturday’s gig: how many photos?');
  await p.fill('[data-act=gig-n]', '1200'); await p.dispatchEvent('[data-act=gig-n]', 'change'); await p.waitForTimeout(200);
  ok(/About 12 h: culling ~2 h, editing and export ~10 h/.test(await txt(p)), '12 1200 photos → about 12 hours, split into sessions');

  // Monday evening: tomorrow's gig means batteries tonight; bedtime is yours
  p = await open('2026-11-09T18:40:00'); await close(p); t = await txt(p);
  ok(/Charge the spare camera batteries/.test(t) && /Format the SD cards/.test(t), '13 before a gig: charge batteries, format SD cards');
  ok(/Bedtime/.test(t) && /Lotion for Zoe/.test(t) && /Tomorrow’s weather, and lay out their clothes/.test(t), '14 the bedtime flow is yours while Sam’s away');

  // Wednesday: Sam home after work
  p = await open('2026-11-11T14:45:00'); await close(p); t = await txt(p);
  ok(/Sam is home around 15:15 with Mia/.test(t), '15 Sam coming home is named, 30 minutes ahead');
  p = await open('2026-11-11T18:40:00', 'Sam'); await close(p); t = await txt(p);
  ok(/Bedtime/.test(t) && /Večerníček at 18:45/.test(t), '16 on a normal evening Sam has bedtime');
  p = await open('2026-11-11T15:00:00', 'Sam'); await close(p); t = await txt(p);
  ok(/Pick-up \(Mia\)/.test(t) && /On your way home/.test(t) && /notice board/.test(t), '17 Sam’s pick-up on his way home, with the notice-board reminder');

  // one girl stays home
  p = await open('2026-11-11T07:00:00'); await close(p); await p.tap('.situ-sum'); await p.waitForTimeout(200);
  await p.tap('[data-act=situ-kid][data-v=Mia]'); await p.waitForTimeout(250); t = await txt(p);
  ok(/Mia stays home today; Zoe goes to kindergarten/.test(t) && /Drop-off \(Zoe\)/.test(t), '18 one girl stays home: drop-off is just Zoe');

  // special days
  p = await open('2026-11-12T08:00:00'); await close(p); t = await txt(p);
  ok(/Prázdniny ve školce: no kindergarten/.test(t) && !/Drop-off \(/.test(t), '19 kindergarten prázdniny in the calendar: no kindergarten, no drop-off');
  p = await open('2026-11-12T08:00:00', 'Alex', 'calendar');
  await close(p);
  const mv = await p.$('[data-act=cal-view][data-v=month]'); if (mv) { await mv.tap(); await p.waitForTimeout(200); }
  ok(await p.evaluate(() => !!document.querySelector('.mc.special[data-k="2026-11-17"]')), '20 Czech holidays are marked in the month view');
  console.log(errs.length ? errs.join('\n') : 'NO PAGE ERRORS'); await b.close();
})();
