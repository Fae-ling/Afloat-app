/* Afloat · app/capture.js · The + button: brain dump, Claude sorting, review, and From a photo (invitations, notices, bookings).
   Plain script: shares one scope with the other app/*.js files (loaded in order by index.html). See CLAUDE.md. */
/* ---------- capture: dump → (Claude) sort → review → Trello ---------- */
const cap = () => S.ui.cap || (S.ui.cap = { step: 'write', items: [], pick: null });
function capItem(text, extra = {}) { return { id: uid(), text, title: text, dest: defaultDest(), due: '', time: '', person: '', label: '', on: true, why: '', ...extra }; }
/* ---------- from a photo (6 Nov 2026): an invitation, a kindergarten notice, a year plan, a booking or an appointment card,
   as a photo, a screenshot or pasted text. One event → the event form opens filled in (title, date, time, place, who, type),
   with Claude's suggestions ticked above it (reply by…, buy or wrap a present, things to bring, reminders) and a warning if
   it already seems to be in the calendar; one Save keeps the event and the ticked suggestions. Several dates → a tick list.
   Claude suggests calendar events (no-kindergarten days become all-day "Prázdniny"/"Ředitelské volno", so they count as
   special days), things to bring (they join that day's drop-off kit: home/kits.dated[date]) and to-dos (your own Trello
   list). Nothing is saved until you've ticked it in the review. Images go to Claude and aren't stored. */
const nb = () => S.ui.nb || (S.ui.nb = { step: 'pick', files: [], text: '' });
function vNotice() {
  const N = nb(), head = `<div class="sec-head"><h2>From a photo</h2><button class="link" data-act="nb-back">Back</button></div>`;
  if (N.step === 'review') return head + nbReview();
  if (N.step === 'study' && N.study && N.study.items) return head + pxStudyReview(N.study);
  return head + `<p class="muted small">An invitation, a poster, a booking confirmation, the kindergarten notice board or its year plan, a study plan or exam timetable: a photo, a screenshot, or the text pasted. Claude fills in the event and suggests what goes with it; you check it and save.</p>
    <label class="btn ghost" style="display:inline-block">📷 Photos or screenshots<input type="file" id="nbFiles" accept="image/*" multiple hidden></label>
    ${N.files.length ? `<p class="small">${N.files.length} image${N.files.length === 1 ? '' : 's'} ready. <button class="link" data-act="nb-clear">Clear</button></p>` : ''}
    <textarea id="nbText" rows="4" placeholder="…or paste the message or invitation here" aria-label="The text">${esc(N.text || '')}</textarea>
    ${N.err ? `<p class="note">${esc(N.err)}</p>` : ''}
    <div class="actions"><button class="btn accent" data-act="nb-read" ${N.busy ? 'disabled' : ''}>${N.busy ? 'Reading…' : '✦ Read it'}</button></div>`;
}
function nbPeople() {
  const ads = members().map(m => m.name), kids = kidsList(), fr = (H('profiles').friends || []).map(f => f.name).filter(Boolean);
  return { ads, kids, fr, all: [...ads, ...kids, ...fr] };
}
function nbPrompt(text) {
  const P = nbPeople(), kinds = Object.entries(KINDS).filter(([, v]) => !v.hidden).map(([k, v]) => `${k} (${v.label})`).join(', ');
  return `Read this for a household calendar. It is a photo, a screenshot or text of something with a date: an invitation (a party, a wedding, a dinner, a concert), a poster, a ticket or booking, a work or school message, a doctor's appointment card, a notice from a kindergarten or school, or a year plan. Most likely in Czech or English.
Today is ${dk} (${DAYS_LONG[dow()]}). The person reading it is ${me}. People Afloat knows: adults ${P.ads.join(', ')}; children ${P.kids.join(', ') || 'none'}; friends and partners ${P.fr.join(', ') || 'none'}.
A single picture often lists SEVERAL events (a month's plan, a poster with a line per date): return one entry in "events" for every separate dated line, in the order written, even when two share a date or have no time. Never stop after the first, and never merge lines. Czech dates like "11.11." or "6. 11." are day.month.
Dates as YYYY-MM-DD; when a year is missing, use the next such date from today. Times as HH:MM. Leave out anything already past. Use the original's language for titles, short and clear (e.g. "Svatba Kláry a Tomáše", "Koncert v Lucerně", "Zubař").
- "kind": one of invitation, notice, year_plan, booking, appointment, other.
- events: every dated thing. "place": the address or venue as written (or ""). "who": only people from the lists above whom the text names or is addressed to; if it doesn't say, just ${me}. Never add children or a partner who aren't mentioned. "type": one of ${kinds}. "closed": true only for days a kindergarten or school is shut (prázdniny, ředitelské volno, zavřeno), titled like the original, with "end" for a range. "notes": anything useful in one or two lines (dress code, what's included, a booking number, a phone number).
- todos: things to do before it, each with a sensible "due": reply or RSVP by the date it asks (or 5 days before), buy a present or tickets, pay, sign up, send a form. Only what this asks for or clearly implies.
- bring: things to take on the day (a present, tickets, ID, a costume, money, a form), with that day's date.
- If it is a STUDY PLAN (a syllabus, a course or semester schedule, an exam timetable, a list of assignment or hand-in dates): "kind" is "study_plan", and every exam, test, assignment or hand-in goes in "deadlines" (not in "events"): "title" short with the course in it (e.g. "Anatomy exam"), "course", "date", "time" or null, "type" one of exam, assignment, other, "place" or "", "topics": the topics it lists for that exam or assignment (at most 12, short), else []. Weekly lectures and seminars are not deadlines; leave them out. "plan_title": a short name for the whole period (e.g. "Winter exams 2027").${nb().study ? ' They said it is a study plan.' : ''}
- reminders: at most two short ones worth a nudge, e.g. "Wrap the present" the evening before (19:00), "Print the tickets", "Check the route" when it's somewhere new. Leave empty when nothing is worth it.
${text ? 'The text:\n' + text.slice(0, 8000) : '(It is in the images.)'}
Reply with only JSON: {"kind": "", "summary": "one short line", "events": [{"title": "", "date": "", "end": null, "start": null, "finish": null, "place": "", "who": [], "type": "other", "closed": false, "notes": ""}], "todos": [{"title": "", "due": null}], "bring": [{"text": "", "date": ""}], "reminders": [{"title": "", "date": "", "time": ""}], "deadlines": [{"title": "", "course": "", "date": "", "time": null, "type": "exam", "place": "", "topics": []}], "plan_title": ""}`;
}
async function nbRead() {
  const N = nb(); N.text = ($('#nbText') || {}).value || N.text || '';
  if (!N.files.length && !N.text.trim()) { N.err = 'Add a photo or paste the message first.'; return render(true); }
  if (!sample) { N.err = 'Claude isn’t available here.'; return render(true); }
  N.busy = true; N.err = ''; render(true);
  try {
    const out = await sample.json(nbPrompt(N.text.trim()), { images: N.files.length ? N.files.slice(0, 6) : undefined, cache: false, feature: 'notice' }) || {};
    const okD = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) && d >= dk, kidsOk = a => (Array.isArray(a) ? a : []).filter(k => kidsList().includes(k));
    N.res = {
      summary: String(out.summary || '').slice(0, 200),
      kind: String(out.kind || ''),
      events: (out.events || []).filter(e => e && e.title && okD(e.date)).slice(0, 30).map(e => { const who = (Array.isArray(e.who) ? e.who : e.kids || []).filter(n => nbPeople().all.includes(n));
        return { id: uid(), on: true, title: String(e.title).slice(0, 120), date: e.date, end: okD(e.end) && e.end >= e.date ? e.end : '', start: /^\d{1,2}:\d{2}$/.test(e.start || '') ? e.start.padStart(5, '0') : '', finish: /^\d{1,2}:\d{2}$/.test(e.finish || '') ? e.finish.padStart(5, '0') : '',
          kids: who.filter(n => kidsList().includes(n)), who, place: String(e.place || '').slice(0, 200), type: KINDS[e.type] ? e.type : 'family', notes: String(e.notes || '').slice(0, 400), closed: !!e.closed }; }),
      reminders: (out.reminders || []).filter(x => x && x.title && okD(x.date)).slice(0, 2).map(x => ({ id: uid(), on: true, title: String(x.title).slice(0, 120), date: x.date, time: /^\d{1,2}:\d{2}$/.test(x.time || '') ? x.time.padStart(5, '0') : '19:00' })),
      bring: (out.bring || []).filter(x => x && x.text && okD(x.date)).slice(0, 20).map(x => ({ id: uid(), on: true, text: String(x.text).slice(0, 120), date: x.date, kids: kidsOk(x.kids) })),
      todos: (out.todos || []).filter(x => x && x.title).slice(0, 20).map(x => ({ id: uid(), on: true, title: String(x.title).slice(0, 200), due: okD(x.due) ? x.due : '' })) };
    const dls = (out.deadlines || []).filter(x => x && x.title && okD(x.date)).slice(0, 30);
    if (dls.length && (out.kind === 'study_plan' || N.study || !N.res.events.length)) { N.study = pxStudyFrom(out, dls); N.step = 'study'; N.busy = false; render(true); return; }
    const open = N.res.events.filter(e => !e.closed);
    if (!N.res.events.length && !N.res.bring.length && !N.res.todos.length) N.err = 'Nothing with a date came out of it. Try a sharper photo, or paste the text.';
    else if (open.length) { nbQueue(N); return; }
    else N.step = 'review';
  } catch (e) { N.err = claudeWhy(e); }
  N.busy = false; render(true);
}
function nbReview() {
  const R = nb().res || {}, row = (grp, x, label) => `<li><label class="nb-row"><input type="checkbox" data-act="nb-tog" data-grp="${grp}" data-id="${x.id}" ${x.on ? 'checked' : ''}> <span>${label}</span></label></li>`;
  const kidsTxt = k => k.length ? ` · ${esc(k.join(', '))}` : '';
  return `${R.summary ? `<p class="small">${esc(R.summary)}</p>` : ''}
    ${R.events.length ? `<h3>Calendar</h3><ul class="bf-list nb-l">${R.events.map(e => row('events', e, `<b>${esc(e.title)}</b> · ${esc(fmtD(e.date))}${e.end && e.end !== e.date ? ' – ' + esc(fmtD(e.end)) : ''}${e.start ? ' ' + esc(e.start) : ''}${e.place ? ' · ' + esc(e.place) : ''}${kidsTxt(e.who && e.who.length ? e.who : e.kids)}${e.closed ? ' · <span class="muted">closed</span>' : ''}`)).join('')}</ul>` : ''}
    ${R.bring.length ? `<h3>Things to bring</h3><p class="muted small">They join that day’s take-along list.</p><ul class="bf-list nb-l">${R.bring.map(x => row('bring', x, `${esc(x.text)} · ${esc(fmtD(x.date))}${kidsTxt(x.kids)}`)).join('')}</ul>` : ''}
    ${(R.reminders || []).length ? `<h3>Reminders</h3><p class="muted small">Afloat reminds you at that time, on Today and on your phone.</p><ul class="bf-list nb-l">${R.reminders.map(x => row('reminders', x, `${esc(x.title)} · ${esc(fmtD(x.date))} ${esc(x.time)}`)).join('')}</ul>` : ''}
    ${R.todos.length ? `<h3>To-dos</h3><p class="muted small">Onto your own Trello list.</p><ul class="bf-list nb-l">${R.todos.map(x => row('todos', x, `${esc(x.title)}${x.due ? ' · by ' + esc(fmtD(x.due)) : ''}`)).join('')}</ul>` : ''}
    <div class="actions"><button class="btn accent" data-act="nb-save" ${nb().busy ? 'disabled' : ''}>${nb().busy ? 'Saving…' : 'Keep the ticked ones'}</button></div>`;
}
const nbEv = e => ({ title: e.title, kind: e.closed ? 'family' : e.type || 'family', who: e.who && e.who.length ? e.who : e.closed ? (e.kids || []) : [me], date: e.date, endDate: e.end || e.date, allDay: e.closed || !e.start, start: e.closed ? '' : e.start, end: e.closed ? '' : (e.finish || (e.start ? mm2t(toMin(e.start) + 60) : '')),
  place: e.closed ? '' : (e.place || ''), notes: [e.notes, 'Filled in from a photo in Afloat'].filter(Boolean).join('\n') });
/* the ticked suggestions: things to bring join that day's drop-off list (kindergarten) or the event's own take-along list; to-dos and reminders go onto your own Trello list */
async function nbExtras(R, evOut) {
  const br = (R.bring || []).filter(x => x.on), td = (R.todos || []).filter(x => x.on), rm = (R.reminders || []).filter(x => x.on), done = [];
  if (br.length) { const K = kits(), dated = { ...(K.dated || {}) };
    for (const x of br) dated[x.date] = [...(dated[x.date] || []), { id: uid(), text: x.text + ((x.kids || []).length && x.kids.length < kidsList().length ? ` (${x.kids.join(', ')})` : ''), ...(evOut ? { for: evOut } : {}) }];
    for (const k of Object.keys(dated)) if (k < calAdd(dk, -7)) delete dated[k]; saveHome('kits', { ...K, dated }); done.push(`${br.length} to bring`); }
  const mine = (H('trello').people || {})[me]; let bad = 0, sent = 0;
  if (td.length && mcp && mine) {
    for (const x of td) { try { await trCreate(mine, x.title, x.due ? new Date(x.due + 'T09:00:00').toISOString() : null, 'Suggested from a photo in Afloat'); sent++; } catch (e) { bad++; } }
    trLoad(); }
  if (rm.length) { oneoffAdd(rm.map(x => ({ title: x.title, date: x.date, time: x.time || '19:00' }))); done.push(`${rm.length} reminder${rm.length === 1 ? '' : 's'}`); }
  if (sent) done.push(`${sent} on your list`);
  return done.join(', ') + (td.length && !mine ? ' (your own Trello list isn’t set, so the to-dos weren’t sent)' : '') + (bad ? ` (${bad} couldn’t reach Trello)` : '');
}
async function nbSave() {
  const N = nb(), R = N.res || {}; N.busy = true; render(true);
  const evs = (R.events || []).filter(x => x.on);
  for (const e of evs) { S.ui.ev = nbEv(e); try { await saveEvent(); } catch (err) { console.warn(err); } }
  const more = await nbExtras(R);
  S.ui.nb = null; S.ui.capture = false; render(true);
  toast([evs.length ? `${evs.length} on the calendar` : '', more].filter(Boolean).join(', ') + '.');
}
/* one event: the normal event form, filled in, with the suggestions above it */
function nbDup(e) {
  const words = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter(w => w.length > 3);
  const w = words(e.title); return eventsOn(e.date).find(x => x.date === e.date && words(x.title).some(y => w.includes(y))) || null;
}
/* every event opens in the event form, one after another ("1 of 3", Skip). Each carries its own suggestions: things to bring
   and reminders go with the event on (or right after) their date, to-dos with the first. Days a kindergarten or school is
   shut come along on the first form as one ticked line. */
function nbQueue(N) {
  const R = N.res, open = R.events.filter(e => !e.closed).sort((a, b) => (a.date + (a.start || '')).localeCompare(b.date + (b.start || ''))), closed = R.events.filter(e => e.closed);
  const near = d => open.find(e => e.date >= d) || open[open.length - 1];
  const q = open.map(e => ({ e, res: { todos: [], bring: [], reminders: [] } })), at = e => q[open.indexOf(e)].res;
  for (const x of R.todos || []) at(open[0]).todos.push(x);
  for (const x of R.bring || []) at(open.find(e => e.date === x.date) || near(x.date)).bring.push(x);
  for (const x of R.reminders || []) at(near(x.date)).reminders.push(x);
  nbStep({ q, i: 0, closed, closedOn: true, summary: R.summary, fromForm: N.fromForm }, 0);
}
function nbStep(X, i) {
  const e = X.q[i].e, keep = i === 0 && X.fromForm && S.ui.ev ? S.ui.ev : null, f = nbEv(e);
  /* from a blank form: keep only what the person typed or ticked. The form's own defaults (today, "family", not all-day) must never overwrite what the photo says. */
  if (keep) { for (const k of ['title', 'who', 'place', 'color', 'guests', 'extraGuests', 'remind', 'recur', 'meet']) if (keep[k] && (!Array.isArray(keep[k]) || keep[k].length)) f[k] = keep[k]; }
  S.ui.nb = null; S.ui.capture = false;
  newEv({ ...f, ...(keep && keep.id ? { id: keep.id } : {}) });
  S.ui.photoX = { ...X, i, dup: nbDup(e) };
  if (location.hash !== '#calendar') location.hash = 'calendar';
  render(true); scrollTo(0, 0);
}
/* after a Save in the form (or Skip): this event's suggestions, the shut days with the first, then the next event */
async function photoNext(X, saved) {
  const msg = [];
  if (saved) { const m = await nbExtras(X.q[X.i].res, S.ui.lastSaved && S.ui.lastSaved.kind === 'kinder' ? null : (S.ui.lastSaved || {}).title); if (m) msg.push(m); }
  if (X.i === 0 && X.closed.length && X.closedOn) { for (const c of X.closed) { S.ui.ev = nbEv(c); try { await saveEvent(); } catch (err) { console.warn(err); } } msg.push(`${X.closed.length} closed day${X.closed.length === 1 ? '' : 's'} on the calendar`); }
  /* "add the rest as they are": every remaining event goes straight in, with its own ticked suggestions and just who the photo named */
  if (X.auto && X.i + 1 < X.q.length) {
    let n = 0;
    for (let j = X.i + 1; j < X.q.length; j++) {
      const it = X.q[j], ev = nbEv(it.e); S.ui.ev = ev; S.ui.lastSaved = { title: ev.title, kind: ev.kind };
      try { await saveEvent(); n++; const m = await nbExtras(it.res, ev.kind === 'kinder' ? null : ev.title); if (m) msg.push(m); } catch (err) { console.warn(err); }
      S.ui.ev = null;
    }
    S.ui.photoX = null; render(true); toast(`${n} more on the calendar${msg.length ? ', with ' + msg.join(', ') : ''}.`); return;
  }
  if (X.i + 1 < X.q.length) { nbStep(X, X.i + 1); if (msg.length) toast(msg.join(', ') + '.'); return; }
  S.ui.photoX = null; render(true); if (msg.length) toast((saved ? 'Saved, with ' : '') + msg.join(', ') + '.');
}
function photoPanel() {
  const X = S.ui.photoX; if (!X || !S.ui.ev) return '';
  const R = X.q[X.i].res, n = X.q.length, row = (grp, x, label) => `<li><label class="nb-row"><input type="checkbox" data-act="px-tog" data-grp="${grp}" data-id="${x.id}" ${x.on ? 'checked' : ''}> <span>${label}</span></label></li>`;
  const sug = [...R.todos.map(x => row('todos', x, `${esc(x.title)}${x.due ? ` · <span class="muted">by ${esc(fmtD(x.due))}</span>` : ''}`)),
    ...R.bring.map(x => row('bring', x, `Take along: ${esc(x.text)}`)), ...R.reminders.map(x => row('reminders', x, `Remind me: ${esc(x.title)} · <span class="muted">${esc(fmtD(x.date))} ${esc(x.time)}</span>`))];
  const cl = X.i === 0 && X.closed.length ? `<li><label class="nb-row"><input type="checkbox" data-act="px-closed" ${X.closedOn ? 'checked' : ''}> <span>Also add ${X.closed.length} closed day${X.closed.length === 1 ? '' : 's'} as all-day events: ${X.closed.map(c => `${esc(c.title)} ${esc(fmtD(c.date))}${c.end && c.end !== c.date ? '–' + esc(fmtD(c.end)) : ''}`).join(', ')}</span></label></li>` : '';
  return `<section class="card photo-x"><div class="sec-head"><p class="eyebrow">Filled in from your photo${n > 1 ? ` · event ${X.i + 1} of ${n}` : ''}</p>${n > 1 ? `<button class="link" data-act="px-skip">Skip this one</button>` : ''}</div>${X.i === 0 && X.summary ? `<p class="small">${esc(X.summary)}</p>` : ''}
    ${X.dup ? `<p class="note small">This may already be in the calendar: <b>${esc(X.dup.title)}</b>${X.dup.start ? ' at ' + esc(X.dup.start) : ''}. Saving adds it again.</p>` : ''}
    <p class="muted small">Check who’s going and the rest below, then Save${sug.length || cl ? ' (the ticked suggestions come too)' : ''}.${n > X.i + 1 ? ' The next one opens after.' : ''}</p>
    ${sug.length || cl ? `<ul class="bf-list nb-l">${sug.join('')}${cl}</ul>` : ''}
    ${n > X.i + 1 ? `<label class="nb-row"><input type="checkbox" data-act="px-auto" ${X.auto ? 'checked' : ''}> <span>Then add the other ${n - X.i - 1} as they are, without asking</span></label>` : ''}</section>`;
}
function vCapture2() {
  const C = cap(), canClaude = !!sample;
  let h = `<div class="scrim" data-act="close-capture"><div class="sheet capsheet" role="dialog" aria-label="Brain dump">`;
  if (S.ui.nb) return h + vNotice() + '</div></div>';
  if (!mcp) return h + '<div class="sec-head"><h2>Get it out of your head</h2><button class="link" data-act="close-capture">Close</button></div><p class="note">Trello can’t be reached from this view, so the brain dump has nowhere to send things yet.</p></div></div>';
  if (S.ui.nb) return h + vNotice() + '</div></div>';
  if (C.pick) return h + vPicker() + '</div></div>';
  if (C.step === 'review') return h + vReview() + '</div></div>';
  const ib = inbox();
  h += `<div class="sec-head"><h2>Get it out of your head</h2><button class="link" data-act="close-capture">Close</button></div>
    <p class="muted small">One thing per line, as messy as you like. ${canClaude ? 'Claude suggests where each one goes, a date and who it’s for. Nothing reaches Trello until you say so.' : 'You choose where each one goes before anything reaches Trello.'}</p>
    <textarea id="dumpText" rows="6" placeholder="call Klára about the photos by Friday&#10;Novel: the villain needs a motive&#10;Fix the gate&#10;pleny" aria-label="Things on your mind">${esc(S.ui.dumpText)}</textarea>
    <p class="muted small">Rather talk? Tap the microphone on your keyboard and say it; it works the same.</p>
    ${ib.length ? `<div class="note"><b>${ib.length} waiting in your inbox.</b> They’ll be sorted along with these. <button class="link" data-act="inbox-only">Sort just the inbox</button></div>` : ''}
    ${C.err ? `<p class="note">${esc(C.err)}</p>` : ''}
    <div class="actions">${canClaude ? `<button class="btn accent" data-act="cap-sort" ${C.thinking ? 'disabled' : ''}>${C.thinking ? 'Sorting…' : '✦ Sort it for me'}</button>` : ''}
      <button class="btn ${canClaude ? 'ghost' : 'accent'}" data-act="cap-manual" ${C.thinking ? 'disabled' : ''}>${canClaude ? 'I’ll choose myself' : 'Choose where they go'}</button>
      ${C.thinking ? '<button class="link" data-act="cap-stop">Stop</button>' : `<button class="link" data-act="cap-keep">Keep in my inbox for now</button>`}</div>
    ${canClaude ? `<div class="actions"><button class="btn ghost" data-act="nb-open">📷 From a photo: invitation, notice, booking…</button></div>` : ''}
    ${S.tb.status === 'loading' && !tbBoards().length ? '<p class="muted small">Reading your Trello boards…</p>' : ''}
    ${S.tb.status === 'error' && !tbBoards().length ? `<p class="note">${esc(trMsg(S.tb.err))}</p>` : ''}`;
  return h + '</div></div>';
}
function vReview() {
  const C = cap(), n = C.items.filter(x => x.on).length;
  return `<div class="sec-head"><h2>${C.sorted ? 'Here’s where I’d put them' : 'Where should they go?'}</h2><button class="link" data-act="cap-back">Back</button></div>
    <p class="muted small">Change anything that’s off. ${C.sorted ? 'Afloat remembers your changes, so the next sort gets closer.' : ''} Unticked ones wait in your inbox.</p>
    ${C.items.length > 1 ? `<div class="actions"><button class="tiny" data-act="cap-pick" data-id="*">Send all to one place…</button></div>` : ''}
    <ul class="rv-list">${C.items.map(x => { const b = tbListBoard(x.dest), ppl = others(b), labs = b ? b.labels.filter(l => l.name) : [];
      return `<li class="rv${x.on ? '' : ' off'}"><div class="rv-top"><button class="check${x.on ? ' on' : ''} rv-on" data-act="cap-on" data-id="${x.id}" aria-pressed="${x.on}" aria-label="Send this one"><span class="box" aria-hidden="true">${I.check}</span></button>
        <input type="text" class="rv-title" data-cap="title" data-id="${x.id}" value="${esc(x.title)}" aria-label="Card title"></div>
        <button class="dest" data-act="cap-pick" data-id="${x.id}"><span class="eyebrow">${esc(b ? b.ws : 'Where')}</span><b>${esc(destName(x.dest))}</b><span aria-hidden="true">▾</span></button>
        <div class="rv-row"><label><span class="small muted">Due</span><input type="date" data-cap="due" data-id="${x.id}" value="${esc(x.due)}"></label><label><span class="small muted">Time</span><input type="time" data-cap="time" data-id="${x.id}" value="${esc(x.time)}" ${x.due ? '' : 'disabled'}></label>
        ${ppl.length ? `<label><span class="small muted">Who does it</span><select data-cap="person" data-id="${x.id}"><option value="">Me</option>${ppl.map(p => `<option value="${esc(p.id)}"${p.id === x.person ? ' selected' : ''}>${esc(p.fullName)}</option>`).join('')}</select></label>` : ''}
        ${labs.length ? `<label><span class="small muted">Label</span><select data-cap="label" data-id="${x.id}"><option value="">None</option>${labs.map(l => `<option value="${esc(l.id)}"${l.id === x.label ? ' selected' : ''}>${esc(l.name)}</option>`).join('')}</select></label>` : ''}</div>
        ${!ppl.length && b ? `<p class="muted small">Only you are on ${esc(b.name)}. Invite someone to the board in Trello to hand tasks over.</p>` : ''}
        ${x.why ? `<p class="muted small rv-why">✦ ${esc(x.why)}${x.text !== x.title ? ` · you wrote “${esc(x.text)}”` : ''}</p>` : ''}</li>`; }).join('')}</ul>
    <div class="actions"><button class="btn accent" data-act="cap-send" ${S.ui.sending || !n ? 'disabled' : ''}>${S.ui.sending ? 'Sending…' : `Send ${n} to Trello`}</button><button class="link" data-act="cap-keepall">Keep all in inbox</button></div>`;
}
function vPicker() {
  const C = cap(), cur = C.pick === '*' ? '' : (C.items.find(x => x.id === C.pick) || {}).dest, rec = recentDests();
  const ws = [...new Set(tbBoards().map(b => b.ws))];
  return `<div class="sec-head"><h2>Where should it go?</h2><button class="link" data-act="pick-close">Back</button></div>
    ${rec.length ? `<div class="floorpick"><span class="eyebrow">Recently used</span><div class="pills">${rec.map(id => `<button class="pill${id === cur ? ' on' : ''}" data-act="pick-set" data-id="${esc(id)}">${esc(destName(id))}</button>`).join('')}</div></div>` : ''}
    ${ws.map(w => `<div class="ws"><h3>${esc(w)}</h3>${tbBoards().filter(b => b.ws === w).map(b => `<div class="pick-board"><b>${esc(b.name)}</b><div class="pills">${b.lists.map(l => `<button class="pill${l.id === cur ? ' on' : ''}" data-act="pick-set" data-id="${esc(l.id)}">${esc(l.name)}</button>`).join('')}</div></div>`).join('')}</div>`).join('') || '<p class="empty">Your boards haven’t loaded yet.</p>'}
    <div class="actions"><button class="link" data-act="tb-refresh">${S.tb.status === 'loading' ? 'Reading your boards…' : 'Missing a board or list? Re-read Trello'}</button></div>`;
}
function capLines(withInbox = true) {
  const typed = String(S.ui.dumpText || '').split('\n').map(x => x.trim()).filter(Boolean);
  return [...(withInbox ? inbox().map(x => x.text) : []), ...typed].slice(0, 40);
}
function capPrompt(lines) {
  const dests = [], code = {};
  tbBoards().forEach(b => b.lists.filter(l => !isDoneList(l.name)).forEach(l => { const k = 'D' + (dests.length + 1); code[k] = l.id; dests.push(`[${k}] ${b.ws} › ${b.name} › ${l.name}${isShopList(l.id) ? ' (shopping list: one item per card)' : ''}${l.id === (H('trello').people || {})[me] ? ' (this person’s own to-do list)' : ''}`); }));
  const ppl = tbBoards().map(b => others(b).length ? `${b.name}: ${others(b).map(p => `${p.username} = ${p.fullName}`).join(', ')}` : '').filter(Boolean);
  const labs = tbBoards().map(b => b.labels.some(l => l.name) ? `${b.name}: ${b.labels.filter(l => l.name).map(l => l.name).join(', ')}` : '').filter(Boolean);
  const days = []; for (let i = 0; i < 15; i++) { const d = new Date(); d.setDate(d.getDate() + i); days.push(`${i === 0 ? 'today ' : i === 1 ? 'tomorrow ' : ''}${DAYS[(d.getDay() + 6) % 7]} ${keyOf(d)}`); }
  const ex = examples().slice(-25).map(x => `"${x.t}" → ${x.d}`);
  return { code, text: `You sort a person's brain dump into their Trello boards. The person is ${(S.tb.me || {}).fullName || me || 'the user'}; they live in Prague and write in Czech or English.
Dates: ${days.join(', ')}.
Destinations (answer with the code):
${dests.join('\n')}
${ppl.length ? `Other people on a board who can be handed a task (Trello username = name):\n${ppl.join('\n')}` : 'Nobody else is on these boards.'}
${labs.length ? `Labels per board: ${labs.join('; ')}` : ''}
${ex.length ? `This person's past choices (follow these patterns):\n${ex.join('\n')}` : ''}
Rules:
- One card per task. Split a line only when it clearly holds separate tasks; most lines stay whole.
- title: short and actionable, in the language the person used, keeping their wording. Leave out the date and the handed-to person once you've captured them, unless the title would lose meaning.
- dest: the best-fitting code; shopping items go to the shopping list; null if you really can't tell.
- due: YYYY-MM-DD only when the line gives a time ("by Friday", "zítra", "v pondělí", "tonight", "next week" = next Monday). time: HH:MM only if stated ("tonight" = 20:00).
- person: a username only if the line says someone else should do it AND that person is listed for the chosen destination's board. Never the person themselves.
- label: a label name from the chosen board only when it clearly fits.
- why: at most 8 words, in English, saying why this destination.
Reply with only a JSON array, one object per card: [{"line":1,"title":"…","dest":"D3","due":null,"time":null,"person":null,"label":null,"why":"…"}]
Lines:
${lines.map((l, i) => `${i + 1}. ${l}`).join('\n')}` };
}
let capCtl = null;
async function capSort(withInbox = true) {
  const C = cap(), lines = capLines(withInbox); if (!lines.length) { C.err = 'Write at least one thing first.'; return render(true); }
  if (!tbBoards().length) await tbLoad(true);
  if (!tbBoards().length) { C.err = 'Your Trello boards couldn’t be read, so there’s nowhere to sort to yet.'; return render(true); }
  C.thinking = true; C.err = ''; C.fromInbox = withInbox; render(true);
  const { code, text } = capPrompt(lines); capCtl = new AbortController();
  try {
    const out = await sample.json(text, { modelTier: 'quick', feature: 'sorting', signal: capCtl.signal, cache: false });
    const arr = Array.isArray(out) ? out : (out && Array.isArray(out.cards)) ? out.cards : [];
    if (!arr.length) throw { code: 'invalid_json' };
    const seen = new Set();
    C.items = arr.filter(r => r && String(r.title || '').trim()).map(r => {
      const li = Math.max(1, Math.min(lines.length, +r.line || 1)); seen.add(li);
      const dest = code[String(r.dest || '')] || defaultDest(), b = tbListBoard(dest);
      const person = r.person ? (others(b).find(p => p.username === String(r.person).replace(/^@/, '')) || {}).id || '' : '';
      const label = r.label ? ((b ? b.labels : []).find(l => l.name && l.name.toLowerCase() === String(r.label).toLowerCase()) || {}).id || '' : '';
      const due = /^\d{4}-\d\d-\d\d$/.test(r.due || '') ? r.due : '', time = due && /^\d\d:\d\d$/.test(r.time || '') ? r.time : '';
      return capItem(lines[li - 1], { title: String(r.title).trim().slice(0, 300), dest, due, time, person, label, why: String(r.why || '').slice(0, 80), claude: dest });
    });
    lines.forEach((l, i) => { if (!seen.has(i + 1)) C.items.push(capItem(l)); });
    C.step = 'review'; C.sorted = true;
  } catch (e) {
    const c = e && e.code;
    if (c === 'cancelled') C.err = '';
    else if (c === 'not_granted' || c === 'sampling_disabled' || c === 'not_declared' || c === 'capability_disabled') { sample = null; C.err = 'Claude isn’t allowed to sort here, so you can choose the places yourself.'; }
    else if (c === 'rate_limited') C.err = 'Claude is busy for you right now. Try again in a little while, or choose the places yourself.';
    else C.err = 'The sorting didn’t come back right. Try again, or choose the places yourself.';
  }
  C.thinking = false; capCtl = null; render(true);
}
function capManual(withInbox = true) {
  const C = cap(), lines = capLines(withInbox); if (!lines.length) { C.err = 'Write at least one thing first.'; return render(true); }
  if (!tbBoards().length) tbLoad(true);
  C.items = lines.map(l => capItem(l)); C.step = 'review'; C.sorted = false; C.err = ''; C.fromInbox = withInbox; render(true);
}
function capKeep() {
  const typed = String(S.ui.dumpText || '').split('\n').map(x => x.trim()).filter(Boolean); if (!typed.length) return toast('Nothing to keep yet.');
  saveInbox([...inbox(), ...typed.map(t => ({ id: uid(), text: t, at: Date.now() }))]);
  S.ui.dumpText = ''; S.ui.capture = false; S.ui.cap = null; render(true);
  toast(`${typed.length} in your inbox. Sort ${typed.length === 1 ? 'it' : 'them'} whenever you like.`);
}
async function capSend() {
  const C = cap(), go = C.items.filter(x => x.on && x.dest && String(x.title).trim()), stay = C.items.filter(x => !x.on);
  if (!go.length) return;
  S.ui.sending = true; render(true);
  const sent = [], meP = S.tb.me || {}, myName = meP.fullName || me || 'Someone';
  try {
    for (const x of go) {
      const due = dueISO(x.due, x.time), b = tbListBoard(x.dest), p = x.person ? others(b).find(m => m.id === x.person) : null;
      const r = await trCreate(x.dest, x.title.trim(), due, p ? `Handed to ${p.fullName} by ${myName} in Afloat.` : 'From the Afloat inbox.');
      const pl = r.payload || {}, cid = pl.id || (pl.card && pl.card.id) || '', curl = pl.url || pl.webUrl || (pl.card && (pl.card.url || pl.card.webUrl)) || '';
      if (cid && x.label) await trCall('trelloWriteCard', { action: 'attach_label', cardId: cid, labelId: x.label }).catch(() => {});
      if (cid && p) {
        await trCall('trelloWriteCard', { action: 'add_comment', cardId: cid, text: `@${p.username} this one’s yours${due ? ', due ' + dueLabel(due) : ''}. Handed over by ${myName} in Afloat.` }).catch(() => {});
        saveTasks({ handed: { [tkey(cid)]: { cardId: cid, name: x.title.trim(), url: curl, boardName: b ? b.name : '', due, toId: p.id, toName: p.fullName, toUser: p.username, by: me, byName: myName, at: Date.now() } } });
      }
      pushRecent(x.dest); sent.push(x);
    }
  } catch (e) { toast((sent.length ? `${sent.length} sent, then this: ` : '') + trMsg(e)); }
  if (sent.length) learn(sent);
  const left = C.items.filter(x => !sent.includes(x) && x.on);
  const keepText = [...stay, ...left].map(x => x.text);
  const keptIb = C.fromInbox ? [] : inbox();
  saveInbox([...keptIb, ...keepText.map(t => ({ id: uid(), text: t, at: Date.now() }))]);
  S.ui.sending = false;
  if (!left.length) {
    S.ui.dumpText = ''; S.ui.capture = false; S.ui.cap = null;
    const n = sent.length; if (n) toast(`${n} card${n === 1 ? '' : 's'} on Trello${stay.length ? `, ${stay.length} kept in your inbox` : ''}. Your head can let go of ${n === 1 ? 'it' : 'them'}.`);
  } else C.items = left;
  trLoad(); render(true);
}
function taskAct(a, el) {
  const C = S.ui.cap;
  switch (a) {
    case 'cap-sort': capSort(true); return true;
    case 'inbox-only': S.ui.dumpText = ''; sample ? capSort(true) : capManual(true); return true;
    case 'inbox-sort': S.ui.capture = true; S.ui.cap = null; S.ui.dumpText = ''; sample ? capSort(true) : capManual(true); return true;
    case 'cap-manual': capManual(true); return true;
    case 'cap-stop': if (capCtl) capCtl.abort(); return true;
    case 'cap-keep': capKeep(); return true;
    case 'cap-keepall': if (C) { C.items.forEach(x => x.on = false); capSend().then(() => { if (S.ui.cap && !S.ui.cap.items.some(x => x.on)) { const n = S.ui.cap.items.length; saveInbox([...(S.ui.cap.fromInbox ? [] : inbox()), ...S.ui.cap.items.map(x => ({ id: uid(), text: x.text, at: Date.now() }))]); S.ui.capture = false; S.ui.cap = null; S.ui.dumpText = ''; toast(`${n} kept in your inbox.`); render(true); } }); } return true;
    case 'cap-back': if (C) { C.step = 'write'; C.pick = null; } render(true); return true;
    case 'cap-on': { const x = C && C.items.find(i => i.id === el.dataset.id); if (x) x.on = !x.on; render(true); return true; }
    case 'cap-pick': if (C) C.pick = el.dataset.id; render(true); $('#sheet .sheet') && ($('#sheet .sheet').scrollTop = 0); return true;
    case 'pick-close': if (C) C.pick = null; render(true); return true;
    case 'pick-set': if (C) { const id = el.dataset.id, set = x => { if (x.dest !== id) { x.dest = id; x.person = ''; x.label = ''; } }; C.pick === '*' ? C.items.forEach(set) : C.items.filter(x => x.id === C.pick).forEach(set); C.pick = null; } render(true); return true;
    case 'cap-send': capSend(); return true;
    case 'inbox-x': saveInbox(inbox().filter(x => x.id !== el.dataset.id)); return true;
    case 'tgroup': S.ui.tGroup = el.dataset.v; lsSet('afloat.tgroup', el.dataset.v); render(true); return true;
    case 'inv-add': { const em = el.dataset.e, inp = document.getElementById('inv_' + em.replace(/[^a-z0-9]/g, '_')), name = String((inp && inp.value) || '').trim();
      if (!name) { toast('Give them a name first.'); return true; }
      if (everyone().includes(name) || isFriend(name)) { const f = friendsL().find(x => x.name === name); if (f && !f.email) { setFriend(f.id, { email: em }); toast(`Saved ${em} for ${name}.`); return true; } toast(`${name} is already here. Pick another name.`); return true; }
      addFriend(name, '', em); toast(`${name} added to Partners & friends. Edit their profile under Us → Family.`); setTimeout(() => { S.gcal = { ...S.gcal, inv: (S.gcal.inv || []).map(i => i.fromEmail === em ? { ...i, from: name, who: uniq([...i.who, name]) } : i) }; render(true); }, 0); return true; }
    case 'inv-link': { const em = el.dataset.e, sel = document.getElementById('invl_' + em.replace(/[^a-z0-9]/g, '_')), v = String((sel && sel.value) || '');
      if (!v) { toast('Pick who they are first.'); return true; }
      const kind = v.slice(0, 1), id = v.slice(2); let nm = '';
      if (kind === 'c') { const o = { ...H('contacts') }; o.list = (o.list || []).map(c => { if (c.id !== id) return c; nm = c.name; return c.email && c.email.toLowerCase() !== em ? { ...c, altEmails: uniq([...(c.altEmails || []), em]) } : { ...c, email: em }; }); if (nm) saveHome('contacts', o); }
      else { const f = friendsL().find(x => x.id === id); if (f) { nm = f.name; setFriend(id, { email: em }); } }
      if (!nm) return true;
      toast(`${em} is now ${nm}.`); setTimeout(() => { S.gcal = { ...S.gcal, inv: (S.gcal.inv || []).map(i => i.fromEmail === em ? { ...i, from: nm, ...(kind === 'f' ? { who: uniq([...i.who, nm]) } : {}) } : i) }; render(true); }, 0); return true; }
    case 'inv-skip': S.ui.invSkip = { ...(S.ui.invSkip || {}), [el.dataset.e]: 1 }; render(true); return true;
    case 'inv-never': saveHome('invites', { ...H('invites'), ignore: { ...(H('invites').ignore || {}), [el.dataset.e.replace(/[.@]/g, '_')]: true } }); return true;
    case 'perm-manage': if (S.perm) S.perm.manage().then(() => { tbLoad(true).then(trLoad); calLoad(); }).catch(() => {}); return true;
    case 'conn-check': tbLoad(true).then(trLoad); calLoad(); return true;
    case 'tview': S.ui.tView = el.dataset.v; lsSet('afloat.tview', el.dataset.v); render(true); return true;
    case 'tasks-refresh': tbLoad(true).then(trLoad); trLoad(); return true;
    case 'tb-refresh': tbLoad(true).then(trLoad); return true;
    case 'list-show': { const l = tbList(el.dataset.id); if (!l) return true; saveTasks({ show: { [me]: { [tkey(l.id)]: !listShown(l) } } }); return true; }
    case 'handed-clear': saveTasks({ handed: { [el.dataset.k]: null } }); return true;
  }
  return false;
}
function taskInput(el) {
  const f = el.dataset && el.dataset.cap, C = S.ui.cap; if (!f || !C) return false;
  const x = C.items.find(i => i.id === el.dataset.id); if (!x) return true;
  x[f] = el.value; if (f === 'due' && !el.value) x.time = '';
  if (f === 'due') { const t = el.closest('.rv-row').querySelector('input[type=time]'); if (t) { t.disabled = !el.value; if (!el.value) t.value = ''; } }
  return true;
}
/* ---------- taps on this area's buttons (data-act), called from events.js; true = handled ---------- */
function tapCapture(a, el, e, r) {
  switch (a) {
    case 'px-tog': { const X = S.ui.photoX, R = X ? X.q[X.i].res : {}, x = (R[el.dataset.grp] || []).find(y => y.id === el.dataset.id); if (x) x.on = !!el.checked; return true; }
    case 'px-closed': if (S.ui.photoX) S.ui.photoX.closedOn = !!el.checked; return true;
    case 'px-auto': if (S.ui.photoX) S.ui.photoX.auto = !!el.checked; return true;
    case 'px-skip': { const X = S.ui.photoX; if (X) { S.ui.ev = null; photoNext(X, false); } return true; }
    case 'nb-open': S.ui.dumpText = ($('#dumpText') || {}).value ?? S.ui.dumpText; S.ui.nb = { step: 'pick', files: [], text: '' }; render(true); return true;
    case 'nb-back': if (nb().step === 'review' || nb().step === 'study') nb().step = 'pick'; else { if (nb().fromForm) S.ui.capture = false; S.ui.nb = null; } render(true); return true;
    case 'nb-clear': nb().files = []; render(true); return true;
    case 'nb-read': nbRead(); return true;
    case 'nb-save': nbSave(); return true;
    case 'nb-tog': { const R = nb().res || {}, x = (R[el.dataset.grp] || []).find(y => y.id === el.dataset.id); if (x) x.on = !!el.checked; return true; }
    case 'close-capture': if (capCtl) capCtl.abort(); S.ui.capture = false; S.ui.cap = null; S.ui.nb = null; render(true); return true;
  }
  return false;
}
