/* Afloat · app/going-out.js · Going out: leave-by times, travel, take-along lists; the weather (Open-Meteo).
   Plain script: shares one scope with the other app/*.js files (loaded in order by index.html). See CLAUDE.md. */
/* ---------- going out: when to leave, the weather, and what to take ----------
   An outing is a timed event today or tomorrow that you're on (or your own calendar's, with a place) and that happens
   somewhere else: it has a place, or its type is doctor, outing or kindergarten. For each one the briefing and Today show
   when to leave (travel time remembered per place, 20 min until you set it), the forecast for then and there (Open-Meteo),
   and a take-along list: your own launch list, the kit for that type of event, the girls' kit when they're going,
   what you've added for that place, and what the weather calls for. Data: home/kits
   { kinds: {kind: [{id, text, kids?}]}, kids: [...], places: {placeKey: [...]}, travel: {placeKey: mins}, seeded }. */
/* what's left of the old kits: how long it takes to get places, the get-ready steps, and the dated once-a-season things. The packing lists are per event now. */
const kits = () => H('kits');
const placeKey = p => String(p || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
/* every timed event you're on gets a leave time, travel and weather: not at home, not the grandparents' calendar (those are drop-offs), not a date night (it has its own card) */
function outingsOn(k, n = me) {
  if (!n) return [];
  const real = eventsOn(k).filter(e => !e.allDay && e.start && e.date === k && !inGP(e) && !e.isDate && !e.free && !placeIsHome(e.place)
    && ((e.who || []).includes(n) || (n === me && (e.src === 'mine' || e.src === 'invite'))));
  const evs = [...real, ...(real.some(e => e.kind === 'kinder') ? [] : routineOutings(k, n))];
  return evs.filter(e => k !== dk || notOver(e)).sort((a, b) => (a.start || '').localeCompare(b.start || ''));
}
const outId = e => String(e.id || e.gId || placeKey(e.title + e.start)).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
const kidsOn = e => kidsList().filter(x => (e.who || []).includes(x));
function travelOf(e) {
  if (e.travel != null) return { m: +e.travel, known: true };
  { const j = typeof epJourney === 'function' && epJourney(e); if (j && j.mins != null) return { m: +j.mins, known: true }; } /* a journey planned in Plan tomorrow */
  const T = kits().travel || {}, pk = placeKey(e.place || e.title), t = T[pk]; if (t != null) return { m: +t, known: true };
  const hit = Object.keys(T).filter(x => x.length >= 5 && pk.includes(x)).sort((a, b) => b.length - a.length)[0]; /* "Clinic Name, Street 12…" finds clinic-name */
  return hit ? { m: +T[hit], known: true } : { m: 20, known: false };
}
/* the one place a leave time is worked out: the event's own, a journey planned in Plan tomorrow, or start − travel − 5 */
const leaveAt = e => { if (e.leave) return toMin(e.leave); const j = typeof epJourney === 'function' && epJourney(e); return j ? toMin(j.leave) : toMin(e.start) - travelOf(e).m - 5; };
function packFor(e, n = me, all) {
  const K = kits(), kk = kidsOn(e).length > 0, out = [], dw = (new Date(e.date + 'T12:00').getDay() + 6) % 7, mo = +e.date.slice(5, 7) - 1;
  const fitsIt = it => (!it.kids || kk) && (!it.kid || (e.kidsIn || kidsOn(e)).includes(it.kid)) && (!(it.days || []).length || it.days.includes(dw)) && (!(it.months || []).length || it.months.includes(mo)) && !(it.once && onceOld(it.id));
  const add = (prefix, list, src) => { for (const it of list || []) if (fitsIt(it)) { const tl = String(it.text).toLowerCase();
    if (out.some(x => x.text.toLowerCase() === tl || (prefix === 'a' && tl.includes(x.text.toLowerCase())))) continue;
    const usual = prefix === 'l' || prefix === 'a' || prefix === 'g' || prefix === 'p' || (prefix === 't' && !(it.days || []).length && !(it.months || []).length && !it.once) || (prefix === 'w' && e.virt && !kk);
    out.push({ ...(prefix === 'l' ? { id: it.id, text: it.text, launch: true } : it.once ? { id: 'o' + it.id, raw: it.id, text: it.text, once: true } : { id: prefix + it.id, text: it.text }), usual, src: src ? { ...src, id: it.id } : null }); } };
  if (!e.noLeave) add('l', fits(prof(n).launch, e.date, n).filter(x => whenOf(x) !== 'kinder' || e.kind === 'kinder'), { t: 'launch', n });
  add('d', ((S.month.extra || {})[outId(e)] || []));
  { const dd = (K.dated || {})[e.date] || []; add('n', dd.filter(it => it.for ? it.for === e.title : (e.kit === 'dropoff' || e.kind === 'kinder')), { t: 'dated', k: e.date }); }
  const w = wxFor(e); if (w && w.ok) add('w', wxItems(w, kk));
  const sk = S.month['goSkip:' + outId(e)] || [];
  return all ? out.map(x => ({ ...x, skipped: sk.includes(x.id) })) : out.filter(x => !sk.includes(x.id));
}
/* evening: tomorrow's outings, short. The usual things in one small line; what's special this time as a checklist;
   "anything else for this one?"; and Claude's suggestions for this particular outing (asked once, kept on the month).
   Routine drop-offs and pick-ups only show when something is different about them. */
function prepOutings(k = tk, n = me) {
  if (!meValid()) return [];
  return outingsOn(k, n).filter(e => !e.virt || e.kit === 'grandma' || packFor(e, n).some(x => !x.usual));
}
const goSuggOf = e => S.month['goSugg2:' + outId(e)];
function prepOutingCard(e, n = me) {
  const items = packFor(e, n), sp = items.filter(x => !x.usual), pre = `go:${outId(e)}`, w = wxFor(e), kk = kidsOn(e), id = outId(e);
  const sug = (goSuggOf(e) || []).filter(t => !items.some(x => x.text.toLowerCase() === String(t).toLowerCase())), ed = S.ui.goEdit === id;
  if (!e.virt || e.kit === 'grandma') goAutoAsk(e);
  return `<div class="prep-out" id="po-${id}"><p class="small"><b>${esc(shortTitle(e.title))} · ${esc(e.start)}</b> <span class="muted">· ${e.noLeave ? 'on your way home' : `leave at ${mm2t(leaveAt(e))}`}${kk.length ? ` · with ${esc(kk.join(' and '))}` : ''}</span></p>
    ${w ? wxLine(e) : ''}
    ${sp.some(x => !x.once) ? checklist(pre, sp.filter(x => !x.once), 'month') : ''}${onceList(sp.filter(x => x.once))}
    ${usualHtml(e, n)}
    ${sug.length ? `<div class="chips"><span class="muted small">✦ Maybe also:</span>${sug.slice(0, 4).map(t => `<button class="tiny" data-act="go-sug" data-id="${id}" data-t="${esc(t)}">+ ${esc(t)}</button>`).join('')}</div>` : S.ui.goAsk === id ? '<p class="muted small">✦ Thinking about this one…</p>' : ''}
    ${ed ? `<form class="addform go-add" data-form="go-add" data-id="${id}"><input type="text" name="text" placeholder="Anything else for this one?" required aria-label="Something to take"><button class="btn" type="submit">Add</button></form>`
      : `<button class="link" data-act="go-edit" data-id="${id}">Anything else for this one?</button>`}</div>`;
}
function prepOutingsCard(k = tk) {
  const L = prepOutings(k); if (!L.length) return '';
  return `<section class="card prep-outs"><div class="sec-head"><h3>Going out tomorrow</h3><span class="progress">${L.length}</span></div>
    <p class="muted small">A quick look tonight. The full list comes back just before you leave.</p>${L.map(e => prepOutingCard(e)).join('')}</section>`;
}
/* "the usual": skip something just this time, and after leaving the same thing out three times running, offer to drop it
   from the usual; after adding the same one-off to that kind of outing three times, offer to make it usual.
   Skips: months/<m>['goSkip:<outing>'] [item ids]. Logs in home/kits: usualLog {key: [{o, s}]}, addLog {kit|text: [outing]}. */
const kitLabel = e => ({ dropoff: 'drop-off', pickup: 'pick-up', grandma: 'trip to the grandparents' })[e.kit] || 'event';
const usualKey = x => x.src ? `${x.src.t}:${x.src.k || x.src.n || ''}:${x.src.id}` : '';
function usualHtml(e, n) {
  const id = outId(e), A = packFor(e, n, true).filter(x => x.usual), on = A.filter(x => !x.skipped), off = A.filter(x => x.skipped), ask = S.ui.usualAsk && S.ui.usualAsk.o === id ? S.ui.usualAsk : null;
  if (!A.length && !ask) return '';
  if (S.ui.usualEdit === id) return `<div class="po-edit"><p class="small"><b>The usual, this time</b> <span class="muted">· untick what you won’t need</span></p>
      <ul class="checks">${A.map(x => `<li><button class="check${x.skipped ? '' : ' on'}" data-act="usual-tog" data-id="${id}" data-item="${esc(x.id)}" aria-pressed="${!x.skipped}"><span class="box" aria-hidden="true">${I.check}</span><span class="txt">${esc(x.text)}</span></button></li>`).join('')}</ul>
      <div class="actions"><button class="btn" data-act="usual-done" data-id="${id}">Done</button></div></div>`;
  return `${A.length ? `<p class="muted small po-usual"><b>The usual:</b> ${on.map(x => esc(x.text)).join(', ') || 'nothing this time'}${off.length ? ` <span class="po-off">(not this time: ${off.map(x => esc(x.text)).join(', ')})</span>` : ''} <button class="link po-ed" data-act="usual-edit" data-id="${id}">Edit</button></p>` : ''}
    ${ask ? `<div class="po-ask"><p class="small">You’ve left out <b>${esc(ask.items.map(x => x.text).join(', '))}</b> three times in a row. Take ${ask.items.length > 1 ? 'them' : 'it'} off your launch list?</p>
      <div class="chips"><button class="tiny on" data-act="usual-yes" data-id="${id}">Take it off</button><button class="tiny" data-act="usual-no" data-id="${id}">Not now</button></div></div>` : ''}`;
}
function usualRecord(e, n = me) {
  const id = outId(e), K = kits(), log = { ...(K.usualLog || {}) };
  for (const x of packFor(e, n, true).filter(x => x.usual && x.src)) { const k = usualKey(x); log[k] = [...(log[k] || []).filter(r => r.o !== id), { o: id, s: !!x.skipped }].slice(-5); }
  saveHome('kits', { ...K, usualLog: log });
  return packFor(e, n, true).filter(x => x.usual && x.src && x.skipped && (log[usualKey(x)] || []).length >= 3 && log[usualKey(x)].slice(-3).every(r => r.s));
}
function usualRemove(e, items) {
  const K = { ...kits() };
  for (const x of items) { const s0 = x.src; if (!s0) continue;
    if (s0.t === 'launch') { if (s0.n === me) savePeople(me, { launch: (prof(me).launch || []).filter(y => y.id !== s0.id) }); }
    const lg = { ...(K.usualLog || {}) }; delete lg[usualKey(x)]; K.usualLog = lg; }
  saveHome('kits', K);
}
const usualSeen = new Set();
const goAsked = new Set();
function goAutoAsk(e) {
  const id = outId(e); if (!sample || goSuggOf(e) || goAsked.has(id) || S.ui.goAsk || !(e.virt || e.place || kidsOn(e).length || isGig(e) || planKindOf(e))) return;
  goAsked.add(id); setTimeout(() => { if (!goSuggOf(e)) goAsk(id, true); }, 900);
}
function outingCard(e, n = me, top = false) {
  if (e.date === dk && !usualSeen.has(outId(e)) && db && S.loaded) { usualSeen.add(outId(e)); const lg = kits().usualLog || {}; if (packFor(e, n, true).some(x => x.usual && x.src && !(lg[usualKey(x)] || []).some(r => r.o === outId(e)))) setTimeout(() => usualRecord(e, n), 0); }
  const nm = nowMin(), k = e.date, la = leaveAt(e), tv = travelOf(e), items = packFor(e, n), pre = `go:${outId(e)}`;
  const lp = pPre(n, 'launch'), isTick = x => x.launch ? isDone((S.day.done || {})[lp + ':' + x.id]) : x.once ? onceOn(x.raw) : isDone((S.month.done || {})[pre + ':' + x.id]);
  const done = items.filter(isTick).length, w = wxFor(e), kk = kidsOn(e), li1 = items.filter(x => x.launch), li2 = items.filter(x => !x.launch && !x.once), li3 = items.filter(x => x.once);
  const when0 = e.noLeave ? (k === dk ? (nm < toMin(e.start) + 15 ? `On your way home, around ${e.start}` : 'Done for today') : `Tomorrow, on your way home around ${e.start}`)
    : k === dk ? (la - nm > 0 ? `Leave ${inMins(la - nm)}, at ${mm2t(la)}` : nm < toMin(e.start) ? 'Time to go' : 'On now') : `Tomorrow: leave at ${mm2t(la)}`;
  const when = top && !e.noLeave && k === dk ? '' : when0; /* the countdown above already says it, to the second */
  const ed = S.ui.goEdit === outId(e);
  return `<section class="card outing${top ? ' leave-run' : ''}" id="go-${outId(e)}">${top ? '<p class="eyebrow">Leaving soon</p>' : ''}<div class="sec-head"><h3>${esc(shortTitle(e.title))} · ${esc(e.start)}</h3><span class="progress">${done} of ${items.length}</span></div>
    <p class="small">${when ? `<b>${when}</b> ` : ''}${e.noLeave ? '' : `<span class="muted">${when ? '· ' : ''}${tv.m} min to get there${tv.known ? '' : ' (a guess)'} ${e.virt ? '' : `<button class="link" data-act="go-travel" data-id="${outId(e)}">${tv.known ? 'Change' : 'Set it'}</button>`}</span>`}${kk.length ? ` <span class="muted">· ${e.virt ? '' : 'with '}${esc(kk.join(' and '))}</span>` : ''}</p>
    ${top && !e.noLeave ? runStrip(e, n) : ''}
    ${readyHtml(e, n, top)}
    ${S.ui.goTravel === outId(e) ? `<div class="pills">${[5, 10, 15, 20, 30, 45, 60].map(m => `<button class="pill${tv.m === m ? ' on' : ''}" data-act="go-travel-set" data-id="${outId(e)}" data-m="${m}">${m} min</button>`).join('')}</div>` : ''}
    ${wxLine(e)}
    ${items.length ? (li1.length && e.date === dk ? checklist(lp, li1) : '') + (li2.length || (e.date !== dk && li1.length) ? checklist(pre, e.date === dk ? li2 : items.filter(x => !x.once), 'month') : '') + onceList(li3) : '<p class="empty">Nothing to take yet. Add what this needs below.</p>'}
    ${ed ? `<form class="addform go-add" data-form="go-add" data-id="${outId(e)}"><input type="text" name="text" placeholder="Something to take" required aria-label="Something to take"><button class="btn" type="submit">Add</button></form>
        ${sample ? `<div class="actions"><button class="btn ghost" data-act="go-ask" data-id="${outId(e)}" ${S.ui.goAsk ? 'disabled' : ''}>${S.ui.goAsk === outId(e) ? 'Thinking…' : '✦ What else might we need?'}</button></div>` : ''}
        ${(goSuggOf(e) || []).length ? `<div class="chips">${goSuggOf(e).filter(t => !items.some(x => x.text.toLowerCase() === String(t).toLowerCase())).map(t => `<button class="tiny" data-act="go-sug" data-id="${outId(e)}" data-t="${esc(t)}">+ ${esc(t)}</button>`).join('')}</div>` : ''}
        <div class="actions"><button class="link" data-act="go-edit" data-id="">Done</button></div>`
      : `<div class="actions"><button class="link" data-act="go-edit" data-id="${outId(e)}">Add something</button></div>`}
  </section>`;
}
/* the next outings for the briefing and Today: today's still to come, and in the evening tomorrow's */
function outingCards(n = me, skipRun = false) {
  if (!meValid()) return '';
  /* the full list only shortly before you leave (it was looked over the evening before), until the thing starts;
     the outing in its "leaving soon" window sits on top of Today instead (skipRun) */
  const ro = skipRun ? runOuting(n) : null;
  const nm = nowMin(), list = outingsOn(dk, n).filter(e => { const la = leaveAt(e), lead = Math.max(45, readyLead(e, n) + 20); return nm >= la - lead && nm < toMin(e.start) + (e.noLeave ? 15 : 0) && !(ro && outId(e) === outId(ro)) && !leftOn(e); });
  return list.slice(0, 3).map(e => outingCard(e, n)).join('');
}

function goFind(id) { return [...outingsOn(dk), ...outingsOn(tk)].find(x => outId(x) === id); }
/* add something to take: for this event only (kept on the month, so it goes when the event does) */
function goAdd(id, text) {
  const e = goFind(id); if (!e || !text) return; const it = { id: uid(), text }, ex = [...((S.month.extra || {})[id] || []), it];
  mergeDoc('months/' + mk, { extra: { [id]: ex } }); S.month = { ...S.month, extra: { ...(S.month.extra || {}), [id]: ex } }; render(true); toast('Added for this one.');
}
async function goAsk(id, auto) {
  const e = goFind(id); if (!e || !sample) return; S.ui.goAsk = id; render(true);
  const w = wxFor(e), have = packFor(e).map(x => x.text), ks = kidsOn(e).map(n => `${n}${ageOf(pInfo(n).birthday) !== '' ? ` (aged ${ageOf(pInfo(n).birthday)})` : ''}`);
  const grown = [...new Set([me, ...(e.who || []).filter(x => !kidsList().includes(x))])].filter(Boolean);
  const people = ks.length ? `Going: ${grown.join(', ')} (adult${grown.length > 1 ? 's' : ''}) with ${ks.join(' and ')}. Neither girl uses nappies any more.` : `Going: only ${grown.join(' and ')} (adult${grown.length > 1 ? 's' : ''}). No children are coming, so suggest nothing for children.`;
  const text = `Someone in a family (the adults have ADHD) has this ${e.date === dk ? 'today' : 'tomorrow'}: "${shortTitle(e.title)}" (${kitLabel(e)}) at ${e.start}${e.place ? ', ' + e.place : ''}. ${people}${w ? ` Weather then: ${w.tMin}–${w.tMax} °C, feels like ${w.feels}, ${wxWord(w.code)}${w.p >= 30 ? `, ${w.p}% chance of rain` : ''}.` : ''}${(e.notes || '').trim() ? ` Notes: ${String(e.notes).trim().slice(0, 200)}.` : ''}
Already on the list: ${have.join('; ') || 'nothing'}.
Suggest up to 4 things worth taking that are specific to this outing, only for the people going, and the weather (for example a winter hat for a child going out in the cold), and easy to forget. Nothing already on the list, nothing generic. Short item names (at most 6 words). If nothing is really needed, reply []. Reply with only a JSON array of strings.`;
  try { const out = await askClaude(text, { feature: 'packing' }); const arr = (Array.isArray(out) ? out : (out && out.items) || []).map(x => String(x).trim()).filter(Boolean).slice(0, 4);
    S.month = { ...S.month, ['goSugg2:' + id]: arr }; mergeDoc('months/' + mk, { ['goSugg2:' + id]: arr }); if (!arr.length && !auto) toast('Nothing more to add, it seems.'); }
  catch (e2) { if (!auto) toast(claudeWhy(e2)); }
  S.ui.goAsk = null; render(true);
}
/* ---------- weather (Open-Meteo: free, no key; data CC BY 4.0) ---------- */
S.wx = {};
const WX_CODES = [[0, 'clear'], [1, 'mostly clear'], [2, 'partly cloudy'], [3, 'cloudy'], [45, 'fog'], [48, 'fog'], [51, 'drizzle'], [53, 'drizzle'], [55, 'drizzle'], [56, 'freezing drizzle'], [57, 'freezing drizzle'], [61, 'light rain'], [63, 'rain'], [65, 'heavy rain'], [66, 'freezing rain'], [67, 'freezing rain'], [71, 'light snow'], [73, 'snow'], [75, 'heavy snow'], [77, 'snow grains'], [80, 'showers'], [81, 'showers'], [82, 'heavy showers'], [85, 'snow showers'], [86, 'snow showers'], [95, 'thunderstorm'], [96, 'thunderstorm with hail'], [99, 'thunderstorm with hail']];
const wxWord = c => (WX_CODES.find(x => x[0] === c) || [0, ''])[1];
const homeTown = () => H('household').town || 'Praha';
/* "Example Street 14, 110 00 Praha 1, Česko" → "Praha"; a plain town name stays as it is */
function wxTown(place) {
  if (!place) return homeTown();
  const parts = String(place).split(',').map(x => x.trim().replace(/^\d{3}\s?\d{2}\s*/, '').replace(/\s+\d+([-–].*)?$/, '').trim()).filter(x => x && !/^(česko|czechia|česká republika|czech republic)$/i.test(x));
  const pr = parts.find(x => /^praha|^prague/i.test(x)); if (pr) return 'Praha';
  const town = parts.length > 1 ? parts[parts.length - 1] : parts[0];
  return /\d/.test(town || '') || !town ? homeTown() : town;
}
const lsJ = (k, d) => { try { return JSON.parse(lsGet(k) || 'null') || d; } catch { return d; } };
async function wxLoad(town) {
  const have = S.wx[town]; if (have && (have.status === 'loading' || (Date.now() - have.at < 45 * 6e4))) return;
  S.wx[town] = { ...(have || {}), status: 'loading', at: Date.now() };
  try {
    const G = lsJ('afloat.geo', {}); let g = G[town];
    if (!g) { const r = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(town)}&count=1&language=cs&format=json`)).json(); const x = (r.results || [])[0]; if (!x) throw new Error('place not found'); g = { lat: x.latitude, lon: x.longitude, name: x.name }; G[town] = g; lsSet('afloat.geo', JSON.stringify(G)); }
    const f = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${g.lat}&longitude=${g.lon}&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m&timezone=Europe%2FPrague&forecast_days=7`)).json();
    if (!f.hourly) throw new Error('no forecast');
    S.wx[town] = { status: 'ok', at: Date.now(), name: g.name, h: f.hourly };
  } catch (e) { S.wx[town] = { status: 'error', at: Date.now() }; }
  render();
}
/* the forecast over a stretch of a day: from leaving until the end */
function wxSpan(town, k, a, b) {
  const W = S.wx[town]; if (!W || W.status !== 'ok') { wxLoad(town); return null; }
  const idx = W.h.time.map((t, i) => [t, i]).filter(([t]) => t.slice(0, 10) === k && toMin(t.slice(11, 16)) >= Math.floor(a / 60) * 60 && toMin(t.slice(11, 16)) <= b).map(x => x[1]);
  if (!idx.length) return null;
  const pick = f => idx.map(i => W.h[f][i]).filter(v => v != null);
  const ta = pick('apparent_temperature'), tt = pick('temperature_2m'), codes = pick('weather_code');
  return { ok: true, town: W.name || town, tMin: Math.round(Math.min(...tt)), tMax: Math.round(Math.max(...tt)), feels: Math.round(Math.min(...ta)), p: Math.max(0, ...pick('precipitation_probability')), mm: pick('precipitation').reduce((s, v) => s + v, 0), wind: Math.round(Math.max(0, ...pick('wind_speed_10m'))), code: Math.max(...codes) };
}
function wxFor(e) { const a = leaveAt(e), en = e.end ? toMin(e.end) : toMin(e.start) + 60; return wxSpan(wxTown(e.place), e.date, a, Math.max(en, a + 60)); }
const wxWet = w => w.p >= 45 || w.mm >= 0.3 || (w.code >= 51 && w.code <= 67) || (w.code >= 80 && w.code <= 82) || w.code >= 95;
function wxItems(w, kids) {
  const out = [];
  if (wxWet(w)) out.push({ id: 'rain', text: kids ? 'Raincoats for everyone (or an umbrella)' : 'Raincoat or umbrella' });
  if ((w.code >= 71 && w.code <= 77) || w.code === 85 || w.code === 86) out.push({ id: 'snow', text: kids ? 'Snow boots and waterproof trousers' : 'Boots for snow' });
  if (w.feels <= 0) out.push({ id: 'cold', text: kids ? 'Warm layers, hats and gloves' : 'Warm layers, hat and gloves' });
  else if (w.feels <= 6) out.push({ id: 'cool', text: kids ? 'Hats and gloves' : 'Hat and gloves' });
  if (w.tMax >= 24) out.push({ id: 'sun', text: kids ? 'Sun cream, sun hats and extra water' : 'Sun cream and extra water' });
  if (w.wind >= 40) out.push({ id: 'wind', text: 'Windproof jackets' });
  return out;
}
function wxLine(e) {
  const w = wxFor(e); if (!w) return S.wx[wxTown(e.place)] && S.wx[wxTown(e.place)].status === 'error' ? '' : '<p class="muted small wx">Checking the weather…</p>';
  return `<p class="small wx">${wxIcon(w)} <b>${w.tMin === w.tMax ? w.tMin : `${w.tMin}–${w.tMax}`} °C</b>${w.feels < w.tMin - 1 ? `, feels like ${w.feels}` : ''} · ${esc(wxWord(w.code))}${w.p >= 30 ? ` · ${w.p}% chance of rain` : ''}${w.wind >= 30 ? ` · windy (${w.wind} km/h)` : ''} <span class="muted">in ${esc(w.town)}</span></p>`;
}
const wxIcon = w => w.code >= 95 ? '⛈' : (w.code >= 71 && w.code <= 77) || w.code >= 85 ? '❄️' : wxWet(w) ? '🌧' : w.code >= 45 ? '🌫' : w.code >= 2 ? '⛅' : '☀️';
/* the day's weather at home, for the top of the briefing */
function wxToday(k = dk) {
  const sl = slot(), from = k === dk ? Math.max(nowMin(), 7 * 60) : 7 * 60, w = wxSpan(homeTown(), k, from, 21 * 60); if (!w) return '';
  return `<p class="small wx bf-wx">${wxIcon(w)} ${k === dk ? (sl === 'evening' || sl === 'night' ? 'Rest of the evening' : 'Today') : 'Tomorrow'} in ${esc(w.town)}: <b>${w.tMin}–${w.tMax} °C</b>, ${esc(wxWord(w.code))}${w.p >= 30 ? `, ${w.p}% chance of rain` : ''}. <a class="muted" href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a></p>`;
}
/* ---------- taps on this area's buttons (data-act), called from events.js; true = handled ---------- */
function tapGoingOut(a, el, e, r) {
  switch (a) {
    case 'go-edit': S.ui.goEdit = el.dataset.id || null; render(true); return true;
    case 'go-travel': S.ui.goTravel = S.ui.goTravel === el.dataset.id ? null : el.dataset.id; render(true); return true;
    case 'go-travel-set': { const e = [...outingsOn(dk), ...outingsOn(tk)].find(x => outId(x) === el.dataset.id); if (e) { const K = kits(); saveHome('kits', { ...K, travel: { ...(K.travel || {}), [placeKey(e.place || e.title)]: +el.dataset.m } }); } S.ui.goTravel = null; return true; }
    case 'go-ask': goAsk(el.dataset.id); return true;
    case 'go-leaving': toggleKey('day', 'left:' + el.dataset.id, true); return true; /* the countdown has done its job: fold the card away */
    case 'usual-edit': S.ui.usualEdit = el.dataset.id; S.ui.usualAsk = null; render(true); return true;
    case 'usual-tog': { const id = el.dataset.id, f = 'goSkip:' + id, cur = S.month[f] || [], it = el.dataset.item, nx = cur.includes(it) ? cur.filter(x => x !== it) : [...cur, it];
      S.month = { ...S.month, [f]: nx }; mergeDoc('months/' + mk, { [f]: nx }); render(true); return true; }
    case 'usual-done': { const e = goFind(el.dataset.id); S.ui.usualEdit = null; if (e) { const three = usualRecord(e); if (three.length) S.ui.usualAsk = { o: outId(e), kind: 'remove', items: three.map(x => ({ id: x.id, text: x.text, src: x.src })) }; } render(true); return true; }
    case 'usual-yes': { const a = S.ui.usualAsk, e = goFind(el.dataset.id); S.ui.usualAsk = null; if (!a || !e) { render(true); return true; }
      if (a.kind === 'remove') { usualRemove(e, a.items); toast('Off the usual. You can add it back with “Anything else?”.'); }
      render(true); return true; }
    case 'usual-no': S.ui.usualAsk = null; render(true); return true;
    case 'go-sug': { const id = el.dataset.id, t = el.dataset.t; goAdd(id, t);
      const ms = (S.month['goSugg2:' + id] || []).filter(x => x !== t); S.month = { ...S.month, ['goSugg2:' + id]: ms }; mergeDoc('months/' + mk, { ['goSugg2:' + id]: ms }); return true; }
  }
  return false;
}
