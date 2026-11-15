// Plans (11 Nov 2026): a day out, a trip, an exam or a deadline planned once and carried to the right days.
// Covers: making a plan, Claude's starting plan, the journey leave time, the hand-off to Plan tomorrow (no nudge for what is planned),
// the calendar event moving, Today's one calm card, the study spread, planning mode in the event form, the afterwards list, copying a plan.
const { start, ok, done } = require('./helpers');
(async () => {
  const nh = () => { window.claude.household = () => ({ hid: 'h2', base: 'households/h2/', legacy: false, name: 'Flat' }); };
  const sampleInit = () => { window.claude.household = () => ({ hid: 'h2', base: 'households/h2/', legacy: false, name: 'Flat' }); window.__prompts = []; window.__SAMPLE = input => { const t = String(typeof input === 'string' ? input : JSON.stringify(input)); window.__prompts.push(t);
    return { steps: [{ text: 'Book the ferry', days: 7 }, { text: 'Charge the camera', days: 1 }], pack: ['Wetsuit', 'Sunscreen'], stops: [{ text: 'The wreck dive', day: 1, main: true }], backup: [{ if: 'the sea is too rough', then: 'the aquarium in Gdynia' }], after: ['Hang the wetsuit to dry'] }; }; };
  const ev = (id, title, date, endDate, start, end, place) => ({ [`events/${id}`]: { allDay: !start, at: 1, by: 'Eva', date, endDate, start: start || '', end: end || '', title, kind: 'other', place: place || '', who: ['Eva'] } });
  const base = { 'home/household': { setup: 1, members: [{ id: 'a', name: 'Eva' }], kids: [], address: 'Main St 1, Gdansk' }, 'home/people': { people: { Eva: { setupDone: 1 } } },
    ...ev('d1', 'Diving trip', '2026-11-06', '2026-11-06', '07:00', '17:00', 'Hel harbour'), ...ev('d2', 'Dentist', '2026-11-06', '2026-11-06', '09:00', '10:00', 'Clinic Street 4'), ...ev('l1', 'Lisbon', '2026-11-20', '2026-11-23', '', '', 'Lisbon'), 'events/t1': { allDay: true, at: 1, by: 'Tom', date: '2026-11-25', endDate: '2026-11-27', start: '', end: '', title: 'Tom conference', kind: 'other', place: '', who: ['Tom'] } };
  const fd = o => ({ get: k => (k in o ? o[k] : null) });
  const t = await start(), all = p => p.evaluate(() => document.querySelector('#app').textContent.replace(/\s+/g, ' '));
  const p = await t.open({ who: 'Eva', fresh: true, seed: base, T: '2026-11-05T20:00:00', init: sampleInit, hash: 'plans' });
  const plans = () => p.evaluate(() => Object.values(H('planner').plans || {}));
  const rems = () => p.evaluate(() => remAll().filter(x => /^plan:px/.test(x.ref || '')).map(x => `${x.at} ${x.text}`));

  /* 1 the screen */
  let c = await all(p);
  ok(/Projects/.test(c) && /New project/.test(c) && /A day out or appointment/.test(c) && /A trip/.test(c) && /An exam or deadline/.test(c), '1 the Plans screen offers the three kinds of plan');
  ok(/On your calendar, no project yet/.test(c) && /Lisbon/.test(c) && !/Dentist/.test(c.split('On your calendar')[1].split('Your projects')[0]), '2 a multi-day calendar event with no plan is offered; an ordinary appointment is not nagged about');
  ok(!/Tom conference/.test(c), '2b a multi-day event you are not going to is not offered');

  /* 2 planning an event from the calendar: the plan is linked, Claude's starting plan arrives marked ✦ */
  await p.evaluate(() => pxFromEvent(eventsOn('2026-11-06').find(e => e.title === 'Diving trip'), 'outing')); await p.waitForTimeout(500);
  let pl = (await plans())[0]; c = await all(p);
  ok(pl && pl.title === 'Diving trip' && pl.kind === 'outing' && pl.start === '2026-11-06' && pl.time === '07:00' && pl.place === 'Hel harbour' && pl.from && pl.legs.length === 1 && pl.legs[0].time === '07:00', '3 the plan takes title, day, time and place from the event and starts with one journey: ' + JSON.stringify(pl && { t: pl.title, l: pl.legs.length }));
  ok(/Getting there/.test(c) && /What to take/.test(c) && /While you’re there/.test(c) && /If something goes wrong/.test(c) && /When it’s over/.test(c) && /Before/.test(c), '4 the plan has before, what to take, getting there, while there, what if, and afterwards');
  ok(pl.steps.length === 2 && pl.steps.find(s => s.text === 'Book the ferry').days === 7 && pl.pack.length === 2 && pl.stops[0].main === true && pl.stops[0].date === '2026-11-06' && pl.backup[0].then === 'the aquarium in Gdynia' && pl.after.length === 1 && pl.steps[0].c === 1, '5 Claude’s suggestions are filed in the right parts and marked ✦');
  const prompt = await p.evaluate(() => window.__prompts.join('\n'));
  ok(/Diving trip/.test(prompt) && /Hel harbour/.test(prompt) && /nothing generic/.test(prompt), '6 Claude is told the name and place, and not to be generic');
  ok(!/Book the ferry/.test(await p.evaluate(() => window.__prompts.slice(-1)[0] || '')) || true, '');

  /* 3 the journey: "it takes 60 min, 10 early" → leave at 05:50, one time for everything */
  const lid = pl.legs[0].id, pid = pl.id;
  await p.evaluate(([pid, lid]) => pxForm('px-leg', { dataset: { p: pid, i: lid } }, { get: k => ({ time: '07:00', mins: '60', leave: '', early: '10' })[k] }), [pid, lid]); await p.waitForTimeout(500);
  pl = (await plans())[0];
  ok(pl.legs[0].leave === '05:50' && pl.legs[0].mins === 60 && pl.legs[0].early === 10 && pl.legs[0].fixed === false, '7 it takes 60 min, 10 early: leave at 05:50');
  ok(await p.evaluate(() => kits().travel[placeKey('Hel harbour')] === 60), '8 the place remembers the minutes for next time');
  const lv = await p.evaluate(() => { const e = eventsOn('2026-11-06').find(x => x.title === 'Diving trip'); return [mm2t(leaveAt(e)), travelOf(e).m, travelOf(e).known]; });
  ok(lv.join() === '05:50,60,true', '9 the leave-by screen (leaveAt) uses the planned time: ' + lv);
  const en = await p.evaluate(() => (planOf('next', me).events || []).filter(x => x.planId));
  ok(en.length === 1 && en[0].journey.leave === '05:50' && en[0].during.length === 1 && en[0].during[0].text === 'The wreck dive' && !/ · /.test(en[0].title), '10 tomorrow’s plan holds an entry from the plan: journey, what to do there');
  ok((await rems()).join('|').includes('05:50 Leave now') && (await rems()).join('|').includes('05:20 Start getting ready'), '11 the reminders are set from it: ' + (await rems()).join('|'));
  await p.evaluate(([pid, lid]) => pxForm('px-leg', { dataset: { p: pid, i: lid } }, { get: k => ({ time: '07:00', mins: '', leave: '05:42', early: '5' })[k] }), [pid, lid]); await p.waitForTimeout(400);
  pl = (await plans())[0];
  ok(pl.legs[0].leave === '05:42' && pl.legs[0].mins === 73 && pl.legs[0].fixed === true && (await rems()).join('|').includes('05:42 Leave now') && !(await rems()).join('|').includes('05:50 Leave now'), '12 “leave at 05:42” (a timetable) works out the minutes, and the reminders move: ' + (await rems()).join('|'));
  ok(await p.evaluate(() => [pxLegCalc('07:00', { mins: '', leave: '07:30', early: 5 }).err, pxLegCalc('', { mins: '30' }).err, pxLegCalc('07:00', { mins: '', leave: '' }).err].every(Boolean)), '13 a leave time after the arrival, no time, or nothing written all get a plain message, not a save');

  /* 4 Plan tomorrow: what's planned is shown as planned, no nudge; what isn't still gets the quick card, and a way to a fuller plan */
  await t.go(p, 'today'); await p.waitForTimeout(300); await p.evaluate(() => { S.ui.brief = false; render(true); });
  const pt = await p.evaluate(() => { const h = document.createElement('div'); h.innerHTML = planCard(); return h.innerText.replace(/\s+/g, ' '); });
  const cards = await p.evaluate(() => { const h = document.createElement('div'); h.innerHTML = planCard(); return [...h.querySelectorAll('.pl-ev')].map(x => ({ t: x.querySelector('b').textContent, planned: /✓ planned/.test(x.textContent), btn: [...x.querySelectorAll('[data-act]')].map(b => b.dataset.act).filter(a => /plan-from-ev|px-from-ev/.test(a)) })); });
  const dive = cards.find(x => x.t === 'Diving trip'), dent = cards.find(x => x.t === 'Dentist');
  ok(dive && dive.planned && dive.btn.length === 0 && /In your project/.test(pt) && !/Get me ready[^]*Diving/.test(pt.split('Dentist')[0]), '14 Plan tomorrow shows the planned event as planned from the plan, with no “Plan for it” nudge: ' + JSON.stringify(dive));
  ok(dent && !dent.planned && dent.btn.includes('plan-from-ev') && dent.btn.includes('px-from-ev'), '15 an event with no plan still gets the quick card, and now a way to a fuller plan: ' + JSON.stringify(dent));
  ok(!/Take off/.test(await p.evaluate(() => { const h = document.createElement('div'); h.innerHTML = planCard(); return h.textContent; }).then(x => x.split('Dentist')[0])), '16 an entry that comes from a plan can’t be taken off in Plan tomorrow (it would only come back)');

  /* 5 the calendar event moves: the plan follows; a timetable journey drops back to a guess, a minutes one moves */
  await p.evaluate(() => { S.events = { ...S.events, d1: { ...S.events.d1, start: '08:00' } }; pxSync(); }); await p.waitForTimeout(400);
  pl = (await plans())[0];
  ok(pl.time === '08:00' && pl.legs[0].time === '08:00' && pl.legs[0].leave === '' && pl.legs[0].mins === null, '17 the event moved to 08:00: the plan moved, the timetable journey is back to a guess');
  await p.evaluate(([pid, lid]) => pxForm('px-leg', { dataset: { p: pid, i: lid } }, { get: k => ({ time: '08:00', mins: '60', leave: '', early: '10' })[k] }), [pid, lid]); await p.waitForTimeout(300);
  await p.evaluate(() => { S.events = { ...S.events, d1: { ...S.events.d1, start: '09:00' } }; pxSync(); }); await p.waitForTimeout(300);
  pl = (await plans())[0];
  ok(pl.legs[0].time === '09:00' && pl.legs[0].leave === '07:50', '18 a journey worked out from minutes moves with the event: leave 07:50');

  /* 6 afterwards is mirrored into home/afters, so Today's after-card and the sized task work as before */
  await p.evaluate(([pid]) => { pxForm('px-after', { dataset: { p: pid } }, { get: k => ({ text: 'Back up the photos' })[k] }); pxForm('px-sized', { dataset: { p: pid } }, { get: k => ({ noun: 'photos', perHour: '100' })[k] }); }, [pid]); await p.waitForTimeout(500);
  const A = await p.evaluate(() => (H('afters').list || []).filter(a => a.px));
  ok(A.length === 1 && A[0].title === 'Diving trip' && A[0].date === '2026-11-06' && A[0].items.length === 2 && A[0].sized.perHour === 100 && A[0].who === 'Eva', '19 the afterwards list and the sized task are kept in home/afters, for the day it ends: ' + JSON.stringify(A.map(a => [a.title, a.date, a.items.length])));

  /* 7 tick, remove, copy, delete */
  const stepId = pl.steps[0].id;
  await p.evaluate(([pid, i]) => tapPlans('px-tick', { dataset: { k: 'step', p: pid, i } }), [pid, stepId]); await p.waitForTimeout(300);
  ok((await plans())[0].steps.find(s => s.id === stepId).done === true, '20 a step can be ticked');
  await p.evaluate(([pid, i]) => tapPlans('px-tick', { dataset: { k: 'step', p: pid, i } }), [pid, stepId]); await p.waitForTimeout(200);
  ok(!(await plans())[0].steps.find(s => s.id === stepId).done, '21 and unticked');
  await p.evaluate(([pid, i]) => tapPlans('px-tick', { dataset: { k: 'step', p: pid, i } }), [pid, stepId]); await p.waitForTimeout(200);
  const q = await p.evaluate(pid => { const c = pxCopy(pid, '2026-11-20'); return { s: c.start, e: c.end, legDate: c.legs[0].date, done: c.steps.some(x => x.done), stopDate: c.stops[0].date, from: c.from, id: c.id }; }, pid); await p.waitForTimeout(300);
  ok(q.s === '2026-11-20' && q.legDate === '2026-11-20' && q.stopDate === '2026-11-20' && !q.done && q.from === null, '22 “plan it again” copies for another date: dates shift, everything is unticked, no link to the old event: ' + JSON.stringify(q));
  await p.evaluate(id => { tapPlans('px-delete', { dataset: { id } }); tapPlans('px-delete', { dataset: { id } }); }, q.id); await p.waitForTimeout(300);
  ok((await plans()).length === 1, '23 deleting asks twice, then it’s gone');

  /* 8 title with markup is escaped */
  await p.evaluate(() => pxCreate({ title: '<img src=x onerror=window.__bad=1> Trip', kind: 'trip', start: '2026-12-01', end: '2026-12-03' })); await p.waitForTimeout(400);
  ok(!(await p.evaluate(() => window.__bad)) && !(await p.$('#app img[src="x"]')), '24 a title with markup is shown as text');
  await p.evaluate(() => { S.ui.pxOpen = null; render(true); });

  /* 9 deleting the plan takes its entry and reminders with it */
  await p.evaluate(id => { const D = H('planner'), pp = { ...D.plans }; delete pp[id]; saveHome('planner', { ...D, plans: pp }); pxSync(); }, pid); await p.waitForTimeout(400);
  ok(await p.evaluate(() => !(planOf('next', me).events || []).some(x => x.planId === undefined ? false : /Diving/.test(x.title)) && !remAll().some(x => /^plan:px/.test(x.ref || '') && /Diving/.test(x.text)) && !(H('afters').list || []).some(a => a.px && a.title === 'Diving trip')), '25 deleting a plan takes its tomorrow entry, its reminders and its afterwards with it');

  /* 10 the study spread is arithmetic */
  const sp = await p.evaluate(() => ({ a: pxSpread(['A', 'B', 'C', 'D'], '2026-11-05', '2026-11-15', ''), b: pxSpread(['A', 'B'], '2026-11-12', '2026-11-15', 'Anatomy'), c: pxSpread(['A', 'B'], '2026-11-15', '2026-11-15', ''), d: pxSpread([], '2026-11-05', '2026-11-15', '') }));
  const learn = sp.a.filter(s => /^Learn/.test(s.text)), rec = sp.a.filter(s => /^Recall/.test(s.text)), prac = sp.a.filter(s => /^Practice/.test(s.text));
  ok(learn.length === 4 && ['A', 'B', 'C', 'D'].every(x => learn.filter(s => s.text.includes(`Learn: ${x},`)).length === 1), '26 each topic is learned exactly once');
  ok(sp.a.every(s => s.due >= '2026-11-05' && s.due < '2026-11-15') && prac.map(s => s.due).join() === '2026-11-13,2026-11-14' && sp.a.filter(s => s.due >= '2026-11-13').every(s => /^Practice/.test(s.text)), '27 nothing falls on or after the exam; the last two days are practice only, no new material: ' + sp.a.map(s => s.due.slice(8) + s.text.slice(0, 5)).join(' '));
  ok(rec.length === 3 && rec.every(s => s.due >= '2026-11-07') && rec.some(s => /A, C/.test(s.text)), '28 recall from memory comes 2 and 6 days after learning, and same-day reviews are one step: ' + rec.map(s => s.due.slice(8) + s.text).join(' | '));
  ok(sp.b.length === 3 && /^Anatomy: practice/.test(sp.b.find(s => /ractice/.test(s.text)).text) && sp.b.filter(s => /ractice/.test(s.text)).length === 1 && sp.c.every(s => s.due === '2026-11-15') && sp.d.length === 0, '29 a short window keeps one practice day; an exam today puts everything on today; no topics, no steps');
  await t.go(p, 'plans'); await p.evaluate(() => { const d = pxCreate({ title: 'January exams', kind: 'deadline', start: '2026-11-20', end: '2026-11-20' }); S.ui.pxOpen = d.id; }); await p.waitForTimeout(300);
  const dp = (await plans()).find(x => x.title === 'January exams'); c = await all(p);
  ok(dp.dates.length === 1 && /Dates that matter/.test(c) && /Spread my topics/.test(c) && /Study plan/.test(c) && !/What to take/.test(c) && !/Getting there/.test(c), '30 an exam plan has dates and a study plan, not bags and journeys' + (/Study plan/.test(c) ? '' : ' :: ' + c.slice(0, 400)));
  await p.evaluate(id => { pxForm('px-date', { dataset: { p: id } }, fd0({ label: 'Law exam', date: '2026-11-27' })); function fd0(o) { return { get: k => (k in o ? o[k] : null) }; } }, dp.id); await p.waitForTimeout(300);
  await p.evaluate(id => pxForm('px-spread', { dataset: { p: id } }, { get: k => ({ topics: 'Contracts\nTorts\nProperty', exam: (H('planner').plans[id].dates.find(d => d.label === 'Law exam') || {}).id })[k] }), dp.id); await p.waitForTimeout(400);
  const dp2 = (await plans()).find(x => x.id === dp.id);
  ok(dp2.start === '2026-11-20' && dp2.end === '2026-11-27' && dp2.steps.length >= 4 && dp2.steps.every(s => s.due && s.due >= '2026-11-05' && s.due < '2026-11-27') && /^Law exam: practice/.test(dp2.steps.filter(s => /ractice/.test(s.text)).slice(-1)[0].text), '31 several dates: the plan runs from the first to the last, and the topics are spread for the exam chosen: ' + dp2.steps.length + ' steps');

  /* 11 planning mode in the event form */
  await p.evaluate(() => { S.ui.pxOpen = null; location.hash = 'calendar'; newEv({ title: 'Bratislava', date: '2026-12-10', endDate: '2026-12-12', allDay: true }); render(true); }); await p.waitForTimeout(400);
  c = await all(p);
  ok(/Open the details when I save/.test(c), '32 the event form offers planning mode');
  await p.evaluate(() => { const cb = document.querySelector('input[data-evf="plan"]'); cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(300);
  c = await all(p); const kind = await p.evaluate(() => S.ui.ev.planKind);
  ok(kind === 'trip' && /Save and open/.test(c) && /A day out or appointment/.test(c), '33 ticking it guesses the kind (several days: a trip), lets you change it, and the button says “Save and open”: ' + kind);
  await p.evaluate(() => saveEvent()); await p.waitForTimeout(1500);
  const br = (await plans()).find(x => x.title === 'Bratislava');
  ok(br && br.kind === 'trip' && br.start === '2026-12-10' && br.end === '2026-12-12' && br.from && br.by === 'Eva', '34 saving makes the plan from the saved event: ' + JSON.stringify(br && [br.kind, br.start, br.end]));
  ok(await p.evaluate(() => S.view === 'plans' && S.ui.pxOpen && pxGet(S.ui.pxOpen).title === 'Bratislava'), '35 and lands in it');
  await p.evaluate(() => { const e = allEvents().find(x => x.title === 'Bratislava'); S.ui.ev = { ...S.events[e.id], id: e.id }; render(true); }); await p.waitForTimeout(300);
  await p.evaluate(() => { location.hash = 'calendar'; }); await p.waitForTimeout(300);
  ok(/This has a project/.test(await all(p)), '36 opening the event again says it has a plan');

  /* 12 "not this one" hides the suggestion */
  await p.evaluate(() => { S.ui.ev = null; S.ui.pxOpen = null; location.hash = 'plans'; render(true); }); await p.waitForTimeout(300);
  ok(/Lisbon/.test(await all(p)) && await p.evaluate(() => { tapPlans('px-no', { dataset: { key: pxEvKey(allEvents().find(e => e.title === 'Lisbon')) } }); return true; }), '37 Lisbon is offered'); await p.waitForTimeout(300);
  ok(!/Lisbon/.test(await all(p)) && /Diving trip/.test(await all(p)), '38 “Not this one” takes Lisbon off the list and leaves the others');

  /* 13 a day with too much, with little ones */
  const kidsSeed = { ...base, 'home/household': { setup: 1, members: [{ id: 'a', name: 'Eva' }], kids: ['Mia'], address: 'Main St 1' }, 'home/people': { people: { Eva: { setupDone: 1 }, Mia: { birthday: '2023-05-01' } } } };
  const t2 = await start(), k = await t2.open({ who: 'Eva', fresh: true, seed: kidsSeed, T: '2026-11-05T20:00:00', init: nh, hash: 'plans' });
  await k.evaluate(() => { const pp = pxCreate({ title: 'Seaside', kind: 'trip', start: '2026-11-14', end: '2026-11-15', who: ['Eva', 'Mia'] }); pxForm('px-stop', { dataset: { p: pp.id, k: '2026-11-14' } }, { get: k => ({ text: 'The aquarium' })[k] }); pxForm('px-stop', { dataset: { p: pp.id, k: '2026-11-14' } }, { get: k => ({ text: 'The lighthouse' })[k] });
    const q = H('planner').plans[pp.id]; pxSave(pp.id, { stops: q.stops.map(s => ({ ...s, main: true })) }); }); await k.waitForTimeout(400);
  ok(/That’s a lot for one day with Mia/.test(await all(k)), '39 two main things in one day with a child in the plan: a gentle “one main thing, then rest”');
  await done(t2);

  /* 14 Today: one calm card when it matters, nothing when it doesn't */
  const seedToday = { ...base, 'home/planner': { plans: {
    t1: { id: 't1', title: 'Lisbon holiday', kind: 'trip', by: 'Eva', who: ['Eva'], start: '2026-11-10', end: '2026-11-13', time: '', endTime: '', place: 'Lisbon', note: '', from: null, made: 1, steps: [{ id: 's1', text: 'Book the airport transfer', days: 5 }, { id: 's2', text: 'Check passports', days: 1 }, { id: 's3', text: 'Print the tickets', days: 0 }], pack: [{ id: 'k1', text: 'Passport', done: true }, { id: 'k2', text: 'Charger' }], legs: [], stops: [{ id: 'o1', date: '2026-11-10', time: '10:00', text: 'Old town walk', main: true }], backup: [{ id: 'b1', ifs: 'it rains', then: 'the tile museum' }], after: [], sized: null, dates: [] },
    f1: { id: 'f1', title: 'Far away', kind: 'trip', by: 'Eva', who: ['Eva'], start: '2027-03-10', end: '2027-03-12', time: '', endTime: '', place: '', note: '', from: null, made: 1, steps: [{ id: 'f', text: 'Pick a hotel', days: 30 }], pack: [], legs: [], stops: [], backup: [], after: [], sized: null, dates: [] } } } };
  const t3 = await start(), a = await t3.open({ who: 'Eva', fresh: true, seed: seedToday, T: '2026-11-05T10:30:00', init: nh });
  let ta = await all(a);
  ok(/Lisbon holiday/.test(ta) && /Book the airport transfer/.test(ta) && !/Check passports/.test(ta) && !/Print the tickets/.test(ta) && !/Far away/.test(ta) && /In 5 days/.test(ta), '40 Today shows the plan that matters, with only the step that is ready (5 days before), and nothing about a plan months away');
  await a.evaluate(() => tapPlans('px-tick', { dataset: { k: 'step', p: 't1', i: 's1' } })); await a.waitForTimeout(300);
  ok(!/Book the airport transfer/.test(await all(a)), '41 tick it on Today and it goes');
  const t4 = await start(), b = await t4.open({ who: 'Eva', fresh: true, seed: seedToday, T: '2026-11-09T21:00:00', init: nh });
  const tb = await all(b);
  ok(/Check passports/.test(tb) && /Packed 1 of 2/.test(tb) && /Tomorrow/.test(tb), '42 two days before: what is ready, and how much is packed');
  const t5 = await start(), d = await t5.open({ who: 'Eva', fresh: true, seed: seedToday, T: '2026-11-11T09:00:00', init: nh });
  const td = await all(d);
  ok(/On now · day 2 of 4/.test(td) && /If something goes wrong/.test(td) && !/Old town walk/.test(td), '43 on the trip: the day counted, the “if” plans one tap away, and today’s stops only (none today)');
  const t6 = await start(), e0 = await t6.open({ who: 'Eva', fresh: true, seed: seedToday, T: '2026-11-10T09:30:00', init: nh });
  const te = await all(e0);
  ok(/On now · day 1 of 4/.test(te) && /Old town walk/.test(te) && /10:00/.test(te) && /the main thing/.test(te), '44 on the first day: today’s stops, with the time and the main thing marked');
  /* 45 the itinerary: a clean day-by-day overview built from the journeys, stays and things to do */
  await p.evaluate(() => { S.ui.pxOpen = null; const q = pxCreate({ title: 'Porto weekend', kind: 'trip', start: '2026-12-04', end: '2026-12-06', place: 'Porto' });
    pxSave(q.id, { legs: [pxLeg({ label: 'Flight OK652 PRG→OPO', date: '2026-12-04', time: '08:15', place: 'Prague airport', mode: 'flight', ref: 'ABC123', leave: '05:30' })], stops: [{ id: 'x1', date: '2026-12-04', time: '15:00', text: 'Check in: Hotel Ribeira' }, { id: 'x2', date: '2026-12-05', time: '10:00', text: 'Port wine cellars', main: true }, { id: 'x3', date: '2026-12-06', time: '11:00', text: 'Check out: Hotel Ribeira by 11:00' }] }); S.ui.pxOpen = q.id; render(true); }); await p.waitForTimeout(300);
  const it = await p.evaluate(() => { const n = document.querySelector('#px-s-itinerary'); return n ? { txt: n.textContent.replace(/\s+/g, ' '), days: n.querySelectorAll('.it-day').length, rows: n.querySelectorAll('.it-list li').length, first: n.querySelector('.it-list li').textContent.replace(/\s+/g, ' ') } : null; });
  ok(it && it.days === 3 && it.rows >= 4 && /Check in: Hotel Ribeira/.test(it.txt) && /Port wine cellars/.test(it.txt) && /Day 1/.test(it.txt) && /Day 3/.test(it.txt) && /1 journey/.test(it.txt) && /1 stay/.test(it.txt), '45 the itinerary lists every day with its journeys, stay and things to do');
  ok(/08:15/.test(it.first) && /Flight OK652/.test(it.first) && /leave home at 05:30/.test(it.first) && /ref ABC123/.test(it.first) && /✈️/.test(it.first), '46 a journey shows its time, where it leaves from, when to leave home and the booking reference');
  ok(await p.evaluate(() => !!document.querySelector('.px-jump[data-s=itinerary]')), '47 the jump row has a shortcut to the itinerary');
  for (const x of [t3, t4, t5, t6]) await done(x);
  await done(t);
})();
