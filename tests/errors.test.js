// Errors a phone runs into are kept in home/errors (at most 30, once a day each, network hiccups left out), and
// "Copy them all" in the ✎ Note sheet includes them, so the next fix starts from the exact file and line.
const { start, ok, done } = require('./helpers');
(async () => {
  const t = await start(); t.allow = [/boom from a test/, /Failed to fetch/];
  const p = await t.open({ seed: { 'home/notes': { list: [{ at: '2026-11-04T10:00:00', by: 'Alex', kind: 'annoyed', text: 'too many cards', where: 'Today' }] } } });
  await p.evaluate(() => { queueMicrotask(() => { throw new Error('boom from a test'); }); queueMicrotask(() => { throw new Error('boom from a test'); }); Promise.reject(new Error('Failed to fetch')); });
  await p.waitForTimeout(100); await p.clock.runFor(6500); await p.waitForTimeout(300);
  const L = ((await t.st(p))['home/errors'] || {}).list || [];
  ok(L.length === 1 && /boom from a test/.test(L[0].msg) && L[0].by === 'Alex' && L[0].view === 'today', '1 an error is kept once, with who and which screen; a network hiccup is left out (' + L.length + ' kept)');
  await t.shut(p); await t.tap(p, '[data-act=note]');
  ok(/errors Afloat ran into \(1\)/.test(await t.text(p, '#sheet')), '2 the ✎ Note sheet says how many errors there are');
  await p.evaluate(() => { window.__copied = ''; navigator.clipboard.writeText = s => { window.__copied = s; return Promise.resolve(); }; });
  await p.$eval('#sheet details', d => { d.open = true; }); await t.tap(p, '[data-act=note-copy]');
  const c = await p.evaluate(() => window.__copied);
  ok(/ANNOYED \[Today\]: too many cards/.test(c) && /ERROR \[today\] .*boom from a test/.test(c), '3 Copy them all has the notes and the errors');
  await done(t);
})();
