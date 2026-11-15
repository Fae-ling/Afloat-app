// Households of one adult or several (10 Nov 2026): a third adult isn't pulled into the couple's Together, a solo evening
// means everyone else is out, and one adult alone sees no "the other one".
const { start, ok, done } = require('./helpers');
(async () => {
  const t = await start();
  const nh = () => { window.claude.household = () => ({ hid: 'h2', base: 'households/h2/', legacy: false, name: 'Flat' }); };
  const ev = (id, who, start = '19:00', end = '23:00') => ({ [`events/${id}`]: { allDay: false, at: 1, by: who[0], date: '2026-11-05', endDate: '2026-11-05', start, end, title: 'Out', kind: 'other', place: 'Town', who } });
  const three = (extra = {}) => ({ 'home/household': { setup: 1, members: [{ id: 'a', name: 'Eva' }, { id: 'b', name: 'Tom' }, { id: 'c', name: 'Jana' }], kids: [], couple: ['Eva', 'Tom'], modules: { together: true } },
    'home/people': { people: { Eva: { setupDone: 1 }, Tom: { setupDone: 1 }, Jana: { setupDone: 1 } } }, ...extra });

  const j = await t.open({ who: 'Jana', fresh: true, seed: three(), T: '2026-11-05T17:00:00', init: nh });
  await t.go(j, 'together');
  const tj = await t.text(j);
  ok(/Together is for Eva and Tom/.test(tj) && !/appreciations/i.test(tj), '1 the third adult sees Together is the couple’s, not their check-in');
  ok(await j.evaluate(() => partnerOf('Jana') === null && partnerOf('Eva') === 'Tom' && othersOf('Jana').join() === 'Eva,Tom'), '2 partner comes from the couple; the others are everyone else');

  const e1 = await t.open({ who: 'Jana', fresh: true, seed: three(ev('x1', ['Tom'])), T: '2026-11-05T17:00:00', init: nh });
  ok(await e1.evaluate(() => !othersOutTonight('Jana') && !closingSet().solo), '3 one of two others out: not a solo evening for Jana');
  const e2 = await t.open({ who: 'Jana', fresh: true, seed: three({ ...ev('x1', ['Tom']), ...ev('x2', ['Eva']) }), T: '2026-11-05T17:00:00', init: nh });
  ok(await e2.evaluate(() => othersOutTonight('Jana') && closingSet().solo), '4 both others out: a solo evening for Jana');
  const br = await e2.evaluate(() => (typeof briefItems === 'function' ? '' : '') + JSON.stringify(document.body.innerText.match(/Tom and Eva are out tonight|Eva and Tom are out tonight/) || ''));
  await t.go(e2, 'together'); ok(/Together is for Eva and Tom/.test(await t.text(e2)), '4b still the couple’s Together');

  const one = await t.open({ who: 'Eva', fresh: true, seed: { 'home/household': { setup: 1, members: [{ id: 'a', name: 'Eva' }], kids: [] }, 'home/people': { people: { Eva: { setupDone: 1 } } } }, T: '2026-11-05T19:30:00', init: nh, brief: true });
  const all = (await t.text(one)) + (await t.text(one, '#sheet'));
  ok(!/undefined|the other adult|both of you/i.test(all) && await one.evaluate(() => !othersOutTonight('Eva') && otherOf('Eva') === undefined), '5 one adult alone: no “the other one”, no undefined');
  for (const v of ['today', 'care', 'rhythms', 'calendar', 'support', 'focus']) { await t.go(one, v); const x = await t.text(one); if (/undefined|both of you/i.test(x)) ok(false, `5b ${v} mentions someone who isn’t there: ` + x.match(/.{0,40}(undefined|both of you).{0,40}/i)[0]); }
  ok(true, '5b every screen reads right for one adult');
  await done(t);
})();
