// Plan tomorrow for any household (10 Nov 2026): one adult living alone gets no child, kindergarten or nappy prep, guests coming
// to you have no leave time, and a household with children still gets its own wording.
const { start, ok, done } = require('./helpers');
(async () => {
  const t = await start();
  const nh = () => { window.claude.household = () => ({ hid: 'h2', base: 'households/h2/', legacy: false, name: 'Flat' }); };
  const ev = (id, title, start, end, place, who = ['Eva']) => ({ [`events/${id}`]: { allDay: false, at: 1, by: who[0], date: '2026-11-06', endDate: '2026-11-06', start, end, title, kind: 'other', place, who } });
  const evs = { ...ev('d1', 'Dentist', '10:00', '11:00', 'Dental Clinic, Main St 4'), ...ev('d2', 'Diving trip', '07:00', '17:00', 'Hel harbour'), ...ev('d3', 'Guests for dinner', '19:00', '22:00', ''), ...ev('d4', 'Costume party', '20:00', '23:00', 'Club') };
  const solo = { 'home/household': { setup: 1, members: [{ id: 'a', name: 'Eva' }], kids: [] }, 'home/people': { people: { Eva: { setupDone: 1 } } }, ...evs };
  const card = p => p.evaluate(() => { document.querySelectorAll('#app .grp-b[hidden]').forEach(x => x.hidden = false); return [...document.querySelectorAll('section.card.plan')].map(x => x.innerText).join('\n'); });
  const plan = p => p.evaluate(() => (window.__st['plans/2026-11-06'] || {}).Eva || {});

  const p = await t.open({ who: 'Eva', fresh: true, seed: solo, T: '2026-11-05T20:00:00', init: nh });
  const c = await card(p);
  ok(/Diving trip/.test(c) && /Dentist/.test(c), '1 a diving trip and a dentist both get a card');
  ok(!/kindergarten|girls|nappies|kartičky|comfort toy|kids/i.test(c), '2 nothing about children, kindergarten or nappies for someone living alone');
  ok(/Day bag: water, snacks, a layer for the weather/.test(c) && /Find the insurance card/.test(c), '3 the day bag and the insurance card are worded for an adult');
  ok(!/Costume party[^\n]*\n[^\n]*Read the kindergarten/i.test(c) && await p.evaluate(() => planKindOf({ title: 'Costume party' }) === null), '4 a costume party is not a kindergarten day without children');
  ok(await p.evaluate(() => planAtHome({ title: 'Guests for dinner', place: '' }) && !planAtHome({ title: 'Guests for dinner', place: 'Pub' })), '5 guests with no place are at home');
  await p.evaluate(() => { const e = eventsOn('2026-11-06').find(x => /Guests/.test(x.title)); planAddEv(e); }); await p.waitForTimeout(300);
  let pl = await plan(p), g = (pl.events || [])[0];
  ok(g && g.travel === null && ((await p.evaluate(() => window.__st['home/reminders'] || {})).list || []).filter(x => x.src === 'plan').length === 0, '6 planning guests adds no leave time and no leave reminders');
  const r = await t.open({ who: 'Eva', fresh: true, seed: { ...solo, 'home/household': { setup: 1, members: [{ id: 'a', name: 'Eva' }, { id: 'b', name: 'Tom' }, { id: 'c', name: 'Jana' }], kids: [] }, 'home/people': { people: { Eva: { setupDone: 1 }, Tom: { setupDone: 1 }, Jana: { setupDone: 1 } } } }, hash: 'rhythms', T: '2026-11-05T20:00:00', init: nh });
  const opts = await r.evaluate(() => { try { return [...new DOMParser().parseFromString(`<div>${remEditor()}</div>`, 'text/html').querySelectorAll('select[name=who] option')].map(o => o.textContent); } catch (e) { return [String(e)]; } });
  ok(opts.join('|') === 'For me|For Tom|For Jana|For everyone', '7 with three adults, a reminder can be for any of them or everyone: ' + opts.join('|'));
  const k = await t.open({ who: 'Eva', fresh: true, seed: { ...solo, 'home/household': { setup: 1, members: [{ id: 'a', name: 'Eva' }], kids: ['Adam'] } }, T: '2026-11-05T20:00:00', init: nh });
  ok(/Pack water, a snack and a comfort toy/.test(await card(k)) && /tell the kindergarten if the kids will be late|tell the kindergarten if Adam will be late/.test(await card(k)) || /Adds:[^\n]*Check the time and address; tell the kindergarten if (the kids|Adam) will be late/.test((await card(k)).replace(/\n/g, ' ')), '8 with a child, the child’s prep and the household’s own words come back');
  await done(t);
})();
