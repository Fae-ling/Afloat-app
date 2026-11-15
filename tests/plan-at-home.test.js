// Meals → Week plan from At home (8 Nov 2026): the "+" on a meal has a Recipes / At home switch; food already at home
// (bakery rolls that need no cooking) goes into a slot, several at a time, soonest-to-use first; it has no portions, nutrition
// or shopping, shows as "at home" with its use-by, is checked by name for won't-eat words and own allergens, At home shows
// "planned: tomorrow breakfast", and the plan keeps the name when the item is later used up. Also Eating out / Leftovers, rough
// nutrition guesses for foods at home (once per food name), leftovers of a recipe that count like the recipe but never go on the
// shopping list, and eating out being left out of the nutrition check, said plainly.
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
  const seed = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8')), fb = {}, M = 'apps/mealtime/';
  for (const [k, v] of Object.entries(seed)) fb['apps/afloat/' + k] = v;
  const all = ['Breakfast', 'Morning snack', 'Lunch', 'Afternoon snack', 'Dinner'];
  fb[M + 'recipes/r1'] = { name: 'Svíčková', ingredients: [{ name: 'hovězí', qty: 500, unit: 'g', aisle: 'Meat & fish' }], steps: [], servings: 4, createdAt: 1 };
  fb[M + 'recipes/r2'] = { name: 'Guláš', ingredients: [{ name: 'hovězí', qty: 800, unit: 'g', aisle: 'Meat & fish', kcal: 800, protein: 60, carbs: 40, fat: 40 }], steps: [], servings: 4, createdAt: 2 };
  fb[M + 'allergenTags/x-kesu'] = { label: 'Cashew', keywords: ['kešu'], createdAt: 1 };
  fb[M + 'people/oldA'] = { name: 'Alex', diet: 'omnivore', regular: true, meals: { weekday: all, weekend: all }, sex: 'f', allergens: [], avoid: [], likes: [], favorites: [], notes: '' };
  fb[M + 'people/oldB'] = { name: 'Mia', child: true, age: 4, diet: 'omnivore', regular: true, meals: { weekday: ['Breakfast', 'Dinner'], weekend: all }, sex: 'f', allergens: ['x-kesu'], avoid: ['müsli'], likes: [], favorites: [], notes: '' };
  // today is Sun 8 Nov 2026; the rolls were bought for tomorrow
  fb[M + 'pantry/p1'] = { name: 'Rohlíky', where: 'pantry', level: 3, added: '2026-11-08', useBy: '2026-11-09' };
  fb[M + 'pantry/p2'] = { name: 'Máslo', where: 'fridge', level: 2, added: '2026-11-01', useBy: '2026-11-20' };
  fb[M + 'pantry/p3'] = { name: 'Kešu máslo', where: 'pantry', level: 2, added: '2026-11-01', useBy: '2026-12-20' };
  fb[M + 'pantry/p4'] = { name: 'Müsli tyčinky', where: 'pantry', level: 3, added: '2026-11-01' };
  const shut = async p => { if (await p.$('[data-hp=close]')) { await p.tap('[data-hp=close]'); await p.waitForTimeout(200); } if (await p.$('button.btn[data-act=brief-close]')) { await p.tap('button.btn[data-act=brief-close]'); await p.waitForTimeout(200); } };
  const errs = [], p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(s => { window.__FBSEED = s; window.__SIGNIN_AS = { uid: 'u1', email: 'owner@example.com' }; localStorage.setItem('afloat.me', 'Alex'); localStorage.setItem('afloat.brief', 'x');
    window.__FN = { connections: async (d, u) => ({ email: u.email, owner: true, members: ['owner@example.com'], trello: { connected: false }, google: { connected: false }, config: {} }), tool: async () => ({ payload: { events: [], cards: [] } }), sample: async d => { const t = typeof d.input === 'string' ? d.input : JSON.stringify(d.input), T = window.top; (T.__PR = T.__PR || []).push(t);
        if (/ONE typical serving/.test(t)) {
          const E = { 'Rohlíky': { serving: '2 rohlíky', kcal: 180, protein: 6, carbs: 34, fat: 2, fiber: 2, sugar: 2, satfat: .4, salt: .9, fruitveg: 0 }, 'Máslo': { serving: '10 g', kcal: 75, protein: 0, carbs: 0, fat: 8.2, fiber: 0, sugar: 0, satfat: 5.2, salt: .1, fruitveg: 0 }, 'Kešu máslo': { serving: '1 lžíce', kcal: 95, protein: 3, carbs: 3, fat: 8, fiber: 1, sugar: 1, satfat: 1.5, salt: 0, fruitveg: 0 } };
          if (/- Kešu máslo/.test(t)) T.__KC = (T.__KC || 0) + 1;
          const items = {}; for (const [n, v] of Object.entries(E)) if (t.includes('- ' + n + '\n') && !(n === 'Kešu máslo' && T.__KC === 1)) items[n] = v;   /* the first guess for Kešu máslo "fails" */
          return { text: '', value: { items } };
        }
        return { text: '', value: {} }; } }; }, fb);
  await p.clock.install({ time: new Date('2026-11-08T10:00:00') });
  await p.goto(base + '#meals'); await p.waitForTimeout(800);
  if (await p.$('[data-hp=google]')) { await p.tap('[data-hp=google]'); await p.waitForTimeout(1500); }
  await shut(p); await p.goto(base + '#meals'); await p.waitForTimeout(2500); await shut(p);
  const fr = p.frame({ url: /meals\/index\.html/ }), st = () => p.evaluate(() => window.__FAKEFB.st), PLAN = M + 'plan/2026-11-09';
  // the week plan lives in Plan → Meals (#mealplan); Recipes, Shopping and At home stay in the Meals tab (#meals)
  const goTab = async t => { await p.evaluate(h => { location.hash = h; }, t === 'plan' ? 'mealplan' : 'meals'); await p.waitForTimeout(500); if (t !== 'plan') await p.frame({ url: /meals\/index\.html/ }).click('[data-tab=' + t + ']'); };
  const homeMeals = async () => ((await st())[PLAN] || { meals: [] }).meals.filter(m => m.home);

  // open tomorrow's breakfast (Mon 9 Nov, next week) and switch to At home
  await goTab('plan'); await fr.waitForTimeout(500);
  await fr.click('[data-act=week][data-d="7"]'); await fr.waitForTimeout(300);
  await fr.click('[data-act=addMeal][data-k="2026-11-09"][data-s=Breakfast]'); await fr.waitForTimeout(300);
  let t = await fr.textContent('#sheet');
  ok(/Recipes/.test(t) && /At home · 4/.test(t) && /Suggested/.test(t), '1 the picker has a Recipes / At home switch (recipes stay the default)');
  await fr.click('[data-act=pickMode][data-v=home]'); await fr.waitForTimeout(300);
  const rows = await fr.$$eval('#sheet .pick li button', bs => bs.map(x => x.innerText.replace(/\s+/g, ' ')));
  ok(rows.length === 4 && /^Rohlíky/.test(rows[0]) && /use tomorrow/.test(rows[0]) && /Pantry/.test(rows[0]) && /plenty/.test(rows[0]), '2 At home lists what’s at home, what needs using soonest first, with where it is and its use-by');

  // safety by name: won't-eat words and own allergens (Mia is at breakfast on weekdays)
  ok(/Not for Mia \(Cashew\)/.test(rows.find(r => /Kešu/.test(r)) || '') && /Not for Mia \(müsli\)/.test(rows.find(r => /Müsli/.test(r)) || '') && !/Not for/.test(rows[0]), '3 items are flagged by name for someone’s own allergen or won’t-eat word, and nothing else');
  ok(/isn't checked for allergens/.test(await fr.textContent('#sheet')), '4 and it says honestly that food at home is only checked by name');

  // several at once, the sheet stays open; tap again takes one off
  await fr.click('[data-act=pickHome][data-id=p1]'); await fr.waitForTimeout(300);
  await fr.click('[data-act=pickHome][data-id=p2]'); await fr.waitForTimeout(300);
  let hm = await homeMeals();
  ok(hm.length === 2 && hm.every(m => m.slot === 'Breakfast' && !m.recipeId && m.home.name) && hm.map(m => m.home.id).sort().join() === 'p1,p2', '5 tapping adds home items to the slot (several in a row), saved without a recipe');
  ok(await fr.$('#sheet:not([hidden])') && /✓ Rohlíky/.test(await fr.textContent('#sheet')) && await fr.$eval('[data-act=pickHome][data-id=p1]', x => x.getAttribute('aria-pressed') === 'true'), '6 the sheet stays open and shows what is already in this meal');
  await fr.click('[data-act=pickHome][data-id=p2]'); await fr.waitForTimeout(300);
  ok((await homeMeals()).length === 1, '7 tapping it again takes it off');
  await fr.click('[data-act=pickHome][data-id=p2]'); await fr.waitForTimeout(300);
  await (await fr.$('#sheet')).screenshot({ path: path.join(__dirname, 'shots', 'plan-at-home-picker.png') }).catch(() => {});
  await fr.fill('#pkQ', 'rohl'); await fr.waitForTimeout(250);
  ok((await fr.$$('#sheet .pick li button')).length === 1, '8 the search narrows the list by name (accents ignored)');
  await fr.click('#sheet .sheet-ft [data-act=close]'); await fr.waitForTimeout(300);

  // in the week plan
  const meal = await fr.$$eval('.meal.home', es => es.map(e => e.innerText.replace(/\s+/g, ' ')));
  ok(meal.length === 2 && meal.some(x => /Rohlíky/.test(x) && /at home/.test(x) && /use tomorrow/.test(x)) && meal.every(x => !/portions/.test(x)), '9 the week plan shows them as “at home” with the use-by, and no portions');
  ok(meal.some(x => /Rohlíky/.test(x) && /~180 kcal/.test(x) && /2 rohlíky/.test(x) && /rough guess/.test(x)) && meal.some(x => /Máslo/.test(x) && /~75 kcal/.test(x)), '9a each shows Claude’s rough kcal guess for one serving, labelled as a guess');
  const nutDoc = (await st())[M + 'kitchen/nut'], estCalls = (await p.evaluate(() => window.top.__PR)).filter(x => /ONE typical serving/.test(x)).length;
  ok(nutDoc && nutDoc.items.rohliky && nutDoc.items.rohliky.kcal === 180 && nutDoc.items.maslo && nutDoc.items.maslo.serving === '10 g' && estCalls === 2, '9c the guesses are kept by food name, one Claude call per newly added food');
  await (await fr.$('section.day:has(.meal.home)')).screenshot({ path: path.join(__dirname, 'shots', 'plan-at-home-day.png') }).catch(() => {});
  ok(/\d eating/.test(await fr.textContent('.att-n')) && !/portion/.test(await fr.textContent('.slotg:has(.meal.home) .att-n')), '9b a slot with only home items says who is eating, not portions');
  const nutri = await fr.textContent('.nutri');
  ok(!/Add meals to this week to see/.test(nutri) && /about 255 kcal a day over 1 day/.test(nutri), '10 with the guesses they count in the nutrition check (180 + 75 kcal for one adult at breakfast)');
  await goTab('shopping'); await fr.waitForTimeout(300);
  ok(/Nothing to buy yet/.test(await fr.textContent('#view')), '11 and nothing goes on the shopping list for them');

  // At home knows what is planned
  await goTab('home'); await fr.waitForTimeout(300);
  const row = await fr.$eval('li.hm:has([data-id=p1])', e => e.innerText.replace(/\s+/g, ' '));
  ok(/planned: tomorrow breakfast/.test(row) && !/planned/.test(await fr.$eval('li.hm:has([data-id=p3])', e => e.innerText)), '12 At home shows “planned: tomorrow breakfast” on the item that is planned, and only on that one');

  // used up: the plan keeps the name
  await fr.click('[data-act=phUsed][data-id=p1]'); await fr.waitForTimeout(300);
  await goTab('plan'); await fr.waitForTimeout(300);
  const after = await fr.$$eval('.meal.home', es => es.map(e => e.innerText.replace(/\s+/g, ' ')));
  ok(after.some(x => /Rohlíky/.test(x) && /no longer on the At home list/.test(x)), '13 after “Used up” the plan still says Rohlíky, marked as no longer on the At home list');
  await fr.click('.meal.home:has-text("Rohlíky") [data-act=rmMeal]'); await fr.waitForTimeout(300);
  ok((await homeMeals()).map(m => m.home.id).join() === 'p2', '14 and × takes it off the plan');

  // recipes still work next to them
  await fr.click('[data-act=addMeal][data-k="2026-11-09"][data-s=Breakfast]'); await fr.waitForTimeout(300);
  await fr.click('[data-act=pick][data-id=r1]'); await fr.waitForTimeout(400);
  const ms = (await st())[PLAN].meals;
  ok(ms.length === 2 && ms.some(m => m.recipeId === 'r1' && m.portions === null) && ms.some(m => m.home && m.home.id === 'p2'), '15 a recipe still goes in as before, next to the home item');
  const day = await fr.$eval('section.day:has(.meal.home)', e => e.innerText.replace(/\s+/g, ' '));
  ok(/Svíčková/.test(day) && /Máslo/.test(day) && /portions/.test(day), '16 the slot shows both: the recipe with portions, the home item without');
  await goTab('shopping'); await fr.waitForTimeout(300);
  ok(/hovězí/.test(await fr.textContent('#view')) && !/Máslo/.test(await fr.textContent('.shop')), '17 the shopping list still comes from recipes only');

  // eating out and leftovers: planned meals with nothing to cook
  await goTab('plan'); await fr.waitForTimeout(300);
  await fr.click('[data-act=addMeal][data-k="2026-11-09"][data-s=Lunch]'); await fr.waitForTimeout(300);
  await fr.click('[data-act=pickMode][data-v=other]'); await fr.waitForTimeout(250);
  t = await fr.textContent('#sheet');
  ok(/Eating out/.test(t) && /Leftovers/.test(t) && await fr.$('#pkNote') && !(await fr.$('#pkQ')), '18 the picker’s third switch offers Eating out and Leftovers, with an optional note instead of a search');
  await fr.fill('#pkNote', 'pizzerie u nádraží'); await fr.click('[data-act=pickOther][data-kind=out]'); await fr.waitForTimeout(350);
  let oth = ((await st())[PLAN].meals).filter(m => m.other);
  ok(oth.length === 1 && oth[0].slot === 'Lunch' && oth[0].other.kind === 'out' && oth[0].other.note === 'pizzerie u nádraží' && !oth[0].recipeId && !oth[0].home, '19 eating out is saved in the slot with its note, as a meal without a recipe');
  ok(await fr.$eval('#overlay', e => e.hidden), '20 and the sheet closes after one choice');
  await fr.click('[data-act=addMeal][data-k="2026-11-09"][data-s=Dinner]'); await fr.waitForTimeout(300);
  await fr.click('[data-act=pickMode][data-v=other]'); await fr.waitForTimeout(250);
  await fr.click('[data-act=pickOther][data-kind=leftovers]'); await fr.waitForTimeout(350);
  oth = ((await st())[PLAN].meals).filter(m => m.other);
  ok(oth.length === 2 && oth.some(m => m.slot === 'Dinner' && m.other.kind === 'leftovers' && m.other.note === ''), '21 leftovers works the same, and the note can stay empty');
  const rowsO = await fr.$$eval('.meal.other', es => es.map(e => e.innerText.replace(/\s+/g, ' ')));
  ok(rowsO.length === 2 && rowsO.some(x => /Eating out/.test(x) && /pizzerie u nádraží/.test(x)) && rowsO.some(x => /^Leftovers\s*×?\s*$/.test(x.trim()) || /Leftovers/.test(x)) && rowsO.every(x => !/portions|kcal/.test(x)), '22 the week plan shows both, with the note, and no portions or calories');
  ok(/\d eating/.test(await fr.textContent('.slotg:has(.meal.other) .att-n')) && !/portion/.test(await fr.textContent('.slotg:has(.meal.other) .att-n')), '23 a slot with only these says who is eating, not portions');
  await (await fr.$('section.day:has(.meal.other)')).screenshot({ path: path.join(__dirname, 'shots', 'plan-out-leftovers.png') }).catch(() => {});
  await fr.click('.meal.other:has-text("Eating out") [data-act=rmMeal]'); await fr.waitForTimeout(300);
  ok(((await st())[PLAN].meals).filter(m => m.other).length === 1, '24 × takes one off');
  await goTab('shopping'); await fr.waitForTimeout(300);
  ok(!/pizzerie|Leftovers/.test(await fr.textContent('.shop')), '25 neither adds anything to the shopping list');

  // leftovers of a recipe: they count like the recipe, but nothing is bought for them
  const PLAN2 = M + 'plan/2026-11-10', amt = async () => fr.$eval('.shop .item:has-text("hovězí") .amt', e => e.innerText.trim());
  await goTab('shopping'); await fr.waitForTimeout(300); const before = await amt();
  await goTab('plan'); await fr.waitForTimeout(300);
  await fr.click('[data-act=addMeal][data-k="2026-11-10"][data-s=Lunch]'); await fr.waitForTimeout(300);
  await fr.click('[data-act=pickMode][data-v=other]'); await fr.waitForTimeout(250);
  ok(/Leftovers of/.test(await fr.textContent('#sheet')) && (await fr.$$eval('#pkLrec option', o => o.map(x => x.textContent))).includes('Guláš'), '26 Leftovers can name the recipe they are leftovers of');
  await (await fr.$('#sheet')).screenshot({ path: path.join(__dirname, 'shots', 'plan-leftovers-picker.png') }).catch(() => {});
  await fr.selectOption('#pkLrec', 'r2'); await fr.fill('#pkNote', 'z neděle'); await fr.click('[data-act=pickOther][data-kind=leftovers]'); await fr.waitForTimeout(350);
  const lm = ((await st())[PLAN2] || { meals: [] }).meals;
  ok(lm.length === 1 && lm[0].recipeId === 'r2' && lm[0].leftover === true && lm[0].note === 'z neděle' && !lm[0].other && lm[0].portions === null, '27 saved as that recipe, flagged as leftovers, with the note, portions automatic');
  const lrow = await fr.$eval('.meal:has(.homechip)', e => e.innerText.replace(/\s+/g, ' ')).catch(() => '');
  const lrows = await fr.$$eval('.meal', es => es.map(e => e.innerText.replace(/\s+/g, ' ')));
  ok(lrows.some(x => /Guláš/.test(x) && /leftovers/.test(x) && /z neděle/.test(x) && /200 kcal/.test(x) && /portions/.test(x)), '28 the plan shows it as the recipe, tagged “leftovers”, with portions and its calories');
  ok(/about 138 kcal a day over 2 days/.test(await fr.textContent('.nutri')), '29 and it counts in the nutrition check like the recipe (75 kcal Monday, 200 Tuesday → 138 a day)');
  await goTab('shopping'); await fr.waitForTimeout(300);
  ok((await amt()) === before && !/Guláš/.test(await fr.textContent('.shop')), '30 but nothing is added to the shopping list for it');
  await goTab('plan'); await fr.waitForTimeout(300);

  // eating out stays out, and the check says so
  ok(/Not counted: 1 leftover with no recipe/.test(await fr.textContent('.nutri')), '31 leftovers without a recipe are named as not counted');
  await fr.click('[data-act=addMeal][data-k="2026-11-10"][data-s=Dinner]'); await fr.waitForTimeout(300);
  await fr.click('[data-act=pickMode][data-v=other]'); await fr.waitForTimeout(250);
  await fr.click('[data-act=pickOther][data-kind=out]'); await fr.waitForTimeout(350);
  const n2 = await fr.textContent('.nutri');
  ok(/Not counted: 1 meal out, 1 leftover with no recipe/.test(n2) && /about 138 kcal a day over 2 days/.test(n2), '32 eating out is left out of the numbers, and the panel says what it left out');

  // a failed guess can be retried
  await fr.click('[data-act=addMeal][data-k="2026-11-10"][data-s=Breakfast]'); await fr.waitForTimeout(300);
  await fr.click('[data-act=pickMode][data-v=home]'); await fr.waitForTimeout(250);
  await fr.click('[data-act=pickHome][data-id=p3]'); await fr.waitForTimeout(400);
  await fr.click('#sheet .sheet-ft [data-act=close]'); await fr.waitForTimeout(300);
  ok(await fr.$('[data-act=estHome]') && /1 food at home has no nutrition estimate yet/.test(await fr.textContent('.nutri')), '33 when Claude’s first guess for a food doesn’t come, the panel says so and offers to try again');
  await fr.click('[data-act=estHome]'); await fr.waitForTimeout(500);
  const nd = (await st())[M + 'kitchen/nut'];
  ok(!(await fr.$('[data-act=estHome]')) && nd.items['kesu maslo'] && nd.items['kesu maslo'].kcal === 95 && /about 185 kcal a day over 2 days/.test(await fr.textContent('.nutri')), '34 trying again fills it in, and the check updates (95 more on Tuesday → 185 a day)');
  await (await fr.$('.nutri')).screenshot({ path: path.join(__dirname, 'shots', 'plan-nutrition-notcounted.png') }).catch(() => {});
  console.log(errs.length ? errs.join('\n') : 'NO PAGE ERRORS'); await b.close(); srv.close();
})();
