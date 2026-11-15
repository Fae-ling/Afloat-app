// Event plans (10 Nov 2026): the journey planned the night before sets the one leave time everything uses; what to do there; what to
// do afterwards (kept after the day, with a task sized by a count); saved plans made from an event you planned.
const { start, ok, done } = require('./helpers');
(async () => {
  const t = await start();
  const all = p => p.evaluate(() => document.querySelector('#app').textContent.replace(/\s+/g, ' '));
  const nh = () => { window.claude.household = () => ({ hid: 'h2', base: 'households/h2/', legacy: false, name: 'Flat' }); };
  const ev = (id, title, start, end, place) => ({ [`events/${id}`]: { allDay: false, at: 1, by: 'Eva', date: '2026-11-06', endDate: '2026-11-06', start, end, title, kind: 'other', place, who: ['Eva'] } });
  const base = { 'home/household': { setup: 1, members: [{ id: 'a', name: 'Eva' }], kids: [], address: 'Main St 1, Gdansk' }, 'home/people': { people: { Eva: { setupDone: 1 } } }, ...ev('d1', 'Diving trip', '07:00', '17:00', 'Hel harbour'), ...ev('d2', 'Diving trip Gdynia', '09:00', '12:00', 'Gdynia pier') };
  const p = await t.open({ who: 'Eva', fresh: true, seed: base, T: '2026-11-05T20:00:00', init: nh });
  const ent = () => p.evaluate(() => (planOf('next', me).events || []).find(x => /Diving trip/.test(x.title) && !/Gdynia/.test(x.title)));
  const rems = () => p.evaluate(() => remAll().filter(x => /^plan/.test(x.ref || '')).map(x => `${x.at} ${x.text}`));

  await p.evaluate(() => planAddEv(eventsOn('2026-11-06').find(e => e.title === 'Diving trip'))); await p.waitForTimeout(300);
  let c = await t.text(p, '#app');
  let e1 = await ent();
  ok(/Getting there/.test(c) && /Leave time is a guess/.test(c) && /While you’re there/.test(c) && /When it’s over/.test(c), '1 a planned event has the journey, what to do there, and afterwards');
  ok(e1.place === 'Hel harbour' && e1.end === '17:00', '2 the plan entry remembers the place and the end');

  await p.evaluate(id => epJourneySave(id, { mins: '60', leave: '', early: '10' }), e1.id); await p.waitForTimeout(300); e1 = await ent();
  ok(e1.journey.leave === '05:50' && e1.travel === 60 && e1.journey.early === 10, '3 “it takes 60 min, 10 early” leaves at 05:50');
  const lv = await p.evaluate(() => { const e = eventsOn('2026-11-06').find(x => x.title === 'Diving trip'); return [mm2t(leaveAt(e)), travelOf(e).m, travelOf(e).known]; });
  ok(lv.join() === '05:50,60,true', '4 the countdown, the notification and the hard stop (leaveAt) use the same minute: ' + lv);
  ok((await rems()).join('|').includes('05:50 Leave now') && (await rems()).join('|').includes('05:20 Start getting ready'), '5 the reminders moved with it: ' + (await rems()).join('|'));
  c = await t.text(p, '#app'); ok(/Journey planned/.test(c) && /leave at 05:50/.test(c), '6 the card says planned, with the time');

  await p.evaluate(id => epJourneySave(id, { mins: '', leave: '05:42', early: '5' }), e1.id); await p.waitForTimeout(200); e1 = await ent();
  ok(e1.journey.leave === '05:42' && e1.journey.mins === 73 && e1.journey.fixed === true, '7 “leave at 05:42” (the train) works out the minutes the other way');
  ok(await p.evaluate(() => kits().travel[placeKey('Hel harbour')] === 73), '8 the place remembers the time for next time');
  await p.evaluate(id => tapEventPlans('ep-mode', { dataset: { id, v: 'transit' } }), e1.id); await p.waitForTimeout(200); e1 = await ent();
  const links = await p.evaluate(id => epLinks(epEnt(id)), e1.id);
  ok(e1.journey.mode === 'transit' && /travelmode=transit/.test(links) && /destination=Hel%20harbour/.test(links) && /origin=Main%20St%201%2C%20Gdansk/.test(links) && !/waze/.test(links), '9 the directions link follows the way of travel, from home to the place');
  ok(await p.evaluate(() => epShift({ time: '07:00', travel: 73, journey: { mins: 73, leave: '05:42', early: 5, fixed: true, mode: 'transit' } }, '08:00').journey.leave === undefined) && await p.evaluate(() => epShift({ time: '07:00', travel: 60, journey: { mins: 60, leave: '05:50', early: 10 } }, '08:00').journey.leave === '06:50'), '10 if the event moves, a minutes journey moves with it and a timetable one is dropped');

  await p.evaluate(id => { const fd = o => ({ get: k => o[k] }); epForm('ep-during', { dataset: { ev: id } }, fd({ text: 'The wreck dive', time: '10:30' })); epForm('ep-after', { dataset: { ev: id } }, fd({ text: 'Hang the wetsuit to dry' })); epForm('ep-sized', { dataset: { ev: id } }, fd({ noun: 'photos', perHour: '100' })); }, e1.id); await p.waitForTimeout(400);
  e1 = await ent(); const A = await p.evaluate(() => H('afters').list || []);
  ok(e1.during.length === 1 && e1.after.length === 1 && e1.sized.noun === 'photos', '11 what to do there, afterwards and the sized task are saved on the entry');
  ok(A.length === 1 && A[0].date === '2026-11-06' && A[0].items[0].text === 'Hang the wetsuit to dry' && A[0].sized.perHour === 100, '12 the after-things are kept in home/afters so they outlive the day');
  ok((await rems()).some(x => /^18:13 Home from Diving trip: Hang the wetsuit to dry/.test(x)), '13 a reminder for when you’re home (end + the way back): ' + (await rems()).join('|'));

  await p.evaluate(id => epTplSave(id), e1.id); await p.waitForTimeout(300);
  const tp = await p.evaluate(() => { const x = epTplApply('Diving trip Gdynia'); return x && { n: x.lists.length, d: x.during.length, a: x.after.length, s: !!x.sized }; });
  ok(tp && tp.d === 1 && tp.a === 1 && tp.s && /Saved plans \(1\)/.test(await t.text(p, '#app')), '14 saved as a plan; a new event with the same words in its name gets it: ' + JSON.stringify(tp));
  await p.evaluate(() => planAddEv(eventsOn('2026-11-06').find(e => e.title === 'Diving trip Gdynia'))); await p.waitForTimeout(300);
  const g = await p.evaluate(() => (planOf('next', me).events || []).find(x => /Gdynia/.test(x.title)));
  ok(g && g.during.length === 1 && g.after[0].text === 'Hang the wetsuit to dry' && g.sized.noun === 'photos', '15 planning it adds the saved plan’s things there and afterwards');
  await p.evaluate(() => tapEventPlans('ep-tpl-del', { dataset: { id: H('afters').tpl[0].id } })); await p.waitForTimeout(200);
  ok(await p.evaluate(() => (H('afters').tpl || []).length === 0), '16 a saved plan can be removed');
  await p.evaluate(id => { savePlan({ events: planOf('next', me).events.filter(x => x.id !== id) }); }, e1.id); await p.waitForTimeout(300);
  ok(await p.evaluate(id => !(H('afters').list || []).some(a => a.id === id), e1.id) && !(await rems()).some(x => /Home from Diving trip:/.test(x)), '17 taking the event off the plan takes its after-things and reminder with it');

  const seedA = { ...base, 'home/afters': { list: [{ id: 'x1', who: 'Eva', title: 'Diving trip', date: '2026-11-06', start: '07:00', end: '17:00', back: 60, items: [{ id: 'i1', text: 'Hang the wetsuit to dry' }], sized: { noun: 'photos', perHour: 100 } }] }, 'plans/2026-11-06': { Eva: { events: [{ id: 'x1', title: 'Diving trip · Eva', time: '07:00', end: '17:00', travel: 60, during: [{ id: 'd1', time: '10:30', text: 'The wreck dive' }] }] } } };
  const n = await t.open({ who: 'Eva', fresh: true, seed: seedA, T: '2026-11-06T11:00:00', init: nh });
  let tn = await all(n);
  ok(/At Diving trip/.test(tn) && /The wreck dive/.test(tn) && !/After Diving trip/.test(tn), '18 while it’s on, Today shows what to do there, not the after-card yet');
  const t3 = await start(), t2 = await start(); /* a fresh browser for each late page: they set up their own lists and share nothing */
  const early = await t3.open({ who: 'Eva', fresh: true, seed: seedA, T: '2026-11-06T17:30:00', init: nh });
  ok(!/After Diving trip/.test(await all(early)), '20 not before you’re home (end + the way back)');
  const l = await t2.open({ who: 'Eva', fresh: true, seed: seedA, T: '2026-11-06T18:30:00', init: nh });
  let tl = await all(l);
  ok(/After Diving trip/.test(tl) && /Hang the wetsuit to dry/.test(tl) && !/At Diving trip/.test(tl) && /How many photos/.test(tl), '19 once it’s over and you’re back: the after-card, with the count question');
  await l.evaluate(() => { S.ui.epN = { x1: 500 }; render(true); }); await l.waitForTimeout(200); tl = await all(l);
  ok(/About 5 h/.test(tl) && /3 sessions/.test(tl), '21 500 photos at 100 an hour: about 5 h, in 3 sessions' + (/About 5 h/.test(tl) ? '' : ' :: ' + tl.slice(0, 700)));
  await l.waitForTimeout(1200); await l.evaluate(() => epMake('x1')); await l.waitForTimeout(1200);
  const made = await l.evaluate(() => ({ af: (H('afters').list || [])[0], cards: Object.entries(window.__st || {}).filter(([k, v]) => /^todo\//.test(k)).map(([k, v]) => (v && v.name) || JSON.stringify(v).slice(0, 80)) }));
  ok(made.af.made === true && made.cards.some(x => /Diving trip: 500 photos/.test(x)), '22 “Make the task” puts one task on your list: ' + JSON.stringify(made.cards));
  await l.evaluate(() => tapEventPlans('ep-tick', { dataset: { id: 'x1', i: 'i1' } })); await l.waitForTimeout(300);
  ok(!/After Diving trip/.test(await all(l)), '23 everything done: the card goes away');
  await done(t3);
  await done(t2);
  await done(t);
})();
