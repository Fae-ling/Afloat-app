// Welcome (10 Nov 2026): a new household's first-open setup, in English; our household never sees it.
const { start, ok, done } = require('./helpers');
(async () => {
  const t = await start();
  const nh = () => { window.claude.household = () => ({ hid: 'h2', base: 'households/h2/', legacy: false, name: 'Nováci' }); };
  const sheet = p => t.text(p, '#sheet'), st = p => p.evaluate(() => H('household'));

  const o = await t.open({ T: '2026-11-05T10:30:00' });
  ok(!(await o.$('.sheet.welcome')), '1 our household never sees the welcome');

  const p = await t.open({ who: '', fresh: true, seed: { 'home/household': {} }, T: '2026-11-05T10:30:00', init: nh });
  ok(/Welcome to Afloat/.test(await sheet(p)) && /Who lives here/.test(await sheet(p)) && !/Čeština/.test(await sheet(p)), '2 a new household opens on the welcome: who lives here, in English');
  ok(await p.$eval('[data-act=w-next]', b => b.disabled), '4 Next waits for a name');
  await p.fill('#wAdult', 'Eva'); await t.tap(p, 'form[data-form=w-adult] button');
  await p.fill('#wAdult', 'Tom'); await t.tap(p, 'form[data-form=w-adult] button');
  ok(await p.evaluate(() => members().map(m => m.name).join() === 'Eva,Tom' && me === 'Eva'), '5 the adults are saved, and the first name is you on this phone');
  await t.tap(p, '[data-act=w-next]');
  ok(/Children at home/.test(await sheet(p)), '6 then children');
  await p.fill('form[data-form=w-kid] input[name=text]', 'Adam'); await p.fill('form[data-form=w-kid] input[name=bday]', '2024-05-01'); await t.tap(p, 'form[data-form=w-kid] button');
  ok(await p.evaluate(() => (H('household').kids || []).join() === 'Adam' && pInfo('Adam').birthday === '2024-05-01'), '7 a child with a birthday');
  await t.tap(p, '[data-act=w-next]');
  ok(/Is there a couple here/.test(await sheet(p)), '8 two adults: asked whether they’re a couple, not assumed');
  await t.tap(p, '[data-act=w-cp][data-v=yes]');
  ok(await p.evaluate(() => modOn('together') && H('household').couple.join() === 'Eva,Tom'), '9 yes switches Together on for the two of them');
  await t.tap(p, '[data-act=w-next]');
  ok(/Your home/.test(await sheet(p)) && !!(await p.$('#w_nap')), '10 then the home, with a nap for the little one');
  await p.fill('#w_town', 'Brno'); await p.dispatchEvent('#w_town', 'change'); await p.fill('#w_about', 'One cat.'); await p.dispatchEvent('#w_about', 'change');
  await p.selectOption('#w_nap', 'Adam'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => H('household').town === 'Brno' && H('household').about === 'One cat.' && napOf().kid === 'Adam'), '11 town, their words and the nap are saved');
  await t.tap(p, '[data-act=w-next]');
  const m = await sheet(p);
  ok(/What should Afloat help with/.test(m) && /Kids’ days/.test(m) && await p.$eval('[data-act=mod-sw][data-k=kids]', b => b.getAttribute('aria-checked')) === 'true', '12 the modules, switched on from the answers');
  await t.tap(p, '[data-act=mod-sw][data-k=meals]');
  ok(await p.evaluate(() => modOn('meals') === false), '12b and they can be switched here');
  await t.tap(p, '[data-act=w-next]');
  ok(/Last bit: your apps/.test(await sheet(p)) && /Claude API key/.test(await sheet(p)), '13 last: the connections, with the Claude key explained');
  await t.tap(p, '[data-act=w-next]');
  const end = await p.evaluate(() => ({ setup: !!H('household').setup, welcome: !!document.querySelector('.sheet.welcome'), mine: S.ui.setup }));
  ok(end.setup && !end.welcome && end.mine, '14 finishing closes the welcome and hands over to Eva’s own morning setup');

  // skipping: one tap, defaults stay, nothing is lost
  const q = await t.open({ who: '', fresh: true, seed: { 'home/household': {} }, T: '2026-11-05T10:30:00', init: nh });
  await q.fill('#wAdult', 'Jana'); await t.tap(q, 'form[data-form=w-adult] button');
  await t.tap(q, '[data-act=w-skip]');
  ok(await q.evaluate(() => !!H('household').setup && !document.querySelector('.sheet.welcome') && me === 'Jana'), '15 “skip the rest” goes straight to Afloat with what’s been said');
  await done(t);
})();
