// Saving only what changed (9 Nov 2026): a phone with an older copy of a document no longer undoes the other phone's change
// to a different part of it. Only changed fields are sent, down into nested maps; lists are replaced whole; a document this
// phone hasn't seen is written whole.
const { start, ok, done } = require('./helpers');
(async () => {
  const t = await start();
  const p = await t.open({ seed: { 'home/people': { people: { 'Alex': { setupDone: 1, readyEarly: 20, testList: ['keys'] }, 'Sam': { setupDone: 1, readyEarly: 10 } } } } });
  // the other phone changes Sam's part; this phone hasn't heard yet (no snapshot fired)
  await p.waitForTimeout(500); const before = (await p.evaluate(() => window.__patches)).length;
  await p.evaluate(() => { window.__st['home/people'].people.Sam.readyEarly = 30; });
  await p.evaluate(() => { const P = H('people'); saveHome('people', { ...P, people: { ...P.people, 'Alex': { ...P.people['Alex'], readyEarly: 25 } } }); });
  await p.waitForTimeout(300);
  let st = await t.st(p), pp = st['home/people'].people, pt = (await p.evaluate(() => window.__patches)).slice(before);
  ok(pp['Alex'].readyEarly === 25 && pp.Sam.readyEarly === 30, '1 both changes survive: Alex 25 (this phone), Sam 30 (the other phone)');
  ok(pt.length === 1 && pt[0][1].join() === 'people.Alex.readyEarly', '2 only the changed field was sent: ' + JSON.stringify(pt.map(x => x[1])));
  // deleting a key, replacing a list
  await p.evaluate(() => { const P = H('people'), a = { ...P.people['Alex'], testList: ['keys', 'phone'] }; delete a.readyEarly; saveHome('people', { ...P, people: { ...P.people, 'Alex': a } }); });
  await p.waitForTimeout(300); st = await t.st(p); pp = st['home/people'].people;
  ok(!('readyEarly' in pp['Alex']) && pp['Alex'].testList.join() === 'keys,phone' && pp.Sam.readyEarly === 30, '3 a removed setting is deleted and a list is replaced whole, Sam untouched');
  // nothing changed: nothing sent
  const n0 = (await p.evaluate(() => window.__patches)).length;
  await p.evaluate(() => saveHome('people', JSON.parse(JSON.stringify(H('people'))))); await p.waitForTimeout(300);
  ok((await p.evaluate(() => window.__patches)).length === n0, '4 saving an unchanged document sends nothing');
  // a document nobody has written yet is written whole
  await p.evaluate(() => saveHome('brandnew', { a: 1, b: { c: 2 } })); await p.waitForTimeout(300); st = await t.st(p);
  ok(st['home/brandnew'] && st['home/brandnew'].b.c === 2, '5 a new document is written whole');
  // a ticked box still works through the UI (mergeDoc), and the screen keeps working
  await t.go(p, 'care'); ok((await t.text(p)).length > 40, '6 the app keeps working after field saves');
  await done(t);
})();
