// Repeating events and the other Google Calendar options (reminders, busy/free, visibility, Meet), both ways.
const { chromium, devices } = require('playwright'), fs = require('fs'), path = require('path');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const APP = 'file://' + path.resolve(__dirname, '../index.html');
async function open(ctx, seed, hash = '#calendar') {
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.addInitScript(`window.__SEED=${JSON.stringify(seed)};`);
  await p.addInitScript(fs.readFileSync(__dirname + '/fakedb.js', 'utf8'));
  // Google expands a weekly series into separate repeats with recurringEventId, like the real connector
  await p.addInitScript(() => { const base = window.claude.use; window.__gLog = []; window.__REC = {};
    window.claude = { use: async k => { const v = await base(k); if (k !== 'mcp' || !v) return v;
      return { callTool: async (s, t, a, o) => { if (s === 'Google Calendar') window.__gLog.push([t, JSON.parse(JSON.stringify(a))]);
        const r = await v.callTool(s, t, a, o);
        if (s === 'Google Calendar' && t === 'create_event' && a.recurrenceData) window.__REC[r.payload.id] = a.recurrenceData[0];
        if (s === 'Google Calendar' && t === 'delete_event') delete window.__G[a.eventId];
        if (s === 'Google Calendar' && t === 'list_events' && a.calendarId) { const evs = []; for (const e of r.payload.events || []) { const rr = window.__REC[e.id];
          if (!rr) { evs.push(e); continue; } for (let w = 0; w < 10; w++) { const sh = x => { const d = new Date(x); d.setDate(d.getDate() + 7 * w); return d.toISOString().replace('.000Z', 'Z'); };
            evs.push({ ...e, id: e.id + '_' + w, recurringEventId: e.id, start: { dateTime: sh(e.start.dateTime) }, end: { dateTime: sh(e.end.dateTime) } }); } }
          return { payload: { ...r.payload, events: evs } }; }
        return r; } }; } };
    localStorage.setItem('afloat.me', 'Alex'); localStorage.setItem('afloat.brief', 'x'); localStorage.setItem('afloat.calview', 'list'); });
  await p.clock.install({ time: new Date('2026-11-03T16:00:00') });
  await p.goto(APP + hash); await p.waitForTimeout(1500);
  if (await p.$('[data-act=brief-close]')) { await p.tap('[data-act=brief-close]'); await p.waitForTimeout(200); }
  return p;
}
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ ...devices['iPhone 13'], timezoneId: 'Europe/Prague' });
  const seed = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8'));
  const p = await open(ctx, seed);
  await p.tap('[data-act=ev-new]'); await p.waitForTimeout(200);
  await p.fill('#evTitle', 'Swimming lessons'); await p.fill('#evDate', '2026-11-04'); await p.dispatchEvent('#evDate', 'change'); await p.waitForTimeout(100);
  await p.fill('#evStart', '17:00'); await p.fill('#evEndT', '18:00');
  await p.tap('[data-act=ev-who][data-n=Mia]');
  const opts = await p.evaluate(() => [...document.querySelectorAll('#evRepeat option')].map(o => o.textContent));
  ok(opts.includes('Every week on Wednesday') && opts.includes('Every month on the first Wednesday') && opts.includes('Every year on 4 November') && opts.includes('Every weekday (Mon–Fri)') && opts.includes('Custom…'), '1 Repeat offers Google’s choices for the chosen day');
  await p.selectOption('#evRepeat', 'weekly'); await p.waitForTimeout(150);
  ok(/Every week on Wed\./.test(await p.evaluate(() => document.querySelector('.evform').textContent)), '2 the rule is spelled out');
  await p.tap('[data-act=ev-rem][data-v="30"]'); await p.tap('[data-act=ev-rem][data-v="1440"]');
  await p.tap('[data-act=ev-free][data-v=free]'); await p.selectOption('#evVis', 'private'); await p.check('#evMeet');
  await p.screenshot({ path: __dirname + '/shots/recur-form.png', fullPage: true });
  await p.tap('.evform button[type=submit]'); await p.waitForTimeout(700);
  const ce = await p.evaluate(() => window.__gLog.filter(x => x[0] === 'create_event').map(x => x[1]).pop());
  ok(ce && JSON.stringify(ce.recurrenceData) === '["RRULE:FREQ=WEEKLY;BYDAY=WE"]', '3 Google gets the repeat rule: ' + (ce && ce.recurrenceData));
  ok(ce && JSON.stringify(ce.overrideReminders) === '[{"method":"popup","minutes":30},{"method":"popup","minutes":1440}]', '4 both reminders go to Google');
  ok(ce && ce.availability === 'AVAILABILITY_FREE' && ce.visibility === 'private' && ce.addGoogleMeetUrl === true, '5 Free, Private and a Meet link go to Google');
  await p.evaluate(() => document.querySelector('[data-act=cal-refresh]').click()); await p.waitForTimeout(700);
  let rows = await p.evaluate(() => [...document.querySelectorAll('.evrow')].filter(r => /Swimming lessons/.test(r.textContent)).map(r => r.textContent));
  ok(rows.length >= 6 && rows.every(r => /↻ repeats/.test(r) && /Mia/.test(r)), '6 every repeat shows, marked ↻ and with Mia: ' + rows.length);
  // tap the third repeat: the whole series opens
  await p.evaluate(() => [...document.querySelectorAll('.evrow')].filter(r => /Swimming lessons/.test(r.textContent))[2].click()); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.querySelector('#evDate').value) === '2026-11-04' && /Delete every repeat/.test(await p.evaluate(() => document.querySelector('.evform').textContent)), '7 a repeat opens the series, starting 4 Nov');
  // change the rule → re-created in Google
  await p.selectOption('#evRepeat', 'custom'); await p.waitForTimeout(150);
  await p.fill('#evInt', '2'); await p.dispatchEvent('#evInt', 'change'); await p.waitForTimeout(100);
  await p.tap('[data-act=ev-rday][data-v=FR]'); await p.tap('[data-act=ev-rends][data-v=count]'); await p.waitForTimeout(100);
  ok(/Every 2 weeks on Wed, Fri, 10 times\./.test(await p.evaluate(() => document.querySelector('.evform').textContent)), '8 custom: every 2 weeks on Wed and Fri, 10 times');
  await p.tap('.evform button[type=submit]'); await p.waitForTimeout(700);
  const g2 = await p.evaluate(() => window.__gLog.slice(-6).map(x => x[0] + ':' + (x[1].recurrenceData || '')));
  ok(g2.some(x => x === 'delete_event:') && g2.some(x => x === 'create_event:RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=WE,FR;COUNT=10'), '9 a changed rule re-creates the series in Google: ' + g2.join(' | '));
  const errs = [...p.errs];
  // without Google: Afloat works the repeats out itself
  const s2 = JSON.parse(JSON.stringify(seed)); delete s2['home/calendar'].calId;
  s2['events/r1'] = { title: 'Choir', kind: 'family', who: ['Alex'], date: '2026-11-05', endDate: '2026-11-05', allDay: false, start: '19:00', end: '20:30', recur: { freq: 'WEEKLY', interval: 2, byday: ['MO', 'TH'], ends: 'count', count: 4 }, rrule: 'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH;COUNT=4', at: 1 };
  s2['events/r2'] = { title: 'Book club', kind: 'family', who: ['Alex'], date: '2026-11-26', endDate: '2026-11-26', allDay: false, start: '18:00', end: '20:00', recur: { freq: 'MONTHLY', interval: 1, mode: 'nth', ends: 'never' }, at: 1 };
  const q = await open(ctx, s2);
  const days = await q.evaluate(() => [...document.querySelectorAll('.aday')].filter(d => /Choir/.test(d.textContent)).map(d => d.querySelector('h3').textContent));
  ok(days.length === 4 && /Thursday 5 Nov/.test(days.join()) && /Monday 16 Nov/.test(days.join()) && /Thursday 19 Nov/.test(days.join()), '10 every 2 weeks on Mon and Thu, 4 times: ' + days.join(' | '));
  const bc = await q.evaluate(() => [...document.querySelectorAll('.aday')].filter(d => /Book club/.test(d.textContent)).map(d => d.querySelector('h3').textContent));
  ok(bc.length >= 2 && /26 Nov/.test(bc[0]) && /31 Dec/.test(bc[1]), '11 monthly on the last Thursday: ' + bc.join(' | '));
  await q.evaluate(() => [...document.querySelectorAll('.evrow')].find(r => /Book club/.test(r.textContent)).click()); await q.waitForTimeout(250);
  ok(/Every month on the last Thursday\./.test(await q.evaluate(() => document.querySelector('.evform').textContent)), '12 its rule reads “every month on the last Thursday”');
  console.log([...errs, ...q.errs].length ? [...errs, ...q.errs].join('\n') : 'NO PAGE ERRORS'); await b.close();
})();
