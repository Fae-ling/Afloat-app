/* Afloat · app/plans.js · Plans: a day out, a trip, an exam or a deadline, planned once and carried to the right days (11 Nov 2026).
   Plain script: shares one scope with the other app/*.js files (loaded in order by index.html). See CLAUDE.md.
   home/planner = { plans: { [id]: plan }, no: { [eventKey]: 1 } }  (a map, so two phones editing different plans never undo each other)
   plan = { id, title, kind: 'outing'|'trip'|'deadline', by, who[], start, end (YYYY-MM-DD), time, endTime, place, note, from (calendar link), made, closed,
     steps  [{ id, text, days (before the start; 0 = the day itself), due (a fixed date, for exams), done, c }]   before: what to do, and when
     pack   [{ id, text, done, c }]                                                                              what to take
     legs   [{ id, label, date, time, place, mode, mins, early, leave, fixed }]                                  getting there (and back)
     stops  [{ id, date, time, text, main, c }]                                                                  while there, by day; main = the one main thing
     backup [{ id, ifs, then }]                                                                                  if this happens, then this
     after  [{ id, text }], sized { noun, perHour }                                                              when it's over (mirrored into home/afters)
     dates  [{ id, label, date, time }]                                                                          exams / deadlines (kind 'deadline')
   Nothing here is preset: no kits, no lists by kind of trip. Claude suggests from the person's words, and the person edits.
   How it reaches the days: pxBridge() writes a plan entry into Plan tomorrow's day (plans/<date>, with planId) for today and tomorrow, so the
   leave time, reminders and "while you're there" work as for any planned event; pxTodayCards() is the one calm card on Today; pxMirror() puts
   the afterwards list in home/afters (px: 1), so Today's after-card and the sized task work unchanged. */
const PX_KINDS = { outing: 'A day out or appointment', trip: 'A trip', deadline: 'An exam or deadline' };
const PX_ICON = { outing: '🌤️', trip: '🧳', deadline: '📚' };
const pxSlug = t => String(t).toLowerCase().replace(/[^a-z]/g, '');
const pxOverall = p => { const a = pxProg(p.steps), b = pxProg(p.pack); return [a[0] + b[0], a[1] + b[1]]; };
const pxBar = p => { const [n, t] = pxOverall(p); return t ? `<span class="px-bar" role="progressbar" aria-label="Ready" aria-valuemin="0" aria-valuemax="${t}" aria-valuenow="${n}"><i style="width:${Math.round(100 * n / t)}%"></i></span>` : ''; };
const PX_WHEN = [['', 'Whenever'], ['14', '2 weeks before'], ['7', 'A week before'], ['3', '3 days before'], ['1', 'The day before'], ['0', 'The day itself']];
const pxDoc = () => H('planner');
/* the same value whatever order Firestore returns its keys in */
const pxJson = o => JSON.stringify(o, (k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : 1)) : v);
/* the household's own plans, and the ones planned together with another household (plans-together.js) */
const pxAll = () => [...Object.values(pxDoc().plans || {}).filter(p => p && p.id), ...tgPlans()];
const pxGet = id => (pxDoc().plans || {})[id] || (S.tg.docs[id] ? tgPlan(S.tg.docs[id]) : null);
const pxMine = p => !!p && (p.by === me || (p.who || []).includes(me));
const pxMatch = (p, e) => !!(p.from && ((p.from.id && p.from.id === e.id) || (p.from.g && (p.from.g === e.gInst || p.from.g === e.gId))));
const pxForEvent = e => pxAll().find(p => !p.closed && pxMatch(p, e)) || null;
const pxDue = (p, s) => s.due || (s.days != null && s.days !== '' ? calAdd(p.start, -s.days) : '');
const pxDayN = p => dayDiffK(p.start, dk) + 1, pxLen = p => dayDiffK(p.start, p.end) + 1;
const pxClean = (t, n = 90) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, n);
const pxSplit = s => String(s || '').split(/[\n;]|,(?!\d)/).map(x => pxClean(x)).filter(Boolean);
const pxKindOf = e => (e.endDate && e.endDate > e.date) || /\b(trip|holiday|vacation|flight|weekend away|dovolen|výlet)\b/i.test(e.title || '') ? 'trip' : /\b(exam|test|finals?|zkoušk|state exam|deadline|defen[cs]e|presentation)\b/i.test(e.title || '') ? 'deadline' : 'outing';
function pxSave(id, patch) {
  if (S.tg.docs[id]) { tgSave(id, patch); pxSync(); return; }
  const D = pxDoc(), cur = (D.plans || {})[id]; if (!cur) return;
  saveHome('planner', { ...D, plans: { ...(D.plans || {}), [id]: { ...cur, ...patch } } }); pxSync();
}
const pxList = (id, k, fn) => { const p = pxGet(id); if (p) pxSave(id, { [k]: fn([...(p[k] || [])]) }); };
function pxLeg(over) { return { id: uid(), label: 'Getting there', date: '', time: '', place: '', mode: '', mins: null, early: EP_EARLY, leave: '', ...over }; }
function pxCreate(o) {
  const kind = PX_KINDS[o.kind] ? o.kind : 'outing', start = o.start || tKey(), end = o.end && o.end >= start ? o.end : start, title = pxClean(o.title, 80) || 'My project';
  const p = { id: uid(), title, kind, by: me, who: (o.who && o.who.length ? o.who : [me]).filter(Boolean), start, end, time: o.time || '', endTime: o.endTime || '', place: pxClean(o.place, 160), note: pxClean(o.note, 400), from: o.from || null, made: Date.now(),
    steps: [], pack: [], legs: [], stops: [], backup: [], after: [], sized: null, dates: kind === 'deadline' ? [{ id: uid(), label: title, date: start, time: o.time || '' }] : [] };
  if (kind !== 'deadline' && p.time) p.legs.push(pxLeg({ date: start, time: p.time, place: p.place }));
  const D = pxDoc(); saveHome('planner', { ...D, plans: { ...(D.plans || {}), [p.id]: p } }); S.ui.pxOpen = p.id; S.ui.pxNew = p.id; pxSync();
  if (sample && S.ui.pxAsked !== p.id && kind !== 'deadline') pxAsk(p.id, true);
  return p;
}
/* from a saved calendar event (planning mode in the event form, or "Plan it" on the Plans screen) */
function pxFromEvent(e, kind) {
  const timed = !e.allDay && !!e.start, ppl = (e.who || []).filter(Boolean);
  return pxCreate({ title: shortTitle(e.title), kind: kind || pxKindOf(e), start: e.date, end: e.endDate || e.date, time: timed ? e.start : '', endTime: timed ? e.end || '' : '', place: e.place || '', who: ppl.length ? ppl : [me], from: planFrom(e) });
}
/* a journey leg: "it takes N min" or "leave at HH:MM" and "be there N min early" → what everything else uses. Pure, so it can be tested. */
function pxLegCalc(time, f) {
  const early = Math.max(0, Math.min(180, Math.round(+f.early || 0))), typed = /^\d\d:\d\d$/.test(f.leave || '') ? f.leave : '';
  if (!/^\d\d:\d\d$/.test(time || '')) return { err: 'Give the leg a time first: when you need to be there, or when it leaves.' };
  let mins = f.mins !== '' && f.mins != null && +f.mins > 0 ? Math.round(+f.mins) : null, leave = typed;
  if (leave) { mins = toMin(time) - early - toMin(leave); if (mins <= 0) return { err: 'That’s after the time you need to be there.' }; }
  else if (mins != null) leave = minusMin(time, mins + early);
  else return { err: 'Write how long it takes, or when you leave.' };
  return { mins, leave, early, fixed: !!typed };
}
/* ---------- study spread: topics from today back from each exam date (the one piece of planning that is arithmetic, not a guess) ----------
   The last two days (one if short) are practice only, no new material; each topic gets a quick recall from memory 2 and 6 days after it was learned,
   when that falls before those last days. Reviews landing on the same day are one step. Several exams are spread separately and merge by date. */
function pxSpread(topics, from, exam, label) {
  const out = [], D = dayDiffK(from, exam); if (!topics.length) return out;
  if (D < 1) return topics.map(t => ({ text: `Learn: ${t}, then test yourself`, due: from }));
  const hold = D >= 5 ? 2 : D >= 3 ? 1 : 0, L = Math.max(1, D - hold), rev = {};
  topics.forEach((t, i) => { const d = Math.floor(i * L / topics.length); out.push({ text: `Learn: ${t}, then test yourself`, due: calAdd(from, d) });
    if (D >= 4) for (const gap of [2, 6]) { const r = d + gap; if (r < D - hold) (rev[r] = rev[r] || []).push(t); } });
  for (const [r, ts] of Object.entries(rev)) out.push({ text: `Recall from memory, no notes first: ${ts.join(', ')}`, due: calAdd(from, +r) });
  if (hold) for (let i = 0; i < hold; i++) out.push({ text: `${label ? label + ': p' : 'P'}ractice questions, mixed topics. No new material`, due: calAdd(exam, -(hold - i)) });
  return out.sort((a, b) => a.due.localeCompare(b.due));
}
/* ---------- Claude's starting plan ---------- */
async function pxAsk(id, auto) {
  const p = pxGet(id); if (!p || !sample || S.ui.pxBusy) return; S.ui.pxAsked = id; S.ui.pxBusy = id; render(true);
  const kids = kidsList().filter(k => (p.who || []).includes(k)), len = pxLen(p), nice = k => new Date(k + 'T12:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const q = `${houseFacts()} Today is ${nice(dk)}.
They are planning ${p.kind === 'trip' ? 'a trip' : p.kind === 'deadline' ? 'an exam or deadline' : 'a day out or an appointment'}: "${p.title}"${p.place ? ` at ${p.place}` : ''}, ${len > 1 ? `from ${nice(p.start)} to ${nice(p.end)} (${len} days)` : `on ${nice(p.start)}${p.time ? ` at ${p.time}` : ''}`}. Going: ${(p.who || []).join(', ') || 'one person'}.${p.note ? ` In their words: ${p.note}.` : ''}${((p.steps || []).length || (p.pack || []).length) ? ` Already planned (don't repeat): ${[...(p.steps || []), ...(p.pack || [])].map(x => x.text).slice(0, 20).join('; ')}.` : ''}
Reply with only JSON: {"steps": [{"text": at most 9 words, "days": how many days before the start it should be done, 0 = the day itself, 1 = the day before}], "pack": [at most 6 words each], "stops": [{"text": at most 9 words, "day": day number from 1, "main": true if it is the one main thing that day}], "backup": [{"if": at most 9 words, "then": at most 12 words}], "after": [at most 9 words each]}.
Limits: 6 steps, ${p.kind === 'outing' ? 8 : 12} pack items, 3 things a day${kids.length ? ' and only one main thing a day, with rest in between (small children)' : ''}, 3 backup lines, 3 afterwards. Only what is specific to this and easy to forget; nothing generic; empty lists are fine.${p.kind === 'deadline' ? ' For an exam or deadline: steps are study or preparation sessions with dates spread back from the date (use "days"), the last two days only practice, no new material; no pack or stops.' : ''}${/work|meeting|conference|client|business/i.test(`${p.title} ${p.note}`) ? ' It is for work: documents and chargers, who they meet and what for, and the expense report afterwards.' : ''}`;
  try {
    const out = await askClaude(q, { feature: 'plan' }), o = out && !Array.isArray(out) ? out : {}, cur = pxGet(id); if (!cur) return;
    const arr = a => Array.isArray(a) ? a : [], have = (L, t) => L.some(x => String(x.text || '').toLowerCase() === t.toLowerCase());
    const steps = [...(cur.steps || [])], pack = [...(cur.pack || [])], stops = [...(cur.stops || [])], backup = [...(cur.backup || [])], after = [...(cur.after || [])];
    for (const s of arr(o.steps).slice(0, 6)) { const t = pxClean(s && s.text, 90), d = Math.max(0, Math.min(60, Math.round(+(s && s.days) || 0))); if (t && !have(steps, t)) steps.push({ id: uid(), text: t, days: d, c: 1 }); }
    for (const s of arr(o.pack).slice(0, 12)) { const t = pxClean(s && s.text || s, 60); if (t && !have(pack, t)) pack.push({ id: uid(), text: t, c: 1 }); }
    for (const s of arr(o.stops).slice(0, 3 * len)) { const t = pxClean(s && s.text, 90), n = Math.max(1, Math.min(len, Math.round(+(s && s.day) || 1))); if (t && !have(stops, t)) stops.push({ id: uid(), date: calAdd(cur.start, n - 1), time: '', text: t, main: !!(s && s.main), c: 1 }); }
    for (const s of arr(o.backup).slice(0, 3)) { const i = pxClean(s && s.if, 90), t = pxClean(s && s.then, 120); if (i && t) backup.push({ id: uid(), ifs: i, then: t, c: 1 }); }
    for (const s of arr(o.after).slice(0, 3)) { const t = pxClean(s && s.text || s, 90); if (t && !have(after, t)) after.push({ id: uid(), text: t, c: 1 }); }
    pxSave(id, { steps, pack, stops, backup, after });
    if (!auto && steps.length + pack.length + stops.length + backup.length + after.length === (cur.steps || []).length + (cur.pack || []).length + (cur.stops || []).length + (cur.backup || []).length + (cur.after || []).length) toast('Nothing new came to mind. Add your own.');
  } catch (e) { if (!auto) toast(claudeWhy(e)); }
  finally { S.ui.pxBusy = null; render(true); }
}
/* ---------- carrying a plan to the days ---------- */
const pxTitle = p => p.title.replace(/ · /g, ' - ');
function pxEntry(p, k) {
  const lg = (p.legs || []).filter(l => l.date === k && l.time).sort((a, b) => a.time.localeCompare(b.time))[0], time = lg ? lg.time : p.start === k ? p.time || '' : '', place = (lg && lg.place) || p.place || '';
  const mins = lg && lg.mins != null ? +lg.mins : time ? travelOf({ place, title: p.title }).m : null;
  return { id: 'px' + p.id + k.replace(/-/g, ''), planId: p.id, title: pxTitle(p), time, travel: time ? mins : null, place, end: p.end === k ? p.endTime || '' : '',
    during: (p.stops || []).filter(s => s.date === k).sort(epTimeSort).map(s => ({ id: s.id, text: s.text, ...(s.time ? { time: s.time } : {}) })),
    ...(lg && lg.leave ? { journey: { mode: lg.mode || '', mins: lg.mins, leave: lg.leave, early: lg.early, ...(lg.fixed ? { fixed: true } : {}) } } : lg ? { journey: { mode: lg.mode || '' } } : {}) };
}
function pxBridge() {
  if (!db || !S.loaded || !meValid()) return;
  const live = pxAll().filter(p => pxMine(p) && !p.closed && p.kind !== 'deadline');
  for (const which of ['today', 'next']) {
    const k = which === 'today' ? dk : tk, cur = planOf(which, me), evs = cur.events || [], want = live.filter(p => p.start <= k && p.end >= k).map(p => pxEntry(p, k)), had = evs.filter(x => x.planId);
    if (pxJson(had) === pxJson(want)) continue;
    const gone = had.filter(x => !want.some(w => w.id === x.id)), fresh = want.filter(w => { const o = had.find(x => x.id === w.id); return !o || (o.journey || {}).leave !== (w.journey || {}).leave || o.time !== w.time || o.travel !== w.travel; });
    savePlanFor(which, { events: [...evs.filter(x => !x.planId), ...want] });
    if (which === 'next') { gone.forEach(x => remDel(r => r.ref === 'plan:' + x.id)); for (const w of fresh) { remDel(r => r.ref === 'plan:' + w.id); if (w.time && w.travel != null) planRemind(w); } }
    render(true);
  }
}
/* the calendar event moved or its times changed: the plan moves with it (a journey worked out from minutes moves; a timetable one is dropped back to a guess) */
function pxFollow() {
  const pool = allEvents(), D = pxDoc(), plans = { ...(D.plans || {}) }; let ch = false;
  for (const p of pxAll()) {
    if (!p.from || p.by !== me || p.kind === 'deadline' || p.closed) continue; const e = pool.find(x => pxMatch(p, x)); if (!e || e.occ) continue;
    const timed = !e.allDay && !!e.start, start = e.date, end = e.endDate || e.date, time = timed ? e.start : '', endTime = timed ? e.end || '' : '';
    if (start === p.start && end === p.end && time === (p.time || '') && endTime === (p.endTime || '')) continue;
    const legs = (p.legs || []).map(l => l.date === p.start && l.time === p.time && time ? (l.fixed || l.mins == null ? { ...l, date: start, time, leave: '', mins: l.fixed ? null : l.mins, fixed: false } : { ...l, date: start, time, leave: minusMin(time, +l.mins + (+l.early || 0)) }) : l);
    if (p.shared) { tgSave(p.id, { start, end, time, endTime, legs }); continue; }
    plans[p.id] = { ...p, start, end, time, endTime, legs }; ch = true;
  }
  if (ch) saveHome('planner', { ...D, plans });
}
/* the afterwards list lives on in home/afters (entries with px: 1), so Today's after-card and the sized task work as they always have */
function pxMirror() {
  const A = H('afters'), cur = A.list || [], mine = pxAll().filter(p => p.by === me && ((p.after || []).length || p.sized)), ids = new Set(mine.map(p => p.id));
  const list = cur.filter(a => !(a.px && a.who === me));
  for (const p of mine) { const old = cur.find(a => a.id === p.id && a.px), items = (p.after || []).map(x => ({ id: x.id, text: x.text, ...(((old || {}).items || []).find(y => y.id === x.id) || {}).done ? { done: true } : {} }));
    list.push({ id: p.id, px: 1, who: me, title: pxTitle(p), date: p.end, end: p.endTime || '', start: p.time || '', back: 0, items, sized: p.sized || null, made: !!(old || {}).made, closed: !!(old || {}).closed, ...((old || {}).n ? { n: old.n } : {}) }); }
  if (pxJson(list) !== pxJson(cur)) saveHome('afters', { ...A, list });
}
let pxBusySync = false;
function pxSync() {
  if (pxBusySync || !db || !S.loaded || !meValid()) return; pxBusySync = true;
  try { pxFollow(); pxBridge(); pxMirror(); pmRemSync(); } catch (e) { console.warn('plans sync:', e); } finally { pxBusySync = false; }
}
/* a leg-shaped journey for events further away than Plan tomorrow reaches (leaveAt() asks epPlanOf() first) */
function pxEntryFor(e) {
  const p = pxForEvent(e); if (!p || !e.date) return null; const lg = (p.legs || []).find(l => l.date === e.date && l.leave && l.time === e.start);
  return lg ? { journey: { mode: lg.mode || '', mins: lg.mins, leave: lg.leave, early: lg.early } } : null;
}
/* ---------- numbers and words ---------- */
const pxProg = a => { const L = a || [], n = L.filter(x => x.done).length; return [n, L.length]; };
function pxWords(p) {
  const d = dayDiffK(dk, p.start), len = pxLen(p);
  if (dk > p.end) return `Over ${dayDiffK(p.end, dk) === 1 ? 'yesterday' : dayDiffK(p.end, dk) + ' days ago'}`;
  if (dk >= p.start) return len > 1 ? `On now · day ${pxDayN(p)} of ${len}` : 'Today';
  return (d === 1 ? 'Tomorrow' : d < 14 ? `In ${d} days` : d < 60 ? `In ${Math.round(d / 7)} weeks` : `In ${Math.round(d / 30)} months`);
}
const pxDates = p => p.start === p.end ? `${fmtD(p.start)}${p.time ? ' ' + p.time : ''}` : `${fmtD(p.start)} to ${fmtD(p.end)}`;
const pxReady = (p, horizon = 0) => (p.steps || []).filter(s => !s.done && (!s.by || s.by === me) && pxDue(p, s) && pxDue(p, s) <= calAdd(dk, horizon)).sort((a, b) => pxDue(p, a).localeCompare(pxDue(p, b)));
const pxDueWords = (p, s) => { const d = pxDue(p, s); if (!d) return 'whenever'; const n = dayDiffK(dk, d); return n <= 0 ? (n === 0 ? 'today' : 'ready now') : n === 1 ? 'tomorrow' : fmtD(d); };
const pxTick = (kind, pid, id, done, extra = '') => `<button type="button" class="check${done ? ' on' : ''}" data-act="px-tick" data-k="${kind}" data-p="${pid}" data-i="${id}" aria-pressed="${!!done}"><span class="box" aria-hidden="true">${I.check}</span><span class="txt">${extra}</span></button>`;
/* ---------- Today: one calm card per plan that matters now (at most two) ---------- */
function pxTodayCards() {
  if (!meValid() || !S.loaded) return '';
  const inv = tgInvitesHtml();
  const rows = pxAll().filter(p => pxMine(p) && !p.closed && dk <= p.end).map(p => {
    const d = dayDiffK(dk, p.start), on = d <= 0, ready = pxReady(p, 0), horizon = p.kind === 'deadline' ? 28 : 21, today = on ? (p.stops || []).filter(s => s.date === dk).sort(epTimeSort) : [];
    const show = on || (ready.length && d <= horizon) || d <= 2; return show ? { p, d, on, ready, today } : null; }).filter(Boolean).sort((a, b) => a.d - b.d).slice(0, 2);
  return rows.map(({ p, on, ready, today }) => {
    const pk = pxProg(p.pack), isDl = p.kind === 'deadline', todays = ready.filter(s => pxDue(p, s) === dk), rest = ready.filter(s => pxDue(p, s) < dk);
    const list = [...todays, ...rest].slice(0, 4), left = ready.length - list.length;
    return `<section class="card px-card"><div class="sec-head"><h3>${esc(p.title)}</h3><span class="progress">${esc(pxWords(p))}</span></div>
      ${tvTodayLines(p)}
      ${today.length ? `<ul class="brief-list">${today.map(s => `<li>${s.time ? `<b>${esc(s.time)}</b> ` : ''}${esc(s.text)}${s.main ? ' <span class="muted small">· the main thing</span>' : ''}</li>`).join('')}</ul>` : ''}
      ${list.length ? `<p class="muted small">${isDl ? 'For today' : 'Ready when you are'}</p><ul class="checks">${list.map(s => `<li class="px-it">${pxTick('step', p.id, s.id, false, esc(s.text))}${viewOn('focus') && (isDl || /learn|study|write|draft|prepare|practi|revis|read|finish/i.test(s.text)) ? `<button type="button" class="tiny" data-act="px-focus" data-p="${p.id}" data-i="${s.id}" title="Start a focus session on it">Focus</button>` : ''}</li>`).join('')}</ul>${left > 0 ? `<p class="muted small">and ${left} more in the project</p>` : ''}` : on || isDl ? '' : `<p class="muted small">Nothing needs you yet.</p>`}
      ${!isDl && pk[1] && !on && dayDiffK(dk, p.start) <= 3 ? `<p class="small">Packed ${pk[0]} of ${pk[1]}</p>` : ''}
      ${on && (p.backup || []).length ? `<details><summary class="small">If something goes wrong</summary><ul class="brief-list">${p.backup.map(b => `<li>If ${esc(b.ifs)}, then ${esc(b.then)}</li>`).join('')}</ul></details>` : ''}
      <p class="small"><button type="button" class="link" data-act="px-open" data-id="${p.id}">Open the project</button></p></section>`;
  }).join('') + inv;
}
/* ---------- Plan tomorrow: a planned event is shown as planned, with what's ready, and no nudge ---------- */
function pxTomorrowBody(ent) {
  const p = pxGet(ent.planId); if (!p) return '';
  const hasRem = remAll().some(x => x.ref === 'plan:' + ent.id), timed = ent.time && ent.travel != null, ready = pxReady(p, 0).slice(0, 6), pk = pxProg(p.pack);
  return `<p class="small"><span class="tl-ok">✓ In your project</span> · <button type="button" class="link" data-act="px-open" data-id="${p.id}">Open it</button></p>
    ${timed ? `<p class="muted small">Leave by <b>${leaveBy(ent)}</b>${(ent.journey || {}).leave ? '' : ' (a guess)'} · ${hasRem ? `reminders at ${minusMin(leaveBy(ent), 30)} and ${leaveBy(ent)}` : 'no reminders'} <button type="button" class="link" data-act="plan-rem" data-id="${ent.id}">${hasRem ? 'Turn off' : 'Remind me'}</button></p>` : ''}
    ${ready.length ? `<ul class="checks">${ready.map(s => `<li>${pxTick('step', p.id, s.id, false, `${esc(s.text)} <span class="muted small">· ${esc(pxDueWords(p, s))}</span>`)}</li>`).join('')}</ul>` : ''}
    ${pk[1] ? `<p class="small">Packed ${pk[0]} of ${pk[1]}${pk[0] < pk[1] ? ': ' + esc(p.pack.filter(x => !x.done).slice(0, 4).map(x => x.text).join(', ')) + (pk[1] - pk[0] > 4 ? '…' : '') : ' ✓'}</p>` : ''}
    ${(ent.during || []).length ? `<p class="muted small">${ent.during.length} thing${ent.during.length > 1 ? 's' : ''} to do there; they show on Today while you’re there.</p>` : ''}`;
}
/* ---------- the Plans screen ---------- */
const pxWorthy = e => !!(e.endDate && e.endDate > e.date) || /\b(trip|holiday|vacation|flight|exam|conference|wedding|dovolen|výlet|zkoušk)/i.test(e.title || '');
/* only events you're attending: you're named, or nobody is named (everyone's), or it's on your own calendar / an invitation you haven't declined */
const pxGoing = e => e.rsvp !== 'declined' && (!(e.who || []).length || (e.who || []).includes(me) || e.src === 'mine' || e.src === 'invite');
const pxEvKey = e => String(e.gInst || e.gId || e.id || '').replace(/[^\w-]/g, '');
function pxSuggest() {
  const hide = pxDoc().no || {}, to = calAdd(dk, 45), have = pxAll();
  return allEvents().filter(e => !e.occ && e.date >= dk && e.date <= to && pxWorthy(e) && pxGoing(e) && !hide[pxEvKey(e)] && !have.some(p => pxMatch(p, e)) && !e.gpOnly).slice(0, 4);
}
function pxCard(p) {
  const st = pxProg(p.steps), pk = pxProg(p.pack), bits = [st[1] ? `${st[0]} of ${st[1]} steps` : '', pk[1] ? `packed ${pk[0]} of ${pk[1]}` : ''].filter(Boolean).join(' · ');
  const on = !p.closed && dk >= p.start && dk <= p.end;
  return `<button type="button" class="pl-ev px-row${on ? ' on' : ''}" data-act="px-open" data-id="${p.id}"><span class="px-ico" aria-hidden="true">${PX_ICON[p.kind] || '🗓️'}</span><div class="px-rbody"><div class="pl-ev-h"><div><b>${esc(p.title)}</b> <span class="muted small">${esc(PX_KINDS[p.kind])}${p.shared ? ' · together' : ''}</span></div><span class="progress px-pill${on ? ' on' : ''}">${esc(pxWords(p))}</span></div><p class="muted small">${esc(pxDates(p))}${p.place ? ' · ' + esc(p.place) : ''}${bits ? ' · ' + esc(bits) : ''}</p>${pxBar(p)}</div></button>`;
}
function vPlans() {
  const open = S.ui.pxOpen && pxGet(S.ui.pxOpen); if (open) return pxEditor(open);
  const all = pxAll().sort((a, b) => a.start.localeCompare(b.start)), now = all.filter(p => !p.closed && p.end >= dk), past = all.filter(p => p.closed || p.end < dk).reverse(), sug = pxSuggest(), K = S.ui.pxKind || 'outing';
  let h = hero('Projects', 'Set it up once. It finds you at the right moment.', 'A day out, a trip, an exam week: how you get there, what to take, what to do there, what if, and what comes after. Afloat carries it to the right days, and Ready for tomorrow stops asking about anything that’s already here.');
  h += tgInvitesHtml();
  h += `<section class="card"><div class="sec-head"><h2>New project</h2></div>
    <form class="addform px-new" data-form="px-new"><input type="text" name="title" value="${esc(S.ui.pxTitle || '')}" placeholder="${K === 'deadline' ? 'e.g. Exam period, January' : K === 'trip' ? 'e.g. Lisbon with the kids' : 'e.g. Dentist, or a day at the lake'}" required aria-label="Name of the project">
      <div class="chips px-kinds" role="group" aria-label="What kind of project">${Object.entries(PX_KINDS).map(([k, l]) => `<button type="button" class="tiny px-kind${K === k ? ' on' : ''}" data-act="px-kind" data-v="${k}" aria-pressed="${K === k}"><span aria-hidden="true">${PX_ICON[k]}</span> ${l}</button>`).join('')}</div>
      <label class="small">${K === 'outing' ? 'On' : K === 'deadline' ? 'First date' : 'From'}<input type="date" name="start" value="${esc(S.ui.pxStart || tKey())}" required></label>
      ${K === 'outing' ? '<label class="small">At<input type="time" name="time"></label>' : `<label class="small">${K === 'deadline' ? 'Last date' : 'To'}<input type="date" name="end" value=""></label>`}
      <button class="btn accent" type="submit">Get me ready</button></form>
    ${K === 'deadline' && sample ? '<p class="small"><button type="button" class="btn ghost small" data-act="px-photo">📷 From a photo of the study plan or exam timetable</button></p>' : ''}
    <p class="muted small">Or tick “Open the details when I save” when you add something to the calendar, and the project starts from that event.</p></section>`;
  if (sug.length) h += `<section class="card"><div class="sec-head"><h2>On your calendar, no project yet</h2></div><ul class="bf-list">${sug.map(e => `<li><b>${esc(shortTitle(e.title))}</b> <span class="muted small">${esc(fmtD(e.date))}${e.endDate > e.date ? ' to ' + esc(fmtD(e.endDate)) : ''}</span> <button type="button" class="tiny" data-act="px-from-ev" data-id="${esc(e.id || '')}" data-g="${esc(e.gId || '')}">Get me ready</button> <button type="button" class="link" data-act="px-no" data-key="${esc(pxEvKey(e))}">Not this one</button></li>`).join('')}</ul></section>`;
  h += now.length ? `<section class="card"><div class="sec-head"><h2>Your projects</h2><span class="progress">${now.length}</span></div><div class="px-list">${now.map(pxCard).join('')}</div></section>` : `<p class="empty">No projects yet. Start one above, for anything that takes more than getting out of the door.</p>`;
  if (past.length) h += `<section class="card"><details><summary class="small">Finished or put away (${past.length})</summary><div class="px-list">${past.map(pxCard).join('')}</div></details></section>`;
  return h;
}
/* ---------- one plan ---------- */
const pxFolded = slug => !!((S.ui.pxFold || {})[S.ui.pxOpen + ':' + slug]);
const pxSec = (title, meta, body) => { const slug = pxSlug(title), f = pxFolded(slug);
  return `<section class="card px-sec${f ? ' folded' : ''}" id="px-s-${slug}"><div class="sec-head"><h2><button type="button" class="px-fold" data-act="px-fold" data-s="${slug}" aria-expanded="${!f}"><span class="px-chev" aria-hidden="true">›</span>${title}</button></h2>${meta ? `<span class="progress">${meta}</span>` : ''}</div>${f ? '' : body}</section>`; };
/* a row of shortcuts under the plan's header: each section with how much is in it, a ✓ once everything in it is ticked */
function pxNav(p) {
  const dl = p.kind === 'deadline', cnt = L => (L || []).length, tk = L => cnt(L) && (L || []).every(x => x.done);
  const items = dl ? [['Study plan', p.steps, 1], ['Dates that matter', p.dates], ['If something goes wrong', p.backup], ['When it’s over', p.after]]
    : [['Itinerary', [...(p.legs || []), ...(p.stops || [])]], ['Before', p.steps, 1],['What to take', p.pack, 1], ['Getting there', p.legs], ['While you’re there', p.stops], ['If something goes wrong', p.backup], ['When it’s over', p.after], ['Costs', p.costs]];
  return `<nav class="px-nav" aria-label="Jump to a part of the project">${items.map(([t, L, tick]) => `<button type="button" class="px-jump${tick && tk(L) ? ' done' : ''}" data-act="px-jump" data-s="${pxSlug(t)}">${tick && tk(L) ? '✓ ' : ''}${t.replace('If something goes wrong', 'If…').replace('While you’re there', 'There').replace('Dates that matter', 'Dates')}${cnt(L) ? ` <span class="px-n">${cnt(L)}</span>` : ''}</button>`).join('')}</nav>`;
}
const pxDel = (k, p, id, t) => `<button type="button" class="chip x row-x" data-act="px-del" data-k="${k}" data-p="${p}" data-i="${id}" aria-label="Remove ${esc(t)}">✕</button>`;
const pxMark = x => x.c ? ' <span class="muted small" title="Claude’s suggestion">✦</span>' : '';
function pxStepsHtml(p) {
  const L = [...(p.steps || [])].sort((a, b) => (pxDue(p, a) || '9').localeCompare(pxDue(p, b) || '9') || 0), dl = p.kind === 'deadline';
  return pxSec(dl ? 'Study plan' : 'Before', pxProg(p.steps)[1] ? `${pxProg(p.steps)[0]} of ${pxProg(p.steps)[1]}` : '', `
    ${L.length ? `<ul class="checks px-steps">${L.map(s => `<li class="px-it">${pxTick('step', p.id, s.id, s.done, `${esc(s.text)}${pxMark(s)} <span class="muted small">· ${esc(pxDueWords(p, s))}</span>`)}${pmRemBtn(p, s)}${tgBy(p, 'steps', s)}${pxDel('steps', p.id, s.id, s.text)}${S.ui.pmRem === s.id ? `<form class="addform" data-form="pm-remtime" data-p="${p.id}" data-i="${s.id}"><label class="small">Remind me on ${esc(fmtD(pxDue(p, s)))} at<input type="time" name="time" value="09:00"></label><button class="btn small" type="submit">Set</button></form>` : ''}</li>`).join('')}</ul>` : `<p class="muted small">${dl ? 'What to study or finish, and when. Nothing is “late” here, it just waits for you.' : 'What to do or arrange, and roughly when. “The day before” shows up in Ready for tomorrow; “the day itself” on Today.'}</p>`}
    <form class="addform" data-form="px-step" data-p="${p.id}"><input type="text" name="text" placeholder="${dl ? 'e.g. Past paper, chapters 4 to 6' : 'e.g. Book the train'}" required aria-label="A step">
      ${dl ? '<input type="date" name="due" aria-label="Do it on">' : `<select name="days" aria-label="When">${PX_WHEN.map(([v, l]) => `<option value="${v}"${v === '1' ? ' selected' : ''}>${l}</option>`).join('')}</select>`}<button class="btn" type="submit">Add</button></form>`);
}
function pxPackHtml(p) {
  const L = p.pack || [], pk = pxProg(L);
  return pxSec('What to take', pk[1] ? `packed ${pk[0]} of ${pk[1]}` : '', `
    ${L.length ? `<ul class="checks px-steps">${L.map(x => `<li class="px-it">${pxTick('pack', p.id, x.id, x.done, esc(x.text) + pxMark(x))}${tgBy(p, 'pack', x)}${!x.done && shopOk() ? `<button type="button" class="tiny" data-act="px-shop" data-text="${esc(x.text)}" title="Needs buying: onto ${esc(shopName('shop'))}" aria-label="Put ${esc(x.text)} on the shopping list">🛒</button>` : ''}${pxDel('pack', p.id, x.id, x.text)}</li>`).join('')}</ul>` : '<p class="muted small">Tick things as they go in the bag. Add several at once with commas.</p>'}
    <form class="addform" data-form="px-pack" data-p="${p.id}"><input type="text" name="text" placeholder="e.g. Passport, charger, swimming things" required aria-label="Things to take"><button class="btn" type="submit">Add</button></form>`);
}
function pxLegHtml(p, l) {
  const m = PX_MODES.find(x => x[0] === l.mode), D = (S.ui.pxDraft || {})[l.id] || {}, planned = !!l.leave, mins = D.mins != null ? D.mins : l.mins != null ? l.mins : '', leave = D.leave != null ? D.leave : l.leave || '';
  return `<div class="pl-ev${planned ? ' on' : ''}"><div class="pl-ev-h"><div><b>${esc(l.label || 'Journey')}</b> <span class="muted small">${esc(fmtD(l.date || p.start))}${l.time ? ' · ' + esc(l.time) : ''}${l.place ? ' · ' + esc(l.place) : ''}${l.ref ? ' · ref ' + esc(l.ref) : ''}</span></div>${pxDel('legs', p.id, l.id, l.label || 'journey')}</div>
    <p class="small">${planned ? `<span class="tl-ok">✓ Planned</span> · leave at <b>${esc(l.leave)}</b>${m ? ' · ' + esc(m[1]) : ''}` : `<span class="muted">Leave time not planned yet.${l.time ? ' Afloat guesses until you write it in.' : ' Give it a time first.'}</span>`}</p>
    <div class="chips">${PX_MODES.map(([k, t]) => `<button type="button" class="tiny${l.mode === k ? ' on' : ''}" data-act="px-mode" data-p="${p.id}" data-i="${l.id}" data-v="${k}" aria-pressed="${l.mode === k}">${t}</button>`).join('')}</div>
    ${tvLegFields(p, l)}${tvLive(p, l, false)}${(l.mode === 'transit' && l.stop && tvOn('golemio') && l.date >= dk && l.date <= tk) || (l.mode === 'flight' && l.flight && tvOn('flights') && l.date >= dk) ? `<p class="small"><button type="button" class="tiny" data-act="tv-check" data-p="${p.id}" data-i="${l.id}">↻ Check it now</button></p>` : ''}${tvRouteHtml(p, l)}
    ${l.mode === 'flight' ? '' : epLinks({ place: l.place || p.place, journey: l })}
    <form class="addform ep-jf" data-form="px-leg" data-p="${p.id}" data-i="${l.id}"><label class="small">${l.time ? 'Time' : 'Time (there by, or it leaves)'}<input type="time" name="time" value="${esc(l.time || '')}"></label><label class="small">It takes (min)<input type="number" inputmode="numeric" min="1" max="1440" name="mins" value="${mins === '' ? '' : +mins}" placeholder="35"></label>
      <label class="small">or leave home at<input type="time" name="leave" value="${esc(leave)}"></label><label class="small">be there early (min)<input type="number" inputmode="numeric" min="0" max="180" name="early" value="${l.early != null ? +l.early : EP_EARLY}"></label>
      <button class="btn" type="submit">${planned ? 'Update' : 'Save journey'}</button></form>
    <details><summary class="small">Change the name, day or place</summary><form class="addform" data-form="px-legmeta" data-p="${p.id}" data-i="${l.id}"><input type="text" name="label" value="${esc(l.label || '')}" aria-label="Name"><input type="date" name="date" value="${esc(l.date || p.start)}" aria-label="Day"><input type="text" name="place" value="${esc(l.place || '')}" placeholder="Where to" aria-label="Where to"><button class="btn ghost" type="submit">Save</button></form></details></div>`;
}
function pxLegsHtml(p) {
  const L = [...(p.legs || [])].sort((a, b) => ((a.date || '') + (a.time || '')).localeCompare((b.date || '') + (b.time || '')));
  return pxSec('Getting there', '', `${bkHtml(p)}${L.length ? L.map(l => pxLegHtml(p, l)).join('') : '<p class="muted small">How you get there, and back: a drive, a train, a flight. Write the time you leave and Afloat sets the reminders and the leave-by screen from it.</p>'}
    <form class="addform" data-form="px-legadd" data-p="${p.id}"><input type="text" name="label" placeholder="e.g. Train home" required aria-label="Name of the journey"><input type="date" name="date" value="${esc(p.end > p.start && L.length ? p.end : p.start)}" aria-label="Day"><input type="time" name="time" aria-label="Time"><input type="text" name="place" placeholder="Where to (optional)" aria-label="Where to"><button class="btn" type="submit">Add a journey</button></form>`);
}
function pxStopsHtml(p) {
  const days = Array.from({ length: Math.min(pxLen(p), 21) }, (_, i) => calAdd(p.start, i)), kids = kidsList().filter(k => (p.who || []).includes(k));
  const day = k => { const L = (p.stops || []).filter(s => s.date === k).sort(epTimeSort), mains = L.filter(s => s.main).length, busy = kids.length && (mains > 1 || L.length > 3);
    return `<div class="px-day">${days.length > 1 ? `<h4 class="ep-h">${esc(fmtD(k))}${k === dk ? ' · today' : ''}</h4>` : ''}
      ${L.length ? `<ul class="pl-its">${L.map(s => `<li class="pl-it"><span class="txt small">${s.time ? `<b>${esc(s.time)}</b> ` : ''}${esc(s.text)}${s.main ? ' <span class="muted">· the main thing</span>' : ''}${pxMark(s)}</span><button type="button" class="tiny${s.main ? ' on' : ''}" data-act="px-main" data-p="${p.id}" data-i="${s.id}" aria-pressed="${!!s.main}" title="Mark as the one main thing of the day">★</button>${pxDel('stops', p.id, s.id, s.text)}</li>`).join('')}</ul>` : ''}
      ${pxWx(p, k)}
      ${busy ? `<p class="muted small">That’s a lot for one day with ${esc(theKids())}. One main thing, then rest, usually goes better than two.</p>` : ''}
      <form class="addform" data-form="px-stop" data-p="${p.id}" data-k="${k}"><input type="time" name="time" aria-label="Time (optional)"><input type="text" name="text" placeholder="${days.length > 1 ? 'e.g. The old town, then lunch' : 'e.g. The lookout, then lunch'}" required aria-label="Something to see or do"><button class="btn" type="submit">Add</button></form></div>`; };
  return pxSec('While you’re there', '', `${days.map(day).join('')}${sample && p.place ? `<p class="small"><button type="button" class="link" data-act="px-ask" data-id="${p.id}">✦ Ideas for what to do there</button></p>` : ''}`);
}
/* the itinerary: a clean read-only overview built from everything above (journeys, stays, things to do), day by day */
const PX_MODE_ICON = { flight: '✈️', transit: '🚆', drive: '🚗', bike: '🚲', walk: '🚶', lift: '🚕' };
function pxItinRows(p) {
  const rows = {}, add = (d, r) => { (rows[d] = rows[d] || []).push(r); };
  (p.legs || []).forEach(l => add(l.date || p.start, { k: 'leg', t: l.time || '', ico: PX_MODE_ICON[l.mode] || '🧭', h: esc(l.label || 'Journey'), sub: [l.place ? 'from ' + esc(l.place) : '', l.leave ? 'leave home at <b>' + esc(l.leave) + '</b>' : '', l.ref ? 'ref ' + esc(l.ref) : ''].filter(Boolean).join(' · ') }));
  (p.stops || []).forEach(s => { const stay = /^check (in|out)\b/i.test(s.text || ''); add(s.date || p.start, { k: stay ? 'stay' : 'stop', t: s.time || '', ico: stay ? '🛏️' : s.main ? '⭐' : '📍', h: esc(s.text), sub: s.main ? 'the main thing' : '' }); });
  return rows;
}
function pxItinerary(p) {
  const rows = pxItinRows(p), n = Object.values(rows).reduce((a, r) => a + r.length, 0), nl = (p.legs || []).length, ns = (p.stops || []).filter(s => /^check in\b/i.test(s.text || '')).length;
  if (!n) return pxSec('Itinerary', '', '<p class="muted small">Add a journey, a booking or something to do above, and your itinerary builds itself here, day by day.</p>');
  const span = Array.from({ length: Math.min(pxLen(p), 21) }, (_, i) => calAdd(p.start, i)), days = [...new Set([...span, ...Object.keys(rows)])].sort();
  const body = days.map(k => { const L = (rows[k] || []).sort((a, b) => (a.t || '99:99').localeCompare(b.t || '99:99')), di = dayDiffK(p.start, k) + 1;
    return `<div class="it-day${k === dk ? ' today' : ''}${L.length ? '' : ' free'}"><div class="it-date"><b>${esc(fmtD(k))}</b>${days.length > 1 ? `<span class="muted small">${di < 1 ? 'Before' : 'Day ' + di}</span>` : ''}${k === dk ? '<span class="badge ok">Today</span>' : ''}</div>
      ${L.length ? `<ol class="it-list">${L.map(r => `<li class="it-${r.k}"><span class="it-t">${r.t ? esc(r.t) : '·'}</span><span class="it-i" aria-hidden="true">${r.ico}</span><span class="it-b"><b>${r.h}</b>${r.sub ? `<span class="muted small">${r.sub}</span>` : ''}</span></li>`).join('')}</ol>` : '<p class="muted small it-none">Nothing planned</p>'}</div>`; }).join('');
  return pxSec('Itinerary', [nl && `${nl} journey${nl > 1 ? 's' : ''}`, ns && `${ns} stay${ns > 1 ? 's' : ''}`].filter(Boolean).join(' · '), `<p class="muted small">Everything you’ve filled in above, in the order it happens. Change things in their own sections.</p><div class="it">${body}</div>`);
}
function pxBackupHtml(p) {
  const L = p.backup || [];
  return pxSec('If something goes wrong', '', `${L.length ? `<ul class="pl-its">${L.map(b => `<li class="pl-it"><span class="txt small">If <b>${esc(b.ifs)}</b>, then ${esc(b.then)}${pxMark(b)}</span>${pxDel('backup', p.id, b.id, b.ifs)}</li>`).join('')}</ul>` : '<p class="muted small">Decide now, while it’s calm: “If it rains, then …”, “If the train is cancelled, then …”. On the day, it’s already decided.</p>'}
    <form class="addform" data-form="px-backup" data-p="${p.id}"><input type="text" name="ifs" placeholder="If … (the train is cancelled)" required aria-label="If"><input type="text" name="then" placeholder="then … (the 14:10 bus; call ahead)" required aria-label="Then"><button class="btn" type="submit">Add</button></form>`);
}
function pxAfterHtml(p) {
  const L = p.after || [], sz = p.sized;
  return pxSec('When it’s over', '', `${L.length ? `<ul class="pl-its">${L.map(x => `<li class="pl-it"><span class="txt small">${esc(x.text)}${pxMark(x)}</span>${pxDel('after', p.id, x.id, x.text)}</li>`).join('')}</ul>` : '<p class="muted small">Things that are easy to forget once you’re back: unpack, back things up, send the expense report, thank someone. They show on Today when it’s over.</p>'}
    <form class="addform" data-form="px-after" data-p="${p.id}"><input type="text" name="text" placeholder="e.g. Send the expense report" required aria-label="Something to do afterwards"><button class="btn" type="submit">Add</button></form>
    <details class="ep-sz"${sz ? ' open' : ''}><summary class="small">A task sized to how much there is afterwards</summary><form class="addform" data-form="px-sized" data-p="${p.id}"><input type="text" name="noun" value="${esc(sz ? sz.noun : '')}" placeholder="What you count, e.g. photos" aria-label="What you count"><label class="small">about<input type="number" inputmode="numeric" min="1" name="perHour" value="${sz ? +sz.perHour : ''}" placeholder="100" aria-label="How many in an hour"> an hour</label><button class="btn" type="submit">Save</button></form>
      ${sz ? `<p class="muted small">Afterwards Afloat asks how many ${esc(sz.noun)} there are and makes one task. <button type="button" class="link" data-act="px-sized-off" data-id="${p.id}">Turn off</button></p>` : ''}</details>`);
}
function pxDatesHtml(p) {
  const L = [...(p.dates || [])].sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  const topics = S.ui.pxTopics || '';
  return pxSec('Dates that matter', '', `${L.length ? `<ul class="pl-its">${L.map(d => `<li class="pl-it"><span class="txt small"><b>${esc(d.label)}</b> · ${esc(fmtD(d.date))}${d.time ? ' ' + esc(d.time) : ''}${d.cal ? ' <span class="muted">· in the calendar</span>' : ''}</span>${d.cal || d.date < dk ? '' : `<button type="button" class="tiny" data-act="px-date-cal" data-p="${p.id}" data-i="${d.id}" title="Put it in the calendar">📅 Add</button>`}${pxDel('dates', p.id, d.id, d.label)}</li>`).join('')}</ul>` : ''}
    <form class="addform" data-form="px-date" data-p="${p.id}"><input type="text" name="label" placeholder="e.g. Anatomy exam" required aria-label="What"><input type="date" name="date" required aria-label="Date"><input type="time" name="time" aria-label="Time (optional)"><button class="btn" type="submit">Add</button></form>`)
    + pxSec('Spread my topics', '', `<p class="muted small">List what you need to cover, one per line. Afloat spreads it from today back from the exam: new topics first, a quick recall from memory a couple of days and a week later, and the last two days for practice questions only, no new material.</p>
    <form class="px-spread" data-form="px-spread" data-p="${p.id}"><textarea name="topics" rows="4" placeholder="Cardiovascular system&#10;Respiratory system&#10;Nervous system" aria-label="Topics">${esc(topics)}</textarea>
      ${L.length > 1 ? `<label class="small">For which exam<select name="exam">${L.map(d => `<option value="${d.id}">${esc(d.label)} · ${esc(fmtD(d.date))}</option>`).join('')}</select></label>` : ''}
      <div class="actions"><button class="btn" type="submit">Spread them over the days</button>${sample ? `<button type="button" class="btn ghost" data-act="px-ask" data-id="${p.id}">✦ Or let Claude suggest</button>` : ''}</div></form>`);
}
function pxEditor(p) {
  const dl = p.kind === 'deadline', empty = !(p.steps || []).length && !(p.pack || []).length && !(p.stops || []).length && !(p.backup || []).length && !(p.after || []).length;
  const ppl = [...new Set([...everyone(), ...(p.who || [])])];
  const ov = pxOverall(p);
  let h = `<section class="card px-head"><div class="sec-head"><button type="button" class="link" data-act="px-back">‹ All projects</button><span class="progress px-pill${dk >= p.start && dk <= p.end && !p.closed ? ' on' : ''}">${esc(pxWords(p))}</span></div><h1 class="px-title"><span class="px-ico" aria-hidden="true">${PX_ICON[p.kind] || '🗓️'}</span> ${esc(p.title)}</h1>
    <p class="muted small">${esc(PX_KINDS[p.kind])} · ${esc(pxDates(p))}${p.place ? ' · ' + esc(p.place) : ''}${(p.who || []).length > 1 ? ' · ' + esc(p.who.join(', ')) : ''}</p>
    ${ov[1] ? `${pxBar(p)}<p class="small px-ready">${ov[0] >= ov[1] ? '<span class="tl-ok">✓ Everything is ready</span>' : `${ov[0]} of ${ov[1]} ready`}</p>` : ''}
    ${p.shared ? `<p class="small"><span class="badge ok">Together</span> <span class="muted">with ${esc(p.shared.names.filter(n => n !== me).join(', ') || 'others')}</span></p>` : ''}
    ${p.from ? '<p class="muted small">Linked to its calendar event: if the event moves, the plan moves with it.</p>' : ''}
    ${empty && sample && !dl ? `<div class="actions"><button type="button" class="btn accent" data-act="px-ask" data-id="${p.id}" ${S.ui.pxBusy ? 'disabled' : ''}>${S.ui.pxBusy === p.id ? '✦ Thinking…' : '✦ Suggest a first draft'}</button></div><p class="muted small">Claude suggests from what you wrote. Remove what doesn’t fit; add what’s missing.</p>` : S.ui.pxBusy === p.id ? '<p class="muted small">✦ Thinking…</p>' : ''}
    <details${S.ui.pxNew === p.id ? ' open' : ''}><summary class="small">Details: name, dates, place, who</summary>
      <form class="px-details" data-form="px-details" data-p="${p.id}"><input type="text" name="title" value="${esc(p.title)}" required aria-label="Name">
        <div class="addform"><label class="small">${dl ? 'First' : 'From'}<input type="date" name="start" value="${esc(p.start)}" required></label><label class="small">${dl ? 'Last' : 'To'}<input type="date" name="end" value="${esc(p.end)}"></label>${dl ? '' : `<label class="small">At<input type="time" name="time" value="${esc(p.time || '')}"></label><label class="small">Until<input type="time" name="endTime" value="${esc(p.endTime || '')}"></label>`}</div>
        ${dl ? '' : `<input type="text" name="place" value="${esc(p.place || '')}" placeholder="Where" aria-label="Where">`}
        <textarea name="note" rows="2" placeholder="In a few words: what it’s for, who you meet, what matters (Claude reads this)" aria-label="What it’s for">${esc(p.note || '')}</textarea>
        <div class="chips" role="group" aria-label="Who is going">${ppl.map(n => `<button type="button" class="tiny${(p.who || []).includes(n) ? ' on' : ''}" data-act="px-who" data-p="${p.id}" data-v="${esc(n)}" aria-pressed="${(p.who || []).includes(n)}">${esc(n)}</button>`).join('')}</div>
        <button class="btn ghost" type="submit">Save details</button></form></details></section>`;
  if (!empty) h += pxNav(p);
  if (dl) h += pxDatesHtml(p);
  h += pxStepsHtml(p);
  if (!dl) h += pxPackHtml(p) + pxLegsHtml(p) + pxStopsHtml(p);
  h += pxBackupHtml(p) + pxAfterHtml(p) + (dl ? '' : pcHtml(p)) + tgSection(p) + (dl ? '' : pxItinerary(p));
  h += `<section class="card px-foot"><details><summary class="small">Reuse for a new date, or put it away</summary>
    <form class="addform" data-form="px-copy" data-p="${p.id}"><label class="small">Same project, starting<input type="date" name="start" value="${esc(calAdd(p.end, 7))}" required></label><button class="btn ghost" type="submit">Copy it, unticked</button></form>
    <div class="actions"><button type="button" class="btn ghost" data-act="px-close" data-id="${p.id}">${p.closed ? 'Bring it back' : 'Put it away'}</button><button type="button" class="btn ghost" data-act="px-delete" data-id="${p.id}">${S.ui.pxArm === p.id ? (p.shared ? 'Tap again to leave it' : 'Tap again to delete') : p.shared ? 'Leave it (the others keep it)' : 'Delete'}</button></div></details></section>`;
  return h;
}
/* ---------- the event form: "go into planning mode" ---------- */
function pxFormHtml(ev) {
  const has = (ev.id || ev.gId) ? pxForEvent(ev) : null;
  if (has) return `<fieldset class="evsec"><legend>Project</legend><p class="small"><span class="tl-ok">✓ This has a project</span> · <button type="button" class="link" data-act="px-open" data-id="${has.id}">Open it</button></p></fieldset>`;
  const k = ev.planKind || pxKindOf(ev);
  return `<fieldset class="evsec"><legend>Project</legend><label class="small" style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-evf="plan" ${ev.plan ? 'checked' : ''}> Open the details when I save</label>
    ${ev.plan ? `<div class="chips" role="group" aria-label="What kind of project">${Object.entries(PX_KINDS).map(([v, l]) => `<button type="button" class="tiny${k === v ? ' on' : ''}" data-act="ev-plan-kind" data-v="${v}" aria-pressed="${k === v}">${l}</button>`).join('')}</div>` : ''}
    ${tgFormHtml(ev)}<p class="muted small">${ev.plan ? 'After saving you land in the project: how you get there, what to take, what to do there, what if, and afterwards. Ready for tomorrow then leaves this one alone.' : 'For a trip, an exam, or anything with a journey or things to bring.'}</p></fieldset>`;
}
/* ---------- forms and taps ---------- */
function pxForm(kind, f, fd) {
  const id = f.dataset.p, p = pxGet(id), text = pxClean(fd.get('text'));
  if (kind === 'px-new') {
    const k = S.ui.pxKind || 'outing', title = pxClean(fd.get('title'), 80), start = String(fd.get('start') || ''); if (!title || !start) return true;
    const end = String(fd.get('end') || ''); S.ui.pxTitle = ''; S.ui.pxStart = ''; pxCreate({ title, kind: k, start, end: end >= start ? end : start, time: String(fd.get('time') || '') }); return true; }
  if (!p) return false;
  if (kind === 'px-step') { if (!text) return true; const due = String(fd.get('due') || ''), d = fd.get('days');
    pxList(id, 'steps', L => [...L, { id: uid(), text, ...(due ? { due } : { days: d === '' || d == null ? null : Math.max(0, +d || 0) }) }]); return true; }
  if (kind === 'px-pack') { const items = pxSplit(fd.get('text')); if (!items.length) return true; pxList(id, 'pack', L => [...L, ...items.filter(t => !L.some(x => x.text.toLowerCase() === t.toLowerCase())).map(t => ({ id: uid(), text: t }))]); return true; }
  if (kind === 'px-stop') { if (!text) return true; const time = /^\d\d:\d\d$/.test(String(fd.get('time') || '')) ? fd.get('time') : ''; pxList(id, 'stops', L => [...L, { id: uid(), date: f.dataset.k || p.start, time, text }]); return true; }
  if (kind === 'px-backup') { const i = pxClean(fd.get('ifs')), t = pxClean(fd.get('then'), 120); if (!i || !t) return true; pxList(id, 'backup', L => [...L, { id: uid(), ifs: i, then: t }]); return true; }
  if (kind === 'px-after') { if (!text) return true; pxList(id, 'after', L => [...L, { id: uid(), text }]); return true; }
  if (kind === 'px-sized') { const noun = pxClean(fd.get('noun'), 30), per = Math.round(+fd.get('perHour') || 0); if (!noun || per < 1) { toast('Write what you count and about how many you get through in an hour.'); return true; } pxSave(id, { sized: { noun, perHour: per } }); return true; }
  if (kind === 'px-date') { const label = pxClean(fd.get('label'), 60), date = String(fd.get('date') || ''); if (!label || !date) return true; const time = /^\d\d:\d\d$/.test(String(fd.get('time') || '')) ? fd.get('time') : '';
    const dates = [...(p.dates || []), { id: uid(), label, date, time }], ds = dates.map(d => d.date).sort(); pxSave(id, { dates, start: ds[0], end: ds[ds.length - 1], time: dates.find(d => d.date === ds[0]).time || '' }); return true; }
  if (kind === 'px-spread') {
    const topics = pxSplit(String(fd.get('topics') || '').replace(/,/g, '\n')); S.ui.pxTopics = String(fd.get('topics') || ''); if (!topics.length) { toast('List a few topics first, one per line.'); render(true); return true; }
    const ds = [...(p.dates || [])].sort((a, b) => a.date.localeCompare(b.date)), ex = ds.find(d => d.id === fd.get('exam')) || ds[0]; if (!ex) { toast('Add the exam date first.'); return true; }
    const made = pxSpread(topics, dk > ex.date ? ex.date : dk, ex.date, ds.length > 1 ? ex.label : '').filter(s => !(p.steps || []).some(x => x.text === s.text && x.due === s.due));
    pxSave(id, { steps: [...(p.steps || []), ...made.map(s => ({ id: uid(), text: s.text, due: s.due }))] }); S.ui.pxTopics = ''; toast(`${made.length} steps, spread over the days.`); return true; }
  if (kind === 'px-details') {
    const dl = p.kind === 'deadline', start = String(fd.get('start') || p.start), end = String(fd.get('end') || '') >= start ? String(fd.get('end') || start) : start, patch = { title: pxClean(fd.get('title'), 80) || p.title, note: pxClean(fd.get('note'), 400) };
    if (!dl) Object.assign(patch, { start, end, time: String(fd.get('time') || ''), endTime: String(fd.get('endTime') || ''), place: pxClean(fd.get('place'), 160) });
    pxSave(id, patch); S.ui.pxNew = null; toast('Saved.'); return true; }
  if (kind === 'px-copy') { const q = pxCopy(id, String(fd.get('start') || '')); if (q) toast('Copied. Everything is unticked.'); return true; }
  if (kind === 'px-legadd') { const label = pxClean(fd.get('label'), 40); if (!label) return true; const time = /^\d\d:\d\d$/.test(String(fd.get('time') || '')) ? fd.get('time') : ''; pxList(id, 'legs', L => [...L, pxLeg({ label, date: String(fd.get('date') || p.start), time, place: pxClean(fd.get('place'), 160) })]); return true; }
  if (kind === 'px-legmeta') { const lid = f.dataset.i; pxList(id, 'legs', L => L.map(l => l.id === lid ? { ...l, label: pxClean(fd.get('label'), 40) || l.label, date: String(fd.get('date') || l.date), place: pxClean(fd.get('place'), 160) } : l)); return true; }
  if (kind === 'px-leg') {
    const lid = f.dataset.i, l = (p.legs || []).find(x => x.id === lid); if (!l) return true; const time = String(fd.get('time') || l.time || ''), r = pxLegCalc(time, { mins: fd.get('mins'), leave: fd.get('leave'), early: fd.get('early') });
    if (r.err) { toast(r.err); return true; }
    pxList(id, 'legs', L => L.map(x => x.id === lid ? { ...x, time, mins: r.mins, leave: r.leave, early: r.early, fixed: r.fixed } : x));
    const pl = (l.place || p.place); if (pl) saveHome('kits', { ...kits(), travel: { ...(kits().travel || {}), [placeKey(pl)]: r.mins } });
    S.ui.pxDraft = { ...(S.ui.pxDraft || {}), [lid]: null }; toast(`Leave at ${r.leave}.`); return true; }
  return false;
}
function tapPlans(a, el, e, r) {
  const id = el.dataset.id, pid = el.dataset.p, i = el.dataset.i;
  switch (a) {
    case 'px-kind': { const f = document.querySelector('form[data-form=px-new]'); if (f) { S.ui.pxTitle = f.elements.title.value; S.ui.pxStart = f.elements.start.value; } S.ui.pxKind = el.dataset.v; render(true); return true; }
    case 'px-open': S.ui.pxOpen = id; if (S.view !== 'plans') location.hash = 'plans'; render(true); scrollTo(0, 0); return true;
    case 'px-fold': { const k = S.ui.pxOpen + ':' + el.dataset.s; S.ui.pxFold = { ...(S.ui.pxFold || {}), [k]: !pxFolded(el.dataset.s) }; render(true); return true; }
    case 'px-jump': { const s = el.dataset.s, go = () => { const n = document.getElementById('px-s-' + s); if (n) n.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); };
      if (pxFolded(s)) { S.ui.pxFold = { ...S.ui.pxFold, [S.ui.pxOpen + ':' + s]: false }; render(true); } setTimeout(go, 30); return true; }
    case 'px-back': S.ui.pxOpen = null; S.ui.pxNew = null; render(true); scrollTo(0, 0); return true;
    case 'px-from-ev': { const ev = allEvents().find(x => (id && x.id === id) || (el.dataset.g && x.gId === el.dataset.g)); if (ev) { pxFromEvent(ev); scrollTo(0, 0); } return true; }
    case 'px-no': saveHome('planner', { ...pxDoc(), no: { ...(pxDoc().no || {}), [el.dataset.key]: 1 } }); return true;
    case 'px-ask': pxAsk(id, false); return true;
    case 'px-tick': { const k = el.dataset.k === 'pack' ? 'pack' : 'steps'; pxList(pid, k, L => L.map(x => x.id === i ? (x.done ? (({ done, ...rest }) => rest)(x) : { ...x, done: true }) : x)); return true; }
    case 'px-del': { const k = el.dataset.k; if (['steps', 'pack', 'legs', 'stops', 'backup', 'after', 'dates', 'costs'].includes(k)) {
      pxList(pid, k, L => L.filter(x => x.id !== i)); if (k === 'dates') { const p = pxGet(pid), ds = (p.dates || []).map(d => d.date).sort(); if (ds.length) pxSave(pid, { start: ds[0], end: ds[ds.length - 1] }); } } return true; }
    case 'px-main': pxList(pid, 'stops', L => L.map(x => x.id === i ? { ...x, main: !x.main } : x)); return true;
    case 'px-mode': pxList(pid, 'legs', L => L.map(x => x.id === i ? { ...x, mode: x.mode === el.dataset.v ? '' : el.dataset.v } : x)); return true;
    case 'px-who': { const p = pxGet(pid); if (p) { const w = p.who || []; pxSave(pid, { who: w.includes(el.dataset.v) ? (w.length > 1 ? w.filter(x => x !== el.dataset.v) : w) : [...w, el.dataset.v] }); } return true; }
    case 'px-sized-off': pxSave(id, { sized: null }); return true;
    case 'px-close': { const p = pxGet(id); if (p) { pxSave(id, { closed: !p.closed }); if (!p.closed) S.ui.pxOpen = null; } return true; }
    case 'px-delete': { if (S.ui.pxArm !== id) { S.ui.pxArm = id; render(true); return true; } S.ui.pxArm = null; if (S.tg.docs[id]) { tgLeave(id); return true; } const D = pxDoc(), plans = { ...(D.plans || {}) }; delete plans[id]; saveHome('planner', { ...D, plans }); S.ui.pxOpen = null; pxSync(); toast('Project deleted.'); return true; }
    case 'ev-plan-kind': if (S.ui.ev) { S.ui.ev.planKind = el.dataset.v; render(true); } return true;
    case 'px-photo': S.ui.capture = true; S.ui.nb = { step: 'pick', files: [], text: '', study: 1 }; render(true); scrollTo(0, 0); return true;
    case 'px-st': { const X = nb().study, x = X && X.items.find(y => y.id === i); if (!x) return true; if (el.dataset.r) { const r = x.rem.find(y => y.id === el.dataset.r); if (r) r.on = !!el.checked; } else { x.on = !!el.checked; render(true); } return true; }
    case 'px-st-plan': if (nb().study) nb().study.plan = !!el.checked; return true;
    case 'px-st-save': pxStudySave(); return true;
    case 'px-focus': { const p = pxGet(pid), s = p && (p.steps || []).find(x => x.id === i); if (!s) return true;
      S.ui.fx = { area: '_other', aname: p.title, intent: s.text, step: '', card: '', rhythm: 'flow', share: S.ui.share !== false, px: { p: pid, i } }; S.ui.fxSug = null; location.hash = 'focus'; render(true); scrollTo(0, 0); return true; }
    case 'px-shop': toShop(el.dataset.text); return true;
    case 'px-wx-add': pxList(pid, 'pack', L => L.some(x => x.text.toLowerCase() === el.dataset.text.toLowerCase()) ? L : [...L, { id: uid(), text: el.dataset.text, wx: 1 }]); return true;
    case 'px-date-cal': { const p = pxGet(pid), d = p && (p.dates || []).find(x => x.id === i); if (!d) return true;
      S.ui.ev = { title: d.label, kind: 'other', who: p.who && p.who.length ? p.who : [me], date: d.date, endDate: d.date, allDay: !d.time, start: d.time || '', end: d.time ? mm2t(toMin(d.time) + 120) : '', place: '', notes: `From the plan “${p.title}” in Afloat` };
      (async () => { try { await saveEvent(); pxList(pid, 'dates', L => L.map(x => x.id === i ? { ...x, cal: 1 } : x)); toast('On the calendar.'); } catch (e) { toast('That didn’t save.'); } S.ui.ev = null; location.hash = 'plans'; render(true); })(); return true; }
  }
  return false;
}
/* a copy of a plan for another date: everything unticked, relative steps keep their lead time, fixed dates, legs and stops shift */
function pxCopy(id, start) {
  const p = pxGet(id); if (!p || !start) return null; const n = dayDiffK(p.start, start), sh = k => k ? calAdd(k, n) : k, nid = () => uid();
  const { shared, ...pp } = p, q = { ...pp, id: nid(), start, end: sh(p.end), from: null, made: Date.now(), closed: false, by: me, steps: (p.steps || []).map(({ done, ...s }) => ({ ...s, id: nid(), ...(s.due ? { due: sh(s.due) } : {}) })), pack: (p.pack || []).map(({ done, ...s }) => ({ ...s, id: nid() })),
    legs: (p.legs || []).map(l => ({ ...l, id: nid(), date: sh(l.date) })), stops: (p.stops || []).map(s => ({ ...s, id: nid(), date: sh(s.date) })), backup: (p.backup || []).map(b => ({ ...b, id: nid() })), after: (p.after || []).map(x => ({ ...x, id: nid() })), dates: (p.dates || []).map(d => ({ ...d, id: nid(), date: sh(d.date) })), costs: [] };
  const D = pxDoc(); saveHome('planner', { ...D, plans: { ...(D.plans || {}), [q.id]: q } }); S.ui.pxOpen = q.id; pxSync(); return q;
}
/* ---------- a study plan from a photo (11 Nov 2026): a syllabus, an exam timetable or a list of hand-in dates, read by Claude in
   From a photo (capture.js). Every exam and deadline is offered for the calendar with reminders Afloat picks by kind (ticked, untick
   any), and one exam-and-deadline plan with the topics spread from today. Nothing is saved until "Add". ---------- */
function pxStudyRems(x) {
  const t = x.title, out = [], add = (days, time, title) => { const date = calAdd(x.date, -days); if (date >= dk && !(date === dk && toMin(time) <= nowMin())) out.push({ id: uid(), on: true, title, date, time }); };
  if (x.type === 'exam') { add(7, '09:00', `${t} in a week: practice questions from now on`); add(1, '19:00', `${t} tomorrow${x.time ? ' at ' + x.time : ''}: ID, pens, where it is`); }
  else if (x.type === 'assignment') { add(3, '09:00', `${t}: due in 3 days`); add(1, '09:00', `${t}: due tomorrow${x.time ? ' at ' + x.time : ''}`); }
  return out;
}
function pxStudyFrom(out, dls) {
  const items = dls.map(x => { const it = { id: uid(), on: true, title: pxClean(x.title, 80), course: pxClean(x.course, 60), date: x.date, time: /^\d{1,2}:\d{2}$/.test(x.time || '') ? x.time.padStart(5, '0') : '', type: ['exam', 'assignment'].includes(x.type) ? x.type : 'other', place: pxClean(x.place, 120),
    topics: (Array.isArray(x.topics) ? x.topics : []).map(t => pxClean(t, 60)).filter(Boolean).slice(0, 12) }; it.rem = pxStudyRems(it); return it; }).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  return { title: pxClean(out.plan_title, 60) || 'Study plan', items, plan: true };
}
function pxStudyReview(X) {
  const tp = { exam: 'Exam', assignment: 'Hand in', other: 'Date' }, n = X.items.filter(x => x.on).length, topics = X.items.filter(x => x.on).reduce((s, x) => s + x.topics.length, 0);
  return `<p class="small">A study plan: ${X.items.length} date${X.items.length === 1 ? '' : 's'}. Untick anything you don’t need.</p>
    <ul class="bf-list nb-l px-study">${X.items.map(x => `<li><label class="nb-row"><input type="checkbox" data-act="px-st" data-i="${x.id}" ${x.on ? 'checked' : ''}> <span><b>${esc(tp[x.type])}: ${esc(x.title)}</b> · ${esc(fmtD(x.date))}${x.time ? ' ' + esc(x.time) : ''}${x.place ? ' · ' + esc(x.place) : ''}${x.topics.length ? ` <span class="muted small">· ${x.topics.length} topic${x.topics.length > 1 ? 's' : ''}</span>` : ''}</span></label>
      ${x.on && x.rem.length ? `<ul class="px-st-rem">${x.rem.map(r => `<li><label class="small nb-row"><input type="checkbox" data-act="px-st" data-i="${x.id}" data-r="${r.id}" ${r.on ? 'checked' : ''}> <span>🔔 ${esc(fmtD(r.date))} ${esc(r.time)}: ${esc(r.title)}</span></label></li>`).join('')}</ul>` : ''}</li>`).join('')}</ul>
    <label class="small nb-row"><input type="checkbox" data-act="px-st-plan" ${X.plan ? 'checked' : ''}> <span><b>Make it a project</b> (Ahead → Projects): the dates, ${topics ? `${topics} topics spread from today (learn once, recall from memory 2 and 6 days later, the last two days practice only)` : 'with room for your topics'}, and a step on Today each day.</span></label>
    <label class="small">Name<input type="text" id="pxStTitle" value="${esc(X.title)}"></label>
    <div class="actions"><button class="btn accent" data-act="px-st-save" ${X.busy ? 'disabled' : ''}>${X.busy ? 'Adding…' : `Add ${n} to the calendar`}</button></div>`;
}
async function pxStudySave() {
  const N = nb(), X = N.study; if (!X || X.busy) return; X.title = pxClean(($('#pxStTitle') || {}).value, 60) || X.title; X.busy = true; render(true);
  const on = X.items.filter(x => x.on); let n = 0;
  for (const x of on) {
    S.ui.ev = { title: x.title, kind: 'other', who: [me], date: x.date, endDate: x.date, allDay: !x.time, start: x.time, end: x.time ? mm2t(toMin(x.time) + (x.type === 'exam' ? 120 : 30)) : '', place: x.place, notes: [x.course, x.topics.length ? 'Topics: ' + x.topics.join(', ') : '', 'From a study plan in Afloat'].filter(Boolean).join('\n') };
    try { await saveEvent(); n++; } catch (e) { console.warn(e); }
  }
  S.ui.ev = null;
  const rems = on.flatMap(x => x.rem.filter(r => r.on)); if (rems.length) oneoffAdd(rems);
  let plan = null;
  if (X.plan && on.length) {
    const ds = on.map(x => x.date).sort(); plan = pxCreate({ title: X.title, kind: 'deadline', start: ds[0], end: ds[ds.length - 1], time: on[0].time });
    const steps = [];
    for (const x of on) {
      if (x.type === 'exam' && x.topics.length) pxSpread(x.topics, dk > x.date ? x.date : dk, x.date, on.filter(y => y.type === 'exam').length > 1 ? x.title : '').forEach(s => steps.push({ id: uid(), text: s.text, due: s.due }));
      else if (x.type === 'assignment') { const d = dayDiffK(dk, x.date); if (d >= 6) steps.push({ id: uid(), text: `Start: ${x.title}, a rough first go`, due: calAdd(x.date, -Math.min(10, Math.floor(d * 0.6))) }); if (d >= 2) steps.push({ id: uid(), text: `Finish and check: ${x.title}`, due: calAdd(x.date, -2) }); }
    }
    pxSave(plan.id, { dates: on.map(x => ({ id: uid(), label: x.title, date: x.date, time: x.time, cal: 1 })), steps: steps.sort((a, b) => a.due.localeCompare(b.due)) });
  }
  S.ui.nb = null; S.ui.capture = false;
  if (plan) { S.ui.pxOpen = plan.id; location.hash = 'plans'; }
  render(true); scrollTo(0, 0);
  toast([`${n} on the calendar`, rems.length ? `${rems.length} reminder${rems.length > 1 ? 's' : ''}` : '', plan ? 'and a study plan' : ''].filter(Boolean).join(', ') + '.');
}

/* the forecast there for a day of the plan (the next 7 days), and what it calls for, one tap into What to take */
function pxWx(p, k) {
  if (p.kind === 'deadline' || k < dk || dayDiffK(dk, k) > 6) return '';
  const w = wxSpan(wxTown(p.place), k, 9 * 60, 20 * 60); if (!w) return '';
  const kids = kidsList().some(n => (p.who || []).includes(n)), want = wxItems(w, kids).filter(x => !(p.pack || []).some(y => y.text.toLowerCase() === x.text.toLowerCase()));
  return `<p class="small wx">${wxIcon(w)} ${esc(w.town)}: <b>${w.tMin === w.tMax ? w.tMin : `${w.tMin}–${w.tMax}`} °C</b>, ${esc(wxWord(w.code))}${w.p >= 30 ? `, ${w.p}% chance of rain` : ''}${want.map(x => ` <button type="button" class="tiny" data-act="px-wx-add" data-p="${p.id}" data-text="${esc(x.text)}">+ ${esc(x.text)}</button>`).join('')}</p>`;
}
/* away on a trip: Today's setup counts the days of a trip plan you're going on as "away from home" */
const pxAwayOn = (n, k) => { try { return pxAll().some(p => p.kind === 'trip' && !p.closed && p.start < p.end && p.start <= k && p.end >= k && (p.who || []).includes(n)); } catch { return false; } };
