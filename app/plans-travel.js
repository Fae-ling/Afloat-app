/* Afloat · app/plans-travel.js · Live travel for Plans' journey legs (11 Nov 2026).
   Plain script: shares one scope with the other app/*.js files (loaded in order by index.html). See CLAUDE.md.
   Three optional services, each with the household's own key (Settings → Connections → Travel services; functions/travel.js):
   - Prague public transport (Golemio): a train, bus or tram leg with its stop and line shows the live delay or a cancellation,
     from 3 hours before (and the plan's "if the train is cancelled" line when there is one).
   - Travel times (Google Routes): "Check the travel time" on a leg, with traffic or by public transport, and "Use it".
   - Flight status (AeroDataBox): a flight number fills the leg (time, airport, label) and shows delays, terminal and gate.
   Without a key nothing here shows, and Afloat guesses as before. Answers are kept on the phone for a few minutes only. */
S.tv = { on: null, cache: {} };
let tvSvc = null;
const PX_MODES = [...EP_MODES, ['flight', 'Flight', 'transit']];
const TV_TTL = { departures: 3 * 6e4, flight: 10 * 6e4, route: 20 * 6e4 };
async function tvStart() {
  if (S.tv.on) return S.tv.on;
  try { tvSvc = window.claude && window.claude.use ? await window.claude.use('travel') : null; } catch { tvSvc = null; }
  S.tv.on = tvSvc && tvSvc.on ? tvSvc.on() : {}; render(); return S.tv.on;
}
const tvOn = k => !!(S.tv.on && S.tv.on[k]);
const tvKey = (a, d) => a + ':' + JSON.stringify(d);
/* an answer from the cache, or ask (once at a time); the screen redraws when it comes */
function tvGet(action, data, force) {
  const k = tvKey(action, data), c = S.tv.cache[k];
  if (c && (c.busy || (!force && Date.now() - c.at < TV_TTL[action]))) return c;
  if (!tvSvc) { tvStart(); return c || null; }
  S.tv.cache[k] = { ...(c || {}), busy: true, at: Date.now() };
  tvSvc.call(action, data).then(r => { S.tv.cache[k] = { r, at: Date.now() }; }, e => { S.tv.cache[k] = { e: e.message || 'That didn’t work.', at: Date.now() }; }).finally(() => render(true));
  return S.tv.cache[k];
}
/* ---------- what a leg says, live ---------- */
const tvDepData = l => ({ stop: l.stop, line: l.line || '', date: l.date, time: l.dep || l.time });
const tvFlData = l => ({ number: l.flight, date: l.date });
function tvLive(p, l, auto) {
  if (!l || !l.date || l.date < dk) return '';
  const soon = l.date === dk && l.time && toMin(l.time) - nowMin() <= 180 && toMin(l.time) - nowMin() > -30;
  if (l.mode === 'transit' && l.stop && tvOn('golemio') && (soon || !auto) && l.date <= tk) {
    const c = auto ? tvGet('departures', tvDepData(l)) : S.tv.cache[tvKey('departures', tvDepData(l))];
    if (!c) return ''; if (c.busy && !c.r) return '<p class="muted small">Checking the departure board…</p>'; if (c.e) return `<p class="muted small">${esc(c.e)}</p>`;
    const m = c.r && c.r.match; if (!m) return `<p class="muted small">${esc(l.line || 'It')} at ${esc(l.dep || l.time)} isn’t on the board at ${esc((c.r || {}).stop || l.stop)} (yet).</p>`;
    if (m.cancelled) { const b = (p.backup || []).find(x => /cancel|zruš|doesn.t (come|run)|train|vlak|bus/i.test(x.ifs));
      return `<p class="small tv-bad">⚠ ${esc(m.line)} ${esc(m.planned)} to ${esc(m.to)} is <b>cancelled</b>.${b ? ` Your plan: ${esc(b.then)}` : ''}</p>`; }
    return `<p class="small">${m.late ? `🚆 ${esc(m.line)} ${esc(m.planned)} is running <b>${m.late} min late</b> (now ${esc(m.real)})${m.platform ? ', platform ' + esc(m.platform) : ''}. Your leave time stays; the minutes are a cushion.` : `🚆 ${esc(m.line)} ${esc(m.planned)} on time${m.platform ? ', platform ' + esc(m.platform) : ''}.`}</p>`;
  }
  if (l.mode === 'flight' && l.flight && tvOn('flights') && (l.date <= tk || !auto)) {
    const c = auto ? tvGet('flight', tvFlData(l)) : S.tv.cache[tvKey('flight', tvFlData(l))];
    if (!c) return ''; if (c.busy && !c.r) return '<p class="muted small">Checking the flight…</p>'; if (c.e) return `<p class="muted small">${esc(c.e)}</p>`;
    const f = c.r; if (!f || !f.found) return `<p class="muted small">No flight ${esc(l.flight)} found that day.</p>`;
    const where = [f.dep.terminal && 'terminal ' + f.dep.terminal, f.dep.desk && 'check-in ' + f.dep.desk, f.dep.gate && 'gate ' + f.dep.gate].filter(Boolean).join(', ');
    if (f.cancelled) { const b = (p.backup || []).find(x => /cancel|flight|let/i.test(x.ifs)); return `<p class="small tv-bad">⚠ ${esc(f.number)} is <b>cancelled</b>.${b ? ` Your plan: ${esc(b.then)}` : ''}</p>`; }
    return `<p class="small">✈ ${esc(f.number)} ${esc(f.dep.code)} ${esc(f.dep.planned)} → ${esc(f.arr.code)} ${esc(f.arr.planned)}${f.late ? ` · <b>${f.late} min late</b> (now ${esc(f.dep.now)})` : f.status ? ' · ' + esc(f.status) : ''}${where ? ' · ' + esc(where) : ''}</p>`;
  }
  return '';
}
/* travel time for a leg: from home (or the previous leg's place) to its place, the leg's way of getting there */
const tvFrom = (p, l) => { const prev = [...(p.legs || [])].filter(x => x.id !== l.id && x.place && (x.date + x.time) < (l.date + l.time)).pop(); return l.from || (prev ? prev.place : '') || homeAddr(); };
const tvRouteData = (p, l) => ({ from: tvFrom(p, l), to: l.place || p.place, mode: l.mode || 'drive', arrive: l.date && l.time ? new Date(`${l.date}T${l.time}:00`).toISOString() : '' });
function tvRouteHtml(p, l) {
  if (!tvOn('maps') || l.mode === 'flight' || !(l.place || p.place) || !tvFrom(p, l)) return '';
  const c = S.tv.cache[tvKey('route', tvRouteData(p, l))], r = c && c.r;
  const btn = `<button type="button" class="tiny" data-act="tv-route" data-p="${p.id}" data-i="${l.id}"${c && c.busy ? ' disabled' : ''}>${c && c.busy ? 'Checking…' : '⏱ Check the travel time'}</button>`;
  if (!c || (c.busy && !r)) return `<p class="small">${btn}</p>`;
  if (c.e) return `<p class="small">${btn} <span class="muted">${esc(c.e)}</span></p>`;
  if (!r.found) return `<p class="small">${btn} <span class="muted">No route found from ${esc(tvFrom(p, l))}.</span></p>`;
  const same = l.mins != null && Math.abs(+l.mins - r.mins) < 3;
  return `<p class="small">⏱ <b>${r.mins} min</b>${r.usual && r.usual !== r.mins ? ` now (usually ${r.usual})` : ''}${r.km ? ` · ${r.km} km` : ''} from ${esc(tvFrom(p, l).split(',')[0])}. ${same ? '<span class="muted">Same as planned.</span>' : `<button type="button" class="tiny" data-act="tv-use" data-p="${p.id}" data-i="${l.id}" data-m="${r.mins}">Use ${r.mins} min</button>`} ${btn}</p>`;
}
/* the extra fields on a leg: stop and line for public transport, the flight number for a flight */
function tvLegFields(p, l) {
  if (l.mode === 'transit') return `<form class="addform" data-form="tv-transit" data-p="${p.id}" data-i="${l.id}"><input type="text" name="stop" value="${esc(l.stop || '')}" placeholder="Stop you leave from (e.g. Smíchovské nádraží)" aria-label="Stop"><input type="text" name="line" value="${esc(l.line || '')}" placeholder="Line (S7, 22)" aria-label="Line" style="max-width:6em"><input type="time" name="dep" value="${esc(l.dep || l.time || '')}" aria-label="It leaves at"><button class="btn ghost" type="submit">Save</button></form>
    ${tvOn('golemio') ? '' : '<p class="muted small">With Prague public transport set up (Settings → Connections), Afloat shows its live delay on the day. <a href="/help/golemio-key.html" target="_blank" rel="noopener">How (free, 5 minutes)</a></p>'}`;
  if (l.mode === 'flight') return `<form class="addform" data-form="tv-flight" data-p="${p.id}" data-i="${l.id}"><input type="text" name="flight" value="${esc(l.flight || '')}" placeholder="Flight number (e.g. OK652)" aria-label="Flight number" style="max-width:10em"><button class="btn ghost" type="submit">${tvOn('flights') ? 'Look it up' : 'Save'}</button></form>
    ${tvOn('flights') ? '<p class="muted small">Fills the time and airport, and shows delays, terminal and gate on the day.</p>' : '<p class="muted small">With flight status set up (Settings → Connections), Afloat fills it in and shows delays on the day. <a href="/help/flights-key.html" target="_blank" rel="noopener">How (free, 5 minutes)</a></p>'}`;
  return '';
}
/* the Today card: today's and tomorrow's legs, live */
function tvTodayLines(p) {
  if (!S.tv.on) { tvStart(); return ''; }
  return (p.legs || []).filter(l => l.date === dk || (l.date === tk && l.mode === 'flight')).map(l => tvLive(p, l, true)).join('');
}
function tvForm(kind, f, fd) {
  const pid = f.dataset.p, lid = f.dataset.i, p = pxGet(pid), l = p && (p.legs || []).find(x => x.id === lid); if (!l) return false;
  if (kind === 'tv-transit') { const dep = /^\d\d:\d\d$/.test(String(fd.get('dep') || '')) ? String(fd.get('dep')) : '';
    pxList(pid, 'legs', L => L.map(x => x.id === lid ? { ...x, stop: pxClean(fd.get('stop'), 80), line: pxClean(fd.get('line'), 10), dep, ...(dep && !x.time ? { time: dep } : {}) } : x));
    if (l.date <= tk && tvOn('golemio') && fd.get('stop')) tvGet('departures', tvDepData({ ...l, stop: pxClean(fd.get('stop'), 80), line: pxClean(fd.get('line'), 10), dep }), true); toast('Saved.'); return true; }
  if (kind === 'tv-flight') {
    const n = String(fd.get('flight') || '').replace(/\s+/g, '').toUpperCase().slice(0, 8); pxList(pid, 'legs', L => L.map(x => x.id === lid ? { ...x, flight: n } : x));
    if (!n || !tvOn('flights') || !tvSvc) { toast('Saved.'); return true; }
    tvSvc.call('flight', { number: n, date: l.date || p.start }).then(f2 => {
      S.tv.cache[tvKey('flight', { number: n, date: l.date || p.start })] = { r: f2, at: Date.now() };
      if (!f2.found) { toast(`No flight ${n} found on ${fmtD(l.date || p.start)}.`); render(true); return; }
      pxList(pid, 'legs', L => L.map(x => x.id === lid ? { ...x, label: `Flight ${f2.number} ${f2.dep.code}→${f2.arr.code}`.slice(0, 40), time: f2.dep.planned || x.time, place: [f2.dep.airport, f2.dep.city].filter(Boolean).join(', ') || x.place, early: x.early == null || +x.early === EP_EARLY ? 120 : x.early, leave: x.leave && x.mins != null ? minusMin(f2.dep.planned || x.time, +x.mins + (x.early == null || +x.early === EP_EARLY ? 120 : +x.early)) : x.leave } : x));
      toast(`${f2.number}: leaves ${f2.dep.code} at ${f2.dep.planned}. Be there 2 hours before; change it under the leg.`);
    }, e => toast(e.message || 'That didn’t work.'));
    return true; }
  return false;
}
function tapTravel(a, el) {
  const pid = el.dataset.p, lid = el.dataset.i, p = pid && pxGet(pid), l = p && (p.legs || []).find(x => x.id === lid);
  switch (a) {
    case 'tv-route': if (l) tvGet('route', tvRouteData(p, l), true); render(true); return true;
    case 'tv-use': { if (!l) return true; const r = pxLegCalc(l.time, { mins: el.dataset.m, leave: '', early: l.early }); if (r.err) { toast(r.err); return true; }
      pxList(pid, 'legs', L => L.map(x => x.id === lid ? { ...x, mins: r.mins, leave: r.leave, early: r.early, fixed: false } : x)); toast(`Leave at ${r.leave}.`); return true; }
    case 'tv-check': if (l) { if (l.mode === 'flight') tvGet('flight', tvFlData(l), true); else tvGet('departures', tvDepData(l), true); } render(true); return true;
  }
  return false;
}
