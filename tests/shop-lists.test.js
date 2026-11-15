// The shopping lists split (5 Nov 2026): Nákupy → Nákup - Drogerie, Chores → Nákup - Jídlo, Organizace → Nákupy - Lékárna.
// Afloat finds them by name: restock and the supply check go to Drogerie; the renamed lists stop counting as Chores or
// Organizace; the brain dump can send to all three; Meals sends its shopping list to Jídlo and no longer posts a menu card.
const { chromium, devices } = require('playwright'), fs = require('fs'), path = require('path');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ ...devices['iPhone 13'] }), errs = [];
  const base = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8')); base['home/situation'] = {}; base['home/household'].baseline = 1;
  const L = base['home/trello'].lists, names = { [L.shop]: 'Nákup - Drogerie', [L.chores]: 'Nákup - Jídlo', [L.org]: 'Nákupy - Lékárna' };
  const food = { id: 'ari:card/milk2', name: 'Mléko', url: 'https://trello.example/c/m2', list: { id: L.chores, name: 'Nákup - Jídlo' }, board: { id: 'ari:board/dom', name: 'Domácnost' }, complete: false };
  const open = async (st, hash, T) => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(`window.__SEED=${JSON.stringify(st)};window.__TR_ME="a";window.__TR_NAMES=${JSON.stringify(names)};window.__EXTRA_CARDS=${JSON.stringify([food])};`);
    await p.addInitScript(fs.readFileSync(__dirname + '/fakedb.js', 'utf8')); await p.addInitScript(fs.readFileSync(__dirname + '/fake-trello.js', 'utf8'));
    await p.addInitScript(() => { localStorage.setItem('afloat.me', 'Alex'); localStorage.setItem('afloat.brief', 'x'); });
    await p.clock.install({ time: new Date(T) }); await p.goto('file://' + path.resolve(__dirname, '../' + (hash === 'meals' ? 'meals/index.html' : 'index.html#' + hash))); await p.waitForTimeout(2600);
    if (await p.$('button.btn[data-act=brief-close]')) { await p.tap('button.btn[data-act=brief-close]'); await p.waitForTimeout(150); } return p; };
  let p = await open(base, 'tasks', '2026-11-08T10:00:00');
  ok(!/Mléko/.test(await p.textContent('#app')), '1 the food list (once Chores) no longer shows up as tasks');
  p = await open(base, 'rhythms', '2026-11-08T10:00:00'); const st = await p.evaluate(() => window.__st);
  p = await open({ ...base, ...Object.fromEntries(Object.entries(st).filter(([k]) => k.startsWith('home/'))) }, 'today', '2026-11-08T10:00:00');
  await p.evaluate(() => document.querySelectorAll('.card.restock details').forEach(d => d.open = true));
  await p.tap('.card.restock .supply .shopchip[data-text="Stelivo"]'); await p.waitForTimeout(500);
  ok(await p.evaluate(id => window.__trCards.some(c => c.name === 'Stelivo' && c.list.id === id), L.shop), '2 the supply check sends to Nákup - Drogerie');
  ok(/Nákup - Drogerie/.test(await p.textContent('.card.restock')), '3 and says so');
  const md = path.resolve(__dirname, '../meals/js'), m = fs.readdirSync(md).map(f => fs.readFileSync(path.join(md, f), 'utf8')).join('\n'); /* Meals' code, all files */
  const shared = await p.evaluate(() => H('trello').shopIds || {});
  ok(shared.food === L.chores && shared.drug === L.shop && m.includes('on("trello"') && m.includes('org:null') && m.includes('mcp&&T_LISTS.org?'), '4 Afloat tells Meals the household’s shopping lists (groceries: Nákup - Jídlo) and the menu card is off: ' + JSON.stringify(shared));
  /* 5 (10 Nov 2026): a household whose lists have other names chooses them in Settings → Your task lists */
  await p.tap('[data-act=settings]'); await p.waitForTimeout(400);
  ok(/Your task lists/i.test(await p.textContent('#sheet')) && !!(await p.$('#trp_food')), '5 Settings shows the Trello list choices');
  await p.selectOption('#trp_food', L.org); await p.waitForTimeout(400);
  const after = await p.evaluate(() => ({ pick: H('trello').pick, food: trL().food, shared: H('trello').shopIds, name: shopName('food') }));
  ok(after.pick.food === L.org && after.food === L.org && after.shared.food === L.org && after.name === 'Nákupy - Lékárna', '5b the chosen groceries list wins over the name, and Meals is told: ' + JSON.stringify(after));
  console.log(errs.length ? errs.join('\n') : 'NO PAGE ERRORS'); await b.close();
})();
