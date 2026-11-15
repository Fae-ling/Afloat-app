/* Afloat · app/calendar-sync.js · Google Calendar: reading events (who is going), two-way sync (reconcile) and invitations.
   Plain script: shares one scope with the other app/*.js files (loaded in order by index.html). See CLAUDE.md. */
/* ---------- two-way sync: whichever side changed last wins, field by field ---------- */
function reconcile(fam, gp) {
  if (!S.events) return 0; let n = 0;
  for (const [id, d] of Object.entries(S.events)) {
    let patch = null;
    const newer = (g, base) => g && g.updated && g.updated > (base || '') && new Date(g.updated).getTime() > (d.at || 0) + 2000;
    const g = d.gId && (d.recur ? fam.find(x => x.master === d.gId) : fam.find(x => x.gId === d.gId));
    if (newer(g, d.gUpd)) {
      const friendsG = friendsByEmail(g.guests.map(x => x.email));
      const who = g.named ? uniq([...g.who.filter(x => !isFriend(x) || !pInfo(x).email), ...friendsG]) : uniq([...(d.who || []).filter(x => !isFriend(x) || !pInfo(x).email), ...friendsG]);
      patch = { title: g.title, date: g.date, endDate: g.endDate, allDay: g.allDay, start: g.start, end: g.end, place: g.place, notes: g.notes, who,
        color: !g.colorId || g.colorId === toGoogle(evColor({ ...d, who })) ? (d.color || null) : g.colorId, /* same as Google already has → keep Afloat's (maybe richer) colour */ guests: g.guests, invited: g.invited, extraGuests: g.extraGuests || [], gperm: g.gperm, gUpd: g.updated, free: !!g.free, vis: g.vis || '', meetUrl: g.meetUrl || d.meetUrl || '' };
      if (d.recur) { delete patch.date; delete patch.endDate; }
    }
    const gg = d.gpOnly && d.gpGId && gp.find(x => x.gId === d.gpGId);
    if (newer(gg, d.gpUpd)) patch = { ...(patch || {}), date: gg.date, endDate: gg.endDate, allDay: gg.allDay, start: gg.start, end: gg.end, gpUpd: gg.updated };
    if (!patch) continue;
    const changed = Object.keys(patch).some(k => !/Upd$/.test(k) && JSON.stringify(patch[k] ?? null) !== JSON.stringify(d[k] ?? null));
    S.events = { ...S.events, [id]: { ...d, ...patch } };
    if (db) q('events/' + id, () => db.doc('events/' + id).update(patch));
    if (changed) n++;
  }
  return n;
}
let calRange = ['', ''];
async function calLoad() {
  const c = calCfg(); if (!mcp) return;
  S.gcal = { ...S.gcal, status: 'loading' }; render();
  const tday = realToday(), f = S.ui.calFocus || tday, ms = f.slice(0, 8) + '01', nmo = (() => { const d = new Date(ms + 'T12:00'); d.setMonth(d.getMonth() + 1); return keyOf(d); })();
  const fk = [calAdd(tday, -1), calAdd(ms, -10)].sort()[0], tk2 = [calAdd(tday, 45), calAdd(nmo, 14)].sort().pop();
  const from = new Date(fk + 'T00:00:00'), to = new Date(tk2 + 'T00:00:00');
  calRange = [keyOf(from), keyOf(to)]; subscribeEvents(); /* browsing to an older month widens the events Afloat loads */
  /* every page of the answer (250 at a time): what's missing from the list counts as deleted, so the list must be whole */
  let partial = false;
  const raw = async id => {
    const all = []; let tok = null, n = 0, last = {};
    do { last = await mcp.callTool(GC, 'list_events', { ...(id ? { calendarId: id } : {}), startTime: gIso(from), endTime: gIso(to), orderBy: 'startTime', pageSize: 250, ...(tok ? { pageToken: tok } : {}) }, { cache: false }).then(r => r.payload || {}); all.push(...(last.events || [])); tok = last.nextPageToken || null; } while (tok && ++n < 6);
    return { ...last, events: all, more: !!tok };
  };
  /* a failure says which calendar it was, so the message can name it */
  const q = (id, name) => raw(id).then(p => { if (p.more) partial = true; return (p.events || []).filter(x => x.status !== 'cancelled').map(normG); }).catch(e => { if (e && typeof e === 'object') e.cal = name; throw e; });
  try {
    const [fam, own, gp] = await Promise.all([c.calId ? q(c.calId, c.calName || 'the family calendar') : [], c.calId !== 'primary' ? raw(null).catch(() => ({})) : {}, c.gpId && c.gpId !== c.calId ? q(c.gpId, c.gpName || 'the grandparents’ calendar') : []]);
    const ownEv = (own.events || []).filter(x => x.status !== 'cancelled'), inv = invitesFrom(ownEv, fam, gp);
    /* an invitation to an event that's already on the grandparents' calendar (Grandma invites you to confirm hlídání) shows once, as that event, with your reply on it */
    const gpInv = invitesFrom(ownEv, fam).filter(i => gp.some(g => sameEv(g, i)));
    learnMyEmail(own, ownEv);
    const mine = showMine() ? ownEv.map(normG).filter(x => !inv.some(i => i.gId === x.gId) && !gpInv.some(i => i.gId === x.gId)) : [];
    /* range: the days this whole answer covered; an Afloat event that's missing from it inside it was deleted in Google */
    S.gcal = { status: 'ok', events: fam, mine, inv, gp: gp.map(x => { const iv = gpInv.find(i => sameEv(x, i)); return { ...x, kind: 'grandma', who: x.who.length ? x.who : kidsList(), src: 'gp', ...(iv ? { rsvp: iv.rsvp, from: iv.from } : {}) }; }), err: null, at: Date.now(), range: partial || !c.calId ? null : [keyOf(from), keyOf(to)] };
    const n = reconcile(fam, gp); if (n && S.gcal.synced) toast(`${n} event${n === 1 ? '' : 's'} updated from Google Calendar.`); S.gcal.synced = true;
    pruneGone(); if (S.planMine.k && Date.now() - S.planMine.at > 60e3) loadPlanMine(true); syncPlan();
  } catch (e) { S.gcal = { ...S.gcal, status: 'error', err: e, errAt: Date.now() }; }
  render();
}
/* An event that was deleted in Google is hidden at once (allEvents). Its Afloat copy is removed once it has been missing
   from two checks in a row (never on a single odd answer), so it stops counting anywhere and the recolouring loop doesn't
   trip over it. A few at a time; never when Google answered with nothing at all, nor when a lot vanish together (that is
   a different calendar being picked, not someone deleting events). */
const goneSeen = {};
function pruneGone() {
  const R = S.gcal.range; if (!R || !db || !S.events) return;
  const fam = new Set((S.gcal.events || []).map(x => x.gId)), gp = new Set((S.gcal.gp || []).map(x => x.gId)), miss = [];
  for (const [id, d] of Object.entries(S.events)) {
    if (d.recur || Date.now() - (d.at || 0) < 10 * 6e4 || (d.endDate || d.date) < R[0] || d.date >= R[1]) { delete goneSeen[id]; continue; }
    const gone = d.gpOnly ? !!d.gpGId && !gp.has(d.gpGId) : !!d.gId && !fam.has(d.gId);
    if (!gone) { delete goneSeen[id]; continue; }
    goneSeen[id] = (goneSeen[id] || 0) + 1; if (goneSeen[id] >= 2) miss.push(id);
  }
  if (!miss.length || miss.length > 8 || (!(S.gcal.events || []).length && !(S.gcal.gp || []).length && miss.length > 2)) return;
  const n = { ...S.events };
  for (const id of miss.slice(0, 3)) { delete n[id]; delete goneSeen[id]; q('events/' + id, () => db.doc('events/' + id).delete()); }
  S.events = n;
}
/* ---------- invitations: events someone else organised that you were invited to, from your own Google calendar ---------- */
const hhEmails = () => Object.fromEntries(members().map(m => [String(prof(m.name).gEmail || '').toLowerCase(), m.name]).filter(([e]) => e));
/* Family contacts (grandma, the paediatrician…) are recognised by email too: an invitation from one of them shows their name and isn't offered as a stranger */
const contactEmails = c => [c.email, ...(c.altEmails || [])].map(x => String(x || '').trim().toLowerCase()).filter(Boolean);
const contactByEmail = em => { em = String(em || '').toLowerCase(); return em ? (H('contacts').list || []).find(c => contactEmails(c).includes(em)) || null : null; };
function learnMyEmail(own, evs) {
  if (!meValid()) return;
  const em = String((evs.flatMap(e => e.attendees || []).find(a => a.self) || {}).email || (/@/.test(own.summary || '') ? own.summary : '') || '').toLowerCase();
  if (em && prof(me).gEmail !== em) mergeDoc('home/people', { people: { [me]: { gEmail: em } } }); /* quietly: no toast */
}
/* the same event found on another calendar: same Google event id (invited copies share it), or same title and time */
const sameEv = (a, b) => a.gId === b.gId || (shortTitle(a.title) === shortTitle(b.title) && a.date === b.date && (a.start || '') === (b.start || ''));
function invitesFrom(ownEv, fam, gp = []) {
  const hh = hhEmails();
  return ownEv.filter(e => e.organizer && !e.organizer.self && (e.attendees || []).some(a => a.self && a.responseStatus !== 'declined'))
    .map(e => { const n = normG(e), meA = (e.attendees || []).find(a => a.self) || {}, org = e.organizer || {}, oe = String(org.email || '').toLowerCase();
      const hhIn = [...(e.attendees || []).map(a => hh[String(a.email || '').toLowerCase()]), hh[oe]].filter(Boolean);
      return { ...n, who: uniq([me, ...hhIn, ...n.who]), kind: guessKind(n.title), src: 'invite', rsvp: meA.responseStatus || 'needsAction', from: hh[oe] || (friendsL().find(f => (f.email || '').toLowerCase() === oe) || {}).name || (contactByEmail(oe) || {}).name || org.displayName || oe, fromEmail: oe }; })
    .filter(i => !fam.some(f => sameEv(f, i)) && !gp.some(g => sameEv(g, i)));
}
/* people who invited you but aren't in Afloat yet: offered once on the Calendar tab */
function newInviters() {
  const ign = (H('invites').ignore || {}), hh = hhEmails(), out = new Map();
  for (const i of S.gcal.inv || []) {
    const em = i.fromEmail; if (!em || hh[em] || (S.ui.invSkip || {})[em] || ign[em.replace(/[.@]/g, '_')] || friendsL().some(f => (f.email || '').toLowerCase() === em) || contactByEmail(em) || /calendar\.google\.com$|resource\.calendar/.test(em)) continue;
    if (!out.has(em)) out.set(em, { email: em, name: i.from && i.from !== em ? i.from : '', events: [] });
    out.get(em).events.push(i.title);
  }
  return [...out.values()];
}
/* who an unknown address could already be: Family contacts, and partners & friends with no email yet */
const linkChoices = () => [...(H('contacts').list || []).map(c => ({ v: 'c:' + c.id, t: `${c.name}${c.role ? ' (' + c.role + ')' : ''}` })), ...friendsL().filter(f => !f.email).map(f => ({ v: 'f:' + f.id, t: f.name }))];
function inviterCard() {
  const ps = newInviters(); if (!ps.length) return '';
  const lc = linkChoices();
  return `<section class="card invcard"><div class="sec-head"><h2>New people in your invitations</h2></div>
    <p class="muted small">They invited you to something in Google Calendar but aren’t in Afloat yet. Add them to Partners &amp; friends, or link the address to someone already in Family, and their events and invitations show their name.</p>
    <ul class="sitlist">${ps.map(x => `<li data-sw-l="[data-act=inv-skip]"><b>${esc(x.name || x.email)}</b><span class="def">${x.name ? esc(x.email) + ' · ' : ''}${esc(x.events.slice(0, 2).join(', '))}${x.events.length > 2 ? ` and ${x.events.length - 2} more` : ''}</span>
      <div class="addform"><input type="text" id="inv_${esc(x.email.replace(/[^a-z0-9]/g, '_'))}" value="${esc(x.name)}" placeholder="Their name" aria-label="Name for ${esc(x.email)}"><button class="btn" data-act="inv-add" data-e="${esc(x.email)}">Add</button><button class="link" data-act="inv-skip" data-e="${esc(x.email)}">Not now</button><button class="link" data-act="inv-never" data-e="${esc(x.email)}">Never ask</button></div>
      ${lc.length ? `<div class="addform"><select id="invl_${esc(x.email.replace(/[^a-z0-9]/g, '_'))}" aria-label="Link ${esc(x.email)} to someone already in Family"><option value="">Already in Family…</option>${lc.map(o => `<option value="${esc(o.v)}">${esc(o.t)}</option>`).join('')}</select><button class="btn ghost" data-act="inv-link" data-e="${esc(x.email)}">Link</button></div>` : ''}</li>`).join('')}</ul></section>`;
}
const RSVP_ME = { accepted: 'you’re going', tentative: 'maybe', needsAction: 'not answered yet' };
function allEvents() {
  const loc = Object.entries(S.events || {}).map(([id, e]) => ({ ...e, id, src: 'afloat' })), g = S.gcal.events || [], byG = new Map(g.map(x => [x.gId, x])), byGp = new Map((S.gcal.gp || []).map(x => [x.gId, x]));
  const out = [], R = S.gcal.range;
  for (const e of loc) {
    if (e.recur) {
      if (S.gcal.at && e.gId && calCfg().calId) { for (const x of g.filter(x => x.master === e.gId)) out.push({ ...e, date: x.date, endDate: x.endDate, start: x.start, end: x.end, allDay: x.allDay, link: x.link, guests: x.guests, gInst: x.gId, occ: true }); }
      else { const a = calRange[0] || calAdd(realToday(), -1), b = [calRange[1] || '', calAdd(realToday(), 62)].sort().pop(), sp = spanDays(e); for (const k of occurrences(e, calAdd(a, -sp), b)) out.push({ ...e, date: k, endDate: calAdd(k, sp), occ: true }); }
      continue;
    }
    const gx = e.gId && byG.get(e.gId);
    /* gone from Google's answer for days that answer covered → deleted in Google (or by grandparents on theirs). Not for a
       minute or two after it was saved here, while Google's list may not have caught up; kept through a re-check (loading). */
    if (R && Date.now() - (e.at || 0) > 2 * 6e4 && (e.endDate || e.date) >= R[0] && e.date < R[1] && (e.gpOnly ? e.gpGId && !byGp.get(e.gpGId) : e.gId && !gx)) continue;
    out.push(gx ? { ...e, link: gx.link, guests: gx.guests, id: e.id, src: 'afloat' } : e);
  }
  for (const x of g) if (!loc.some(e => e.gId === x.gId || (x.master && e.gId === x.master))) { const kind = guessKind(x.title); out.push({ ...x, kind, color: x.colorId && x.colorId !== toGoogle(autoColorId(x)) ? x.colorId : null, src: 'google' }); }
  for (const x of S.gcal.mine || []) out.push({ ...x, kind: 'mine', src: 'mine' });
  for (const x of S.gcal.inv || []) out.push(x);
  for (const x of S.gcal.gp || []) if (!loc.some(e => e.gpGId === x.gId)) out.push(gpApply(x));
  out.push(...dateEvents());
  return out.sort((a, b) => (a.date + (a.allDay ? '00:00' : a.start)).localeCompare(b.date + (b.allDay ? '00:00' : b.start)));
}
const eventsOn = k => allEvents().filter(e => e.date <= k && (e.endDate || e.date) >= k);
/* The grandparents’ calendar is where all hlídání lives, so an event on it (read from it, or one of ours saved to it) is what makes the girls away, and what gets a drop-off. Nothing about the event’s type. */
/* "Who's going" on the grandparents' calendar is read only for us. An event there that is really about the family (Christmas at the grandparents) can get its
   guest list set here, in Afloat only (home/gpwho), never written to Google. With one of us on it, it is no longer "the girls are away": no drop-off, no hlídání. */
const gpKey = g => String(g || '').replace(/[^A-Za-z0-9_-]/g, '_');
const gpWhoMap = () => H('gpwho').by || {};
function gpApply(x) {
  const o = gpWhoMap()[gpKey(x.gId)]; if (!Array.isArray(o)) return x;
  const who = o.filter(n => everyone().includes(n) || isFriend(n)), fam = who.some(n => adults().includes(n));
  return { ...x, who, ovr: true, ...(fam ? { kind: 'family', famGp: true } : {}) };
}
const inGP = e => (e.src === 'gp' && !e.famGp) || !!e.gpOnly || !!e.gpGId;
const kidsAwayOn = k => { const ks = kidsList(); return ks.length > 0 && eventsOn(k).some(e => inGP(e) && (!(e.who || []).length || ks.every(n => (e.who || []).includes(n))) && (e.allDay || (e.endDate || e.date) > k || !e.end || e.end >= '18:30') && !(e.date === k && !e.allDay && e.start > '20:00')); };
const whoStr = e => (e.who || []).join(', ');
const evTime = e => e.allDay ? (e.endDate && e.endDate !== e.date ? `until ${new Date(e.endDate + 'T12:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}` : 'All day') : (e.endDate && e.endDate !== e.date ? `${e.start} → ${new Date(e.endDate + 'T12:00').toLocaleDateString('en-GB', { weekday: 'short' })} ${e.end}` : `${e.start}${e.end ? '–' + e.end : ''}`);
function evRow(e) {
  return `<li><button class="evrow k-${e.kind}" style="${ecs(e)}" data-act="${e.src === 'gp' ? 'gw-open' : e.src === 'mine' || e.src === 'invite' ? 'noop' : 'ev-open'}" data-id="${esc(e.id || '')}" data-g="${esc(e.gId || '')}">
    <span class="evt">${esc(evTime(e)).replace(' → ', '<br>→ ')}</span><span class="txt"><b>${esc(e.title)}</b><span class="def">${[e.kind === 'mine' ? 'Your own calendar' : '', e.recur || e.master ? '↻ repeats' : '', e.src === 'invite' ? `invitation from ${esc(e.from)} · ${RSVP_ME[e.rsvp] || ''}` : '', e.src === 'gp' ? 'from ' + esc(calCfg().gpName || 'grandparents’ calendar') + (e.rsvp ? ` · invitation from ${esc(e.from)} · ${RSVP_ME[e.rsvp] || ''}` : '') : '', e.place ? esc(e.place) : ''].filter(Boolean).join(' · ')}</span>
    ${(e.who || []).length ? `<span class="dots">${e.who.map(n => `<span class="whochip" style="--c:${pColor(n)}">${esc(n)}</span>`).join('')}</span>` : ''}</span></button></li>`;
}
function dayLabel(k) { const t = dayKey(), d = new Date(k + 'T12:00'), tm = tKey(); return k === t ? 'Today' : k === tm ? 'Tomorrow' : d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }); }
function agendaHtml(days) {
  const evs = allEvents(), start = new Date(dayKey() + 'T12:00'), rows = [];
  for (let i = 0; i < days; i++) { const d = new Date(start); d.setDate(d.getDate() + i); const k = keyOf(d), es = evs.filter(e => e.date <= k && (e.endDate || e.date) >= k && (e.date === k || i === 0 || !e.allDay || e.date === k)).filter(e => i > 0 || notOver(e));
    if (es.length) rows.push(`<div class="aday"><h3>${dayLabel(k)}</h3><ul class="evlist">${es.map(evRow).join('')}</ul></div>`); }
  return rows.join('') || '<p class="empty">Nothing on the calendar for the next weeks.</p>';
}
function whoChip(n) { const on = (S.ui.ev.who || []).includes(n); return `<button type="button" class="whochip pick${on ? ' on' : ''}" style="--c:${pColor(n)}" data-act="ev-who" data-n="${esc(n)}" aria-pressed="${on}">${esc(n)}</button>`; }
const okEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
function addFriend(name, rel, email) {
  name = String(name || '').trim(); if (!name) return false;
  if (everyone().includes(name)) return true;
  const o = { ...H('profiles') };
  if (isFriend(name)) { if (email) { o.friends = friendsL().map(f => f.name === name ? { ...f, email } : f); saveHome('profiles', o); } return true; }
  o.friends = [...friendsL(), { id: uid(), name, rel: String(rel || '').trim(), email: email || '', color: PCOLORS[friendsL().length % PCOLORS.length] }]; saveHome('profiles', o); return true;
}
/* Google invitations: only friends with a saved Google account, only to the event on the family calendar */
const guestsOf = ev => ev.invite === false ? [] : [...(ev.who || []).filter(n => isFriend(n) && pInfo(n).email).map(n => ({ name: n, email: pInfo(n).email })), ...(ev.extraGuests || []).map(m => ({ name: m, email: m }))].filter((g, i, a) => a.findIndex(x => x.email.toLowerCase() === g.email.toLowerCase()) === i);
const RSVP = { accepted: ['✓', 'going'], declined: ['✕', 'can’t come'], tentative: ['?', 'maybe'], needsAction: ['…', 'no reply yet'] };
function guestReplies(ev) {
  const gs = ev.guests || []; if (!gs.length) return '';
  return `<p class="small guests"><b>Guests in Google:</b> ${gs.map(g => { const f = friendsL().find(x => (x.email || '').toLowerCase() === g.email), r = RSVP[g.status] || RSVP.needsAction;
    return `<span class="rsvp rsvp-${esc(g.status)}">${esc(f ? f.name : g.name || g.email)} <i>${r[0]} ${r[1]}</i></span>`; }).join('')}</p>`;
}
function inviteBox(ev) {
  const fr = (ev.who || []).filter(isFriend), xg = ev.extraGuests || []; if (!fr.length && !xg.length) return guestReplies(ev) ? `<div class="invbox">${guestReplies(ev)}</div>` : '';
  const withE = [...fr.filter(n => pInfo(n).email), ...xg], without = fr.filter(n => !pInfo(n).email), was = ev.invited || [];
  if (!calCfg().calId || !mcp) return withE.length ? '<p class="muted small">Invitations go out once Afloat can reach the shared Google calendar.</p>' : '';
  return `<div class="invbox">${withE.length ? `<label class="small" style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" id="evInv" data-act="ev-inv" ${ev.invite !== false ? 'checked' : ''}> <span>Send Google Calendar invitations to <b>${withE.map(n => esc(n) + (was.includes(pInfo(n).email || n) ? ' (already invited)' : '')).join(', ')}</b></span></label>
    <p class="muted small">They get an email and see this event in their calendar: the title, time, place, notes and who else is going. Nothing else from your calendar. Untick someone above to take them off the guest list.</p>` : ''}
    ${without.length ? `<p class="muted small">No invitation for ${without.map(esc).join(', ')}: no Google account saved. Add one under Us → Family.</p>` : ''}${guestReplies(ev)}</div>`;
}
/* ---------- reading Google events: who is going, from the title and description ---------- */
function nameIn(t, n) { const s = n.toLowerCase(); if (!isFriend(n) && s.length >= 3) return t.includes(s); return s.length > 0 && new RegExp(`(^|[^\\p{L}])${reEsc(s)}($|[^\\p{L}])`, 'u').test(t); }
function whoIn(text) { const t = String(text || '').toLowerCase(); return [...everyone(), ...friendNames().filter(n => !everyone().includes(n))].filter(n => nameIn(t, n)); }
function guessKind(t) { t = String(t || '').toLowerCase(); return /zub|lékař|doktor|dentist|doctor|očkov|pediatr/.test(t) ? 'doctor' : /školk|kindergarten|ms /.test(t) ? 'kinder' : /babič|babi|grandma|děda/.test(t) ? 'grandma' : /hlídání|hlidani|babysit|chůva/.test(t) ? 'sitter' : /výlet|trip|zoo|outing/.test(t) ? 'outing' : 'family'; }
function normG(e) {
  const s = e.start || {}, en = e.end || {}, allDay = !!s.date;
  let date, endDate, start = '', end = '';
  if (allDay) { date = String(s.date).slice(0, 10); const x = new Date(String(en.date || s.date).slice(0, 10) + 'T12:00'); x.setDate(x.getDate() - 1); endDate = keyOf(x) < date ? date : keyOf(x); }
  else { const a = new Date(s.dateTime), b = new Date(en.dateTime || s.dateTime); date = keyOf(a); endDate = keyOf(b); start = hm(a); end = hm(b); }
  const st = stripWho(e.summary || ''), pd = parseDesc(e.description || ''), c = calCfg();
  const guests = (e.attendees || []).filter(a => !a.resource && !a.organizer && a.email !== c.calId && a.email !== c.gpId).map(a => ({ email: String(a.email || '').toLowerCase(), name: a.displayName || '', status: a.responseStatus || 'needsAction' }));
  const org = String(((e.organizer || {}).self ? '' : (e.organizer || {}).email) || '').toLowerCase(), fr = friendsByEmail([...guests.map(g => g.email), org].filter(Boolean));
  const named = [...st.who, ...pd.who].filter(n => everyone().includes(n) || isFriend(n));
  const who = uniq([...(named.length ? named : whoIn((e.summary || '') + ' ' + (e.description || ''))), ...fr]);
  const hhE = hhEmails(), frE = new Set(friendsL().map(f => String(f.email || '').toLowerCase()).filter(Boolean));
  const extraGuests = guests.map(g => g.email).filter(m => m && !hhE[m] && !frE.has(m));
  const gperm = { guestsCanModify: !!e.guestsCanModify, guestsCanInviteOthers: e.guestsCanInviteOthers !== false, guestsCanSeeGuests: e.guestsCanSeeOtherGuests !== false };
  return { extraGuests, gperm, gId: e.id, title: st.title || '(no title)', date, endDate, allDay, start, end, place: e.location || '', notes: pd.notes, link: e.htmlLink || '', who, named: named.length > 0, colorId: e.colorId ? String(e.colorId) : '', updated: e.updated || '', master: e.recurringEventId || '', free: e.transparency === 'transparent' || e.availability === 'AVAILABILITY_FREE', vis: e.visibility && e.visibility !== 'default' ? e.visibility : '', meetUrl: e.hangoutLink || ((((e.conferenceData || {}).entryPoints || []).find(x => x.entryPointType === 'video')) || {}).uri || '', guests, invited: guests.map(g => g.email).filter(m => friendsL().some(f => (f.email || '').toLowerCase() === m)) };
}
function decodeHtml(t) { const x = document.createElement('textarea'); x.innerHTML = String(t || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li)>/gi, '\n').replace(/<[^>]+>/g, ''); return x.value; }
/* Afloat writes "Title · Eva, Tom" and a "Who:" line; reading back strips them again */
function stripWho(summary) {
  const m = /^(.*?)\s·\s([^·]+)$/.exec(summary || ''); if (!m) return { title: summary || '', who: [] };
  const names = m[2].split(',').map(x => x.trim()).filter(Boolean);
  return names.length && names.every(n => everyone().includes(n) || isFriend(n)) ? { title: m[1].trim(), who: names } : { title: summary, who: [] };
}
function parseDesc(d) {
  let who = []; const rest = [];
  for (const l of decodeHtml(d).split('\n')) { const t = l.trim(), m = /^(who|kdo):\s*(.*)$/i.exec(t);
    if (m) { who = m[2].split(',').map(x => x.trim()).filter(Boolean); continue; }
    if (/^(added from afloat|\(z familywall\)|\(afloat\))$/i.test(t)) continue;
    rest.push(l); }
  return { who, notes: rest.join('\n').trim() };
}
/* ---------- taps on this area's buttons (data-act), called from events.js; true = handled ---------- */
function tapCalendarSync(a, el, e, r) {
  switch (a) {
    case 'ev-who': { const w = S.ui.ev.who || [], n = el.dataset.n; S.ui.ev.who = w.includes(n) ? w.filter(x => x !== n) : [...w, n]; render(true); return true; }
  }
  return false;
}
