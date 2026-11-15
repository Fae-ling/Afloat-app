// Calendar events from Firestore (9 Nov 2026): Afloat loads events ending 60 days ago or later plus every repeating event,
// widens that when the calendar is browsed to an older month, and once fills in endDate/rrule on older documents.
const { start, ok, done } = require('./helpers');
const ev = (title, date, extra = {}) => ({ title, kind: 'family', who: ['Alex'], date, endDate: date, allDay: false, start: '10:00', end: '11:00', place: '', notes: '', at: 1, by: 'Alex', ...extra });
(async () => {
  const t = await start();
  const seed = { 'events/old': ev('Old dentist', '2026-05-04'), 'events/recent': ev('Recent swim', '2026-10-20'), 'events/soon': ev('Soon party', '2026-11-12'),
    'events/rep': ev('Weekly lesson', '2025-01-06', { recur: { freq: 'WEEKLY', interval: 1, ends: 'never' }, rrule: 'RRULE:FREQ=WEEKLY;BYDAY=MO' }) };
  let p = await t.open({ seed, hash: 'calendar' });
  let ids = await p.evaluate(() => Object.keys(S.events).filter(k => !k.startsWith('fw')).sort().join());
  ok(ids === 'recent,rep,soon', '1 loads recent and coming events and the repeating one, not May’s dentist: ' + ids);
  await p.evaluate(() => { S.ui.calFocus = '2026-05-01'; calLoad(); }); await p.waitForTimeout(600);
  ids = await p.evaluate(() => Object.keys(S.events).filter(k => !k.startsWith('fw')).sort().join());
  ok(ids === 'old,recent,rep,soon', '2 browsing back to May loads May’s events too: ' + ids);
  // older documents without endDate / rrule get them once
  const st0 = { ...seed, 'events/noend': { ...ev('No end', '2026-11-20'), endDate: undefined }, 'events/norule': { ...ev('Old repeat', '2025-03-03'), recur: { freq: 'WEEKLY', interval: 1, ends: 'never' }, rrule: undefined } };
  const hh = { ...require('./helpers').SEED()['home/household'] }; delete hh.evIdx;
  p = await t.open({ seed: { ...st0, 'home/household': hh } });
  await p.clock.runFor(9000); await p.waitForTimeout(500);
  const st = await t.st(p);
  ok(st['events/noend'].endDate === '2026-11-20' && /FREQ=WEEKLY/.test(st['events/norule'].rrule) && st['home/household'].evIdx === 1, '3 older documents get endDate and rrule once, then it is marked done');
  ids = await p.evaluate(() => Object.keys(S.events).filter(k => !k.startsWith('fw')).sort().join());
  ok(/noend/.test(ids) && /norule/.test(ids), '4 and they show up: ' + ids);
  await done(t);
})();
