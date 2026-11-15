// Taking care of my surroundings (10 Nov 2026): Today has no Tonight / Energy box, the Focus door, the hub, the three ways, landing.
const { start, ok, done } = require('./helpers');
(async () => {
  const t = await start(); let p = await t.open({ hash: 'today', T: '2026-11-05T14:00:00' });
  let s = await t.text(p);
  ok(!/Energy and focus/.test(s) && !/\bTonight\b/.test(await t.text(p, '#view')), '1 Today has no Tonight or Energy-and-focus box');
  await p.goto(p.url().replace(/#.*/, '') + '#focus'); await p.waitForTimeout(600); s = await t.text(p);
  ok(/Taking care of my surroundings/.test(s), '2 Focus offers the surroundings module');
  await t.tap(p, '[data-act=hm-open]'); s = await t.text(p);
  ok(/Make this place livable|Make this place/.test(s) && /Reset the room/.test(s) && /The essentials/.test(s) && /Just one thing/.test(s) && /first tiny step/.test(s), '3 the hub shows where, how, first step');
  await t.tap(p, '[data-act=hm-way][data-v=reset]'); await t.tap(p, '[data-act=hm-start]'); s = await t.text(p);
  ok(/step 1 of/i.test(s) && /Not now/.test(s), '4 Reset starts a Focus session on step 1');
  await t.tap(p, '[data-act=hm-next]'); s = await t.text(p);
  ok(/step 2 of/i.test(s), '5 next moves on');
  await t.tap(p, '[data-act=hm-switch][data-v=one]'); s = await t.text(p);
  ok(/Just this one/i.test(s), '6 switch to just one thing');
  await t.tap(p, '[data-act=hm-done]'); await t.tap(p, '.fx-ctl [data-act=fx-land]'); s = await t.text(p);
  ok(/Landing/i.test(s), '7 landing');
  ok(await p.$eval('#fxDid', e => e.value.length > 0), '8 what got done is prefilled');
  await t.tap(p, '[data-act=fx-save]');
  ok(/Taking care of my surroundings/.test(await t.text(p)), '9 saved, back at the picker');
  // can't do that right now
  p = await t.open({ hash: 'focus', T: '2026-11-05T14:00:00' });
  await t.tap(p, '[data-act=hm-open]'); await t.tap(p, '[data-act=hm-way][data-v=one]');
  await p.evaluate(() => { document.querySelector('.hm-block details').open = true; }); await t.tap(p, '.hm-block [data-act=hm-blk][data-b=quiet]');
  ok(/Quiet: someone’s sleeping/.test(await t.text(p)), '10 the hub takes a blocker (Zoe is asleep)');
  await t.tap(p, '[data-act=hm-start]'); s = await t.text(p);
  ok(/Just this one/i.test(s) && !/vacuum|vysav/i.test(s.split('Change how')[0]), '11 the one thing offered is quiet');
  const first = await p.$eval('.hm-one h2', e => e.textContent);
  await t.tap(p, '[data-act=hm-cant]'); s = await t.text(p);
  ok(/What’s in the way/.test(s) && /hands are full/i.test(s), '12 Can’t do that right now asks what’s in the way');
  await p.fill('#hmWord', first.split(' ').pop().toLowerCase()); await t.tap(p, '[data-act=hm-blkword]');
  ok((await p.$eval('.hm-one h2', e => e.textContent)) !== first, '13 a word I can’t get to parks that job and offers another');
  await t.tap(p, '.hm-blocks [data-act=hm-blkx]:last-child');
  ok(!/Can’t get to/.test(await t.text(p)), '14 a blocker clears with one tap');
  await done(t);
})().catch(e => { console.error(e); process.exit(1); });
