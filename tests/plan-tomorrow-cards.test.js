// Plan tomorrow (8 Nov 2026): one card per event that needs something; "Plan for it" adds the suggestions and reminders in
// one tap; they belong to that event and leave with it; anything not in the calendar goes in one box.
const { chromium, devices } = require('playwright'), fs = require('fs'), path = require('path');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const APP = 'file://' + path.resolve(__dirname, '../index.html');
async function open(ctx, extra) {
  const base = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8')); base['home/situation'] = {}; base['home/household'].baseline = 1;
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.addInitScript(`window.__SEED=${JSON.stringify(base)};window.__TR_ME="a";window.__EXTRA_CARDS=[];window.__CAL=${JSON.stringify(base['home/calendar'].calId)};`);
  if (extra) await p.addInitScript(extra);
  await p.addInitScript(fs.readFileSync(__dirname + '/fakedb.js', 'utf8')); await p.addInitScript(fs.readFileSync(__dirname + '/fake-trello.js', 'utf8'));
  await p.addInitScript(() => {
    const g = (id, t, h) => ({ id, cal: 'fam', summary: t + ' · Alex', start: { dateTime: `2026-11-06T${h}:00+01:00` }, end: { dateTime: `2026-11-06T${String(+h.slice(0, 2) + 1).padStart(2, '0')}:${h.slice(3)}:00+01:00` }, status: 'confirmed', updated: '2026-11-05T07:00:00.000Z' });
    window.__G.evd = g('evd', 'Dentist', '10:00'); window.__G.evy = g('evy', 'Yoga', '14:00');
    localStorage.setItem('afloat.me', 'Alex'); localStorage.setItem('afloat.brief', 'x');
  });
  await p.clock.install({ time: new Date('2026-11-05T20:00:00') }); await p.goto(APP + '#today'); await p.waitForTimeout(2500);
  if (await p.$('button.btn[data-act=brief-close]')) { await p.tap('button.btn[data-act=brief-close]'); await p.waitForTimeout(150); }
  await p.evaluate(() => document.querySelectorAll('#app .grp-b[hidden]').forEach(x => x.hidden = false));
  return p;
}
const plan = p => p.evaluate(() => (window.__st['plans/2026-11-06'] || {})['Alex'] || {});
const planText = p => p.evaluate(() => [...document.querySelectorAll('section.card.plan')].map(x => x.textContent).join(' | '));
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ ...devices['iPhone 13'], timezoneId: 'Europe/Prague' });
  let p = await open(ctx);
  let t = await planText(p);
  ok(!/Anything different/.test(t) && /What needs preparing/.test(t), '1 “Anything different?” is gone; step 2 asks what needs preparing');
  ok(!(await p.$('.plan [data-act=plan-kind]')) && !(await p.$('.plan select[name=l]')), '2 the type chips and the “Prep tonight” dropdown are gone');
  ok(await p.$('.pl-ev [data-act=plan-from-ev][data-g=evd]') !== null && /Adds:\s*Find the insurance cards/.test(t), '3 the Dentist gets a card that says what it will add');
  ok(/Also tomorrow:.*Yoga 14:00/.test(t) && await p.$('.pl-also [data-act=plan-from-ev][data-g=evy]') !== null, '4 an ordinary event folds into one “Also tomorrow” line');
  await p.evaluate(() => document.querySelector('[data-act=plan-from-ev][data-g=evd]').click()); await p.waitForTimeout(400);
  let pl = await plan(p), ent = (pl.events || [])[0];
  ok(ent && ent.time === '10:00' && pl.tonight.length === 3 && pl.tonight.every(x => x.ev === ent.id) && pl.morning.length === 1 && pl.launch.length === 0, '5 “Plan for it” adds the suggestions, each belonging to that event');
  ok(((await p.evaluate(() => window.__st['home/reminders'] || {})).list || []).filter(x => x.src === 'plan').length === 2, '6 and the two reminders');
  t = await planText(p);
  ok(/Tonight/.test(t) && /Find the insurance cards/.test(t) && /Leave by 09:35/.test(t), '7 the card now shows leave time and the things, tagged Tonight');
  const first = pl.tonight[0].id;
  await p.evaluate(id => document.querySelector(`[data-act=plan-move][data-id="${id}"]`).click(), first); await p.waitForTimeout(300);
  pl = await plan(p); ok(pl.morning.some(x => x.id === first) && !pl.tonight.some(x => x.id === first), '8 tapping the tag moves a thing from Tonight to Morning');
  await p.evaluate(id => document.querySelector(`[data-act=plan-del][data-id="${id}"]`).click(), first); await p.waitForTimeout(300);
  pl = await plan(p); ok(![...pl.morning, ...pl.tonight, ...pl.launch].some(x => x.id === first), '9 ✕ removes one');
  await p.fill('form[data-form=plan-evadd] input[name=text]', 'Print the referral'); await p.evaluate(() => document.querySelector('form[data-form=plan-evadd]').requestSubmit()); await p.waitForTimeout(300);
  pl = await plan(p); ok(pl.tonight.some(x => x.text === 'Print the referral' && x.ev === ent.id), '10 “Add something for this” adds to that event');
  /* it follows the event: deleted in Google → the entry, its things and its reminders go */
  await p.evaluate(() => { delete window.__G.evd; });
  await p.clock.runFor(4.2 * 6e4); await p.waitForTimeout(500);
  pl = await plan(p);
  ok(!(pl.events || []).length && ![...(pl.tonight || []), ...(pl.morning || []), ...(pl.launch || [])].some(x => x.ev), '11 when the event is deleted, its things leave the plan too');
  ok(!(((await p.evaluate(() => window.__st['home/reminders'] || {})).list || []).some(x => x.src === 'plan')), '12 and its reminders');
  /* not in the calendar: keywords only (no Claude) */
  await p.fill('form[data-form=plan-free] input[name=text]', 'Mia’s carnival costume at 8:30'); await p.evaluate(() => document.querySelector('form[data-form=plan-free]').requestSubmit()); await p.waitForTimeout(400);
  pl = await plan(p); ent = (pl.events || []).find(e => /costume/.test(e.title));
  ok(ent && ent.time === '08:30' && ent.title === 'Mia’s carnival costume' && !ent.from && pl.tonight.some(x => x.ev === ent.id && /special item/.test(x.text)), '13 free text: an entry with its time and what the words suggest (kindergarten day)');
  ok(((await p.evaluate(() => window.__st['home/reminders'] || {})).list || []).filter(x => x.src === 'plan').length === 2, '14 a time in the words sets the reminders');
  await p.evaluate(id => document.querySelector(`[data-act=plan-del][data-l=events][data-id="${id}"]`).click(), ent.id); await p.waitForTimeout(300);
  pl = await plan(p); ok(!(pl.events || []).length && ![...(pl.tonight || []), ...(pl.launch || [])].some(x => x.ev === ent.id), '15 taking it off removes its things');
  console.log(p.errs.length ? p.errs.join('\n') : 'NO PAGE ERRORS'); await p.close();

  /* with Claude: it tidies the title and replaces the keyword guesses with what it thinks is needed */
  p = await open(ctx, () => { window.__SAMPLE = () => ({ title: 'Karnevalový kostým', time: '', tonight: ['Find the glue gun'], morning: [], take: ['Costume bag'] }); });
  await p.fill('form[data-form=plan-free] input[name=text]', 'karneval ve školce zítra kostým'); await p.evaluate(() => document.querySelector('form[data-form=plan-free]').requestSubmit()); await p.waitForTimeout(900);
  pl = await plan(p); ent = (pl.events || [])[0];
  ok(ent && ent.title === 'Karnevalový kostým', '16 Claude tidies the title');
  ok(ent && pl.tonight.length === 1 && pl.tonight[0].text === 'Find the glue gun' && pl.launch.length === 1 && pl.launch[0].text === 'Costume bag' && !pl.morning.length, '17 and its things replace the keyword guesses');
  console.log(p.errs.length ? p.errs.join('\n') : 'NO PAGE ERRORS'); await b.close();
})();
