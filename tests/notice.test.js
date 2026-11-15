// Read a notice (6 Nov 2026): a photo or pasted kindergarten message → Claude's suggestions → reviewed → calendar events
// (no-kindergarten days as all-day special days), things to bring (that morning's drop-off list) and to-dos on your list.
const { chromium, devices } = require('playwright'), fs = require('fs'), path = require('path');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ ...devices['iPhone 13'] }), errs = [];
  const base = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8')); base['home/situation'] = {}; base['home/household'].baseline = 1;
  const ANSWER = { summary: 'Carnival on 13 Nov, closed 20 Nov, photos form.', events: [{ title: 'Karneval ve školce', date: '2026-11-13', start: '09:00', finish: '11:00', who: ['Mia'], type: 'kinder', closed: false }, { title: 'Ředitelské volno', date: '2026-11-20', end: '2026-11-20', kids: ['Mia'], closed: true }, { title: 'Old thing', date: '2026-10-01', kids: [] }],
    bring: [{ text: 'Kostým na karneval', date: '2026-11-13', kids: ['Mia'] }], todos: [{ title: 'Odevzdat přihlášku na fotografování', due: '2026-11-10' }] };
  const open = async (st, { hash = 'today', T = '2026-11-05T10:30:00' } = {}) => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(`window.__SEED=${JSON.stringify(st)};window.__TR_ME="a";window.__EXTRA_CARDS=[];window.__ANS=${JSON.stringify(ANSWER)};`);
    await p.addInitScript(fs.readFileSync(__dirname + '/fakedb.js', 'utf8')); await p.addInitScript(fs.readFileSync(__dirname + '/fake-trello.js', 'utf8'));
    await p.addInitScript(() => { window.__SAMPLE = () => JSON.parse(JSON.stringify(window.__ANS)); localStorage.setItem('afloat.me', 'Alex'); localStorage.setItem('afloat.brief', 'x'); });
    await p.clock.install({ time: new Date(T) }); await p.goto('file://' + path.resolve(__dirname, '../index.html') + '#' + hash); await p.waitForTimeout(2500);
    if (await p.$('button.btn[data-act=brief-close]')) { await p.tap('button.btn[data-act=brief-close]'); await p.waitForTimeout(150); } return p; };
  const homeOf = st => Object.fromEntries(Object.entries(st).filter(([k]) => k.startsWith('home/') || k.startsWith('events/')));
  let p = await open(base, { hash: 'rhythms' }), st = await p.evaluate(() => window.__st); const up = { ...base, ...homeOf(st) };
  p = await open(up);
  await p.evaluate(() => document.querySelector('[data-act=capture]').click()); await p.waitForTimeout(300);
  ok(!!(await p.$('#sheet [data-act=nb-open]')), '1 the brain dump offers “From a photo”');
  await p.tap('#sheet [data-act=nb-open]'); await p.waitForTimeout(200);
  await p.fill('#nbText', 'Milí rodiče, v pátek 13. 11. bude karneval, přineste kostým. 20. 11. ředitelské volno. Přihlášky na focení do 10. 11.');
  await p.tap('#sheet [data-act=nb-read]'); await p.waitForTimeout(700);
  ok(/#calendar/.test(await p.evaluate(() => location.hash)) && (await p.inputValue('#evTitle')) === 'Karneval ve školce', '2 the event opens in the calendar’s event form first, so who’s going can be changed');
  const px0 = await p.$eval('.card.photo-x', x => x.textContent).catch(() => '');
  ok(/Kostým na karneval/.test(px0) && /přihlášku/.test(px0) && /1 closed day/.test(px0) && /Ředitelské volno/.test(px0) && !/Old thing/.test(px0), '3 its suggestions and the closed day ride along, ticked; past dates are left out');
  const pr = await p.evaluate(() => window.__prompt);
  ok(/household calendar/.test(pr) && /Never add children or a partner who aren’t mentioned|Never add children or a partner who aren't mentioned/.test(pr) && (await p.evaluate(() => window.__sampleOpts.feature)) === 'notice', '4 Claude is asked generally, not assuming the girls, and labelled for the usage meter');
  await p.evaluate(() => document.querySelector('form[data-form=event]').requestSubmit()); await p.waitForTimeout(1200);
  st = await p.evaluate(() => window.__st);
  const evs = Object.entries(st).filter(([k]) => k.startsWith('events/')).map(([, v]) => v);
  const kv = evs.find(e => e.title === 'Karneval ve školce'), rv2 = evs.find(e => e.title === 'Ředitelské volno');
  ok(kv && kv.start === '09:00' && kv.who.includes('Mia') && rv2 && rv2.allDay, '5 Save keeps the event, and the closed day as an all-day event');
  ok(((st['home/kits'].dated || {})['2026-11-13'] || []).some(x => /Kostým/.test(x.text)), '6 the costume is kept for the 13th');
  ok((await p.evaluate(() => window.__trLog.filter(x => x[0] === 'trelloWriteCard' && x[1].action === 'create').map(x => x[1].name))).some(n => /přihlášku/.test(n)), '6b the form becomes a to-do on Trello');
  // on the 13th the costume is on the list; on the 20th there's no kindergarten
  const later = { ...up, ...homeOf(st) };
  p = await open(later, { T: '2026-11-13T07:10:00' }); ok(/Kostým na karneval/.test(await p.evaluate(() => document.querySelector('#app').textContent)), '7 on the day, the costume is on the take-along list');
  p = await open(later, { T: '2026-11-20T07:10:00' }); ok(/Ředitelské volno/.test(await p.evaluate(() => document.querySelector('#app').textContent)), '8 the closed day shows as a special day');
  // an invitation: one event → the event form opens filled in, with suggestions ticked above it
  const INV = { kind: 'invitation', summary: 'Ema turns 4: party at the Jumpík play centre on Saturday 14 Nov, 15:00–17:00. RSVP by 10 Nov.',
    events: [{ title: 'Emina oslava narozenin', date: '2026-11-14', start: '15:00', finish: '17:00', place: 'Jumpík, Riverton', who: ['Mia', 'Alex'], type: 'outing', notes: 'Socks for the trampolines', closed: false }],
    todos: [{ title: 'Odpovědět Emině mamince', due: '2026-11-10' }, { title: 'Koupit dárek pro Emu', due: '2026-11-08' }], bring: [{ text: 'Dárek pro Emu', date: '2026-11-14', kids: [] }], reminders: [{ title: 'Zabalit dárek', date: '2026-11-13', time: '19:00' }] };
  p = await open(later); await p.evaluate(a => { window.__ANS = a; }, INV);
  await p.evaluate(() => document.querySelector('[data-act=capture]').click()); await p.waitForTimeout(300); await p.tap('#sheet [data-act=nb-open]'); await p.waitForTimeout(150);
  await p.fill('#nbText', 'Ema slaví 4. narozeniny! Sobota 14. 11. od 15:00 v Jumpíku Riverton. Dejte vědět do 10. 11.'); await p.tap('#sheet [data-act=nb-read]'); await p.waitForTimeout(700);
  ok(/#calendar/.test(await p.evaluate(() => location.hash)) && (await p.inputValue('#evTitle')) === 'Emina oslava narozenin' && (await p.inputValue('#evDate')) === '2026-11-14' && (await p.inputValue('#evStart')) === '15:00', '9 one invitation opens the event form filled in: title, date, time');
  const px = await p.$eval('.card.photo-x', x => x.textContent).catch(() => '');
  ok(/Filled in from your photo/.test(px) && /Odpovědět/.test(px) && /Koupit dárek/.test(px) && /Zabalit dárek/.test(px) && /Take along: Dárek/.test(px), '10 the suggestions (reply, buy and wrap the present, take it along) sit above the form, ticked');
  await p.evaluate(() => { const c = [...document.querySelectorAll('.photo-x input[data-grp=reminders]')][0]; c.click(); });
  await p.evaluate(() => document.querySelector('form[data-form=event]').requestSubmit()); await p.waitForTimeout(900); st = await p.evaluate(() => window.__st);
  const ema = Object.values(st).find(v => v && v.title === 'Emina oslava narozenin');
  ok(ema && ema.place === 'Jumpík, Riverton' && ema.who.includes('Mia') && ema.who.includes('Alex') && ema.kind === 'outing' && /Socks/.test(ema.notes), '11 one Save keeps the event with its place, who, type and notes');
  const made = await p.evaluate(() => window.__trLog.filter(x => x[0] === 'trelloWriteCard' && x[1].action === 'create').map(x => x[1].name));
  ok(made.some(n => /Odpovědět/.test(n)) && made.some(n => /Koupit dárek/.test(n)) && !made.some(n => /Zabalit/.test(n)) && ((st['home/kits'].dated || {})['2026-11-14'] || []).some(x => /Dárek/.test(x.text)), '12 …and only the ticked suggestions (the unticked reminder stays out)');
  p = await open({ ...later, ...homeOf(st) }, { T: '2026-11-14T14:20:00' });
  ok(/Dárek pro Emu/.test(await p.evaluate(() => document.querySelector('#app').textContent)), '12b on the day, the present is on the party’s own take-along list');
  ok(!((st['home/reminders'] || {}).list || []).some(x => /Zabalit/.test(x.text)), '12c an unticked reminder isn’t kept');
  // a ticked reminder is Afloat's own: on Today that day, tap to tick off; not a Trello card
  p = await open({ ...later, ...homeOf(st) }, { hash: 'calendar' }); await p.evaluate(a => { window.__ANS = a; }, INV);
  await p.evaluate(() => document.querySelector('[data-act=ev-new]').click()); await p.waitForTimeout(250); await p.tap('[data-act=ev-photo]'); await p.waitForTimeout(200);
  await p.fill('#nbText', 'Ema'); await p.tap('#sheet [data-act=nb-read]'); await p.waitForTimeout(700);
  ok(/Remind me: Zabalit dárek/.test(await p.$eval('.card.photo-x', x => x.textContent)), '12d the reminder is offered as “Remind me”');
  const nBefore = await p.evaluate(() => window.__trLog.filter(x => x[0] === 'trelloWriteCard' && x[1].action === 'create').length);
  await p.evaluate(() => document.querySelector('form[data-form=event]').requestSubmit()); await p.waitForTimeout(900); const st2 = await p.evaluate(() => window.__st);
  const rem = ((st2['home/reminders'] || {}).list || []).find(x => x.text === 'Zabalit dárek');
  const tr2 = await p.evaluate(() => window.__trLog.filter(x => x[0] === 'trelloWriteCard' && x[1].action === 'create').map(x => x[1].name));
  ok(rem && rem.date === '2026-11-13' && rem.at === '19:00' && rem.who === 'Alex' && !tr2.slice(nBefore).some(n => /Zabalit/.test(n)), '12e it’s kept in Afloat for you at 19:00 on the 13th, not sent to Trello');
  p = await open({ ...later, ...homeOf(st2) }, { T: '2026-11-13T17:30:00' });
  ok(!/Zabalit dárek/.test(await p.evaluate(() => (document.querySelector('#app .card.remind') || {}).textContent || '')), '12f on the day it stays off Today until its time has come');
  await p.clock.setFixedTime(new Date('2026-11-13T19:05:00')); await p.evaluate(() => { location.hash = 'tasks'; }); await p.waitForTimeout(300); await p.evaluate(() => { location.hash = 'today'; }); await p.waitForTimeout(500);
  await p.evaluate(() => [...document.querySelectorAll('#app .card.remind [data-act=toggle]')].find(b => /Zabalit/.test(b.textContent)).click()); await p.waitForTimeout(300);
  ok(!/Zabalit dárek/.test(await p.evaluate(() => (document.querySelector('#app .card.remind ul.checks') || {}).textContent || '')), '12g at its time it’s there to tick; a tap ticks it off');
  // the same invitation again: it may already be in the calendar
  p = await open({ ...later, ...homeOf(st) }, { hash: 'calendar' }); await p.evaluate(a => { window.__ANS = a; }, INV);
  await p.evaluate(() => document.querySelector('[data-act=ev-new]').click()); await p.waitForTimeout(250);
  ok(!!(await p.$('[data-act=ev-photo]')), '13 a new event offers “Fill from a photo”');
  await p.tap('[data-act=ev-photo]'); await p.waitForTimeout(200); await p.fill('#nbText', 'Ema 14. 11. Jumpík'); await p.tap('#sheet [data-act=nb-read]'); await p.waitForTimeout(700);
  ok(/may already be in the calendar/.test(await p.$eval('.card.photo-x', x => x.textContent).catch(() => '')), '14 if it seems to be there already, it says so');
  // two events in one photo: one form after another; Skip leaves one out; nobody is added who isn't named
  const TWO = { kind: 'booking', summary: 'Two concerts', events: [{ title: 'Koncert A', date: '2026-11-20', start: '19:00', place: 'Lucerna', who: ['Alex'], type: 'outing' }, { title: 'Koncert B', date: '2026-11-27', start: '20:00', place: 'Roxy', who: [], type: 'outing' }], todos: [], bring: [{ text: 'Vstupenky', date: '2026-11-27' }], reminders: [] };
  p = await open({ ...later, ...homeOf(st) }); await p.evaluate(a => { window.__ANS = a; }, TWO);
  await p.evaluate(() => document.querySelector('[data-act=capture]').click()); await p.waitForTimeout(300); await p.tap('#sheet [data-act=nb-open]'); await p.waitForTimeout(150);
  await p.fill('#nbText', 'dva koncerty'); await p.tap('#sheet [data-act=nb-read]'); await p.waitForTimeout(700);
  ok(/event 1 of 2/i.test(await p.$eval('.card.photo-x', x => x.textContent)) && (await p.inputValue('#evTitle')) === 'Koncert A' && !/Vstupenky/.test(await p.$eval('.card.photo-x', x => x.textContent)), '15 several events open one after another; each shows only its own suggestions');
  await p.tap('.photo-x [data-act=px-skip]'); await p.waitForTimeout(500);
  ok((await p.inputValue('#evTitle')) === 'Koncert B' && /Vstupenky/.test(await p.$eval('.card.photo-x', x => x.textContent)), '16 Skip moves on to the next one');
  await p.evaluate(() => document.querySelector('form[data-form=event]').requestSubmit()); await p.waitForTimeout(900); st = await p.evaluate(() => window.__st);
  const all = Object.values(st).filter(v => v && v.title && /^Koncert/.test(v.title));
  ok(all.length === 1 && all[0].title === 'Koncert B' && JSON.stringify(all[0].who) === '["Alex"]' && !(await p.$('.card.photo-x')), '17 only the saved one is added, with just you on it when nobody was named');
  console.log(errs.length ? errs.join('\n') : 'NO PAGE ERRORS'); await b.close();
})();
