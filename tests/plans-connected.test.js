// Plans connected (11 Nov 2026): live travel on journey legs (public transport delays, flight status, travel times), costs and who owes
// whom, reminders for single steps, and bookings read from an email. The travel server and Claude are pretended here
// (functions/test/travel.test.js tests the real server's reading of each service).
const { start, ok, done } = require('./helpers');
const init = () => {
  const TV = window.__TV = { calls: [], dep: null, flight: null, route: null };
  const base = window.claude.use;
  window.claude.use = async k => k !== 'travel' ? base(k) : { on: () => ({ golemio: true, maps: true, flights: true }), call: async (action, data) => {
    TV.calls.push([action, JSON.parse(JSON.stringify(data))]);
    if (action === 'departures') return TV.dep; if (action === 'flight') return TV.flight; if (action === 'route') return TV.route; return {}; } };
  window.__SAMPLE = () => ({ summary: 'Flight and hotel', legs: [{ label: 'Flight OK652 PRG→LIS', mode: 'flight', date: '2026-11-20', time: '06:45', from: 'Letiště Václava Havla', to: 'Lisbon', number: 'OK 652', ref: 'XK7P2Q' }],
    stays: [{ name: 'Casa Azul', address: 'Rua X 5, Lisboa', checkin: '2026-11-20', checkin_time: '15:00', checkout: '2026-11-23', checkout_time: '11:00', ref: 'B-991' }],
    steps: [{ text: 'Online check-in', due: '2026-11-19' }], pack: ['Passports', 'The card used to pay'] });
};
(async () => {
  const t = await start();
  const p = await t.open({ hash: 'plans', T: '2026-11-12T06:30:00', init });
  const id = await p.evaluate(() => { const q = pxCreate({ title: 'Brno day', kind: 'outing', start: '2026-11-12', time: '09:30', place: 'Brno' });
    pxSave(q.id, { legs: [{ id: 'g1', label: 'Train to Brno', date: '2026-11-12', time: '07:40', place: 'Praha hl.n.', mode: 'transit', stop: 'Praha hl.n.', line: 'R9', dep: '07:40', mins: 30, early: 10, leave: '07:00' }],
      backup: [{ id: 'b1', ifs: 'the train is cancelled', then: 'take the 08:15 RegioJet' }] }); return q.id; });
  // 1. public transport: delay on Today
  await p.evaluate(() => { window.__TV.dep = { found: true, stop: 'Praha hl.n.', list: [], match: { line: 'R9', to: 'Brno', planned: '07:40', real: '07:48', late: 8, cancelled: false, platform: '5' } }; });
  await t.go(p, 'today'); await p.waitForTimeout(500); await p.evaluate(() => render(true)); await p.waitForTimeout(200);
  let txt = await t.text(p);
  ok(/R9 07:40 is running 8 min late/.test(txt) && /platform 5/.test(txt), '1 a train leg today shows its live delay on Today');
  const dc = await p.evaluate(() => window.__TV.calls.find(c => c[0] === 'departures'));
  ok(dc && dc[1].stop === 'Praha hl.n.' && dc[1].line === 'R9' && dc[1].time === '07:40' && dc[1].date === '2026-11-12', '2 it asks the board for that stop, line and time');
  // 2. cancelled → the plan's backup
  await p.evaluate(() => { window.__TV.dep = { found: true, stop: 'Praha hl.n.', list: [], match: { line: 'R9', to: 'Brno', planned: '07:40', real: '07:40', late: 0, cancelled: true } }; S.tv.cache = {}; render(true); }); await p.waitForTimeout(300);
  ok(/is cancelled/.test(await t.text(p)) && /take the 08:15 RegioJet/.test(await t.text(p)), '3 a cancelled train shows the plan’s own “if it’s cancelled” answer');
  // 3. travel time: check and use
  await t.go(p, 'plans'); await p.evaluate(i => { S.ui.pxOpen = i; render(true); }, id); await p.waitForTimeout(200);
  await p.evaluate(() => { window.__TV.route = { found: true, mins: 42, usual: 30, km: 18.2, mode: 'TRANSIT' }; });
  ok(await t.tap(p, 'button[data-act=tv-route]'), '4 a leg has “Check the travel time”');
  await p.waitForTimeout(300); txt = await t.text(p);
  ok(/42 min/.test(txt) && /usually 30/.test(txt), '5 it shows the minutes now and usually');
  await t.tap(p, 'button[data-act=tv-use]');
  const leg = await p.evaluate(i => pxGet(i).legs[0], id);
  ok(leg.mins === 42 && leg.leave === '06:48', '6 “Use it” sets the minutes and the leave time (07:40 − 42 − 10): ' + leg.leave);
  // 4. a flight number fills the leg
  const tid = await p.evaluate(() => { const q = pxCreate({ title: 'Lisbon', kind: 'trip', start: '2026-11-20', end: '2026-11-23', place: 'Lisbon' }); pxSave(q.id, { legs: [{ id: 'f1', label: 'Getting there', date: '2026-11-20', time: '', place: '', mode: 'flight', early: 5 }] }); window.__TV.flight = { found: true, number: 'OK 652', airline: 'CSA', status: 'Expected', late: 0, cancelled: false, dep: { code: 'PRG', airport: 'Ruzyně', city: 'Prague', planned: '06:45', now: '', terminal: '1', gate: '', desk: '' }, arr: { code: 'LIS', planned: '09:10' } }; S.ui.pxOpen = q.id; render(true); return q.id; });
  await p.waitForTimeout(200);
  await p.fill('form[data-form=tv-flight] input[name=flight]', 'ok 652'); await p.tap('form[data-form=tv-flight] button[type=submit]'); await p.waitForTimeout(400);
  const fl = await p.evaluate(i => pxGet(i).legs[0], tid);
  ok(fl.flight === 'OK652' && fl.time === '06:45' && /PRG→LIS/.test(fl.label) && fl.early === 120 && /Ruzyně/.test(fl.place), '7 a flight number fills the time, airport and label, and “be there” becomes 2 hours: ' + JSON.stringify(fl));
  // 5. a booking from an email
  ok(await t.tap(p, 'button[data-act=bk-open]'), '8 “Add a booking” opens');
  await p.fill('#bkText', 'Your booking OK652 ... Casa Azul ...'); await t.tap(p, 'button[data-act=bk-read]'); await p.waitForTimeout(400);
  txt = await t.text(p);
  ok(/Casa Azul/.test(txt) && /Online check-in/.test(txt) && /ref XK7P2Q/.test(txt), '9 the booking is read into journeys, stays, steps and things to take, for review');
  await t.tap(p, 'button[data-act=bk-save]'); await p.waitForTimeout(300);
  const lp = await p.evaluate(i => pxGet(i), tid);
  ok(lp.legs.some(l => l.flight === 'OK652' && l.ref === 'XK7P2Q' && l.early === 120) && lp.stops.some(s => /Check in: Casa Azul/.test(s.text) && s.time === '15:00') && lp.stops.some(s => /Check out: Casa Azul by 11:00/.test(s.text) && s.date === '2026-11-23'), '10 the ticked journey and the stay (check in and out) land in the plan');
  ok(lp.steps.some(s => s.text === 'Online check-in' && s.due === '2026-11-19') && lp.pack.some(x => x.text === 'Passports'), '11 and the steps and things to take');
  // 6. step reminder
  const sid = lp.steps.find(s => s.text === 'Online check-in' && s.due === '2026-11-19').id;
  await t.tap(p, `button[data-act=pm-rem][data-i="${sid}"]`);
  await p.fill('form[data-form=pm-remtime] input[name=time]', '18:30'); await p.tap('form[data-form=pm-remtime] button[type=submit]'); await p.waitForTimeout(300);
  let rem = await p.evaluate(i => remAll().find(r => r.ref === 'pxs:' + i), sid);
  ok(rem && rem.date === '2026-11-19' && rem.at === '18:30' && rem.who === 'Alex' && /Lisbon: Online check-in/.test(rem.text), '12 🔔 on a step sets a reminder on its day: ' + JSON.stringify(rem));
  await p.evaluate(([i, s]) => pxList(i, 'steps', L => L.map(x => x.id === s ? { ...x, done: true } : x)), [tid, sid]); await p.waitForTimeout(200);
  rem = await p.evaluate(i => remAll().find(r => r.ref === 'pxs:' + i), sid);
  ok(!rem, '13 ticking the step takes its reminder away');
  // 7. costs
  const bal = await p.evaluate(() => pcBalance([{ amt: 300, by: 'A', for: [] }, { amt: 90, by: 'B', for: ['A', 'C'] }, { amt: 60, by: 'C', for: [] }], ['A', 'B', 'C']));
  ok(bal.total === 450 && JSON.stringify(bal.moves) === JSON.stringify([{ from: 'C', to: 'A', amt: 105 }, { from: 'B', to: 'A', amt: 30 }]), '14 who owes whom, in as few payments as possible: ' + JSON.stringify(bal));
  await p.fill('form[data-form=pc-add] input[name=text]', 'Hotel'); await p.fill('form[data-form=pc-add] input[name=amt]', '4800'); await p.tap('form[data-form=pc-add] button[type=submit]'); await p.waitForTimeout(300);
  txt = await t.text(p);
  ok(/Sam → Alex: 2[\s ]?400 Kč/.test(txt), '15 a cost paid by me for both of us: Sam owes half');
  await t.tap(p, 'button[data-act=pc-settle]'); txt = await t.text(p);
  ok(/All square/.test(txt) && /Sam paid Alex back/.test(txt), '16 “Paid” settles it');
  await p.close(); await done(t);
})();
