// Meals → At home (5 Nov 2026): food at home with rough levels and Claude's use-by guess, a use-soon strip, pantry staples;
// a receipt or delivery-app screenshot read by Claude and reviewed before saving (food added, staples refilled, bought
// cards on Nákup - Jídlo / Drogerie / Lékárna ticked off on Trello, non-food not added); used up → asks about Nákup - Jídlo,
// "always" adds by itself; "What can we cook?"; and a quiet use-soon line in Afloat's afternoon briefing.
const { chromium, devices } = require('playwright'), fs = require('fs'), path = require('path'), http = require('http');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const FOOD = 'ari:cloud:trello::list/workspace/6a1e92a361a3f00196409288/6a1e953b3b05a925cdce19da', DRUG = 'ari:cloud:trello::list/workspace/6a1e92a361a3f00196409288/6a1e9536c83a5bda7d76c525', MED = 'ari:cloud:trello::list/workspace/6a1e92a361a3f00196409288/6a1e9574b399a97a0821e877';
(async () => {
  const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    if (p === '/platform/config.js') { r.writeHead(200, { 'content-type': 'text/javascript' }); return r.end("window.AFLOAT_CONFIG={firebase:{apiKey:'k',projectId:'p',storageBucket:'p.appspot.com'},region:'europe-west1'};"); }
    fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'text/plain' }); r.end(d); }); });
  await new Promise(r => srv.listen(0, r)); const base = `http://localhost:${srv.address().port}/`;
  const b = await chromium.launch(), ctx = await b.newContext({ ...devices['iPhone 13'], timezoneId: 'Europe/Prague' });
  await ctx.route('https://www.gstatic.com/firebasejs/**', (rt, rq) => rt.fulfill({ contentType: 'text/javascript', body: /firebase-app-compat/.test(rq.url()) ? fs.readFileSync(__dirname + '/fake-firebase.js', 'utf8') : '' }));
  const seed = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8')), fb = {}, M = 'apps/mealtime/';
  for (const [k, v] of Object.entries(seed)) fb['apps/afloat/' + k] = v;
  fb[M + 'recipes/r1'] = { name: 'Špenátové těstoviny', ingredients: [{ name: 'špenát' }, { name: 'těstoviny' }], steps: [], servings: 4, createdAt: 1 };
  fb[M + 'pantry/p1'] = { name: 'Špenát', where: 'fridge', level: 3, added: '2026-11-03', useBy: '2026-11-05' };
  fb[M + 'pantry/p2'] = { name: 'Jogurty', where: 'fridge', level: 2, added: '2026-11-01', useBy: '2026-11-12' };
  fb[M + 'pantry/p3'] = { name: 'Rohlíky', where: 'pantry', level: 1, added: '2026-11-04', useBy: '2026-11-06' };
  fb[M + 'settings/app'] = { peopleMoved: 1 };
  const shut = async p => { if (await p.$('[data-hp=close]')) { await p.tap('[data-hp=close]'); await p.waitForTimeout(200); } if (await p.$('button.btn[data-act=brief-close]')) { await p.tap('button.btn[data-act=brief-close]'); await p.waitForTimeout(200); } };
  const errs = [], p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(([s, F, D, Md]) => {
    window.__FBSEED = s; window.__SIGNIN_AS = { uid: 'u1', email: 'owner@example.com' }; localStorage.setItem('afloat.me', 'Alex'); localStorage.setItem('afloat.brief', 'x');
    const T = window.top; T.__TR = T.__TR || { [F]: [{ id: 'c1', name: 'Mléko' }, { id: 'c4', name: 'Vejce' }], [D]: [{ id: 'c2', name: 'Toaletní papír' }, { id: 'c3', name: 'Šampon' }], [Md]: [] }; T.__TRW = T.__TRW || []; T.__PR = T.__PR || [];
    window.__FN = { connections: async (d, u) => ({ email: u.email, owner: true, members: ['owner@example.com'], trello: { connected: true }, google: { connected: false }, config: {} }),
      tool: async d => { const a = d.args || {}, Tr = window.top.__TR;
        if (d.tool === 'trelloReadCard' && a.action === 'list_by_list') return { payload: { cards: (Tr[a.listId] || []).filter(c => !c.complete) } };
        if (d.tool === 'trelloWriteCard') { window.top.__TRW.push(a); if (a.action === 'create') (Tr[a.listId] = Tr[a.listId] || []).push({ id: 'n' + window.top.__TRW.length, name: a.name }); if (a.action === 'mark_done') for (const l of Object.values(Tr)) for (const c of l) if (c.id === a.cardId) c.complete = true; return { payload: { id: 'x' } }; }
        return { payload: { events: [], cards: [] } }; },
      sample: async d => { const t = typeof d.input === 'string' ? d.input : JSON.stringify(d.input); window.top.__PR.push({ t, images: (d.images || []).length });
        if (/receipt/.test(t)) return { text: '', value: { items: [{ name: 'Mléko polotučné', kind: 'food', where: 'fridge', days: 7, staple: null }, { name: 'Rajčata', kind: 'food', where: 'bowl', days: 5, staple: null }, { name: 'Mouka hladká', kind: 'food', where: 'pantry', days: 300, staple: 'mouka-hladka' }, { name: 'Toaletní papír', kind: 'drug' }, { name: 'Paralen', kind: 'med' }], bought: ['Mléko (Nákup - Jídlo)', 'Šampon (Nákup - Drogerie)'].map(n => (t.match(new RegExp('(C\\d+): ' + n.replace(/[()]/g, '\\$&'))) || [])[1]).filter(Boolean) } };
        if (/decide what to cook/.test(t)) return { text: '', value: { ideas: [{ title: 'Špenátové těstoviny', recipeId: 'r1', why: 'Uses the spinach today', minutes: 20, uses: ['Špenát'], missing: [] }, { title: 'Rajčatová polévka', recipeId: null, why: 'Quick', minutes: 15, uses: ['Rajčata'], missing: ['Smetana'], ingredients: ['rajčata', 'smetana'], steps: ['Uvař', 'Rozmixuj'] }] } };
        if (/stays good at home/.test(t)) return { text: '', value: { days: { 'Sýr': 14 } } };
        return { text: '', value: {} }; } };
  }, [fb, FOOD, DRUG, MED]);
  await p.clock.install({ time: new Date('2026-11-05T16:00:00') });
  await p.goto(base + '#meals'); await p.waitForTimeout(800);
  if (await p.$('[data-hp=google]')) { await p.tap('[data-hp=google]'); await p.waitForTimeout(1500); }
  await shut(p); await p.goto(base + '#meals'); await p.waitForTimeout(2500); await shut(p);
  const fr = p.frame({ url: /meals\/index\.html/ }), st = () => p.evaluate(() => window.__FAKEFB.st), TRW = () => p.evaluate(() => window.top.__TRW);
  await fr.click('[data-tab=home]'); await fr.waitForTimeout(1200); await (await fr.$('#view')).screenshot({ path: __dirname + '/shots/at-home.png' });
  let t = await fr.textContent('#view');
  ok(/At home/.test(t) && /Use soon/.test(t) && /Špenát · use today/.test(t) && /Rohlíky · use tomorrow/.test(t) && !/Jogurty ·/.test(t), '1 At home: a use-soon strip with what needs using today and tomorrow');
  ok(/Fridge/.test(t) && /Pantry staples/.test(t) && /Mouka hladká/.test(t) && /some/.test(t), '2 groups by where it lives, rough levels, and the pantry staples');

  // rough levels; used up asks; always adds by itself; went off just goes
  await fr.click('[data-act=phLevel][data-id=p2]'); await fr.waitForTimeout(200);
  ok((await st())[M + 'pantry/p2'].level === 1, '3 tapping the level steps it down (some → last bit)');
  await fr.click('[data-act=phUsed][data-id=p3]'); await fr.waitForTimeout(250);
  ok(!(await st())[M + 'pantry/p3'] && /Rohlíky<\/b> is used up/.test(await fr.innerHTML('#view')), '4 used up: it goes, and Afloat asks about Nákup - Jídlo');
  await fr.click('[data-act=buyAlways]'); await fr.waitForTimeout(500);
  ok((await TRW()).some(a => a.action === 'create' && a.listId === FOOD && a.name === 'Rohlíky') && (await st())[M + 'kitchen/always'].names['rohliky'] === true, '5 “Always”: on Nákup - Jídlo now, and by itself next time');
  await fr.fill('#phName', 'Rohlíky'); await fr.click('form[data-form=phAdd] button'); await fr.waitForTimeout(300);
  const rid = Object.entries(await st()).find(([k, v]) => k.startsWith(M + 'pantry/') && v.name === 'Rohlíky')[0].split('/').pop();
  ok((await st())[M + 'pantry/' + rid].always === true, '6 adding it again remembers “always”');
  const before = (await TRW()).length; await fr.click(`[data-act=phUsed][data-id="${rid}"]`); await fr.waitForTimeout(500);
  ok(!/is used up\. Put it/.test(await fr.textContent('#view')) && (await TRW()).length === before, '7 an “always” item used up needs no question (already on the list, not added twice)');
  await fr.fill('#phName', 'Sýr'); await fr.click('form[data-form=phAdd] button'); await fr.waitForTimeout(600);
  const sid = Object.entries(await st()).find(([k, v]) => k.startsWith(M + 'pantry/') && v.name === 'Sýr')[0];
  ok((await st())[sid].useBy === '2026-11-19', '8 added by hand: Claude guesses how long it keeps (cheese ~14 days)');
  await fr.click(`[data-act=phOff][data-id="${sid.split('/').pop()}"]`); await fr.waitForTimeout(250);
  ok(!(await st())[sid] && !/is used up/.test(await fr.textContent('#view')), '9 went off: quietly gone, no question, no tally');

  // best-before by hand: when adding, and on items already there
  await fr.fill('#phName', 'Máslo'); await fr.fill('#phUseBy', '2026-12-01'); await fr.click('form[data-form=phAdd] button'); await fr.waitForTimeout(600);
  ok(Object.values(await st()).some(v => v && v.name === 'Máslo' && v.useBy === '2026-12-01'), '9b adding by hand with a best-before date keeps exactly that date (no guess over it)');
  await fr.fill('[data-pby=p2]', '2026-11-30'); await fr.waitForTimeout(300);
  ok((await st())[M + 'pantry/p2'].useBy === '2026-11-30' && /Jogurty/.test(await fr.textContent('#view')), '9c editing the best-before date on an item already added saves it');
  await fr.fill('[data-pby=p2]', ''); await fr.waitForTimeout(300);
  ok(!(await st())[M + 'pantry/p2'].useBy, '9d clearing the date removes it');
  await fr.fill('[data-pby=p2]', '2026-11-12'); await fr.waitForTimeout(300);

  // staples
  await fr.click('[data-act=stToggle][data-id=cukr]'); await fr.waitForTimeout(500);
  ok((await st())[M + 'kitchen/staples'].low.cukr === true && (await TRW()).some(a => a.action === 'create' && a.listId === FOOD && a.name === 'Cukr'), '10 a staple running low goes onto Nákup - Jídlo');

  // receipt
  await fr.click('[data-act=scanOpen]'); await fr.waitForTimeout(200);
  const png = path.join(__dirname, 'shots', '_receipt.png'); await p.screenshot({ path: png, clip: { x: 0, y: 0, width: 300, height: 900 } });
  await fr.setInputFiles('#scanFiles', png); await fr.waitForTimeout(1500);
  t = await fr.textContent('#sheet');
  const pr = (await p.evaluate(() => window.top.__PR)).find(x => /receipt/.test(x.t));
  ok(pr && pr.images >= 2 && /C\d+: Mléko \((Nákup - )?Jídlo\)/.test(pr.t) && /C\d+: Toaletní papír \((Nákup - )?Drogerie\)/.test(pr.t) && /mouka-hladka = Mouka hladká/.test(pr.t), '11 Claude gets the receipt (a tall one cut into pieces), the open shopping-list cards and the staples');
  ok(/Check what Claude found/.test(t) && /Mléko polotučné/.test(await fr.inputValue('.scname >> nth=0')) && /refills Mouka hladká/.test(t) && /Not food/.test(t) && /drogerie/.test(t) && /Mléko/.test(t) && /Šampon/.test(t), '12 the review: food, a refilled staple, non-food apart, and the bought cards');
  ok(await fr.$eval('input[data-act=scTick]:near(:text("lékárna"))', x => !x.checked).catch(() => true), '13 non-food is not ticked for At home');
  ok(await fr.inputValue('input[data-scby] >> nth=0') === '2026-11-12', '13b the review shows Claude’s guess as an editable best-before date');
  await fr.fill('input[data-scby] >> nth=0', '2026-11-20');
  await (await fr.$('#sheet')).screenshot({ path: __dirname + '/shots/at-home-review.png' });
  await fr.click('[data-act=scSave]'); await fr.waitForTimeout(800);
  const S2 = await st(), names = Object.entries(S2).filter(([k]) => k.startsWith(M + 'pantry/')).map(([, v]) => v.name);
  ok(names.includes('Mléko polotučné') && names.includes('Rajčata') && !names.includes('Toaletní papír') && !names.includes('Paralen') && !names.includes('Mouka hladká'), '14 saved: the food only');
  ok(Object.values(S2).some(v => v && v.name === 'Mléko polotučné' && v.useBy === '2026-11-20'), '14b a best-before date typed in the review is the one saved');
  ok(S2[M + 'kitchen/staples'].low['mouka-hladka'] === false && Object.values(S2).some(v => v && v.name === 'Rajčata' && v.where === 'bowl' && v.useBy === '2026-11-10'), '15 the staple is refilled; use-by from Claude’s guess');
  const done = (await TRW()).filter(a => a.action === 'mark_done').map(a => a.cardId);
  ok(done.includes('c1') && done.includes('c3') && !done.includes('c2') && !done.includes('c4'), '16 bought cards ticked off on Trello (Mléko on Jídlo, Šampon on Drogerie); others left');

  // what can we cook?
  await fr.click('[data-act=cookOpen]'); await fr.waitForTimeout(800); t = await fr.textContent('#sheet');
  const cp = (await p.evaluate(() => window.top.__PR)).find(x => /decide what to cook/.test(x.t));
  ok(/Špenátové těstoviny/.test(t) && /Uses the spinach today/.test(t) && /Missing: Smetana/.test(t) && /Nothing to buy/.test(t), '17 three ideas (here two): what they use and what’s missing');
  ok(cp && /Špenát \(plenty, use today\)/.test(cp.t) && /r1: Špenátové těstoviny/.test(cp.t) && /Pantry staples they have:[^\n]*Mouka hladká/.test(cp.t) && !/Pantry staples they have:[^\n]*Cukr/.test(cp.t), '18 Claude is told what’s at home with use-by, our recipes, and the staples we have (not the low ones)');
  await fr.click('[data-act=cookMissing][data-i="1"]'); await fr.waitForTimeout(500);
  ok((await TRW()).some(a => a.action === 'create' && a.listId === FOOD && a.name === 'Smetana'), '19 missing things go onto Nákup - Jídlo in one tap');
  await fr.click('[data-act=cookPlan][data-i="1"]'); await fr.waitForTimeout(500);
  ok(Object.values(await st()).some(v => v && v.name === 'Rajčatová polévka' && (v.tags || []).includes('from-at-home')) && /Add to plan/.test(await fr.textContent('#sheet')), '20 a new idea is saved as a recipe and opens “Add to plan”');

  // Afloat's afternoon briefing
  await p.evaluate(() => localStorage.removeItem('afloat.brief')); await p.goto(base + '#today'); await p.waitForTimeout(2500);
  ok(/Use soon at home: Špenát/.test(await p.evaluate(() => (document.querySelector('.brief-ov') || document.body).innerText)), '21 the afternoon briefing mentions what to use soon');
  fs.unlinkSync(png);
  console.log(errs.length ? errs.join('\n') : 'NO PAGE ERRORS'); await b.close(); srv.close();
})();
