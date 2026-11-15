// Friends between households (10 Nov 2026): Connect in Afloat on a friend's profile, someone not in Afloat yet (invite),
// when they're free (✓ when I'm free too), "Want to come?", and Today's "From friends" card. The server is pretended here
// (functions/test/links.test.js tests the real one); without it, nothing about links shows at all.
const { start, ok, done } = require('./helpers');
const fake = () => {
  window.__LK = { calls: [], list: [], notHere: false, busy: null };
  const base = window.claude.use;
  window.claude.use = async k => k !== 'links' ? base(k) : { call: async (action, data) => {
    const L = window.__LK; L.calls.push([action, JSON.parse(JSON.stringify(data))]);
    if (action === 'list') return { links: L.list };
    if (action === 'request') return L.notHere ? { notHere: true, canInvite: true } : { link: { id: 'l9', status: 'asked', mine: 'asked', peer: data.email, peerName: '', prof: data.prof, share: data.share, theirs: {}, asks: [] } };
    if (action === 'invite') return { invited: true };
    if (action === 'busy') return L.busy;
    const l = L.list.find(x => x.id === data.id);
    if (action === 'ask') return { link: { ...l, asks: [...l.asks, { id: 'x9', fromMe: true, status: 'open', ...data }] } };
    if (action === 'reply' || action === 'done') return { link: { ...l, asks: l.asks.filter(x => x.id !== data.ask) } };
    if (action === 'answer') return data.yes ? { link: { ...l, status: 'on', mine: 'answering', share: data.share, theirs: { busy: false, titles: false, come: false } } } : { gone: true };
    return { link: l };
  } };
};
const ON = { id: 'l1', status: 'on', mine: 'asked', peer: 'jo@example.com', peerName: 'Jo', prof: 'fr_jo', share: { busy: true, titles: false, come: true }, theirs: { busy: true, titles: false, come: true }, asks: [] };
(async () => {
  const t = await start();
  t.allow.push(/Connecting with friends isn’t available/);

  // without the server's links (the tests' default platform), nothing shows and nothing breaks
  let p = await t.open({ hash: 'family' });
  ok(!/Connect in Afloat/.test(await t.text(p)), '1 no Connect button when links aren’t available');
  await p.close();

  // 2–6 connecting: someone not in Afloat yet → invite; then a request with the switches ticked
  p = await t.open({ hash: 'family', init: fake });
  ok(/Connect in Afloat/.test(await t.text(p)), '2 a friend’s profile offers Connect in Afloat');
  await t.tap(p, '[data-act=lk-new][data-id=fr_jo]');
  ok(await p.$eval('#lkEmail', x => x.value) === 'jo@example.com', '3 the address starts from their Google email');
  await p.evaluate(() => { window.__LK.notHere = true; });
  await t.tap(p, '[data-act=lk-send]');
  ok(/isn’t in Afloat yet/.test(await t.text(p)) && !!(await p.$('[data-act=lk-invite]')), '4 not in Afloat yet: the admin is offered an invitation');
  await t.tap(p, '[data-act=lk-invite]');
  const inv = await p.evaluate(() => window.__LK.calls.map(c => c[0] + ':' + (c[1].email || '')).join(' '));
  ok(/invite:jo@example\.com/.test(inv), '5 Invite sends their address: ' + inv);
  await p.evaluate(() => { window.__LK.notHere = false; });
  await t.tap(p, '[data-act=lk-new][data-id=fr_jo]');
  await p.check('#lkN_busy'); await p.check('#lkN_come');
  await t.tap(p, '[data-act=lk-send]');
  const req = await p.evaluate(() => window.__LK.calls.filter(c => c[0] === 'request').pop()[1]);
  ok(req.prof === 'fr_jo' && req.share.busy && req.share.come && !req.share.titles && req.me === 'Alex', '6 the request carries the profile, my switches and my name: ' + JSON.stringify(req));
  ok(/Waiting for Jo to say yes/.test(await t.text(p)), '7 then it waits for Jo');
  await p.close();

  // 8–12 connected: when is Jo free (✓ when I'm free too), tap a time to ask
  p = await t.open({ hash: 'family', T: '2026-11-10T10:00:00', seed: { 'events/my1': { title: 'Gig', kind: 'work', who: ['Alex'], date: '2026-11-12', endDate: '2026-11-12', start: '18:00', end: '22:00', at: 1 } },
    init: new Function(`(${fake.toString()})(); window.__LK.list = [${JSON.stringify(ON)}]; window.__LK.busy = { today: '2026-11-10', from: 480, to: 1380, titles: false, days: { '2026-11-10': [], '2026-11-11': [{ s: 480, e: 1380 }], '2026-11-12': [{ s: 600, e: 960 }] } };`) });
  let txt = await t.text(p);
  ok(/Connected in Afloat/.test(txt) && /Jo shares with you: when they’re free, asking them to things/.test(txt), '8 a connected friend says what they share');
  await t.tap(p, '[data-act=lk-free][data-id=l1]');
  txt = await t.text(p);
  const today = await p.$eval('.lk-days li', l => l.textContent.replace(/\s+/g, ' ').trim());
  ok(/^Tue 10 Nov 10:15–23:00/.test(today), '9 today starts a little after now: ' + today);
  ok(/busy all day/.test(txt), '10 a fully busy day says so');
  const chips = await p.$$eval('.lk-days li', ls => ls.map(l => l.textContent.replace(/\s+/g, ' ').trim()));
  const thu = chips.find(c => /Thu 12 Nov/.test(c)) || '';
  ok(/08:00–10:00 ✓/.test(thu) && /16:00–23:00/.test(thu) && !/16:00–23:00 ✓/.test(thu), '11 ✓ only where I’m free too (my gig 18–22): ' + thu);
  await t.tap(p, '.lk-days [data-act=lk-ask][data-d="2026-11-12"][data-s="08:00"]');
  ok(await p.$eval('#lkD', x => x.value) === '2026-11-12' && await p.$eval('#lkS', x => x.value) === '08:00', '12 tapping a time opens the ask with it filled in');
  await p.fill('#lkT', 'Breakfast'); await p.fill('#lkP', 'Café Savoy');
  await t.tap(p, '[data-act=lk-ask-send]');
  const ask = await p.evaluate(() => window.__LK.calls.filter(c => c[0] === 'ask').pop()[1]);
  ok(ask.title === 'Breakfast' && ask.date === '2026-11-12' && ask.start === '08:00' && ask.end === '10:00' && ask.place === 'Café Savoy', '13 the ask is sent: ' + JSON.stringify(ask));
  // switching off what I share
  await p.evaluate(() => { document.querySelector('.lk-more').open = true; });
  await t.tap(p, '[data-act=lk-share][data-k=busy]');
  const sh = await p.evaluate(() => window.__LK.calls.filter(c => c[0] === 'share').pop()[1]);
  ok(sh.share.busy === false && sh.share.titles === false && sh.share.come === true, '14 a switch changes only what I share: ' + JSON.stringify(sh.share));
  await p.close();

  // 15–19 Today: a request, an ask to me, an answer to my ask
  const L2 = [{ id: 'l2', status: 'asked', mine: 'answering', peer: 'quinn@example.com', peerName: 'Quinn', prof: null, share: {}, theirs: {}, asks: [] },
    { ...ON, asks: [{ id: 'a1', fromMe: false, status: 'open', title: 'Cinema', date: '2026-11-14', start: '19:00', end: '21:30', place: 'Lucerna', note: 'The new one' },
      { id: 'a2', fromMe: true, status: 'yes', title: 'Walk', date: '2026-11-15', start: '10:00', end: '12:00', place: 'Prokopské údolí' }] }];
  p = await t.open({ hash: 'today', T: '2026-11-10T10:00:00', init: new Function(`(${fake.toString()})(); window.__LK.list = ${JSON.stringify(L2)};`) });
  txt = await t.text(p);
  ok(/From friends/.test(txt) && /Quinn wants to connect/.test(txt), '15 a request waits on Today');
  ok(/Jo: want to come\? Cinema/.test(txt) && /Lucerna/.test(txt), '16 so does an ask');
  ok(/Jo is coming: Walk/.test(txt), '17 and a yes to my ask');
  await t.tap(p, '[data-act=lk-reply][data-x=a1][data-yes]');
  const rep = await p.evaluate(() => window.__LK.calls.filter(c => c[0] === 'reply').pop()[1]);
  ok(rep.ask === 'a1' && rep.yes === true, '18 Yes answers the ask');
  await t.tap(p, '[data-act=lk-cal][data-x=a2]');
  const ev = await p.evaluate(() => window.__st && document.querySelector('#evTitle') && document.querySelector('#evTitle').value);
  ok(ev === 'Walk', '19 Put it in the calendar opens the event form: ' + ev);
  const evw = await p.evaluate(() => [...document.querySelectorAll('.evform [aria-pressed=true], .evform input[type=checkbox]:checked')].map(x => x.textContent || x.value).join('|'));
  ok(/Jo/.test(evw) && /Alex/.test(evw), '20 with me and Jo going: ' + evw);
  await t.go(p, 'today'); await p.selectOption('#lkProf_l2', 'fr_quinn'); await t.tap(p, '[data-act=lk-yes][data-id=l2]');
  const ans = await p.evaluate(() => window.__LK.calls.filter(c => c[0] === 'answer').pop()[1]);
  const cu = await p.evaluate(() => window.__st['home/profiles'].friends.find(f => f.name === 'Quinn'));
  ok(ans.yes && ans.prof === 'fr_quinn' && cu.afloatEmail === 'quinn@example.com', '21 Connect links it to the Family profile chosen (Quinn): ' + JSON.stringify(ans));
  await done(t);
})();
