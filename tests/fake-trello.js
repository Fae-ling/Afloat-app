// A pretend Trello (two workspaces, three boards) and a pretend Claude for the inbox sorter.
// Load after fakedb.js. Set window.__TR_ME ('a' or 'm') and optionally window.__SAMPLE(prompt) → array.
(() => {
  const seedTr = (window.__SEED || {})['home/trello'] || { lists: {}, people: {} }, L = seedTr.lists || {}, P = seedTr.people || {};
  const ws1 = { id: 'ari:ws/hmp', displayName: 'Happy mind palace' }, ws2 = { id: 'ari:ws/ent', displayName: 'Entropie' };
  const uA = { id: 'ari:user/a', username: 'alex_t', fullName: 'Alex' }, uM = { id: 'ari:user/m', username: 'sam_t', fullName: 'Sam' };
  const B = {
    dom: { id: seedTr.board || 'ari:board/dom', name: 'Domácnost', url: 'https://trello.example/dom', workspace: ws1, members: [uA, uM], labels: [],
      lists: [{ id: L.shop, name: 'Nákupy' }, { id: L.chores, name: 'Chores' }, { id: L.org, name: 'Organizace' }, { id: P['Alex'], name: 'Anežčiny To-Dos' }, { id: P['Sam'], name: 'Markovy tudůs' }, { id: L.home, name: 'Domácnost' }] },
    pro: { id: 'ari:board/pro', name: 'Projekty', url: 'https://trello.example/pro', workspace: ws2, members: [uA], labels: [{ id: 'ari:label/pq', name: 'prequel', color: 'orange_light' }, { id: 'ari:label/red', name: '', color: 'red' }, { id: 'ari:label/orange', name: '', color: 'orange' }, { id: 'ari:label/green', name: '', color: 'green' }],
      lists: [{ id: 'ari:list/todo', name: 'To-do' }, { id: 'ari:list/prog', name: 'In Progress' }, { id: 'ari:list/done', name: 'Done' }, { id: 'ari:list/pq', name: 'Prequel' }, { id: 'ari:list/loc', name: 'Lokace' }, { id: 'ari:list/char', name: 'Postavy' }] },
    foc: { id: 'ari:board/foc', name: 'Focení', url: 'https://trello.example/foc', workspace: ws1, members: [uA], labels: [], lists: [{ id: 'ari:list/insp', name: 'Random inspirace' }] },
  };
  const boardOf = listId => Object.values(B).find(b => b.lists.some(l => l.id === listId));
  const today = new Date(Date.now()); today.setHours(9, 0, 0, 0);
  const at = n => new Date(today.getTime() + n * 864e5).toISOString();
  let n = 0; const C = [];
  /* window.__TR_NAMES {listId: name} renames lists, e.g. Nákupy → Nákup - Drogerie */
  Object.entries(window.__TR_NAMES || {}).forEach(([id, nm]) => Object.values(B).forEach(b => b.lists.forEach(l => { if (l.id === id) l.name = nm; })));
  const card = (listId, name, extra = {}) => { const b = boardOf(listId), l = b.lists.find(x => x.id === listId); const c = { id: 'ari:card/c' + (++n), name, url: 'https://trello.example/c/' + n, list: { id: l.id, name: l.name }, board: { id: b.id, name: b.name }, due: null, complete: false, closed: false, labels: [], members: [], ...extra }; C.push(c); return c; };
  card('ari:list/todo', 'Pitch draft', { due: at(0) });
  card('ari:list/prog', 'Research sources');
  card('ari:list/char', 'Villain');
  card('ari:list/todo', 'Old overdue thing', { due: at(-2) });
  card('ari:list/todo', 'Next week thing', { due: at(5) });
  card(L.chores, 'Wipe shelves');
  card(L.shop, 'Milk');
  card('ari:list/insp', 'Moody light idea');
  card('ari:list/prog', 'Urgent pitch fix', { labels: [{ id: 'ari:label/red', name: '', color: 'red' }] });
  const CL = { };
  (window.__EXTRA_CARDS || []).forEach(c => C.push(JSON.parse(JSON.stringify(c))));
  window.__trCards = C; window.__trLog = []; window.__CL = CL;
  const tr = (t, a) => {
    window.__trLog.push([t, JSON.parse(JSON.stringify(a))]);
    const me = window.__TR_ME === 'm' ? uM : uA;
    if (t === 'trelloReadMember' && a.action === 'get_me') return { ...me, prefs: { timezone: 'Europe/Prague' } };
    if (t === 'trelloReadBoard' && a.action === 'list') return { boards: Object.values(B).filter(b => b.members.includes(me)).map(b => ({ id: b.id, name: b.name, url: b.url, closed: false, workspace: b.workspace })) };
    const b = Object.values(B).find(x => x.id === a.boardId || x.id === a.boardIdOrUrl);
    if (t === 'trelloReadBoard' && a.action === 'get') return { id: b.id, name: b.name, lists: b.lists };
    if (t === 'trelloReadBoard' && a.action === 'list_labels') return { labels: b.labels };
    if (t === 'trelloReadMember' && a.action === 'list_by_board') return { members: b.members.map(m => ({ ...m, role: 'admin' })) };
    if (t === 'trelloReadCard' && a.action === 'list_by_board') {
      // pages of two lists, like the real connector
      const start = a.cursor ? +a.cursor : 0, ls = b.lists.slice(start, start + 2);
      return { cards: { nodes: C.filter(c => ls.some(l => l.id === c.list.id)).map(c => JSON.parse(JSON.stringify(c))), pageInfo: { hasNextPage: start + 2 < b.lists.length, endCursor: String(start + 2) } } };
    }
    if (t === 'trelloWriteCard' && a.action === 'create') { const c = card(a.listId, a.name, { due: a.due || null, desc: a.desc || '' }); return { id: c.id, url: c.url }; }
    if (t === 'trelloWriteCard' && a.action === 'update') { const c = C.find(x => x.id === a.cardId); if (c) { for (const k of ['name', 'desc', 'due']) if (a[k] !== undefined) c[k] = a[k]; } return { id: a.cardId }; }
    if (t === 'trelloWriteCard' && a.action === 'move') { const c = C.find(x => x.id === a.cardId), b2 = boardOf(a.listId); if (c && b2) { c.list = { id: a.listId, name: b2.lists.find(l => l.id === a.listId).name }; c.board = { id: b2.id, name: b2.name }; } return { id: a.cardId }; }
    if (t === 'trelloWriteCard' && a.action === 'detach_label') { const c = C.find(x => x.id === a.cardId); if (c) c.labels = c.labels.filter(l => l.id !== a.labelId); return { ok: true }; }
    if (t === 'trelloReadChecklist' && a.action === 'list_by_card') return { checklists: CL[a.cardId] || [] };
    if (t === 'trelloWriteChecklist' && a.action === 'create') { const cl = { id: 'ari:checklist/' + (++n), name: a.name, items: [] }; (CL[a.cardId] = CL[a.cardId] || []).push(cl); return cl; }
    if (t === 'trelloWriteChecklist' && a.action === 'add_item') { const cl = Object.values(CL).flat().find(x => x.id === a.checklistId), it = { id: 'ari:item/' + (++n), name: a.text, state: 'incomplete' }; cl.items.push(it); return it; }
    if (t === 'trelloWriteChecklist' && a.action === 'update_item') { const it = Object.values(CL).flat().flatMap(x => x.items).find(x => x.id === a.itemId); if (it) it.state = a.checked ? 'complete' : 'incomplete'; return it || {}; }
    if (t === 'trelloWriteCard' && a.action === 'mark_done') { const c = C.find(x => x.id === a.cardId); if (c) c.complete = true; return { ok: true }; }
    if (t === 'trelloWriteCard' && a.action === 'attach_label') { const c = C.find(x => x.id === a.cardId); if (c) c.labels.push({ id: a.labelId }); return { ok: true }; }
    if (t === 'trelloWriteCard' && a.action === 'add_comment') { const c = C.find(x => x.id === a.cardId); if (c) (c.comments = c.comments || []).push(a.text); return { ok: true }; }
    return {};
  };
  const sampleFn = async (input) => ({ text: JSON.stringify(window.__SAMPLE(input)), truncated: false });
  sampleFn.limits = async () => ({ images: { maxCount: 8, mediaTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'], maxInputBytes: 2000000 } }); /* like platform/claude.js */
  sampleFn.json = async (input, opts) => { window.__prompt = input; window.__sampleOpts = opts; if (window.__SAMPLE_FAIL) throw { code: window.__SAMPLE_FAIL }; return window.__SAMPLE(input); };
  const base = window.claude.use;
  window.claude = { use: async k => {
    if (k === 'sample') return window.__SAMPLE ? sampleFn : null;
    const v = await base(k); if (k !== 'mcp' || !v) return v;
    return { callTool: async (s, t, a, o) => s === 'Trello' ? { payload: tr(t, a) } : v.callTool(s, t, a, o) };
  } };
})();
