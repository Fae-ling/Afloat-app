/* Afloat · app/plan-tomorrow.js · Plan tomorrow: evening planning, one card per event that needs something.
   Plain script: shares one scope with the other app/*.js files (loaded in order by index.html). See CLAUDE.md. */
/* ---------- plan tomorrow (evening) → shows up in the morning ---------- */
/* What each kind of event usually needs. An item is a string (for everyone) or { t, kids }: t for anyone, kids for a
   household with children (either may be left out; {the} becomes "the girls", "the kids" or the child's name). A kind with
   kids: 1 only applies to a household with children. Nothing here is specific to one household (the files are public). */
const PLAN_KINDS = {
  doctor: { label: 'Doctor or dentist', title: 'Doctor or dentist', tonight: [{ t: 'Find the insurance card', kids: 'Find the insurance cards' }, { t: 'Check the time and address', kids: 'Check the time and address; tell the kindergarten if {the} will be late' }, { kids: 'Pack water, a snack and a comfort toy' }], morning: ['Breakfast early enough to leave on time'], launch: [{ t: 'Insurance card', kids: 'Insurance cards' }, { kids: 'Snack bag and water' }, { kids: 'Comfort toys' }] },
  early: { label: 'Early start', title: 'Early start', tonight: ['Set an alarm, and a backup', 'Clothes out for tomorrow', 'Grab-and-go breakfast ready'], morning: [], launch: [] },
  outing: { label: 'Outing or trip', title: 'Trip', tonight: ['Check tomorrow’s weather', { t: 'Day bag: water, snacks, a layer for the weather', kids: 'Day bag: spare clothes, wipes, snacks, water' }, 'Charge phones and the power bank'], morning: [{ t: 'Fill the water bottle', kids: 'Fill the water bottles' }], launch: ['Day bag', 'Tickets or booking'] },
  kinder: { kids: 1, label: 'Kindergarten special day', title: 'Kindergarten special day', tonight: ['Read the kindergarten message again', 'Pack the special item (costume, form, money, photo)'], morning: [], launch: ['The special item for kindergarten'] },
  guests: { label: 'Guests coming', title: 'Guests', tonight: ['10-minute reset: living room and downstairs toilet', 'Check there’s something to offer them'], morning: ['Clear the hallway and entrance'], launch: [] },
  work: { label: 'Different work day', title: 'Work: different schedule', tonight: ['Check what’s different and what to bring'], morning: [], launch: [] },
  other: { label: 'Something else', title: '', tonight: [], morning: [], launch: [] },
};
const planText = x => { const k = kidsList().length > 0, t = typeof x === 'string' ? x : (k && x.kids) || x.t || ''; return String(t).replace(/\{the\}/g, theKids()); };
const PL_LISTS = { tonight: 'Prep tonight', morning: 'Tomorrow morning', launch: 'Extra things to take', top: 'Tomorrow’s top three' };
let tk = '';
const tKey = () => { const d = shifted(); d.setDate(d.getDate() + 1); return keyOf(d); };
const planOf = (which, n) => (((which === 'today' ? S.planT : S.planN) || {})[n]) || {};
const leaveBy = e => { if (!e.time) return ''; if (e.journey && e.journey.leave) return e.journey.leave; const m = toMin(e.time) - (+e.travel || 0) - 5; /* same as leaveAt() in going-out.js */ return `${pad(Math.floor(((m % 1440) + 1440) % 1440 / 60))}:${pad(((m % 60) + 60) % 60)}`; };
const minusMin = (t, n) => { const m = toMin(t) - n; return `${pad(Math.floor(((m % 1440) + 1440) % 1440 / 60))}:${pad(((m % 60) + 60) % 60)}`; };
function savePlan(patch) {
  S.planN = { ...(S.planN || {}), [me]: { ...planOf('next', me), ...patch } };
  mergeDoc('plans/' + tk, { [me]: patch }); epSync(); render(true);
}
const evLine = e => `${esc(e.title)}${e.time ? ` at ${esc(e.time)}` : ''}${e.time && e.travel != null ? ` · leave by <b>${leaveBy(e)}</b>` : ''}`;
/* Plan tomorrow also looks at the viewer's own Google calendar for tomorrow (only they see it), even when "show my own calendar" is off */
S.planMine = { k: '', at: 0, events: [], status: 'idle' };
function loadPlanMine(force) {
  if (!mcp || S.planMine.status === 'loading' || (!force && S.planMine.k === tk && Date.now() - S.planMine.at < 3 * 6e4)) return;
  const k = tk; S.planMine = { ...S.planMine, status: 'loading' };
  mcp.callTool(GC, 'list_events', { startTime: `${dk}T00:00:00`, endTime: `${calAdd(k, 1)}T00:00:00`, orderBy: 'startTime', pageSize: 50 }, { cache: false })
    .then(r => { S.planMine = { k, at: Date.now(), status: 'ok', events: ((r.payload || {}).events || []).filter(x => x.status !== 'cancelled').map(x => ({ ...normG(x), kind: 'mine', src: 'mine' })) }; syncPlan(); render(); })
    .catch(() => { S.planMine = { k, at: Date.now(), status: 'error', events: [] }; });
}
/* Plan entries made with "Plan for it" remember their calendar event (from). When it's gone from the calendar the entry
   comes off the plan, and its reminders with it; when it moved, the plan's time moves too. Entries typed in by hand have
   no event behind them and stay as they are. Only acts on a fresh, whole answer from the calendar it came from. */
const planFrom = e => { const g = e.gInst || e.gId || '', id = e.id || ''; return g || id ? { g, id, src: e.src || 'afloat' } : null; };
function savePlanFor(which, patch) {
  const k = which === 'today' ? dk : tk, key = which === 'today' ? 'planT' : 'planN';
  S[key] = { ...(S[key] || {}), [me]: { ...planOf(which, me), ...patch } };
  mergeDoc('plans/' + k, { [me]: patch });
}
function syncPlan() {
  if (!meValid()) return;
  const R = S.gcal.range, mineOk = S.planMine.status === 'ok' && S.planMine.k === tk;
  for (const which of ['today', 'next']) {
    const k = which === 'today' ? dk : tk, evs = planOf(which, me).events || [];
    if (!evs.some(x => x.from || (x.time && / · /.test(x.title || '')))) continue;
    const pool = [...allEvents(), ...(mineOk ? S.planMine.events : [])], keep = [], dropped = [], movedEnts = []; let moved = 0;
    for (let p of evs) {
      let f = p.from;
      if (!f && p.time && / · /.test(p.title || '')) { /* made by "Plan for it" before entries remembered their event: title + " · who". Find it by title, else it's gone */
        const e0 = pool.find(x => shortTitle(x.title).toLowerCase() === planTitle(p) && x.date <= k && (x.endDate || x.date) >= k);
        if (e0) f = planFrom(e0);
        else { if (!!R && k >= R[0] && k < R[1] && S.gcal.status !== 'loading' && mineOk) dropped.push(p); else keep.push(p); continue; }
        p = { ...p, from: f };
      }
      if (!f) { keep.push(p); continue; }
      const e = pool.find(x => (f.g && (x.gInst === f.g || x.gId === f.g)) || (f.id && x.id === f.id));
      const sure = !f.g ? true : f.src === 'mine' ? mineOk : !!R && k >= R[0] && k < R[1] && S.gcal.status !== 'loading';
      if (!e) { (sure ? dropped : keep).push(p); continue; }
      if (e.date > k || (e.endDate || e.date) < k) { dropped.push(p); continue; } /* moved to another day */
      if (!e.allDay && e.start && p.time && p.time !== e.start) { const q = epShift(p, e.start); keep.push(q); movedEnts.push(q); moved++; } else keep.push(p);
    }
    if (!dropped.length && !moved) continue;
    const gone = new Set(dropped.map(p => p.id)), cur = planOf(which, me);
    savePlanFor(which, { events: keep, ...Object.fromEntries(PL_LS.filter(l => (cur[l] || []).some(x => gone.has(x.ev))).map(l => [l, cur[l].filter(x => !gone.has(x.ev))])) });
    dropped.forEach(p => remDel(x => x.ref === 'plan:' + p.id));
    movedEnts.forEach(q => { if (remAll().some(x => x.ref === 'plan:' + q.id)) { remDel(x => x.ref === 'plan:' + q.id); planRemind(q); } });
    if (dropped.length) toast(`${dropped.map(p => '“' + String(p.title).split(' · ')[0] + '”').join(', ')} ${dropped.length === 1 ? 'isn’t' : 'aren’t'} in the calendar any more, so ${dropped.length === 1 ? 'it’s' : 'they’re'} off ${which === 'today' ? 'today’s' : 'tomorrow’s'} plan.`);
    render(true);
  }
  pxSync();
}
const mineTomorrow = () => S.planMine.k === tk ? S.planMine.events.filter(e => e.date <= tk && (e.endDate || e.date) >= tk && !eventsOn(tk).some(x => x.gId === e.gId || (shortTitle(x.title) === e.title && (x.start || '') === (e.start || '')))) : [];
/* ---- Plan tomorrow: one card for each event that needs something. "Plan for it" adds what Afloat suggests and the reminders
   in one tap; everything added belongs to that event (item.ev = the plan entry's id), so it leaves with the event.
   Things that aren't in the calendar go in one free-text field; Claude (or a few keywords) works out what they need. */
const PL_DETECT = [['doctor', /doctor|dentist|zubař|zubní|lékař|doktor|pediatr|ordinac/i], ['kinder', /kindergarten|školk|karneval|kostým|costume|besídk|ředitelsk/i], ['guests', /guests?\b|hosté|hosty|návštěv|visitors/i], ['outing', /\btrip\b|outing|výlet|\bzoo\b/i], ['early', /early start|brzy ráno|brzký/i]];
const planKindOf = e => (PL_DETECT.find(([k, re]) => (!PLAN_KINDS[k].kids || kidsList().length) && re.test(String(e.title || ''))) || [])[0] || null;
const PL_WHEN = { tonight: 'Tonight', morning: 'Morning', launch: 'To take' }, PL_CYCLE = { tonight: 'morning', morning: 'launch', launch: 'tonight' }, PL_LS = ['tonight', 'morning', 'launch'];
/* the prep lists only: the “to take” defaults repeat what tonight’s prep already packs, so they stay out (Claude’s extras can still go in To take) */
const planDefaults = e => { const k = planKindOf(e), K = k && PLAN_KINDS[k]; return K ? ['tonight', 'morning'].flatMap(l => K[l].map(planText).filter(Boolean).map(text => ({ l, text }))) : []; };
/* guests are coming to you: no journey, so no leave time or leave reminders */
const planAtHome = e => planKindOf(e) === 'guests' && !e.place;
const planNeeds = e => !e.allDay && !!e.start && !e.isDate && !!(e.place || isGig(e) || kidsOn(e).length || planKindOf(e));
const planEntryFor = (e, evs) => evs.find(x => x.from && ((x.from.id && x.from.id === e.id) || (x.from.g && (x.from.g === e.gInst || x.from.g === e.gId)))) || evs.find(x => x.planId && pxMatch(pxGet(x.planId) || {}, e)) || evs.find(x => x.time && planTitle(x) === shortTitle(e.title).toLowerCase());
const planItemsOf = (p, evId) => PL_LS.flatMap(l => (p[l] || []).filter(x => evId ? x.ev === evId : !x.ev).map(x => ({ ...x, l })));
const planParseTime = s => { const m = /\b([01]?\d|2[0-3]):([0-5]\d)\b/.exec(s); if (m) return `${pad(+m[1])}:${m[2]}`; const a = /\b(1[0-2]|[1-9])\s?(am|pm)\b/i.exec(s); return a ? `${pad(+a[1] % 12 + (/pm/i.test(a[2]) ? 12 : 0))}:00` : ''; };
function planRemind(ent) {
  if (!ent.time || ent.travel == null) return; const lv = leaveBy(ent), t = shortTitle(ent.title); /* no journey (guests at home): nothing to leave for */
  remAdd([{ text: `Start getting ready for ${t}`, at: minusMin(lv, 30), date: tk, live: true, src: 'plan', ref: 'plan:' + ent.id }, { text: `Leave now for ${t}`, at: lv, date: tk, live: true, src: 'plan', ref: 'plan:' + ent.id }]);
}
function planAddEv(e) {
  const p = planOf('next', me), id = uid(), timed = !e.allDay && !!e.start;
  const tp = epTplApply(e.title), ent = { id, title: shortTitle(e.title) + (whoStr(e) ? ' · ' + whoStr(e) : ''), time: timed ? e.start : '', travel: timed && !planAtHome(e) ? travelOf(e).m : null, place: e.place || '', end: timed ? e.end || '' : '', ...(tp ? { during: tp.during, after: tp.after, ...(tp.sized ? { sized: tp.sized } : {}) } : {}), from: planFrom(e) };
  const add = Object.fromEntries(PL_LS.map(l => [l, [...(p[l] || [])]]));
  for (const d of (tp ? tp.lists : planDefaults(e))) add[d.l].push({ id: uid(), text: d.text, ev: id, def: true });
  savePlan({ events: [...(p.events || []), ent], ...add });
  if (ent.time && ent.travel != null) { planRemind(ent); toast(`Planned. Reminders at ${minusMin(leaveBy(ent), 30)} and ${leaveBy(ent)}.`); } else toast('Added to tomorrow’s plan.');
}
/* something that isn't in the calendar: an entry at once (with what a few keywords suggest), then Claude tidies it and adds what it would need */
function planFree(text) {
  const p = planOf('next', me), id = uid(), time = planParseTime(text), ent = { id, title: (time ? text.replace(/\s+(?:at|v|ve|@)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*$/i, '') : text).slice(0, 80), time, travel: time && !planAtHome({ title: text }) ? 20 : null };
  const add = Object.fromEntries(PL_LS.map(l => [l, [...(p[l] || [])]]));
  for (const d of planDefaults({ title: text })) add[d.l].push({ id: uid(), text: d.text, ev: id, def: true });
  savePlan({ events: [...(p.events || []), ent], ...add });
  if (time) planRemind(ent);
  if (sample) planThink(id, text);
}
async function planThink(id, text) {
  S.ui.planBusy = id; render(true);
  const q = `${houseFacts()} They are planning tomorrow, ${new Date(tk + 'T12:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}. They typed something that is not in their calendar: "${text}".
Reply with only a JSON object: {"title": a short tidy title in their language (at most 6 words), "time": "HH:MM" if a start time is clearly stated, otherwise "", "tonight": [things to prepare tonight], "morning": [things to do tomorrow morning], "take": [things to take along]}. At most 3 items per list, at most 6 words each, only what is really needed and easy to forget, nothing generic. Empty lists are fine.`;
  try {
    const out = await askClaude(q, { feature: 'plan' }), o = out && !Array.isArray(out) ? out : {}, cur = planOf('next', me), ent = (cur.events || []).find(x => x.id === id); if (!ent) return;
    const clean = a => (Array.isArray(a) ? a : []).map(x => String(x).trim()).filter(Boolean).slice(0, 3), T = { tonight: clean(o.tonight), morning: clean(o.morning), launch: clean(o.take) };
    const title = String(o.title || '').trim().slice(0, 80), time = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(o.time || '')) ? o.time : '', patch = {};
    if (PL_LS.some(l => T[l].length)) for (const l of PL_LS) patch[l] = [...(cur[l] || []).filter(x => !(x.ev === id && x.def)), ...T[l].map(t => ({ id: uid(), text: t, ev: id }))];
    const e2 = { ...ent, ...(title ? { title } : {}), ...(time && !ent.time ? { time, travel: 20 } : {}) };
    if (title || e2.time !== ent.time) patch.events = (cur.events || []).map(x => x.id === id ? e2 : x);
    if (Object.keys(patch).length) savePlan(patch);
    if (e2.time && !ent.time) planRemind(e2);
  } catch (e) { toast(claudeWhy(e)); }
  finally { S.ui.planBusy = null; render(true); }
}
const planItemRow = x => `<li class="pl-it"><span class="txt small">${esc(x.text)}</span><button type="button" class="tiny pl-tag" data-act="plan-move" data-l="${x.l}" data-id="${x.id}" aria-label="${esc(x.text)}: ${PL_WHEN[x.l]}. Tap to move it">${PL_WHEN[x.l]}</button><button type="button" class="chip x row-x" data-act="plan-del" data-l="${x.l}" data-id="${x.id}" aria-label="Remove ${esc(x.text)}">✕</button></li>`;
/* a planned event: its leave time and reminders, what's added to it, and a place to add more */
function planBody(ent, p, more = []) {
  if (ent.planId) return pxTomorrowBody(ent);
  const items = planItemsOf(p, ent.id), hasRem = remAll().some(x => x.ref === 'plan:' + ent.id), timed = ent.time && ent.travel != null;
  return `${timed ? `<p class="muted small">Leave by <b>${leaveBy(ent)}</b> · ${hasRem ? `reminders at ${minusMin(leaveBy(ent), 30)} and ${leaveBy(ent)}` : 'no reminders'} <button type="button" class="link" data-act="plan-rem" data-id="${ent.id}">${hasRem ? 'Turn off' : 'Remind me'}</button></p>` : ''}
    ${items.length ? `<ul class="pl-its">${items.map(planItemRow).join('')}</ul>` : ''}
    ${S.ui.planBusy === ent.id ? '<p class="muted small">✦ Thinking about this one…</p>' : ''}
    ${more.length ? `<div class="chips"><span class="muted small">✦ Maybe also:</span>${more.slice(0, 4).map(t => `<button type="button" class="tiny" data-act="plan-sug" data-l="launch" data-ev="${ent.id}" data-text="${esc(t)}">+ ${esc(t)}</button>`).join('')}</div>` : ''}
    ${epBody(ent)}
    <form class="addform" data-form="plan-evadd" data-ev="${ent.id}"><input type="text" name="text" placeholder="Add something for this" required aria-label="Add something for ${esc(shortTitle(ent.title))}"><button class="btn" type="submit">Add</button></form>`;
}
function planEvCard(e, ent, p) {
  const kk = kidsOn(e), head = `<div class="pl-ev-h"><div><b>${esc(shortTitle(e.title))}</b> <span class="muted small">${esc(e.start || '')}${e.end ? '–' + esc(e.end) : ''}${kk.length ? ' · with ' + esc(kk.join(' and ')) : ''}${e.place ? ' · ' + esc(e.place) : ''}</span></div>${ent ? (ent.planId ? '<span class="small"><span class="tl-ok">✓ planned</span></span>' : `<span class="small"><span class="tl-ok">✓ planned</span> · <button type="button" class="link" data-act="plan-del" data-l="events" data-id="${ent.id}">Take off</button></span>`) : ''}</div>`;
  if (ent) { const o = outingsOn(tk).find(x => outId(x) === outId(e)); if (o) goAutoAsk(o);
    const have = planItemsOf(p, ent.id).map(x => x.text.toLowerCase()), more = o ? (goSuggOf(o) || []).filter(t => !have.includes(String(t).toLowerCase())) : [];
    return `<div class="pl-ev on">${head}${planBody(ent, p, more)}</div>`; }
  const tpl = epTplApply(e.title), def = tpl ? tpl.lists : planDefaults(e), lv = e.start && !planAtHome(e) ? mm2t(leaveAt(e)) : '';
  return `<div class="pl-ev">${head}
    ${def.length ? `<p class="muted small">Adds: ${def.slice(0, 3).map(d => esc(d.text)).join(' · ')}${def.length > 3 ? ` · and ${def.length - 3} more` : ''}</p>` : ''}
    <div class="actions"><button type="button" class="btn" data-act="plan-from-ev" data-id="${esc(e.id || '')}" data-g="${esc(e.gId || '')}">Get me ready</button><button type="button" class="btn ghost" data-act="px-from-ev" data-id="${esc(e.id || '')}" data-g="${esc(e.gId || '')}">More detail</button>${lv ? `<span class="muted small">Leave by <b>${lv}</b>${travelOf(e).known || epJourney(e) ? '' : ' (a guess)'}, with reminders</span>` : ''}</div></div>`;
}
const planEntCard = (ent, p) => `<div class="pl-ev on"><div class="pl-ev-h"><div><b>${esc(ent.title)}</b>${ent.time ? ` <span class="muted small">${esc(ent.time)}</span>` : ''}</div>${ent.planId ? '' : `<button type="button" class="link" data-act="plan-del" data-l="events" data-id="${ent.id}">Take off the plan</button>`}</div>${planBody(ent, p)}</div>`;
function planCard() {
  if (!meValid()) return '';
  const td = new Date(tk + 'T12:00'), tdow = (td.getDay() + 6) % 7, p = planOf('next', me), other = otherOf(me), op = other ? planOf('next', other) : {};
  const label = td.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
  loadPlanMine();
  const rows = dayRows(tk), warn = [], known = [];
  for (const g of gapsOn(tk)) warn.push(`<b>${ourHome() ? 'Hlídání' : 'Childcare'} needed</b> ${esc(fmtGap(g))}: you’re both busy and nobody has ${theKids()}.`);
  for (const f of dayFacts(tk)) (f.warn ? warn : known).push(esc(f.t));
  if (leavesHome(me, tk) && fits(prof(me).launch, tk).length) known.push('Your launch list will be at the door.');
  const te = evening(tdow); if (te) known.push(te.type === 'date' ? 'Tomorrow evening is date night.' : te.who === me ? 'Tomorrow evening is your own time.' : `Tomorrow evening ${esc(te.who)} is out, so it’s a solo evening for you.`);
  if (kidsAwayOn(tk)) known.push(`${theKids().replace(/^./, c => c.toUpperCase())} ${kidsList().length === 1 ? 'is' : 'are'} at ${ourHome() ? 'grandma’s' : 'the grandparents’'} tomorrow.`);
  const tr = (H('rhythms').weekly || []).filter(x => x.day === tdow); if (tr.length) known.push(`Rhythm: ${tr.map(x => esc(x.text)).join('; ')}.`);
  if (other && (op.events || []).length) known.push(`${esc(other)} has: ${op.events.map(evLine).join('; ')}.`);
  const due = dueTasks(tk).filter(x => keyOf(new Date(x.due)) === tk);
  const listView = l => { const items = p[l] || []; if (!items.length) return '';
    return `<div class="plan-list"><h3>${PL_LISTS[l]}</h3>${l === 'tonight' ? checklist(`t:${me}`, items) : `<div class="chips">${items.map(x => `<span class="chip">${esc(x.text)}<button class="x" data-act="plan-del" data-l="${l}" data-id="${x.id}" aria-label="Remove ${esc(x.text)}">✕</button></span>`).join('')}</div>`}</div>`; };
  const glance = `${warn.length ? `<ul class="bf-list">${warn.map(w => `<li class="warn">${w}</li>`).join('')}</ul>` : ''}
    ${timeline(rows, tk, { empty: 'Nothing on the calendar tomorrow.', maps: false })}
    ${due.length ? `<div class="pl-due"><span class="eyebrow">Due tomorrow</span>${due.map(x => `<button class="bf-trow" data-act="task-open" data-id="${esc(x.id)}" data-sw-r="@tr-done" data-sw-id="${esc(x.id)}"><b>${esc(x.name)}</b></button>`).join('')}</div>` : ''}
    ${known.length ? `<ul class="bf-list pl-facts">${known.map(k => `<li>${k}</li>`).join('')}</ul>` : ''}`;
  if (p.planned && !S.ui.planEdit) return `<section class="card plan done-plan"><div class="sec-head"><h2>Tomorrow is ready ★</h2><button class="link" data-act="plan-edit">Change</button></div>
    <p class="eyebrow">${label}</p>${glance}${listView('tonight')}${listView('morning')}${listView('launch')}</section>`;
  const pev = p.events || [], used = new Set(), cardsList = [], alsoList = [];
  for (const r of rows.filter(r => !r.job && !r.plan && !r.allDay && r.e && !r.e.isDate)) { const e = r.e, ent = planEntryFor(e, pev); if (ent) used.add(ent.id);
    if (ent || planNeeds(e)) cardsList.push(planEvCard(e, ent, p)); else alsoList.push(e); }
  const orphans = pev.filter(x => !used.has(x.id)), otherItems = planItemsOf(p, '');
  const cardsHtml = [...cardsList, ...orphans.map(x => planEntCard(x, p))].join('') || '<p class="empty">Tomorrow looks ordinary. Add anything that isn’t in the calendar below.</p>';
  const alsoHtml = alsoList.length ? `<p class="muted small pl-also"><b>Also tomorrow:</b> ${alsoList.map(e => `${esc(shortTitle(e.title))} ${esc(e.start || '')} <button type="button" class="link" data-act="plan-from-ev" data-id="${esc(e.id || '')}" data-g="${esc(e.gId || '')}">plan it</button>`).join(' · ')}</p>` : '';
  const step = (n, t, sub) => `<div class="pl-h"><span class="pl-n">${n}</span><div><h3>${t}</h3>${sub ? `<p class="muted small">${sub}</p>` : ''}</div></div>`;
  return `<section class="card plan"><div class="sec-head"><h2>Ready for tomorrow</h2><span class="progress">${label}</span></div>
    <div class="pl-step">${step(1, 'Tomorrow at a glance', kidsList().length ? 'Here’s what Afloat knows. Also glance at the kindergarten app and messages.' : 'Here’s what Afloat knows. Also glance at your messages.')}
    ${situCard(tk)}${glance}</div>
    <div class="pl-step">${step(2, 'What needs preparing?', 'Tap “Get me ready” and Afloat adds the usual prep and your reminders. It all leaves with the event if the event moves or goes.')}
    ${cardsHtml}
    ${alsoHtml}
    <form class="addform plan-free" data-form="plan-free"><input type="text" name="text" placeholder="Not in the calendar? e.g. a carnival costume, guests at 5" required aria-label="Something not in the calendar"><button class="btn" type="submit">Add</button></form>
    ${otherItems.length ? `<div class="plan-list"><h3>Other things</h3><ul class="pl-its">${otherItems.map(planItemRow).join('')}</ul></div>` : ''}
    ${epTplHtml()}
    <details class="pl-top"${(p.top || []).length ? ' open' : ''}><summary class="small">Tomorrow’s top three${(p.top || []).length ? ` (${p.top.length})` : ''}</summary>${listView('top')}
      <form class="addform" data-form="plan-add"><input type="hidden" name="l" value="top"><input type="text" name="text" placeholder="One thing that would make tomorrow a good day" required aria-label="Top three item"><button class="btn" type="submit">Add</button></form></details>
    </div>
    <div class="pl-step">${step(3, 'Done', 'Anything “tomorrow morning” or “to take” shows up in your morning, next to your usual launch list.')}
    <div class="actions"><button class="btn accent" data-act="plan-done">Tomorrow is ready ★</button></div></div></section>`;
}
/* morning side: what was planned last night */
function todayPlanHtml() {
  if (!meValid()) return '';
  const p = planOf('today', me), other = otherOf(me), op = other ? planOf('today', other) : {};
  let h = '';
  if ((p.events || []).length || (p.top || []).length) h += `<section class="card plan"><div class="sec-head"><h2>Today is different</h2></div>
    ${(p.events || []).length ? `<ul class="brief-list">${p.events.map(e => `<li>${evLine(e)}</li>`).join('')}</ul>` : ''}
    ${(p.top || []).length ? `<h3>Top three</h3>${checklist(`pt:${me}`, p.top)}` : ''}</section>`;
  if ((p.morning || []).length) h += `<section class="card"><div class="sec-head"><h2>Planned for this morning</h2></div>${checklist(`pm:${me}`, p.morning)}</section>`;
  if (other && (op.events || []).length) h += `<p class="muted small">${esc(other)} today: ${op.events.map(evLine).join('; ')}.</p>`;
  return h;
}
/* ---------- taps on this area's buttons (data-act), called from events.js; true = handled ---------- */
function tapPlanTomorrow(a, el, e, r) {
  switch (a) {
    case 'plan-from-ev': { const e = [...allEvents(), ...mineTomorrow()].find(x => (el.dataset.id && x.id === el.dataset.id) || (el.dataset.g && x.gId === el.dataset.g)); if (e) planAddEv(e); return true; }
    case 'plan-sug': { const l = el.dataset.l; savePlan({ [l]: [...(planOf('next', me)[l] || []), { id: uid(), text: el.dataset.text, ...(el.dataset.ev ? { ev: el.dataset.ev } : {}) }] }); return true; }
    case 'plan-move': { const l = el.dataset.l, to = PL_CYCLE[l], cur = planOf('next', me), it = (cur[l] || []).find(x => x.id === el.dataset.id); if (it) savePlan({ [l]: cur[l].filter(x => x.id !== it.id), [to]: [...(cur[to] || []), it] }); return true; }
    case 'plan-rem': { const ent = (planOf('next', me).events || []).find(x => x.id === el.dataset.id); if (!ent) return true; if (remAll().some(x => x.ref === 'plan:' + ent.id)) remDel(x => x.ref === 'plan:' + ent.id); else planRemind(ent); render(true); return true; }
    case 'plan-del': { const l = el.dataset.l, cur = planOf('next', me); if (l === 'events') { remDel(x => x.ref === 'plan:' + el.dataset.id); savePlan({ events: (cur.events || []).filter(x => x.id !== el.dataset.id), ...Object.fromEntries(PL_LS.filter(k => (cur[k] || []).some(x => x.ev === el.dataset.id)).map(k => [k, cur[k].filter(x => x.ev !== el.dataset.id)])) }); return true; } savePlan({ [l]: (cur[l] || []).filter(x => x.id !== el.dataset.id) }); return true; }
    case 'plan-edit': S.ui.planEdit = true; render(true); return true;
    case 'plan-done': S.ui.planEdit = false; savePlan({ planned: true, at: Date.now() }); toast('★ Tomorrow is ready. Tomorrow-you says thanks.'); return true;
  }
  return false;
}
