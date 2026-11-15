/* Afloat · app/event-plans.js · Event plans: the journey, what to do there, and what to do afterwards (10 Nov 2026).
   Plain script: shares one scope with the other app/*.js files (loaded in order by index.html). See CLAUDE.md.
   An event plan is a Plan tomorrow entry (plans/<date>[me].events[]) that can also carry:
     journey { mode, mins, leave, early, fixed }  how you get there; leave is HH:MM and is what everything else uses
     during  [{ id, time?, text }]                what to see or do there
     after   [{ id, text }]                       what to do once it's over (mirrored into home/afters so it outlives the day)
     sized   { noun, perHour }                    a task sized to how much there is afterwards ("how many photos?")
   home/afters = { list: [{ id, title, date, end, back, items: [{ id, text, done }], sized, made, closed }], tpl: [saved plans] }.
   Nothing here is specific to one kind of event or one household: photographers, divers and anyone else plan the same way. */
const EP_MODES = [['drive', 'Drive', 'driving'], ['transit', 'Train, bus or tram', 'transit'], ['bike', 'Bike', 'bicycling'], ['walk', 'Walk', 'walking'], ['lift', 'Lift or taxi', 'driving']];
const EP_EARLY = 5; /* minutes to be there before the start, unless the journey says otherwise */
const epAf = () => H('afters');
const epEnt = id => (planOf('next', me).events || []).find(x => x.id === id);
const epSaveEnt = (id, patch) => { const p = planOf('next', me); savePlan({ events: (p.events || []).map(x => x.id === id ? { ...x, ...patch } : x) }); };
/* the plan entry behind a calendar event, for today or tomorrow */
function epPlanOf(e) {
  const w = e.date === dk ? 'today' : e.date === tk ? 'next' : ''; if (!meValid()) return null;
  return (w && planEntryFor(e, planOf(w, me).events || [])) || (typeof pxEntryFor === 'function' ? pxEntryFor(e) : null) || null;
}
/* a journey someone has planned for this event (it has a leave time), or null */
const epJourney = e => { const x = epPlanOf(e); return x && x.journey && x.journey.leave ? x.journey : null; };
/* the event moved: a journey worked out from "it takes N minutes" moves with it; one worked out from a timetable ("the 07:42") can't, so it's dropped */
function epShift(p, start) {
  const j = p.journey; if (!j || !j.leave) return { ...p, time: start };
  if (j.fixed || j.mins == null) return { ...p, time: start, travel: null, journey: { mode: j.mode || '' } };
  return { ...p, time: start, journey: { ...j, leave: minusMin(start, +j.mins + (+j.early || 0)) } };
}
/* ---------- the journey ---------- */
const epEnc = encodeURIComponent;
function epLinks(ent) {
  if (!ent.place) return '<p class="muted small">Add a place to the event in the calendar to open directions.</p>';
  const j = ent.journey || {}, m = EP_MODES.find(x => x[0] === j.mode) || EP_MODES[0], o = homeAddr();
  const g = `https://www.google.com/maps/dir/?api=1&destination=${epEnc(ent.place)}${o ? `&origin=${epEnc(o)}` : ''}&travelmode=${m[2]}`, w = `https://waze.com/ul?q=${epEnc(ent.place)}&navigate=yes`;
  return `<p class="small"><a class="link" href="${esc(g)}" target="_blank" rel="noopener">Open directions in Google Maps</a>${j.mode === 'drive' || j.mode === 'lift' ? ` · <a class="link" href="${esc(w)}" target="_blank" rel="noopener">Waze</a>` : ''}${j.mode === 'transit' ? ' · or your own transport app' : ''}</p>`;
}
function epJourneyHtml(ent) {
  if (!ent.time || ent.travel == null && !ent.journey) return '';
  const j = ent.journey || {}, D = (S.ui.epDraft || {})[ent.id] || {}, planned = !!j.leave, known = ent.place && travelOf({ place: ent.place, title: ent.title }).known;
  const mins = D.mins != null ? D.mins : j.mins != null ? j.mins : known ? travelOf({ place: ent.place, title: ent.title }).m : '', leave = D.leave != null ? D.leave : j.leave || '', early = j.early != null ? j.early : EP_EARLY;
  const status = planned ? `<span class="tl-ok">✓ Journey planned</span> · leave at <b>${esc(j.leave)}</b>${j.mode ? ' · ' + esc((EP_MODES.find(x => x[0] === j.mode) || [])[1] || '') : ''}`
    : `<span class="muted">Leave time is a guess (about ${+ent.travel || 20} min). Planning the journey makes it exact.</span>`;
  return `<div class="ep-j"><h4 class="ep-h">Getting there</h4><p class="small">${status}</p>
    <div class="chips">${EP_MODES.map(([k, l]) => `<button type="button" class="tiny${j.mode === k ? ' on' : ''}" data-act="ep-mode" data-id="${ent.id}" data-v="${k}" aria-pressed="${j.mode === k}">${l}</button>`).join('')}</div>
    ${epLinks(ent)}
    <form class="addform ep-jf" data-form="ep-journey" data-ev="${ent.id}"><label class="small">It takes (min)<input type="number" inputmode="numeric" min="1" max="600" name="mins" value="${mins === '' ? '' : +mins}" placeholder="35"></label>
      <label class="small">or leave home at<input type="time" name="leave" value="${esc(leave)}"></label>
      <label class="small">be there early (min)<input type="number" inputmode="numeric" min="0" max="60" name="early" value="${+early}"></label>
      <button class="btn" type="submit">${planned ? 'Update' : 'Save journey'}</button></form>
    <p class="muted small">${sample ? `<label class="link">Read it from a screenshot<input type="file" accept="image/*" data-act="ep-shot" data-id="${ent.id}" hidden></label> · ` : ''}For a train or bus, write the time you leave home, with the walk to the stop.${S.ui.epBusy === ent.id ? ' ✦ Reading…' : ''}</p></div>`;
}
function epJourneySave(id, f) {
  const ent = epEnt(id); if (!ent || !ent.time) return;
  const early = Math.max(0, Math.min(60, Math.round(+f.early || 0))), st = toMin(ent.time), typed = /^\d\d:\d\d$/.test(f.leave || '') ? f.leave : '';
  let mins = f.mins !== '' && f.mins != null && +f.mins > 0 ? Math.round(+f.mins) : null, leave = typed;
  if (leave) { mins = st - early - toMin(leave); if (mins <= 0) return toast('That’s after the time you need to be there.'); }
  else if (mins != null) leave = minusMin(ent.time, mins + early);
  else return toast('Write how long it takes, or when you leave.');
  const hadRem = remAll().some(x => x.ref === 'plan:' + id), next = { ...ent, travel: mins, journey: { mode: (ent.journey || {}).mode || '', mins, leave, early, ...(typed ? { fixed: true } : {}) } };
  epSaveEnt(id, { travel: next.travel, journey: next.journey });
  if (hadRem) { remDel(x => x.ref === 'plan:' + id); planRemind(next); }
  if (ent.place) saveHome('kits', { ...kits(), travel: { ...(kits().travel || {}), [placeKey(ent.place)]: mins } });
  S.ui.epDraft = { ...(S.ui.epDraft || {}), [id]: null };
  toast(`Leave at ${leave}.${hadRem ? ' Reminders moved with it.' : ''}`);
}
async function epJourneyRead(id, file) {
  const ent = epEnt(id); if (!ent || !sample || !file) return;
  S.ui.epBusy = id; render(true);
  try {
    const out = await sample.json(`This is a screenshot of a route or timetable (a transport app, a maps app or Waze). The person needs to be at ${ent.place || 'their destination'} at ${ent.time}. Reply with only JSON: {"leave": "HH:MM" the time they should leave home (for a train, bus or tram, the departure shown, earlier by the walk to the stop if the app shows it), or "" if you can't tell, "mins": the total minutes from door to door if shown, otherwise null, "mode": one of "drive", "transit", "bike", "walk" or ""}.`, { images: [file], cache: false, feature: 'journey' }) || {};
    const leave = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(out.leave || '')) ? out.leave : '', mins = +out.mins > 0 ? Math.round(+out.mins) : null, mode = EP_MODES.some(x => x[0] === out.mode) ? out.mode : '';
    S.ui.epDraft = { ...(S.ui.epDraft || {}), [id]: { leave, mins: leave ? null : mins } };
    if (mode && !(ent.journey || {}).mode) epSaveEnt(id, { journey: { ...(ent.journey || {}), mode } });
    toast(leave || mins ? 'Read it. Check the numbers, then save the journey.' : 'I couldn’t read a time from that. Write it in instead.');
  } catch (err) { toast(claudeWhy(err)); }
  S.ui.epBusy = null; render(true);
}
/* ---------- what to do there ---------- */
const epTimeSort = (a, b) => (a.time || '99:99').localeCompare(b.time || '99:99');
function epDuringHtml(ent) {
  const L = [...(ent.during || [])].sort(epTimeSort), ideas = ((S.ui.epIdeas || {})[ent.id] || []).filter(t => !L.some(x => x.text.toLowerCase() === String(t).toLowerCase()));
  return `<div class="ep-d"><h4 class="ep-h">While you’re there</h4>
    ${L.length ? `<ul class="pl-its">${L.map(x => `<li class="pl-it"><span class="txt small">${x.time ? `<b>${esc(x.time)}</b> ` : ''}${esc(x.text)}</span><button type="button" class="chip x row-x" data-act="ep-del" data-k="during" data-ev="${ent.id}" data-id="${x.id}" aria-label="Remove ${esc(x.text)}">✕</button></li>`).join('')}</ul>` : '<p class="muted small">Things to see or do, in the order you’d like.</p>'}
    ${ideas.length ? `<div class="chips"><span class="muted small">✦ Ideas:</span>${ideas.slice(0, 5).map(t => `<button type="button" class="tiny" data-act="ep-idea" data-ev="${ent.id}" data-text="${esc(t)}">+ ${esc(t)}</button>`).join('')}</div>` : ''}
    <form class="addform" data-form="ep-during" data-ev="${ent.id}"><input type="time" name="time" aria-label="Time (optional)"><input type="text" name="text" placeholder="e.g. The old harbour, then lunch" required aria-label="Something to see or do there"><button class="btn" type="submit">Add</button></form>
    ${sample && ent.place ? `<p class="small"><button type="button" class="link" data-act="ep-ideas" data-ev="${ent.id}">${S.ui.epBusy === 'i' + ent.id ? '✦ Thinking…' : '✦ Ideas for what to do there'}</button></p>` : ''}</div>`;
}
async function epIdeas(id) {
  const ent = epEnt(id); if (!ent || !sample || S.ui.epBusy) return;
  S.ui.epBusy = 'i' + id; render(true);
  try {
    const out = await askClaude(`${houseFacts()} They are going to ${ent.place || ent.title} (${shortTitle(ent.title)}) on ${new Date(tk + 'T12:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}${ent.time ? ` at ${ent.time}` : ''}${(ent.during || []).length ? `, and already plan: ${ent.during.map(x => x.text).join('; ')}` : ''}.
Suggest up to five things worth seeing or doing there, each at most 8 words, specific to that place, and only things you are fairly sure exist. Reply with only a JSON array of strings.`, { feature: 'plan' });
    const arr = (Array.isArray(out) ? out : (out && out.items) || []).map(x => String(x).trim()).filter(Boolean).slice(0, 5);
    S.ui.epIdeas = { ...(S.ui.epIdeas || {}), [id]: arr }; if (!arr.length) toast('Nothing came to mind. Add your own.');
  } catch (e) { toast(claudeWhy(e)); }
  S.ui.epBusy = null; render(true);
}
/* ---------- what to do afterwards ---------- */
function epAfterHtml(ent) {
  const L = ent.after || [], sz = ent.sized;
  return `<div class="ep-a"><h4 class="ep-h">When it’s over</h4>
    ${L.length ? `<ul class="pl-its">${L.map(x => `<li class="pl-it"><span class="txt small">${esc(x.text)}</span><button type="button" class="chip x row-x" data-act="ep-del" data-k="after" data-ev="${ent.id}" data-id="${x.id}" aria-label="Remove ${esc(x.text)}">✕</button></li>`).join('')}</ul>` : '<p class="muted small">Things not to forget once you’re home: hang things to dry, back things up, send a message.</p>'}
    <form class="addform" data-form="ep-after" data-ev="${ent.id}"><input type="text" name="text" placeholder="e.g. Hang the wetsuit to dry" required aria-label="Something to do afterwards"><button class="btn" type="submit">Add</button></form>
    <details class="ep-sz"${sz ? ' open' : ''}><summary class="small">A task sized to how much there is afterwards</summary>
      <form class="addform" data-form="ep-sized" data-ev="${ent.id}"><input type="text" name="noun" value="${esc(sz ? sz.noun : '')}" placeholder="What you count, e.g. photos" aria-label="What you count"><label class="small">about<input type="number" inputmode="numeric" min="1" name="perHour" value="${sz ? +sz.perHour : ''}" placeholder="100" aria-label="How many you get through in an hour"> an hour</label><button class="btn" type="submit">Save</button></form>
      ${sz ? `<p class="muted small">Afterwards Afloat asks how many ${esc(sz.noun)} there are and makes one task in sessions of about two hours. <button type="button" class="link" data-act="ep-sized-off" data-ev="${ent.id}">Turn off</button></p>` : '<p class="muted small">Optional. Afloat will ask how many there are and make a task in sessions of about two hours.</p>'}</details></div>`;
}
/* the mirror in home/afters, so the after-tasks outlive the planning day. Run after every plan save for tomorrow. */
function epSync() {
  if (!db || !S.loaded || !meValid()) return;
  const A = epAf(), cur = A.list || [], evs = planOf('next', me).events || [], mine = new Set();
  let list = cur.filter(a => a.px || a.date !== tk || a.who !== me);
  for (const ent of evs) {
    if (!(ent.after || []).length && !ent.sized) continue; mine.add(ent.id);
    const old = cur.find(a => a.id === ent.id), items = (ent.after || []).map(x => ({ id: x.id, text: x.text, ...(((old || {}).items || []).find(y => y.id === x.id) || {}).done ? { done: true } : {} }));
    list.push({ id: ent.id, who: me, title: String(ent.title || '').split(' · ')[0], date: tk, end: ent.end || '', start: ent.time || '', back: +ent.travel || 0, items, sized: ent.sized || null, made: !!(old || {}).made, closed: !!(old || {}).closed, ...((old || {}).n ? { n: old.n } : {}) });
  }
  if (JSON.stringify(list) !== JSON.stringify(cur)) saveHome('afters', { ...A, list });
  if (remAll().some(x => /^plan-af:/.test(x.ref || '') && x.date === tk && x.who === me && !mine.has(x.ref.slice(8)))) remDel(x => /^plan-af:/.test(x.ref || '') && x.date === tk && x.who === me && !mine.has(x.ref.slice(8)));
  for (const ent of evs) if ((ent.after || []).length && ent.end) { const at = minusMin(ent.end, -(+ent.travel || 0));
    if (!remAll().some(x => x.ref === 'plan-af:' + ent.id && x.at === at)) { remDel(x => x.ref === 'plan-af:' + ent.id); remAdd([{ text: `Home from ${String(ent.title).split(' · ')[0]}: ${ent.after.slice(0, 2).map(x => x.text).join('; ')}`, at, date: tk, src: 'plan', ref: 'plan-af:' + ent.id }]); } }
}
const epDue = a => { if (!a || a.closed || a.date > dk || a.date < calAdd(dk, -14)) return false; const en = a.end ? toMin(a.end) : a.start ? toMin(a.start) + 60 : 0; return a.date < dk || nowMin() >= en + (a.date === dk ? (+a.back || 0) : 0); };
const epPending = a => (a.items || []).some(x => !x.done) || (a.sized && !a.made && !a.skip);
function epAfterCard() {
  if (!meValid()) return '';
  return (epAf().list || []).filter(a => a.who === me && epDue(a) && epPending(a)).map(a => {
    const sz = a.sized, n = +((S.ui.epN || {})[a.id] || a.n || 0), hrs = sz && n > 0 ? n / Math.max(1, +sz.perHour || 1) : 0, my = (H('trello').people || {})[me];
    return `<section class="card ep-after"><div class="sec-head"><h3>After ${esc(a.title)}</h3><span class="progress">${fmtD(a.date)}</span></div>
      ${(a.items || []).length ? `<ul class="checks">${a.items.map(x => `<li><button class="check${x.done ? ' on' : ''}" data-act="ep-tick" data-id="${a.id}" data-i="${x.id}" aria-pressed="${!!x.done}"><span class="box" aria-hidden="true">${I.check}</span><span class="txt">${esc(x.text)}</span></button></li>`).join('')}</ul>` : ''}
      ${sz && !a.made && !a.skip ? `<p class="muted small">How many ${esc(sz.noun)} are there to get through? Afloat makes one task, sized to the count.</p>
        <div class="addform"><input type="number" inputmode="numeric" min="1" id="epN_${a.id}" data-act="ep-n" data-id="${a.id}" value="${n || ''}" placeholder="Number of ${esc(sz.noun)}" aria-label="Number of ${esc(sz.noun)}"><label class="small">Done by <input type="date" id="epDue_${a.id}" data-act="ep-due" data-id="${a.id}" value="${esc((S.ui.epDue || {})[a.id] || calAdd(a.date, 14))}"></label></div>
        ${hrs ? `<p class="small">About <b>${hrsTxt(hrs)}</b>, in ${Math.max(1, Math.ceil(hrs / 2))} session${Math.ceil(hrs / 2) > 1 ? 's' : ''} of about two hours.</p>` : ''}
        <div class="actions">${my && mcp ? `<button class="btn accent" data-act="ep-make" data-id="${a.id}" ${hrs && !S.ui.epMaking ? '' : 'disabled'}>${S.ui.epMaking === a.id ? 'Making it…' : 'Make the task'}</button>` : '<span class="muted small">Pick your own task list in Settings → Your task lists to make the task.</span>'}<button class="link" data-act="ep-skip" data-id="${a.id}">Nothing to do</button></div>` : ''}
      <p class="muted small"><button class="link" data-act="ep-close" data-id="${a.id}">That’s all, hide this</button></p></section>`;
  }).join('');
}
async function epMake(id) {
  const a = (epAf().list || []).find(x => x.id === id), n = +((S.ui.epN || {})[id] || (a || {}).n || 0), my = (H('trello').people || {})[me];
  if (!a || !a.sized || !n || !my || !mcp || S.ui.epMaking) return;
  const hrs = n / Math.max(1, +a.sized.perHour || 1), k = Math.max(1, Math.ceil(hrs / 2)), due = (S.ui.epDue || {})[id] || calAdd(a.date, 14), noun = a.sized.noun;
  const steps = Array.from({ length: k }, (_, i) => `${k > 1 ? `Session ${i + 1} of ${k}` : 'Do it'} (~${hrsTxt(hrs / k)})`);
  S.ui.epMaking = id; render(true);
  try {
    const r = await trCreate(my, `${a.title}: ${n} ${noun}`, dueISO(due), `${n} ${noun} after ${a.title} (${fmtD(a.date)}).\nAbout ${hrsTxt(hrs)} in all, at roughly ${+a.sized.perHour} ${noun} an hour.\nMade by Afloat.`);
    const cid = r && (r.id || (r.card && r.card.id));
    if (cid) { try { const c = await trCall('trelloWriteChecklist', { action: 'create', cardId: cid, name: 'Steps' }), clId = c && (c.id || (c.checklist && c.checklist.id));
      if (clId) for (const s2 of steps) await trCall('trelloWriteChecklist', { action: 'add_item', checklistId: clId, text: s2, pos: 'bottom' }); } catch {} }
    epPatchAfter(id, { made: true, n }); toast(`On your list: ${steps.length} step${steps.length > 1 ? 's' : ''}, due ${fmtD(due)}.`); trLoad();
  } catch (err) { toast(trMsg(err)); }
  S.ui.epMaking = null; render(true);
}
const epPatchAfter = (id, patch) => { const A = epAf(); saveHome('afters', { ...A, list: (A.list || []).map(a => a.id === id ? { ...a, ...patch } : a) }); };
/* ---------- what's going on right now ---------- */
function epNowCard() {
  if (!meValid()) return '';
  const nm = nowMin();
  return (planOf('today', me).events || []).filter(x => (x.during || []).length && x.time && nm >= toMin(x.time) - 15 && nm < (x.end ? toMin(x.end) : toMin(x.time) + 180)).map(x => `<section class="card ep-now"><div class="sec-head"><h3>At ${esc(String(x.title).split(' · ')[0])}</h3><span class="progress">${esc(x.time)}${x.end ? '–' + esc(x.end) : ''}</span></div>
    <ul class="brief-list">${[...x.during].sort(epTimeSort).map(d => `<li>${d.time ? `<b>${esc(d.time)}</b> ` : ''}${esc(d.text)}</li>`).join('')}</ul></section>`).join('');
}
/* ---------- saved plans: made from an event you've planned, never preset ---------- */
const epKey = t => String(t || '').split(' · ')[0].toLowerCase().replace(/[0-9]+/g, '').replace(/\s+/g, ' ').trim();
const epTplFor = title => { const t = String(title || '').toLowerCase(); return (epAf().tpl || []).find(x => x.key && t.includes(x.key)) || null; };
function epTplSave(id) {
  const p = planOf('next', me), ent = epEnt(id); if (!ent) return;
  const by = l => planItemsOf(p, id).filter(x => x.l === l).map(x => x.text), key = epKey(ent.title);
  if (!key) return toast('Give the event a name first.');
  const tpl = { id: uid(), key, name: String(ent.title).split(' · ')[0], tonight: by('tonight'), morning: by('morning'), launch: by('launch'), during: (ent.during || []).map(x => ({ text: x.text, ...(x.time ? { time: x.time } : {}) })), after: (ent.after || []).map(x => x.text), sized: ent.sized || null };
  const A = epAf(); saveHome('afters', { ...A, tpl: [...(A.tpl || []).filter(x => x.key !== key), tpl] });
  toast(`Saved. Next time an event with “${tpl.name}” in its name comes up, Afloat adds this.`);
}
/* a saved plan's things for a new entry: [{ l, text }] for the lists, and the during/after/sized parts */
function epTplApply(title) {
  const t = epTplFor(title); if (!t) return null;
  return { lists: ['tonight', 'morning', 'launch'].flatMap(l => (t[l] || []).map(text => ({ l, text }))), during: (t.during || []).map(x => ({ id: uid(), text: x.text, ...(x.time ? { time: x.time } : {}) })), after: (t.after || []).map(text => ({ id: uid(), text })), sized: t.sized || null };
}
function epTplHtml() {
  const T = epAf().tpl || []; if (!T.length) return '';
  return `<details class="pl-top"><summary class="small">Saved plans (${T.length})</summary><ul class="pl-its">${T.map(x => `<li class="pl-it"><span class="txt small"><b>${esc(x.name)}</b> <span class="muted">· ${[...(x.tonight || []), ...(x.morning || []), ...(x.launch || [])].length} to prepare, ${(x.during || []).length} there, ${(x.after || []).length} afterwards</span></span><button type="button" class="chip x row-x" data-act="ep-tpl-del" data-id="${x.id}" aria-label="Remove the saved plan ${esc(x.name)}">✕</button></li>`).join('')}</ul></details>`;
}
/* the whole event-plan part of a planned entry's card */
function epBody(ent) {
  const any = planItemsOf(planOf('next', me), ent.id).length + (ent.during || []).length + (ent.after || []).length > 0;
  return `${epJourneyHtml(ent)}${epDuringHtml(ent)}${epAfterHtml(ent)}${any ? `<p class="small"><button type="button" class="link" data-act="ep-tpl-save" data-id="${ent.id}">Save this as a plan I can reuse</button></p>` : ''}`;
}
/* ---------- forms, taps, files ---------- */
function epForm(kind, f, fd) {
  const id = f.dataset.ev, ent = epEnt(id); if (!ent) return false; const text = String(fd.get('text') || '').trim();
  if (kind === 'ep-journey') { epJourneySave(id, { mins: fd.get('mins'), leave: fd.get('leave'), early: fd.get('early') }); return true; }
  if (kind === 'ep-during') { if (!text) return true; const time = /^\d\d:\d\d$/.test(String(fd.get('time') || '')) ? fd.get('time') : ''; epSaveEnt(id, { during: [...(ent.during || []), { id: uid(), text, ...(time ? { time } : {}) }] }); return true; }
  if (kind === 'ep-after') { if (!text) return true; epSaveEnt(id, { after: [...(ent.after || []), { id: uid(), text }] }); return true; }
  if (kind === 'ep-sized') { const noun = String(fd.get('noun') || '').trim().slice(0, 30), per = Math.round(+fd.get('perHour') || 0); if (!noun || per < 1) { toast('Write what you count and about how many you get through in an hour.'); return true; } epSaveEnt(id, { sized: { noun, perHour: per } }); return true; }
  return false;
}
function tapEventPlans(a, el, e, r) {
  const id = el.dataset.id, ev = el.dataset.ev;
  switch (a) {
    case 'ep-mode': { const ent = epEnt(id); if (ent) epSaveEnt(id, { journey: { ...(ent.journey || {}), mode: (ent.journey || {}).mode === el.dataset.v ? '' : el.dataset.v } }); return true; }
    case 'ep-del': { const ent = epEnt(ev), k = el.dataset.k; if (ent && (k === 'during' || k === 'after')) { epSaveEnt(ev, { [k]: (ent[k] || []).filter(x => x.id !== id) });  } return true; }
    case 'ep-idea': { const ent = epEnt(ev); if (ent) epSaveEnt(ev, { during: [...(ent.during || []), { id: uid(), text: el.dataset.text }] }); return true; }
    case 'ep-ideas': epIdeas(ev); return true;
    case 'ep-sized-off': epSaveEnt(ev, { sized: null }); return true;
    case 'ep-tpl-save': epTplSave(id); return true;
    case 'ep-tpl-del': { const A = epAf(); saveHome('afters', { ...A, tpl: (A.tpl || []).filter(x => x.id !== id) }); return true; }
    case 'ep-tick': { const A = epAf(); saveHome('afters', { ...A, list: (A.list || []).map(x => x.id === id ? { ...x, items: x.items.map(y => y.id === el.dataset.i ? (y.done ? { id: y.id, text: y.text } : { ...y, done: true }) : y) } : x) }); return true; }
    case 'ep-make': epMake(id); return true;
    case 'ep-skip': epPatchAfter(id, { skip: true }); return true;
    case 'ep-close': epPatchAfter(id, { closed: true }); return true;
  }
  return false;
}
