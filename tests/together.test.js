// Together: the weekly check-in on date night (Gottman's State of the Union, kept short).
// Appreciations jotted during the week stay hidden from the other until the check-in starts; four steps;
// one request each, kept in home/relationship.history and shown on Today for the week.
const { chromium, devices } = require('playwright'), fs = require('fs'), path = require('path');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ ...devices['iPhone 13'] }), errs = [];
  const sd = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8')); sd['home/situation'] = {}; sd['home/household'].baseline = 1;
  const open = async (T, who, hash, st) => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(`window.__SEED=${JSON.stringify(st || sd)};`); await p.addInitScript(fs.readFileSync(__dirname + '/fakedb.js', 'utf8'));
    await p.addInitScript(n => { localStorage.setItem('afloat.me', n); localStorage.setItem('afloat.brief', 'x'); }, who);
    await p.clock.install({ time: new Date(T) }); await p.goto('file://' + path.resolve(__dirname, '../index.html') + '#' + hash); await p.waitForTimeout(1200); return p; };
  const txt = p => p.evaluate(() => document.querySelector('#app').innerText);
  const close = async p => { if (await p.$('[data-act=brief-close]')) { await p.tap('[data-act=brief-close]'); await p.waitForTimeout(150); } };

  // Monday evening: Alex jots an appreciation
  let p = await open('2026-11-09T20:00:00', 'Alex', 'together'); await close(p);
  ok(/A small check-in, once a week/.test(await txt(p)) && /Next check-in: Wednesday/.test(await txt(p)), '1 Us → Together shows the next check-in on Wednesday (date night)');
  await p.fill('form[data-form=rel-appr] input', 'Took the girls so I could finish editing'); await p.tap('form[data-form=rel-appr] button'); await p.waitForTimeout(250);
  ok(/Took the girls so I could finish editing/.test(await txt(p)), '2 an appreciation is jotted');
  let st = await p.evaluate(() => window.__st); const wkKey = Object.keys(st).find(k => k.startsWith('weeks/') && st[k]['relAppr:Alex']);
  ok(!!wkKey, '3 it’s saved on the week, under Alex');

  // Sam sees only that she has written one
  const sd2 = JSON.parse(JSON.stringify(sd)); Object.assign(sd2, { [wkKey]: st[wkKey] });
  p = await open('2026-11-11T19:30:00', 'Sam', 'together', sd2); await close(p); let t = await txt(p);
  ok(/Alex has written 1/.test(t) && !/finish editing/.test(t), '4 Sam sees a count, not the text, before the check-in');
  ok(/Tonight’s check-in/.test(t), '5 on Wednesday it is tonight’s check-in');
  await p.tap('[data-act=rel-step][data-v="1"]'); await p.waitForTimeout(200); t = await txt(p);
  ok(/Appreciations/.test(t) && /finish editing/.test(t) && /Say one out loud now/.test(t), '6 step 1 shows both lists (and a nudge for the empty one)');
  await p.tap('[data-act=rel-step][data-v="2"]'); await p.waitForTimeout(150);
  ok(/What’s going well/.test(await txt(p)), '7 step 2: what’s going well');
  await p.tap('[data-act=rel-step][data-v="3"]'); await p.waitForTimeout(150);
  await p.tap('[data-act=rel-by][data-v=Sam]'); await p.waitForTimeout(150);
  await p.fill('#rt_feel', 'tired'); await p.dispatchEvent('#rt_feel', 'change'); await p.waitForTimeout(100);
  await p.fill('#rt_about', 'Tuesday evenings'); await p.evaluate(() => document.activeElement.blur()); await p.waitForTimeout(450);
  t = await txt(p);
  ok(/I feel tired about Tuesday evenings/.test(t) && /Alex listen/.test(t), '8 step 3: a soft start-up, with listener tips');
  await p.tap('[data-act=rel-park]'); await p.waitForTimeout(200);
  ok(/Parked from before/.test(await txt(p)), '9 a topic can be parked for next week');
  await p.tap('[data-act=rel-step][data-v="4"]'); await p.waitForTimeout(150);
  await p.fill('#rq_me', 'Text me once at lunch'); await p.dispatchEvent('#rq_me', 'change'); await p.waitForTimeout(450);
  await p.tap('[data-act=rel-req-other]'); await p.waitForTimeout(150);
  await p.fill('#rq_o', 'Ten minutes alone after pick-up'); await p.dispatchEvent('#rq_o', 'change'); await p.waitForTimeout(450);
  await p.tap('[data-act=rel-step][data-v="5"]'); await p.waitForTimeout(250); t = await txt(p);
  ok(/Check-in done ★/.test(t) && /You asked Alex: Text me once at lunch/.test(t) && /Alex asked you: Ten minutes alone/.test(t), '10 finishing keeps one request each');
  st = await p.evaluate(() => window.__st);
  ok(((st['home/relationship'] || {}).history || [])[0] && st['home/relationship'].history[0].req.Sam === 'Text me once at lunch', '11 saved to the history');

  // Thursday morning: Alex sees Sam's request on Today
  const sd3 = JSON.parse(JSON.stringify(sd)); Object.assign(sd3, { 'home/relationship': st['home/relationship'] });
  p = await open('2026-11-12T08:30:00', 'Alex', 'today', sd3); await p.evaluate(() => localStorage.removeItem('afloat.brief')); await p.reload(); await p.waitForTimeout(1200);
  t = await p.evaluate(() => document.body.innerText);
  ok(/Sam asked this week: “Text me once at lunch”/.test(t), '12 the other’s request shows on Today during the week');
  await p.screenshot({ path: __dirname + '/shots/together.png' });
  console.log(errs.length ? errs.join('\n') : 'NO PAGE ERRORS'); await b.close();
})();
