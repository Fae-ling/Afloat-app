// Us → Trips: weekend ideas in three kinds (morning home for the nap, afternoon after it, a full day) plus an indoor plan B;
// Claude's ideas by default, told about the weekend's forecast and calendar; the same picks on both phones; "Plan it" opens
// an outing for all four of you with times that fit the nap and remembers the drive; the Thursday-evening nudge.
const { chromium, devices } = require('playwright'), fs = require('fs'), path = require('path');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ ...devices['iPhone 13'] }), errs = [];
  const base = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8')); base['home/situation'] = {}; base['home/household'].baseline = 1;
  const fx = rainSat => { const f = { latitude: 50, longitude: 14, hourly: { time: [], temperature_2m: [], apparent_temperature: [], precipitation_probability: [], precipitation: [], weather_code: [], wind_speed_10m: [] } };
    for (const d of ['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16']) for (let h = 0; h < 24; h++) { const wet = rainSat && d === '2026-11-14'; f.hourly.time.push(`${d}T${String(h).padStart(2, '0')}:00`); f.hourly.temperature_2m.push(7); f.hourly.apparent_temperature.push(4); f.hourly.precipitation_probability.push(wet ? 80 : 10); f.hourly.precipitation.push(wet ? 1 : 0); f.hourly.weather_code.push(wet ? 63 : 2); f.hourly.wind_speed_10m.push(10); }
    return f; };
  const idea = (n, d) => ({ name: n, place: n + ', Praha', drive: d, what: 'Something nice for ' + n, indoor: false, food: 'Café and toilets', cost: 'free' });
  const open = async (who, st, { hash = 'trips', T = '2026-11-12T19:30:00', claude = true, rain = false, brief = false } = {}) => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.route('https://geocoding-api.open-meteo.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ results: [{ name: 'Praha', latitude: 50.08, longitude: 14.43 }] }) }));
    await p.route('https://api.open-meteo.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(fx(rain)) }));
    await p.addInitScript(`window.__SEED=${JSON.stringify(st)};window.__TR_ME="a";window.__EXTRA_CARDS=[];`);
    await p.addInitScript(fs.readFileSync(__dirname + '/fakedb.js', 'utf8')); await p.addInitScript(fs.readFileSync(__dirname + '/fake-trello.js', 'utf8'));
    await p.addInitScript(n => { localStorage.setItem('afloat.me', n); localStorage.setItem('afloat.brief', 'x'); }, who);
    if (brief) await p.addInitScript(() => localStorage.removeItem('afloat.brief'));
    if (claude) await p.addInitScript(() => { window.__prompts = []; window.__SAMPLE = input => { const t = String(typeof input === 'string' ? input : JSON.stringify(input)); window.__prompts.push(t);
      return { morning: [{ name: 'Ekofarma U Lesa', place: 'Mukařov', drive: 15, what: 'Feed the goats', indoor: false, food: 'Toilets; farm shop', cost: 'small fee' }, { name: 'Lesní hřiště', place: 'Riverton', drive: 10, what: 'Forest playground', indoor: false, food: 'Bring snacks', cost: 'free' }],
        afternoon: [{ name: 'Zoo Praha', place: 'Zoo Praha, Troja', drive: 40, what: 'The children’s zoo', indoor: false, food: 'Everywhere', cost: 'entry fee' }, { name: 'Petřín', place: 'Petřín', drive: 40, what: 'Mirror maze', indoor: false, food: 'Kiosks', cost: 'small fees' }, { name: 'Stromovka', place: 'Stromovka', drive: 40, what: 'Ducks and playgrounds', indoor: false, food: 'Café', cost: 'free' }],
        day: [{ name: 'Konopiště', place: 'Benešov', drive: 40, what: 'Castle park', indoor: false, food: 'Restaurants', cost: 'free' }], rain: [{ name: 'Muzeum hraček', place: 'Praha', drive: 40, what: 'Old toys', indoor: true, food: 'Café nearby', cost: 'small fee' }],
        why: 'A dry, chilly weekend suits short walks.' }; }; });
    await p.clock.install({ time: new Date(T) }); await p.goto('file://' + path.resolve(__dirname, '../index.html') + '#' + hash); await p.waitForTimeout(2800);
    if (!brief && await p.$('[data-act=brief-close]')) { await p.tap('[data-act=brief-close]'); await p.waitForTimeout(150); } return p; };
  const names = p => p.$$eval('.ideas .idea b', a => a.map(x => x.textContent));
  const txt = p => p.textContent('#app');

  let p = await open('Alex', base), n = await names(p), t = await txt(p), pr = await p.evaluate(() => (window.__prompts || []).join('\n'));
  ok(/Trips/.test(t) && n.includes('Ekofarma U Lesa') && n.includes('Zoo Praha') && n.includes('Konopiště'), '1 on Thursday, Trips has Claude’s ideas by default: ' + n.join(', '));
  ok(/Sunnyfield/.test(pr) && /Saturday,? 14 November/.test(pr) && /Sunday,? 15 November/.test(pr) && /forecast 7–7 °C/.test(pr) && /11:30/.test(pr), '2 Claude is told where you live, the weekend days, their forecast and the nap');
  ok(/Morning, home for the nap/.test(t) && /Afternoon, after the nap/.test(t) && /A full day/.test(t) && /dry, chilly weekend/.test(t), '3 three kinds of trip, with a line on why');
  ok(await p.evaluate(() => { const d = [...document.querySelectorAll('.ideas details')].find(x => /Plan B indoors/.test(x.textContent)); return !!d && !d.open; }), '4 on a dry weekend plan B indoors waits, folded');
  ok(/~15 min/.test(t) && /Toilets; farm shop/.test(t), '5 each idea says how far, the cost and food and toilets');

  await p.tap('[data-act=trip-next][data-c=after]'); await p.waitForTimeout(200); n = await names(p);
  ok(n.includes('Stromovka') && !n.includes('Zoo Praha'), '6 “Other ideas” moves along the list');
  await p.tap('[data-act=trip-fav][data-id]'); await p.waitForTimeout(150);
  let st = await p.evaluate(() => window.__st);
  ok((st['home/trips'].fav || []).length === 1, '7 Keep is saved');

  const id = await p.getAttribute('[data-act=trip-plan][data-k="2026-11-14"]', 'data-id');
  await p.tap(`[data-act=trip-plan][data-id="${id}"][data-k="2026-11-14"]`); await p.waitForTimeout(400);
  const v = sel => p.$eval(sel, x => x.value).catch(() => '');
  const ev = { hash: await p.evaluate(() => location.hash), title: await v('#evTitle'), date: await v('#evDate'), start: await v('#evStart'), end: await v('[data-evf=end]'), place: await v('[data-evf=place]') };
  await p.$eval('#evTitle', x => x.closest('form').requestSubmit()); await p.waitForTimeout(400);
  st = await p.evaluate(() => window.__st); const saved = Object.entries(st).find(([k, x]) => k.startsWith('events/') && x.title === 'Ekofarma U Lesa'); const sv = saved ? saved[1] : {};
  ok(ev.hash === '#calendar' && sv.kind === 'outing' && sv.date === '2026-11-14' && ['Alex', 'Sam', 'Mia', 'Zoe'].every(x => (sv.who || []).includes(x)), '8 Plan it opens the event form: an outing on Saturday for all four of you');
  ok(ev.title === 'Ekofarma U Lesa' && ev.start === '09:00' && ev.end === '11:15' && ev.place === 'Mukařov', '9 a morning trip is timed to be home by 11:30 for the nap: ' + JSON.stringify(ev));
  ok(st['home/kits'] && st['home/kits'].travel && st['home/kits'].travel['mukarov'] === 15, '10 the drive is remembered, so the leave time is right');

  p = await open('Sam', { ...base, 'home/trips': st['home/trips'] }); n = await names(p);
  ok(n.includes('Ekofarma U Lesa') && (await p.evaluate(() => window.__prompts.length)) === 0, '11 Sam sees the same ideas, without asking Claude again');

  // the nudge on Thursday evening, and not when the girls are away all weekend or a trip is already planned
  const brief = async (sd, T) => { const q = await open('Alex', sd, { hash: 'today', T, claude: false, brief: true }); const x = await q.evaluate(() => document.body.innerText); return x; };
  ok(/fancy a family trip/.test(await brief(base, '2026-11-12T19:30:00')), '12 Thursday evening: a nudge to plan the weekend');
  ok(!/fancy a family trip/.test(await brief(base, '2026-11-12T08:30:00')), '13 not in the morning');
  const away = JSON.parse(JSON.stringify(base)); away['events/gp1'] = { title: 'Holky u babi', kind: 'grandma', gpGId: 'gpx', who: ['Mia', 'Zoe'], date: '2026-11-14', endDate: '2026-11-15', allDay: true, at: 1 };
  p = await open('Alex', away, { claude: false });
  ok(!/fancy a family trip/.test(await brief(away, '2026-11-12T19:30:00')) && /No family trip needed/.test(await txt(p)), '14 girls at the grandparents all weekend: no nudge, no trip needed');
  const planned = JSON.parse(JSON.stringify(base)); planned['events/tr1'] = { title: 'Zoo', kind: 'outing', who: ['Alex', 'Sam', 'Mia', 'Zoe'], date: '2026-11-15', endDate: '2026-11-15', start: '14:40', end: '17:00', place: 'Zoo Praha', at: 1 };
  p = await open('Alex', planned, { claude: false });
  ok(!/fancy a family trip/.test(await brief(planned, '2026-11-12T19:30:00')) && /Planned: Zoo 14:40/.test(await txt(p)), '15 a trip already planned: no nudge, and it shows on the weekend card');

  // rain on Saturday: plan B first; without Claude, built-in ideas in season (no Mirakulum in November)
  p = await open('Alex', base, { claude: false, rain: true }); n = await names(p);
  const firstH = await p.$eval('.ideas h2', x => x.textContent);
  ok(firstH === 'Plan B indoors' && n.includes('Fata Morgana glasshouse'), '16 rain on Saturday: plan B indoors comes first');
  ok(n.includes('Toulcův dvůr') && !n.includes('Mirakulum'), '17 without Claude, built-in ideas, only those in season');
  await p.evaluate(() => document.querySelectorAll('#app details').forEach(d => d.open = true));
  await p.fill('form[data-form=trip-add] input[name=text]', 'Rybník Jureček'); await p.fill('form[data-form=trip-add] input[name=place]', 'Riverton'); await p.fill('form[data-form=trip-add] input[name=min]', '10');
  await p.selectOption('form[data-form=trip-add] select', 'after'); await p.tap('form[data-form=trip-add] button'); await p.waitForTimeout(250);
  st = await p.evaluate(() => window.__st);
  ok((st['home/trips'].own || []).some(x => x.name === 'Rybník Jureček' && x.cat === 'after' && x.drive === 10), '18 your own idea is saved');
  n = await names(p); ok(n.includes('Rybník Jureček'), '19 and offered with the afternoon ideas');
  await p.tap('[data-act=trip-did]'); await p.waitForTimeout(200); st = await p.evaluate(() => window.__st);
  ok(Object.keys(st['home/trips'].did || {}).length === 1, '20 “We did this” is remembered (and drops out for a while)');
  await p.screenshot({ path: __dirname + '/shots/trips.png', fullPage: true });
  console.log(errs.length ? errs.join('\n') : 'NO PAGE ERRORS'); await b.close();
})();
