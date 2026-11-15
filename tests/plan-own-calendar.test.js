// Plan tomorrow lists events from your own Google calendar, even with "show my own calendar" off.
const { chromium, devices } = require('playwright'), fs = require('fs'), path = require('path');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ ...devices['iPhone 13'], timezoneId: 'Europe/Prague' });
  const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
  const seed = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8'));
  await p.addInitScript(`window.__SEED=${JSON.stringify(seed)};`);
  await p.addInitScript(fs.readFileSync(__dirname + '/fakedb.js', 'utf8'));
  // a personal calendar: list_events without a calendarId is "your own calendar"
  await p.addInitScript(() => {
    const base = window.claude.use;
    window.claude = { use: async k => { const v = await base(k); if (k !== 'mcp' || !v) return v;
      return { callTool: async (s, t, a, o) => {
        if (s === 'Google Calendar' && t === 'list_events' && !a.calendarId) { (window.__own = window.__own || []).push(a);
          return { payload: { events: [{ id: 'own1', summary: 'Friend’s birthday', start: { date: '2026-11-04' }, end: { date: '2026-11-05' }, status: 'confirmed', updated: '2026-05-04T13:38:33Z' },
            { id: 'own2', summary: 'Call with the bank', start: { dateTime: '2026-11-04T11:00:00+01:00' }, end: { dateTime: '2026-11-04T11:30:00+01:00' }, status: 'confirmed' }] } }; }
        return v.callTool(s, t, a, o); } }; } };
    localStorage.setItem('afloat.me', 'Alex'); localStorage.setItem('afloat.brief', 'x'); localStorage.removeItem('afloat.mine');
  });
  await p.clock.install({ time: new Date('2026-11-03T16:00:00') });
  await p.goto('file://' + path.resolve(__dirname, '../index.html') + '#rhythms'); await p.waitForTimeout(1500);
  if (await p.$('[data-act=brief-close]')) { await p.tap('[data-act=brief-close]'); await p.waitForTimeout(200); }
  const card = () => p.evaluate(() => [...document.querySelectorAll('section.card.plan')].map(x => x.textContent).join(' | '));
  const t = await card();
  ok(/All day\s*Friend’s birthday\s*Your calendar/.test(t), '1 the all-day birthday from your own calendar shows');
  ok(/11:00\s*11:30\s*Call with the bank\s*Your calendar/.test(t), '2 a timed event from your own calendar shows with its time');
  ok((await p.evaluate(() => window.__own.length)) >= 1 && (await p.evaluate(() => window.__own[0].startTime)) === '2026-11-03T00:00:00' && (await p.evaluate(() => window.__own[0].endTime)) === '2026-11-05T00:00:00', '3 today and tomorrow in one request');
  await p.screenshot({ path: __dirname + '/shots/plan-own.png', fullPage: true });
  await p.tap('.plan [data-act=plan-from-ev][data-g=own2]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => (window.__st['plans/2026-11-04'] || {})['Alex']?.events?.some(e => e.title === 'Call with the bank' && e.time === '11:00')), '4 “Plan for it” adds it to tomorrow’s plan');
  await p.waitForTimeout(500);
  ok((await p.evaluate(() => window.__own.length)) <= 2, '5 it doesn’t keep re-asking Google on every redraw');
  console.log(errs.length ? errs.join('\n') : 'NO PAGE ERRORS'); await b.close();
})();
