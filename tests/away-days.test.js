// Today's setup knows when someone is away: tagged on a timed event that covers the day at a place that isn't "home",
// "online" or our own address (or has no place), the fixed-hours adult is "Away from home" rather than "Home, not working",
// even when the event began the day before (a date weekend). Workdays stay "At work".
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
  const date = (place, extra = {}) => ({ title: 'Date víkend', who: ['Sam', 'Jo'], date: '2026-11-13', endDate: '2026-11-15', start: '17:00', end: '20:00', place, ...extra });
  const txt = async p => (await p.textContent('#app')).replace(/\s+/g, ' ');
  const SAT = '2026-11-14T12:00:00', sam = t => (t.match(/Sam: [^.(]*/) || [''])[0].trim();
  let p = await open('Alex', SAT, []), t = await txt(p);
  ok(/Sam: Home, not working/.test(t), '1 no events: Sam is home, not working on a Saturday: ' + sam(t));
  p = await open('Alex', SAT, [date('')]); t = await txt(p);
  ok(/Sam: Away from home, overnight/.test(t) && !/Sam: Home, not working/.test(t), '2 date weekend with no place, begun yesterday: away, overnight: ' + sam(t));
  p = await open('Alex', SAT, [date('Praha, Smíchov')]); t = await txt(p);
  ok(/Sam: Away from home/.test(t), '3 at another address: away: ' + sam(t));
  p = await open('Alex', SAT, [date('Online')]); t = await txt(p);
  ok(/Sam: Home, not working/.test(t), '4 an online event keeps him home: ' + sam(t));
  p = await open('Alex', SAT, [date('Meadow Lane 12, Sunnyfield, 251 01')]); t = await txt(p);
  ok(/Sam: Home, not working/.test(t), '5 at our own address keeps him home: ' + sam(t));
  p = await open('Alex', '2026-11-15T12:00:00', [date('')]); t = await txt(p);
  ok(/Sam: Away from home, out in the evening/.test(t), '6 Sunday, event ends 20:00: away by day, out in the evening, not overnight: ' + sam(t));
  p = await open('Alex', '2026-11-16T12:00:00', [date('', { date: '2026-11-15', endDate: '2026-11-16', end: '08:00' })]); t = await txt(p);
  ok(/Sam: At work/.test(t), '7 Monday workday after a date: still At work: ' + sam(t));
  p = await open('Alex', SAT, [date('', { who: ['Jo'] })]); t = await txt(p);
  ok(/Sam: Home, not working/.test(t), '8 an event Sam isn’t on doesn’t move him: ' + sam(t));
  p = await open('Alex', SAT, [date('', { date: '2026-11-14', endDate: '2026-11-14', start: '09:00', end: '11:00' })]); t = await txt(p);
  ok(/Sam: Home, not working/.test(t), '9 a short morning event doesn’t make a whole day away: ' + sam(t));
  p = await open('Sam', SAT, [date('')]); t = await txt(p);
  ok(/away from home today/i.test(t), '10 Today’s facts say so for Sam himself');
  console.log(errs.length ? errs.join('\n') : 'NO PAGE ERRORS'); await b.close();
})();
