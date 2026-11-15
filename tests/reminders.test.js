// One system for reminders (6 Nov 2026): the three old ones (reminders at a time, home reminders, reminders from photos)
// move into home/reminders; medicine and Plan tomorrow make reminders instead of Trello cards; one editor; Today shows
// what's due; ticking works; live ones always ring.
const { chromium, devices } = require('playwright'), fs = require('fs'), path = require('path');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ ...devices['iPhone 13'] }), errs = [];
  const base = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8')); base['home/situation'] = {}; base['home/household'].baseline = 1;
  const open = async (st, { hash = 'today', T = '2026-11-05T10:30:00', who = 'Alex' } = {}) => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(`window.__SEED=${JSON.stringify(st)};window.__TR_ME="a";window.__EXTRA_CARDS=[];`);
    await p.addInitScript(fs.readFileSync(__dirname + '/fakedb.js', 'utf8')); await p.addInitScript(fs.readFileSync(__dirname + '/fake-trello.js', 'utf8'));
    await p.addInitScript(([n]) => { localStorage.setItem('afloat.me', n); localStorage.setItem('afloat.brief', 'x'); }, [who]);
    await p.clock.install({ time: new Date(T) }); await p.goto('file://' + path.resolve(__dirname, '../index.html') + '#' + hash); await p.waitForTimeout(2500);
    if (await p.$('button.btn[data-act=brief-close]')) { await p.tap('button.btn[data-act=brief-close]'); await p.waitForTimeout(150); } return p; };
  const homeOf = st => Object.fromEntries(Object.entries(st).filter(([k]) => k.startsWith('home/')));
  // the old three, as they were stored before
  const old = JSON.parse(JSON.stringify(base)); delete old['home/reminders'];
  old['home/people'] = old['home/people'] || { people: {} }; old['home/people'].people = { ...(old['home/people'].people || {}) };
  old['home/people'].people['Alex'] = { ...(old['home/people'].people['Alex'] || {}), remind: [{ id: 'r1', text: 'Call the dentist', at: '11:00', days: [] }] };
  old['home/lists'] = { ...(old['home/lists'] || {}), homeRem: [{ id: 'h1', text: 'Water the cat grass', days: [], from: '' }], homeRemSeeded: 2 };
  old['home/oneoff'] = { list: [{ id: 'o1', who: 'Alex', title: 'Wrap the present', date: '2026-11-13', time: '19:00', done: false }] };
  let p = await open(old), st = await p.evaluate(() => window.__st), L = (st['home/reminders'] || {}).list || [];
  const f = t => L.find(x => x.text === t);
  ok(f('Call the dentist') && f('Call the dentist').who === 'Alex' && f('Call the dentist').at === '11:00', '1 reminders at a time move over, with who and when');
  ok(f('Water the cat grass') && f('Water the cat grass').who === 'both' && f('Water the cat grass').home, '2 home reminders move over as “both, only while home”');
  ok(f('Wrap the present') && f('Wrap the present').date === '2026-11-13' && f('Wrap the present').at === '19:00', '3 reminders from photos move over as one-offs');
  /* 4 (10 Nov 2026): the first household's starting reminders came from its own notes long ago and are in its data; a new
     household's starting reminders are checked in modules.test.js */
  const n0 = L.length; p = await open({ ...old, ...homeOf(st) }); st = await p.evaluate(() => window.__st);
  ok(((st['home/reminders'] || {}).list || []).length === n0, '5 opening again doesn’t duplicate anything');
  // Today at 11:10: the dentist call is due, the cat grass too (at home); tick it
  const up = { ...old, ...homeOf(st) };
  p = await open(up, { T: '2026-11-05T13:30:00' }); let t = await p.evaluate(() => (document.querySelector('#app .card.remind') || {}).textContent || '');
  ok(/Reminders/.test(t) && /11:00 · Call the dentist/.test(t) && /Water the cat grass/.test(t), '6 Today’s Reminders group shows what’s due now (home-only ones once you’re back from the appointment)');
  await p.evaluate(() => [...document.querySelectorAll('#app .card.remind [data-act=toggle]')].find(x => /dentist/.test(x.textContent)).click()); await p.waitForTimeout(300);
  ok(!/Call the dentist/.test(await p.evaluate(() => (document.querySelector('#app .card.remind ul.checks') || {}).textContent || '')), '7 a tick puts it away for today');
  // Sam doesn't see Alex's own
  p = await open(up, { T: '2026-11-05T11:10:00', who: 'Sam' });
  ok(!/Call the dentist/.test(await p.evaluate(() => document.querySelector('#app').textContent)), '8 your own reminders are only yours; “both” ones show for both');
  // the one editor
  p = await open(up, { hash: 'rhythms' }); await p.evaluate(() => { const d = [...document.querySelectorAll('#sec-r-homerem .grp-b, details')].forEach(x => { if (x.tagName === 'DETAILS') x.open = true; else x.hidden = false; }); });
  t = await p.evaluate(() => { const c = document.querySelector('.card.rem-ed'); return c ? c.textContent + ' ' + [...c.querySelectorAll('input[data-f=text]')].map(i => i.value).join(' | ') : ''; });
  ok(/Call the dentist/.test(t) && /Water the cat grass/.test(t) && /Wrap the present/.test(t) && /Only while home/.test(t) && /from a photo/.test(t), '9 one editor lists them all, with where they came from');
  await p.fill('.card.rem-ed form[data-form=rem-add] input[name=text]', 'Swap the kindergarten pyjamas'); await p.fill('.card.rem-ed form[data-form=rem-add] input[name=at]', '08:00');
  await p.fill('.card.rem-ed form[data-form=rem-add] input[name=date]', '2026-11-09'); await p.selectOption('.card.rem-ed form[data-form=rem-add] select[name=who]', 'both');
  await p.evaluate(() => document.querySelector('.card.rem-ed form[data-form=rem-add]').requestSubmit()); await p.waitForTimeout(300); st = await p.evaluate(() => window.__st);
  const pj = st['home/reminders'].list.find(x => /pyjamas/.test(x.text));
  ok(pj && pj.date === '2026-11-09' && pj.at === '08:00' && pj.who === 'both', '10 adding one: a one-off for both at 8:00 on Monday');
  // medicine: the next dose is a reminder for both, always ringing; a new dose replaces it; ending sick days clears it
  const sick = { ...up, ...homeOf(st), 'home/sick': { active: true, since: Date.now(), meds: [{ id: 'm1', name: 'Nurofen', kid: 'Zoe', dose: '5 ml', every: 6, remind: true }], doses: [] } };
  p = await open(sick, { T: '2026-11-05T10:00:00' });
  await p.evaluate(() => document.querySelector('[data-act=give][data-id=m1]').click()); await p.waitForTimeout(400); st = await p.evaluate(() => window.__st);
  let md = st['home/reminders'].list.filter(x => x.src === 'sick');
  ok(md.length === 1 && md[0].who === 'both' && md[0].live && md[0].at === '16:00' && md[0].date === '2026-11-05' && /Nurofen for Zoe/.test(md[0].text), '11 a dose sets one reminder for both at the next dose time (16:00), always ringing');
  ok(!(await p.evaluate(() => window.__trLog.some(x => x[0] === 'trelloWriteCard' && /Medicine/.test((x[1] || {}).name || '')))), '12 no Trello card for medicine any more');
  await p.evaluate(() => document.querySelector('[data-act=give][data-id=m1]').click()); await p.waitForTimeout(300);
  if (await p.$('[data-act=give][data-force="1"]')) { await p.evaluate(() => document.querySelector('[data-act=give][data-force="1"]').click()); await p.waitForTimeout(400); }
  st = await p.evaluate(() => window.__st); ok(st['home/reminders'].list.filter(x => x.src === 'sick').length === 1, '13 the next dose replaces the earlier reminder');
  await p.evaluate(() => document.querySelector('[data-act=sick-off]').click()); await p.waitForTimeout(300); st = await p.evaluate(() => window.__st);
  ok(!st['home/reminders'].list.some(x => x.src === 'sick'), '14 ending sick-day mode clears the medicine reminders');
  // live ones always ring, past the ceiling
  const nb = await p.evaluate(() => { const at = h => new Date(`2026-11-06T${String(h).padStart(2, '0')}:00:00`).getTime();
    return window.__notifyBundle([...[8, 9, 10, 11, 13, 14, 15, 16, 17].map(h => ({ tag: `rem-x${h}-2026-11-06`, at: at(h), title: 'Thing ' + h })), { tag: 'rem-med-2026-11-06', at: at(16), title: 'Nurofen for Zoe can be given again', live: true }]).map(x => x.tag); });
  ok(nb.includes('rem-med-2026-11-06') && nb.some(x => /^dg-/.test(x)), '15 a live reminder always rings; the rest keep to the ceiling and bundles');
  console.log(errs.length ? errs.join('\n') : 'NO PAGE ERRORS'); await b.close();
})();
