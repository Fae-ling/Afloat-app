// Closing duties only show when you're home: if you're tagged on an event that's happening and its place isn't explicitly
// "home", "online" or our own address (or it has none), they stay away. And a hlídání event (girls with grandparents or a
// sitter, no adult on it) no longer sits under "Now" once it has started.
const { chromium, devices } = require('playwright'), fs = require('fs'), path = require('path');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ ...devices['iPhone 13'], timezoneId: 'Europe/Prague' }), errs = [];
  const open = async (who, T, evs) => {
    const sd = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8')); sd['home/situation'] = {}; sd['home/household'].baseline = 2;
    for (const k of Object.keys(sd)) if (k.startsWith('events/')) delete sd[k];
    evs.forEach((e, i) => sd['events/t' + i] = { title: 'x', kind: 'family', who: [], date: T.slice(0, 10), endDate: T.slice(0, 10), allDay: false, place: '', notes: '', at: 1, ...e });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(`window.__SEED=${JSON.stringify(sd)};`); await p.addInitScript(fs.readFileSync(__dirname + '/fakedb.js', 'utf8'));
    await p.addInitScript(([n, k]) => { localStorage.setItem('afloat.me', n); localStorage.setItem('afloat.brief', k); }, [who, T.slice(0, 10) + 'evening']);
    await p.clock.install({ time: new Date(T) }); await p.goto('file://' + path.resolve(__dirname, '../index.html') + '#today'); await p.waitForTimeout(1300); return p; };
  const txt = p => p.textContent('#app');
  const T = '2026-11-14T18:40:00'; /* Saturday: bedtime 18:45, closing duties from 18:30 */
  let p = await open('Alex', T, []);
  ok(/One at a time|Closing duties/.test(await txt(p)), '1 baseline: at home at 18:40, closing duties show');
  p = await open('Alex', T, [{ title: 'Focení', who: ['Alex'], start: '18:00', end: '21:00', place: 'Studio Karlín' }]);
  ok(!/One at a time/.test(await txt(p)) && !/Closing duties/.test(await txt(p).then(t => t.replace(/Closing duties \(\d+, about[^.]*\./, ''))), '2 tagged on an event at another place: no closing duties');
  p = await open('Alex', T, [{ title: 'Focení', who: ['Alex'], start: '18:00', end: '21:00', place: '' }]);
  ok(!/One at a time/.test(await txt(p)), '3 tagged on an event with no place: no closing duties');
  p = await open('Alex', T, [{ title: 'Schůzka', who: ['Alex'], start: '18:00', end: '21:00', place: 'Online' }]);
  ok(/Closing duties/.test(await txt(p)), '4 tagged on an online event: closing duties still show');
  p = await open('Alex', T, [{ title: 'Schůzka', who: ['Alex'], start: '18:00', end: '21:00', place: 'Meadow Lane 12, Sunnyfield, 251 01' }]);
  ok(/Closing duties/.test(await txt(p)), '5 tagged on an event at our address: closing duties still show');
  p = await open('Alex', '2026-11-14T15:00:00', [{ title: 'HLIDANI Zahrady (POTVRZENO)', kind: 'grandma', gpGId: 'gpx', who: ['Mia', 'Zoe'], start: '14:00', end: '23:59', place: 'Zahrady' }]);
  ok(!/HLIDANI Zahrady/.test(await p.evaluate(() => [...document.querySelectorAll('.bf-next, .now-thing')].map(x => x.textContent).join(' | '))), '6 a hlídání event that has started is not under “Now”');
  p = await open('Alex', '2026-11-14T15:00:00', [{ title: 'Sam only', who: ['Sam'], start: '14:00', end: '17:00', place: 'Praha' }, { title: 'Mine focení', who: ['Alex'], start: '14:30', end: '17:00', place: 'Studio' }]);
  const nowTxt = await p.evaluate(() => [...document.querySelectorAll('.bf-next, .now-thing')].map(x => x.textContent).join(' | '));
  ok(/Mine focení/.test(nowTxt) && !/Sam only/.test(nowTxt), '7 Now shows the event you are tagged on, not one that only names someone else: ' + nowTxt.slice(0, 80));
  console.log(errs.length ? errs.join('\n') : 'NO PAGE ERRORS'); await b.close();
})();
