// A copy of everything (9 Nov 2026): Settings → Download a copy makes one JSON file in the shape the "Bring back a copy"
// import in Connections reads, remembers when (home/household.backupAt), and the briefing nudges in the first week of a
// month when the last copy is over a month old.
const { start, ok, done, SEED } = require('./helpers');
(async () => {
  const t = await start();
  const hh = { ...SEED()['home/household'] }; delete hh.backupAt;
  const p = await t.open({ seed: { 'home/household': hh }, T: '2026-11-03T09:00:00', brief: true,
    init: () => { window.__dl = null; const ce = URL.createObjectURL; URL.createObjectURL = b => { window.__blob = b; return ce.call(URL, b); }; HTMLAnchorElement.prototype.click = function () { window.__dl = this.download; }; } });
  ok(/since the last copy of Afloat’s data/.test(await t.text(p, '#sheet')), '1 the briefing reminds, in the first week of the month, when there is no copy yet');
  await t.shut(p); await t.tap(p, '[data-act=settings]');
  ok(/A copy of everything/.test(await t.text(p, '#sheet')) && /No copy yet/.test(await t.text(p, '#sheet')), '2 Settings offers Download a copy');
  await t.tap(p, '[data-act=backup]'); await p.waitForTimeout(800);
  const file = await p.evaluate(async () => JSON.parse(await window.__blob.text())), name = await p.evaluate(() => window.__dl);
  ok(name === 'afloat-copy-2026-11-03.json', '3 the file is named with the date: ' + name);
  ok(file.apps && file.apps.afloat && file.apps.afloat['home/household'] && file.apps.afloat['home/rhythms'] && Object.keys(file.apps.afloat).some(k => k.startsWith('events/')) && file.photos && typeof file.photos === 'object', '4 it holds the household’s documents, in the import’s shape');
  const st = await t.st(p);
  ok(st['home/household'].backupAt > 0 && /Last copy: /.test(await t.text(p, '#sheet')), '5 the time of the copy is remembered and shown');
  const p2 = await t.open({ seed: { 'home/household': { ...hh, backupAt: Date.parse('2026-10-20T10:00:00') } }, T: '2026-11-03T09:00:00', brief: true });
  ok(!/since the last copy/.test(await t.text(p2, '#sheet')), '6 no reminder when the last copy is recent');
  await done(t);
})();
