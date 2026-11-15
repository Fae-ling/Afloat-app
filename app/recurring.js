/* Afloat · app/recurring.js · Repeating events (RRULE, occurrences) and the Hlídání check (both of you busy, nobody has the girls).
   Plain script: shares one scope with the other app/*.js files (loaded in order by index.html). See CLAUDE.md. */
/* ---------- repeating events: the same choices as Google Calendar, written as an RRULE ----------
   recur = { freq: DAILY|WEEKLY|MONTHLY|YEARLY, interval, byday: ['MO',…], mode: 'day'|'nth' (monthly), ends: never|until|count, until, count } */
const DAYC = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const ORD = ['first', 'second', 'third', 'fourth', 'last'];
const dOf = k => new Date(k + 'T12:00');
const dowC = k => DAYC[(dOf(k).getDay() + 6) % 7];
const nthOf = k => { const d = dOf(k), n = Math.ceil(d.getDate() / 7), last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); return d.getDate() + 7 > last ? -1 : n; };
function recurPreset(p, k) {
  if (!k) k = realToday();
  switch (p) {
    case 'daily': return { freq: 'DAILY', interval: 1, ends: 'never' };
    case 'weekly': return { freq: 'WEEKLY', interval: 1, byday: [dowC(k)], ends: 'never' };
    case 'weekdays': return { freq: 'WEEKLY', interval: 1, byday: ['MO', 'TU', 'WE', 'TH', 'FR'], ends: 'never' };
    case 'monthly': return { freq: 'MONTHLY', interval: 1, mode: 'day', ends: 'never' };
    case 'monthlyNth': return { freq: 'MONTHLY', interval: 1, mode: 'nth', ends: 'never' };
    case 'yearly': return { freq: 'YEARLY', interval: 1, ends: 'never' };
    case 'custom': return { freq: 'WEEKLY', interval: 1, byday: [dowC(k)], ends: 'never', custom: true };
    default: return null;
  }
}
function presetOf(r, k) {
  if (!r) return '';
  if (r.custom || (r.interval || 1) > 1 || (r.ends || 'never') !== 'never') return 'custom';
  if (r.freq === 'DAILY') return 'daily';
  if (r.freq === 'WEEKLY') { const b = (r.byday || []).join(','); return b === 'MO,TU,WE,TH,FR' ? 'weekdays' : b === dowC(k) ? 'weekly' : 'custom'; }
  if (r.freq === 'MONTHLY') return r.mode === 'nth' ? 'monthlyNth' : 'monthly';
  if (r.freq === 'YEARLY') return 'yearly';
  return 'custom';
}
function toRRULE(r, k) {
  if (!r) return '';
  const p = [`FREQ=${r.freq}`]; if ((+r.interval || 1) > 1) p.push(`INTERVAL=${+r.interval}`);
  if (r.freq === 'WEEKLY') p.push(`BYDAY=${(r.byday && r.byday.length ? r.byday : [dowC(k)]).join(',')}`);
  if (r.freq === 'MONTHLY') p.push(r.mode === 'nth' ? `BYDAY=${nthOf(k)}${dowC(k)}` : `BYMONTHDAY=${dOf(k).getDate()}`);
  if (r.ends === 'until' && r.until) p.push(`UNTIL=${r.until.replace(/-/g, '')}T225959Z`);
  if (r.ends === 'count' && +r.count > 0) p.push(`COUNT=${+r.count}`);
  return 'RRULE:' + p.join(';');
}
const DAYN = { MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat', SU: 'Sun' };
function recurLabel(r, k) {
  if (!r) return 'Does not repeat';
  const n = +r.interval || 1, d = dOf(k), unit = { DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month', YEARLY: 'year' }[r.freq];
  let t = n > 1 ? `Every ${n} ${unit}s` : `Every ${unit}`;
  if (r.freq === 'WEEKLY') { const b = r.byday && r.byday.length ? r.byday : [dowC(k)]; t = b.join(',') === 'MO,TU,WE,TH,FR' && n === 1 ? 'Every weekday (Mon–Fri)' : `${t} on ${b.map(x => DAYN[x]).join(', ')}`; }
  if (r.freq === 'MONTHLY') t += r.mode === 'nth' ? ` on the ${ORD[nthOf(k) === -1 ? 4 : nthOf(k) - 1]} ${DAYS_LONG[(d.getDay() + 6) % 7]}` : ` on day ${d.getDate()}`;
  if (r.freq === 'YEARLY') t += ` on ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`;
  if (r.ends === 'until' && r.until) t += `, until ${fmtD(r.until)}`;
  if (r.ends === 'count' && +r.count) t += `, ${+r.count} times`;
  return t;
}
/* occurrence dates of a repeating event between two days (used when Google isn't reachable) */
function occurrences(e, fromK, toK) {
  const r = e.recur; if (!r) return [e.date];
  const start = dOf(e.date), out = [], n = Math.max(1, +r.interval || 1), lim = r.ends === 'until' && r.until ? r.until : '9999-12-31', max = r.ends === 'count' && +r.count ? +r.count : 1e6;
  let made = 0, guard = 0;
  const push = k => { if (k < e.date || k > lim || made >= max) return false; made++; if (k >= fromK && k <= toK) out.push(k); return true; };
  if (r.freq === 'DAILY') { for (let k = e.date; k <= toK && k <= lim && made < max && guard++ < 3000; k = calAdd(k, n)) push(k); }
  else if (r.freq === 'WEEKLY') { const days = (r.byday && r.byday.length ? r.byday : [dowC(e.date)]).map(c => DAYC.indexOf(c)).sort();
    for (let w = weekStartOf(e.date); w <= toK && w <= lim && made < max && guard++ < 800; w = calAdd(w, 7 * n)) for (const i of days) { const k = calAdd(w, i); if (k >= e.date) push(k); } }
  else if (r.freq === 'MONTHLY') { const nth = nthOf(e.date), dw = (start.getDay() + 6) % 7, dom = start.getDate();
    for (let i = 0; guard++ < 600; i += n) { const y = start.getFullYear(), m = start.getMonth() + i, first = new Date(y, m, 1, 12); if (keyOf(first) > toK || keyOf(first) > lim || made >= max) break;
      let d; if (r.mode === 'nth') { if (nth === -1) { d = new Date(y, m + 1, 0, 12); while ((d.getDay() + 6) % 7 !== dw) d.setDate(d.getDate() - 1); } else { d = new Date(first); while ((d.getDay() + 6) % 7 !== dw) d.setDate(d.getDate() + 1); d.setDate(d.getDate() + 7 * (nth - 1)); } }
      else { d = new Date(y, m, dom, 12); if (d.getMonth() !== ((m % 12) + 12) % 12) continue; }
      push(keyOf(d)); } }
  else if (r.freq === 'YEARLY') { for (let i = 0; guard++ < 200; i += n) { const d = new Date(start.getFullYear() + i, start.getMonth(), start.getDate(), 12); if (keyOf(d) > toK || keyOf(d) > lim || made >= max) break; if (d.getMonth() === start.getMonth()) push(keyOf(d)); } }
  return out;
}
const spanDays = e => Math.max(0, Math.round((dOf(e.endDate || e.date) - dOf(e.date)) / 864e5));
const REMS = [[0, 'At the start'], [10, '10 min'], [30, '30 min'], [60, '1 hour'], [120, '2 hours'], [1440, '1 day'], [10080, '1 week']];
const remList = ev => (Array.isArray(ev.remind) ? ev.remind : ev.remind ? [ev.remind] : []).map(Number).filter(n => n >= 0);
const mapLinks = place => place ? `<div class="maplinks"><a class="tiny" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}" target="_blank" rel="noopener">Google Maps ↗</a><a class="tiny" href="https://mapy.cz/zakladni?q=${encodeURIComponent(place)}" target="_blank" rel="noopener">Mapy.cz ↗</a></div>` : '';
const GPERM = [['guestsCanModify', 'Guests can change the event'], ['guestsCanInviteOthers', 'Guests can invite others'], ['guestsCanSeeGuests', 'Guests can see the guest list']];
const gpermOf = ev => ({ guestsCanModify: false, guestsCanInviteOthers: false, guestsCanSeeGuests: true, ...(ev.gperm || {}) });
/* an event that has already ended drops out of "Coming up" lists (the page redraws every minute) */
const notOver = e => evSpan(e)[1] > Date.now();

/* ---------- hlídání needed: both of you busy, nobody has the girls ---------- */
const tsOf = (k, t) => new Date(`${k}T${t || '00:00'}:00`).getTime();
function evSpan(e) {
  if (e.allDay) return [tsOf(e.date), tsOf(calAdd(e.endDate || e.date, 1))];
  const a = tsOf(e.date, e.start || '00:00'); let b = e.end ? tsOf(e.endDate || e.date, e.end) : a + 36e5;
  if (b <= a) b = e.end ? tsOf(calAdd(e.date, 1), e.end) : a + 36e5;
  return [a, b];
}
function mergeIv(iv) { const o = []; for (const x of [...iv].sort((a, b) => a[0] - b[0])) { const l = o[o.length - 1]; if (l && x[0] <= l[1]) l[1] = Math.max(l[1], x[1]); else o.push([...x]); } return o; }
function intersectIv(A, B) { const o = []; let i = 0, j = 0; while (i < A.length && j < B.length) { const s = Math.max(A[i][0], B[j][0]), e = Math.min(A[i][1], B[j][1]); if (s < e) o.push([s, e]); if (A[i][1] < B[j][1]) i++; else j++; } return o; }
function subtractIv(A, B) { let out = A.map(x => [...x]); for (const [bs, be] of B) { const n = []; for (const [s, e] of out) { if (be <= s || bs >= e) n.push([s, e]); else { if (s < bs) n.push([s, bs]); if (be < e) n.push([be, e]); } } out = n; } return out; }
const kinderWin = () => { const v = calCfg().kinder ?? '07:30-16:00'; const m = /^(\d\d:\d\d)\s*[-–]\s*(\d\d:\d\d)$/.exec(String(v).trim()); return m ? [m[1], m[2]] : null; };
const gapKey = s => 'g' + keyOf(new Date(s)).replace(/-/g, '') + hm(new Date(s)).replace(':', '');
function sitGaps(fromK, toK) {
  const ads = members().map(m => m.name), ks = kidsList();
  if (ads.length < 2 || !ks.length) return [];
  const evs = allEvents().filter(e => e.kind !== 'mine' && !e.isDate && (e.endDate || e.date) >= calAdd(fromK, -1) && e.date <= toK);
  const covers = e => inGP(e) && (!(e.who || []).length || ks.every(k => e.who.includes(k)));
  const takesGirls = e => ks.every(k => (e.who || []).includes(k));
  const days = []; for (let k = calAdd(fromK, -1); k <= toK; k = calAdd(k, 1)) days.push(k);
  const gday = Object.fromEntries(days.map(k => [k, girlsAt(k)]));
  const work = n => { const w = workWin(n); return w ? days.filter(k => meAt(n, k) === 'out' && gday[k] !== 'grandma').map(k => [tsOf(k, w[0]), tsOf(k, w[1])]) : []; };
  const busy = n => mergeIv([...evs.filter(e => !e.free && !inGP(e) && (e.who || []).includes(n) && !takesGirls(e)).map(evSpan), ...work(n)]);
  let g = busy(ads[0]); for (const a of ads.slice(1)) g = intersectIv(g, busy(a));
  if (!g.length) return [];
  g = subtractIv(g, mergeIv([...evs.filter(covers).map(evSpan), ...days.filter(k => gday[k] === 'grandma').map(k => [tsOf(k), tsOf(calAdd(k, 1))])]));
  const kh = kinderWin();
  if (kh) g = subtractIv(g, days.filter(k => gday[k] === 'kinder').map(k => [tsOf(k, kh[0]), tsOf(k, kh[1])]));
  const ok = H('hlidani').ok || {}, now = Date.now(), lim = tsOf(calAdd(toK, 1));
  return g.filter(([s, e]) => e - s >= 30 * 6e4 && e > now && s < lim && !ok[gapKey(s)])
    .map(([s, e]) => ({ s, e, key: gapKey(s), evs: evs.filter(x => { const [a, b] = evSpan(x); return a < e && b > s && !inGP(x) && ads.some(n => (x.who || []).includes(n)); }) }));
}
let gapCache = { at: 0, sig: '', list: [] };
function upcomingGaps() {
  const to = calRange[1] && calRange[1] > realToday() ? calRange[1] : calAdd(realToday(), 45);
  const sig = `${to}|${JSON.stringify([H('situation'), situOf(dk), situOf(tk), prof(me).back, prof(otherOf(me) || '').back])}|${Object.keys(S.events || {}).length}|${(S.gcal.events || []).length}|${(S.gcal.gp || []).length}|${S.gcal.at || 0}|${JSON.stringify(H('hlidani').ok || {}).length}|${calCfg().kinder}|${S.gcal.status}`;
  if (gapCache.sig !== sig || Date.now() - gapCache.at > 6e4) gapCache = { at: Date.now(), sig, list: sitGaps(realToday(), to) };
  return gapCache.list;
}
const gapsOn = k => upcomingGaps().filter(g => keyOf(new Date(g.s)) <= k && keyOf(new Date(g.e - 1)) >= k);
function fmtGap(g) {
  const a = new Date(g.s), b = new Date(g.e), ka = keyOf(a), kb = keyOf(new Date(g.e - 1));
  const dl = d => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const he = d => hm(d) === '00:00' ? '24:00' : hm(d);
  return ka === kb ? `${dl(a)}, ${hm(a)}–${he(b)}` : `${dl(a)} ${hm(a)} → ${b.toLocaleDateString('en-GB', { weekday: 'short' })} ${hm(b)}`;
}
function sitCard(days, title) {
  let gs = upcomingGaps(); if (days) { const lim = calAdd(realToday(), days); gs = gs.filter(g => keyOf(new Date(g.s)) <= lim); }
  if (!gs.length) return '';
  const ads = members().map(m => m.name);
  return `<section class="card sitcard"><div class="sec-head"><h2>${title || 'Hlídání needed'}</h2><span class="progress">${gs.length}</span></div>
    <p class="muted small">You’re both busy then and nobody has the girls yet.</p>
    <ul class="sitlist">${gs.map(g => `<li><b>${esc(fmtGap(g))}</b><span class="def">${g.evs.map(e => `${esc(shortTitle(e.title))}${(e.who || []).some(n => ads.includes(n)) ? ' (' + esc(e.who.filter(n => ads.includes(n)).join(' & ')) + ')' : ''}`).join(' · ')}</span>
      <div class="chips"><button class="tiny" data-act="sit-gp" data-s="${g.s}" data-e="${g.e}">Grandparents have them</button><button class="tiny" data-act="sit-ok" data-k="${g.key}">Not needed</button></div></li>`).join('')}</ul></section>`;
}
/* ---------- taps on this area's buttons (data-act), called from events.js; true = handled ---------- */
function tapRecurring(a, el, e, r) {
  switch (a) {
    case 'sit-ok': { const o = { ...H('hlidani') }; o.ok = { ...(o.ok || {}), [el.dataset.k]: me || true }; saveHome('hlidani', o); toast('Marked as not needed.'); return true; }
  }
  return false;
}
