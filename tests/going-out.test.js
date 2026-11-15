// Going out: an event with a place (Zubař with the girls) gets a card with when to leave, the weather there and then,
// and what to take (type kit, the girls' kit, weather); travel time and additions are remembered; ticks carry over
// from the evening before. Home reminders show only while you're home. Phone reminders are written for the server.
const { chromium, devices } = require('playwright'), fs = require('fs'), path = require('path');
const APP = 'file://' + path.resolve(__dirname, '../index.html');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const hours = (day0, n, f) => Array.from({ length: n }, (_, i) => f(i));
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ ...devices['Pixel 7'], timezoneId: 'Europe/Prague' });
  const seed = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8'));
  for (const k of Object.keys(seed)) if (k.startsWith('events/')) delete seed[k];
  seed['events/zub'] = { title: 'Zubař', kind: 'doctor', who: ['Alex', 'Mia', 'Zoe'], date: '2026-11-04', endDate: '2026-11-04', allDay: false, start: '08:15', end: '09:15', place: 'Example Street 14, 110 00 Praha 1, Česko', notes: '', at: 1 };
  seed['events/tm'] = { title: 'Swimming', kind: 'outing', who: ['Alex', 'Mia'], date: '2026-11-05', endDate: '2026-11-05', allDay: false, start: '10:00', end: '11:00', place: 'Šutka, Praha', notes: '', at: 1 };
  const times = []; for (let d = 4; d <= 6; d++) for (let h = 0; h < 24; h++) times.push(`2026-11-0${d}T${String(h).padStart(2, '0')}:00`);
  const fx = { hourly: { time: times, temperature_2m: times.map(() => 3), apparent_temperature: times.map(() => -1), precipitation_probability: times.map(t => +t.slice(11, 13) >= 7 && +t.slice(11, 13) <= 10 ? 70 : 10), precipitation: times.map(() => 0.4), weather_code: times.map(() => 61), wind_speed_10m: times.map(() => 12) } };
  const open = async (time, hash = '#today') => {
    const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
    await p.route('https://geocoding-api.open-meteo.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ results: [{ name: 'Praha', latitude: 50.08, longitude: 14.43 }] }) }));
    await p.route('https://api.open-meteo.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(fx) }));
    await p.addInitScript(`window.__SEED=${JSON.stringify(seed)};`);
    await p.addInitScript(fs.readFileSync(__dirname + '/fakedb.js', 'utf8'));
    await p.addInitScript(() => { window.claude.whoami = () => ({ uid: 'u1' }); localStorage.setItem('afloat.me', 'Alex'); localStorage.setItem('afloat.brief', 'x'); localStorage.setItem('afloat.push', '1'); });
    await p.clock.install({ time: new Date(time) });
    await p.goto(APP + hash); await p.waitForTimeout(1800);
    if (await p.$('[data-act=brief-close]')) { await p.tap('[data-act=brief-close]'); await p.waitForTimeout(200); }
    return p;
  };
  let p = await open('2026-11-04T07:00:00');
  const card = () => p.evaluate(() => { const c = document.querySelector('#app .outing'); return c ? c.textContent.replace(/\s+/g, ' ') : ''; });
  let t = await card();
  ok(/Zubař · 08:15/.test(t) && /Leave in 50 min, at 07:50/.test(t) && /with Mia and Zoe/.test(t), '1 Zubař with the girls shows when to leave (20 min guess + 5): ' + t.slice(0, 90));
  ok(/3 °C/.test(t) && /feels like -1/.test(t) && /light rain/.test(t) && /70% chance of rain/.test(t) && /in Praha/.test(t), '2 the weather for then and there');
  ok(/Raincoats for everyone/.test(t) && /Warm layers, hats and gloves/.test(t) && !/vaccination booklets|Health insurance cards/.test(t), '3 what to take: what the weather needs, and no standing kit for the kind of visit');
  ok(/Glasses/.test(t) && /Keys/.test(t) && !/Kindergarten bag/.test(t), '4 your own launch list is in it too (not the kindergarten bag on a dentist trip)');
  await p.evaluate(() => document.querySelector('[data-act=go-travel]').click()); await p.waitForTimeout(150);
  await p.evaluate(() => document.querySelector('[data-act=go-travel-set][data-m="30"]').click()); await p.waitForTimeout(400);
  ok(/at 07:40/.test(await card()) && /30 min to get there/.test(await card()), '5 setting the travel time moves the leave time and is remembered for this place');
  await p.evaluate(() => document.querySelector('[data-act=go-edit]').click()); await p.waitForTimeout(150);
  await p.fill('.go-add input[name=text]', 'Questions for the dentist'); await p.tap('.go-add button[type=submit]'); await p.waitForTimeout(400);
  ok(/Questions for the dentist/.test(await card()) && await p.evaluate(() => Object.values((window.__st['months/2026-11'] || {}).extra || {}).some(l => l.some(x => x.text === 'Questions for the dentist'))) && !(await p.$('.go-add select')), '6 an addition is for this visit only');
  const first = await p.evaluate(() => { const b = [...document.querySelectorAll('#app .outing .check')].find(x => x.dataset.store === 'month'); b.click(); return b.dataset.key; }); await p.waitForTimeout(300);
  ok(await p.evaluate(k => !!(window.__st['months/2026-11'] || {}).done[k], first), '7 a tick is saved for the month, so packing the evening before carries over');
  await p.waitForTimeout(3500);
  const nt = await p.evaluate(() => (window.__st['notify/u1'] || {}).items || []);
  const lv = nt.find(x => /Zubař/.test(x.title));
  ok(lv && /Leave at 07:40 for Zubař/.test(lv.title) && /Take: /.test(lv.body) && new Date(lv.at).getHours() === 7 && new Date(lv.at).getMinutes() === 25, '8 a phone reminder 15 minutes before leaving, with what’s still to take: ' + (lv ? lv.title + ' — ' + lv.body.slice(0, 60) : 'none'));
  await p.screenshot({ path: __dirname + '/shots/going-out.png', fullPage: true });
  // during the outing, home reminders are hidden; after it, they show
  await p.clock.setFixedTime(new Date('2026-11-04T08:30:00')); await p.evaluate(() => { location.hash = 'tasks'; }); await p.waitForTimeout(300); await p.evaluate(() => { location.hash = 'today'; }); await p.waitForTimeout(500);
  ok(!/Feed Pip/.test(await p.evaluate(() => (document.querySelector('#app .card.remind') || {}).textContent || '')), '9 while you’re out at the dentist, home-only reminders stay hidden');
  await p.clock.setFixedTime(new Date('2026-11-04T10:30:00')); await p.evaluate(() => { location.hash = 'tasks'; }); await p.waitForTimeout(300); await p.evaluate(() => { location.hash = 'today'; }); await p.waitForTimeout(500);
  t = await p.evaluate(() => (document.querySelector('#app .card.remind') || {}).textContent || '');
  const wed = await p.evaluate(() => ((window.__st['home/reminders'] || {}).list || []).filter(x => x.home).map(x => x.text + ':' + x.days.join('')).join(' | '));
  ok(/Feed Pip \(powdered diet\):135/.test(wed) && /Bins out for Monday morning:6/.test(wed) && !/plants/.test(wed), '10 reminders start with Pip (Tue/Thu/Sat) and the bins (Sunday evening), home-only, no plants: ' + wed);
  await p.close();
  // Thursday at home: Pip shows while home
  p = await open('2026-11-05T15:00:00');
  t = await p.evaluate(() => (document.querySelector('#app .card.remind') || {}).textContent || '');
  ok(/Reminders/.test(t) && /Feed Pip/.test(t) && !/Bins/.test(t), '11 on Thursday afternoon at home: Pip, not the bins');
  await p.evaluate(() => { location.hash = 'rhythms'; }); await p.waitForTimeout(500);
  ok(/Reminders/.test(await p.textContent('#app')) && !!(await p.$('[data-act=rem-day]')) && !!(await p.$('[data-act=rem-home]')), '12 Rhythms has one editor for all reminders: days, who, only while home');
  // the evening before: tomorrow's outing with tomorrow's weather
  await p.close(); p = await open('2026-11-04T19:30:00');
  t = await p.evaluate(() => [...document.querySelectorAll('#app .prep-out')].map(x => x.textContent.replace(/\s+/g, ' ')).join(' || '));
  ok(/Swimming · 10:00/.test(t) && /leave at/.test(t) && /The usual:.*Keys/.test(t) && /Anything else for this one\?/.test(t), '13 in the evening, tomorrow’s outing is a short prep: the usual in one line, and “anything else?”');
  ok(!(await p.$('#app .outing')), '14 the full lists wait until just before leaving');
  console.log([...p.errs].length ? p.errs.join('\n') : 'NO PAGE ERRORS'); await b.close();
})();
