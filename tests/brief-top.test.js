// The top card on Today follows what changes: a new event shows straight away, the weather is in it, the evening adds
// tomorrow; the KC Davis line only shows on Rhythms.
const { chromium, devices } = require('playwright'), fs = require('fs'), path = require('path');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ ...devices['iPhone 13'] }), errs = [];
  const sd = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8')); sd['home/situation'] = {}; sd['home/household'].baseline = 2;
  sd['events/t1'] = { title: 'Zubař', kind: 'doctor', who: ['Alex'], date: '2026-11-12', endDate: '2026-11-12', start: '09:00', end: '10:00', at: 1 };
  const fx = { latitude: 50, longitude: 14, hourly: { time: [], temperature_2m: [], apparent_temperature: [], precipitation_probability: [], precipitation: [], weather_code: [], wind_speed_10m: [] } };
  for (const d of ['2026-11-11', '2026-11-12']) for (let h = 0; h < 24; h++) { fx.hourly.time.push(`${d}T${String(h).padStart(2, '0')}:00`); fx.hourly.temperature_2m.push(6); fx.hourly.apparent_temperature.push(3); fx.hourly.precipitation_probability.push(10); fx.hourly.precipitation.push(0); fx.hourly.weather_code.push(1); fx.hourly.wind_speed_10m.push(10); }
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.route('https://geocoding-api.open-meteo.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ results: [{ name: 'Praha', latitude: 50.08, longitude: 14.43 }] }) }));
  await p.route('https://api.open-meteo.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(fx) }));
  await p.addInitScript(`window.__SEED=${JSON.stringify(sd)};`); await p.addInitScript(fs.readFileSync(__dirname + '/fakedb.js', 'utf8'));
  await p.addInitScript(() => { localStorage.setItem('afloat.me', 'Alex'); localStorage.setItem('afloat.brief', '2026-11-11evening'); });
  await p.clock.install({ time: new Date('2026-11-11T19:30:00') }); await p.goto('file://' + path.resolve(__dirname, '../index.html') + '#today'); await p.waitForTimeout(1500);
  const card = () => p.evaluate(() => (document.querySelector('#app .card.brief') || {}).textContent || '');
  let t = await card();
  ok(/Rest of the evening in Praha: 6–6 °C/.test(t), '1 the weather is in the top card');
  ok(/Tomorrow: 09:00 Zubař/.test(t) && /Tomorrow in Praha/.test(t), '2 in the evening it adds tomorrow, with tomorrow’s weather');
  await p.evaluate(() => { const st = window.__st; st['events/t2'] = { title: 'Divadlo', kind: 'other', who: ['Alex'], date: '2026-11-11', endDate: '2026-11-11', start: '20:30', end: '22:00', at: 2 }; });
  await p.evaluate(() => window.__fire());
  await p.waitForTimeout(400); await p.clock.runFor(61000); await p.waitForTimeout(400);
  ok(/Divadlo/.test(await card()), '3 an event added to the calendar shows up in it without reopening');
  ok(!(await p.isVisible('footer.credit')), '4 no KC Davis line on Today');
  await p.evaluate(() => { location.hash = 'rhythms'; }); await p.waitForTimeout(400);
  ok(await p.isVisible('footer.credit'), '5 it stays on Rhythms');
  console.log(errs.length ? errs.join('\n') : 'NO PAGE ERRORS'); await b.close();
})();
