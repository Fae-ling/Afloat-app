// The installed app's own parts (9 Nov 2026, after the claude.ai artifact mode was retired): Claude this month with where the
// money went, the Meals tab as a frame, and Connections opening from Settings.
const { start, ok, done } = require('./helpers');
(async () => {
  const t = await start();
  const p = await t.open({ seed: { 'usage/2026-11': { usd: 0.42, calls: 31, feature: { notice: 0.3, sorting: 0.1, mystery: 0.02 } } },
    init: () => { window.__SAMPLE = () => ({}); window.__opened = 0; window.claude.use = (u => k => k === 'permissions' ? Promise.resolve({ manage: () => { window.__opened++; return Promise.resolve(); } }) : u(k))(window.claude.use); } });
  await t.tap(p, '[data-act=settings]'); await p.waitForTimeout(400);
  const s = await t.text(p, '#sheet');
  ok(/Claude this month/.test(s) && /\$0\.42/.test(s) && /Where it went: Reading photos and notices \$0\.30 · Sorting the brain dump \$0\.10 · mystery \$0\.02/.test(s), '1 Settings shows Claude this month and where the money went');
  ok(!/claude\.ai/.test(s) && /Connect Trello, Google and people/.test(s), '2 Settings talks about Connections, never claude.ai');
  await t.tap(p, '[data-act=perm-manage]');
  ok(await p.evaluate(() => window.__opened) === 1, '3 “Connect Trello, Google and people…” opens Connections');
  await p.reload(); await p.waitForFunction(() => window.__afloatReady); await t.shut(p); await t.go(p, 'meals'); await p.waitForTimeout(400);
  ok(await p.$eval('#meals', m => !m.hidden && !!m.querySelector('iframe.meals-frame[src*="mode=meals"]')).catch(() => false), '4 the Meals tab shows Mealtime in its frame');
  await t.go(p, 'mealplan'); await p.waitForTimeout(300);
  ok(await p.$eval('#meals', m => !m.hidden && m._mode === 'plan').catch(() => false), '5 Plan → Meal Plan reuses the same frame for the week plan');
  await done(t);
})();
