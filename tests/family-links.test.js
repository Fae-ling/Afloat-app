// Us ends with Family; an invitation from someone saved in Family shows their name (and can be linked when the address differs);
// an event on the read-only grandparents' calendar can get "who's going" in Afloat only, which frees it from "girls away".
const { chromium, devices } = require('playwright'), fs = require('fs'), path = require('path');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ ...devices['iPhone 13'], timezoneId: 'Europe/Prague' });
  const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
  const seed = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8'));
  seed['home/contacts'].list.push({ id: 'ctm', name: 'Maria Rivera', role: 'Grandma', email: 'studio.rivera@example.com', group: 'Family' }, { id: 'ctl', name: 'Peter Rivera', role: 'Grandpa', email: 'dad@employer.example.com', group: 'Family' });
  await p.addInitScript(`window.__SEED=${JSON.stringify(seed)};`);
  await p.addInitScript(fs.readFileSync(__dirname + '/fakedb.js', 'utf8'));
  await p.addInitScript(() => {
    const me = { email: 'alex@example.com', self: true };
    window.__OWN = [
      { id: 'm1', summary: 'Štědrý večer u babičky', start: { dateTime: '2026-11-05T17:00:00+01:00' }, end: { dateTime: '2026-11-05T21:00:00+01:00' }, status: 'confirmed', updated: '2026-11-03T10:00:00Z', organizer: { email: 'studio.rivera@example.com', displayName: 'Maria' }, attendees: [{ ...me, responseStatus: 'accepted' }] },
      { id: 'm2', summary: 'Dinner with Dad', start: { dateTime: '2026-11-06T18:00:00+01:00' }, end: { dateTime: '2026-11-06T20:00:00+01:00' }, status: 'confirmed', updated: '2026-11-03T10:00:00Z', organizer: { email: 'dad.work@example.com', displayName: 'Dad' }, attendees: [{ ...me, responseStatus: 'accepted' }] }];
    window.__G.gpx1 = { id: 'gpx1', cal: 'gp', summary: 'Vánoce Zahrady', start: { dateTime: '2026-11-07T12:00:00+01:00' }, end: { dateTime: '2026-11-07T20:00:00+01:00' }, status: 'confirmed', updated: '2026-11-03T10:00:00Z', organizer: { email: 'studio.rivera@example.com' }, attendees: [{ ...me, responseStatus: 'accepted' }] };
    const base = window.claude.use;
    window.claude = { use: async k => { const v = await base(k); if (k !== 'mcp' || !v) return v;
      return { callTool: async (s, t, a, o) => (s === 'Google Calendar' && t === 'list_events' && !a.calendarId) ? { payload: { summary: 'alex@example.com', events: JSON.parse(JSON.stringify(window.__OWN)) } } : v.callTool(s, t, a, o) }; } };
    localStorage.setItem('afloat.me', 'Alex'); localStorage.setItem('afloat.brief', 'x'); localStorage.setItem('afloat.calview', 'list'); localStorage.removeItem('afloat.mine');
  });
  await p.clock.install({ time: new Date('2026-11-03T16:00:00') });
  await p.goto('file://' + path.resolve(__dirname, '../index.html') + '#calendar'); await p.waitForTimeout(1600);
  if (await p.$('[data-act=brief-close]')) { await p.evaluate(() => document.querySelector('[data-act=brief-close]').click()); await p.waitForTimeout(200); }
  const row = t => p.evaluate(t => { const r = [...document.querySelectorAll('.evrow')].find(x => x.textContent.includes(t)); return r ? { text: r.textContent.replace(/\s+/g, ' '), cls: r.className, chips: [...r.querySelectorAll('.whochip')].map(c => c.textContent) } : null; }, t);

  // 1 the invitation from Grandma (saved in Family) is recognised
  const eve = await row('Štědrý večer');
  ok(!!eve && /invitation from Maria Rivera/.test(eve.text), '1 an invitation from a Family contact shows her name: ' + (eve && eve.text));
  let card = await p.evaluate(() => (document.querySelector('.invcard') || {}).textContent || '');
  ok(!/studio\.rivera/.test(card), '2 she is not offered as a new person');
  // 3 an address that does not match can be linked to someone in Family
  ok(/dad\.work@example\.com/.test(card) && /Already in Family/.test(card), '3 an unknown address offers “Already in Family…”');
  await p.selectOption('[id^=invl_dad_work]', 'c:ctl'); await p.evaluate(() => document.querySelector('[data-act=inv-link]').click()); await p.waitForTimeout(500);
  const ct = await p.evaluate(() => window.__st['home/contacts'].list.find(c => c.id === 'ctl'));
  ok(ct && ct.email === 'dad@employer.example.com' && (ct.altEmails || []).includes('dad.work@example.com'), '4 linking keeps his first address and adds the new one');
  ok(!(await p.$('.invcard')), '5 the question goes away');
  ok(/invitation from Peter Rivera/.test((await row('Dinner with Dad') || {}).text || ''), '6 his invitation now shows his name');

  // 7 grandparents' calendar: read-only event is the girls', until we say who is going
  let x = await row('Vánoce Zahrady');
  ok(x && /k-grandma/.test(x.cls) && x.chips.join(',') === 'Mia,Zoe', '7 an event on the grandparents’ calendar starts as the girls’ time: ' + (x && x.chips));
  await p.evaluate(() => { window.__calls.length = 0; });
  await p.evaluate(() => [...document.querySelectorAll('.evrow')].find(r => r.textContent.includes('Vánoce Zahrady')).click()); await p.waitForTimeout(300);
  ok(/Who’s going/.test(await p.evaluate(() => (document.querySelector('.gpform') || {}).textContent || '')), '8 tapping it opens “Who’s going”');
  for (const n of ['Alex', 'Sam']) await p.evaluate(n => document.querySelector(`[data-act=gw-tog][data-n="${n}"]`).click(), n);
  await p.evaluate(() => document.querySelector('[data-act=gw-save]').click()); await p.waitForTimeout(500);
  x = await row('Vánoce Zahrady');
  ok(x && /k-family/.test(x.cls) && [...x.chips].sort().join(',') === 'Alex,Mia,Sam,Zoe', '9 it now lists all four and is a family event, not girls away: ' + (x && x.chips));
  ok(await p.evaluate(() => Object.values((window.__st['home/gpwho'] || {}).by || {}).some(w => w.length === 4)), '10 the choice is kept in Afloat');
  ok(await p.evaluate(() => !window.__calls.some(c => /create_event|update_event|delete_event/.test(JSON.stringify(c)) && /d5d/.test(JSON.stringify(c)))), '11 nothing is written to the grandparents’ calendar');
  await p.evaluate(() => [...document.querySelectorAll('.evrow')].find(r => r.textContent.includes('Vánoce Zahrady')).click()); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('[data-act=gw-reset]').click()); await p.waitForTimeout(400);
  x = await row('Vánoce Zahrady');
  ok(x && /k-grandma/.test(x.cls), '12 “Back to what the calendar says” undoes it');

  // 13 Us ends with Family
  await p.evaluate(() => { location.hash = 'care'; }); await p.waitForTimeout(400);
  const order = await p.evaluate(() => ['care', 'together', 'trips', 'family'].map(h => { const a = document.querySelector(`a[href="#${h}"], [data-href="#${h}"], [data-go="${h}"]`); return a ? a.textContent.trim() : null; }));
  ok(order.every(Boolean) && order.join('|') === 'Self-care|Together|Trips|Family', '13 Us sub-tabs read Self-care, Together, Trips, Family: ' + order);
  const pos = await p.evaluate(() => ['care', 'together', 'trips', 'family'].map(h => { const a = document.querySelector(`a[href="#${h}"], [data-href="#${h}"], [data-go="${h}"]`); return a ? a.getBoundingClientRect().left : -1; }));
  ok(pos.every((v, i) => i === 0 || v > pos[i - 1]), '14 and appear in that order on screen: ' + pos.map(Math.round));
  console.log(errs.length ? errs.join('\n') : 'NO PAGE ERRORS'); await b.close();
})();
