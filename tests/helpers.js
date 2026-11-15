// Shared set-up for browser tests, so a new test is a few lines. Older tests carry their own copy of this; new ones use it.
//   const { start, ok, done } = require('./helpers');
//   (async () => { const t = await start(); const p = await t.open({ hash: 'today', seed: { 'home/x': {...} } });
//     ok(/Good morning/.test(await t.text(p)), '1 says good morning'); await done(t); })();
// open() options: seed (merged over tests/seed.json), hash, T (the clock), who ('Alex' or 'Sam'), fresh (start from seed alone, without
// tests/seed.json: a brand-new household), brief (show the
// briefing), cards (extra Trello cards), calm (calm Today on), init (a function run in the page before the app starts, after the fakes).
// Page errors are collected; done() prints NO PAGE ERRORS (or FAIL) for tests/run-all.js. allow: patterns of expected errors.
const { chromium, devices } = require('playwright'), fs = require('fs'), path = require('path');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const SEED = () => JSON.parse(fs.readFileSync(path.join(__dirname, 'seed.json'), 'utf8'));
async function start() {
  const b = await chromium.launch(), ctx = await b.newContext({ ...devices['iPhone 13'] }), errs = [];
  const t = { b, ctx, errs, allow: [] };
  t.open = async ({ seed = {}, fresh = false, hash = 'today', T = '2026-11-05T10:30:00', who = 'Alex', brief = false, cards = [], calm = false, init = null } = {}) => {
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    const st = fresh ? { ...seed } : { ...SEED(), ...seed };
    await p.addInitScript(`window.__SEED=${JSON.stringify(st)};window.__TR_ME=${JSON.stringify(who === 'Sam' ? 'm' : 'a')};window.__EXTRA_CARDS=${JSON.stringify(cards)};${calm ? 'window.__CALM=1;' : ''}`);
    await p.addInitScript(fs.readFileSync(path.join(__dirname, 'fakedb.js'), 'utf8')); await p.addInitScript(fs.readFileSync(path.join(__dirname, 'fake-trello.js'), 'utf8'));
    await p.addInitScript(([n, br]) => { localStorage.setItem('afloat.me', n); if (!br) localStorage.setItem('afloat.brief', 'x'); }, [who, brief]);
    if (init) await p.addInitScript(init); /* runs after the fakes: e.g. () => { window.__SAMPLE = () => ({}); } */
    await p.clock.install({ time: new Date(T) });
    await p.goto('file://' + path.resolve(__dirname, '../index.html') + '#' + hash);
    await p.waitForFunction(() => window.__afloatReady, null, { timeout: 15000 }); await p.waitForTimeout(400);
    if (!brief) await t.shut(p);
    return p;
  };
  t.shut = async p => { if (await p.$('button[data-act=brief-close]')) { await p.tap('button[data-act=brief-close]'); await p.waitForTimeout(150); } };
  t.go = async (p, hash) => { await p.evaluate(h => { location.hash = h; }, hash); await p.waitForTimeout(250); };
  t.tap = async (p, sel) => { const r = await p.tap(sel, { timeout: 3000 }).then(() => true, () => false); await p.waitForTimeout(250); return r; };
  t.text = (p, sel = '#app') => p.$eval(sel, x => x.innerText).catch(() => '');
  t.st = p => p.evaluate(() => window.__st);
  return t;
}
async function done(t) {
  const bad = t.errs.filter(m => !t.allow.some(a => a.test(m)));
  console.log(bad.length ? 'FAIL page errors: ' + bad.slice(0, 5).join(' | ') : 'NO PAGE ERRORS');
  await t.b.close();
}
module.exports = { start, ok, done, SEED };
