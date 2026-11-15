/* Afloat · platform/todo.js · Task apps behind one connector (10 Nov 2026).
   The app talks to tasks in Trello's shape (boards › lists › cards, labels, checklists, members) through mcp.callTool
   ('Trello', tool, args). This file sits in front of that call and adds other places tasks can live, each looking like a
   Trello board to the rest of Afloat:
   - Afloat's own lists (ids "af:…"): kept in the household's data (home/todo for the lists, todo/<id> for each card).
     For households without a task app; shared by everyone in the household; works offline like the rest of Afloat.
   Anything else goes to the real Trello connector unchanged. Loaded by index.html and meals/index.html; both call
   afloatTodo.wrap(mcp, db, { on, me, people }) and use what it returns as their mcp. */
(() => {
  const AF = 'af:', BOARD = 'af:board', WS = { id: 'af:ws', displayName: 'Afloat' };
  const LABELS = [{ id: 'af:lb:red', name: 'Urgent', color: 'red' }, { id: 'af:lb:orange', name: 'Soon', color: 'orange' }, { id: 'af:lb:green', name: 'Someday', color: 'green' }];
  const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const isAf = v => typeof v === 'string' && v.startsWith(AF);
  const cardKey = id => String(id).slice('af:c:'.length);

  function wrap(raw, db, opt) {
    const on = () => { try { return !!opt.on(); } catch { return false; } };
    const listsDoc = () => db.doc('home/todo');
    /* the lists: one per adult, the household's, and three for shopping; made the first time they're needed */
    async function lists() {
      const s = await listsDoc().get(), d = (s && s.exists && s.data()) || {};
      if (Array.isArray(d.lists) && d.lists.length) return d.lists;
      const L = [...(opt.people() || []).map(n => ({ id: 'af:l:' + rid(), name: `${n}’s to-dos`, person: n })), { id: 'af:l:' + rid(), name: 'Household', role: 'home' },
        { id: 'af:l:' + rid(), name: 'Groceries', role: 'food' }, { id: 'af:l:' + rid(), name: 'Toiletries and cleaning', role: 'shop' }, { id: 'af:l:' + rid(), name: 'Pharmacy', role: 'med' }, { id: 'af:l:' + rid(), name: 'Done', role: 'done' }];
      await listsDoc().set({ ...d, lists: L, at: Date.now() }); return L;
    }
    const board = () => ({ id: BOARD, name: 'Afloat lists', url: '', closed: false, workspace: WS });
    const member = n => ({ id: 'af:m:' + n, username: n, fullName: n });
    async function cards() { const q = await db.collection('todo').get(); return (q.docs || []).map(x => ({ ...(x.data() || {}), _k: x.id })).filter(c => c && c.name); }
    const shape = (c, L) => { const l = L.find(x => x.id === c.listId) || {}; return { id: 'af:c:' + c._k, name: c.name, desc: c.desc || '', url: '', due: c.due || null, complete: !!c.done, closed: !!c.closed,
      list: { id: c.listId, name: l.name || '' }, board: { id: BOARD, name: 'Afloat lists' }, labels: (c.labels || []).map(id => LABELS.find(x => x.id === id)).filter(Boolean),
      members: (c.members || []).map(member), idMembers: (c.members || []).map(n => 'af:m:' + n), pos: c.pos || 0 }; };
    const cardDoc = id => db.doc('todo/' + cardKey(id));
    async function getCard(id) { const s = await cardDoc(id).get(); if (!s || !s.exists) throw { code: 'tool_error', message: 'That task is gone.' }; return s.data() || {}; }
    async function patchCard(id, f) { const c = await getCard(id); const n = f({ ...c }) || c; n.at = Date.now(); await cardDoc(id).set(n); return n; }
    const ckOf = id => { const p = String(id).split(':'); return { card: 'af:c:' + p[2], k: p.slice(0, 4).join(':') }; }; /* af:k:<card>:<x> and af:i:<card>:<x>:<y> */

    async function af(t, a) {
      if (t === 'trelloReadBoard' && a.action === 'get') return { id: BOARD, name: 'Afloat lists', lists: (await lists()).map(l => ({ id: l.id, name: l.name })) };
      if (t === 'trelloReadBoard' && a.action === 'list_labels') return { labels: LABELS };
      if (t === 'trelloReadMember' && a.action === 'list_by_board') return { members: (opt.people() || []).map(member) };
      if (t === 'trelloReadCard' && (a.action === 'list_by_board' || a.action === 'list_by_list')) {
        const L = await lists(), all = (await cards()).filter(c => !c.closed && (a.action === 'list_by_board' || c.listId === a.listId)).sort((x, y) => (x.pos || 0) - (y.pos || 0));
        return { cards: { nodes: all.map(c => shape(c, L)), pageInfo: { hasNextPage: false } } };
      }
      if (t === 'trelloWriteCard') {
        if (a.action === 'create') { const k = rid(), c = { name: String(a.name || '').slice(0, 500), desc: a.desc || '', due: a.due || null, listId: a.listId, pos: a.pos === 'bottom' ? Date.now() : -Date.now(), by: opt.me() || '', at: Date.now(), labels: [], members: [], comments: [], checklists: [] };
          await db.doc('todo/' + k).set(c); return { id: 'af:c:' + k, url: '' }; }
        if (a.action === 'update') { await patchCard(a.cardId, c => { for (const f of ['name', 'desc', 'due']) if (a[f] !== undefined) c[f] = a[f]; if (a.closed !== undefined) c.closed = !!a.closed; if (a.dueComplete !== undefined) c.done = !!a.dueComplete; return c; }); return { id: a.cardId }; }
        if (a.action === 'move') { await patchCard(a.cardId, c => ({ ...c, listId: a.listId })); return { id: a.cardId }; }
        if (a.action === 'mark_done') { const L = await lists(), dn = L.find(l => l.role === 'done'); await patchCard(a.cardId, c => ({ ...c, done: true, doneAt: Date.now(), closed: true, ...(dn ? { listId: dn.id } : {}) })); return { ok: true }; }
        if (a.action === 'archive') { await patchCard(a.cardId, c => ({ ...c, closed: true })); return { ok: true }; }
        if (a.action === 'add_comment') { await patchCard(a.cardId, c => ({ ...c, comments: [...(c.comments || []), { by: opt.me() || '', text: String(a.text || '').slice(0, 2000), at: Date.now() }] })); return { ok: true }; }
        if (a.action === 'attach_label') { await patchCard(a.cardId, c => ({ ...c, labels: [...new Set([...(c.labels || []), a.labelId])] })); return { ok: true }; }
        if (a.action === 'detach_label') { await patchCard(a.cardId, c => ({ ...c, labels: (c.labels || []).filter(x => x !== a.labelId) })); return { ok: true }; }
        if (a.action === 'add_member') { await patchCard(a.cardId, c => ({ ...c, members: [...new Set([...(c.members || []), String(a.memberId || '').replace('af:m:', '')])] })); return { ok: true }; }
      }
      if (t === 'trelloReadChecklist' && a.action === 'list_by_card') return { checklists: (await getCard(a.cardId)).checklists || [] };
      if (t === 'trelloWriteChecklist') {
        if (a.action === 'create') { const id = `af:k:${cardKey(a.cardId)}:${rid()}`, cl = { id, name: a.name || 'Checklist', items: [] }; await patchCard(a.cardId, c => ({ ...c, checklists: [...(c.checklists || []), cl] })); return cl; }
        if (a.action === 'add_item') { const { card } = ckOf(a.checklistId), it = { id: `${a.checklistId.replace('af:k:', 'af:i:')}:${rid()}`, name: a.text || a.name || '', state: 'incomplete' };
          await patchCard(card, c => ({ ...c, checklists: (c.checklists || []).map(k => k.id === a.checklistId ? { ...k, items: [...k.items, it] } : k) })); return it; }
        if (a.action === 'update_item') { const { card } = ckOf(a.itemId);
          await patchCard(card, c => ({ ...c, checklists: (c.checklists || []).map(k => ({ ...k, items: k.items.map(i => i.id === a.itemId ? { ...i, state: a.checked ? 'complete' : 'incomplete' } : i) })) })); return { id: a.itemId }; }
      }
      throw { code: 'tool_error', message: 'Afloat’s own lists can’t do that yet.' };
    }
    /* which side a call belongs to: an Afloat id anywhere in it, or the board list / who-am-I that both answer */
    const mine = a => ['cardId', 'listId', 'boardId', 'boardIdOrUrl', 'checklistId', 'itemId'].some(k => isAf(a && a[k]));
    return {
      own: true,
      callTool: async (server, tool, args = {}, o) => {
        if (server !== 'Trello') return raw ? raw.callTool(server, tool, args, o) : Promise.reject({ code: 'server_unavailable' });
        if (on() && mine(args)) return { payload: await af(tool, args) };
        if (tool === 'trelloReadBoard' && args.action === 'list') {
          let p = null, err = null; try { p = raw ? (await raw.callTool(server, tool, args, o)).payload || {} : null; } catch (e) { err = e; }
          if (!on()) { if (err) throw err; return { payload: p || {} }; }
          p = p || {};
          if (Array.isArray(p.boards)) return { payload: { ...p, boards: [...p.boards, board()] } };
          if (p.cards && Array.isArray(p.cards.nodes)) return { payload: { ...p, cards: { ...p.cards, nodes: [...p.cards.nodes, board()] } } };
          return { payload: { boards: [board()] } };
        }
        if (tool === 'trelloReadMember' && args.action === 'get_me') {
          try { if (raw) return await raw.callTool(server, tool, args, o); } catch (e) { if (!on()) throw e; }
          if (!on()) throw { code: 'server_not_connected' };
          return { payload: member(opt.me() || 'You') };
        }
        if (!raw) throw { code: 'server_not_connected' };
        return raw.callTool(server, tool, args, o);
      },
    };
  }
  window.afloatTodo = { wrap, BOARD, isAf };
})();
