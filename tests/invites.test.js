// Invitations in your own Google calendar show in Afloat; a known friend who invites you is on the event;
// someone new is offered as a new friend on the Calendar tab; your own Google address is learned.
const { chromium, devices } = require('playwright'), fs = require('fs'), path = require('path');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ ...devices['iPhone 13'], timezoneId: 'Europe/Prague' });
  const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
  const seed = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8'));
  await p.addInitScript(`window.__SEED=${JSON.stringify(seed)};`);
  await p.addInitScript(fs.readFileSync(__dirname + '/fakedb.js', 'utf8'));
  await p.addInitScript(() => {
    const me = { email: 'alex@example.com', self: true };
    window.__OWN = [
      { id: 'i1', summary: 'Coffee and a walk', start: { dateTime: '2026-11-05T14:00:00+01:00' }, end: { dateTime: '2026-11-05T15:00:00+01:00' }, status: 'confirmed', updated: '2026-11-03T10:00:00Z', organizer: { email: 'jo@example.com', displayName: 'Jo' }, attendees: [{ ...me, responseStatus: 'accepted' }, { email: 'jo@example.com', organizer: true, responseStatus: 'accepted' }] },
      { id: 'i2', summary: 'Photo shoot planning', start: { dateTime: '2026-11-06T09:00:00+01:00' }, end: { dateTime: '2026-11-06T10:00:00+01:00' }, status: 'confirmed', updated: '2026-11-03T10:00:00Z', organizer: { email: 'klara@example.com', displayName: 'Klára Nováková' }, attendees: [{ ...me, responseStatus: 'needsAction' }] },
      { id: 'i3', summary: 'Declined thing', start: { dateTime: '2026-11-07T09:00:00+01:00' }, end: { dateTime: '2026-11-07T10:00:00+01:00' }, status: 'confirmed', organizer: { email: 'x@example.com' }, attendees: [{ ...me, responseStatus: 'declined' }] },
      { id: 'gpi1', summary: 'HLIDANI Zahrady (POTVRZENO)', start: { dateTime: '2026-11-06T17:00:00+01:00' }, end: { dateTime: '2026-11-08T18:00:00+01:00' }, status: 'confirmed', organizer: { email: 'babicka@example.com', displayName: 'Babička' }, attendees: [{ ...me, responseStatus: 'needsAction' }] },
      { id: 'o1', summary: 'My own reminder', start: { dateTime: '2026-11-05T08:00:00+01:00' }, end: { dateTime: '2026-11-05T08:30:00+01:00' }, status: 'confirmed', organizer: { email: 'alex@example.com', self: true } }];
    window.__G.gpi1 = { id: 'gpi1', cal: 'gp', summary: 'HLIDANI Zahrady (POTVRZENO)', start: { dateTime: '2026-11-06T17:00:00+01:00' }, end: { dateTime: '2026-11-08T18:00:00+01:00' }, status: 'confirmed', updated: '2026-11-03T10:00:00Z', organizer: { email: 'babicka@example.com', displayName: 'Babička' }, attendees: [{ ...me, responseStatus: 'needsAction' }] };
    const base = window.claude.use;
    window.claude = { use: async k => { const v = await base(k); if (k !== 'mcp' || !v) return v;
      return { callTool: async (s, t, a, o) => (s === 'Google Calendar' && t === 'list_events' && !a.calendarId) ? { payload: { summary: 'alex@example.com', events: JSON.parse(JSON.stringify(window.__OWN)) } } : v.callTool(s, t, a, o) }; } };
    localStorage.setItem('afloat.me', 'Alex'); localStorage.setItem('afloat.brief', 'x'); localStorage.setItem('afloat.calview', 'list'); localStorage.removeItem('afloat.mine');
  });
  await p.clock.install({ time: new Date('2026-11-03T16:00:00') });
  await p.goto('file://' + path.resolve(__dirname, '../index.html') + '#calendar'); await p.waitForTimeout(1600);
  if (await p.$('[data-act=brief-close]')) { await p.tap('[data-act=brief-close]'); await p.waitForTimeout(200); }
  const rows = () => p.evaluate(() => [...document.querySelectorAll('.evrow')].map(r => r.textContent.replace(/\s+/g, ' ')));
  let R = await rows();
  const coffee = R.find(x => /Coffee and a walk/.test(x)) || '';
  ok(!!coffee, '1 an invitation in your own calendar shows in Afloat (own calendar switched off)');
  const chips = await p.evaluate(() => [...[...document.querySelectorAll('.evrow')].find(r => /Coffee and a walk/.test(r.textContent)).querySelectorAll('.whochip')].map(c => c.textContent));
  ok(/invitation from Jo/.test(coffee) && chips.join(',') === 'Alex,Jo', '2 Jo invited you, so you and Jo are both on it: ' + chips);
  const shoot = R.find(x => /Photo shoot planning/.test(x)) || '';
  ok(/not answered yet/.test(shoot), '3 an unanswered invitation says so');
  ok(!R.some(x => /Declined thing|My own reminder/.test(x)), '4 declined invitations and your own events stay out');
  const card = await p.evaluate(() => (document.querySelector('.invcard') || {}).textContent || '');
  ok(/Klára Nováková/.test(card) && /klara@example.com/.test(card) && !/jo@example.com/.test(card), '5 Klára (new) is offered as a new friend; Jo (known) is not');
  ok(await p.evaluate(() => window.__st['home/people'].people['Alex'].gEmail === 'alex@example.com'), '6 your own Google address is learned, so your partner is never offered as a stranger');
  await p.screenshot({ path: __dirname + '/shots/invites.png', fullPage: true });
  await p.fill('.invcard input', 'Klára'); await p.tap('[data-act=inv-add]'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => (window.__st['home/profiles'].friends || []).some(f => f.name === 'Klára' && f.email === 'klara@example.com')), '7 Add saves Klára with her Google address');
  ok(!(await p.$('.invcard')), '8 the question goes away');
  R = await rows();
  ok(/invitation from Klára/.test(R.find(x => /Photo shoot/.test(x)) || ''), '9 her invitation now shows her name');
  // refresh: a new invitation arrives and shows after the next check
  await p.evaluate(() => window.__OWN.push({ id: 'i4', summary: 'Book club', start: { dateTime: '2026-11-08T18:00:00+01:00' }, end: { dateTime: '2026-11-08T20:00:00+01:00' }, status: 'confirmed', organizer: { email: 'jo@example.com' }, attendees: [{ email: 'alex@example.com', self: true, responseStatus: 'tentative' }] }));
  await p.clock.fastForward(6 * 60e3); await p.waitForTimeout(800);
  R = await rows();
  ok(/maybe/.test(R.find(x => /Book club/.test(x)) || ''), '10 a new invitation appears at the next 5-minute check');
  // "Never ask"
  await p.evaluate(() => window.__OWN.push({ id: 'i5', summary: 'Newsletter webinar', start: { dateTime: '2026-11-09T18:00:00+01:00' }, end: { dateTime: '2026-11-09T19:00:00+01:00' }, status: 'confirmed', organizer: { email: 'promo@example.com', displayName: 'Promo' }, attendees: [{ email: 'alex@example.com', self: true, responseStatus: 'needsAction' }] }));
  await p.evaluate(() => document.querySelector('[data-act=cal-refresh]').click()); await p.waitForTimeout(700);
  await p.tap('[data-act=inv-never]'); await p.waitForTimeout(300);
  ok(!(await p.$('.invcard')) && await p.evaluate(() => !!(window.__st['home/invites'] || {}).ignore), '11 Never ask is remembered');
  R = await rows();
  const hl = R.filter(x => /HLIDANI Zahrady/.test(x));
  ok(hl.length === 3 && hl.every(x => /from Mia & Zoe/.test(x) && /Mia/.test(x) && /Zoe/.test(x) && /invitation from Babička/.test(x)), '20 Grandma’s hlídání she invites you to shows once, as the girls’ event, with the invitation on it (one row a day, Fri to Sun)');
  console.log(errs.length ? errs.join('\n') : 'NO PAGE ERRORS'); await b.close();
})();
