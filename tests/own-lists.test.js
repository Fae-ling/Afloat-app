// Afloat's own lists (10 Nov 2026, platform/todo.js): a household without a task app gets simple to-do and shopping lists
// kept in its data, behind the same connector as Trello. Our household doesn't, unless it switches them on.
const { start, ok, done } = require('./helpers');
(async () => {
  const t = await start();
  const nh = () => { window.claude.household = () => ({ hid: 'h2', base: 'households/h2/', legacy: false, name: 'Flat' }); };
  const seed = { 'home/household': { setup: 1, members: [{ id: 'a', name: 'Eva' }, { id: 'b', name: 'Tom' }], kids: [] }, 'home/people': { people: { Eva: { setupDone: 1 }, Tom: { setupDone: 1 } } } };

  const o = await t.open({ T: '2026-11-05T10:30:00' }); await o.waitForTimeout(800);
  ok(await o.evaluate(() => !ownOn() && !tbBoards().some(b => b.id === 'af:board')), '1 our household: no Afloat lists unless switched on');

  const p = await t.open({ who: 'Eva', fresh: true, seed, T: '2026-11-05T10:30:00', init: nh }); await p.waitForTimeout(1500);
  const setup = await p.evaluate(() => ({ boards: tbBoards().map(b => b.name), tr: H('trello'), lists: (tbBoard('af:board') || {}).lists }));
  ok(setup.boards.includes('Afloat lists') && setup.tr.board === 'af:board', '2 a new household starts with Afloat’s own lists: ' + setup.boards.join());
  ok(setup.lists.map(l => l.name).join('|') === 'Eva’s to-dos|Tom’s to-dos|Household|Groceries|Toiletries and cleaning|Pharmacy|Done' && setup.tr.people.Eva && setup.tr.lists.home && setup.tr.pick.food, '3 one list per person, the household’s and three for shopping, already chosen');

  await p.evaluate(async () => { await trCreate(H('trello').people.Eva, 'Call the plumber'); await trCreate(H('trello').lists.home, 'Descale the kettle'); await trLoad(); });
  await p.waitForTimeout(500);
  const c = await p.evaluate(() => S.trello.cards.map(x => x.name + ' @ ' + x.list.name));
  ok(c.includes('Call the plumber @ Eva’s to-dos') && c.includes('Descale the kettle @ Household'), '4 tasks are saved in the household’s data and read back: ' + c.join(', '));
  await t.go(p, 'tasks'); ok(/Call the plumber/.test(await t.text(p)), '5 and show in Tasks');
  const id = await p.evaluate(() => S.trello.cards.find(x => x.name === 'Call the plumber').id);
  await p.evaluate(async id => { await trTomorrow(id); }, id); await p.waitForTimeout(300);
  ok(await p.evaluate(id => /T/.test(window.__st['todo/' + id.slice(5)].due || ''), id), '6 moving to tomorrow saves the due date');
  await p.evaluate(async id => { await trDone(id); await trLoad(); }, id); await p.waitForTimeout(300);
  ok(await p.evaluate(id => window.__st['todo/' + id.slice(5)].done === true && !S.trello.cards.some(x => x.id === id), id), '7 done: kept as done, gone from the lists');
  await p.evaluate(async () => { await toShop('Washing-up liquid'); }); await p.waitForTimeout(500);
  ok(await p.evaluate(() => S.trello.cards.some(x => x.name === 'Washing-up liquid' && x.list.name === 'Toiletries and cleaning')), '8 the supply check sends to Afloat’s Toiletries list');
  ok(await p.evaluate(() => H('trello').shopIds.food === H('trello').pick.food && H('trello').ownShared === true), '9 Meals is told the groceries list and that Afloat’s lists are on');
  await p.evaluate(async () => { const r = await mcp.callTool('Trello', 'trelloWriteChecklist', { action: 'create', cardId: S.trello.cards.find(x => x.name === 'Descale the kettle').id, name: 'Steps' }); const it = await mcp.callTool('Trello', 'trelloWriteChecklist', { action: 'add_item', checklistId: r.payload.id, text: 'Vinegar in' }); await mcp.callTool('Trello', 'trelloWriteChecklist', { action: 'update_item', itemId: it.payload.id, checked: true }); window.__ck = (await mcp.callTool('Trello', 'trelloReadChecklist', { action: 'list_by_card', cardId: S.trello.cards.find(x => x.name === 'Descale the kettle').id })).payload; });
  ok(await p.evaluate(() => window.__ck.checklists[0].items[0].state === 'complete'), '10 checklists work the same way (for the editing-time steps after a gig, for example)');

  // switching them off: the board goes, nothing is deleted
  await t.tap(p, '[data-act=settings]'); ok(/Your task lists/i.test(await t.text(p, '#sheet')), '11 Settings has Your task lists');
  await t.tap(p, '[data-act=own-sw]'); await p.waitForTimeout(800);
  ok(await p.evaluate(() => !ownOn() && !tbBoards().some(b => b.id === 'af:board') && Object.keys(window.__st).some(k => k.startsWith('todo/'))), '12 switched off: the lists leave Afloat, the tasks stay saved');
  await done(t);
})();
