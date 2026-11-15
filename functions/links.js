// Friends between households (10 Nov 2026): links between two PEOPLE, not two households.
//
// A link is links/<id> = { pair: [a, b] (emails), status: 'asked' | 'on', names: { a, b }, prof: { a, b }, share: { a: {...}, b: {...} },
// asks: [...], at }. Side 'a' asked, side 'b' answers. Each side's `share` says what that person lets the OTHER do:
//   busy   – see when I'm busy (start and end only)
//   titles – also see my events' titles (meant for close partners; only with busy)
//   come   – send me "Want to come?" asks
// Everything starts off. Links are server-only in Firestore (no rule lets a phone read them), so a link is never visible to the
// rest of either household: the server only ever answers the two people in it.
//
// Free/busy is worked out here from the peer's own Google account each time it's asked for; nothing about their calendar is
// stored. Only 08:00–23:00 (Prague) for the next 31 days is returned, so nights aren't shown as free.
//
// Everything takes the Firestore instance and a few helpers as arguments, so the tests can use pretend ones.

const TZ = 'Europe/Prague', DAY_FROM = 8 * 60, DAY_TO = 23 * 60, DAYS = 31, MAX_ASKS = 20;
const norm = e => String(e || '').trim().toLowerCase();
const okEmail = e => /^[^@\s/]+@[^@\s/]+\.[^@\s/]+$/.test(norm(e));
const clip = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
const newId = () => require('crypto').randomBytes(9).toString('base64url').replace(/[^A-Za-z0-9]/g, 'x');
const err = (code, message) => Object.assign(new Error(message), { code });
const OFF = { busy: false, titles: false, come: false };
const shareOf = s => ({ busy: !!(s && s.busy), titles: !!(s && s.busy && s.titles), come: !!(s && s.come) });

/* ---------- Prague time without a library ---------- */
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
function local(ms) {
  const p = Object.fromEntries(fmt.formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, min: +p.hour * 60 + +p.minute };
}
/* the instant of a Prague wall-clock time (date 'YYYY-MM-DD', minutes after midnight) */
function instant(date, min) {
  const guess = Date.parse(date + 'T00:00:00Z') + min * 60e3;
  let t = guess;
  for (let i = 0; i < 2; i++) { const l = local(t), off = Date.parse(l.date + 'T00:00:00Z') + l.min * 60e3 - t; t = guess - off; }
  return t;
}
const addDays = (date, n) => { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/* ---------- what a peer's calendar says, as busy blocks ---------- */
/* titles that never cross between households, even with "titles" on */
const SENSITIVE = /therap|terapi|psych|doktor|doctor|lékař|lekar|zubař|zubar|dentist|gyn|ordinac|clinic|klinik|nemocnic|hospital|medic|léčb|lecb|vyšetř|vysetr|očkov|ockov|check-?up|pharma|lékárn/i;
const stripWho = t => { const m = /^(.*?)\s·\s[^·]+$/.exec(t || ''); return m ? m[1].trim() : String(t || '').trim(); };
const whoOf = t => { const m = /^.*?\s·\s([^·]+)$/.exec(t || ''); return m ? m[1].split(',').map(x => x.trim()).filter(Boolean) : []; };
const descWho = d => { const m = /(?:^|\n)\s*(?:who|kdo):\s*([^\n]*)/i.exec(String(d || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '\n')); return m ? m[1].split(',').map(x => x.trim()).filter(Boolean) : []; };
const gTime = x => (x && x.dateTime ? { ms: Date.parse(x.dateTime), allDay: false } : x && x.date ? { date: String(x.date).slice(0, 10), allDay: true } : null);

/* Google events → [{ s, e, title|null }] in ms.
   own: the peer's own calendar (opaque, not declined).
   family: their household's family calendar, only events they are on (Afloat's own record of who's going first, the title's
   "· names" next, the description's "Who:" line last). afloat: { gId → { who, kind } } from the household's event documents.
   name: what the peer is called in their household. discreet: friends' names marked Discreet there. */
function busyEvents({ own = [], family = [], afloat = {}, name = '', discreet = [] }) {
  const out = [], seen = new Set();
  const add = (e, onIt, kind) => {
    if (!e || e.status === 'cancelled' || e.transparency === 'transparent') return;
    const me = (e.attendees || []).find(a => a.self);
    if (me && me.responseStatus === 'declined') return;
    if (!onIt) return;
    const s = gTime(e.start), en = gTime(e.end); if (!s || !en) return;
    const key = (e.iCalUID || e.id) + '|' + (s.ms || s.date); if (seen.has(key)) return; seen.add(key);
    const who = whoOf(e.summary);
    const hide = e.visibility === 'private' || e.visibility === 'confidential' || kind === 'doctor' || SENSITIVE.test(e.summary || '') || who.some(n => discreet.includes(n));
    const title = hide ? null : clip(stripWho(e.summary), 80) || null;
    if (s.allDay) out.push({ s: instant(s.date, 0), e: instant(en.date, 0), title });
    else out.push({ s: s.ms, e: en.ms, title });
  };
  for (const e of own) add(e, true, '');
  for (const e of family) {
    const doc = afloat[e.id] || afloat[e.recurringEventId] || null;
    const who = doc && Array.isArray(doc.who) ? doc.who : [...whoOf(e.summary), ...descWho(e.description)];
    add(e, !!name && who.includes(name), doc ? doc.kind : '');
  }
  return out;
}

/* busy events → days: { 'YYYY-MM-DD': [{ s: min, e: min, t? }] }, clipped to 08:00–23:00 Prague, for DAYS days from `today` */
function busyDays(events, today, titles) {
  const days = {};
  for (let i = 0; i < DAYS; i++) days[addDays(today, i)] = [];
  const bounds = Object.keys(days).map(date => [date, instant(date, DAY_FROM), instant(date, DAY_TO)]);
  for (const ev of events) {
    for (const [date, a, b] of bounds) {
      const s = Math.max(ev.s, a), e = Math.min(ev.e, b);
      if (e <= s) continue;
      const blk = { s: Math.round((s - a) / 60e3) + DAY_FROM, e: Math.round((e - a) / 60e3) + DAY_FROM };
      if (titles && ev.title) blk.t = ev.title;
      days[date].push(blk);
    }
  }
  for (const d of Object.keys(days)) {
    const l = days[d].sort((x, y) => x.s - y.s || x.e - y.e);
    if (titles) { days[d] = l; continue; }
    const m = []; for (const b of l) { const last = m[m.length - 1]; if (last && b.s <= last.e) last.e = Math.max(last.e, b.e); else m.push({ s: b.s, e: b.e }); }
    days[d] = m;
  }
  return days;
}

/* ---------- the links themselves ---------- */
const sideOf = (L, email) => (norm(L.pair[0]) === email ? 'a' : norm(L.pair[1]) === email ? 'b' : null);
const other = s => (s === 'a' ? 'b' : 'a');
async function getLink(fs, id, email) {
  if (!/^[A-Za-z0-9]{6,40}$/.test(String(id || ''))) throw err('not_found', 'That connection isn’t there any more.');
  const ref = fs.doc(`links/${id}`), snap = await ref.get(), L = snap.exists ? snap.data() : null;
  const side = L && sideOf(L, email);
  if (!side) throw err('not_found', 'That connection isn’t there any more.');
  return { ref, L, side };
}
/* what one person sees of a link */
function view(id, L, side, today) {
  const o = other(side);
  return { id, status: L.status, mine: side === 'a' ? 'asked' : 'answering', peer: norm(L.pair[side === 'a' ? 1 : 0]), peerName: (L.names || {})[o] || '', prof: (L.prof || {})[side] || null,
    share: shareOf((L.share || {})[side]), theirs: L.status === 'on' ? shareOf((L.share || {})[o]) : OFF,
    asks: (L.asks || []).filter(x => x.date >= addDays(today, -1)).map(x => ({ ...x, fromMe: x.by === side })) };
}

/* data: { action, ... }. me: { email, name, admin }. deps: { resolve(email) → household or null, invite(email), eventsFor(link, peerSide, from, to) → busyEvents input, notify(email, { title, body }), now } */
async function handle(fs, me, data, deps) {
  const email = norm(me.email), now = deps.now ? deps.now() : Date.now(), today = local(now).date, a = String((data || {}).action || '');
  const d = data || {};
  if (a === 'list') {
    const q = await fs.collection('links').where('pair', 'array-contains', email).get();
    return { links: q.docs.map(s => { const L = s.data(); return view(s.id, L, sideOf(L, email), today); }).filter(x => x.status === 'on' || x.status === 'asked'), today };
  }
  if (a === 'request') {
    const to = norm(d.email);
    if (!okEmail(to)) throw err('bad_email', 'That isn’t an email address.');
    if (to === email) throw err('bad_email', 'That’s your own address.');
    const theirs = await deps.resolve(to), mine = await deps.resolve(email);
    if (!theirs) return { notHere: true, canInvite: !!me.admin };
    if (mine && theirs.hid === mine.hid) throw err('same_house', 'You already share a household, so you see each other’s things anyway.');
    const q = await fs.collection('links').where('pair', 'array-contains', email).get();
    const was = q.docs.find(s => (s.data().pair || []).map(norm).includes(to));
    if (was) { const L = was.data(); return { link: view(was.id, L, sideOf(L, email), today), already: true }; }
    const id = newId(), L = { pair: [email, to], status: 'asked', names: { a: clip(me.name, 40) }, prof: { a: clip(d.prof, 40) || null }, share: { a: shareOf(d.share), b: OFF }, asks: [], at: now };
    await fs.doc(`links/${id}`).set(L);
    await deps.notify(to, { title: `${L.names.a || email} wants to connect in Afloat`, body: 'Open Afloat to say yes or not now.' });
    return { link: view(id, L, 'a', today) };
  }
  if (a === 'invite') {
    if (!me.admin) throw err('not_owner', 'Only the person who runs this Afloat can invite a new household.');
    await deps.invite(norm(d.email));
    return { invited: true };
  }
  const { ref, L, side } = await getLink(fs, d.id, email), o = other(side), peer = norm(L.pair[o === 'a' ? 0 : 1]);
  if (a === 'answer') {
    if (side !== 'b' || L.status !== 'asked') throw err('not_found', 'There’s nothing to answer here.');
    if (!d.yes) { await ref.delete(); return { gone: true }; }
    const N = { ...L, status: 'on', names: { ...(L.names || {}), b: clip(me.name, 40) }, prof: { ...(L.prof || {}), b: clip(d.prof, 40) || null }, share: { ...(L.share || {}), b: shareOf(d.share) }, on: now };
    await ref.set(N);
    await deps.notify(peer, { title: `${N.names.b || email} connected with you in Afloat`, body: 'You can see what they share on their profile in Family.' });
    return { link: view(d.id, N, side, today) };
  }
  if (a === 'share') {
    const N = { ...L, share: { ...(L.share || {}), [side]: shareOf(d.share) }, ...(d.prof !== undefined ? { prof: { ...(L.prof || {}), [side]: clip(d.prof, 40) || null } } : {}) };
    await ref.set(N); return { link: view(d.id, N, side, today) };
  }
  if (a === 'unlink') { await ref.delete(); return { gone: true }; }
  if (L.status !== 'on') throw err('not_on', 'You aren’t connected yet.');
  const theirs = shareOf((L.share || {})[o]);
  if (a === 'busy') {
    if (!theirs.busy) throw err('not_shared', 'They haven’t shared when they’re free.');
    const evs = await deps.eventsFor(L, o, instant(today, 0), instant(addDays(today, DAYS), 0));
    return { today, from: DAY_FROM, to: DAY_TO, titles: theirs.titles, days: busyDays(busyEvents(evs), today, theirs.titles) };
  }
  if (a === 'ask') {
    if (!theirs.come) throw err('not_shared', 'They haven’t switched on “Ask me to things”.');
    const date = String(d.date || ''), hm = x => (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(x || '')) ? String(x) : '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today || date > addDays(today, 366)) throw err('bad_date', 'Pick a day from today on.');
    const title = clip(d.title, 80); if (!title) throw err('bad_title', 'Say what it is.');
    const open = (L.asks || []).filter(x => x.date >= addDays(today, -1));
    if (open.length >= MAX_ASKS) throw err('too_many', 'There are already a lot of open asks between you.');
    const x = { id: newId(), by: side, title, date, start: hm(d.start), end: hm(d.end), place: clip(d.place, 120), note: clip(d.note, 300), status: 'open', at: now };
    const N = { ...L, asks: [...open, x] }; await ref.set(N);
    await deps.notify(peer, { title: `Want to come? ${title}`, body: `${(L.names || {})[side] || email} asks. Open Afloat to say yes or no.` });
    return { link: view(d.id, N, side, today) };
  }
  if (a === 'reply' || a === 'done') {
    const x = (L.asks || []).find(y => y.id === d.ask);
    if (!x) throw err('not_found', 'That ask isn’t there any more.');
    let asks;
    if (a === 'reply') {
      if (x.by === side || x.status !== 'open') throw err('not_found', 'There’s nothing to answer here.');
      asks = L.asks.map(y => (y.id === x.id ? { ...y, status: d.yes ? 'yes' : 'no', note2: clip(d.note, 200), answered: now } : y));
      await deps.notify(peer, { title: `${(L.names || {})[side] || email}: ${d.yes ? 'yes' : 'not this time'}`, body: d.yes ? `${x.title}: open Afloat to put it in your calendar.` : x.title });
    } else asks = L.asks.filter(y => y.id !== x.id); /* either side clears an ask: taking it back, or done with the answer */
    const N = { ...L, asks }; await ref.set(N);
    return { link: view(d.id, N, side, today) };
  }
  throw err('bad_action', 'Afloat doesn’t know that.');
}

module.exports = { handle, busyEvents, busyDays, local, instant, addDays, shareOf, SENSITIVE, DAY_FROM, DAY_TO, DAYS };
