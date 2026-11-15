// Trips for a household without children: a morning, an afternoon and a whole-day trip (no nap, no plan B group, no kid wording),
// a first question about the trips you enjoy that Claude then reads, no built-in kid ideas, a nudge without "family", and Plan it for the adults only.
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

  const adults = JSON.parse(JSON.stringify(base)); adults['home/household'].kids = []; delete adults['home/household'].nap;
  const taste = { ...adults, 'home/trips': { taste: 'Quiet nature and small towns. We go by train, two hours at most.' } };

  let p = await open('Alex', adults, { claude: true }), t = await txt(p);
  ok(/What kind of trips do you enjoy/.test(t) && !(await p.$('.ideas')) && (await p.evaluate(() => window.__prompts.length)) === 0, '1 no children: Trips first asks what kind of trips you enjoy, and Claude isn’t asked yet');
  ok(!/nap|girls|kids|children/i.test(t.replace(/Alex|Sam/g, '')), '2 nothing about naps or children on the screen');
  await p.fill('form[data-form=trip-taste] textarea', 'Quiet nature, small towns, good coffee. Train only.'); await p.tap('form[data-form=trip-taste] button'); await p.waitForTimeout(2500);
  let st = await p.evaluate(() => window.__st), n = await names(p), pr = await p.evaluate(() => (window.__prompts || []).join('\n')); t = await txt(p);
  ok(/Quiet nature, small towns, good coffee/.test(st['home/trips'].taste || ''), '3 what you wrote is saved');
  ok(/Quiet nature, small towns, good coffee. Train only/.test(pr) && /adults/.test(pr) && !/children|nap|toilets/i.test(pr.replace(/Not aimed at children|, no children/g, '')), '4 Claude is given your words and an adults-only brief: ' + pr.slice(0, 120).replace(/\n/g, ' '));
  ok(/A morning trip/.test(t) && /An afternoon trip/.test(t) && /A whole day trip/.test(t) && !/Plan B|nap/.test(t), '5 three kinds of trip, named for the time of day');
  ok(n.includes('Ekofarma U Lesa') && n.includes('Konopiště') && !n.includes('Toulcův dvůr') && !n.includes('Mirakulum'), '6 Claude’s ideas show, and none of the built-in children’s ones: ' + n.join(', '));

  const id = await p.getAttribute('[data-act=trip-plan][data-k="2026-11-14"]', 'data-id');
  await p.tap(`[data-act=trip-plan][data-id="${id}"][data-k="2026-11-14"]`); await p.waitForTimeout(400);
  const v = sel => p.$eval(sel, x => x.value).catch(() => '');
  const ev = { title: await v('#evTitle'), start: await v('#evStart'), end: await v('[data-evf=end]') };
  await p.$eval('#evTitle', x => x.closest('form').requestSubmit()); await p.waitForTimeout(400);
  st = await p.evaluate(() => window.__st); const saved = Object.entries(st).find(([k, x]) => k.startsWith('events/') && x.title === ev.title); const sv = saved ? saved[1] : {};
  ok(sv.kind === 'outing' && (sv.who || []).join() === 'Alex,Sam' && ev.start === '09:30' && ev.end === '12:30', '7 Plan it: a morning outing for the two of you, 09:30–12:30: ' + JSON.stringify(ev));

  // skip, and change it later
  p = await open('Alex', adults, { claude: false }); await p.tap('[data-act=trip-taste-skip]'); await p.waitForTimeout(250);
  ok(!/What kind of trips do you enjoy/.test(await txt(p)) && /What you enjoy \(not set\)/.test(await txt(p)), '8 “Skip for now” leaves it for later, still editable');
  p = await open('Alex', taste, { claude: false }); await p.evaluate(() => document.querySelectorAll('#app details').forEach(d => d.open = true));
  ok(await p.$eval('form[data-form=trip-taste] textarea', x => x.value) === 'Quiet nature and small towns. We go by train, two hours at most.', '9 what you wrote can be edited later');

  // the nudge, without "family"; without Claude and without ideas, an empty group says what to do
  const q = await open('Alex', taste, { hash: 'today', T: '2026-11-12T19:30:00', claude: false, brief: true }); const bt = await q.evaluate(() => document.body.innerText);
  ok(/fancy a trip\?/.test(bt) && !/family trip/.test(bt), '10 Thursday evening: “fancy a trip?”, not a family trip');
  p = await open('Alex', taste, { claude: false });
  ok(/Nothing left in this group/.test(await txt(p)) && !(await names(p)).length, '11 no Claude and nothing of your own: no children’s ideas, a line on what to do instead');

  // households with children are unchanged
  p = await open('Alex', base, { claude: false }); t = await txt(p);
  ok(/Morning, home for the nap/.test(t) && !/What kind of trips do you enjoy/.test(t), '12 with children: still the nap-sized trips, no question');
  console.log(errs.length ? errs.join('\n') : 'NO PAGE ERRORS'); await b.close();
})();
