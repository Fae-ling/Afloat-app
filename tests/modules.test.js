// What Afloat helps with (10 Nov 2026): a household's modules decide which tabs, cards and nudges it sees.
// A one-person household without children sees nothing about kids, partners, couples or signals; our household keeps it all;
// switching a module off in Settings takes its tab away, and on again brings it back.
const { start, ok, done } = require('./helpers');
(async () => {
  const t = await start();
  const tabs = p => p.$$eval('#tabs a, .subnav a', as => as.map(a => a.innerText.trim()).join('|'));

  // our household, as it was: everything there
  const o = await t.open({ T: '2026-11-05T19:00:00' });
  ok(/Together/.test(await tabs(await (async () => { await t.go(o, 'care'); return o; })())) && /Trips/.test(await tabs(o)), '1 our household still has Together and Trips');
  await t.go(o, 'family'); ok(/Partners & friends/i.test(await t.text(o)), '1b and partners in Family');
  await t.go(o, 'support'); ok(/A kid is sick/.test(await t.text(o)) && /Tell the others without talking/.test(await t.text(o)), '1c and sick days and signals in Support');

  // another household: one adult, no children, not the first household
  const seed = { 'home/household': { setup: 1, members: [{ id: 'e1', name: 'Eva' }], kids: [] }, 'home/calendar': {}, 'home/people': { people: { Eva: { setupDone: 1 } } } };
  const p = await t.open({ who: 'Eva', seed, fresh: true, T: '2026-11-05T19:00:00', init: () => { window.claude.household = () => ({ hid: 'h2', base: 'households/h2/', legacy: false, name: 'Eva' }); } });
  await t.go(p, 'care'); const tb = await tabs(p);
  ok(!/Together/.test(tb) && /Trips/.test(tb) && /Meals/.test(tb) && /Family/.test(tb), '2 no Together for one adult without children, but Trips stay on by default: ' + tb);
  await t.go(p, 'today'); const today = await t.text(p);
  ok(!/girls|kindergarten|hlídání|pick-up|Bedtime|Mia|Zoe/i.test(today), '3 Today says nothing about children' + (/girls|kindergarten|hlídání|pick-up|Bedtime|Mia|Zoe/i.test(today) ? ': ' + today.match(/.{0,40}(girls|kindergarten|hlídání|pick-up|Bedtime|Mia|Zoe).{0,40}/i)[0] : ''));
  await t.go(p, 'support'); const sp = await t.text(p);
  ok(!/A kid is sick/.test(sp) && !/Tell the household/.test(sp) && !/girls/i.test(sp), '4 Support has no sick-kid mode and no signals to nobody');
  await t.go(p, 'family'); const fam = await t.text(p);
  ok(/Friends/i.test(fam) && !/Partners & friends/i.test(fam), '5 Family has friends, not partners');
  await t.go(p, 'together'); ok(await p.evaluate(() => S.view === 'today'), '6 a switched-off screen opens Today instead');

  // Settings → What Afloat helps with
  await t.go(p, 'today'); await t.tap(p, '[data-act=settings]');
  const st = await t.text(p, '#sheet');
  ok(/What Afloat helps with/i.test(st) && /Partners in Family/.test(st) && !/Paediatrician/i.test(st), '7 Settings lists the modules (and no paediatrician without children)');
  ok(await p.$eval('[data-act=mod-sw][data-k=together]', b => b.getAttribute('aria-checked')) === 'false', '7b Together starts off for one adult');
  await t.tap(p, '[data-act=mod-sw][data-k=meals]');
  ok(await p.evaluate(() => H('household').modules.meals === false), '8 switching Meals off is saved for the household');
  await t.tap(p, 'button[data-act=close-settings]'); await t.go(p, 'care');
  ok(!/Meals/.test(await tabs(p)), '8b and the Meals tab is gone: ' + await tabs(p));
  await t.tap(p, '[data-act=settings]'); await t.tap(p, '[data-act=mod-sw][data-k=trips]'); await t.tap(p, 'button[data-act=close-settings]'); await t.go(p, 'care');
  ok(!/Trips/.test(await tabs(p)), '9 switching Trips off removes the tab, even without children');
  await t.tap(p, '[data-act=settings]'); await t.tap(p, '[data-act=mod-sw][data-k=partners]'); await t.tap(p, 'button[data-act=close-settings]'); await t.go(p, 'family');
  ok(/Partners & friends/i.test(await t.text(p)), '10 partners can be switched on by a household that wants them');

  // a new household with two or three adults is asked whether there's a couple, instead of guessing from the number of adults
  const two = { 'home/household': { setup: 1, members: [{ id: 'a', name: 'Eva' }, { id: 'b', name: 'Jana' }], kids: [] }, 'home/people': { people: { Eva: { setupDone: 1 }, Jana: { setupDone: 1 } } } };
  const nh = () => { window.claude.household = () => ({ hid: 'h3', base: 'households/h3/', legacy: false, name: '' }); };
  const q = await t.open({ who: 'Eva', seed: two, fresh: true, init: nh });
  ok(/Is there a couple here\?/i.test(await t.text(q)) && await q.evaluate(() => !modOn('together')), '11 two adults are asked, and Together stays off meanwhile');
  await t.tap(q, '[data-act=cp-no]');
  ok(await q.evaluate(() => H('household').modules.together === false) && !/Is there a couple here/i.test(await t.text(q)), '11b “Not for us” keeps it off and the question goes away');
  const three = { ...two, 'home/household': { setup: 1, members: [{ id: 'a', name: 'Eva' }, { id: 'b', name: 'Jana' }, { id: 'c', name: 'Petr' }], kids: [] } };
  const r = await t.open({ who: 'Eva', seed: three, fresh: true, init: nh });
  ok(await r.$eval('[data-act=cp-yes]', b => b.disabled), '12 with three adults, the couple has to be picked first');
  await t.tap(r, '[data-act=cp-pick][data-n=Petr]'); await t.tap(r, '[data-act=cp-yes]');
  ok(await r.evaluate(() => modOn('together') && relPair().join() === 'Eva,Petr'), '12b picking Eva and Petr switches Together on for those two');
  // a new household with children starts with generic lists only: the pick-up reminder, rhythms, no first-household details
  const kidsSeed = { 'home/household': { setup: 1, members: [{ id: 'a', name: 'Eva' }, { id: 'b', name: 'Tom' }], kids: ['Adam'] }, 'home/people': { people: { Eva: { setupDone: 1 }, Tom: { setupDone: 1 } } } };
  const k = await t.open({ who: 'Eva', seed: kidsSeed, fresh: true, init: nh });
  await t.go(k, 'rhythms'); await k.waitForTimeout(500); await t.go(k, 'today'); await k.waitForTimeout(500);
  const got = await k.evaluate(() => ({ rem: (H('reminders').list || []).map(x => x.text), rj: [...(H('rhythms').weekly || []), ...(H('rhythms').every || []), ...(H('rhythms').monthly || [])].map(x => x.text), bed: (H('lists').bedtime || []).map(x => x.text) }));
  ok(got.rem.length === 1 && /Five-minute pick-up with Adam/.test(got.rem[0]), '13 a new household with a child starts with one reminder, worded for the child: ' + got.rem.join(' | '));
  ok(got.rj.length >= 10 && got.rj.some(x => /Toy rotation/.test(x)) && !got.rj.some(x => /cat|gecko|car|fireplace|birthday/i.test(x)), '13b generic starting rhythms, kids’ ones included, nothing about another household’s home');
  ok(got.bed.length >= 4 && !got.bed.some(x => /Večerníček|Lotion/i.test(x)), '13c a generic bedtime list');
  // Settings → About your home: kept on the household, read by Claude's prompts and the at-home check
  await t.tap(k, '[data-act=settings]');
  await k.fill('#hh_address', 'Lipová 12, Brno'); await k.dispatchEvent('#hh_address', 'change');
  await k.fill('#hh_about', 'One cat; we cycle everywhere.'); await k.dispatchEvent('#hh_about', 'change');
  await k.selectOption('#hh_nap_kid', 'Adam'); await k.waitForTimeout(300);
  const f = await k.evaluate(() => ({ facts: houseFacts(), home: placeIsHome('Lipová 12'), away: placeIsHome('Café Lipa'), nap: napOf(), trips: tripCats()[0][2] }));
  ok(/Eva and Tom/.test(f.facts) && /Adam/.test(f.facts) && /Lipová 12, Brno/.test(f.facts) && /we cycle everywhere/.test(f.facts), '14 Claude is told about this household from its own data: ' + f.facts);
  ok(f.home && !f.away && f.nap && f.nap.kid === 'Adam' && /11:30/.test(f.trips), '14b the address counts as home; the nap shapes the trips');
  await done(t);
})();
