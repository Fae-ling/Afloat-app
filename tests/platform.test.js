// The installed Afloat: sign-in, household data under apps/afloat, each person's own connections,
// connection errors pointing to Settings → Connections, the household list, and Meals in its own tab.
const { chromium, devices } = require('playwright'), fs = require('fs'), path = require('path'), http = require('http');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
(async () => {
  const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    if (p === '/platform/config.js') { r.writeHead(200, { 'content-type': 'text/javascript' }); return r.end("window.AFLOAT_CONFIG={firebase:{apiKey:'k',projectId:'p',storageBucket:'p.appspot.com'},region:'europe-west1'};"); }
    fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'text/plain' }); r.end(d); }); });
  await new Promise(r => srv.listen(0, r)); const base = `http://localhost:${srv.address().port}/`;
  const b = await chromium.launch(), ctx = await b.newContext({ ...devices['iPhone 13'], timezoneId: 'Europe/Prague' });
  await ctx.route('https://www.gstatic.com/firebasejs/**', (rt, rq) => rt.fulfill({ contentType: 'text/javascript', body: /firebase-app-compat/.test(rq.url()) ? fs.readFileSync(__dirname + '/fake-firebase.js', 'utf8') : '' }));
  const seed = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8')), fb = {};
  for (const [k, v] of Object.entries(seed)) fb['apps/afloat/' + k] = v;
  fb['apps/mealtime/recipes/r1'] = { name: 'Svíčková', ingredients: [], steps: [], servings: 4, createdAt: 1 };
  const errs = [];
  const shut = async p => { if (await p.$('[data-hp=close]')) { await p.tap('[data-hp=close]'); await p.waitForTimeout(200); } if (await p.$('[data-act=brief-close]')) { await p.tap('[data-act=brief-close]'); await p.waitForTimeout(200); } };
  const open = async (who, fns, fresh) => {
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    if (fresh) await p.addInitScript(() => { localStorage.removeItem('__fbuser'); });
    await p.addInitScript(([s, w]) => { window.__FBSEED = s; window.__SIGNIN_AS = w; localStorage.setItem('afloat.me', 'Alex'); localStorage.setItem('afloat.brief', 'x'); }, [fb, who]);
    await p.addInitScript(f => { window.__FN = Function('return ' + f)()()(); }, fns.toString());
    await p.clock.install({ time: new Date('2026-11-03T15:00:00') });
    await p.goto(base + '#today'); await p.waitForTimeout(800); return p;
  };
  const fns = () => () => ({
    connections: async (d, u) => { if (u.email === 'stranger@example.com') throw { code: 'functions/permission-denied', details: { code: 'not_member' } };
      return { email: u.email, owner: u.email === 'owner@example.com', gate: true, away: [{ email: 'stranger@example.com', how: 'sign-in', at: Date.parse('2026-11-03T14:10:00') }], members: ['owner@example.com', 'sam@example.com'], trello: { connected: false }, google: { connected: true, email: 'cal@example.com' }, config: { trelloKey: 'tk', googleClientId: 'gid' } }; },
    tool: async d => { if (d.server === 'Trello') throw { code: 'functions/failed-precondition', message: 'Trello isn’t connected yet.', details: { code: 'server_not_connected' } };
      if (d.tool === 'list_events') return { payload: { summary: 'cal@example.com', events: [] } }; return { payload: {} }; },
    setMembers: async d => ({ emails: d.emails }),
    connectTrello: async () => ({ connected: true, name: 'Alex' }),
    sample: async () => ({ text: '[]', value: [] }),
  });
  let p = await open({ uid: 'u1', email: 'owner@example.com' }, fns);
  ok(/Sign in with your Google account/.test(await p.textContent('#hp-sign')), '1 the app asks you to sign in with Google first');
  await p.tap('[data-hp=google]'); await p.waitForTimeout(1500); await shut(p);
  ok(!(await p.$('#hp-sign')) && /Good afternoon, Alex/.test(await p.textContent('#app')), '2 after signing in, the household opens');
  /* a tick: the mode buttons when Today shows them, otherwise the same save directly (calm Today folds them away) */
  await p.evaluate(() => { const m = document.querySelector('[data-act=mode]'); if (m) m.click(); else mergeDoc('days/' + dk, { done: { 'test:x': { by: 'Alex', at: 1 } } }); }); await p.waitForTimeout(400);
  ok(await p.evaluate(() => Object.keys(window.__FAKEFB.st).filter(k => k.startsWith('apps/afloat/days/')).length >= 1), '3 today’s ticks are saved under apps/afloat/');
  ok(await p.evaluate(() => window.__FAKEFB.calls.some(c => c[0] === 'tool' && c[1].server === 'Google Calendar' && c[1].tool === 'list_events')), '4 the calendar goes through your own Google connection');
  await p.goto(base + '#tasks'); await p.waitForTimeout(1500); await shut(p);
  const t = await p.textContent('#app');
  ok(/Trello isn’t connected for you yet\. Connect it in Settings → Connections\./.test(t), '5 without Trello, Tasks says where to connect it');
  await p.tap('#app [data-act=perm-manage]'); await p.waitForTimeout(500);
  const c = await p.textContent('#hp-conn');
  ok(/Trello\s*Not connected/.test(c) && /Google Calendar\s*Connected as cal@example.com/.test(c) && /sam@example.com/.test(c), '6 Connections shows Trello, Google and the household');
  ok(/Who’s kept out/.test(c) && /household-only/.test(c) && /stranger@example\.com/.test(c) && /turned away at sign-in/.test(c), '6b the owner sees that sign-in is household-only, and who was turned away');
  await p.screenshot({ path: __dirname + '/shots/platform-connections.png' });
  await p.fill('#hpMember', 'friend@example.com'); await p.tap('[data-hp=add]'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => window.__FAKEFB.calls.some(c => c[0] === 'setMembers' && c[1].emails.join() === 'sam@example.com,friend@example.com')), '7 the owner can add someone to the household');
  await ctx.route('https://trello.com/**', rt => rt.fulfill({ contentType: 'text/html', body: '<p>Trello</p>' }));
  await p.tap('[data-hp=trello]'); await p.waitForTimeout(800);
  const u = new URL(p.url());
  ok(u.host === 'trello.com' && u.searchParams.get('key') === 'tk' && u.searchParams.get('return_url') === base + 'platform/return.html', '8 Connect sends you to Trello to allow Afloat, and back');
  await p.goto(base + 'platform/return.html#token=' + 'a'.repeat(64)); await p.waitForTimeout(1500); await shut(p);
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem('__fbcalls') || '[]').some(c => c[0] === 'connectTrello' && c[1].token.length === 64)), '8b coming back from Trello connects it for you');
  await p.goto(base + '#today'); await p.waitForTimeout(1200); await shut(p);
  await p.evaluate(() => window.claude.openConnections()); await p.waitForTimeout(500);
  await p.setInputFiles('#hpImport', { name: 'export.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ apps: { afloat: { 'home/imported': { ok: 1 } }, mealtime: { 'recipes/r2': { name: 'Guláš' } } }, photos: { ['a'.repeat(32)]: { type: 'image/jpeg', data: 'AAAA' } } })) });
  await p.waitForTimeout(800);
  ok(await p.evaluate(() => !!window.__FAKEFB.st['apps/afloat/home/imported'] && !!window.__FAKEFB.st['apps/mealtime/recipes/r2'] && !!window.__FAKEFB.st['storage/assets/' + 'a'.repeat(32)]), '12 the export file from the claude.ai versions moves in, photos too');
  /* 12b: a household's facts file only adds the fields it names (10 Nov 2026) */
  await p.waitForTimeout(2000); await shut(p); await p.evaluate(() => window.claude.openConnections()); await p.waitForTimeout(800);
  await p.setInputFiles('#hpImport', { name: 'facts.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ merge: { afloat: { 'home/household': { about: 'Two adults.', nap: { kid: 'Mia', from: '12:00', to: '14:00' } } } } })) });
  await p.waitForTimeout(800);
  ok(await p.evaluate(() => { const h = window.__FAKEFB.st['apps/afloat/home/household']; return h.about === 'Two adults.' && h.nap.from === '12:00' && h.members.length === 2 && h.kids.length === 2 && !!h.doctor; }), '12b a facts file adds its fields and keeps the rest of the document');
  await p.goto(base + '#meals'); await p.waitForTimeout(2500); await shut(p);
  const fr = p.frame({ url: /meals\/index\.html/ });
  ok(!!fr && await p.evaluate(() => !document.querySelector('#meals').hidden), '9 Meals opens Mealtime inside Afloat');
  ok(fr && /Svíčková/.test(await fr.textContent('body')), '10 recipes load from the shared household data');
  await p.screenshot({ path: __dirname + '/shots/platform-meals.png' });
  const q = await open({ uid: 'u9', email: 'stranger@example.com' }, fns, true);
  await q.tap('[data-hp=google]'); await q.waitForTimeout(1200);
  ok(/Not in the household yet/.test(await q.textContent('#hp-sign')), '11 someone not on the list can’t get in');
  const r = await ctx.newPage(); r.on('pageerror', e => errs.push(e.message));
  await r.addInitScript(() => { localStorage.removeItem('__fbuser'); window.__SIGNIN_BLOCK = true; });
  await r.addInitScript(f => { window.__FN = Function('return ' + f)()()(); }, fns.toString());
  await r.goto(base + '#today'); await r.waitForTimeout(800); await r.tap('[data-hp=google]'); await r.waitForTimeout(800);
  ok(/This Afloat is private/.test(await r.textContent('#hp-sign')), '13 with the household-only door on, a stranger is turned away at sign-in');
  /* 14–17: a friend's household (10 Nov 2026): invited → start it → data under households/<hid>/, its own Claude key */
  const ctx2 = await b.newContext({ ...devices['iPhone 13'], timezoneId: 'Europe/Prague' });
  await ctx2.route('https://www.gstatic.com/firebasejs/**', (rt, rq) => rt.fulfill({ contentType: 'text/javascript', body: /firebase-app-compat/.test(rq.url()) ? fs.readFileSync(__dirname + '/fake-firebase.js', 'utf8') : '' }));
  const fns2 = () => () => {
    const H2 = { hid: 'h2', base: 'households/h2/', legacy: false, name: 'The Nováks' }, made = () => localStorage.getItem('__made') === '1';
    return {
      connections: async (d, u) => made() ? { email: u.email, owner: true, admin: false, house: H2, members: [u.email], claude: { own: true, set: false }, trello: { connected: false }, google: { connected: false }, config: {} }
        : { email: u.email, invited: true, house: null, config: {} },
      createHousehold: async d => { localStorage.setItem('__made', '1'); localStorage.setItem('__hname', d.name); return { house: H2 }; },
      setClaudeKey: async () => ({ set: true, hint: 'abcd' }),
      tool: async () => ({ payload: { events: [] } }), sample: async () => { throw { code: 'functions/failed-precondition', details: { code: 'no_key' }, message: 'no key' }; },
    };
  };
  const f = await ctx2.newPage(); f.on('pageerror', e => errs.push(e.message));
  await f.addInitScript(([w]) => { window.__FBSEED = {}; window.__SIGNIN_AS = w; localStorage.setItem('afloat.me', 'Eva'); localStorage.setItem('afloat.brief', 'x'); }, [{ uid: 'f1', email: 'eva@example.com' }]);
  await f.addInitScript(fn => { window.__FN = Function('return ' + fn)()()(); }, fns2.toString());
  await f.goto(base + '#today'); await f.waitForTimeout(800); await f.tap('[data-hp=google]'); await f.waitForTimeout(1200);
  ok(/Start your household/.test(await f.textContent('#hp-sign')), '14 an invited friend is asked to start their household');
  await f.fill('#hpHouse', 'The Nováks'); await f.tap('[data-hp=create]'); await f.waitForTimeout(2500); await shut(f);
  ok(await f.evaluate(() => localStorage.getItem('__hname') === 'The Nováks' && !document.querySelector('#hp-sign') && (window.claude.household() || {}).hid === 'h2'), '15 starting it opens Afloat in the new household');
  await f.evaluate(() => mergeDoc('days/' + dk, { done: { 'test:x': { by: 'Eva', at: 1 } } })); await f.waitForTimeout(400);
  const keys = await f.evaluate(() => Object.keys(window.__FAKEFB.st));
  ok(keys.some(k => k.startsWith('households/h2/apps/afloat/days/')) && !keys.some(k => k.startsWith('apps/')), '16 the friend’s things are saved under households/h2/, nothing in the first household’s folder');
  ok(await f.evaluate(() => !ourHome() && !(H('reminders').list || []).some(r => /vitamins|Pip/i.test(r.text))), '16b a new household gets none of the first household’s starting reminders');
  await f.evaluate(() => window.claude.openConnections()); await f.waitForTimeout(500);
  ok(/Claude\s*Off: your household uses its own Claude API key/.test(await f.textContent('#hp-conn')) && !!(await f.$('#hpKey')), '17 Connections asks for the household’s own Claude key');
  await f.fill('#hpKey', 'sk-ant-api03-' + 'x'.repeat(40)); await f.tap('[data-hp=key]'); await f.waitForTimeout(400);
  ok(await f.evaluate(() => window.__FAKEFB.calls.some(c => c[0] === 'setClaudeKey' && /^sk-ant-/.test(c[1].key))), '17b the key goes to the server');
  const ph = await f.evaluate(() => window.claude.blobUrl('b'.repeat(32)));
  ok(/o\/households%2Fh2%2Fassets%2Fb{32}\?alt=media$/.test(ph), '17c the household’s photos have their own folder');
  console.log(errs.length ? errs.join('\n') : 'NO PAGE ERRORS'); await b.close(); srv.close();
})();
