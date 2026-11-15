/* Afloat · app/briefing.js · The briefing sheet and its cards: what matters now, in the order it matters.
   Plain script: shares one scope with the other app/*.js files (loaded in order by index.html). See CLAUDE.md. */
/* ---------- the briefing: what matters now, in the order it matters ----------
   Modelled on visual-planner apps: a "now / next" card with a countdown, the leave-home list only
   in the window before you leave, one colour-coded timeline, then only what needs you. */
const mm2t = m => `${pad(Math.floor(((m % 1440) + 1440) % 1440 / 60))}:${pad(((m % 60) + 60) % 60)}`;
const inMins = m => m <= 0 ? 'now' : m < 60 ? `in ${m} min` : `in ${Math.floor(m / 60)} h${m % 60 ? ' ' + (m % 60) + ' min' : ''}`;
const planTitle = p => String(p.title || '').split(' · ')[0].toLowerCase();
const mineOn = k => S.planMine.status === 'ok' ? (S.planMine.events || []).filter(e => e.date <= k && (e.endDate || e.date) >= k) : [];
/* your day: household events you're in, your own calendar, invitations and anything planned last night */
function dayRows(k) {
  const pk = k === dk ? 'today' : 'next', pev = planOf(pk, me).events || [];
  const base = eventsOn(k).filter(e => !(e.who || []).length || (e.who || []).includes(me) || e.isDate || e.src === 'mine' || e.src === 'invite');
  const extra = mineOn(k).filter(e => !base.some(x => (x.gId && x.gId === e.gId) || (shortTitle(x.title) === e.title && (x.start || '') === (e.start || ''))));
  const rows = [...base, ...extra].map(e => {
    const st = e.allDay ? 0 : e.date === k ? toMin(e.start || '00:00') : 0, en0 = e.allDay ? 1440 : (e.endDate || e.date) === k ? toMin(e.end || e.start || '23:59') : 1440;
    const pe = pev.find(p => p.time && p.travel != null && planTitle(p) === shortTitle(e.title).toLowerCase());
    return { e, title: shortTitle(e.title), allDay: !!e.allDay, s: st, en: en0 <= st ? Math.max(st + 30, 1440) : en0, who: whoStr(e), place: e.place || '', leave: pe ? leaveBy(pe) : '', planned: pev.some(p => planTitle(p) === shortTitle(e.title).toLowerCase()) };
  });
  for (const p of pev) if (p.time && !rows.some(r => r.title.toLowerCase() === planTitle(p))) rows.push({ e: p, title: p.title, allDay: false, s: toMin(p.time), en: toMin(p.time) + 60, who: '', place: '', leave: p.travel != null ? leaveBy(p) : '', plan: true, planned: true });
  for (const [key, sv] of Object.entries(H('sched'))) if (sv && sv.date === k && sv.at && (!sv.who || sv.who === me || sv.who === 'both')) {
    const j = rjFind(key); if (!j || (k === dk && rjDone(j))) continue;
    rows.push({ e: { id: 'job-' + key }, title: j.text, allDay: false, s: toMin(sv.at), en: toMin(sv.at) + Math.max(10, +j.min || 15), who: sv.who === 'both' ? 'together' : '', place: '', leave: '', job: true }); }
  return rows.sort((a, b) => (a.allDay ? -1 : a.s) - (b.allDay ? -1 : b.s));
}
const rowHex = r => r.job ? 'var(--sea)' : r.plan ? 'var(--amber)' : r.e.src === 'mine' ? 'var(--muted)' : (GCOL[evColor(r.e)] || GCOL[8])[1];
const rowTag = r => r.job ? 'House job' : r.e.src === 'mine' ? 'Your calendar' : r.e.src === 'invite' ? (r.e.rsvp === 'needsAction' ? 'Invitation, not answered' : 'Invitation') : r.plan ? 'Planned' : '';
const mapA = place => place ? `<a class="tl-map" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}" target="_blank" rel="noopener" aria-label="Open ${esc(place)} in Google Maps">📍 ${esc(place)}</a>` : '';
/* one colour-coded timeline; today's past events fade and a line marks now */
function timeline(rows, k, o = {}) {
  const isT = k === dk, nm = nowMin();
  let list = rows, hidden = 0;
  if (o.rest && isT) { list = rows.filter(r => r.allDay || r.en > nm); hidden = rows.length - list.length; }
  if (!list.length) return o.empty ? `<p class="empty">${o.empty}</p>` : '';
  const btn = r => !o.plan || r.plan || r.job ? '' : r.planned ? '<span class="muted small tl-ok">✓ in a project</span>' : `<button class="tiny" data-act="plan-from-ev" data-id="${esc(r.e.id || '')}" data-g="${esc(r.e.gId || '')}">Get me ready</button>`;
  const li = r => { const past = isT && !r.allDay && r.en <= nm, now = isT && !r.allDay && r.s <= nm && r.en > nm;
    const meta = [r.who && esc(r.who), rowTag(r), r.leave ? `leave by <b>${r.leave}</b>` : ''].filter(Boolean).join(' · ');
    return `<li class="tl-row${past ? ' past' : ''}${now ? ' now' : ''}"><span class="tl-t">${r.allDay ? 'All day' : `${mm2t(r.s)}<small>${r.en >= 1440 ? '…' : mm2t(r.en)}</small>`}</span><span class="tl-bar" style="background:${rowHex(r)}"></span><span class="tl-x"><b>${esc(r.title)}</b>${meta ? `<small>${meta}</small>` : ''}${o.maps !== false ? mapA(r.place) : ''}</span>${btn(r)}</li>`; };
  let h = '', marked = !isT || o.noNow;
  for (const r of list) { if (!marked && !r.allDay && r.s > nm) { h += `<li class="tl-nowline" aria-label="Now"><span>${mm2t(nm)}</span></li>`; marked = true; } h += li(r); }
  if (!marked && list.some(r => !r.allDay)) h += `<li class="tl-nowline" aria-label="Now"><span>${mm2t(nm)}</span></li>`;
  return `${hidden ? `<p class="muted small">${hidden} earlier today, done.</p>` : ''}<ol class="tl">${h}</ol>`;
}
/* when you leave home today, and whether the launch list belongs on screen right now */
function leaveInfo() {
  if (!meValid()) return null;
  const out = leavesHome(me, dk), LL = out ? fits(prof(me).launch, dk) : [], PX = planOf('today', me).launch || [], nm = nowMin();
  const c = [];
  if (out && prof(me).leave) c.push({ t: prof(me).leave, why: girlsAt(dk) === 'kinder' && meAt(me, dk) !== 'out' ? 'Kindergarten drop-off' : 'Off to work' });
  for (const p of planOf('today', me).events || []) if (p.time && p.travel != null) c.push({ t: leaveBy(p), why: p.title });
  const cs = c.map(x => ({ ...x, m: toMin(x.t) })).sort((a, b) => a.m - b.m), next = cs.find(x => x.m >= nm - 10) || null;
  const items = LL.length + PX.length;
  /* from 75 minutes before you leave until 10 minutes after; with no time known, the morning */
  const show = items > 0 && (cs.length ? !!next && nm >= next.m - 75 && nm <= next.m + 10 : slot() === 'morning');
  const open = LL.filter(x => !isDone((S.day.done || {})[pPre(me, 'launch') + ':' + x.id])).length + PX.filter(x => !isDone((S.day.done || {})[`pl:${me}:${x.id}`])).length;
  return { LL, PX, next, show, open, items };
}
function launchCard(li) {
  if (!li || !li.show) return '';
  const nm = nowMin(), n = li.next;
  return doneFold('bf-launch', 'Before you leave', li.items - li.open, li.items, `<section class="card launch bf-launch"><div class="sec-head"><h3>Before you leave</h3><span class="progress">${li.items - li.open} of ${li.items}</span></div>
    ${n ? `<p class="small"><b>${n.m - nm > 0 ? `Out the door ${inMins(n.m - nm)}` : 'Time to go'}</b> <span class="muted">· ${n.t} · ${esc(n.why)}</span></p>` : ''}
    ${li.LL.length ? checklist(pPre(me, 'launch'), li.LL) : ''}${li.PX.length ? checklist(`pl:${me}`, li.PX) : ''}
    ${li.open ? '' : '<p class="alldone">Everything’s with you.</p>'}</section>`);
}
/* the big "now / next" card */
function nextCard(rows, li) {
  const nm = nowMin(), tm = rows.filter(r => !r.allDay), now = nowRows(tm, nm), next = tm.find(r => r.s > nm && mineRow(r));
  const lv = li && !li.show && li.next && li.next.m - nm <= 180 && li.next.m - nm >= -10 && !now.length ? li.next : null;
  if (!now.length && !next && !lv) return '';
  const block = (lab, r, when) => `<div class="nx"><span class="eyebrow">${lab}</span><b class="nx-t">${esc(r.title)}</b><span class="nx-m">${when}${r.who ? ' · ' + esc(r.who) : ''}</span>${r.leave ? `<span class="nx-leave">Leave by <b>${r.leave}</b>${toMin(r.leave) > nm ? ' · ' + inMins(toMin(r.leave) - nm) : ''}</span>` : ''}${mapA(r.place)}</div>`;
  let h = '';
  if (lv) h += `<div class="nx nx-go"><span class="eyebrow">Leave home</span><b class="nx-t">${lv.m > nm ? inMins(lv.m - nm) : 'now'}</b><span class="nx-m">at ${lv.t} · ${esc(lv.why)}</span></div>`;
  for (const r of now.slice(0, 2)) h += block('Now', r, `until ${r.en >= 1440 ? 'late' : mm2t(r.en)}`);
  if (next) h += block('Next', next, `${mm2t(next.s)} · ${inMins(next.s - nm)}`);
  return `<section class="card bf-next">${h}</section>`;
}
/* things only you can answer, in one place */
function needsItems(sl) {
  const out = [], add = (t, act, warn) => out.push({ t, act, warn });
  if (sickOn()) { const next = (H('sick').meds || []).map(m => ({ m, st: medStatus(m) })).sort((a, b) => (a.st.ready ? 0 : a.st.due) - (b.st.ready ? 0 : b.st.due))[0];
    if (next) add(next.st.ready ? `${next.m.name}${next.m.kid ? ' for ' + next.m.kid : ''} can be given now.` : `Next ${next.m.name}${next.m.kid ? ' for ' + next.m.kid : ''} from ${fmtT(next.st.due)}.`, null, next.st.ready); }
  for (const f of dayFacts(dk).filter(f => f.warn)) add(f.t, f.act, true);
  const gs = upcomingGaps().filter(g => keyOf(new Date(g.s)) <= calAdd(realToday(), 14));
  if (gs.length) add(`Hlídání needed: ${fmtGap(gs[0])}${gs.length > 1 ? ` and ${gs.length - 1} more` : ''}. You’re both busy and nobody has the girls.`, 'go-cal', true);
  const inv = [...(S.gcal.inv || []), ...(S.gcal.gp || []).filter(x => x.rsvp)].filter(x => x.rsvp === 'needsAction' && x.date >= dk && x.date <= calAdd(dk, 14));
  if (inv.length) add(`${inv.length === 1 ? `${inv[0].from || 'Someone'} invited you to ${shortTitle(inv[0].title)}` : `${inv.length} invitations`}: not answered yet.`, 'go-cal');
  if (dk >= '2027-01-05' && dk <= '2027-02-02') add('Firebase’s free trial ends on 2 February. Upgrade to a normal billing account in the Firebase console (Usage and billing) so Afloat keeps running. Normal use stays free or close to it.', null, true);
  if (db && backupDue() && sl !== 'night') add('It’s been over a month since the last copy of Afloat’s data. Settings → Download a copy.', 'go-settings');
  if (S.trello.status === 'error' && mcp) add(`To-dos: ${trMsg(S.trello.err)}`, 'go-settings', true);
  const ib = mcp ? inbox().length : 0; if (ib && sl !== 'night') add(`${ib} idea${ib === 1 ? '' : 's'} in your brain dump, waiting to be sorted.`, 'bf-tasks');
  return out;
}
/* the overview's one line once you've checked in: the check-in itself is at the top of Self-care */
function tankLine() {
  const modes = S.day.modes || {}, ms = members().map(m => m.name); if (!me || !modes[me] || !ms.includes(me)) return '';
  const o = otherOf(me);
  return `<p class="small bf-tank"><b>Tank:</b> ${MODES[modes[me]].label}${o && modes[o] ? ` · ${esc(o)}: ${MODES[modes[o]].label}` : ''} <a class="link" href="#care">Change</a></p>`;
}
function energyRow() {
  const modes = S.day.modes || {}; if (!me || modes[me] || slot() === 'night' || slot() === 'evening' || sickOn()) return '';
  return `<div class="bf-energy"><span class="small"><b>How’s your tank today?</b> Today’s lists shrink to fit.</span><div class="mini-modes" role="radiogroup" aria-label="Your energy today">${Object.entries(MODES).map(([k, x]) => `<button class="mm" data-act="mode" data-who="${esc(me)}" data-m="${k}" role="radio" aria-checked="false"><i></i>${x.label}</button>`).join('')}</div></div>`;
}
const bfItem = l => `<li class="${l.warn ? 'warn' : ''}">${l.act ? `<button class="linkish" data-act="${l.act}"${l.act === 'water' ? ' data-d="1"' : ''}>${esc(l.t)}</button>` : esc(l.t)}</li>`;
function needsCard(sl) {
  const it = needsItems(sl), en = energyRow();
  if (!it.length && !en) return '';
  return `<section class="card bf-needs"><h3>Needs you</h3>${it.length ? `<ul class="bf-list">${it.map(bfItem).join('')}</ul>` : ''}${en}</section>`;
}
/* your to-dos due today or overdue */
function dueTasks(k) { return mcp && S.trello.status === 'ok' ? taskCards().filter(x => x.due && owner(x) !== 'other' && keyOf(new Date(x.due)) <= k).sort(byDue) : []; }
function tasksCard(k, title) {
  if (!modOn('tasks')) return '';
  const all = dueTasks(k), d = all.filter(x => keyOf(new Date(x.due)) === k), old = all.length - d.length;
  if (!d.length) return old ? `<section class="card bf-tasks"><p class="muted small">${old} task${old === 1 ? '' : 's'} from before, folded away in Tasks. Nothing is late. <button class="link" data-act="bf-tasks">Look</button></p></section>` : '';
  return `<section class="card bf-tasks"><div class="sec-head"><h3>${title}</h3><button class="link" data-act="bf-tasks">All tasks</button></div>
    <ul class="bf-trows">${d.slice(0, 4).map(x => `<li data-sw-r="@tr-done" data-sw-l="@tr-tomorrow" data-sw-r-label="✓ Done" data-sw-l-label="Tomorrow →" data-sw-id="${esc(x.id)}"><button class="bf-trow" data-act="task-open" data-id="${esc(x.id)}"><b>${esc(x.name)}</b><span class="${dayDiff(x.due) < 0 ? 'late' : 'muted'} small">${esc(dueLabel(x.due))}</span></button></li>`).join('')}</ul>
    ${d.length > 4 ? `<p class="muted small">and ${d.length - 4} more</p>` : ''}${old ? `<p class="muted small">${old} from before, folded away in Tasks.</p>` : ''}</section>`;
}
function goodToKnow(sl) {
  const out = [], add = (t, act) => out.push({ t, act }), other = otherOf(me), modes = S.day.modes || {}, d = dow(), R = H('rhythms'), L = H('lists');
  if (sickOn()) add('Sick-day mode is on. Fed, watered and resting is a good day.');
  if (!sickOn()) for (const l of relNudges(sl)) add(l.t, l.act);
  if (!sickOn()) for (const l of tripNudges(sl)) add(l.t, l.act);
  if ((sl === 'morning' || sl === 'day') && !sickOn()) for (const f of dayFacts(dk).filter(f => !f.warn)) add(f.t, f.act);
  if (other && modes[other]) add(`${other} is on ${MODES[modes[other]].label.toLowerCase()} today.`);
  if (sl === 'morning') { const om = fits(pOpen(me, 'morning'), dk); if (om.length) add(`Your morning: ${om.slice(0, 3).map(x => x.text).join('; ')}${om.length > 3 ? '…' : '.'}`, 'go-rhythms'); }
  if (sl !== 'night' && !sickOn()) { const bp = beatPlan(), todays = [...bp.base, ...bp.extras].filter(j => !rjDone(j)); if (todays.length) add(`Today’s beat: ${todays.slice(0, 2).map(x => x.text).join('; ')}${todays.length > 2 ? ` and ${todays.length - 2} more` : ''} (about ${todays.reduce((a, j) => a + (+j.min || 10), 0)} min).`, 'go-beat'); if ((H('lists').restockDay ?? 6) === dow() && (H('lists').restock || []).length && !rjDone({ kind: 'rs', id: 'run' })) add('Restock run today: the little refills, and anything running low goes onto Nákup - Drogerie.', 'go-beat'); }
  /* Meals → At home: one quiet line in the afternoon about food that needs using (5 Nov 2026) */
  if (!sickOn() && nowMin() >= 14 * 60 && nowMin() < 18 * 60 + 30) { mtLoad(); const soon = (S.mt.pantry || []).filter(x => x.useBy && x.useBy <= tk).sort((a, b) => a.useBy.localeCompare(b.useBy)).map(x => x.name);
    if (soon.length) add(`Use soon at home: ${soon.slice(0, 3).join(', ')}${soon.length > 3 ? ` and ${soon.length - 3} more` : ''}. Meals → At home has dinner ideas.`, 'go-meals'); }
  const g = careSlotGroup(), its = (L.care || []).filter(x => (x.group || 0) === g);
  if (me && its.length && sl !== 'night') { const open = its.filter(x => !isDone(careOf(me)[x.id])); if (open.length) add(`${CARE_GROUPS[g]}: ${open.slice(0, 3).map(x => x.text.charAt(0).toLowerCase() + x.text.slice(1)).join(', ')}${open.length > 3 ? '…' : '.'}`, 'go-care'); }
  const w = +careOf(me).water || 0, goal = waterGoal(), exp = Math.floor(Math.max(0, Math.min(1, (nowMin() - 480) / 720)) * goal);
  if (me && w < exp && sl !== 'night') add(`Water: ${w} of ${goal} glasses so far. Tap to add one.`, 'water');
  if (sl === 'night') add('It’s late. Phone away soon; whatever is left belongs to tomorrow-you.');
  return out;
}
/* evening: who does what tonight and how much is left */
function tonightCard() {
  const ev = evening(), out = [], add = (t, act) => out.push({ t, act });
  if (ev && ev.type === 'away') add(ev.who === me ? 'Tonight is your own time. Nothing here needs you once you head out.' : `Solo evening: ${ev.who} is out, so it’s you, the girls and the short closing list.`);
  else if (ev && ev.type === 'date') add('Date night tonight. Closing duties are optional.');
  else { const t = tagOf(), oo = othersOf(me), o = oo.join(' and '), many = oo.length > 1; if (meValid() && othersOutTonight(me) && eveAt(me, dk) === 'home') add(`${o} ${many ? 'are' : 'is'} ${!many && eveAt(o, dk) === 'night' ? 'away overnight' : 'out tonight'}, so ${kidsList().length ? 'bedtime is yours' : 'the evening is yours'}.`); else if (t.kids === me && kidsList().length) add(`You’re on bedtime with ${theKids()} tonight.`); else if (t.close === me) add('Closing duties are yours tonight, while bedtime happens.'); }
  if (kidsAwayOn(dk)) add('The girls are at grandma’s tonight: no bedtime shift.');
  let cl = '';
  if (!sickOn() && !(ev && ev.type === 'away' && ev.who === me) && !awayEvent()) { const { cl: c, pre } = closingSet(), left = c.filter(x => !isDone((S.day.done || {})[pre + ':' + x.id]));
    if (c.length) cl = `<div class="bf-meter"><div><b>Closing duties</b><span class="muted small">${left.length ? `${left.length} left · about ${minsLeft(pre, c)} min` : 'All done. Sit down.'}</span></div><span class="bar"><i style="width:${Math.round(100 * (c.length - left.length) / c.length)}%"></i></span>${left.length ? '<button class="btn" data-act="one">One at a time</button>' : ''}</div>`; }
  if (prepItems().length) { const oe = prepItems().filter(x => !isDone((S.day.done || {})[pPre(me, 'evening') + ':' + x.id])); if (oe.length) add(`Prep for tomorrow: ${oe.map(x => x.text).join('; ')}.`, 'go-rhythms'); }
  if (!out.length && !cl) return '';
  return `<section class="card bf-tonight"><h3>Tonight</h3>${out.length ? `<ul class="bf-list">${out.map(bfItem).join('')}</ul>` : ''}${cl}</section>`;
}
/* evening: a look at tomorrow, and whether it's planned */
function tomorrowCard() {
  if (!meValid()) return '';
  const label = new Date(tk + 'T12:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }), p = planOf('next', me);
  const facts = dayFacts(tk), rows = dayRows(tk), due = dueTasks(tk).filter(x => keyOf(new Date(x.due)) === tk);
  return `<section class="card bf-tmrw"><div class="sec-head"><h3>Tomorrow</h3><span class="progress">${label}</span></div>
    ${facts.length ? `<ul class="bf-list">${facts.map(f => bfItem({ t: f.t, warn: f.warn })).join('')}</ul>` : ''}
    ${wxToday(tk)}${timeline(rows, tk, { empty: 'Nothing in the calendar yet.', maps: false })}${prepOutingsCard(tk).replace('<section class="card prep-outs">', '<div class="prep-outs in-card">').replace(/<\/section>$/, '</div>')}
    ${due.length ? `<p class="small"><b>Due:</b> ${due.map(x => esc(x.name)).join('; ')}</p>` : ''}
    <div class="actions">${p.planned ? '<span class="alldone">Tomorrow is ready ★</span><button class="link" data-act="go-plan">See what’s ready</button>' : '<button class="btn accent" data-act="go-plan">Ready for tomorrow</button><span class="muted small">Two minutes now saves the morning.</span>'}</div></section>`;
}
function briefShape(rows) {
  const tm = rows.filter(r => !r.allDay), nm = nowMin(), left = tm.filter(r => r.en > nm), d = dueTasks(dk).length;
  const bits = [];
  const late = slot() === 'evening' || slot() === 'night';
  if (late && rows.length && !left.length) bits.push('Nothing left on today’s calendar');
  else if (late && !rows.length) bits.push('A quiet evening on the calendar');
  else if (rows.length) bits.push(`${rows.length} thing${rows.length === 1 ? '' : 's'} on today’s calendar${left.length && left.length < tm.length ? `, ${left.length} still to come` : ''}`);
  else bits.push('A clear calendar today');
  if (d) bits.push(`${d} to-do${d === 1 ? '' : 's'} due`);
  return bits.join(' · ') + '.';
}
function briefCard() {
  if (!me || !members().some(m => m.name === me)) return '';
  loadPlanMine();
  /* built fresh on every render, so it follows the calendar, the day's setup and ticks as they change; weather from Open-Meteo */
  const sl = slot(), late = sl === 'evening' || sl === 'night', rows = dayRows(dk), li = leaveInfo(), nx = nextCard(rows, li), tl = timeline(rows, dk, { rest: true }), gk = goodToKnow(sl).filter(l => l.act !== 'go-situ');
  const tm = late ? dayRows(tk).filter(r => !r.allDay || r.e.isDate || r.e.src === 'mine').slice(0, 3) : [], wx = sl === 'night' ? '' : wxToday(dk), wxT = late ? wxToday(tk) : '';
  if (!nx && !tl && !gk.length && !wx && !tm.length && !tankLine()) return '';
  return `<section class="card brief brief-${sl}"><div class="sec-head"><p class="eyebrow">Your ${SLOT_LABEL[sl].toLowerCase()} at a glance</p></div>
    ${tankLine()}${wx}${nx && !['leave', 'cal'].includes(S.ui.ntKind) ? nx.replace('<section class="card bf-next">', '<div class="bf-next in-card">').replace(/<\/section>$/, '</div>') : ''}
    ${tl}${gk.length ? `<ul class="bf-list">${gk.slice(0, 5).map(bfItem).join('')}</ul>` : ''}
    ${late && (tm.length || wxT) ? `<div class="bf-tm"><p class="small"><b>Tomorrow</b>${tm.length ? `: ${tm.map(r => `${r.allDay ? '' : esc(mm2t(r.s)) + ' '}${esc(r.title)}`).join(' · ')}` : ''}</p>${wxT}</div>` : ''}</section>`;
}
/* ---------- the briefing sheet ---------- */
function vBrief() {
  loadPlanMine(); baselineSeed();
  const sl = slot(), rows = meValid() ? dayRows(dk) : [], li = leaveInfo(), dateStr = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' }).format(shifted());
  const setup = (sl === 'morning' || sl === 'day') && meValid() ? ghAsk() + situCard(dk, { title: 'Today’s setup', open: needsSetup(dk) }) : '';
  const gk = goodToKnow(sl);
  const C = {
    next: nextCard(rows, li), launch: launchCard(li), needs: needsCard(sl) + workHoursCard(),
    day: rows.length || sl === 'morning' ? `<section class="card bf-day"><h3>${sl === 'evening' || sl === 'night' ? 'Still today' : 'Today'}</h3>${timeline(rows, dk, { rest: sl !== 'morning', empty: 'Nothing on the calendar. Room to breathe.' })}</section>` : '',
    tasks: tasksCard(dk, 'Due today'), tonight: tonightCard(), tomorrow: tomorrowCard(), out: outingCards(), home: '',
    nudge: remindCard() + homecomingCard() + dipCard() + gigCard() + epAfterCard(), bed: bedtimeCard(),
    notes: gk.length ? `<section class="card bf-notes"><h3>Good to know</h3><ul class="bf-list">${gk.map(bfItem).join('')}</ul></section>` : '' };
  if (C.day && sl !== 'morning' && !/tl-row/.test(C.day)) C.day = '';
  const order = { morning: ['launch', 'out', 'nudge', 'next', 'needs', 'day', 'home', 'tasks', 'notes'], day: ['nudge', 'needs', 'next', 'out', 'launch', 'home', 'day', 'tasks', 'notes', ...(nowMin() >= 900 ? ['tomorrow'] : [])], evening: ['next', 'bed', 'tonight', 'nudge', 'needs', 'tomorrow', 'out', 'home', 'day', 'tasks', 'notes'], night: ['tonight', 'tomorrow', 'out', 'notes'] }[sl];
  return `<div class="brief-ov brief-${sl}" role="dialog" aria-label="Your briefing"><div class="in">
    <header class="bf-hero"><p class="eyebrow">${DAYS_LONG[dow()]} · ${dateStr} · ${SLOT_LABEL[sl]}</p><h1>${greeting()}</h1><p class="lede">${meValid() ? briefShape(rows) : SLOT_SUB[sl]}</p>${sl === 'night' ? '' : wxToday()}</header>
    ${setup}${order.map(k => C[k]).join('')}
    <div class="actions bf-go"><button class="btn accent big" data-act="brief-close">${sl === 'night' ? 'Good night' : 'Let’s go'}</button></div></div></div>`;
}
function maybeBrief() {
  if (S.briefChecked || !S.loaded) return;
  S.briefChecked = true;
  if (me && members().some(m => m.name === me)) { if (!prof(me).setupDone) S.ui.setup = true; else if (lsGet('afloat.brief') !== dk + slot()) S.ui.brief = true; }
}
/* ---------- taps on this area's buttons (data-act), called from events.js; true = handled ---------- */
function tapBriefing(a, el, e, r) {
  switch (a) {
    case 'mode': { const who = el.dataset.who || me || 'us'; if (members().length && who !== me) return true; S.day = { ...S.day, modes: { ...(S.day.modes || {}), [who]: el.dataset.m } }; S.ui.prev = null; mergeDoc('days/' + dk, { modes: { [who]: el.dataset.m } }); render(true); return true; }
    case 'bf-tasks': S.ui.brief = false; lsSet('afloat.brief', dk + slot()); location.hash = 'tasks'; render(true); scrollTo(0, 0); return true;
    case 'brief-close': S.ui.brief = false; lsSet('afloat.brief', dk + slot()); render(true); scrollTo(0, 0); return true;
    case 'go-plan': S.ui.brief = false; lsSet('afloat.brief', dk + slot()); COL['r-closing'] = false; COL['r-plan'] = false; location.hash = 'rhythms'; render(true); return true;
  }
  return false;
}
