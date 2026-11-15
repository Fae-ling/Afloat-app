// Meals → leftovers into At home (10 Nov 2026): a cooked meal in the week plan has a Leftovers? button; At home offers recently cooked meals and a typed 'Add as leftovers'; both land in the fridge with ~3 days, show in Use soon, and Used up doesn't ask about the shopping list.
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
  fb[M + 'plan/2026-11-05'] = { meals: [{ id: 'm1', slot: 'Dinner', recipeId: 'r1', portions: null }] };
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
  await shut(p); await p.goto(base + '#mealplan'); await p.waitForTimeout(2500); await shut(p);
  const fr = p.frame({ url: /meals\/index\.html/ }), st = () => p.evaluate(() => window.__FAKEFB.st), TRW = () => p.evaluate(() => window.top.__TRW);
  const lefts = async () => Object.entries(await st()).filter(([k, v]) => k.startsWith(M + 'pantry/') && v && v.leftover);

  // from a cooked meal in the week plan
  ok(/Leftovers\?/.test(await fr.textContent('#view')), '1 a cooked meal in the week plan has a “Leftovers?” button');
  await fr.click('[data-act=mealLeft]'); await fr.waitForTimeout(400);
  let L = await lefts();
  ok(L.length === 1 && L[0][1].name === 'Leftovers · Špenátové těstoviny' && L[0][1].where === 'fridge' && L[0][1].useBy === '2026-11-08' && L[0][1].level === 3, '2 it adds “Leftovers · …” to the fridge, best within 3 days');
  ok(/Leftovers in At home ✓/.test(await fr.textContent('#view')), '3 the button then says it is in At home');
  await fr.click('[data-act=mealLeft]'); await fr.waitForTimeout(300);
  ok((await lefts()).length === 1, '4 tapping again doesn’t add a second one');

  // At home
  await p.evaluate(() => { location.hash = 'meals'; }); await p.waitForTimeout(500); await fr.click('[data-tab=home]'); await fr.waitForTimeout(800);
  const t = await fr.textContent('#view');
  ok(/Leftovers · Špenátové těstoviny/.test(t) && /leftovers/.test(t) && !/Always buy/.test(await fr.innerHTML('li.hm:has-text("Leftovers")')) && !/Any leftovers\?/.test(t), '5 At home lists them with a leftovers tag, no “Always buy”, and no offer for a meal already stored');
  await fr.fill('#phName', 'špagety'); await fr.click('[data-act=phLeftover]'); await fr.waitForTimeout(400);
  L = await lefts();
  ok(L.length === 2 && L.some(([, v]) => v.name === 'Leftovers · špagety' && v.useBy === '2026-11-08'), '6 typing a dish and “Add as leftovers” adds it too');
  ok((await fr.inputValue('#phName')) === '', '7 the box is cleared, and nothing was added as plain food');
  await fr.click('[data-act=phLeftover]'); await fr.waitForTimeout(200);
  ok((await lefts()).length === 2, '8 with nothing typed it adds nothing');

  // used up: no shopping-list question
  const id = L.find(([, v]) => v.name === 'Leftovers · špagety')[0].split('/').pop(), before = (await TRW()).length;
  await fr.click(`[data-act=phUsed][data-id="${id}"]`); await fr.waitForTimeout(400);
  ok(!(await st())[M + 'pantry/' + id] && !/is used up\. Put it/.test(await fr.textContent('#view')) && (await TRW()).length === before, '9 used up: gone, with no “put it on the list?” question');
  await (await fr.$('#view')).screenshot({ path: __dirname + '/shots/leftovers.png' }).catch(() => {});
  console.log(errs.length ? errs.join('\n') : 'NO PAGE ERRORS'); await b.close(); srv.close();
})();
