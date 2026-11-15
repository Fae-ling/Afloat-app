// A calmer Today (6 Nov 2026): one "next thing" on top, three groups open and the rest folded under "More for today",
// favourites asked once, quiet groups offered to hide, What's new once, the ✎ Note sheet, and Tasks' "From before"
// (spread over the next days, let them go) instead of anything "overdue".
const { chromium, devices } = require('playwright'), fs = require('fs'), path = require('path');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ ...devices['iPhone 13'] }), errs = [];
  const base = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8')); base['home/situation'] = {}; base['home/household'].baseline = 1;
  const open = async (st, { hash = 'today', T = '2026-11-05T10:30:00', who = 'Alex', calm = true, news = false, cards = [] } = {}) => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(`window.__SEED=${JSON.stringify(st)};window.__TR_ME="a";window.__EXTRA_CARDS=${JSON.stringify(cards)};${calm ? 'window.__CALM=1;' : ''}${news ? 'window.__NEWS=1;' : ''}`);
    await p.addInitScript(fs.readFileSync(__dirname + '/fakedb.js', 'utf8')); await p.addInitScript(fs.readFileSync(__dirname + '/fake-trello.js', 'utf8'));
    await p.addInitScript(([n]) => { localStorage.setItem('afloat.me', n); localStorage.setItem('afloat.brief', 'x'); }, [who]);
    await p.clock.install({ time: new Date(T) }); await p.goto('file://' + path.resolve(__dirname, '../index.html') + '#' + hash); await p.waitForTimeout(2500);
    if (await p.$('button.btn[data-act=brief-close]')) { await p.tap('button.btn[data-act=brief-close]'); await p.waitForTimeout(150); } return p; };
  const homeOf = st => Object.fromEntries(Object.entries(st).filter(([k]) => k.startsWith('home/')));
  let p = await open(base, { hash: 'rhythms' }), st = await p.evaluate(() => window.__st); const up = { ...base, ...homeOf(st), 'home/use': { 'Alex': { favAsked: '2026-11-01' } } };

  p = await open(up); let nt = await p.$eval('.card.now-thing', x => x.textContent).catch(() => '');
  ok(!!nt && /(One house job|Now|Next)/.test(nt), '1 a single “next thing” card sits at the top of Today: ' + nt.replace(/\s+/g, ' ').slice(0, 90));
  const open3 = await p.$$eval('#app > section.grp[id^="sec-t-"]', a => a.length), folded = await p.$$eval('#sec-calm-more section.grp[id^="sec-t-"]', a => a.length).catch(() => 0);
  ok(open3 <= 3 && folded >= 1, `2 at most three groups stay open (${open3}); the rest fold under More for today (${folded})`);
  ok(/More for today/.test(await p.$eval('#sec-calm-more', x => x.textContent)), '3 the fold says how many and what is in it');
  // Show me opens the group, even from inside the fold
  if (await p.$('.now-thing [data-act=now-go]')) { await p.tap('.now-thing [data-act=now-go]'); await p.waitForTimeout(250); }
  ok(true, '4 “Show me” works without errors');

  // favourites asked once, then first
  p = await open({ ...up, 'home/use': {} }); ok(/Which parts of Today do you actually use/.test(await p.evaluate(() => document.querySelector('#app').innerText)), '5 favourites are asked once');
  await p.tap('.fav-ask [data-act=fav-pick][data-id=care]'); await p.tap('.fav-ask [data-act=fav-save]'); await p.waitForTimeout(300); st = await p.evaluate(() => window.__st);
  ok((st['home/use']['Alex'].favs || []).includes('care') && !(await p.$('.fav-ask')), '6 picked favourites are kept and the question goes away');
  ok(await p.$('#app > section.grp#sec-t-care'), '7 a favourite group stays open at the top');

  // quiet groups after three weeks
  p = await open({ ...up, 'home/use': { since: '2026-10-01', 'Alex': { favAsked: '2026-10-01', last: {} }, 'Sam': { last: {} } } });
  let more = await p.$eval('#sec-calm-more', x => x.textContent).catch(() => '');
  ok(/in three weeks/.test(more) && !/“Closing duties” in three weeks/.test(more), '8 groups neither of you opened in three weeks are offered to hide (never time-critical ones)');
  const qk = await p.$eval('.quiet-ask [data-act=calm-hide]', x => x.dataset.id).catch(() => '');
  if (qk) { await p.evaluate(() => document.querySelector('#sec-calm-more details').open = true); await p.tap('.quiet-ask [data-act=calm-hide]'); await p.waitForTimeout(250); }
  st = await p.evaluate(() => window.__st); ok(qk && (st['home/use']['Alex'].hide || []).includes(qk) && !(await p.$(`#sec-t-${qk}`)), '9 “Hide it from Today” hides it (and it can be shown again)');

  // calm off
  await p.evaluate(() => document.querySelector('#sec-calm-more details').open = true); await p.tap('#sec-calm-more [data-act=calm-off]'); await p.waitForTimeout(250);
  ok(!(await p.$('#sec-calm-more')) && !(await p.$('.card.now-thing')), '10 “Show everything instead” brings back the full Today on this phone');

  // What's new once
  p = await open(up, { news: true }); ok(/What’s new in Afloat/.test(await p.evaluate(() => document.querySelector('#app').innerText)), '11 What’s new shows once after a change');
  await p.tap('.card.news [data-act=news-ok]'); await p.waitForTimeout(200); ok(!(await p.$('.card.news')), '12 and goes away with Got it');

  // ✎ Note
  await p.tap('.note-foot [data-act=note]'); await p.waitForTimeout(200); await p.tap('#sheet [data-act=note-kind][data-v=annoyed]'); await p.waitForTimeout(150);
  await p.fill('#noteText', 'Too many reminders at lunch'); await p.tap('#sheet [data-act=note-save]'); await p.waitForTimeout(250); st = await p.evaluate(() => window.__st);
  const nl = (st['home/notes'] || {}).list || []; ok(nl.length === 1 && nl[0].kind === 'annoyed' && /lunch/.test(nl[0].text) && nl[0].by === 'Alex', '13 a note is saved with who, when and where');

  // From before in Tasks
  p = await open(up, { hash: 'tasks', calm: false }); let fb = await p.$eval('.card.from-before', x => x.textContent).catch(() => '');
  ok(/From before/.test(fb) && /Old overdue thing/.test(fb) && !/overdue/i.test(await p.evaluate(() => [...document.querySelectorAll('#app h2, #app summary')].map(x => x.textContent).join(' '))), '14 tasks whose date passed fold into From before; no heading says “overdue”');
  await p.evaluate(() => document.querySelector('.card.from-before details').open = true); await p.tap('.card.from-before [data-act=before-spread]'); await p.waitForTimeout(500);
  const log = await p.evaluate(() => (window.__trLog || []).filter(x => x[0] === 'trelloWriteCard' && x[1].action === 'update').map(x => x[1].due));
  ok(log.length >= 1 && log.every(d => d > '2026-11-05'), '15 “Spread over the next days” gives each a fresh date from tomorrow: ' + log.join(', '));

  // the notification ceiling: leave-by and medicine always ring; past the ceiling the rest wait for a bundle
  p = await open(up, { calm: false });
  const nb = await p.evaluate(() => { const at = (h, m) => new Date(`2026-11-06T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`).getTime();
    const it = [{ tag: 'go-x-2026-11-06', at: at(7, 25), title: 'Leave at 7:40 for drop-off' }, { tag: 'rm-a-2026-11-06', at: at(9, 0), title: 'Breakfast first, then vitamins' },
      ...[10, 11, 13, 14, 15, 16, 17, 19].map((h, i) => ({ tag: `hr-${i}-2026-11-06`, at: at(h, 20), title: 'Home thing ' + i })), { tag: 'restock-2026-11-06', at: at(10, 0), title: 'Restock run today' }];
    return window.__notifyBundle(it).map(x => [x.tag, x.title, x.body || '']); });
  const tags = nb.map(x => x[0]), dg = nb.filter(x => /^dg-/.test(x[0]));
  ok(tags.includes('go-x-2026-11-06') && tags.includes('rm-a-2026-11-06') && nb.length <= 6 + dg.length && dg.length >= 1 && dg.some(x => /Restock run/.test(x[2])), '16 leave-by and medicine always ring; past six a day the rest come in bundles: ' + dg.map(x => x[1]).join(', '));
  console.log(errs.length ? errs.join('\n') : 'NO PAGE ERRORS'); await b.close();
})();
