/* Afloat · app/trello.js · Trello: reading boards, lists and cards; to-dos across boards; priority labels; tasks placed in the calendar.
   Plain script: shares one scope with the other app/*.js files (loaded in order by index.html). See CLAUDE.md. */
/* ---------- Trello: reading cards and lists (the Domácnost board first, then every board you're on) ---------- */
const trNodes = p => { const c = p && p.cards; return Array.isArray(c) ? c : (c && Array.isArray(c.nodes)) ? c.nodes : []; };
function trMsg(e) {
  switch (e && e.code) {
    case 'needs_reauth': return `Trello needs reconnecting in ${CONN_WHERE}.`;
    case 'server_not_connected': return `Trello isn’t connected for you yet. Connect it in ${CONN_WHERE}.`;
    case 'not_granted': return 'Afloat couldn’t check Trello for this Google account. Check Settings → Connections.';
    case 'server_unavailable': return 'Trello didn’t answer. Try again in a minute.';
    case 'tool_error': return 'Trello refused that: ' + String(e.message || '').slice(0, 140);
    default: return 'Couldn’t reach Trello right now.';
  }
}
async function trLoad() {
  if (!mcp) return;
  if (S.trello.status === 'loading') { S.trello.again = true; return; }
  const ids = tbBoards().length ? tbBoards().map(b => b.id) : (H('trello').board ? [H('trello').board] : []);
  if (!ids.length) return;
  S.trello = { ...S.trello, status: 'loading', again: false }; render();
  const all = []; let okN = 0, lastErr = null;
  for (const id of ids) {
    try {
      let cursor = null, n = 0;
      do {
        const r = await callRetry(TR, 'trelloReadCard', { action: 'list_by_board', boardIdOrUrl: id, limit: 50, ...(cursor ? { cursor } : {}) });
        const p = r.payload || {}, bn = (tbBoard(id) || {}).name || '';
        if (Array.isArray(p.lists)) p.lists.forEach(l => (l.cards || []).forEach(cd => all.push({ board: { id, name: bn }, ...cd, list: cd.list || { id: l.id, name: l.name } })));
        else trNodes(p).forEach(cd => all.push({ board: { id, name: bn }, ...cd }));
        const pi = (p.cards && p.cards.pageInfo) || p.pageInfo || {};
        cursor = pi.hasNextPage ? pi.endCursor : p.hasNextPage ? p.nextCursor : null;
      } while (cursor && ++n < 8);
      okN++;
    } catch (e) { lastErr = e; }
  }
  if (okN) S.trello = { status: 'ok', at: Date.now(), cards: all.filter(x => !x.closed && !x.complete), err: lastErr && okN < ids.length ? lastErr : null };
  else S.trello = { status: 'error', at: S.trello.at, errAt: Date.now(), cards: S.trello.cards || [], err: lastErr };
  const again = S.trello.again; render();
  if (again) trLoad(); else if (S.trello.status === 'ok') calSync();
}
const trCreate = (listId, name, due, desc) => mcp.callTool(TR, 'trelloWriteCard', { action: 'create', listId, name: String(name).slice(0, 500), pos: 'top', ...(due ? { due } : {}), ...(desc ? { desc } : {}) }, { cache: false });
async function trDone(id) {
  const card = S.trello.cards.find(c => c.id === id);
  S.trello = { ...S.trello, cards: S.trello.cards.filter(c => c.id !== id) }; render(true);
  try { await mcp.callTool(TR, 'trelloWriteCard', { action: 'mark_done', cardId: id }, { cache: false }); toast(CHEERS[Math.floor(Math.random() * CHEERS.length)]); }
  catch (e) { if (card) S.trello.cards.push(card); toast(trMsg(e)); render(true); }
}
/* swipe a task left: due tomorrow, keeping its time of day if it had one */
async function trTomorrow(id) {
  const c = (S.trello.cards || []).find(x => x.id === id); if (!c || !mcp) return;
  const old = c.due ? new Date(c.due) : null, d = new Date(tKey() + 'T09:00:00');
  if (old && !(old.getHours() === 9 && old.getMinutes() === 0)) d.setHours(old.getHours(), old.getMinutes());
  const prev = c.due; c.due = d.toISOString(); render(true);
  try { await trCall('trelloWriteCard', { action: 'update', cardId: id, due: c.due }); toast(`“${c.name}” moved to tomorrow.`); }
  catch (e) { c.due = prev; render(true); toast(trMsg(e)); }
}
async function toShop(name) {
  const id = trL().shop; if (!mcp || !id) return;
  if (S.trello.cards.some(x => x.list && x.list.id === id && String(x.name).toLowerCase() === name.toLowerCase())) return toast(name + ' is already on the shopping list.');
  try { await trCreate(id, name); toast(name + ' added to ' + shopName('shop') + '.'); trLoad(); } catch (e) { toast(trMsg(e)); }
}
async function sendDump(listId, lines, due) {
  S.ui.sending = true; render(true); let n = 0;
  try {
    for (const l of lines) { await trCreate(listId, l, due); n++; }
    toast(`${n} card${n === 1 ? '' : 's'} on Trello. Your head can let go of ${n === 1 ? 'it' : 'them'}.`);
    S.ui.dumpText = ''; S.ui.capture = false; trLoad();
  } catch (e) { toast((n ? `${n} sent, then this: ` : '') + trMsg(e)); S.ui.dumpText = lines.slice(n).join('\n'); }
  S.ui.sending = false; render(true);
}
/* ---------- to-dos across all Trello boards: inbox, Claude sorting, the Tasks view, handing tasks over ----------
   Board catalogue (S.tb) is read per viewer with their own Trello account and cached in this browser.
   Shared doc home/tasks: inbox[me] (unsorted lines), examples[me] (past choices Claude learns from),
   show[me] (which lists count as tasks), handed[cardKey] (tasks handed to someone else). */
const tkey = id => String(id || '').split('/').pop();
const TB_TTL = 12 * 3600e3;
S.tb = (() => { try { const o = JSON.parse(lsGet('afloat.tb2') || 'null'); return o && Array.isArray(o.boards) ? { ...o, status: 'cached' } : { status: 'idle', boards: [] }; } catch { return { status: 'idle', boards: [] }; } })();
let sample = null;
const wait = ms => new Promise(r => setTimeout(r, ms));
async function callRetry(server, t, a) {
  try { return await mcp.callTool(server, t, a, { cache: false }); }
  catch (e) { if (e && (e.retryable || e.code === 'upstream_error' || e.code === 'server_unavailable')) { await wait(Math.min(8000, (e && e.retryAfterMs) || 1500)); return mcp.callTool(server, t, a, { cache: false }); } throw e; }
}
const trCall = (t, a) => callRetry(TR, t, a).then(r => r.payload || {});
async function tbLoad(force) {
  if (!mcp || S.tb.status === 'loading') return;
  if (!force && S.tb.boards.length && Date.now() - (S.tb.at || 0) < TB_TTL) return;
  S.tb = { ...S.tb, status: 'loading' }; render();
  try {
    const meP = await trCall('trelloReadMember', { action: 'get_me' }), bl = await trCall('trelloReadBoard', { action: 'list', limit: 100 });
    /* claude.ai's connector answers {cards:{nodes}} with the workspace under "board"; Afloat's own server answers {boards} */
    const raw = (bl.boards || ((bl.cards || {}).nodes || []).map(b => ({ ...b, workspace: b.workspace || (b.board ? { id: b.board.id, displayName: b.board.name } : undefined) }))).filter(b => b && b.id && !b.closed);
    const boards = [];
    for (const b of raw) {
      const g = await trCall('trelloReadBoard', { action: 'get', boardId: b.id }).catch(() => ({}));
      const lab = await trCall('trelloReadBoard', { action: 'list_labels', boardId: b.id, limit: 100 }).catch(() => ({}));
      const mem = await trCall('trelloReadMember', { action: 'list_by_board', boardId: b.id, limit: 100 }).catch(() => ({}));
      boards.push({ id: b.id, name: b.name || 'Board', url: b.url || '', ws: (b.workspace || {}).displayName || 'Other', wsId: (b.workspace || {}).id || '',
        lists: (g.lists || []).filter(l => l && l.id && !l.closed).map(l => ({ id: l.id, name: l.name || 'List' })),
        labels: (lab.labels || []).filter(x => x && x.id).map(x => ({ id: x.id, name: x.name, color: x.color || '' })),
        members: (mem.members || []).filter(m => m && m.id).map(m => ({ id: m.id, username: m.username || '', fullName: m.fullName || m.username || 'Someone' })) });
    }
    S.tb = { status: 'ok', boards, me: { id: meP.id || '', username: meP.username || '', fullName: meP.fullName || '' }, at: Date.now() };
    lsSet('afloat.tb2', JSON.stringify(S.tb)); try { ownSetup(); trShare(); } catch (e) { console.warn(e); }
  } catch (e) { S.tb = { ...S.tb, status: 'error', err: e }; console.warn('Trello boards', e); }
  render();
}
const tbBoards = () => S.tb.boards || [];
/* the household's Trello lists. Chosen in Settings → Your task lists (home/trello.pick: food = groceries, shop =
   toiletries and cleaning (restock, supply check), med = pharmacy); until then found by name, in Czech or English. A stored
   chores or org list that is now a shopping list no longer counts as one. */
function trL() {
  const c = H('trello').lists || {}, pk = H('trello').pick || {}, all = tbBoards().flatMap(b => b.lists || []), by = rx => (all.find(l => rx.test(l.name)) || {}).id;
  const drug = pk.shop || by(/n[aá]kup\w*\s*[-–·]?\s*drogerie|^(toiletries|household shopping|drugstore)/i) || c.shop, food = pk.food || by(/n[aá]kup\w*\s*[-–·]?\s*j[ií]dlo|^(groceries|food shopping|shopping list)$/i) || null, med = pk.med || by(/n[aá]kup\w*\s*[-–·]?\s*l[eé]k[aá]rna|^(pharmacy|chemist)/i) || null;
  const shopIds = [drug, food, med].filter(Boolean), nameOf = id => (all.find(l => l.id === id) || {}).name || '', bad = id => !id || shopIds.includes(id) || /n[aá]kup/i.test(nameOf(id));
  return { ...c, shop: drug, food, med, chores: bad(c.chores) ? null : c.chores, org: bad(c.org) ? null : c.org };
}
/* Afloat's own lists (platform/todo.js): on for a new household unless it switches them off (home/trello.own), off for
   the first household unless it switches them on */
const ownOn = () => { const v = H('trello').own; return typeof v === 'boolean' ? v : (!!H('household').setup && !ourHome()); };
/* the first time Afloat's own lists are in, they become the household's lists (each person's, Household, the shopping
   lists), filling only what nobody has chosen yet */
function ownSetup() {
  if (!db || !S.loaded || !ownOn()) return; const b = tbBoard('af:board'); if (!b) return;
  const o = H('trello'), by = n => (b.lists.find(l => l.name === n) || {}).id, people = { ...(o.people || {}) }, lists = { ...(o.lists || {}) }, pick = { ...(o.pick || {}) };
  adults().forEach(n => { if (!people[n]) people[n] = by(`${n}’s to-dos`) || null; });
  if (!lists.home) lists.home = by('Household') || null;
  for (const [k, n] of [['food', 'Groceries'], ['shop', 'Toiletries and cleaning'], ['med', 'Pharmacy']]) if (!pick[k]) pick[k] = by(n) || null;
  const next = { ...o, board: o.board || 'af:board', people, lists, pick };
  if (JSON.stringify(next) !== JSON.stringify(o)) saveHome('trello', next);
}
/* a shopping list's name as it is on Trello, for the wording (e.g. "goes onto Groceries") */
const shopName = (k, dflt = 'the shopping list') => { const id = trL()[k], l = id && tbList(id); return l ? l.name : dflt; };
/* Meals (its own page) reads the shopping lists from home/trello.shopIds; kept current whenever the boards load */
function trShare() {
  if (!db || !S.loaded || !tbBoards().length) return;
  const L = trL(), ids = { food: L.food || null, drug: L.shop || null, med: L.med || null }, names = { food: shopName('food', ''), drug: shopName('shop', ''), med: shopName('med', '') }, cur = H('trello');
  if (JSON.stringify(cur.shopIds || {}) !== JSON.stringify(ids) || JSON.stringify(cur.shopNames || {}) !== JSON.stringify(names) || cur.ownShared !== ownOn()) mergeDoc('home/trello', { shopIds: ids, shopNames: names, ownShared: ownOn() });
}
const tbBoard = id => tbBoards().find(b => b.id === id);
const tbListBoard = listId => tbBoards().find(b => b.lists.some(l => l.id === listId));
const tbList = listId => { const b = tbListBoard(listId); return b ? b.lists.find(l => l.id === listId) : null; };
const destName = listId => { const b = tbListBoard(listId), l = b && b.lists.find(x => x.id === listId); return b && l ? `${b.name} › ${l.name}` : 'Choose where'; };
const others = b => (b ? b.members : []).filter(m => m.id !== (S.tb.me || {}).id);
const isDoneList = n => /^(done|hotovo|archiv)/i.test(String(n || '').trim());
const isShopList = id => { const L = trL(); return !!id && [L.shop, L.food, L.med].includes(id); };
const TASKY = /to-?do|tud[uů]|úkol|ukol|progress|chores|domácnost|household|doing|práce|work|dnes|this week/i;
const TD = () => H('tasks');
function listShown(l) {
  const v = ((TD().show || {})[me] || {})[tkey(l.id)];
  if (v === true || v === false) return v;
  if (isDoneList(l.name) || isShopList(l.id)) return false;
  return TASKY.test(l.name) || Object.values(H('trello').people || {}).includes(l.id);
}
const saveTasks = partial => mergeDoc('home/tasks', partial);
const recentDests = () => { try { return (JSON.parse(lsGet('afloat.recent.' + me) || '[]') || []).filter(id => tbList(id)); } catch { return []; } };
const pushRecent = id => lsSet('afloat.recent.' + me, JSON.stringify([id, ...recentDests().filter(x => x !== id)].slice(0, 6)));
function defaultDest() {
  const r = recentDests()[0]; if (r) return r;
  const my = (H('trello').people || {})[me]; if (my && tbList(my)) return my;
  for (const b of tbBoards()) { const l = b.lists.find(x => TASKY.test(x.name) && !isDoneList(x.name)); if (l) return l.id; }
  return ((tbBoards()[0] || {}).lists || [])[0]?.id || '';
}
const inbox = () => ((TD().inbox || {})[me] || []).filter(x => x && x.text);
const saveInbox = arr => saveTasks({ inbox: { [me]: arr.slice(-60) } });
const examples = () => ((TD().examples || {})[me] || []).filter(x => x && x.t && x.d);
function learn(rows) {
  const cur = examples(), add = rows.map(r => ({ t: String(r.text).slice(0, 120), d: destName(r.dest) }));
  const keep = cur.filter(x => !add.some(a => a.t.toLowerCase() === x.t.toLowerCase()));
  saveTasks({ examples: { [me]: [...keep, ...add].slice(-40) } });
}
const handed = () => Object.entries(TD().handed || {}).filter(([, v]) => v && v.cardId).map(([k, v]) => ({ k, ...v }));

/* due dates: a date with no time means 9:00, the way Trello itself treats it */
const dueISO = (d, t) => d ? new Date(`${d}T${t || '09:00'}`).toISOString() : null;
const dayDiff = iso => { const a = new Date(iso); a.setHours(0, 0, 0, 0); const b = new Date(); b.setHours(0, 0, 0, 0); return Math.round((a - b) / 864e5); };
function dueLabel(iso) {
  const n = dayDiff(iso), d = new Date(iso), t = d.getHours() === 9 && d.getMinutes() === 0 ? '' : ' ' + fmtT(iso);
  if (n < 0) return 'from ' + (n === -1 ? 'yesterday' : -n + ' days ago');
  if (n === 0) return 'today' + t; if (n === 1) return 'tomorrow' + t;
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + t;
}

/* ---------- priority: Trello's red / orange / green labels (or labels named high / medium / low) ---------- */
const PRIO = [['high', 'High', 'red'], ['med', 'Medium', 'orange'], ['low', 'Low', 'green']];
const PRANK = { high: 0, med: 1, low: 2, '': 3 };
const PRE = { high: /high|vysok|urgent|důležit/i, med: /medium|střed/i, low: /low|nízk/i };
const cardBoard = c => tbBoard((c.board || {}).id) || tbListBoard((c.list || {}).id);
function prioLabels(b) {
  const out = {}; if (!b) return out;
  for (const [k, , col] of PRIO) { const L = b.labels || []; const x = L.find(l => l.name && PRE[k].test(l.name)) || L.find(l => !l.name && String(l.color || '').replace(/_.*$/, '') === col); if (x) out[k] = x.id; }
  return out;
}
function prioOf(c) {
  const m = prioLabels(cardBoard(c)), ids = (c.labels || []).map(l => l.id);
  for (const [k] of PRIO) if (m[k] && ids.includes(m[k])) return k;
  return ((TD().prio || {})[tkey(c.id)]) || '';
}
const byPrio = (a, b) => PRANK[prioOf(a)] - PRANK[prioOf(b)] || byDue(a, b);
const prioTag = c => { const p = prioOf(c); return p ? `<span class="prio p-${p}">${PRIO.find(x => x[0] === p)[1]}</span>` : ''; };
const clCount = c => { const its = (c.checklists || []).flatMap(cl => cl.items || cl.checkItems || []); if (!its.length) return ''; const d = its.filter(i => i.state === 'complete' || i.checked === true).length; return ` · ☑ ${d}/${its.length}`; };

/* ---------- tasks in the calendar: home/tasks.cal[cardKey] = { gId, calId, due, name, allDay, mins, by, done } ---------- */
const linkData = L => { const { k, ...r } = L; return r; };
const calLinks = () => Object.entries(TD().cal || {}).filter(([, v]) => v && v.gId).map(([k, v]) => ({ k, ...v }));
const calLinkOf = id => calLinks().find(v => v.k === tkey(id));
const sameT = (a, b) => (a ? Date.parse(a) : 0) === (b ? Date.parse(b) : 0);
function evTimes(due, allDay, mins) {
  const d = new Date(due), day = keyOf(d);
  if (allDay) return { startTime: day + 'T00:00:00', endTime: calAdd(day, 1) + 'T00:00:00', allDay: true };
  const st = hm(d), en = new Date(d.getTime() + (mins || 30) * 6e4);
  return { startTime: `${day}T${st}:00`, endTime: `${keyOf(en)}T${hm(en)}:00` };
}
const evSummary = (name, calId, done) => `${done ? '✓' : '☐'} ${name}${calId && calId === calCfg().calId && me ? ' · ' + me : ''}`;
async function calLinkCreate(c, where, mins, allDay) {
  const calId = where === 'family' ? calCfg().calId : '', due = c.due;
  const r = await mcp.callTool(GC, 'create_event', { ...(calId ? { calendarId: calId } : {}), summary: evSummary(c.name, calId), description: `Task on Trello: ${c.url || c.webUrl || ''}\n(Afloat task)`, ...evTimes(due, allDay, mins), ...(calId ? { colorId: toGoogle(hexToG(pColor(me)) || NOBODY_COL) } : {}), notificationLevel: 'NONE' }, { cache: false });
  const p = r.payload || {}, gId = p.id || (p.event && p.event.id);
  if (gId) await saveTasks({ cal: { [tkey(c.id)]: { gId, calId, due, name: c.name, allDay: !!allDay, mins: mins || 30, by: me, at: Date.now() } } });
  return gId;
}
async function calLinkRemove(link) {
  try { await mcp.callTool(GC, 'delete_event', { ...(link.calId ? { calendarId: link.calId } : {}), eventId: link.gId, notificationLevel: 'NONE' }, { cache: false }); } catch {}
  await saveTasks({ cal: { [link.k]: null } });
}
/* three-way sync: whichever side moved since the last sync wins (Trello first if both did) */
let calSyncAt = 0, calSyncing = false;
async function calSync(force) {
  if (!mcp || calSyncing || S.trello.status !== 'ok' || (!force && Date.now() - calSyncAt < 2 * 6e4)) return;
  const links = calLinks().filter(v => v.by === me).slice(0, 20); if (!links.length) return;
  calSyncing = true; calSyncAt = Date.now();
  for (const L of links) {
    try {
      const c = (S.trello.cards || []).find(x => tkey(x.id) === L.k), base = L.calId ? { calendarId: L.calId } : {};
      let ev; try { ev = (await mcp.callTool(GC, 'get_event', { ...base, eventId: L.gId }, { cache: false })).payload; } catch (e) { if (e && e.code === 'tool_error') await saveTasks({ cal: { [L.k]: null } }); continue; }
      if (!ev || ev.status === 'cancelled') { await saveTasks({ cal: { [L.k]: null } }); continue; }
      const patch = {};
      if (!c) { if (!L.done) { await mcp.callTool(GC, 'update_event', { ...base, eventId: L.gId, summary: evSummary(L.name, L.calId, true), notificationLevel: 'NONE' }, { cache: false }); patch.done = true; } }
      else {
        const s = ev.start || {}, evDue = s.dateTime ? new Date(s.dateTime).toISOString() : s.date ? new Date(String(s.date).slice(0, 10) + 'T09:00').toISOString() : null;
        if (c.due && !sameT(c.due, L.due)) { await mcp.callTool(GC, 'update_event', { ...base, eventId: L.gId, ...evTimes(c.due, L.allDay, L.mins), summary: evSummary(c.name, L.calId), notificationLevel: 'NONE' }, { cache: false }); patch.due = c.due; patch.name = c.name; }
        else if (evDue && !sameT(evDue, L.due)) {
          const nd = L.allDay && c.due ? new Date(keyOf(new Date(evDue)) + 'T' + hm(new Date(c.due)) + ':00').toISOString() : evDue;
          await trCall('trelloWriteCard', { action: 'update', cardId: c.id, due: nd }); c.due = nd; patch.due = nd; toast(`“${c.name}” moved in the calendar, so its due date in Trello moved too.`);
        }
        if (c.name !== L.name && !patch.name) { await mcp.callTool(GC, 'update_event', { ...base, eventId: L.gId, summary: evSummary(c.name, L.calId), notificationLevel: 'NONE' }, { cache: false }); patch.name = c.name; }
      }
      if (Object.keys(patch).length) await saveTasks({ cal: { [L.k]: { ...linkData(L), ...patch } } });
    } catch (e) { console.warn(e); }
  }
  calSyncing = false; render();
}

/* hand a card to someone on its board: an @mention (Trello notifies them) plus Afloat's record */
async function handOver(c, p, due) {
  const myName = (S.tb.me || {}).fullName || me || 'Someone', b = cardBoard(c);
  await trCall('trelloWriteCard', { action: 'add_comment', cardId: c.id, text: `@${p.username} this one’s yours${due ? ', due ' + dueLabel(due) : ''}. Handed over by ${myName} in Afloat.` }).catch(() => {});
  await saveTasks({ handed: { [tkey(c.id)]: { cardId: c.id, name: c.name, url: c.url || c.webUrl || '', boardName: b ? b.name : '', due: due || c.due || null, toId: p.id, toName: p.fullName, toUser: p.username, by: me, byName: myName, at: Date.now() } } });
}
