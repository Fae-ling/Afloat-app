// Travel services for Plans (11 Nov 2026): live departures and delays in Prague and Central Bohemia (Golemio / PID),
// travel time with traffic or by public transport (Google Routes API), and flight status (AeroDataBox via RapidAPI).
//
// Each household brings its own keys (Settings → Connections → Travel services), kept server-only in tkeys/<hid>; the phones only
// ever see which services are on and the last four characters. Every service is optional: without its key, Afloat simply
// guesses as before. Nothing is stored about the journeys themselves; the phone keeps the last answer for a few minutes.
// Everything takes the keys and a fetch function as arguments, so the tests can use pretend ones.

const clip = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
const err = (code, message) => Object.assign(new Error(message), { code });
const KEYS = { golemio: 'Prague public transport (Golemio)', maps: 'Travel times (Google Routes)', flights: 'Flight status (AeroDataBox)' };
const hm = s => { const m = /T(\d\d:\d\d)/.exec(String(s || '')) || /^\d{4}-\d\d-\d\d (\d\d:\d\d)/.exec(String(s || '')); return m ? m[1] : ''; };
const ymd = s => { const m = /^(\d{4}-\d\d-\d\d)/.exec(String(s || '')); return m ? m[1] : ''; };
const toMin = t => { const m = /^(\d\d):(\d\d)$/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : null; };

async function getJson(fetchFn, url, opts, what) {
  let r;
  try { r = await fetchFn(url, opts); } catch (e) { throw err('server_unavailable', `${what} didn’t answer.`); }
  if (r.status === 401 || r.status === 403) {
    /* RapidAPI says why in its own words ("You are not subscribed to this API", "Invalid API key"): pass it on, it tells the two apart */
    let why = ''; try { why = clip(((await r.json()) || {}).message, 120); } catch (e) { /* no reason given */ }
    throw err('bad_key', `${what} didn’t accept the key${why ? ` (${why})` : ''}.`);
  }
  if (r.status === 429) throw err('server_unavailable', `${what} is busy (too many asks). Try again in a minute.`);
  if (r.status === 404 || r.status === 204) return null; /* AeroDataBox answers "no such flight" with 204 and an empty body */
  if (!r.ok) throw err('upstream_error', `${what} answered with an error (${r.status}).`);
  try { return await r.json(); } catch (e) { return null; } /* an empty body is "nothing found", not a failure */
}

/* ---------- Golemio: departures from a stop around a time ---------- */
/* date 'YYYY-MM-DD', time 'HH:MM' (Prague): departures from 10 minutes before to 50 after, with delays */
async function departures(key, fetchFn, { stop, date, time, line }) {
  const name = clip(stop, 80); if (!name) throw err('bad_input', 'Which stop?');
  const q = new URLSearchParams({ names: name, minutesBefore: '10', minutesAfter: '60', limit: '40', preferredTimezone: 'Europe/Prague', mode: 'departures', order: 'real' });
  if (date && time) q.set('timeFrom', `${date}T${time}:00`);
  const j = await getJson(fetchFn, 'https://api.golemio.cz/v2/pid/departureboards?' + q, { headers: { 'X-Access-Token': key, accept: 'application/json' } }, 'Prague public transport');
  if (!j) return { found: false, stop: name, list: [] };
  const list = (j.departures || []).map(d => ({ line: clip((d.route || {}).short_name, 12), to: clip((d.trip || {}).headsign, 60),
    planned: hm((d.departure_timestamp || {}).scheduled), real: hm((d.departure_timestamp || {}).predicted),
    late: d.delay && d.delay.is_available ? Math.max(0, Math.round(+d.delay.minutes || 0)) : null, cancelled: !!(d.trip || {}).is_canceled,
    platform: clip((d.stop || {}).platform_code, 8) })).filter(d => d.planned);
  const stopName = clip(((j.stops || [])[0] || {}).stop_name, 80) || name;
  return { found: true, stop: stopName, list, match: match(list, time, line) };
}
/* the departure a planned leg means: the same line (if given) at the planned time, give or take two minutes */
function match(list, time, line) {
  const t = toMin(time); if (t == null) return null;
  const L = String(line || '').replace(/\s+/g, '').toLowerCase();
  const ok = list.filter(d => (!L || d.line.replace(/\s+/g, '').toLowerCase() === L) && Math.abs(toMin(d.planned) - t) <= 2);
  return ok.sort((a, b) => Math.abs(toMin(a.planned) - t) - Math.abs(toMin(b.planned) - t))[0] || null;
}

/* ---------- Google Routes: how long it takes, now or at a time ---------- */
const MODE = { drive: 'DRIVE', car: 'DRIVE', taxi: 'DRIVE', transit: 'TRANSIT', train: 'TRANSIT', bus: 'TRANSIT', tram: 'TRANSIT', walk: 'WALK', bike: 'BICYCLE' };
/* from/to: addresses. at: an ISO time to arrive by (transit) or to leave at (driving, with traffic). */
async function route(key, fetchFn, { from, to, mode, arrive, leave }) {
  const o = clip(from, 200), d = clip(to, 200); if (!o || !d) throw err('bad_input', 'Where from and where to?');
  const tm = MODE[String(mode || 'drive').toLowerCase()] || 'DRIVE', body = { origin: { address: o }, destination: { address: d }, travelMode: tm, languageCode: 'en' };
  if (tm === 'DRIVE') { body.routingPreference = 'TRAFFIC_AWARE'; if (leave && Date.parse(leave) > Date.now()) body.departureTime = new Date(leave).toISOString(); }
  if (tm === 'TRANSIT') { if (arrive && Date.parse(arrive) > Date.now()) body.arrivalTime = new Date(arrive).toISOString(); else if (leave && Date.parse(leave) > Date.now()) body.departureTime = new Date(leave).toISOString(); }
  const j = await getJson(fetchFn, 'https://routes.googleapis.com/directions/v2:computeRoutes', { method: 'POST', headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'routes.duration,routes.staticDuration,routes.distanceMeters' }, body: JSON.stringify(body) }, 'Google Routes');
  const r = ((j || {}).routes || [])[0]; if (!r) return { found: false };
  const sec = s => Math.round(parseFloat(String(s || '0').replace('s', '')) || 0);
  const mins = Math.max(1, Math.round(sec(r.duration) / 60)), usual = r.staticDuration ? Math.max(1, Math.round(sec(r.staticDuration) / 60)) : null;
  return { found: true, mins, usual, km: r.distanceMeters ? Math.round(r.distanceMeters / 100) / 10 : null, mode: tm };
}

/* ---------- AeroDataBox: one flight on one day ---------- */
const okFlight = f => /^[A-Z0-9]{2,3}\s?\d{1,4}[A-Z]?$/i.test(String(f || '').trim());
const tOf = x => (x && typeof x === 'object' ? x.local || '' : x || '');
async function flight(key, fetchFn, { number, date }) {
  const n = String(number || '').replace(/\s+/g, '').toUpperCase();
  if (!okFlight(n)) throw err('bad_input', 'That doesn’t look like a flight number (like OK652 or FR 1234).');
  if (!/^\d{4}-\d\d-\d\d$/.test(String(date || ''))) throw err('bad_input', 'Which day?');
  const j = await getJson(fetchFn, `https://aerodatabox.p.rapidapi.com/flights/number/${encodeURIComponent(n)}/${date}?withAircraftImage=false&withLocation=false`,
    { headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': 'aerodatabox.p.rapidapi.com' } }, 'Flight status');
  const f = (Array.isArray(j) ? j : [])[0]; if (!f) return { found: false, number: n };
  const side = s => { s = s || {}; const a = s.airport || {}, plan = tOf(s.scheduledTime) || s.scheduledTimeLocal, rev = tOf(s.revisedTime) || s.revisedTimeLocal || tOf(s.predictedTime) || tOf(s.runwayTime);
    return { code: clip(a.iata || a.icao, 4), airport: clip(a.shortName || a.name, 60), city: clip(a.municipalityName, 40), date: ymd(plan), planned: hm(plan), now: hm(rev) || '', terminal: clip(s.terminal, 6), gate: clip(s.gate, 6), desk: clip(s.checkInDesk, 12) }; };
  const dep = side(f.departure), arr = side(f.arrival), late = dep.now && dep.planned ? Math.max(0, (toMin(dep.now) - toMin(dep.planned) + 1440) % 1440) : 0;
  return { found: true, number: clip(f.number, 10) || n, airline: clip((f.airline || {}).name, 40), status: clip(f.status, 24), cancelled: /cancel/i.test(f.status || ''), late: late > 720 ? 0 : late, dep, arr };
}

/* ---------- keys: checked with one small call before they are kept ---------- */
async function check(kind, key, fetchFn) {
  if (kind === 'golemio') { await departures(key, fetchFn, { stop: 'Můstek' }); return true; }
  if (kind === 'maps') { await route(key, fetchFn, { from: 'Václavské náměstí, Praha', to: 'Pražský hrad, Praha', mode: 'walk' }); return true; }
  if (kind === 'flights') { const d = new Date().toISOString().slice(0, 10); await flight(key, fetchFn, { number: 'OK1', date: d }); return true; }
  throw err('bad_input', 'Afloat doesn’t know that service.');
}
const okKey = k => /^[A-Za-z0-9._\-]{16,400}$/.test(String(k || '').trim());

/* data: { action, ... }; keys: { golemio, maps, flights } */
async function handle(data, keys, fetchFn) {
  const d = data || {}, a = String(d.action || '');
  const need = k => { if (!keys[k]) throw err('no_key', `${KEYS[k]} isn’t set up for your household (Settings → Connections → Travel services).`); return keys[k]; };
  if (a === 'departures') return departures(need('golemio'), fetchFn, d);
  if (a === 'route') return route(need('maps'), fetchFn, d);
  if (a === 'flight') return flight(need('flights'), fetchFn, d);
  throw err('bad_action', 'Afloat doesn’t know that.');
}

module.exports = { handle, departures, route, flight, match, check, okKey, KEYS };
