// The real-Firebase check (runs on GitHub: .github/workflows/real-firebase.yml). Two "phones" run the real app, with the real
// Firebase SDK and the real security rules (firestore.rules), against Firebase's local emulator: a throwaway database, never
// the household's. It checks that saving only what changed works on real Firestore, that a phone that was offline doesn't
// undo the other phone's change, the two calendar queries, that someone outside the household is refused, and that a
// second household keeps its data in its own folder, apart from the first.
// Run inside the emulator:  firebase emulators:exec --config tests/real-firebase/firebase.json --only firestore,auth --project demo-afloat "node tests/real-firebase/check.js"
const { chromium, devices } = require('playwright'), http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../..'), OWNER = 'owner@afloat.test';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.json': 'application/json' };
const CONFIG = `window.AFLOAT_CONFIG = { firebase: { apiKey: 'demo-key', projectId: 'demo-afloat', authDomain: 'demo-afloat.firebaseapp.com', storageBucket: 'demo-afloat.appspot.com', appId: 'demo' }, region: 'europe-west1',
  emulators: { host: '127.0.0.1', firestore: 8080, auth: 9099, functions: 5001 } };`;
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const day = n => { const d = new Date(Date.now() + n * 864e5); return d.toISOString().slice(0, 10); };
const D = 'apps/afloat/home/people';

(async () => {
  const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    if (p === '/platform/config.js') { r.writeHead(200, { 'content-type': 'text/javascript' }); return r.end(CONFIG); }
    fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'text/plain' }); r.end(d); }); });
  await new Promise(r => srv.listen(0, r)); const base = `http://localhost:${srv.address().port}/`;
  const b = await chromium.launch();
  /* one phone: its own browser (own offline storage), signed in through the emulator, the app ready */
  const phone = async (me, email = OWNER) => {
    const ctx = await b.newContext({ ...devices['iPhone 13'] }), p = await ctx.newPage(), errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(([n]) => { localStorage.setItem('afloat.me', n); localStorage.setItem('afloat.brief', 'x'); }, [me]);
    await p.goto(base + '#today');
    await p.waitForFunction(() => window.firebase && firebase.apps && firebase.apps.length, null, { timeout: 30000 });
    await p.evaluate(e => firebase.auth().signInWithCredential(firebase.auth.GoogleAuthProvider.credential(JSON.stringify({ sub: e.replace(/\W/g, ''), email: e, email_verified: true }))), email);
    p.errs = errs; return p;
  };
  const ready = p => p.waitForFunction(() => window.__afloatReady, null, { timeout: 60000 });
  const server = (p, d = D) => p.evaluate(async x => { const s = await firebase.firestore().doc(x).get({ source: 'server' }); return s.exists ? s.data() : null; }, d);
  const until = async (p, fn, arg, ms = 15000) => { try { await p.waitForFunction(fn, arg, { timeout: ms }); return true; } catch { return false; } };

  const A = await phone('Alex'), B = await phone('Sam'); await ready(A); await ready(B);
  ok(true, '0 both phones signed in through the emulator and Afloat started');

  // 1. both phones see the same document
  await A.evaluate(x => firebase.firestore().doc(x).set({ people: { 'Alex': { setupDone: 1, readyEarly: 20, testList: ['keys'] }, 'Sam': { setupDone: 1, readyEarly: 10 } } }), D);
  ok(await until(B, () => ((H('people').people || {}).Sam || {}).readyEarly === 10), '1 a saved document reaches the other phone');

  // 2. Sam's phone is offline and changes his part; Alex's phone changes hers; Sam's phone comes back
  await B.evaluate(() => firebase.firestore().disableNetwork());
  await B.evaluate(() => { const P = H('people'); saveHome('people', { ...P, people: { ...P.people, Sam: { ...P.people.Sam, readyEarly: 15 } } }); });
  await A.evaluate(() => { const P = H('people'); saveHome('people', { ...P, people: { ...P.people, 'Alex': { ...P.people['Alex'], readyEarly: 25 } } }); });
  await A.waitForTimeout(1500);
  await B.evaluate(() => firebase.firestore().enableNetwork());
  await until(A, () => ((H('people').people || {}).Sam || {}).readyEarly === 15);
  let s = await server(A);
  ok(s && s.people['Alex'].readyEarly === 25 && s.people.Sam.readyEarly === 15, `2 a phone that was offline doesn't undo the other phone's change (Alex ${s && s.people['Alex'].readyEarly}, Sam ${s && s.people.Sam.readyEarly})`);

  // 2b. the same situation with the old whole-document save loses a change: proof that check 2 tests something real
  await B.evaluate(() => firebase.firestore().disableNetwork());
  await B.evaluate(x => { const P = JSON.parse(JSON.stringify(H('people'))); P.people.Sam.readyEarly = 16; firebase.firestore().doc(x).set(P); }, D);
  await A.evaluate(() => { const P = H('people'); saveHome('people', { ...P, people: { ...P.people, 'Alex': { ...P.people['Alex'], readyEarly: 26 } } }); });
  await A.waitForTimeout(1500);
  await B.evaluate(() => firebase.firestore().enableNetwork()); await until(A, () => ((H('people').people || {}).Sam || {}).readyEarly === 16);
  s = await server(A);
  ok(s && s.people['Alex'].readyEarly === 25, `2b (control) the old way, a whole-document save from the offline phone, does undo it (Alex back to ${s && s.people['Alex'].readyEarly})`);

  // 3. deleting a setting and replacing a list
  await A.evaluate(() => { const P = H('people'), a = { ...P.people['Alex'], testList: ['keys', 'phone'] }; delete a.readyEarly; saveHome('people', { ...P, people: { ...P.people, 'Alex': a } }); });
  await until(B, () => (((H('people').people || {})['Alex'] || {}).testList || []).length === 2);
  s = await server(B);
  ok(s && !('readyEarly' in s.people['Alex']) && s.people['Alex'].testList.join() === 'keys,phone' && s.people.Sam.readyEarly === 16, '3 a removed setting is deleted and a list replaced, the rest untouched');

  // 4. a document deleted elsewhere: the next save writes it whole again
  await A.evaluate(x => firebase.firestore().doc(x).delete(), D);
  await B.waitForTimeout(1500);
  await B.evaluate(() => { const P = H('people'); saveHome('people', { ...P, people: { ...P.people, Sam: { ...P.people.Sam, readyEarly: 17 } } }); });
  await until(A, () => ((H('people').people || {}).Sam || {}).readyEarly === 17);
  s = await server(A);
  ok(s && s.people.Sam.readyEarly === 17 && s.people['Alex'] && s.people['Alex'].testList, '4 saving to a document deleted elsewhere puts the whole document back');

  // 5. a brand-new document, and a tick (mergeDoc)
  await A.evaluate(() => saveHome('checknew', { a: 1, b: { 'Alex': 2 } }));
  await A.evaluate(() => mergeDoc('days/' + dk, { done: { 'check:x': { by: 'Alex', at: 1 } } }));
  await A.waitForTimeout(1500);
  s = await server(A, 'apps/afloat/home/checknew'); const dd = await A.evaluate(() => dk);
  const tick = await server(A, 'apps/afloat/days/' + dd);
  ok(s && s.b['Alex'] === 2 && tick && tick.done['check:x'], '5 a new document and a tick are saved');

  // 6. calendar events: the window and the repeating ones, with real Firestore queries
  const ev = (title, date, extra = {}) => ({ title, kind: 'family', who: ['Alex'], date, endDate: date, allDay: true, start: '', end: '', place: '', notes: '', at: 1, by: 'Sam', ...extra });
  await A.evaluate(([o, r, n]) => Promise.all([firebase.firestore().doc('apps/afloat/events/chk-old').set(o), firebase.firestore().doc('apps/afloat/events/chk-rep').set(r), firebase.firestore().doc('apps/afloat/events/chk-new').set(n)]),
    [ev('Old', day(-120)), ev('Weekly', day(-400), { recur: { freq: 'WEEKLY', interval: 1, ends: 'never' }, rrule: 'RRULE:FREQ=WEEKLY' }), ev('Soon', day(3))]);
  await until(B, () => S.events && S.events['chk-new'] && S.events['chk-rep']);
  const ids = await B.evaluate(() => Object.keys(S.events).filter(k => k.startsWith('chk-')).sort().join());
  ok(ids === 'chk-new,chk-rep', '6 the calendar loads coming and repeating events, not ones that ended months ago: ' + ids);

  // 7. the security rules: someone signed in who isn't the household is refused
  const C = await phone('Stranger', 'stranger@afloat.test');
  const refused = await C.evaluate(async () => { try { await firebase.firestore().doc('apps/afloat/home/x').set({ a: 1 }); return 'written'; } catch (e) { return e.code; } });
  const peek = await C.evaluate(async () => { try { await firebase.firestore().doc('apps/afloat/home/people').get({ source: 'server' }); return 'read'; } catch (e) { return e.code; } });
  ok(refused === 'permission-denied' && peek === 'permission-denied', `7 someone outside the household can't write (${refused}) or read (${peek})`);

  // 9. a second household (10 Nov 2026): its data lives under households/<hid>/, and the two households can't see each other
  const REST = 'http://127.0.0.1:8080/v1/projects/demo-afloat/databases/(default)/documents/';
  const val = v => Array.isArray(v) ? { arrayValue: { values: v.map(val) } } : v && typeof v === 'object' ? { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, val(x)])) } } : typeof v === 'number' ? { integerValue: String(v) } : { stringValue: String(v) };
  /* written as the emulator's "owner" (the server's view), past the rules: only the server creates households */
  const put = (p, o) => fetch(REST + p, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'content-type': 'application/json' }, body: JSON.stringify({ fields: Object.fromEntries(Object.entries(o).map(([k, v]) => [k, val(v)])) }) }).then(r => r.status);
  const FR = 'friend@afloat.test', HP = 'households/h2/apps/afloat/home/people';
  const st = [await put('households/h2', { name: 'Friends', owner: FR, members: [FR] }), await put('users/' + FR, { hid: 'h2' })];
  ok(st.every(x => x === 200), '9a the emulator takes a second household (as the server would write it): ' + st.join());
  const Fp = await phone('Friend', FR); await ready(Fp);
  const fh = await Fp.evaluate(() => window.claude.household());
  ok(fh && fh.hid === 'h2' && fh.base === 'households/h2/' && fh.legacy === false, '9b the friend’s Afloat finds its household: ' + JSON.stringify(fh));
  await Fp.evaluate(() => saveHome('people', { people: { Friend: { readyEarly: 30 } } }));
  await Fp.waitForTimeout(1500);
  s = await server(Fp, HP);
  ok(s && s.people.Friend.readyEarly === 30, '9c the friend’s saves land in their own household’s folder');
  const firstStill = await server(A);
  ok(firstStill && !(firstStill.people || {}).Friend, '9d the first household’s data is untouched');
  const tryIt = (p, fn) => p.evaluate(async ([f]) => { try { await eval(f); return 'allowed'; } catch (e) { return e.code; } }, [fn]);
  const peeks = {
    friendReadsFirst: await tryIt(Fp, "firebase.firestore().doc('apps/afloat/home/people').get({ source: 'server' })"),
    friendWritesFirst: await tryIt(Fp, "firebase.firestore().doc('apps/afloat/home/x').set({ a: 1 })"),
    firstReadsFriend: await tryIt(A, `firebase.firestore().doc('${HP}').get({ source: 'server' })`),
    firstWritesFriend: await tryIt(A, `firebase.firestore().doc('${HP}').set({ a: 1 })`),
    strangerReadsFriend: await tryIt(C, `firebase.firestore().doc('${HP}').get({ source: 'server' })`),
    friendAddsMember: await tryIt(Fp, "firebase.firestore().doc('households/h2').set({ owner: 'friend@afloat.test', members: ['friend@afloat.test', 'stranger@afloat.test'] })"),
    friendMovesSomeone: await tryIt(Fp, "firebase.firestore().doc('users/stranger@afloat.test').set({ hid: 'h2' })"),
    friendReadsOthersEntry: await tryIt(Fp, "firebase.firestore().doc('users/owner@afloat.test').get({ source: 'server' })"),
    friendReadsKeys: await tryIt(Fp, "firebase.firestore().doc('hkeys/h2').get({ source: 'server' })"),
  };
  const leaks = Object.entries(peeks).filter(([, v]) => v !== 'permission-denied');
  ok(!leaks.length, '9e the households are kept apart, and nobody can add themselves to one: ' + (leaks.length ? 'LEAK ' + JSON.stringify(leaks) : 'all refused'));
  const own = await tryIt(Fp, "firebase.firestore().doc('households/h2').get({ source: 'server' })");
  ok(own === 'allowed', '9f a member can read their own household’s name and members (' + own + ')');

  // 10. planning together (11 Nov 2026): a plan in together/<id> is read by its members only, and they change only the plan
  const TP = { plan: { id: 'tp1', title: 'Lisbon', pack: [{ id: 'a', text: 'Tent' }] }, owner: FR, members: [FR, 'owner@afloat.test'], houses: { h2: { lead: FR } }, names: {}, invited: {}, inv: [], at: 1 };
  ok(await put('together/tp1', TP) === 200, '10a the emulator takes a shared plan (as the server would write it)');
  const seen = await A.evaluate(async () => { const t = await window.claude.use('together'); return new Promise(res => { const off = t.watch(l => { if (l.length) { off(); res(l.map(x => x.plan.title)); } }); setTimeout(() => res('none'), 8000); }); });
  ok(Array.isArray(seen) && seen.join() === 'Lisbon', '10b a member’s Afloat sees the shared plan: ' + JSON.stringify(seen));
  const saved = await A.evaluate(async () => { try { const t = await window.claude.use('together'); await t.save('tp1', { title: 'Lisbon, December' }); return 'allowed'; } catch (e) { return e.code; } });
  await Fp.waitForTimeout(800);
  const fread = await Fp.evaluate(async () => (await firebase.firestore().doc('together/tp1').get({ source: 'server' })).data());
  ok(saved === 'allowed' && fread && fread.plan.title === 'Lisbon, December' && fread.plan.pack[0].text === 'Tent', '10c a member in another household changes the plan, and only the part they changed (' + saved + ')');
  const tpeeks = {
    strangerReads: await tryIt(C, "firebase.firestore().doc('together/tp1').get({ source: 'server' })"),
    memberAddsSomeone: await tryIt(Fp, "firebase.firestore().doc('together/tp1').update({ members: ['friend@afloat.test', 'owner@afloat.test', 'stranger@afloat.test'] })"),
    memberMakesOwn: await tryIt(Fp, "firebase.firestore().doc('together/tp9').set({ plan: {}, members: ['friend@afloat.test'] })"),
    memberDeletes: await tryIt(Fp, "firebase.firestore().doc('together/tp1').delete()"),
    strangerChanges: await tryIt(C, "firebase.firestore().doc('together/tp1').update({ 'plan.title': 'x' })"),
  };
  const tleaks = Object.entries(tpeeks).filter(([, v]) => v !== 'permission-denied');
  ok(!tleaks.length, '10d nobody else reads a shared plan, and no member can add people, start one or delete it: ' + (tleaks.length ? 'LEAK ' + JSON.stringify(tleaks) : 'all refused'));

  const pe = [...A.errs, ...B.errs, ...Fp.errs].filter(m => !/functions|internal|Failed to fetch|network|connections|5001/i.test(m));
  ok(!pe.length, '8 no unexpected page errors' + (pe.length ? ': ' + pe.slice(0, 3).join(' | ') : ''));
  console.log(fails ? `${fails} check(s) failed` : 'All real-Firebase checks passed');
  await b.close(); srv.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FAIL the check itself stopped: ' + (e && e.stack || e)); process.exit(1); });
