// Together: date night ideas. Staying in or going out (out by default when the girls are away); Claude's ideas by default,
// shaped by the season, holidays, the evening's forecast and the week's calendar; the same picks on both phones;
// Another one, keep, "we did this", your own ideas, and seasonal built-in ideas when Claude isn't there.
const { chromium, devices } = require('playwright'), fs = require('fs'), path = require('path');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ ...devices['iPhone 13'] }), errs = [];
  const base = JSON.parse(fs.readFileSync(__dirname + '/seed.json', 'utf8')); base['home/situation'] = {}; base['home/household'].baseline = 1;
  base['events/dn1'] = { title: 'Divadlo s Robinm', kind: 'other', who: ['Alex'], date: '2026-11-13', endDate: '2026-11-13', start: '19:00', end: '21:30', at: 1 };
  const open = async (who, st, { hash = 'together', T = '2026-11-11T20:00:00', claude = true } = {}) => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(`window.__SEED=${JSON.stringify(st)};window.__TR_ME="a";window.__EXTRA_CARDS=[];`);
    await p.addInitScript(fs.readFileSync(__dirname + '/fakedb.js', 'utf8')); await p.addInitScript(fs.readFileSync(__dirname + '/fake-trello.js', 'utf8'));
    await p.addInitScript(n => { localStorage.setItem('afloat.me', n); localStorage.setItem('afloat.brief', 'x'); }, who);
    if (claude) await p.addInitScript(() => { window.__prompts = []; window.__SAMPLE = input => { const t = String(typeof input === 'string' ? input : JSON.stringify(input)); window.__prompts.push(t);
      return /"out": \[/.test(t) ? { theme: '', out: ['Evening walk to the castle lights, then hot chocolate', 'A late film and a shared dessert', 'Bowling, loser buys the svařák'], deep: 'What do you want winter to feel like this year?', why: 'A cold, dry evening suits a walk.' }
        : { theme: 'Before the holiday', fun: 'Pillow-fort film night', deep: 'What made you laugh this week?', new: 'Try a five-minute sketch of each other', why: 'A long weekend is coming.' }; }; });
    await p.clock.install({ time: new Date(T) }); await p.goto('file://' + path.resolve(__dirname, '../index.html') + '#' + hash); await p.waitForTimeout(2600);
    if (await p.$('[data-act=brief-close]')) { await p.tap('[data-act=brief-close]'); await p.waitForTimeout(150); } return p; };
  const ideas = p => p.$$eval('.ideas .idea p', a => a.map(x => x.textContent));
  const txt = p => p.textContent('#app');

  let p = await open('Alex', base), first = await ideas(p), pr = await p.evaluate(() => (window.__prompts || []).join('\n'));
  ok(first.includes('Pillow-fort film night') && first.includes('What made you laugh this week?') && /Staying in/.test(await txt(p)), '1 on date night Claude’s ideas are there by default, staying in');
  ok(/Freedom and Democracy Day/.test(pr) && /Their calendar this week/.test(pr) && /Wednesday,? 11 November/.test(pr), '2 Claude is told the date, the holidays coming up and the week’s calendar');
  ok(/A long weekend is coming/.test(await txt(p)) && /Before the holiday/.test(await txt(p)), '3 with a theme and a line on why');
  await p.tap('[data-act=idea-next][data-k=fun]'); await p.waitForTimeout(200); let now = await ideas(p);
  ok(!now.includes('Pillow-fort film night'), '4 “Another one” moves on');
  const fid = await p.getAttribute('[data-act=idea-fav]', 'data-id');
  await p.tap('[data-act=idea-fav]'); await p.waitForTimeout(150); await p.tap('[data-act=idea-used]'); await p.waitForTimeout(150);
  let st = await p.evaluate(() => window.__st);
  ok(st['home/relationship'].ideas.fav.includes(fid) && !!st['home/relationship'].ideas.used[fid], '5 keep and “we did this” are saved');

  await p.tap('[data-act=idea-mode][data-v=out]'); await p.waitForTimeout(1800); let t = await txt(p);
  ok(/Going out/.test(t) && /Evening walk to the castle lights/.test(t) && /To talk about on the way/.test(t), '6 going out: three ideas out from Claude, and something to talk about on the way');
  ok(/For a night out the girls need someone/.test(t), '7 with the girls home, it reminds you to sort out babysitting');
  await p.tap('[data-act=idea-next][data-k=out]'); await p.waitForTimeout(200);
  ok((await ideas(p)).includes('A late film and a shared dessert'), '8 “Another one” goes through Claude’s other ideas first');
  st = await p.evaluate(() => window.__st);

  p = await open('Sam', { ...base, 'home/relationship': st['home/relationship'] }); now = await ideas(p);
  ok(now.includes('A late film and a shared dessert') && (await p.evaluate(() => window.__prompts.length)) === 0, '9 Sam’s phone shows the same picks, without asking Claude again');

  // grandparents have the girls on date night → going out by default
  const gp = JSON.parse(JSON.stringify(base)); gp['events/gp1'] = { title: 'Babi a děda', kind: 'grandma', gpGId: 'gpx', who: ['Mia', 'Zoe'], date: '2026-11-11', endDate: '2026-11-12', allDay: true, at: 1 };
  p = await open('Alex', gp); t = await txt(p);
  ok(await p.evaluate(() => !!document.querySelector('[data-act=idea-mode][data-v=out].on')) && !/need someone/.test(t), '10 with the girls at the grandparents, going out is the default');

  // without Claude: seasonal ideas first (Advent and Mikuláš in early December), and your own
  p = await open('Alex', base, { T: '2026-12-02T20:00:00', claude: false }); now = await ideas(p);
  ok(now.some(x => /cukroví|Mikuláš|Advent/.test(x)), '11 without Claude, seasonal ideas come first: ' + now.join(' | '));
  await p.evaluate(() => document.querySelectorAll('.ideas details').forEach(d => d.open = true));
  await p.fill('form[data-form=idea-add] input', 'Karaoke to our old playlist'); await p.selectOption('form[data-form=idea-add] select', 'fun');
  await p.tap('form[data-form=idea-add] button'); await p.waitForTimeout(200);
  ok((await ideas(p)).includes('Karaoke to our old playlist'), '12 your own idea is added and offered tonight');

  p = await open('Alex', base, { hash: 'today', T: '2026-11-11T19:30:00' });
  ok(/Ideas for tonight/.test(await txt(p)), '13 the date-night card on Today has tonight’s ideas');
  await p.screenshot({ path: __dirname + '/shots/date-ideas.png' });

  // an extra date in the calendar (not on Wednesday) is a date night too, with its own ideas
  const xd = JSON.parse(JSON.stringify(base)); xd['events/rd1'] = { title: 'Rande', kind: 'other', who: ['Alex', 'Sam'], date: '2026-11-14', endDate: '2026-11-14', start: '19:00', end: '23:00', place: 'Vinohrady, Praha', at: 1 };
  xd['events/gp2'] = { title: 'Holky u babi', kind: 'grandma', gpGId: 'gpx', who: ['Mia', 'Zoe'], date: '2026-11-14', endDate: '2026-11-15', allDay: true, at: 1 };
  p = await open('Alex', xd, { T: '2026-11-13T20:00:00' }); t = await txt(p); pr = await p.evaluate(() => (window.__prompts || []).join('\n'));
  ok(/Rande · 19:00 · Vinohrady/.test(t) && /Sat 14 Nov/.test(t) && await p.evaluate(() => !!document.querySelector('[data-act=idea-mode][data-v=out].on')), '14 a “Rande” on Saturday is the next date night, going out (it has a place)');
  ok(/in their calendar as "Rande" at 19:00, at Vinohrady/.test(pr) && /Saturday,? 14 November/.test(pr), '15 Claude is told about that date');
  st = await p.evaluate(() => window.__st);
  ok(!!st['home/relationship']['night:2026-11-14'] && !st['home/relationship']['night:2026-11-11'], '16 it keeps its own picks, apart from Wednesday’s');
  p = await open('Alex', { ...xd, 'home/relationship': st['home/relationship'] }, { hash: 'today', T: '2026-11-14T17:00:00' }); t = await p.evaluate(() => document.body.innerText);
  ok(/Date night/.test(t) && /Rande tonight at 19:00/.test(t) && /Ideas for tonight/.test(t), '17 on the day, Today has a date-night card with the ideas');
  const solo = JSON.parse(JSON.stringify(base)); solo['events/rd2'] = { title: 'Rande', kind: 'other', who: ['Sam', 'Jo'], date: '2026-11-14', endDate: '2026-11-14', start: '19:00', end: '23:00', at: 1 };
  p = await open('Alex', solo, { T: '2026-11-13T20:00:00' });
  ok(!/Rande/.test(await txt(p)), '18 a date without both of you doesn’t count');

  // when Claude can't answer: one retry, then the reason on the card and built-in ideas
  p = await open('Alex', base, { T: '2026-11-11T20:00:00', claude: true });
  await p.evaluate(() => { window.__SAMPLE_FAIL = 'upstream_error'; window.__prompts = []; });
  await p.tap('[data-act=idea-ask]'); await p.waitForTimeout(2500); t = await txt(p);
  ok((await p.evaluate(() => window.__prompts.length)) === 0 && /Claude didn’t answer/.test(t) && /Built-in ideas for now/.test(t) && (await ideas(p)).length >= 2, '19 a failed ask says why and keeps the built-in ideas');
  console.log(errs.length ? errs.join('\n') : 'NO PAGE ERRORS'); await b.close();
})();
