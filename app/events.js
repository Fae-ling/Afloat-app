/* Afloat · app/events.js · Every tap, change and submit: the data-act / data-form dispatcher.
   Plain script: shares one scope with the other app/*.js files (loaded in order by index.html). See CLAUDE.md. */
/* ---------- events ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  if (el.closest('[data-stop]') && el.dataset.act === 'close-settings' && el.classList.contains('scrim')) return;
  const a = el.dataset.act;
  if (el.classList.contains('scrim') && e.target !== el) return;
  if (S.ui.brief && el.closest('.brief-ov') && ['task-open', 'capture'].includes(a)) { S.ui.brief = false; lsSet('afloat.brief', dk + slot()); }
  { const g = el.closest('#app section.grp[id^="sec-t-"]'); if (g) { useMark(g.id.slice(6)); S.ui.lastSec = g.id.slice(6); } }
  if (taskAct(a, el) || taskAct2(a, el)) return;
  /* each area handles its own buttons, next to the code that draws them (grep 'case \'act-name\'' in app/) */
  for (const tap of [tapWelcome, tapCalm, tapSettings, tapEventForm, tapCapture, tapTogether, tapJob, tapNotesUsage, tapReminders, tapNews, tapRender, tapGoingOut, tapBriefing, tapToday, tapSupport, tapSelfCare, tapSituation, tapDateIdeas, tapCheckup, tapTrips, tapOurDays, tapColours, tapCalendarUi, tapRecurring, tapFamily, tapLinks, tapCalendarSync, tapPlanTomorrow, tapEventPlans, tapPlansTogether, tapTravel, tapPlansMore, tapPlans, tapBeat, tapRhythms, tapTasks, tapSickDay, tapFocus, tapSurround]) if (tap(a, el, e)) return;
  switch (a) {
    case 'calm-on': lsSet('afloat.calm', '1'); render(true); break;
    case 'go-meals': S.ui.brief = false; lsSet('afloat.brief', dk + slot()); location.hash = 'meals'; render(true); break;
    case 'go-beat': S.ui.brief = false; lsSet('afloat.brief', dk + slot()); render(true); setTimeout(() => { const c = document.querySelector('.card.beat'); if (c) c.scrollIntoView({ block: 'start' }); }, 50); break;
    case 'go-energy': S.ui.brief = false; lsSet('afloat.brief', dk + slot()); location.hash = 'care'; render(true); break;
    case 'go-care': S.ui.brief = false; lsSet('afloat.brief', dk + slot()); location.hash = 'care'; render(true); break;
    case 'go-settings': S.ui.brief = false; lsSet('afloat.brief', dk + slot()); S.ui.settings = true; render(true); break;
    case 'go-situ': S.ui.brief = false; lsSet('afloat.brief', dk + slot()); S.ui.situOpen = dk; if (S.view !== 'today') location.hash = 'today'; render(true); setTimeout(() => { const c = document.getElementById('situ-' + dk); if (c) c.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 50); break;
    case 'situ-girls': { const k = el.dataset.k, v = el.dataset.v, gh = girlsHomeRange();
      if (v === 'home') { const keep = gh && gh.from <= k && (!gh.until || gh.until >= calAdd(k, -1)); saveHome('situation', { ...H('situation'), girlsHome: keep ? { ...gh, until: gh.until && gh.until < k ? '' : gh.until } : { from: k, until: '', reason: (gh && gh.reason) || 'cold' } }); setSitu(k, { girls: null }); }
      else { if (gh && gh.from <= k && (!gh.until || gh.until >= k)) { const u = calAdd(k, -1); saveHome('situation', { ...H('situation'), girlsHome: u < gh.from ? null : { ...gh, until: u } }); }
        setSitu(k, { girls: v === 'kinder' && ((new Date(k + 'T12:00').getDay() + 6) % 7 < 5) && !czHoliday(k) ? null : v });
        if (v === 'grandma') toast('Noted. Add it with “+ Girls with grandparents” in the calendar so the times are right.'); }
      break; }
    case 'situ-me': setSitu(el.dataset.k, { [me]: el.dataset.v }); break;
    case 'situ-eve': { const k = el.dataset.k, o = situOf(k).eve || {}; setSitu(k, { eve: { ...o, [me]: o[me] === el.dataset.v ? null : el.dataset.v } }); break; }
    case 'go-together': S.ui.brief = false; lsSet('afloat.brief', dk + slot()); location.hash = 'together'; render(true); scrollTo(0, 0); break;
    case 'go-trips': S.ui.brief = false; lsSet('afloat.brief', dk + slot()); location.hash = 'trips'; render(true); scrollTo(0, 0); break;
    case 'pcol': setPersonColor(el.dataset.n, el.dataset.v); S.ui.colOpen = null; break;
    case 'food-al': { const p = foodGet(el.dataset.k), x = el.dataset.a; foodSave(el.dataset.k, { allergens: p.allergens.includes(x) ? p.allergens.filter(y => y !== x) : [...p.allergens, x] }); break; }
    case 'food-slot': { const F = window.FOOD, p = foodGet(el.dataset.k), w = el.dataset.w, sl = el.dataset.s, cur = p.meals[w], nx = cur.includes(sl) ? cur.filter(y => y !== sl) : [...cur, sl].sort((a, b) => F.SLOTS.indexOf(a) - F.SLOTS.indexOf(b)); foodSave(el.dataset.k, { meals: { ...p.meals, [w]: nx } }); break; }
    case 'tt-new': { if (e.target !== el) break; const r = el.getBoundingClientRect(), m = Math.round((+el.dataset.h0 * 60 + (e.clientY - r.top) / +el.dataset.hh * 60) / 30) * 30, st = `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
      newEv({ date: el.dataset.k, start: st, end: addMin(st, 60) }); render(true); scrollTo(0, 0); break; }
    case 'ev-open': { const e = allEvents().find(x => (el.dataset.id && x.id === el.dataset.id) || (el.dataset.g && x.gId === el.dataset.g)); if (e && e.gpOnly) { S.ui.gpf = { id: e.id, gpGId: e.gpGId, gp: e.gp || gpPeople()[0], girls: [...(e.who || [])], from: e.date, fromT: e.start || '', to: e.endDate || e.date, toT: e.end || '', drop: e.drop || '', pick: e.pick || '', notes: e.gpNotes || '' }; S.ui.armDel = false; S.ui.ev = null; if (S.view !== 'calendar') location.hash = 'calendar'; render(true); scrollTo(0, 0); break; } if (e) { const src = e.occ ? { ...S.events[e.id], id: e.id } : e; S.ui.ev = { ...src, who: [...(src.who || [])], kind: src.kind || 'family' }; S.ui.armDel = false; if (S.view !== 'calendar') location.hash = 'calendar'; render(true); scrollTo(0, 0); } break; }
    case 'gw-open': { const e = allEvents().find(x => x.src === 'gp' && el.dataset.g && x.gId === el.dataset.g); if (e) { S.ui.gpw = { g: e.gId, title: e.title, date: e.date, who: [...(e.who || [])], had: !!e.ovr }; S.ui.ev = null; S.ui.gpf = null; if (S.view !== 'calendar') location.hash = 'calendar'; render(true); scrollTo(0, 0); } break; }
    case 'together-col': setTogether(el.dataset.v); S.ui.colOpen = null; break;
    case 'go-rhythms': S.ui.brief = false; lsSet('afloat.brief', dk + slot()); location.hash = 'rhythms'; render(true); break;
    case 'shop-has': toast(el.dataset.text + ' is already on ' + shopName('shop') + '.'); break;
    case 'dest': S.ui.dest = el.dataset.d; render(true); break;
    case 'tr-tomorrow': trTomorrow(el.dataset.id); break;
    case 'to-shop': if (shopOk()) { S.ui.shopAdded = [...(S.ui.shopAdded || []), shopNorm(el.dataset.text)]; render(true); } toShop(el.dataset.text); break;
    case 'settings': S.ui.settings = true; render(true); break;
  }
});
document.addEventListener('toggle', e => { const d = e.target; if (d && d.dataset && d.dataset.dfold && d.tagName === 'DETAILS') (S.ui.dfo = S.ui.dfo || {})[d.dataset.dfold] = d.open; }, true);
document.addEventListener('toggle', e => { const d = e.target; if (d && d.dataset && d.dataset.grp && d.tagName === 'DETAILS') { COL[d.dataset.grp] = d.open; lsSet('afloat.col', JSON.stringify(COL)); } }, true);
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset && el.dataset.act === 'rem-f') { const f = el.dataset.f, v = String(el.value || '').trim(); if (f !== 'text' || v) remUpd(el.dataset.id, { [f]: v }); return; }
  if (el.id === 'bkFiles') { bk().files = [...bk().files, ...el.files].slice(0, 4); bk().text = ($('#bkText') || {}).value || bk().text; render(true); return; }
  if (el.id === 'nbFiles') { nb().files = [...nb().files, ...el.files].slice(0, 6); nb().text = ($('#nbText') || {}).value || nb().text; render(true); return; }
  if (taskInput(el) || taskInput2(el)) return;
  if (el.dataset.act === 'share') { S.ui.share = el.checked; lsSet('afloat.share', el.checked ? '1' : '0'); }
  if (el.dataset.act === 'rename') {
    const d = el.dataset, v = el.value.trim(), arr = H(d.doc)[d.field] || [], cur = arr.find(x => x.id === d.id); if (!cur) return;
    if (d.prop === 'text' && !v) { el.value = cur.text || ''; return toast('A task needs some text. Use ✕ to remove it instead.'); }
    const y = { ...cur }; if (d.prop === 'min') { if (+v > 0) y.min = Math.round(+v); else delete y.min; } else if (v) y[d.prop] = v; else delete y[d.prop];
    saveQuiet(d.doc, { ...H(d.doc), [d.field]: arr.map(x => x.id === d.id ? y : x) });
  }
  if (el.dataset.act === 'rename-space') {
    const v = el.value.trim(), o = H('spaces'); if (!v) { el.value = ((o.spaces || []).find(x => x.id === el.dataset.id) || {}).name || ''; return; }
    saveQuiet('spaces', { ...o, spaces: (o.spaces || []).map(x => x.id === el.dataset.id ? { ...x, name: v } : x) });
  }
  if (el.dataset.act === 'rename-task') {
    const v = el.value.trim(), o = H('spaces'), sid = el.dataset.space; if (!v) return;
    saveQuiet('spaces', { ...o, spaces: (o.spaces || []).map(x => x.id === sid ? { ...x, tasks: (x.tasks || []).map(t => t.id === el.dataset.id ? { ...t, text: v } : t) } : x) });
  }
  if (el.dataset.act === 'regroup') { const o = { ...H(el.dataset.doc) }, f = el.dataset.field, g = el.dataset.grp; o[f] = (o[f] || []).map(x => x.id === el.dataset.id ? { ...x, [g]: +el.value } : x); saveHome(el.dataset.doc, o); }
  if (el.dataset.act === 'water-goal') saveHome('lists', { ...H('lists'), waterGoal: +el.value });
  if (el.dataset.act === 'prof-f') { const n = el.dataset.n, o = { ...H('profiles') }; o.people = { ...(o.people || {}), [n]: { ...pInfo(n), [el.dataset.f]: el.value } }; saveQuiet('profiles', o); }
  if (el.dataset.act === 'c-field') { const o = { ...H('contacts') }; o.list = (o.list || []).map(c => c.id === el.dataset.id ? { ...c, [el.dataset.f]: el.value.trim() } : c); saveQuiet('contacts', o); }
  if (el.dataset.act === 'gh-until') { const gh = girlsHomeRange(); if (gh) saveHome('situation', { ...H('situation'), girlsHome: { ...gh, until: el.value } }); }
  if (el.dataset.act === 'situ-start') { const k = el.dataset.k, o = situOf(k).start || {}, v = el.value; if (v && v > '09:00') toast('9:00 is the latest start, so Afloat counts from 9:00.'); setSitu(k, { start: { ...o, [me]: v ? (v > '09:00' ? '09:00' : v) : null } }); }
  if (el.dataset.act === 'cu-f') cuSave({ [el.dataset.f]: el.value.trim() });
  if (el.dataset.act === 'rel-talk') { const patch = { relTalk: { ...(S.week.relTalk || {}), [el.dataset.f]: el.value.trim() } }; S.week = { ...S.week, ...patch }; mergeDoc('weeks/' + wk, patch); setTimeout(() => render(), 300); }
  if (el.dataset.act === 'rel-req') { /* saved quietly: this fires as Finish is tapped, and redrawing now would swallow that tap */
    const patch = { ['relReq:' + (el.dataset.n || me)]: el.value.trim() }; S.week = { ...S.week, ...patch }; mergeDoc('weeks/' + wk, patch); relSyncHist(); setTimeout(() => render(), 300); }
  if (el.dataset.act === 'kid-pick' && el.value) saveHome('week', { ...H('week'), kidPick: { ...kidPick(), [el.dataset.n]: el.value } });
  if (el.dataset.act === 'gig-n') { S.ui.gigN = { ...(S.ui.gigN || {}), [el.dataset.id]: Math.max(0, Math.round(+el.value || 0)) }; render(true); }
  if (el.dataset.act === 'ep-n') { S.ui.epN = { ...(S.ui.epN || {}), [el.dataset.id]: Math.max(0, Math.round(+el.value || 0)) }; render(true); }
  if (el.dataset.act === 'ep-due') { S.ui.epDue = { ...(S.ui.epDue || {}), [el.dataset.id]: el.value }; }
  if (el.dataset.act === 'ep-shot') { const fl = el.files && el.files[0]; if (fl) epJourneyRead(el.dataset.id, fl); return; }
  if (el.dataset.act === 'gig-due') { S.ui.gigDue = { ...(S.ui.gigDue || {}), [el.dataset.id]: el.value }; }
  if (el.dataset.act === 'gh-from' && el.value) { const gh = girlsHomeRange(); if (gh) saveHome('situation', { ...H('situation'), girlsHome: { ...gh, from: el.value } }); }
  if (el.dataset.act === 'when-set') { const o = { ...H(el.dataset.doc) }; o[el.dataset.field] = (o[el.dataset.field] || []).map(x => x.id === el.dataset.id ? { ...x, when: el.value } : x); saveQuiet(el.dataset.doc, o); }
  if (el.dataset.act === 'p-when') { const p = prof(me), l = el.dataset.list; savePeople(me, { [l]: (p[l] || []).map(x => x.id === el.dataset.id ? { ...x, when: el.value } : x) }, true); }
  if (el.dataset.act === 'fr-f' && el.dataset.f === 'email' && el.value.trim() && !okEmail(el.value.trim())) { toast('That email doesn’t look right.'); return; }
  if (el.dataset.act === 'sp-plan' && meValid()) { const o = { ...H('support') }; o.plans = { ...(o.plans || {}), [me]: { ...((o.plans || {})[me] || {}), [el.dataset.f]: el.value.trim() } }; saveQuiet('support', o); }
  if (el.dataset.act === 'food-f' && window.FOOD) {
    const f = el.dataset.f; let v = el.type === 'checkbox' ? el.checked : el.value;
    if (f === 'avoid' || f === 'likes') v = v.split(',').map(x => x.trim()).filter(Boolean);
    if (f === 'kcalTarget') v = +v > 0 ? Math.round(+v) : null;
    if (f === 'notes') v = v.trim();
    foodSave(el.dataset.k, { [f]: v }, el.type !== 'checkbox' && el.tagName !== 'SELECT');
  }
  if (el.dataset.act === 'fr-f') setFriend(el.dataset.id, { [el.dataset.f]: el.type === 'checkbox' ? el.checked : el.value.trim() }, true);
  if (el.dataset.act === 'fr-photo' && el.files && el.files[0]) photoToData(el.files[0]).then(d => { if (d.length > 90000) return toast('That photo is too large. Try a smaller one.'); setFriend(el.dataset.id, { photo: d }); }).catch(() => toast('That file didn’t open as a photo.'));
  if (el.dataset.act === 'kinder-h') { const v = el.value.trim(); if (v && !/^\d\d:\d\d\s*[-–]\s*\d\d:\d\d$/.test(v)) { toast('Write it like 07:30-16:00, or leave it empty.'); return; } saveHome('calendar', { ...calCfg(), kinder: v }); }
  if (el.dataset.act === 'trp') { const k = el.dataset.k, v = String(el.value || ''), o = H('trello');
    if (k === 'board') { const b = tbBoard(v); saveQuiet('trello', { ...o, board: v || null, boardUrl: b ? b.url : '' }); }
    else if (k.startsWith('person:')) saveQuiet('trello', { ...o, people: { ...(o.people || {}), [k.slice(7)]: v || null } });
    else if (k === 'home') saveQuiet('trello', { ...o, lists: { ...(o.lists || {}), home: v || null } });
    else if (['food', 'shop', 'med'].includes(k)) saveQuiet('trello', { ...o, pick: { ...(o.pick || {}), [k]: v || null } });
    setTimeout(() => { try { trShare(); } catch (e) { console.warn(e); } }, 50); }
  if (el.dataset.act === 'hh-f') { const k = el.dataset.f, v = String(el.value || '').trim().slice(0, k === 'about' ? 2000 : 200), o = H('household');
    if (k.startsWith('nap.')) saveQuiet('household', { ...o, nap: { ...(o.nap || {}), [k.slice(4)]: v } }); else if (['town', 'address', 'about'].includes(k)) saveQuiet('household', { ...o, [k]: v }); }
  if (el.dataset.act === 'gp-people') { const v = el.value.split(',').map(x => x.trim()).filter(Boolean); if (v.length) saveHome('calendar', { ...calCfg(), gpPeople: v }); }
  if (el.dataset.act === 'show-mine') { lsSet('afloat.mine', el.checked ? '1' : '0'); S.gcal = { ...S.gcal, mine: [] }; calLoad(); render(true); }
  if (el.dataset.evf === 'allDay' && S.ui.ev) { S.ui.ev.allDay = el.checked; render(true); }
  if (el.dataset.evf === 'meet' && S.ui.ev) S.ui.ev.meet = el.checked;
  if (el.dataset.evf === 'planwith' && S.ui.ev) { const no = new Set(S.ui.ev.planNo || []); if (el.checked) no.delete(el.dataset.id); else no.add(el.dataset.id); S.ui.ev.planNo = [...no]; }
  if (el.dataset.evf === 'plan' && S.ui.ev) { S.ui.ev.plan = el.checked; if (el.checked && !S.ui.ev.planKind) S.ui.ev.planKind = pxKindOf(S.ui.ev); render(true); }
  if (el.dataset.gp && S.ui.ev) S.ui.ev.gperm = { ...gpermOf(S.ui.ev), [el.dataset.gp]: el.checked };
  if (el.id === 'evDate' && S.ui.ev && (!S.ui.ev.endDate || S.ui.ev.endDate < el.value)) { S.ui.ev.endDate = el.value; render(true); }
  if (el.dataset.act === 'ev-repeat' && S.ui.ev) { S.ui.ev.recurPre = el.value; S.ui.ev.recur = recurPreset(el.value, S.ui.ev.date); render(true); }
  if (el.dataset.rc && S.ui.ev && S.ui.ev.recur) { const f = el.dataset.rc, r = S.ui.ev.recur; r[f] = f === 'interval' || f === 'count' ? Math.max(1, +el.value || 1) : el.value; if (f === 'freq') { if (r.freq === 'WEEKLY') r.byday = [dowC(S.ui.ev.date || realToday())]; else delete r.byday; } render(true); }
  if (el.id === 'evDate' && S.ui.ev && S.ui.ev.recur && S.ui.ev.recurPre && S.ui.ev.recurPre !== 'custom') { S.ui.ev.recur = recurPreset(S.ui.ev.recurPre, el.value); render(true); }
  if (el.dataset.act === 'ev-gp' && S.ui.ev) S.ui.ev.gpShare = el.checked;
  if (el.dataset.act === 'ev-inv' && S.ui.ev) { S.ui.ev.invite = el.checked; render(true); }
  if (el.dataset.act === 'p-field') savePeople(me, { [el.dataset.f]: el.value }, true);
  if (el.dataset.act === 'p-rename') { const v = el.value.trim(), l = el.dataset.list; if (!v) return; const p = prof(me); savePeople(me, { [l]: (p[l] || []).map(x => x.id === el.dataset.id ? { ...x, text: v } : x) }, true); }
  if (el.dataset.act === 'bedtime' && el.value) saveHome('week', { ...H('week'), bedtime: el.value });
  if (el.dataset.act === 'rj-date' && el.value && S.ui.rjSch) { S.ui.rjSch = { ...S.ui.rjSch, date: el.value < dk ? dk : el.value }; render(true); }
  if (el.dataset.act === 'rj-time' && el.value && S.ui.rjSch) { S.ui.rjSch = { ...S.ui.rjSch, at: el.value }; render(true); }
  if (el.dataset.act === 'sup-g') { const L = H('lists'); saveQuiet('lists', { ...L, supplies: (L.supplies || []).map(x => x.id === el.dataset.id ? { ...x, group: el.value } : x) }); }
  if (el.dataset.act === 'rj-f') { const d = el.dataset, R = rjR(), arr = R[d.field] || [], v = el.value;
    saveQuiet('rhythms', { ...R, [d.field]: arr.map(x => { if (x.id !== d.id) return x; const y = { ...x }; if (d.f === 'owner') { if (v) y.owner = v; else delete y.owner; } else if (+v >= 0 && v !== '') y[d.f] = Math.round(+v); return y; }) }); }
  if (el.dataset.act === 'reset-day') saveHome('week', { ...H('week'), resetDay: +el.value });
  if (el.dataset.act === 'sound') { S.ui.sound = el.checked; lsSet('afloat.sound', el.checked ? '1' : '0'); }
  if (el.dataset.act === 'restock-day') saveHome('lists', { ...H('lists'), restockDay: +el.value });
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target && e.target.id === 'evGuest') { e.preventDefault(); const b = document.querySelector('[data-act=ev-guest-add]'); if (b) b.click(); } });
document.addEventListener('input', e => { if (e.target && e.target.id === 'evPlace') { const m = document.getElementById('evMap'); if (m) m.innerHTML = mapLinks(e.target.value.trim()); } });
document.addEventListener('submit', e => {
  const f = e.target.closest('form[data-form]'); if (!f) return;
  e.preventDefault();
  if (f.dataset.form.startsWith('fx-')) { fxForm(f); return; }
  if (f.dataset.form.startsWith('w-')) { submitWelcome(f, new FormData(f)); return; }
  if (f.dataset.form.startsWith('ep-')) { if (epForm(f.dataset.form, f, new FormData(f))) f.reset(); return; }
  if (/^(tv|pc|pm)-/.test(f.dataset.form)) { if ((f.dataset.form.startsWith('tv-') ? tvForm : pmForm)(f.dataset.form, f, new FormData(f)) && f.dataset.form === 'pc-add') f.reset(); return; }
  if (f.dataset.form.startsWith('px-')) { if (pxForm(f.dataset.form, f, new FormData(f)) && !/^px-(spread|details|leg|legmeta)$/.test(f.dataset.form)) f.reset(); return; }
  if (f.dataset.form === 'gp') { saveGp(); return; }
  if (f.dataset.form === 'rem-add') { const fd0 = new FormData(f), t = String(fd0.get('text') || '').trim(); if (t) remAdd([{ text: t, at: String(fd0.get('at') || ''), date: String(fd0.get('date') || ''), who: String(fd0.get('who') || me), home: fd0.get('home') === 'on' }]); return; }
  if (f.dataset.form === 'job') { const fd0 = new FormData(f); savePeople(me, { job: { ...(prof(me).job || {}), start: String(fd0.get('start') || ''), finish: String(fd0.get('finish') || ''), travel: Math.max(0, Math.min(180, +fd0.get('travel') || 0)) } }, true); return; }
  if (f.dataset.form === 'area-add') { const t = String(new FormData(f).get('text') || '').trim(); if (t) areasSave([...areasList(), { id: uid(), name: t.slice(0, 80), think: '', act: '' }]); return; }
  const fd = new FormData(f), text = String(fd.get('text') || '').trim(); if (!text) return;
  const kind = f.dataset.form;
  if (kind === 'add') {
    const doc = f.dataset.doc, field = f.dataset.field, item = { id: uid(), text };
    if (fd.has('day')) item.day = +fd.get('day');
    if (fd.has('month')) item.month = +fd.get('month');
    if (+fd.get('min') > 0) item.min = Math.round(+fd.get('min'));
    if (+fd.get('every') > 0) item.every = Math.round(+fd.get('every'));
    if (fd.has('group')) item.group = +fd.get('group');
    if (fd.get('time')) item.time = String(fd.get('time'));
    if (String(fd.get('done') || '').trim()) item.done = String(fd.get('done')).trim();
    const o = { ...H(doc) }; o[field] = [...(o[field] || []), item]; saveHome(doc, o);
  } else if (kind === 'prio') {
    const o = { ...H('priorities') }; o.items = [...(o.items || []), { id: uid(), text, impact: +fd.get('impact'), effort: +fd.get('effort') }]; saveHome('priorities', o);
  } else if (kind === 'space') {
    const o = { ...H('spaces') }; o.spaces = [...(o.spaces || []), { id: uid(), name: text, floor: String(fd.get('floor') || 'other'), tasks: [] }]; saveHome('spaces', o);
  } else if (kind === 'task') {
    const o = { ...H('spaces') }; o.spaces = (o.spaces || []).map(s => s.id === f.dataset.space ? { ...s, tasks: [...(s.tasks || []), { id: uid(), text }] } : s); saveHome('spaces', o);
  } else if (kind === 'member') {
    const o = { ...H('household') }; if ((o.members || []).some(m => m.name === text)) return toast(text + ' is already here.');
    o.members = [...(o.members || []), { id: uid(), name: text }]; if (!me) { me = text; lsSet('afloat.me', me); } saveHome('household', o);
  } else if (kind === 'one') {
    startTimer(3, 'Just one: ' + text);
  } else if (kind === 'plan-add') {
    const l = String(fd.get('l') || 'tonight'), cur = planOf('next', me)[l] || [];
    if (l === 'top' && cur.length >= 3) return toast('Three is the limit. Fewer, clearer priorities work better.');
    savePlan({ [l]: [...cur, { id: uid(), text }] });
  } else if (kind === 'plan-free') {
    planFree(text); f.reset(); return;
  } else if (kind === 'plan-evadd') {
    const id = f.dataset.ev, cur = planOf('next', me); if (!(cur.events || []).some(x => x.id === id)) return;
    savePlan({ tonight: [...(cur.tonight || []), { id: uid(), text, ev: id }] }); return;
  } else if (kind === 'gp') {
    saveGp(); return;
  } else if (kind === 'event') {
    S.ui.ev.title = text; { const X = S.ui.photoX; S.ui.lastSaved = { title: text, kind: S.ui.ev.kind }; S.ui.photoX = null; saveEvent().then(async () => { if (X && !S.ui.ev) await photoNext(X, true); else if (X) { S.ui.photoX = X; render(true); } }).catch(err => { console.warn(err); if (X) { S.ui.evBusy = false; if (S.ui.ev) S.ui.photoX = X; else photoNext(X, true).catch(() => {}); render(true); } }); } return;
  } else if (kind === 'contact') {
    const o = { ...H('contacts') }; o.list = [...(o.list || []), { id: uid(), name: text, role: String(fd.get('role') || '').trim(), phone: String(fd.get('phone') || '').trim(), email: String(fd.get('email') || '').trim(), group: String(fd.get('group') || 'Other') }]; saveHome('contacts', o);
  } else if (kind === 'go-add') {
    goAdd(f.dataset.id, text); return;
  } else if (kind === 'sp-bd') {
    bdStart(text, S.ui.bdLevel || 'small'); return;
  } else if (kind === 'food-tag') {
    if (window.FOOD) foodTag(f.dataset.k, text);
  } else if (kind === 'friend') {
    if (everyone().includes(text) || isFriend(text)) return toast(text + ' is already here.');
    addFriend(text, '', ''); setTimeout(() => { const f = friendsL().find(x => x.name === text); if (f) { S.ui.frEdit = f.id; render(true); } }, 0);
  } else if (kind === 'sup-add') {
    const L = H('lists'); saveHome('lists', { ...L, supplies: [...(L.supplies || []), { id: uid(), text: text.slice(0, 60), group: String(fd.get('group') || 'other') }] }); f.reset();
  } else if (kind === 'trip-taste') {
    tripsSave({ taste: text.slice(0, 1200), tasteSkip: null }); toast('Saved. Claude will use it for your trip ideas.');
  } else if (kind === 'trip-add') {
    const cat = tripLbl(String(fd.get('cat'))) ? String(fd.get('cat')) : 'morning';
    tripsSave({ own: [...(TRIPS().own || []), { id: 'u' + uid(), cat, name: text.slice(0, 60), place: String(fd.get('place') || '').trim().slice(0, 120), drive: Math.max(0, Math.round(+fd.get('min') || 0)), what: '', indoor: cat === 'rain', food: '', cost: '', at: dk }] }); f.reset(); toast('Added to ' + tripLbl(cat).toLowerCase() + '.');
  } else if (kind === 'idea-add') {
    const k = String(fd.get('kind') || 'fun'), I2 = H('relationship').ideas || {}, id = 'o' + uid(); ideasSave({ own: [...(I2.own || []), { id, kind: k, text }] }); if ((k === 'out') !== (ideaMode() === 'out')) nightSet({ mode: k === 'out' ? 'out' : 'in' }); ideaPickSet({ [k]: id }); toast('Added, and it’s up for tonight.');
  } else if (kind === 'rel-appr') {
    relSet({ ['relAppr:' + me]: [...apprOf(me), { id: uid(), text, at: Date.now() }] });
  } else if (kind === 'p-add') {
    pEdit(f.dataset.list, a => [...a, { id: uid(), text }]);
  } else if (kind === 'med') {
    const every = +fd.get('every'); if (!(every > 0)) return toast('Enter how many hours between doses.');
    const sk = { ...H('sick') }; sk.meds = [...(sk.meds || []), { id: uid(), name: text, kid: String(fd.get('kid') || ''), dose: String(fd.get('dose') || '').trim(), every, maxDay: +fd.get('maxDay') || null, remind: fd.get('remind') === 'on' }]; saveHome('sick', sk);
  } else if (kind === 'temp') {
    const sk = { ...H('sick') }; sk.temps = [...(sk.temps || []).filter(x => x.at > Date.now() - 7 * 864e5), { id: uid(), kid: String(fd.get('kid') || ''), t: text.replace('.', ','), at: Date.now(), by: me || '' }]; saveHome('sick', sk);
  } else if (kind === 'kid') {
    const o = { ...H('household') }; o.kids = [...(o.kids || []), text]; saveHome('household', o);
  } else if (kind === 'doctor') {
    saveHome('household', { ...H('household'), doctor: text }); toast('Saved.'); return;
  } else if (kind === 'dump') {
    const ds = dumpDests(), d = ds.find(x => x[0] === S.ui.dest) || ds[0];
    const lines = text.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 30);
    S.ui.dumpText = text;
    if (d && mcp && lines.length) sendDump(d[2], lines, dueFor(String(fd.get('when') || '')));
    return;
  }
  f.reset(); render(true);
});
document.addEventListener('input', e => { if (e.target.id === 'dumpText') S.ui.dumpText = e.target.value; if (taskInput(e.target) || taskInput2(e.target)) return; const gf = e.target.dataset && e.target.dataset.gpf; if (gf && S.ui.gpf) { S.ui.gpf[gf] = e.target.value; if (gf === 'from' && S.ui.gpf.to < e.target.value) S.ui.gpf.to = e.target.value; const sm = document.querySelector('.gp-sum'); if (sm) sm.innerHTML = gpSummary(S.ui.gpf); } const f = e.target.dataset && e.target.dataset.evf; if (f && f !== 'allDay' && f !== 'meet' && S.ui.ev) S.ui.ev[f] = e.target.value; });
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches && e.target.matches('.rn-in')) { e.preventDefault(); e.target.blur(); } });
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!$('#timer').hidden) return;
  if (S.ui.setup && prof(me).setupDone) { S.ui.setup = false; } else if (S.ui.brief) { S.ui.brief = false; lsSet('afloat.brief', dk + slot()); } else if (S.ui.task) { if (S.ui.task.pick) S.ui.task.pick = false; else S.ui.task = null; } else if (S.ui.capture) { if (S.ui.cap && S.ui.cap.pick) S.ui.cap.pick = null; else { S.ui.capture = false; S.ui.cap = null; } } else if (S.ui.kinds) { S.ui.kinds = false; S.ui.kindDel = null; } else if (S.ui.settings) S.ui.settings = false; else return;
  render(true);
});
