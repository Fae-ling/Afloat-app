/* Afloat · app/tasks.js · The task editor and the Tasks view (Inbox, Handed to you, Today, From before, This week, Later, Waiting on others).
   Plain script: shares one scope with the other app/*.js files (loaded in order by index.html). See CLAUDE.md. */
/* ---------- the task editor ---------- */
function taskOpen(id) {
  const c = (S.trello.cards || []).find(x => x.id === id); if (!c) return;
  const d = c.due ? new Date(c.due) : null, link = calLinkOf(id);
  S.ui.task = { id, name: c.name, desc: c.desc || '', dest: c.list.id, due: d ? keyOf(d) : '', time: d && !(d.getHours() === 9 && d.getMinutes() === 0) ? hm(d) : '', prio: prioOf(c),
    who: (handed().find(v => v.cardId === id) || {}).toId || meIdT(), cal: !!link, where: link ? (link.calId ? 'family' : 'mine') : (calCfg().calId ? 'family' : 'mine'), mins: link ? link.mins : 30, pick: false, cls: null, busy: false };
  render(true);
  trCall('trelloReadChecklist', { action: 'list_by_card', cardId: id }).then(p => {
    if (!S.ui.task || S.ui.task.id !== id) return;
    S.ui.task.cls = (p.checklists || p.nodes || []).map(cl => ({ id: cl.id, name: cl.name || 'Checklist', items: (cl.items || cl.checkItems || []).map(i => ({ id: i.id, name: i.name || i.text || '', done: i.state === 'complete' || i.checked === true })) }));
    render(true);
  }).catch(() => { if (S.ui.task && S.ui.task.id === id) { S.ui.task.cls = []; render(true); } });
}
function vTask() {
  const t = S.ui.task, c = (S.trello.cards || []).find(x => x.id === t.id);
  if (!c) return `<div class="scrim" data-act="task-close"><div class="sheet" role="dialog" aria-label="Task"><div class="sec-head"><h2>Task</h2><button class="link" data-act="task-close">Close</button></div><p class="empty">This task isn’t open any more.</p></div></div>`;
  const b = tbListBoard(t.dest), pm = prioLabels(b), link = calLinkOf(t.id);
  if (t.pick) {
    const ws = [...new Set(tbBoards().map(x => x.ws))];
    return `<div class="scrim" data-act="task-close"><div class="sheet" role="dialog" aria-label="Move task"><div class="sec-head"><h2>Move to…</h2><button class="link" data-act="tpick-close">Back</button></div>
      ${ws.map(w => `<div class="ws"><h3>${esc(w)}</h3>${tbBoards().filter(x => x.ws === w).map(x => `<div class="pick-board"><b>${esc(x.name)}</b><div class="pills">${x.lists.map(l => `<button class="pill${l.id === t.dest ? ' on' : ''}" data-act="tpick-set" data-id="${esc(l.id)}">${esc(l.name)}</button>`).join('')}</div></div>`).join('')}</div>`).join('')}</div></div>`;
  }
  const cls = t.cls;
  return `<div class="scrim" data-act="task-close"><div class="sheet tsheet" role="dialog" aria-label="Edit task">
    <div class="sec-head"><h2>Edit task</h2><button class="link" data-act="task-close">Close</button></div>
    <input type="text" class="rv-title" id="tkName" data-tk="name" value="${esc(t.name)}" aria-label="Task title">
    <button class="dest" data-act="tpick"><span class="eyebrow">${esc(b ? b.ws : '')}</span><b>${esc(destName(t.dest))}</b><span aria-hidden="true">▾</span></button>
    <div class="rv-row"><label><span class="small muted">Due</span><input type="date" id="tkDue" data-tk="due" value="${esc(t.due)}"></label><label><span class="small muted">Time</span><input type="time" id="tkTime" data-tk="time" value="${esc(t.time)}" ${t.due ? '' : 'disabled'}></label></div>
    ${c.due && !t.due ? '<p class="note small">Trello’s connection can’t remove a due date. Clear it in Trello, or pick a new date here.</p>' : ''}
    <div><p class="small muted">Priority</p><div class="pills prio-pick">${[['', 'None'], ...PRIO.map(([k, l]) => [k, l])].map(([k, l]) => `<button type="button" class="pill${t.prio === k ? ' on' : ''}${k ? ' pp-' + k : ''}" data-act="tk-prio" data-v="${k}" aria-pressed="${t.prio === k}">${l}</button>`).join('')}</div>
      <p class="muted small">${Object.keys(pm).length === 3 ? 'Saved in Trello as the red, orange or green label, so it shows there too.' : 'This board has no free priority labels, so the priority is kept in Afloat only.'}</p></div>
    ${(() => { const ppl = others(b), cur = handed().find(v => v.cardId === t.id), inT = othersOn(c);
      return `<div><p class="small muted">Who’s on it</p>${ppl.length || cur ? `<div class="pills">${[[meIdT(), 'Me'], ...ppl.map(m => [m.id, m.fullName.split(' ')[0]]), ...(cur && !ppl.some(m => m.id === cur.toId) && cur.toId !== meIdT() ? [[cur.toId, cur.toName]] : [])].map(([id, l]) => `<button type="button" class="pill${t.who === id ? ' on' : ''}" data-act="tk-who" data-v="${esc(id)}" aria-pressed="${t.who === id}">${esc(l)}</button>`).join('')}</div>
        <p class="muted small">${t.who && t.who !== meIdT() ? 'They get an @mention on the card, so Trello notifies them, and it shows under Waiting on others for you and Handed to you for them.' : 'Pick someone to hand it over.'}${inT.length ? ` On the card in Trello: ${esc(inT.join(', '))}.` : ''}</p>`
        : `<p class="muted small">Only you are on ${esc(b ? b.name : 'this board')}. Invite people to the board in Trello to hand tasks over.</p>`}</div>`; })()}
    <textarea id="tkDesc" data-tk="desc" rows="3" placeholder="Notes" aria-label="Notes">${esc(t.desc)}</textarea>
    <div class="tk-cl"><p class="small muted">Checklist</p>${cls === null ? '<p class="muted small">Loading…</p>' : `${cls.map(cl => `${cls.length > 1 ? `<h3>${esc(cl.name)}</h3>` : ''}<ul class="checks">${cl.items.map(i => `<li><button class="check${i.done ? ' on' : ''}" data-act="tk-item" data-cl="${esc(cl.id)}" data-id="${esc(i.id)}" aria-pressed="${i.done}"><span class="box" aria-hidden="true">${I.check}</span><span class="txt">${esc(i.name)}</span></button></li>`).join('')}</ul>`).join('')}
      <div class="addform"><input type="text" id="tkNewItem" placeholder="Add a step" aria-label="Add a checklist step"><button class="btn ghost" type="button" data-act="tk-additem">Add</button></div>`}</div>
    <div class="tk-cal"><label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="tkCal" data-tk="cal" ${t.cal ? 'checked' : ''} ${t.due ? '' : 'disabled'}> Put it in the calendar</label>
      ${!t.due ? '<p class="muted small">Give it a due date first.</p>' : t.cal ? `<div class="pills">${[['family', 'Family calendar'], ['mine', 'My own calendar']].filter(([k]) => k !== 'family' || calCfg().calId).map(([k, l]) => `<button type="button" class="pill${t.where === k ? ' on' : ''}" data-act="tk-where" data-v="${k}" ${link ? 'disabled' : ''}>${l}</button>`).join('')}</div>
        ${t.time ? `<label class="small">Block <select data-tk="mins" id="tkMins">${[15, 30, 45, 60, 90, 120].map(m => `<option value="${m}" ${+t.mins === m ? 'selected' : ''}>${m < 60 ? m + ' min' : m / 60 + ' h'}</option>`).join('')}</select></label>` : '<p class="muted small">No time set, so it goes in as an all-day item.</p>'}
        <p class="muted small">${link ? 'Linked: moving it in the calendar changes the due date in Trello, and the other way round. Ticking the task off marks it ✓ in the calendar.' : 'Afloat keeps the calendar and Trello in step from now on.'}</p>` : ''}</div>
    <div class="actions"><button class="btn accent" data-act="task-save" ${t.busy ? 'disabled' : ''}>${t.busy ? 'Saving…' : 'Save'}</button><button class="btn ghost" data-act="task-done">Mark done</button>${c.url || c.webUrl ? `<a class="link" href="${esc(c.url || c.webUrl)}" target="_blank" rel="noopener">Open in Trello</a>` : ''}</div>
  </div></div>`;
}
async function taskSave() {
  const t = S.ui.task, c = (S.trello.cards || []).find(x => x.id === t.id); if (!c || t.busy) return;
  if (!String(t.name).trim()) return toast('A task needs a title.');
  t.busy = true; render(true);
  try {
    const upd = {}, due = t.due ? dueISO(t.due, t.time) : null;
    if (t.name.trim() !== c.name) upd.name = t.name.trim();
    if ((t.desc || '') !== (c.desc || '')) upd.desc = t.desc || '';
    if (due && !sameT(due, c.due)) upd.due = due;
    if (Object.keys(upd).length) { await trCall('trelloWriteCard', { action: 'update', cardId: c.id, ...upd }); Object.assign(c, upd); }
    const fromB = cardBoard(c);
    if (t.dest !== c.list.id) {
      const toB = tbListBoard(t.dest), l = tbList(t.dest);
      await trCall('trelloWriteCard', { action: 'move', cardId: c.id, listId: t.dest, ...(toB && fromB && toB.id !== fromB.id ? { boardId: toB.id } : {}) });
      c.list = { id: t.dest, name: l ? l.name : '' }; if (toB) c.board = { id: toB.id, name: toB.name };
      if (toB && fromB && toB.id !== fromB.id) c.labels = [];
    }
    const hOld = handed().find(v => v.cardId === c.id), curWho = hOld ? hOld.toId : meIdT();
    if (t.who && t.who !== curWho) {
      if (t.who === meIdT()) { if (hOld) await saveTasks({ handed: { [hOld.k]: null } }); }
      else { const pr = others(cardBoard(c)).find(m => m.id === t.who); if (pr) await handOver(c, pr, c.due); }
    }
    const pOld = prioOf(c), pm = prioLabels(cardBoard(c));
    if (t.prio !== pOld) {
      const ids = (c.labels || []).map(l => l.id);
      for (const [k] of PRIO) if (k !== t.prio && pm[k] && ids.includes(pm[k])) { await trCall('trelloWriteCard', { action: 'detach_label', cardId: c.id, labelId: pm[k] }); c.labels = c.labels.filter(l => l.id !== pm[k]); }
      if (t.prio && pm[t.prio]) { await trCall('trelloWriteCard', { action: 'attach_label', cardId: c.id, labelId: pm[t.prio] }); c.labels = [...(c.labels || []), { id: pm[t.prio] }]; saveTasks({ prio: { [tkey(c.id)]: null } }); }
      else saveTasks({ prio: { [tkey(c.id)]: t.prio || null } });
    }
    const link = calLinkOf(c.id);
    if (t.cal && c.due && !link) await calLinkCreate(c, t.where, +t.mins || 30, !t.time);
    else if (!t.cal && link) await calLinkRemove(link);
    else if (link && (upd.due || upd.name || +t.mins !== +link.mins || !t.time !== !!link.allDay)) {
      await mcp.callTool(GC, 'update_event', { ...(link.calId ? { calendarId: link.calId } : {}), eventId: link.gId, ...evTimes(c.due, !t.time, +t.mins || 30), summary: evSummary(c.name, link.calId), notificationLevel: 'NONE' }, { cache: false });
      await saveTasks({ cal: { [link.k]: { ...linkData(link), due: c.due, name: c.name, mins: +t.mins || 30, allDay: !t.time } } });
    }
    S.ui.task = null; toast('Saved to Trello.'); render(true); trLoad();
  } catch (e) { t.busy = false; toast(trMsg(e)); render(true); }
}
function taskAct2(a, el) {
  const t = S.ui.task;
  switch (a) {
    case 'task-open': taskOpen(el.dataset.id); return true;
    case 'task-close': S.ui.task = null; render(true); return true;
    case 'task-save': taskSave(); return true;
    case 'task-done': if (t) { const id = t.id; S.ui.task = null; trDone(id); } return true;
    case 'tpick': if (t) t.pick = true; render(true); return true;
    case 'tpick-close': if (t) t.pick = false; render(true); return true;
    case 'tpick-set': if (t) { t.dest = el.dataset.id; t.pick = false; if (t.who !== meIdT() && !others(tbListBoard(t.dest)).some(m => m.id === t.who)) t.who = meIdT(); } render(true); return true;
    case 'tk-prio': if (t) t.prio = el.dataset.v; render(true); return true;
    case 'tk-who': if (t) t.who = el.dataset.v; render(true); return true;
    case 'tk-where': if (t) t.where = el.dataset.v; render(true); return true;
    case 'tk-item': { if (!t || !t.cls) return true; const cl = t.cls.find(x => x.id === el.dataset.cl), it = cl && cl.items.find(x => x.id === el.dataset.id); if (!it) return true;
      it.done = !it.done; render(true);
      trCall('trelloWriteChecklist', { action: 'update_item', checklistId: cl.id, itemId: it.id, checked: it.done }).then(() => { const c = (S.trello.cards || []).find(x => x.id === t.id); if (c) c.checklists = t.cls.map(x => ({ ...x, items: x.items.map(i => ({ ...i, state: i.done ? 'complete' : 'incomplete' })) })); }).catch(e => { it.done = !it.done; toast(trMsg(e)); render(true); }); return true; }
    case 'tk-additem': { const inp = document.getElementById('tkNewItem'), text = String((inp && inp.value) || '').trim(); if (!t || !text) return true;
      (async () => { try {
        let cl = (t.cls || [])[0];
        if (!cl) { const p = await trCall('trelloWriteChecklist', { action: 'create', cardId: t.id, name: 'Checklist' }); cl = { id: p.id || (p.checklist && p.checklist.id), name: 'Checklist', items: [] }; t.cls = [cl]; }
        const p = await trCall('trelloWriteChecklist', { action: 'add_item', checklistId: cl.id, text, pos: 'bottom' });
        cl.items.push({ id: p.id || (p.checkItem && p.checkItem.id) || uid(), name: text, done: false }); render(true);
        setTimeout(() => { const i = document.getElementById('tkNewItem'); if (i) i.focus(); }, 0);
      } catch (e) { toast(trMsg(e)); } })(); return true; }
  }
  return false;
}
function taskInput2(el) {
  const f = el.dataset && el.dataset.tk, t = S.ui.task; if (!f || !t) return false;
  t[f] = el.type === 'checkbox' ? el.checked : el.value;
  if (f === 'due') { if (!el.value) { t.time = ''; t.cal = false; } render(true); }
  if (f === 'cal' || f === 'time') render(true);
  return true;
}

/* ---------- the open tasks ---------- */
/* whose is it? 'me': you're a member of the card, it's on your own list, it was handed to you, or the board is yours alone
   'other': someone else is on it, or it's on someone else's own list · 'shared': nobody's on it yet, on a board you share */
const meIdT = () => (S.tb.me || {}).id || '';
const assignees = c => (c.members || []).filter(m => m && m.id);
const onCard = c => !!meIdT() && assignees(c).some(m => m.id === meIdT());
function owner(c) {
  const ppl = H('trello').people || {}, h = handed().find(v => v.cardId === c.id);
  if (h && h.toId) return h.toId === meIdT() ? 'me' : 'other';
  if (onCard(c) || c.list.id === ppl[me]) return 'me';
  if (assignees(c).length || Object.entries(ppl).some(([n, id]) => n !== me && id === c.list.id)) return 'other';
  const b = tbBoard((c.board || {}).id) || tbListBoard(c.list.id);
  return b && b.members.length && !others(b).length ? 'me' : 'shared';
}
const othersOn = c => assignees(c).filter(m => m.id !== meIdT()).map(m => String(m.fullName || '').split(' ')[0] || 'someone');
function taskCards() {
  return (S.trello.cards || []).filter(c => {
    if (!c.list || c.closed || c.complete || c.dueComplete && c.due) return false;
    const l = tbList(c.list.id) || c.list;
    if (isShopList(c.list.id) || isDoneList(l.name)) return false;
    const explicit = ((TD().show || {})[me] || {})[tkey(l.id)];
    return listShown(l) || !!c.due || (onCard(c) && explicit !== false); /* a card you're on counts, unless you switched its list off */
  });
}
const byDue = (a, b) => (a.due ? Date.parse(a.due) : 9e15) - (b.due ? Date.parse(b.due) : 9e15);
function taskRow(x, opt = {}) {
  const b = (x.board && x.board.name) || (tbListBoard(x.list.id) || {}).name || '', h = handed().find(v => v.cardId === x.id), late = x.due && dayDiff(x.due) < 0;
  const who = h && opt.who !== false ? (h.toId === (S.tb.me || {}).id ? 'from ' + esc(h.byName || h.by) : 'with ' + esc(h.toName)) : othersOn(x).length ? (onCard(x) ? 'with ' : '') + esc(othersOn(x).join(', ')) : '';
  const bits = [opt.noList ? '' : esc(b ? b + ' › ' : '') + esc(x.list.name || ''), x.due ? `<span class="${late ? 'late' : ''}">${esc(dueLabel(x.due))}</span>` : '', calLinkOf(x.id) ? '📅' : '', who].filter(Boolean);
  return `<li class="trow" data-sw-r=".tick" data-sw-l="@tr-tomorrow" data-sw-r-label="✓ Done" data-sw-l-label="Tomorrow →" data-sw-id="${esc(x.id)}"><button class="check tick" data-act="tr-done" data-id="${esc(x.id)}" aria-label="Mark done: ${esc(x.name)}"><span class="box" aria-hidden="true">${I.check}</span></button><button class="trow-t" data-act="task-open" data-id="${esc(x.id)}" aria-label="Edit: ${esc(x.name)}"><span class="txt">${esc(x.name)}${prioTag(x)}<span class="def">${bits.join(' · ')}${clCount(x)}</span></span>${opt.tag ? `<span class="tag-list">${esc(opt.tag)}</span>` : ''}</button></li>`;
}
function vTasks() {
  const mode = hMode(), ok = !!mcp, all = taskCards().sort(byDue), meId = (S.tb.me || {}).id;
  const view = S.ui.tView || lsGet('afloat.tview') || 'mine', mineAll = all.filter(c => owner(c) === 'me');
  const cards = view === 'mine' ? mineAll : all, shared = view === 'mine' ? all.filter(c => owner(c) === 'shared') : [];
  let h = `<section class="hero"><p class="eyebrow">Across your Trello boards</p><h1>Tasks</h1></section>`;
  if (!ok) return h + '<p class="note">Trello isn’t connected for you yet. Connect it in Settings → Connections.</p>';
  h += `<div class="actions"><button class="btn accent" data-act="capture">+ Add or dump</button><button class="link" data-act="tasks-refresh">${S.trello.status === 'loading' || S.tb.status === 'loading' ? 'Checking…' : 'Refresh'}</button></div>`;
  if (S.trello.status === 'error') h += `<p class="note">${esc(trMsg(S.trello.err))}${S.trello.cards.length ? ' Showing what loaded last.' : ''}${trFix(S.trello.err)}</p>`;
  h += `<div class="seg tview" role="tablist" aria-label="Whose tasks">${[['mine', 'Mine', mineAll.length], ['all', 'Everything', all.length]].map(([v, l, n]) => `<button role="tab" aria-selected="${view === v}" class="${view === v ? 'on' : ''}" data-act="tview" data-v="${v}">${l} <span class="muted">${n}</span></button>`).join('')}</div>
    <p class="muted small">${view === 'mine' ? 'Cards you’re on, your own list, anything handed to you, and everything on boards only you use.' : 'Every open task on your boards, including other people’s. Names show who’s on it.'}</p>
    <p class="swipe-hint"><span>Swipe a task right → <b>done</b></span><span>← left: <b>due tomorrow</b></span><span>Tap it to edit</span></p>`;
  const ib = inbox();
  if (ib.length) h += `<section class="card inbox-card"><div class="sec-head"><h2>Inbox</h2><button class="tiny" data-act="inbox-sort">Sort ${ib.length === 1 ? 'it' : 'them'}</button></div><p class="muted small">Unsorted, held here so you don’t have to hold them.</p><ul class="chips">${ib.map(x => `<li class="chip">${esc(x.text)}<button class="x" data-act="inbox-x" data-id="${esc(x.id)}" aria-label="Remove ${esc(x.text)}">✕</button></li>`).join('')}</ul></section>`;
  const toMe = handed().filter(v => v.toId && v.toId === meId).map(v => cards.find(c => c.id === v.cardId)).filter(Boolean);
  const mine = handed().filter(v => v.by === me && v.toId !== meId);
  const rest = cards.filter(c => !toMe.includes(c) && !mine.some(v => v.cardId === c.id));
  const grp = mode === 'survival' ? 'date' : (S.ui.tGroup || lsGet('afloat.tgroup') || 'list');
  const over = rest.filter(c => c.due && dayDiff(c.due) < 0).sort(byPrio), today = rest.filter(c => c.due && dayDiff(c.due) === 0).sort(byPrio);
  const week = rest.filter(c => c.due && dayDiff(c.due) > 0 && dayDiff(c.due) <= 7), later = rest.filter(c => !c.due || dayDiff(c.due) > 7);
  /* anything whose date has passed: folded, counted, never "overdue"; one tap spreads it over the next days or lets it go */
  const before = list => list.length ? `<section class="card from-before"><details class="tgroup"${COL['t-before'] ? ' open' : ''} data-grp="t-before"><summary><b>From before</b> <span class="muted small">${list.length}</span></summary>
    <p class="muted small">Their dates have passed. That’s fine: nothing here is late. Do one if it still matters, or let the rest go.</p>
    <div class="actions"><button class="btn ghost small" data-act="before-spread">Spread over the next days</button><button class="link" data-act="before-letgo">Let them all go</button></div>
    <ul class="tr-list">${list.map(x => taskRow(x)).join('')}</ul></details></section>` : '';
  const sec = (title, list, extra = '', opt = {}) => list.length ? `<section class="card"><div class="sec-head"><h2>${title}</h2><span class="progress">${list.length}</span></div>${extra}<ul class="tr-list">${list.map(x => taskRow(x, opt)).join('')}</ul></section>` : '';
  if (mode === 'survival') h += '<p class="note">Survival mode: only what’s due today. Everything else, including anything from before, is held for you.</p>';
  else h += `<div class="seg tview" role="tablist" aria-label="Group tasks">${[['list', 'By list'], ['date', 'By date']].map(([v, l]) => `<button role="tab" aria-selected="${grp === v}" class="${grp === v ? 'on' : ''}" data-act="tgroup" data-v="${v}">${l}</button>`).join('')}</div>`;
  if (S.trello.status !== 'ok' && !cards.length && S.trello.status !== 'error') h += '<p class="empty">Checking your boards…</p>';
  h += sec('Handed to you', toMe);
  if (grp === 'list') {
    const now = [...over, ...today];
    h += sec('Today', today, '<p class="muted small">Due today, from every list.</p>') + before(over);
    const restL = rest.filter(c => !now.includes(c)), order = [];
    for (const b of tbBoards()) for (const l of b.lists) order.push([b, l]);
    const seen = new Set();
    for (const [b, l] of order) { const its = restL.filter(c => c.list.id === l.id).sort(byPrio); if (!its.length) continue; its.forEach(c => seen.add(c));
      h += `<section class="card tlist"><div class="sec-head"><div><p class="eyebrow">${esc(b.ws)} · ${esc(b.name)}</p><h2>${esc(l.name)}</h2></div><span class="progress">${its.length}</span></div><ul class="tr-list">${its.map(x => taskRow(x, { noList: true })).join('')}</ul></section>`; }
    const stray = restL.filter(c => !seen.has(c)); if (stray.length) h += sec('Other lists', stray.sort(byPrio));
  } else {
    h += sec('Today', today) + before(over);
  }
  if (mode !== 'survival') {
    if (grp === 'date') {
    h += sec('This week', week.sort((a, b) => byDue(a, b) || byPrio(a, b)));
    const groups = tbBoards().map(b => [b, later.filter(c => (c.board && c.board.id === b.id) || b.lists.some(l => l.id === c.list.id)).sort(byPrio)]).filter(g => g[1].length);
    if (groups.length) h += `<section class="card"><div class="sec-head"><h2>Later</h2><span class="progress">${later.length}</span></div>${groups.map(([b, l]) => `<details class="tgroup"${COL['tg-' + tkey(b.id)] ? ' open' : ''} data-grp="${esc('tg-' + tkey(b.id))}"><summary><b>${esc(b.name)}</b> <span class="muted small">${esc(b.ws)} · ${l.length}</span></summary><ul class="tr-list">${l.map(x => taskRow(x)).join('')}</ul></details>`).join('')}</section>`;
    }
    if (S.trello.status === 'ok' && !cards.length) h += `<p class="empty">${view === 'mine' ? 'Nothing open that’s yours. That counts as a good day.' : 'Nothing open on your task lists. That counts as a good day.'}</p>`;
    if (shared.length) h += `<section class="card"><details class="tgroup"${COL['t-shared'] ? ' open' : ''} data-grp="t-shared"><summary><b>Shared, nobody’s on it yet</b> <span class="muted small">${shared.length}</span></summary>
      <p class="muted small">Open cards on boards you share where nobody has joined the card. Anyone can tick them off.</p><ul class="tr-list">${shared.map(x => taskRow(x)).join('')}</ul></details></section>`;
  }
  if (mine.length) {
    const loaded = S.trello.status === 'ok';
    h += `<section class="card"><div class="sec-head"><h2>Waiting on others</h2><span class="progress">${mine.length}</span></div><p class="muted small">Handed over from Afloat. They got an @mention on the card in Trello.</p><ul class="tr-list">${mine.map(v => {
      const c = (S.trello.cards || []).find(x => x.id === v.cardId), open = c && !c.complete && !c.closed;
      const inner = `<span class="txt">${esc(v.name)}<span class="def">${esc(v.toName)} · ${esc(v.boardName || '')}${v.due ? ' · ' + esc(dueLabel(v.due)) : ''}${!open && loaded ? ' · <b class="okd">done</b>' : ''}</span></span>`;
      return `<li class="wait"${!open && loaded ? ' data-sw-l="[data-act=handed-clear]"' : ''}>${open ? `<button class="trow-t" data-act="task-open" data-id="${esc(c.id)}" aria-label="Edit: ${esc(v.name)}">${inner}</button>` : inner}${v.url ? `<a class="tiny" href="${esc(v.url)}" target="_blank" rel="noopener">Open</a>` : ''}${!open && loaded ? `<button class="tiny" data-act="handed-clear" data-k="${esc(v.k)}">Clear</button>` : ''}</li>`; }).join('')}</ul></section>`;
  }
  h += `<section class="card"><details${COL['tasks-lists'] ? ' open' : ''} data-grp="tasks-lists"><summary><b>Which lists count as tasks</b></summary>
    <p class="muted small">Cards with a due date always show. Reference lists, like characters or inspiration, can stay off. Only you see your choice.</p>
    ${tbBoards().map(b => `<div class="floorpick"><span class="eyebrow">${esc(b.ws)} · ${esc(b.name)}</span><div class="pills">${b.lists.map(l => { const on = listShown(l); return `<button class="pill${on ? ' on' : ''}" data-act="list-show" data-id="${esc(l.id)}" aria-pressed="${on}">${esc(l.name)}</button>`; }).join('')}</div></div>`).join('') || '<p class="empty">Your boards haven’t loaded yet.</p>'}
    <div class="actions"><button class="link" data-act="tb-refresh">${S.tb.status === 'loading' ? 'Reading your boards…' : 'Re-read boards and lists from Trello'}</button></div></details></section>`;
  h += `<section class="card trello-go"><a class="btn big" href="https://trello.com/" target="_blank" rel="noopener">Open Trello ↗</a>
    ${tbBoards().some(b => b.url) ? `<div class="pills">${tbBoards().filter(b => b.url).map(b => `<a class="pill" href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.name)}</a>`).join('')}</div>` : ''}</section>`;
  return h;
}
/* Today: only to-dos with a near due date (today and the next two days); the whole list lives in Tasks. Nothing near → no card. */
const NEAR_DAYS = 2;
function trSectionAll() {
  if (!mcp) return '';
  const mode = hMode(), all = taskCards().sort(byDue);
  const past = all.filter(x => x.due && dayDiff(x.due) < 0 && owner(x) !== 'other');
  const show = all.filter(x => x.due && dayDiff(x.due) >= 0 && dayDiff(x.due) <= (mode === 'survival' ? 0 : NEAR_DAYS) && owner(x) !== 'other').slice(0, mode === 'survival' ? 5 : 6);
  const label = x => x.list.id === (((H('trello').people || {})[me])) ? 'Yours' : x.list.id === trL().chores ? 'Chores' : x.list.id === trL().home ? 'Household' : ((x.board && x.board.name) || (tbListBoard(x.list.id) || {}).name || '');
  const more = all.length - show.length - past.length;
  const err = S.trello.status === 'error' ? `<p class="note">${esc(trMsg(S.trello.err))}${trFix(S.trello.err)}</p>` : '';
  if (!show.length) return err && !all.length ? `<section class="card"><div class="sec-head"><h2>To-dos</h2><button class="link" data-act="tr-refresh">Refresh</button></div>${err}</section>` : '';
  return `<section class="card"><div class="sec-head"><h2>Due soon</h2><button class="link" data-act="tr-refresh">${S.trello.status === 'loading' ? 'Checking…' : 'Refresh'}</button></div>
    ${S.trello.status === 'error' ? `<p class="muted small">${esc(trMsg(S.trello.err))} Showing what loaded last.</p>` : ''}<ul class="tr-list">${show.map(x => taskRow(x, { tag: label(x) })).join('')}</ul>
    <div class="actions"><button class="tiny" data-act="capture">+ Brain dump</button><a class="link" href="#tasks">All tasks${more > 0 ? ` (${more} more)` : ''}</a>${past.length ? `<span class="muted small">${past.length} from before, folded in Tasks</span>` : ''}</div></section>`;
}
/* ---------- From before: spread over the next days, let them go ---------- */
/* "From before" in Tasks: spread the cards over the next days (one or two a day, weekends lighter), or archive them all */
async function beforeSpread() {
  const over = taskCards().filter(c => c.due && dayDiff(c.due) < 0 && owner(c) !== 'other').sort(byPrio); if (!over.length || !mcp) return;
  let day = 1, n = 0; const plan = [];
  for (const c of over) { const d = new Date(dk + 'T09:00:00'); d.setDate(d.getDate() + day); const we = d.getDay() === 0 || d.getDay() === 6;
    plan.push([c, d.toISOString()]); n++; if (n >= (we ? 1 : 2)) { day++; n = 0; } }
  for (const [c, due] of plan) c.due = due; render(true);
  let bad = 0; for (const [c, due] of plan) { try { await trCall('trelloWriteCard', { action: 'update', cardId: c.id, due }); } catch (e) { bad++; } }
  toast(bad ? `${plan.length - bad} moved; ${bad} couldn’t be changed on Trello.` : `Spread over the next ${day} days, a couple at a time.`); trLoad();
}
async function beforeLetGo() {
  const over = taskCards().filter(c => c.due && dayDiff(c.due) < 0 && owner(c) !== 'other'); if (!over.length || !mcp) return;
  if (!confirm(`Archive ${over.length} task${over.length === 1 ? '' : 's'} from before on Trello? You can bring any back from Trello’s archive.`)) return;
  S.trello = { ...S.trello, cards: S.trello.cards.filter(c => !over.includes(c)) }; render(true);
  let bad = 0; for (const c of over) { try { await trCall('trelloWriteCard', { action: 'archive', cardId: c.id }); } catch (e) { bad++; } }
  toast(bad ? `${over.length - bad} let go; ${bad} couldn’t be archived.` : 'Let go. A lighter list.'); trLoad();
}
/* ---------- taps on this area's buttons (data-act), called from events.js; true = handled ---------- */
function tapTasks(a, el, e, r) {
  switch (a) {
    case 'capture': S.ui.capture = true; S.ui.cap = null; S.ui.settings = false; render(true); setTimeout(() => { const t = $('#dumpText'); if (t) t.focus(); }, 0); return true;
    case 'tr-done': trDone(el.dataset.id); return true;
    case 'before-spread': beforeSpread(); return true;
    case 'before-letgo': beforeLetGo(); return true;
    case 'tr-refresh': trLoad(); return true;
  }
  return false;
}
