// Tasks: "Mine" pulls every card you're responsible for across boards; "Everything" shows the rest with names.
const { chromium, devices } = require('playwright'), fs = require('fs'), path = require('path');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ ...devices['iPhone 13'], timezoneId: 'Europe/Prague' });
  const seed = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8')), T = seed['home/trello'], L = T.lists, P = T.people;
  const uA = { id: 'ari:user/a', fullName: 'Alex' }, uM = { id: 'ari:user/m', fullName: 'Sam Rivera' };
  const dom = { id: T.board, name: 'Domácnost' }, pro = { id: 'ari:board/pro', name: 'Projekty' };
  let n = 100; const c = (list, lname, board, name, members = [], due = null) => ({ id: 'ari:card/x' + (++n), name, url: 'https://trello.example/c/' + n, list: { id: list, name: lname }, board, due, complete: false, closed: false, labels: [], members });
  const extra = [c('ari:list/char', 'Postavy', pro, 'Write villain backstory', [uA]), c(L.chores, 'Chores', dom, 'Fix the dripping tap', [uM]),
    c(L.chores, 'Chores', dom, 'Call the plumber', [uA]), c(P['Sam'], 'Markovy tudůs', dom, 'Sam’s own errand'), c(P['Alex'], 'Anežčiny To-Dos', dom, 'Renew passport photos'),
    c(L.home, 'Domácnost', dom, 'Change the bed sheets', [uA, uM])];
  const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(`window.__SEED=${JSON.stringify(seed)};window.__TR_ME='a';window.__EXTRA_CARDS=${JSON.stringify(extra)};`);
  await p.addInitScript(fs.readFileSync(__dirname + '/fakedb.js', 'utf8')); await p.addInitScript(fs.readFileSync(__dirname + '/fake-trello.js', 'utf8'));
  await p.addInitScript(() => { localStorage.clear(); localStorage.setItem('afloat.me', 'Alex'); localStorage.setItem('afloat.brief', 'x'); });
  await p.clock.install({ time: new Date('2026-11-03T15:00:00') });
  await p.goto('file://' + path.resolve(__dirname, '../index.html') + '#tasks'); await p.waitForTimeout(1600);
  if (await p.$('[data-act=brief-close]')) { await p.tap('[data-act=brief-close]'); await p.waitForTimeout(150); }
  const main = () => p.evaluate(() => [...document.querySelectorAll('#app section.card')].filter(s => !s.querySelector('details[data-grp="t-shared"],details[data-grp="tasks-lists"]')).map(s => s.textContent).join(' | '));
  const shared = () => p.evaluate(() => (document.querySelector('details[data-grp="t-shared"]') || {}).textContent || '');
  ok(/Mine/.test(await p.evaluate(() => document.querySelector('.seg.tview .on').textContent)), '1 Tasks opens on Mine');
  let t = await main();
  ok(/Write villain backstory/.test(t), '2 a card you’re on shows even in a reference list (Postavy)');
  ok(/Call the plumber/.test(t) && /Renew passport photos/.test(t), '3 your card on the shared board and your own list both show');
  ok(/Pitch draft/.test(t) && /Research sources/.test(t), '4 everything on a board only you use counts as yours');
  ok(/Change the bed sheets[^|]*with Sam/.test(t), '5 a card you share with Sam shows “with Sam”');
  ok(!/Fix the dripping tap|Sam’s own errand/.test(t), '6 Sam’s cards and his own list stay out of Mine');
  ok(/Wipe shelves/.test(await shared()) && !/Wipe shelves/.test(t), '7 unassigned house cards sit under Shared, nobody’s on it yet');
  await p.screenshot({ path: __dirname + '/shots/tasks-mine.png', fullPage: true });
  const go = await p.evaluate(() => { const sc = [...document.querySelectorAll('#app section.card')].pop(); return sc && sc.classList.contains('trello-go') ? [...sc.querySelectorAll('a')].map(a => a.textContent + '=' + a.getAttribute('href')) : []; });
  ok(go[0] === 'Open Trello ↗=https://trello.com/' && go.some(x => /^Projekty=/.test(x)), '7b the last card on Tasks opens Trello, with a link per board: ' + go.join(' | '));
  await p.tap('[data-act=tview][data-v=all]'); await p.waitForTimeout(250);
  t = await p.evaluate(() => document.querySelector('#app').textContent);
  ok(/Fix the dripping tap[^|]*Sam/.test(t) && /Sam’s own errand/.test(t), '8 Everything shows Sam’s cards with his name');
  ok(await p.evaluate(() => localStorage.getItem('afloat.tview')) === 'all', '9 the choice is remembered on this device');
  await p.evaluate(() => { location.hash = 'today'; }); await p.waitForTimeout(300);
  const today = await p.evaluate(() => { const h = [...document.querySelectorAll('#app h2')].find(x => x.textContent === 'Due soon'); return h ? h.closest('section').textContent : ''; });
  ok(!/Fix the dripping tap/.test(today) && !/Call the plumber/.test(today), '10 Today no longer lists the whole to-do list (that lives in Tasks), and never Sam’s');
  console.log(errs.length ? errs.join('\n') : 'NO PAGE ERRORS'); await b.close();
})();
