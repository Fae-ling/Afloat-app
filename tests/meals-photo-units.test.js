// Meals (13 Nov 2026): a dish photo that Storage refuses says why, and a recipe read by Claude never keeps cups, ounces or sticks.
const { chromium, devices } = require('playwright'), fs = require('fs'), path = require('path');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ ...devices['iPhone 13'] }), errs = [];
  const base = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8'));
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(`window.__SEED=${JSON.stringify(base)};`); await p.addInitScript(fs.readFileSync(__dirname + '/fakedb.js', 'utf8'));
  await p.addInitScript(() => { localStorage.setItem('afloat.me', 'Sam'); });
  await p.goto('file://' + path.resolve(__dirname, '../meals/index.html')); await p.waitForTimeout(2000);
  const r = await p.evaluate(() => {
    const m = e => assetErr(e);
    const ing = (q, u) => toMetric({ qty: q, unit: u, name: 'x' });
    return { un: m({ code: 'storage/unauthorized' }), net: m({ code: 'storage/retry-limit-exceeded' }), odd: m({ code: 'storage/weird' }), none: m(null),
      cup: ing(2, 'cups'), oz: ing(8, 'oz'), lb: ing(1, 'lb'), stick: ing(1, 'stick'), fl: ing(8, 'fl oz'), none2: ing('', 'cup'), keep: ing(2, 'tbsp'), g: ing(150, 'g'), comma: ing('1,5', 'cup') };
  });
  ok(/isn't allowed to add photos/.test(r.un) && /storage\/unauthorized/.test(r.un), '1 a refused upload says the account isn’t allowed, with the code');
  ok(/connection dropped/.test(r.net), '2 a dropped connection says so');
  ok(/storage\/weird/.test(r.odd) && !/\(\)/.test(r.none) && /Couldn't save the photo\./.test(r.none), '3 an unknown error shows its code; none shows the plain message');
  ok(r.cup.qty === 480 && r.cup.unit === 'ml' && r.oz.qty === 225 && r.oz.unit === 'g' && r.lb.qty === 455 && r.lb.unit === 'g', '4 cups, ounces and pounds become ml and g: ' + JSON.stringify([r.cup, r.oz, r.lb]));
  ok(r.stick.qty === 115 && r.stick.unit === 'g' && r.fl.qty === 240 && r.fl.unit === 'ml' && r.comma.qty === 360, '5 sticks of butter, fluid ounces and decimal commas too');
  ok(r.none2.unit === 'ml' && r.none2.qty === '' && r.keep.unit === 'tbsp' && r.keep.qty === 2 && r.g.unit === 'g' && r.g.qty === 150, '6 no amount stays empty, and tbsp and g are left alone');
  const j = await p.evaluate(() => { ED = { name: '', ingredients: [], original: null, extra: null }; fromAI({ name: 'Chilli', servings: 4, ingredients: [{ qty: 1, unit: 'cup', name: 'rice' }, { qty: 2, unit: 'tbsp', name: 'oil' }] }); return ED.ingredients; });
  ok(j[0].unit === 'ml' && j[0].qty === 240 && j[1].unit === 'tbsp', '7 a recipe read by Claude is converted as it arrives');
  console.log(errs.length ? errs.join('\n') : 'NO PAGE ERRORS'); await b.close();
})();
