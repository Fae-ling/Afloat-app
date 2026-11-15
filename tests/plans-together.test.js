// Planning together across households (11 Nov 2026): sharing a plan with a connected friend, their invitation on Today,
// joining, everyone's changes showing, who brings what, the event form's "Plan it together", and leaving.
// The server and the shared document are pretended here (functions/test/together.test.js tests the real server).
const { start, ok, done } = require('./helpers');
const fake = () => {
  const TG = window.__TG = { calls: [], docs: {}, invites: [], cbs: [], me: 'ane@x.cz' };
  const emit = () => TG.cbs.forEach(cb => cb(Object.values(TG.docs).filter(T => T.members.includes(TG.me)).map(T => JSON.parse(JSON.stringify(T)))));
  TG.emit = emit;
  /* the friend changes the shared plan from their phone */
  TG.friend = (id, parts) => { TG.docs[id].plan = { ...TG.docs[id].plan, ...parts }; emit(); };
  const ON = { id: 'l1', status: 'on', mine: 'asked', peer: 'jo@x.cz', peerName: 'Jo', prof: 'fr_jo', share: {}, theirs: {}, asks: [] };
  const base = window.claude.use;
  window.claude.household = () => ({ hid: 'legacy', legacy: true });
  window.claude.use = async k => k === 'together' ? { email: TG.me, watch: cb => { TG.cbs.push(cb); setTimeout(emit, 10); return () => {}; }, save: async (id, parts) => { TG.saves = (TG.saves || 0) + 1; TG.docs[id].plan = { ...TG.docs[id].plan, ...JSON.parse(JSON.stringify(parts)) }; setTimeout(emit, 10); } }
    : k !== 'links' ? base(k) : { call: async (action, data) => {
      TG.calls.push([action, JSON.parse(JSON.stringify(data))]);
      if (action === 'list') return { links: [ON] };
      if (action === 'plan-list') return { plans: [], invites: TG.invites };
      if (action === 'plan-share') { const id = data.id || 'sh1'; if (!TG.docs[id]) TG.docs[id] = { id, plan: { ...data.plan, id }, owner: TG.me, members: [TG.me, 'sam@x.cz'], houses: { legacy: { lead: TG.me, people: [TG.me] } }, names: { [TG.me]: data.me }, invited: {} };
        TG.docs[id].invited['jo@x.cz'] = {}; setTimeout(emit, 10); return { id, invited: ['jo@x.cz'] }; }
      if (action === 'plan-answer') { const x = TG.invites.find(i => i.id === data.id); TG.invites = TG.invites.filter(i => i.id !== data.id);
        if (data.yes) { TG.docs[data.id] = { id: data.id, plan: { id: data.id, title: x.title, kind: 'trip', start: x.start, end: x.end, by: 'Jo', whoBy: { h2: ['Jo'] }, steps: [], pack: [{ id: 'k1', text: 'Tent', by: 'Jo' }] }, owner: 'jo@x.cz', members: ['jo@x.cz', TG.me, 'sam@x.cz'], houses: { h2: { lead: 'jo@x.cz' }, legacy: { lead: TG.me } }, names: { 'jo@x.cz': 'Jo', [TG.me]: 'Alex' }, invited: {} }; setTimeout(emit, 10); }
        return { id: data.id }; }
      if (action === 'plan-leave') { delete TG.docs[data.id]; setTimeout(emit, 10); return { gone: true }; }
      return {};
    } };
};
(async () => {
  const t = await start();
  let p = await t.open({ hash: 'plans', T: '2026-11-10T10:00:00', init: fake });
  await p.waitForTimeout(300);
  // 1. a plan of our own: the "Plan it together" section offers the connected friend
  await p.fill('form[data-form=px-new] input[name=title]', 'Krkonoše weekend');
  await p.tap('button[data-act=px-kind][data-v=trip]'); await p.waitForTimeout(150);
  await p.fill('form[data-form=px-new] input[name=start]', '2026-11-27'); await p.fill('form[data-form=px-new] input[name=end]', '2026-11-29');
  await p.tap('form[data-form=px-new] button[type=submit]'); await p.waitForTimeout(400);
  let txt = await t.text(p);
  ok(/Do it together/.test(txt) && /already sees this plan/.test(txt), '1 a plan offers planning together, and says the household already sees it');
  ok(!!(await p.$('button[data-act=tg-share][data-id=l1]')), '2 the connected friend (Jo) is offered');
  // 2. who brings what, before sharing: the household's adults
  await p.fill('form[data-form=px-pack] input[name=text]', 'Sleeping bags, Torch'); await p.tap('form[data-form=px-pack] button[type=submit]'); await p.waitForTimeout(250);
  await p.tap('button[data-act=px-by][data-k=pack]'); await p.waitForTimeout(250);
  let st = await t.st(p); let own = Object.values(st['home/planner'].plans).find(x => x.title === 'Krkonoše weekend');
  ok(own && own.pack[0].by === 'Alex', '3 “who?” on a thing to take says who brings it: ' + JSON.stringify(own && own.pack[0]));
  // 3. share it
  await t.tap(p, 'button[data-act=tg-share][data-id=l1]'); await p.waitForTimeout(400);
  const call = await p.evaluate(() => window.__TG.calls.find(c => c[0] === 'plan-share'));
  ok(call && call[1].link === 'l1' && call[1].plan.title === 'Krkonoše weekend' && call[1].plan.whoBy.legacy.includes('Alex') && !call[1].plan.shared, '4 sharing sends the plan, with our household’s who-is-going kept as ours');
  st = await t.st(p);
  ok(!Object.values(st['home/planner'].plans).some(x => x.title === 'Krkonoše weekend') && st['home/planner'].moved && Object.values(st['home/planner'].moved).includes('sh1'), '5 the plan moves out of the household’s own plans into the shared one');
  txt = await t.text(p);
  ok(/Together/.test(txt) && /Planning together/.test(txt) && /Sleeping bags/.test(txt), '6 the open plan is now the shared one, with everything in it');
  // 4. the friend adds something on their phone: it shows here
  await p.evaluate(() => window.__TG.friend('sh1', { pack: [...window.__TG.docs.sh1.plan.pack, { id: 'z1', text: 'Board games', by: 'Jo' }] })); await p.waitForTimeout(300);
  ok(/Board games/.test(await t.text(p)), '7 a friend’s change shows at once');
  // 5. ticking here writes only the plan's parts to the shared document
  await t.tap(p, 'button[data-act=px-tick][data-k=pack]'); await p.waitForTimeout(300);
  const sh = await p.evaluate(() => window.__TG.docs.sh1.plan);
  ok(sh.pack.some(x => x.done) && sh.pack.some(x => x.text === 'Board games'), '8 a tick here goes to the shared plan, keeping the friend’s item');
  // 6. who's going stays ours
  await p.evaluate(() => document.querySelectorAll('.px-head details').forEach(d => { d.open = true; }));
  ok(await t.tap(p, 'button[data-act=px-who][data-v=Sam]'), '9a the who-is-going chips are there');
  const wb = await p.evaluate(() => window.__TG.docs.sh1.plan.whoBy);
  ok(wb && wb.legacy && wb.legacy.includes('Sam') && !('who' in (await p.evaluate(() => window.__TG.docs.sh1.plan))), '9 who is going is saved for our household only: ' + JSON.stringify(wb));
  // 7. steps someone else claimed don't show on my Today
  await p.evaluate(() => window.__TG.friend('sh1', { steps: [{ id: 's1', text: 'Book the cabin', days: 30, by: 'Jo' }, { id: 's2', text: 'Check the snow', days: 30 }] })); await p.waitForTimeout(300);
  await t.go(p, 'today'); txt = await t.text(p);
  ok(/Check the snow/.test(txt) && !/Book the cabin/.test(txt), '10 Today shows my and unclaimed steps, not the friend’s');
  // 8. leaving
  await t.go(p, 'plans'); await p.evaluate(() => { S.ui.pxOpen = 'sh1'; render(true); }); await p.waitForTimeout(200);
  await t.tap(p, 'button[data-act=tg-leave]'); await t.tap(p, 'button[data-act=tg-leave]'); await p.waitForTimeout(300);
  ok(!(await p.evaluate(() => !!window.__TG.docs.sh1)) && !/Krkonoše weekend/.test(await t.text(p)), '11 leaving takes it off our Plans');
  await p.close();

  // 9. an invitation from a friend: on Today and Plans, Join brings it in
  p = await t.open({ hash: 'today', T: '2026-11-10T10:00:00', init: fake });
  await p.evaluate(() => { window.__TG.invites = [{ id: 'iv1', title: 'Lisbon', kind: 'trip', start: '2026-12-01', end: '2026-12-05', place: 'Lisbon', from: 'Jo', who: ['Jo'] }]; tgLoad(); }); await p.waitForTimeout(400);
  txt = await t.text(p);
  ok(/Do it together\?/.test(txt) && /Jo asks you to plan Lisbon/.test(txt), '12 the invitation shows on Today');
  await t.tap(p, 'button[data-act=tg-join][data-id=iv1]'); await p.waitForTimeout(500);
  txt = await t.text(p);
  ok(/Lisbon/.test(txt) && /Together/.test(txt) && /Tent/.test(txt), '13 Join opens the shared plan, with what the friend already added');
  ok(!/Jo asks you to plan/.test(txt), '14 the invitation is gone once answered');
  const pg = await p.evaluate(() => { const x = pxGet('iv1'); return { by: x.by, who: x.who }; });
  ok(pg.by === 'Alex' && pg.who.join() === 'Alex', '15 in our household I’m the lead and the one going, until we change it: ' + JSON.stringify(pg));
  await p.close();

  // 10. the event form: a connected friend going → "Plan it together with Jo", ticked; saving shares it
  p = await t.open({ hash: 'calendar', T: '2026-11-10T10:00:00', init: fake });
  await p.evaluate(() => { newEv({ title: 'Cottage with Jo', date: '2026-12-12', endDate: '2026-12-14', allDay: true, who: ['Alex', 'Jo'], kind: 'family' }); S.ui.ev.plan = true; S.ui.ev.planKind = 'trip'; render(true); }); await p.waitForTimeout(300);
  ok(/Do it together with Jo/.test(await t.text(p)), '16 the event form offers planning together with the connected friend who is going');
  await p.evaluate(() => saveEvent()); await p.waitForTimeout(800);
  const c2 = await p.evaluate(() => window.__TG.calls.filter(c => c[0] === 'plan-share'));
  ok(c2.length === 1 && c2[0][1].plan.title.startsWith('Cottage with Jo'), '17 “Save and open” asks Jo to do it together');
  await p.close();
  await done(t);
})();
