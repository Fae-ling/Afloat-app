// The quick check (about 15 seconds): opens every screen and the main sheets with the test household and fails on any page
// error. Run it after every change, before the related tests: node tests/smoke.test.js
const { start, ok, done } = require('./helpers');
(async () => {
  const t = await start(), p = await t.open();
  for (const v of ['today', 'tasks', 'calendar', 'plans', 'rhythms', 'care', 'together', 'trips', 'family', 'support', 'stuck', 'breakdown', 'overload', 'breathe', 'priorities', 'reset', 'focus', 'focus-areas', 'focus-done']) {
    await t.go(p, v); const s = await t.text(p);
    ok(s.length > 40 && !/Opening your home/.test(s), `#${v} shows something`);
  }
  for (const act of ['capture', 'settings']) {
    await p.reload(); await p.waitForFunction(() => window.__afloatReady); await p.waitForTimeout(300); await t.shut(p);
    ok(await t.tap(p, `[data-act=${act}]`) && (await t.text(p, '#sheet')).length > 20, `the ${act} sheet opens`);
  }
  await done(t);
})();
