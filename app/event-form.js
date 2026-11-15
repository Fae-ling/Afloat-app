/* Afloat · app/event-form.js · The event form: repeat and more options, places, saving to and deleting from Google.
   Plain script: shares one scope with the other app/*.js files (loaded in order by index.html). See CLAUDE.md. */
function recurUI(ev) {
  const k = ev.date || realToday(), pre = presetOf(ev.recur, k), r = ev.recur;
  const opts = [['', 'Does not repeat'], ['daily', 'Every day'], ['weekly', `Every week on ${DAYS_LONG[(dOf(k).getDay() + 6) % 7]}`], ['monthly', `Every month on day ${dOf(k).getDate()}`], ['monthlyNth', `Every month on the ${ORD[nthOf(k) === -1 ? 4 : nthOf(k) - 1]} ${DAYS_LONG[(dOf(k).getDay() + 6) % 7]}`], ['yearly', `Every year on ${dOf(k).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`], ['weekdays', 'Every weekday (Mon–Fri)'], ['custom', 'Custom…']];
  let h = `<label class="small">Repeat <select id="evRepeat" data-act="ev-repeat">${opts.map(([v, l]) => `<option value="${v}" ${pre === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
  if (pre === 'custom' && r) h += `<div class="recur-custom">
      <div class="addform"><span class="small">Every</span><input type="number" min="1" max="99" id="evInt" data-rc="interval" value="${+r.interval || 1}" style="width:4.5em" aria-label="Repeat every">
        <select id="evFreq" data-rc="freq" aria-label="Unit">${[['DAILY', 'day'], ['WEEKLY', 'week'], ['MONTHLY', 'month'], ['YEARLY', 'year']].map(([v, l]) => `<option value="${v}" ${r.freq === v ? 'selected' : ''}>${l}${(+r.interval || 1) > 1 ? 's' : ''}</option>`).join('')}</select></div>
      ${r.freq === 'WEEKLY' ? `<div class="pills">${DAYC.map(c => `<button type="button" class="pill dpill${(r.byday || []).includes(c) ? ' on' : ''}" data-act="ev-rday" data-v="${c}" aria-pressed="${(r.byday || []).includes(c)}">${DAYN[c].slice(0, 2)}</button>`).join('')}</div>` : ''}
      ${r.freq === 'MONTHLY' ? `<div class="pills">${[['day', `On day ${dOf(k).getDate()}`], ['nth', `On the ${ORD[nthOf(k) === -1 ? 4 : nthOf(k) - 1]} ${DAYS_LONG[(dOf(k).getDay() + 6) % 7]}`]].map(([v, l]) => `<button type="button" class="pill${(r.mode || 'day') === v ? ' on' : ''}" data-act="ev-rmode" data-v="${v}">${l}</button>`).join('')}</div>` : ''}
      <div><p class="small">Ends</p><div class="pills">${[['never', 'Never'], ['until', 'On a date'], ['count', 'After a number of times']].map(([v, l]) => `<button type="button" class="pill${(r.ends || 'never') === v ? ' on' : ''}" data-act="ev-rends" data-v="${v}">${l}</button>`).join('')}</div>
        ${r.ends === 'until' ? `<input type="date" id="evUntil" data-rc="until" value="${esc(r.until || calAdd(k, 90))}" aria-label="Ends on">` : ''}${r.ends === 'count' ? `<label class="small"><input type="number" min="1" max="999" id="evCount" data-rc="count" value="${+r.count || 10}" style="width:5em"> times</label>` : ''}</div>
    </div>`;
  if (r) h += `<p class="muted small">${esc(recurLabel(r, k))}.${ev.gId ? ' Changes apply to every repeat. To change just one, edit that day in Google Calendar.' : ''}</p>`;
  if (ev.master && !ev.recur) h += '<p class="muted small">This is one repeat of a series set up in Google Calendar. Changes here apply to this day only.</p>';
  return h;
}
function moreUI(ev) {
  const rs = remList(ev);
  return `<div><p class="small">Reminders</p><div class="pills">${REMS.map(([m, l]) => `<button type="button" class="pill${rs.includes(m) ? ' on' : ''}" data-act="ev-rem" data-v="${m}" aria-pressed="${rs.includes(m)}">${l}</button>`).join('')}</div><p class="muted small">${rs.length ? 'Your phones remind you at each of these.' : 'None picked: the calendar’s default reminder is used.'}</p></div>
    <div class="addform"><span class="small">Show as</span><div class="pills">${[['', 'Busy'], ['free', 'Free']].map(([v, l]) => `<button type="button" class="pill${(ev.free ? 'free' : '') === v ? ' on' : ''}" data-act="ev-free" data-v="${v}">${l}</button>`).join('')}</div></div>
    ${ev.free ? '<p class="muted small">Free events don’t count when Afloat checks whether you’re both busy (hlídání).</p>' : ''}
    <label class="small">Visibility <select id="evVis" data-evf="vis"><option value="" ${!ev.vis ? 'selected' : ''}>Calendar default</option><option value="private" ${ev.vis === 'private' ? 'selected' : ''}>Private (only people on the event see details)</option><option value="public" ${ev.vis === 'public' ? 'selected' : ''}>Public</option></select></label>
    ${ev.meetUrl ? `<p class="small">Google Meet: <a class="link" href="${esc(ev.meetUrl)}" target="_blank" rel="noopener">join</a></p>` : `<label class="small" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="evMeet" data-evf="meet" ${ev.meet ? 'checked' : ''}> Add a Google Meet video link</label>`}`;
}
/* places Afloat already knows, for address suggestions: past events and friends' addresses */
function knownPlaces() {
  const m = new Map(), add = (v, l) => { v = String(v || '').trim(); if (v && !m.has(v)) m.set(v, l || ''); };
  for (const f of friendsL()) if (f.address) add(f.address, f.name);
  for (const c of H('contacts').list || []) if (c.note && /\d/.test(c.note) && /,/.test(c.note)) add(c.note, c.name);
  for (const e of [...Object.values(S.events || {}), ...(S.gcal.events || []), ...(S.gcal.mine || [])].sort((x, y) => (y.date || '').localeCompare(x.date || ''))) add(e.place, shortTitle(e.title || ''));
  return [...m.entries()].slice(0, 60);
}
function evForm() {
  const ev = S.ui.ev, isNew = !ev.id && !ev.gId, ppl = everyone(), xg = ev.extraGuests || [], gp = gpermOf(ev), anyGuests = guestsOf(ev).length > 0;
  return `<section class="card evform"><div class="sec-head"><h2>${isNew ? 'New event' : 'Edit event'}</h2><button class="link" data-act="ev-cancel">Cancel</button></div>
    ${isNew && sample && !S.ui.photoX ? `<button class="btn ghost small ev-photo" type="button" data-act="ev-photo">📷 Fill from a photo</button>` : ''}
    <form data-form="event" class="evgrid">
      <input type="text" name="text" id="evTitle" data-evf="title" value="${esc(ev.title || '')}" placeholder="Add title, e.g. Dentist" required aria-label="Title">
      <fieldset class="evsec"><legend>When</legend>
        <div class="evwhen"><span class="small">Starts</span><input type="date" id="evDate" data-evf="date" value="${esc(ev.date || '')}" required aria-label="Start date">${ev.allDay ? '' : `<input type="time" id="evStart" data-evf="start" value="${esc(ev.start || '')}" aria-label="Start time">`}
          <span class="small">Ends</span><input type="date" id="evEnd" data-evf="endDate" value="${esc(ev.endDate && ev.endDate >= (ev.date || '') ? ev.endDate : ev.date || '')}" aria-label="End date">${ev.allDay ? '' : `<input type="time" id="evEndT" data-evf="end" value="${esc(ev.end || '')}" aria-label="End time">`}</div>
        <label class="small" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="evAll" data-evf="allDay" ${ev.allDay ? 'checked' : ''}> All day</label>
        ${recurUI(ev)}</fieldset>
      <fieldset class="evsec"><legend>Where</legend>
        <input type="text" id="evPlace" data-evf="place" list="evPlaces" value="${esc(ev.place || '')}" placeholder="Add location: address or place" aria-label="Where" autocomplete="street-address">
        <datalist id="evPlaces">${knownPlaces().map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}</datalist>
        <div id="evMap">${mapLinks(ev.place)}</div>
        <p class="muted small">Suggestions come from places you’ve used before and your friends’ addresses. Google Calendar shows the address with a map link on your phones.</p></fieldset>
      <fieldset class="evsec"><legend>Who</legend>
        <div><p class="small">Who’s going</p><div class="chips">${ppl.map(whoChip).join('')}</div></div>
        <div><p class="small">With friends &amp; partners</p><div class="chips">${friendNames().filter(n => !ppl.includes(n)).map(whoChip).join('')}${(ev.who || []).filter(n => !ppl.includes(n) && !isFriend(n)).map(whoChip).join('')}<button type="button" class="tiny" data-act="fr-quick">${S.ui.frQuick ? 'Cancel' : '+ Someone new'}</button></div>
          ${S.ui.frQuick ? `<div class="addform"><input type="text" id="frQName" placeholder="Name" aria-label="Name"><input type="text" id="frQRel" placeholder="Who they are (optional)" aria-label="Who they are"><input type="email" id="frQEm" placeholder="Google account email (optional)" aria-label="Google account email"><button type="button" class="btn" data-act="fr-quick-add">Add and include</button></div><p class="muted small">They’re saved under Us → Family, so next time they’re one tap away.</p>` : ''}</div>
        <div><p class="small">Add guests by email</p>${xg.length ? `<div class="chips">${xg.map(m => `<span class="chip">${esc(m)}<button type="button" class="x" data-act="ev-guest-x" data-v="${esc(m)}" aria-label="Remove ${esc(m)}">✕</button></span>`).join('')}</div>` : ''}
          <div class="addform"><input type="email" id="evGuest" placeholder="name@example.com" aria-label="Guest email" enterkeyhint="done"><button type="button" class="btn ghost" data-act="ev-guest-add">Add</button></div></div>
        ${inviteBox(ev)}
        ${anyGuests ? `<div class="gperm"><p class="small">Guest permissions</p>${GPERM.map(([k, l]) => `<label class="small" style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-gp="${k}" ${gp[k] ? 'checked' : ''}> ${l}</label>`).join('')}</div>` : ''}</fieldset>
      <fieldset class="evsec"><legend>Details</legend>
        <textarea id="evNotes" data-evf="notes" rows="3" placeholder="Add description" aria-label="Description">${esc(ev.notes || '')}</textarea>
        ${calCfg().gpId && kidsOn(ev).length ? `<label class="small" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="evGp" data-act="ev-gp" ${ev.gpShare ? 'checked' : ''}> Also put it on ${esc(calCfg().gpName)} so the grandparents see it (title and who only, no notes)</label>` : ''}
        ${moreUI(ev)}
        <div><p class="small">Colour ${ev.color ? `<button type="button" class="linkish" data-act="ev-col" data-v="">match who’s going again</button>` : `<span class="muted">· ${hhOf(ev).length > 1 ? 'Together colour, because several of you are going' : hhOf(ev).length === 1 ? `${esc(hhOf(ev)[0])}’s colour` : (ev.who || []).length ? `${esc(ev.who[0])}’s colour` : 'grey until you tick who’s going'}</span>`}</p>${swatches(GSW(), evColor(ev), 'ev-col')}</div></fieldset>
      ${pxFormHtml(ev)}
      <div class="actions"><button class="btn accent" type="submit" ${S.ui.evBusy ? 'disabled' : ''}>${S.ui.evBusy ? 'Saving…' : ev.plan ? 'Save and open' : 'Save'}</button>${!isNew ? `<button type="button" class="btn ghost" data-act="ev-del">${S.ui.armDel ? 'Tap again to delete' : ev.recur ? 'Delete every repeat' : 'Delete'}</button>` : ''}</div>
    </form>${calCfg().calId ? '' : '<p class="muted small">No shared Google calendar chosen yet, so this is saved in Afloat only.</p>'}</section>`;
}
function gBody(ev) {
  const who = (ev.who || []).length ? ' · ' + ev.who.join(', ') : '';
  let startTime, endTime;
  if (ev.allDay) { startTime = ev.date + 'T00:00:00'; const e = new Date((ev.endDate || ev.date) + 'T12:00'); e.setDate(e.getDate() + 1); endTime = keyOf(e) + 'T00:00:00'; }
  else { const st = ev.start || '09:00'; startTime = `${ev.date}T${st}:00`; endTime = `${ev.endDate && ev.endDate > ev.date ? ev.endDate : ev.date}T${ev.end || addMin(st, 60)}:00`; }
  return { summary: ev.title + who, description: `${(ev.who || []).length ? 'Who: ' + ev.who.join(', ') + '\n' : ''}${ev.notes ? ev.notes + '\n' : ''}Added from Afloat`, startTime, endTime, ...(ev.allDay ? { allDay: true } : {}), location: ev.place || '', colorId: toGoogle(evColor(ev)), ...(remList(ev).length ? { overrideReminders: remList(ev).map(m => ({ method: 'popup', minutes: m })) } : { useDefaultReminders: true }), availability: ev.free ? 'AVAILABILITY_FREE' : 'AVAILABILITY_BUSY', ...(ev.vis ? { visibility: ev.vis } : {}) };
}
async function saveEvent() {
  const ev = S.ui.ev; if (!ev.title || !ev.date) return toast('Give it a title and a date.');
  if (ev.endDate && ev.endDate < ev.date) return toast('It ends before it starts. Check the end date.');
  const wantPlan = ev.plan ? ev.planKind || pxKindOf(ev) : '';
  const id = ev.id || uid() + uid(), c = calCfg(), prevRule = ((S.events[id] || {}).rrule) || '';
  /* timed: keep a multi-day end (imported overnights), and an end time before the start means it ends the next day */
  const tEnd = ev.allDay ? ev.date : !ev.end ? (ev.endDate && ev.endDate > ev.date ? ev.endDate : ev.date) : ev.endDate && ev.endDate > ev.date ? ev.endDate : ev.start && ev.end <= ev.start ? calAdd(ev.date, 1) : ev.date;
  const doc = { title: ev.title, kind: ev.kind || 'family', who: ev.who || [], date: ev.date, endDate: ev.allDay ? (ev.endDate && ev.endDate >= ev.date ? ev.endDate : ev.date) : tEnd, allDay: !!ev.allDay, start: ev.allDay ? '' : (ev.start || ''), end: ev.allDay ? '' : (ev.end || ''), place: ev.place || '', notes: ev.notes || '', remind: ev.remind || '', gId: ev.gId || null, gpShare: !!ev.gpShare, gpGId: ev.gpGId || null, invite: ev.invite !== false, invited: ev.invited || [], color: ev.color || null, guests: ev.guests || [], gUpd: ev.gUpd || '', recur: ev.recur ? JSON.parse(JSON.stringify(ev.recur)) : null, extraGuests: ev.extraGuests || [], gperm: gpermOf(ev), rrule: ev.recur ? toRRULE(ev.recur, ev.date) : '', free: !!ev.free, vis: ev.vis || '', remind: remList(ev), meet: !!ev.meet, meetUrl: ev.meetUrl || '', master: ev.master || '', by: me || '', at: Date.now() };
  S.ui.evBusy = true; render(true);
  const put = d => { S.events = { ...S.events, [id]: d }; if (db) return q('events/' + id, () => db.doc('events/' + id).set(d)); return Promise.resolve(); };
  await put(doc);
  if (c.calId && mcp) {
    try {
      const guests = guestsOf(doc), gEm = guests.map(g => g.email), was = doc.invited || [];
      const added = guests.filter(g => !was.includes(g.email)), removed = was.filter(e => !gEm.includes(e));
      const noEdit = gpermOf(doc);
      let gr, recreated = false;
      /* Google's connection can't change a repeat rule, so a changed rule re-creates the series */
      if (doc.gId && prevRule !== (doc.rrule || '') && !doc.master) { try { await mcp.callTool(GC, 'delete_event', { calendarId: c.calId, eventId: doc.gId, notificationLevel: (doc.guests || []).length ? 'ALL' : 'NONE' }, { cache: false }); } catch {} doc.gId = null; doc.invited = []; recreated = true; }
      const meetAdd = doc.meet && !doc.meetUrl ? { addGoogleMeetUrl: true } : {};
      if (doc.gId) gr = await mcp.callTool(GC, 'update_event', { calendarId: c.calId, eventId: doc.gId, ...gBody(doc), ...(added.length ? { addedAttendees: added.map(g => ({ email: g.email, displayName: g.name })) } : {}), ...(guests.length ? { guestPermissions: noEdit } : {}), ...(removed.length ? { removedAttendeeEmails: removed } : {}), notificationLevel: added.length || removed.length || was.length || (doc.guests || []).length ? 'ALL' : 'NONE', ...meetAdd }, { cache: false });
      else gr = await mcp.callTool(GC, 'create_event', { calendarId: c.calId, ...gBody(doc), ...meetAdd, ...(doc.rrule ? { recurrenceData: [doc.rrule] } : {}), ...(guests.length ? { attendees: guests.map(g => ({ email: g.email, displayName: g.name })), guestPermissions: noEdit, notificationLevel: 'ALL' } : {}) }, { cache: false });
      { const p = (gr && gr.payload) || {}, gid = doc.gId || p.id || (p.event && p.event.id), upd = p.updated || (p.event && p.event.updated) || new Date().toISOString(), mu = p.hangoutLink || ((((p.conferenceData || {}).entryPoints || []).find(x => x.entryPointType === 'video')) || {}).uri || doc.meetUrl || '';
        await put({ ...(S.events[id] || doc), gId: gid || null, gUpd: upd, meetUrl: mu }); if (recreated) toast('The repeat changed, so the series was re-created in Google Calendar.'); }
      if (added.length || removed.length) await put({ ...(S.events[id] || doc), invited: gEm });
      if (c.gpId && (doc.gpShare || doc.gpGId)) {
        const cur = S.events[id] || doc, gb = { ...gBody(doc), description: `${(doc.who || []).length ? 'Who: ' + doc.who.join(', ') + '\n' : ''}Added from Afloat`, location: doc.place || '' };
        if (doc.gpShare && cur.gpGId) await mcp.callTool(GC, 'update_event', { calendarId: c.gpId, eventId: cur.gpGId, ...gb }, { cache: false });
        else if (doc.gpShare) { const r2 = await mcp.callTool(GC, 'create_event', { calendarId: c.gpId, ...gb, ...(doc.rrule ? { recurrenceData: [doc.rrule] } : {}) }, { cache: false }); const p2 = r2.payload || {}; const g2 = p2.id || (p2.event && p2.event.id); if (g2) await put({ ...cur, gpGId: g2 }); }
        else if (cur.gpGId) { await mcp.callTool(GC, 'delete_event', { calendarId: c.gpId, eventId: cur.gpGId }, { cache: false }); await put({ ...cur, gpGId: null }); }
      }
      toast(`Saved to ${c.calName || 'the family calendar'}${doc.gpShare ? ' and ' + (c.gpName || 'the grandparents’ calendar') : ''}.${added.length ? ' Invitation sent to ' + added.map(g => g.name).join(', ') + '.' : ''}${removed.length ? ' Guest list updated.' : ''}`); calLoad();
    } catch (e) { toast('Saved in Afloat. ' + connMsg(e, 'Google Calendar')); }
  } else toast('Saved in Afloat.');
  S.ui.evBusy = false; S.ui.ev = null; render(true);
  if (wantPlan && S.events[id]) { const np = pxFromEvent({ ...S.events[id], id }, wantPlan); tgFromForm(ev, np && np.id); if (S.view !== 'plans') location.hash = 'plans'; render(true); scrollTo(0, 0); }
}
async function deleteEvent() {
  const ev = S.ui.ev, c = calCfg(); if (!S.ui.armDel) { S.ui.armDel = true; render(true); return; }
  S.ui.armDel = false;
  if (ev.id) { const n = { ...S.events }; delete n[ev.id]; S.events = n; if (db) q('events/' + ev.id, () => db.doc('events/' + ev.id).delete()); }
  if (ev.gpGId && c.gpId && mcp) mcp.callTool(GC, 'delete_event', { calendarId: c.gpId, eventId: ev.gpGId }, { cache: false }).catch(() => {});
  if (ev.gId && c.calId && mcp) { try { await mcp.callTool(GC, 'delete_event', { calendarId: c.calId, eventId: ev.gId }, { cache: false }); S.gcal = { ...S.gcal, events: S.gcal.events.filter(x => x.gId !== ev.gId) }; } catch (e) { toast(connMsg(e, 'Google Calendar')); } }
  S.ui.ev = null; toast('Event deleted.'); render(true);
}
function newEv(seed) { S.ui.kindQuick = false; S.ui.ev = { title: '', kind: 'family', who: [], date: tKey(), allDay: false, start: '', end: '', place: '', notes: '', remind: '', ...seed }; S.ui.armDel = false; S.ui.frQuick = false; }
/* ---------- taps on this area's buttons (data-act), called from events.js; true = handled ---------- */
function tapEventForm(a, el, e, r) {
  switch (a) {
    case 'ev-photo': S.ui.capture = true; S.ui.nb = { step: 'pick', files: [], text: '', fromForm: true }; render(true); return true;
    case 'fr-quick': S.ui.frQuick = !S.ui.frQuick; render(true); return true;
    case 'fr-quick-add': { const n = (document.getElementById('frQName') || {}).value, r = (document.getElementById('frQRel') || {}).value, em = String((document.getElementById('frQEm') || {}).value || '').trim(); if (!String(n || '').trim()) return toast('Type a name first.'); if (em && !okEmail(em)) return toast('That email doesn’t look right.'); addFriend(n, r, em); const nm = n.trim(); if (!(S.ui.ev.who || []).includes(nm)) S.ui.ev.who = [...(S.ui.ev.who || []), nm]; S.ui.frQuick = false; render(true); return true; }
    case 'ev-cancel': S.ui.ev = null; S.ui.photoX = null; S.ui.kindQuick = false; render(true); return true;
    case 'ev-col': { const v = el.dataset.v; S.ui.ev.color = !v || v === autoColorId(S.ui.ev) ? null : v; render(true); return true; }
    case 'ev-del': deleteEvent(); return true;
    case 'ev-guest-add': { const inp = document.getElementById('evGuest'), m = String((inp && inp.value) || '').trim().toLowerCase(); if (!m) return true; if (!okEmail(m)) { toast('That email doesn’t look right.'); return true; }
      const f = friendsL().find(x => (x.email || '').toLowerCase() === m); if (f) { if (!(S.ui.ev.who || []).includes(f.name)) S.ui.ev.who = [...(S.ui.ev.who || []), f.name]; toast(`That’s ${f.name}, added to who’s going.`); }
      else S.ui.ev.extraGuests = uniq([...(S.ui.ev.extraGuests || []), m]); S.ui.ev.invite = true; render(true); setTimeout(() => { const i = document.getElementById('evGuest'); if (i) i.focus(); }, 0); return true; }
    case 'ev-guest-x': S.ui.ev.extraGuests = (S.ui.ev.extraGuests || []).filter(x => x !== el.dataset.v); render(true); return true;
    case 'ev-rday': { const r = S.ui.ev.recur; if (!r) return true; const b = r.byday || [], v = el.dataset.v; r.byday = b.includes(v) ? (b.length > 1 ? b.filter(x => x !== v) : b) : DAYC.filter(c => [...b, v].includes(c)); render(true); return true; }
    case 'ev-rmode': if (S.ui.ev.recur) S.ui.ev.recur.mode = el.dataset.v; render(true); return true;
    case 'ev-rends': { const r = S.ui.ev.recur; if (!r) return true; r.ends = el.dataset.v; if (r.ends === 'until' && !r.until) r.until = calAdd(S.ui.ev.date || realToday(), 90); if (r.ends === 'count' && !r.count) r.count = 10; render(true); return true; }
    case 'ev-rem': { const m = +el.dataset.v, rs = remList(S.ui.ev); S.ui.ev.remind = rs.includes(m) ? rs.filter(x => x !== m) : [...rs, m].sort((a, b) => a - b); render(true); return true; }
    case 'ev-free': S.ui.ev.free = el.dataset.v === 'free'; render(true); return true;
  }
  return false;
}
