// Trello for Afloat: answers the same tool calls the app made to claude.ai's Trello connector
// (trelloReadCard, trelloWriteCard, ...) using the signed-in person's own Trello token.
const { raw, ari } = require('./ids');

class ToolError extends Error { constructor(code, message, extra = {}) { super(message); this.code = code; Object.assign(this, extra); } }

function client(key, token, fetchImpl = fetch) {
  const call = async (method, path, params = {}) => {
    const u = new URL('https://api.trello.com/1' + path);
    const body = new URLSearchParams();
    const target = method === 'GET' || method === 'DELETE' ? u.searchParams : body;
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) target.set(k, String(v));
    u.searchParams.set('key', key); u.searchParams.set('token', token);
    const r = await fetchImpl(u.toString(), method === 'GET' || method === 'DELETE' ? { method } : { method, body, headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    if (r.status === 401) throw new ToolError('needs_reauth', 'Trello needs reconnecting.');
    if (r.status === 429) throw new ToolError('server_unavailable', 'Trello is busy.', { retryable: true, retryAfterMs: 2000 });
    if (r.status >= 500) throw new ToolError('server_unavailable', 'Trello didn’t answer.', { retryable: true });
    const text = await r.text();
    if (!r.ok) throw new ToolError('tool_error', text.slice(0, 300) || ('Trello said ' + r.status));
    try { return text ? JSON.parse(text) : {}; } catch { return {}; }
  };
  return call;
}

/* board id → workspace id, remembered for one request */
function wsCache(call) {
  const m = new Map();
  return async idBoard => {
    if (!idBoard) return '';
    if (!m.has(idBoard)) m.set(idBoard, call('GET', `/boards/${idBoard}`, { fields: 'idOrganization' }).then(b => b.idOrganization || '').catch(() => ''));
    return m.get(idBoard);
  };
}

const member = m => ({ id: ari.user(m.id), username: m.username || '', fullName: m.fullName || m.username || '' });
const label = (w, l) => ({ id: ari.label(w, l.id), name: l.name || '', color: l.color || '' });

function card(c, w, listName, boardName, members = []) {
  return {
    id: ari.card(w, c.id), name: c.name, desc: c.desc || '', url: c.url || c.shortUrl || '', webUrl: c.url || '',
    list: { id: ari.list(w, c.idList), name: listName || '' }, board: { id: ari.board(w, c.idBoard), name: boardName || '' },
    labels: (c.labels || []).map(l => label(w, l)), due: c.due || null, dueComplete: !!c.dueComplete, complete: !!c.dueComplete, closed: !!c.closed,
    lastActivityAt: c.dateLastActivity || null,
    members: (c.idMembers || []).map(id => members.find(m => m.id === id)).filter(Boolean).map(member),
  };
}

const CARD_FIELDS = 'name,desc,url,shortUrl,due,dueComplete,closed,idList,idBoard,idMembers,labels,dateLastActivity';

async function run(call, tool, a) {
  const wsOf = wsCache(call);
  const A = a.action;
  if (tool === 'trelloReadMember') {
    if (A === 'get_me') { const m = await call('GET', '/members/me', { fields: 'username,fullName,email,avatarUrl,url,prefs' }); return { ...member(m), email: m.email || '', prefs: { timezone: (m.prefs && m.prefs.timezoneInfo && m.prefs.timezoneInfo.timezoneCurrent) || 'Europe/Prague' } }; }
    if (A === 'list_by_board') { const ms = await call('GET', `/boards/${raw(a.boardId)}/memberships`, { member: true, member_fields: 'username,fullName' });
      return { members: ms.filter(x => x.member).map(x => ({ ...member(x.member), role: x.memberType === 'admin' ? 'admin' : x.memberType === 'observer' ? 'observer' : 'member' })) }; }
    if (A === 'get') { const m = await call('GET', `/members/${raw(a.memberId)}`, { fields: 'username,fullName' }); return member(m); }
  }
  if (tool === 'trelloReadBoard') {
    if (A === 'list') {
      const bs = await call('GET', '/members/me/boards', { filter: a.filter === 'all' ? 'all' : a.filter === 'closed' ? 'closed' : 'open', fields: 'name,url,closed,idOrganization', organization: true, organization_fields: 'displayName' });
      return { boards: bs.map(b => ({ id: ari.board(b.idOrganization, b.id), name: b.name, url: b.url, closed: !!b.closed, workspace: { id: ari.workspace(b.idOrganization), displayName: (b.organization && b.organization.displayName) || 'Personal' } })) };
    }
    if (A === 'get') { const b = await call('GET', `/boards/${raw(a.boardId)}`, { fields: 'name,url,closed,idOrganization', lists: 'open', list_fields: 'name,closed' });
      return { id: ari.board(b.idOrganization, b.id), name: b.name, url: b.url, closed: !!b.closed, lists: (b.lists || []).map(l => ({ id: ari.list(b.idOrganization, l.id), name: l.name, closed: !!l.closed })) }; }
    if (A === 'list_labels') { const id = raw(a.boardId), w = await wsOf(id); const ls = await call('GET', `/boards/${id}/labels`, { limit: 1000 }); return { labels: ls.map(l => label(w, l)), hasMore: false }; }
  }
  if (tool === 'trelloReadCard') {
    if (A === 'list_by_board') {
      const id = raw(a.boardIdOrUrl);
      const b = await call('GET', `/boards/${id}`, { fields: 'name,idOrganization', lists: 'open', list_fields: 'name' });
      const w = b.idOrganization || '', ln = Object.fromEntries((b.lists || []).map(l => [l.id, l.name]));
      const ms = await call('GET', `/boards/${id}/members`, { fields: 'username,fullName' }).catch(() => []);
      const cs = await call('GET', `/boards/${id}/cards/${a.filter === 'archived' ? 'closed' : a.filter === 'all' ? 'all' : 'open'}`, { fields: CARD_FIELDS });
      return { cards: { nodes: cs.map(c => card(c, w, ln[c.idList], b.name, ms)), totalCount: cs.length, pageInfo: { hasNextPage: false, endCursor: null } } };
    }
    if (A === 'list_by_list') {
      const l = await call('GET', `/lists/${raw(a.listId)}`, { fields: 'name,idBoard' }), b = await call('GET', `/boards/${l.idBoard}`, { fields: 'name,idOrganization' });
      const cs = await call('GET', `/lists/${l.id}/cards`, { fields: CARD_FIELDS, filter: a.filter === 'archived' ? 'closed' : a.filter === 'all' ? 'all' : 'open' });
      return { cards: cs.map(c => card(c, b.idOrganization, l.name, b.name)), pageInfo: { hasNextPage: false, endCursor: null } };
    }
    if (A === 'get') { const c = await call('GET', `/cards/${raw(a.cardIdOrUrl)}`, { fields: CARD_FIELDS, list: true, board: true, board_fields: 'name,idOrganization' });
      return card(c, (c.board || {}).idOrganization, (c.list || {}).name, (c.board || {}).name); }
  }
  if (tool === 'trelloWriteCard') {
    const cid = raw(a.cardId);
    const done = async c => { const w = await wsOf(c.idBoard); return { id: ari.card(w, c.id), url: c.url || c.shortUrl || '', name: c.name }; };
    if (A === 'create') return done(await call('POST', '/cards', { idList: raw(a.listId), name: a.name, desc: a.desc, due: a.due, pos: a.pos }));
    if (A === 'update') return done(await call('PUT', `/cards/${cid}`, { name: a.name, desc: a.desc, due: a.due }));
    if (A === 'move') return done(await call('PUT', `/cards/${cid}`, { idList: raw(a.listId), idBoard: a.boardId ? raw(a.boardId) : undefined, pos: a.pos }));
    if (A === 'archive') return done(await call('PUT', `/cards/${cid}`, { closed: true }));
    if (A === 'mark_done') return done(await call('PUT', `/cards/${cid}`, { dueComplete: true }));
    if (A === 'attach_label') { await call('POST', `/cards/${cid}/idLabels`, { value: raw(a.labelId) }); return { ok: true }; }
    if (A === 'detach_label') { await call('DELETE', `/cards/${cid}/idLabels/${raw(a.labelId)}`); return { ok: true }; }
    if (A === 'add_comment') { const x = await call('POST', `/cards/${cid}/actions/comments`, { text: a.text }); return { id: 'ari:cloud:trello::action/' + x.id, text: a.text }; }
  }
  if (tool === 'trelloReadChecklist' && A === 'list_by_card') {
    const cid = raw(a.cardId), c = await call('GET', `/cards/${cid}`, { fields: 'idBoard' }), w = await wsOf(c.idBoard);
    const cls = await call('GET', `/cards/${cid}/checklists`, { checkItems: 'all', checkItem_fields: 'name,state,pos' });
    return { checklists: cls.map(cl => ({ id: ari.checklist(w, cl.id), name: cl.name, items: (cl.checkItems || []).sort((x, y) => x.pos - y.pos).map(i => ({ id: ari.item(w, i.id), name: i.name, state: i.state })) })) };
  }
  if (tool === 'trelloWriteChecklist') {
    if (A === 'create') { const cid = raw(a.cardId), c = await call('GET', `/cards/${cid}`, { fields: 'idBoard' }), w = await wsOf(c.idBoard);
      const cl = await call('POST', '/checklists', { idCard: cid, name: a.name, pos: a.pos }); return { id: ari.checklist(w, cl.id), name: cl.name, items: [] }; }
    const cl = await call('GET', `/checklists/${raw(a.checklistId)}`, { fields: 'idCard,idBoard' }), w = await wsOf(cl.idBoard);
    if (A === 'add_item') { const i = await call('POST', `/checklists/${cl.id}/checkItems`, { name: a.text, pos: a.pos }); return { id: ari.item(w, i.id), name: i.name, state: i.state }; }
    if (A === 'update_item') { const i = await call('PUT', `/cards/${cl.idCard}/checkItem/${raw(a.itemId)}`, { name: a.text, state: a.checked === undefined ? undefined : a.checked ? 'complete' : 'incomplete', pos: a.pos }); return { id: ari.item(w, i.id), name: i.name, state: i.state }; }
  }
  throw new ToolError('not_in_manifest', `Afloat doesn’t know ${tool} ${A || ''}.`);
}

module.exports = { client, run, ToolError };
