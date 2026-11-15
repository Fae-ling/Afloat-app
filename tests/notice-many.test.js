// A notice-board poster with many events (9 Nov 2026): every event opens one after another in the event form and Save moves on to the next.
const { chromium, devices } = require('playwright'), fs = require('fs'), path = require('path');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {}), ctx = await b.newContext({ ...devices['iPhone 13'] }), errs = [];
  const base = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8')); base['home/situation'] = {}; base['home/household'].baseline = 1;
  const POSTER = { kind: 'notice', summary: 'November at the kindergarten', events: [
    { title: 'Divadélko: Jak Jáchym ke štěstí přišel', date: '2026-11-06', who: ['Mia'], type: 'kinder' },
    { title: 'Svatý Martin: projektový den ve školce', date: '2026-11-11', who: ['Mia'], type: 'kinder' },
    { title: 'Svatomartinská stezka', date: '2026-11-11', start: '17:00', who: ['Alex', 'Mia', 'Zoe'], type: 'outing' },
    { title: 'Odpoledne s babičkami', date: '2026-11-16', who: ['Mia'], type: 'kinder' },
    { title: 'Státní svátek: zavřeno', date: '2026-11-17', closed: true },
    { title: 'Divadlo: Jednou takhle v posteli (KC Labuť Riverton)', date: '2026-11-26', who: ['Mia'], type: 'kinder' },
    { title: 'Adventní trhy a vystoupení před školkou', date: '2026-11-29', who: ['Alex', 'Mia', 'Zoe'], type: 'outing' }], todos: [], bring: [], reminders: [] };
  const open = async (st, T) => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (/warn|error/.test(m.type())) errs.push('console: ' + m.text()); });
    await p.addInitScript(`window.__SEED=${JSON.stringify(st)};window.__TR_ME="a";window.__EXTRA_CARDS=[];window.__ANS=${JSON.stringify(POSTER)};`);
    await p.addInitScript(fs.readFileSync(__dirname + '/fakedb.js', 'utf8')); await p.addInitScript(fs.readFileSync(__dirname + '/fake-trello.js', 'utf8'));
    await p.addInitScript(() => { window.__SAMPLE = () => JSON.parse(JSON.stringify(window.__ANS)); localStorage.setItem('afloat.me', 'Alex'); localStorage.setItem('afloat.brief', 'x'); });
    await p.clock.install({ time: new Date(T) }); await p.goto('file://' + path.resolve(__dirname, '../index.html') + '#today'); await p.waitForTimeout(2500);
    if (await p.$('button.btn[data-act=brief-close]')) { await p.tap('button.btn[data-act=brief-close]'); await p.waitForTimeout(150); } return p; };
  const homeOf = st => Object.fromEntries(Object.entries(st).filter(([k]) => k.startsWith('home/') || k.startsWith('events/')));
  const T = '2026-11-09T08:35:00';
  let p = await open(base, T), st = await p.evaluate(() => window.__st);
  p = await open({ ...base, ...homeOf(st) }, T);
  await p.evaluate(() => document.querySelector('[data-act=capture]').click()); await p.waitForTimeout(300);
  await p.tap('#sheet [data-act=nb-open]'); await p.waitForTimeout(150); await p.fill('#nbText', 'Připravované akce na listopad'); await p.tap('#sheet [data-act=nb-read]'); await p.waitForTimeout(900);
  const head = async () => (await p.$eval('.card.photo-x', x => x.textContent).catch(() => '')).replace(/\s+/g, ' ').slice(0, 90);
  const titles = ['Svatý Martin', 'Svatomartinská stezka', 'Odpoledne s babičkami', 'Divadlo: Jednou', 'Adventní trhy'];
  ok(/event 1 of 5/i.test(await head()), '1 the poster is read as five open events (the past one is left out): ' + await head());
  for (let i = 0; i < 5; i++) {
    const t = await p.inputValue('#evTitle').catch(() => '(no form)');
    ok(t.startsWith(titles[i]), `${i + 2} event ${i + 1} opens in the form: ${t}`);
    await p.evaluate(() => document.querySelector('form[data-form=event]').requestSubmit()); await p.waitForTimeout(1200);
  }
  const posterOnly = stt => Object.values(stt).filter(v => v && v.title && v.date && v.by && /Svatý Martin|Svatomartinská|Odpoledne s babičkami|Státní svátek|Divadlo: Jednou|Adventní trhy/.test(v.title)).map(v => v.date + ' ' + v.title);
  const st1 = await p.evaluate(() => window.__st), saved = posterOnly(st1);
  ok(saved.length === 6, '7 saving each form in turn adds all five events and the closed day: ' + saved.length);
  ok(!(await p.$('.card.photo-x')), '8 the panel is gone at the end');
  // the same poster, started from "Fill from a photo" inside a new event (the path through the calendar's own form)
  p = await open({ ...base, ...homeOf(st) }, T); await p.evaluate(() => { location.hash = 'calendar'; }); await p.waitForTimeout(400);
  await p.evaluate(() => document.querySelector('[data-act=ev-new]').click()); await p.waitForTimeout(250);
  await p.tap('[data-act=ev-photo]'); await p.waitForTimeout(200); await p.fill('#nbText', 'Připravované akce na listopad'); await p.tap('#sheet [data-act=nb-read]'); await p.waitForTimeout(900);
  ok(/event 1 of 5/i.test(await head()), '9 from a new event: the poster is read as five events');
  const d1 = await p.inputValue('#evDate');
  ok((await p.inputValue('#evTitle')) === 'Svatý Martin: projektový den ve školce' && d1 === '2026-11-11', '10 the first one keeps the poster’s date, not the blank form’s: ' + d1);
  // "then add the other four as they are": one Save and everything is in
  await p.evaluate(() => document.querySelector('[data-act=px-auto]').click()); await p.waitForTimeout(100);
  await p.evaluate(() => document.querySelector('form[data-form=event]').requestSubmit()); await p.waitForTimeout(2500);
  const st2 = await p.evaluate(() => window.__st), saved2 = posterOnly(st2);
  ok(saved2.length === 6 && !(await p.$('.card.photo-x')) && !(await p.$('form[data-form=event]')), '11 with “add the other four as they are”, one Save adds all five events and the closed day: ' + saved2.length);
  console.log(errs.filter(e => !/ERR_TUNNEL/.test(e)).join('\n') || 'NO PAGE ERRORS'); await b.close();
})();
