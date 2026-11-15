/* Afloat · app/trips.js · Family trips: weekend ideas and the Thursday nudge (Us → Trips).
   Plain script: shares one scope with the other app/*.js files (loaded in order by index.html). See CLAUDE.md. */
/* ---------- Family trips: weekend ideas and a Thursday nudge (Us → Trips) ----------
   From our-days.md: weekend outings take a lot of effort to plan, so Afloat brings ideas and a nudge.
   Chosen 5 Nov 2026: mostly 30–60 min away (longer only if it's worth it); three kinds of trip: a morning back home
   for the nap, an afternoon after the nap, a full day (nap in the car), timed from the household's nap (Settings → About your home); an indoor plan B; easy places for small kids
   (toilets, food); nature and playgrounds. The nudge comes on Thursday evening.
   home/trips: own [{id, cat, name, place, drive, what, indoor, food, cost, claude, at, wk}], fav [id], did {id: date},
   planned {id: date}, and per weekend 'w:<saturday>' {asked, ids {morning, after, day, rain}, off {cat: n}, why}.
   Claude's ideas are asked once per weekend (from Thursday, when you open Trips or get the nudge), built-in ones otherwise.
   "Plan it" opens the event form ready to save: an outing for the whole household, so leave time, weather and the kids' kit follow.
   Households without children (11 Nov 2026): the same screen as "adult trips": a morning trip, an afternoon trip and a whole-day trip (no nap, no plan B group),
   no built-in ideas (those are written for small children), and a first question, "what kind of trips do you enjoy?", kept as `taste` on home/trips
   (or `tasteSkip`) and handed to Claude with every ask. */
const tripAdults = () => !kidsList().length;
const tripTaste = () => String(TRIPS().taste || '').trim();
const tripSeed = () => tripAdults() ? [] : TRIP_SEED;
/* the kinds of trip, worded around the household's nap if a child naps (napOf in core.js) */
const tripCats = () => { const n = napOf(); return tripAdults() ? [['morning', 'A morning trip', 'Back for lunch'], ['after', 'An afternoon trip', 'Out after lunch, home for dinner'], ['day', 'A whole day trip', 'Out for the day']] : n ? [['morning', 'Morning, home for the nap', `Back by about ${n.from}`], ['after', 'Afternoon, after the nap', `Out around ${n.to}, home for dinner`], ['day', 'A full day', `${n.kid} naps in the car`], ['rain', 'Plan B indoors', 'For rain or cold']]
  : [['morning', 'A morning out', 'Back for lunch'], ['after', 'An afternoon out', 'Out after lunch, home for dinner'], ['day', 'A full day', 'Out for the day'], ['rain', 'Plan B indoors', 'For rain or cold']]; };
const tripLbl = c => (tripCats().find(x => x[0] === c) || [])[1] || '';
const TRIP_SEED = [
  { id: 'b1', cat: 'morning', name: 'Toulcův dvůr', place: 'Toulcův dvůr, Praha-Hostivař', drive: 25, what: 'A farm in the city: goats, sheep, a playground and short paths for small legs.', food: 'Toilets; café', cost: 'free' },
  { id: 'b2', cat: 'morning', name: 'Průhonický park', place: 'Průhonický park, Průhonice', drive: 20, what: 'Big castle park with ponds and ducks; plenty of easy paths.', food: 'Toilets and a café by the entrance', cost: 'small entry fee' },
  { id: 'b3', cat: 'morning', name: 'Kunratický les', place: 'Kunratický les, Praha 4', drive: 25, what: 'A forest walk with streams for throwing sticks and a playground at the edge.', food: 'Bring snacks; few toilets', cost: 'free' },
  { id: 'b5', cat: 'after', name: 'Zoo Praha', place: 'Zoo Praha, Troja', drive: 40, what: 'Pick one corner (the children’s zoo or a pavilion) instead of the whole zoo.', food: 'Toilets and food everywhere', cost: 'entry fee' },
  { id: 'b6', cat: 'after', name: 'Petřín', place: 'Petřín, Praha 1', drive: 40, what: 'Mirror maze and the lookout tower, then a walk down through the orchards.', food: 'Toilets and kiosks at the top', cost: 'small fees' },
  { id: 'b7', cat: 'after', name: 'Divoká Šárka', place: 'Divoká Šárka, Praha 6', drive: 45, what: 'A rocky valley with a stream; the first stretch is easy for little ones.', food: 'Snack bar near the start', cost: 'free' },
  { id: 'b9', cat: 'day', name: 'Konopiště', place: 'Zámek Konopiště, Benešov', drive: 40, what: 'Castle park with peacocks and a long, flat loop around the pond.', food: 'Restaurants by the castle', cost: 'park free' },
  { id: 'b10', cat: 'day', name: 'Kutná Hora', place: 'Kutná Hora', drive: 50, what: 'A little-town day: the square, St Barbara’s, ice cream; nap in the car home.', food: 'Plenty of cafés', cost: 'free to walk around' },
  { id: 'b11', cat: 'day', name: 'Mirakulum', place: 'Mirakulum, Milovice', drive: 45, what: 'A huge adventure playground with animals: a full day for the whole family.', food: 'Restaurant and toilets inside', cost: 'entry fee', months: [3, 4, 5, 6, 7, 8, 9] },
  { id: 'b4', cat: 'rain', name: 'Fata Morgana glasshouse', place: 'Botanická zahrada Praha, Troja', drive: 40, what: 'A warm glasshouse jungle with a little path through it; good on a grey day.', food: 'Toilets; café', cost: 'entry fee', indoor: true },
  { id: 'b8', cat: 'rain', name: 'Národní technické muzeum', place: 'Národní technické muzeum, Kostelní 42, Praha 7', drive: 40, what: 'Trains, cars and planes in one big hall.', food: 'Toilets; café', cost: 'entry fee', indoor: true },
  { id: 'b12', cat: 'rain', name: 'Planetárium Praha', place: 'Planetárium Praha, Stromovka', drive: 40, what: 'A short children’s show under the dome, then Stromovka if it dries up.', food: 'Toilets; café nearby', cost: 'small fee', indoor: true },
  { id: 'b13', cat: 'rain', name: 'An indoor play centre (herna)', place: '', drive: 15, what: 'An hour of climbing and ball pits close to home.', food: 'Usually a café inside', cost: 'cheap', indoor: true }];
const TRIPS = () => H('trips');
const tripsSave = patch => mergeDoc('home/trips', patch);
/* the weekend ahead: Monday–Saturday look at this Saturday; on Sunday, this Saturday is yesterday */
const tripSat = () => { const d = dow(); return d === 6 ? calAdd(dk, -1) : calAdd(dk, 5 - d); };
const tripDays = () => [tripSat(), calAdd(tripSat(), 1)].filter(k => k >= dk);
const tripW = () => TRIPS()['w:' + tripSat()] || {};
const tripWSet = patch => tripsSave({ ['w:' + tripSat()]: { ...tripW(), ...patch } });
const tripAll = () => [...(TRIPS().own || []), ...tripSeed()];
const tripById = id => tripAll().find(x => x.id === id);
const tripPlannedOn = k => eventsOn(k).filter(e => e.date === k && e.kind === 'outing' && e.kit !== 'grandma' && (tripAdults() ? members().map(m => m.name) : kidsList()).some(n => (e.who || []).includes(n)));
const tripWet = k => { const w = wxSpan(homeTown(), k, 9 * 60, 17 * 60); return w && wxWet(w); };
/* what to show in a group: this weekend's from Claude, then your own and kept ones, then built-in ones in season;
   nothing you did in the last eight weeks; "Another one" moves along the list */
function tripPool(cat) {
  const T = TRIPS(), did = T.did || {}, mo = +dk.slice(5, 7) - 1, W = tripW(), recent = id => did[id] && dayDiffK(did[id], dk) < 56;
  const ids = [...((W.ids || {})[cat] || []), ...(T.own || []).filter(x => !x.claude && x.cat === cat).map(x => x.id), ...(T.fav || []).filter(id => (tripById(id) || {}).cat === cat),
    ...tripSeed().filter(x => x.cat === cat && (!x.months || x.months.includes(mo))).map(x => x.id)];
  const seen = new Set(); return [...new Set(ids)].filter(id => { const x = tripById(id); if (!x || recent(id)) return false; const nm = x.name.toLowerCase(); if (seen.has(nm)) return false; seen.add(nm); return true; });
}
function tripShown(cat, n = 2) { const p = tripPool(cat); if (!p.length) return []; const o = ((tripW().off || {})[cat] || 0) % p.length; return [...p.slice(o), ...p.slice(0, o)].slice(0, n); }
/* the times a plan starts with: home for the nap (Settings → About your home), or for lunch; after the nap (or lunch) out,
   and home by 17:45 */
function tripTimes(x) {
  if (tripAdults()) { const dd = Math.max(10, +x.drive || 30); return x.cat === 'morning' ? { start: dd > 35 ? '09:00' : '09:30', end: '12:30' } : x.cat === 'after' ? { start: '14:00', end: mm2t(18 * 60 - dd) } : { start: '10:00', end: '17:30' }; }
  const d = Math.max(10, +x.drive || 30), n = napOf(), back = n ? toMin(n.from) : 12 * 60, out = n ? toMin(n.to) : 14 * 60;
  if (x.cat === 'morning') return { start: d > 35 ? '08:45' : '09:00', end: mm2t(back - d) };
  if (x.cat === 'after') return { start: mm2t(out + d), end: mm2t(17 * 60 + 45 - d) };
  if (x.cat === 'rain') return { start: mm2t(out + d), end: mm2t(Math.min(17 * 60 + 45 - d, out + d + 120)) };
  return { start: '09:30', end: '16:30' };
}
function tripPlan(id, k) {
  const x = tripById(id); if (!x) return;
  const t = tripTimes(x), place = x.place || '', pk = placeKey(place || x.name), K = kits();
  if (+x.drive > 0 && place && (K.travel || {})[pk] == null) saveHome('kits', { ...K, travel: { ...(K.travel || {}), [pk]: Math.round(+x.drive) } });
  newEv({ title: x.name, kind: 'outing', who: [...members().map(m => m.name), ...kidsList()], date: k, start: t.start, end: t.end, place,
    notes: [x.what, x.food ? `${tripAdults() ? 'Food' : 'Food and toilets'}: ${x.food}` : '', x.cost ? `Cost: ${x.cost}` : '', 'From Afloat’s trip ideas'].filter(Boolean).join('\n') });
  tripsSave({ planned: { ...(TRIPS().planned || {}), [id]: k } });
  location.hash = 'calendar'; render(true); scrollTo(0, 0);
  toast('Check the times, then Save. Leave time, weather and what to take follow from there.');
}
/* the Thursday-evening nudge (on Today's briefing), only when the girls are home for some of the weekend and nothing's planned yet */
function tripNudges(sl) {
  if (dow() !== 3 || sl !== 'evening' || !meValid() || !modOn('trips')) return [];
  const free = tripDays().filter(k => !kidsAwayOn(k)); if (!free.length || free.some(k => tripPlannedOn(k).length)) return [];
  tripAutoAsk();
  return [{ t: `The weekend: fancy ${tripAdults() ? 'a trip' : 'a family trip'}? Ideas for ${free.length === 2 ? 'Saturday and Sunday' : DAYS_LONG[(new Date(free[0] + 'T12:00').getDay() + 6) % 7]} are ready.`, act: 'go-trips' }];
}
const tripAsked = new Set();
function tripAutoAsk() {
  if (!sample || S.ui.tripAsk || !S.loaded || (tripAdults() && !tripTaste() && !TRIPS().tasteSkip)) return; const s = tripSat();
  if (tripW().asked || tripAsked.has(s) || dayDiffK(dk, s) > 2 || !tripDays().some(k => !kidsAwayOn(k))) return;
  tripAsked.add(s); setTimeout(() => { if (tripSat() === s && !tripW().asked) tripAsk(true); }, 1500);
}
function tripContext() {
  const days = tripDays().map(k => { const w = wxSpan(homeTown(), k, 9 * 60, 17 * 60), ev = eventsOn(k).filter(e => e.date === k).map(e => shortTitle(e.title)).slice(0, 4);
    return `${new Date(k + 'T12:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}: ${tripAdults() ? 'free' : kidsAwayOn(k) ? `${theKids()} ${kidsList().length === 1 ? 'is' : 'are'} at the grandparents’ (no family trip)` : `${theKids()} ${kidsList().length === 1 ? 'is' : 'are'} home`}${w ? `; forecast ${w.tMin}–${w.tMax} °C, ${wxWord(w.code)}${w.p >= 30 ? `, ${w.p}% chance of rain` : ''}` : ''}${czHoliday(k) ? `; public holiday (${czHoliday(k)})` : ''}${ev.length ? `; already on: ${ev.join(', ')}` : ''}.`; });
  const T = TRIPS(), did = Object.entries(T.did || {}).sort((a, b) => b[1].localeCompare(a[1])).map(([id]) => (tripById(id) || {}).name).filter(Boolean).slice(0, 8);
  const lastC = (T.own || []).filter(x => x.claude && x.wk && x.wk < tripSat() && dayDiffK(x.wk, tripSat()) <= 21).map(x => x.name).slice(-12);
  const kept = (T.fav || []).map(id => (tripById(id) || {}).name).filter(Boolean).slice(0, 6);
  return [houseFacts(),
    ...days, did.length ? `Trips they did recently (don't suggest again): ${did.join(', ')}.` : '', lastC.length ? `Suggested in the last weeks (prefer something different): ${lastC.join(', ')}.` : '',
    kept.length ? `Places they liked the sound of: ${kept.join(', ')}.` : '', tripTaste() ? `The trips they enjoy, in their own words: ${tripTaste().slice(0, 1200)}` : ''].filter(Boolean).join('\n');
}
async function tripAsk(auto) {
  if (!sample || S.ui.tripAsk) return; S.ui.tripAsk = true; S.ui.tripErr = ''; render(true);
  if (auto) tripWSet({ asked: Date.now() });
  const ad = tripAdults(), idea = ad ? '{"name": "the place", "place": "address or town for the map", "drive": minutes of travel from home, "what": "what to do there, at most 18 words", "indoor": true or false, "food": "where to eat or drink there, at most 8 words", "cost": "free / small fee / entry fee"}'
    : '{"name": "the place", "place": "address or town for the map", "drive": minutes by car from home, "what": "what to do there with the children, at most 18 words", "indoor": true or false, "food": "toilets and food there, at most 8 words", "cost": "free / small fee / entry fee"}';
  const text = ad ? `Suggest weekend trips for the adults in this household. Leaving the house is often the hard part, so keep it low-effort.
${tripContext()}
What matters: follow their own words above about the trips they enjoy and how they travel; if they said nothing, mostly within about an hour of home (longer only if it's really worth it). Not aimed at children. Fit the season, the weather and what's on that weekend (on a wet or cold day lean towards indoor places); say if a place may be closed for the season. Only real places you are sure exist within reach of their home.
Give two ideas for a morning trip (back by lunchtime), two for an afternoon trip (out after lunch, home for dinner) and two for a whole day trip.
Reply with only JSON: {"morning": [${idea}, …], "afternoon": […], "day": […], "why": "one short sentence on why these fit this weekend"}`
  : `Suggest weekend family trips for this household. Leaving the house is often the hard part, so keep it low-effort.
${tripContext()}
What matters: mostly 30–60 minutes' drive (longer only if it's really worth it); easy places for small children with toilets and food nearby; nature and playgrounds; always an indoor plan B. Fit the season, the weather and what's on that weekend; say if a place may be closed for the season. Only real places you are sure exist within reach of their home.
Give two ideas for a morning trip (${napOf() ? `home by ${napOf().from} for the nap` : 'home for lunch'}), two for an afternoon (${napOf() ? `out after the nap at ${napOf().to}` : 'out after lunch'}, home by 17:45), two for a full day, and two indoor ones for bad weather.
Reply with only JSON: {"morning": [${idea}, …], "afternoon": […], "day": […], "rain": […], "why": "one short sentence on why these fit this weekend"}`;
  try {
    let out; try { out = await askClaude(text, { feature: 'trips' }) || {}; } catch (e) { S.ui.tripErr = claudeWhy(e); if (!auto) toast(S.ui.tripErr); S.ui.tripAsk = false; render(true); return; }
    const own = [...(TRIPS().own || [])], ids = {}, s = tripSat();
    for (const [cat, key] of [['morning', 'morning'], ['after', 'afternoon'], ['day', 'day'], ['rain', 'rain']]) {
      ids[cat] = (Array.isArray(out[key]) ? out[key] : []).slice(0, 3).map(o => { const name = String((o && o.name) || '').trim(); if (!name) return null;
        const id = 'c' + uid(); own.push({ id, cat, name: name.slice(0, 60), place: String(o.place || '').trim().slice(0, 120), drive: Math.max(0, Math.min(180, Math.round(+o.drive || 0))), what: String(o.what || '').trim().slice(0, 200), indoor: cat === 'rain' || !!o.indoor, food: String(o.food || '').trim().slice(0, 80), cost: String(o.cost || '').trim().slice(0, 40), claude: true, at: dk, wk: s }); return id; }).filter(Boolean); }
    const T = TRIPS(), keep = new Set([...(T.fav || []), ...Object.keys(T.did || {}), ...Object.keys(T.planned || {})]);
    const trimmed = own.filter(x => !x.claude || keep.has(x.id) || dayDiffK(x.wk || x.at, s) <= 21).slice(-120); /* Claude's old ones go after three weeks unless kept, done or planned */
    if (Object.values(ids).some(a => a.length)) { tripsSave({ own: trimmed, ['w:' + s]: { ...tripW(), asked: tripW().asked || Date.now(), ids, off: {}, why: String(out.why || '').trim().slice(0, 200) } }); }
    else if (!auto) toast('Nothing came back. Try again in a moment.');
  } catch (e) { console.warn('trip ideas:', e); if (!auto) toast('Claude answered, but the ideas couldn’t be saved. Try again.'); }
  S.ui.tripAsk = false; render(true);
}
const tripMap = x => `https://mapy.cz/zakladni?q=${encodeURIComponent(x.place || x.name)}`;
function tripRow(id, days) {
  const x = tripById(id); if (!x) return ''; const T = TRIPS(), on = (T.fav || []).includes(id), done = (T.did || {})[id], pl = (T.planned || {})[id];
  const meta = [x.drive ? `~${x.drive} min` : '', x.cost, x.indoor ? 'indoors' : '', x.food].filter(Boolean).map(esc).join(' · ');
  const plans = days.filter(k => !kidsAwayOn(k)).map(k => `<button class="tiny" data-act="trip-plan" data-id="${id}" data-k="${k}">Plan ${esc(DAYS_LONG[(new Date(k + 'T12:00').getDay() + 6) % 7].slice(0, 3))}</button>`).join('');
  return `<li class="idea"><b>${esc(x.name)}</b>${x.claude ? ' <span class="muted small">✦</span>' : ''}<p>${esc(x.what || '')}</p>${meta ? `<p class="muted small">${meta}</p>` : ''}
    ${pl && pl >= dk ? `<p class="small">Planned for ${esc(fmtD(pl))}.</p>` : ''}
    <div class="chips">${plans}<a class="tiny" href="${tripMap(x)}" target="_blank" rel="noopener">Map</a><button class="tiny${on ? ' on' : ''}" data-act="trip-fav" data-id="${id}" aria-pressed="${on}">${on ? '★ Kept' : '☆ Keep'}</button><button class="tiny${done === dk ? ' on' : ''}" data-act="trip-did" data-id="${id}">${done === dk ? 'Done ✓' : 'We did this'}</button></div></li>`;
}
function tripGroup(cat, days, open) {
  const ids = tripShown(cat), meta = (tripCats().find(c => c[0] === cat) || [])[2] || '';
  const body = `<p class="muted small">${esc(meta)}</p>${ids.length ? `<ul class="ideas-l">${ids.map(id => tripRow(id, days)).join('')}</ul>` : '<p class="empty">Nothing left in this group. Ask Claude for fresh ideas, or add your own below.</p>'}
    ${tripPool(cat).length > 2 ? `<div class="actions"><button class="btn ghost" data-act="trip-next" data-c="${cat}">Other ideas</button></div>` : ''}`;
  return cat === 'rain' && !open ? `<section class="card ideas"><details><summary><b>${esc(tripLbl(cat))}</b></summary>${body}</details></section>`
    : `<section class="card ideas"><div class="sec-head"><h2>${esc(tripLbl(cat))}</h2></div>${body}</section>`;
}
function vTrips() {
  tripAutoAsk();
  const days = tripDays(), W = tripW(), T = TRIPS(), wet = days.some(k => !kidsAwayOn(k) && tripWet(k)), free = days.filter(k => !kidsAwayOn(k));
  const ad = tripAdults();
  let h = ad ? hero('Trips', 'A nice trip, without the planning.', 'Ideas for a morning, an afternoon or a whole day out. Plan one and Afloat takes care of when to leave and what to take.') : hero('Trips', 'A family trip, without the planning.', `Ideas for the weekend sized to ${kidsList().length === 1 ? esc(kidsList()[0]) + '’s' : esc(theKids()) + '’'} day: ${napOf() ? 'home for the nap, after it,' : 'a morning, an afternoon'} or a full day. Plan one and Afloat takes care of when to leave and what to take.`);
  if (ad && !tripTaste() && !T.tasteSkip) return h + `<section class="card"><div class="sec-head"><h2>What kind of trips do you enjoy?</h2></div><p class="muted small">Write it in your own words: the places you like, how far you’ll go, how you travel, what to avoid. Claude reads it every time it suggests trips. You can change it later.</p>
    <form class="addform" data-form="trip-taste"><textarea name="text" rows="5" required placeholder="e.g. Quiet nature, small towns and good coffee. We go by train, 1–2 hours at most. No crowds, no theme parks." aria-label="The trips you enjoy"></textarea><button class="btn" type="submit">Save</button></form>
    <div class="actions"><button class="btn ghost" data-act="trip-taste-skip">Skip for now</button></div></section>`;
  h += `<section class="card"><div class="sec-head"><h2>${days.length === 1 ? 'Today' : 'This weekend'}</h2></div><ul class="bf-list">${days.map(k => { const w = wxSpan(homeTown(), k, 9 * 60, 17 * 60), pl = tripPlannedOn(k), ev = eventsOn(k).filter(e => e.date === k && !pl.includes(e) && e.kind !== 'grandma').slice(0, 2);
    return `<li><b>${esc(fmtD(k))}</b>${w ? ` · ${wxIcon(w)} ${w.tMin}–${w.tMax} °C${w.p >= 30 ? `, ${w.p}% rain` : ''}` : ''}<br><span class="small">${kidsAwayOn(k) ? `${esc(theKids().replace(/^t/, 'T'))} ${kidsList().length === 1 ? 'is' : 'are'} at the grandparents’.` : pl.length ? `Planned: ${pl.map(e => `${esc(shortTitle(e.title))}${e.start ? ' ' + esc(e.start) : ''}`).join(', ')}.` : 'Nothing planned yet.'}${ev.length ? ` <span class="muted">Also: ${ev.map(e => esc(shortTitle(e.title))).join(', ')}.</span>` : ''}</span></li>`; }).join('')}</ul>
    ${!free.length ? '<p class="muted small">No family trip needed this weekend. Rest counts.</p>' : ''}
    ${W.why ? `<p class="muted small">✦ ${esc(W.why)}</p>` : ''}${S.ui.tripErr ? `<p class="muted small">${esc(S.ui.tripErr)} Built-in ideas for now.</p>` : ''}
    ${sample && free.length ? `<div class="actions"><button class="btn ghost" data-act="trip-ask" ${S.ui.tripAsk ? 'disabled' : ''}>${S.ui.tripAsk ? 'Thinking…' : '✦ Fresh ideas from Claude'}</button></div>` : ''}</section>`;
  const order = ad ? ['morning', 'after', 'day'] : wet ? ['rain', 'morning', 'after', 'day'] : ['morning', 'after', 'day', 'rain'];
  h += order.map(c => tripGroup(c, free, wet)).join('');
  const fav = (T.fav || []).filter(tripById), own = (T.own || []).filter(x => !x.claude), did = Object.entries(T.did || {}).filter(([id]) => tripById(id)).sort((a, b) => b[1].localeCompare(a[1])).slice(0, 10);
  h += `<section class="card">${fav.length ? `<details><summary class="small">Kept ideas (${fav.length})</summary><ul class="ideas-l">${fav.map(id => tripRow(id, free)).join('')}</ul></details>` : ''}
    ${did.length ? `<details><summary class="small">Trips you did (${did.length})</summary><ul class="bf-list">${did.map(([id, k]) => `<li>${esc(tripById(id).name)} <span class="muted small">· ${esc(fmtD(k))}</span></li>`).join('')}</ul></details>` : ''}
    <details><summary class="small">Add your own${own.length ? ` (${own.length})` : ''}</summary>
      ${own.length ? `<ul class="bf-list">${own.map(x => `<li>${esc(x.name)} <span class="muted small">· ${esc(tripLbl(x.cat) || '')}</span> <button class="link" data-act="trip-del" data-id="${x.id}">remove</button></li>`).join('')}</ul>` : ''}
      <form class="addform" data-form="trip-add"><input type="text" name="text" placeholder="${ad ? 'e.g. Lunch by the lake' : 'e.g. The playground by the lake'}" required aria-label="Place or idea"><input type="text" name="place" placeholder="Address or town (for the map)" aria-label="Address"><input type="number" name="min" min="0" max="240" placeholder="Minutes by car" aria-label="Minutes by car"><select name="cat" aria-label="Kind of trip">${tripCats().map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select><button class="btn" type="submit">Add</button></form></details></section>`;
  if (ad) h += `<section class="card"><details><summary class="small">What you enjoy${tripTaste() ? '' : ' (not set)'}</summary><p class="muted small">Claude reads this every time it suggests trips.</p>
    <form class="addform" data-form="trip-taste"><textarea name="text" rows="5" required aria-label="The trips you enjoy">${esc(tripTaste())}</textarea><button class="btn" type="submit">Save</button></form></details></section>`;
  return h;
}
/* ---------- taps on this area's buttons (data-act), called from events.js; true = handled ---------- */
function tapTrips(a, el, e, r) {
  switch (a) {
    case 'trip-ask': tripAsk(false); return true;
    case 'trip-taste-skip': tripsSave({ tasteSkip: true }); return true;
    case 'trip-plan': tripPlan(el.dataset.id, el.dataset.k); return true;
    case 'trip-next': { const W = tripW(), c = el.dataset.c, o = { ...(W.off || {}) }; o[c] = (o[c] || 0) + 2; tripWSet({ off: o }); return true; }
    case 'trip-fav': { const f = TRIPS().fav || [], id = el.dataset.id; tripsSave({ fav: f.includes(id) ? f.filter(x => x !== id) : [...f, id] }); return true; }
    case 'trip-did': { const d = { ...(TRIPS().did || {}) }, id = el.dataset.id; if (d[id] === dk) delete d[id]; else d[id] = dk; tripsSave({ did: d }); return true; }
    case 'trip-del': tripsSave({ own: (TRIPS().own || []).filter(x => x.id !== el.dataset.id) }); return true;
  }
  return false;
}
