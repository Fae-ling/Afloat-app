// The weekly check-in done on two phones at once: each person keeps their own place, one finishing never closes the
// other's screen, and both requests end up on both phones (also when one is added after the other finished).
const { chromium, devices } = require('playwright'), fs = require('fs'), path = require('path');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch(), errs = [];
  const sd = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8')); sd['home/situation'] = {}; sd['home/household'].baseline = 1;
  const open = async who => { const ctx = await b.newContext({ ...devices['iPhone 13'] }), p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(`window.__SEED=${JSON.stringify(sd)};`); await p.addInitScript(fs.readFileSync(__dirname + '/fakedb.js', 'utf8'));
    await p.addInitScript(n => { localStorage.setItem('afloat.me', n); localStorage.setItem('afloat.brief', 'x'); }, who);
    await p.clock.install({ time: new Date('2026-11-11T19:30:00') }); await p.goto('file://' + path.resolve(__dirname, '../index.html') + '#together'); await p.waitForTimeout(1200);
    if (await p.$('[data-act=brief-close]')) { await p.tap('[data-act=brief-close]'); await p.waitForTimeout(150); } return p; };
  const A = await open('Alex'), M = await open('Sam');
  /* the household's shared database: copy one phone's week and relationship docs to the other, as the sync would */
  const sync = async (from, to) => { const docs = await from.evaluate(() => Object.fromEntries(Object.entries(window.__st).filter(([k]) => k.startsWith('weeks/') || k === 'home/relationship')));
    await to.evaluate(d => { for (const [k, v] of Object.entries(JSON.parse(JSON.stringify(d)))) window.__st[k] = k.startsWith('weeks/') ? { ...(window.__st[k] || {}), ...v } : v; window.__fire(); }, docs); await to.waitForTimeout(300); };
  const txt = p => p.evaluate(() => document.querySelector('#app').innerText);
  const step = async (p, v) => { await p.tap(`[data-act=rel-step][data-v="${v}"]`); await p.waitForTimeout(150); };

  await step(A, 1); await sync(A, M);
  ok(/Tonight’s check-in/.test(await txt(M)), '1 Alex starting on her phone doesn’t move Sam’s');
  await step(M, 1); await step(A, 2); await step(A, 3); await step(A, 4); await sync(A, M);
  ok(/Appreciations/.test(await txt(M)), '2 Sam stays on his own step while Alex moves on');
  await step(M, 2); await step(M, 3); await step(M, 4);
  await A.fill('#rq_me', 'Let me have a napík'); await A.dispatchEvent('#rq_me', 'change'); await A.waitForTimeout(150);
  await M.fill('#rq_me', 'Coffee together on Saturday morning'); /* still typing… */
  await step(A, 5); await sync(A, M);
  ok(await M.$('#rq_me') && (await M.inputValue('#rq_me')) === 'Coffee together on Saturday morning', '3 Alex finishing doesn’t close Sam’s screen or lose his typing');
  ok(/Check-in done/.test(await txt(A)) && /hasn’t added a request yet/.test(await txt(A)), '4 Alex sees hers, and that Sam’s is still coming');
  await step(M, 5); await sync(M, A);
  let a = await txt(A), m = await txt(M);
  ok(/You asked Sam: Let me have a napík/.test(a) && /Sam asked you: Coffee together on Saturday morning/.test(a), '5 Alex now sees both requests');
  ok(/You asked Alex: Coffee together/.test(m) && /Alex asked you: Let me have a napík/.test(m), '6 so does Sam');
  const hist = await A.evaluate(() => window.__st['home/relationship'].history[0].req);
  ok(hist['Alex'] && hist['Sam'], '7 both are kept in the history (and on Today for the week)');

  // one phone for both, then the other adds theirs later from the done card
  const B = await open('Alex'); await step(B, 1); await step(B, 2); await step(B, 3); await step(B, 4);
  await B.fill('#rq_me', 'A walk on Sunday'); await step(B, 5);
  const N = await open('Sam'); await sync(B, N);
  ok(/Check-in done/.test(await txt(N)) && /Alex asked you: A walk on Sunday/.test(await txt(N)), '8 Sam, who never started on his phone, sees it done with her request');
  await N.fill('#rq_me', 'Ten quiet minutes after work'); await N.dispatchEvent('#rq_me', 'change'); await N.waitForTimeout(200); await sync(N, B);
  ok(/Sam asked you: Ten quiet minutes after work/.test(await txt(B)), '9 and can add his own afterwards; it reaches Alex');

  // the week rolls over: last week's request must still show, even if the saved history copy never got it (the bug of 9 Nov)
  const R = await open('Alex');
  await R.evaluate(() => { window.__st['home/relationship'] = { history: [{ wk: '2026-11-02', date: '2026-11-04', req: { 'Alex': 'Let me have a napík' }, talked: false }] };
    window.__st['weeks/2026-11-02'] = { 'relReq:Alex': 'Let me have a napík', 'relReq:Sam': 'Ten quiet minutes after work' }; window.__fire(); });
  await R.waitForTimeout(500);
  ok(/Last time you asked each other/.test(await txt(R)) && /Sam: Ten quiet minutes after work/.test(await txt(R)), '10 last week’s request shows from that week’s own record, though the history copy lacked it');
  await R.waitForTimeout(400);
  ok((await R.evaluate(() => window.__st['home/relationship'].history[0].req.Sam)) === 'Ten quiet minutes after work', '11 and the history copy is repaired');
  console.log(errs.length ? errs.join('\n') : 'NO PAGE ERRORS'); await b.close();
})();
