/* Afloat · app/our-days.js · Our days: drop-offs, pick-ups, evenings, bedtime, the hard moments, gigs.
   Plain script: shares one scope with the other app/*.js files (loaded in order by index.html). See CLAUDE.md. */
/* ---------- our days: drop-offs, pick-ups, evenings, bedtime and the hard moments ----------
   The baseline is the Home project doc claude/our-days.md. Per day (plans/<date>.situ): kids (who goes to kindergarten,
   all by default), drop / lunch / pick / bed (who does it, worked out below), eve[name] ('home' | 'out' | 'night') and
   start[name] (a later start at work). Every kindergarten day: home/week.kidPick (usual pick-up time per girl) and
   home/week.kidPlace (where each girl goes). An evening event of yours in the calendar means you're out; one that runs
   past 4:00 the next morning means you're away overnight. Then the other adult has pick-up and bedtime. */
const adults = () => members().map(m => m.name);
const fixedAdult = () => adults().find(n => !isFlex(n)) || null;
const flexAdult = () => adults().find(n => isFlex(n)) || null;
const kidPick = () => H('week').kidPick || {};
const kidPlace = () => H('week').kidPlace || {};
const kidsIn = k => { if (girlsAt(k) !== 'kinder') return []; const s = situOf(k).kids; return kidsList().filter(x => !s || s.includes(x)); };
const kidsStay = k => girlsAt(k) === 'kinder' ? kidsList().filter(x => !kidsIn(k).includes(x)) : [];
const pickOf = x => kidPick()[x] || (kinderWin() || [])[1] || '15:30';
const lunchKid = x => toMin(pickOf(x)) < 14 * 60;
const kidTravel = x => travelOf({ place: kidPlace()[x] || x }).m;
const KINDER_SHUT = /pr[aá]zdnin|zav[rř]en|ředitelsk|reditelsk|kindergarten closed|closed/i;
/* an all-day event like "Prázdniny ve školce" or "Ředitelské volno" makes it a day without kindergarten */
function kinderClosed(k) { const e = eventsOn(k).find(e => e.allDay && KINDER_SHUT.test(e.title || '') && (!(e.who || []).length || (e.who || []).some(n => kidsList().includes(n)))); return e ? shortTitle(e.title) : ''; }
function eveEvents(n, k) {
  const edge = tsOf(k, '18:00'), dayEnd = tsOf(calAdd(k, 1), '00:00');
  /* an event that began on an earlier day and is still going in the evening counts too (a date weekend, a trip) */
  return eventsOn(k).filter(e => !e.allDay && e.start && (e.who || []).includes(n) && !kidsOn(e).length && !inGP(e) && !e.free && !placeIsHome(e.place) && (e.date < k || (e.date === k && toMin(e.start) >= 14 * 60)) && evSpan(e)[1] > edge && evSpan(e)[0] < dayEnd)
    .sort((a, b) => evSpan(a)[0] - evSpan(b)[0]);
}
const EVE_LBL = { home: 'Home', out: 'Out', night: 'Away overnight' };
function eveAt(n, k) {
  if (!n) return 'home';
  const o = (situOf(k).eve || {})[n]; if (o) return o;
  const ev = eveEvents(n, k); if (!ev.length) return 'home';
  return ev.some(e => evSpan(e)[1] > tsOf(calAdd(k, 1), '04:00')) ? 'night' : 'out';
}
/* leave and back for a work day; a later start (up to 9:00) moves both, and after 7:00 the drive is up to 1.5 h */
function dayHours(n, k = dk) {
  const p = prof(n); if (!p.leave) return null;
  const st = (situOf(k).start || {})[n]; if (!st || isFlex(n)) return [p.leave, p.back || ''];
  const base = p.start ? toMin(p.start) : toMin(p.leave) + 45, d = toMin(st) - base; let lv = toMin(p.leave) + d;
  if (lv >= 7 * 60) lv = Math.min(lv, toMin(st) - 95);
  return [mm2t(lv), p.back ? mm2t(toMin(p.back) + d) : ''];
}
function dropBy(k) { if (!kidsIn(k).length) return null; return situOf(k).drop || flexAdult() || adults().find(n => !notHere(meAt(n, k))) || adults().find(n => prof(n).dropsOff) || null; }
function lunchBy(k) { if (!kidsIn(k).some(lunchKid)) return null; return situOf(k).lunch || flexAdult() || dropBy(k); }
/* the fixed-hours adult picks up on the way home, unless they have an evening out (they don't come home first) or get back too late */
function pickBy(k) {
  const late = kidsIn(k).filter(x => !lunchKid(x)); if (!late.length) return null;
  if (situOf(k).pick) return situOf(k).pick;
  const fx = fixedAdult(), close = toMin((kinderWin() || [])[1] || '16:00');
  if (fx && eveAt(fx, k) === 'home') { const h = meAt(fx, k) === 'out' ? dayHours(fx, k) : null; if (!h || !h[1] || toMin(h[1]) - 15 <= close) return fx; }
  return flexAdult() || fx;
}
/* the fixed-hours adult does bedtime whenever they're home in the evening */
function bedBy(k) {
  if (kidsAwayOn(k) || girlsAt(k) === 'grandma') return null;
  if (situOf(k).bed) return situOf(k).bed;
  const fx = fixedAdult(); if (fx && eveAt(fx, k) === 'home') return fx;
  return adults().find(n => eveAt(n, k) === 'home') || flexAdult();
}
/* tonight's tag team: what you picked, or bedtime from the calendar and closing duties for the other one at home */
function tagOf() {
  const t0 = S.day.tag || {}; if (t0.kids || t0.close || !meValid()) return t0;
  const bb = bedBy(dk), o = bb && othersOf(bb).find(n => eveAt(n, dk) === 'home'); return bb ? { kids: bb, close: o || null } : {};
}
function dropPlan(k) { const ins = [...kidsIn(k)].sort((a, b) => kidTravel(a) - kidTravel(b)); const n = dropBy(k); return { ins, lv: (n && ((dayHours(n, k) || [])[0] || prof(n).leave)) || '07:40' }; }
/* the extra lines for the day's facts */
function ourDayFacts(k) {
  if (!meValid() || !kidsList().length) return [];
  const out = [], isT = k === dk, other = otherOf(me), g = girlsAt(k), ins = kidsIn(k), stay = kidsStay(k), day = isT ? 'today' : 'tomorrow';
  if (g === 'kinder' && stay.length) out.push({ t: `${stay.join(' and ')} stays home ${day}; ${ins.join(' and ')} goes to kindergarten.` });
  if (dropBy(k) === me && ins.length) { const dp = dropPlan(k); out.push({ t: `Drop-off: leave around ${dp.lv}${dp.ins.length > 1 ? ` (${dp.ins.join(' first, then ')})` : ` with ${dp.ins[0]}`}${meAt(me, k) === 'wfh' ? ', then the time until pick-up is yours to work' : ''}.` }); }
  if (lunchBy(k) === me) for (const x of ins.filter(lunchKid)) out.push({ t: `${x}’s pick-up after lunch, around ${pickOf(x)}: leave by ${mm2t(toMin(pickOf(x)) - kidTravel(x) - 5)}.` });
  const late = ins.filter(x => !lunchKid(x)), pb = pickBy(k), bb = bedBy(k), pt = late.length ? mm2t(Math.min(...late.map(x => toMin(pickOf(x))))) : '';
  if (late.length && pb === me) out.push({ t: `Pick-up: ${late.join(' and ')} around ${pt}${meAt(me, k) === 'out' ? ', on your way home' : ''}. Check the notice board while you’re there.` });
  const ee = eveAt(me, k), oe = other ? eveAt(other, k) : 'home';
  if (other && oe !== 'home' && ee === 'home') { const mine = [late.length && pb === me ? 'pick-up' : '', bb === me ? 'bedtime' : ''].filter(Boolean);
    out.push({ t: `${other} is ${oe === 'night' ? 'away overnight' : 'out in the evening'} ${day}${mine.length ? `, so ${mine.join(' and ')} ${mine.length > 1 ? 'are' : 'is'} yours` : ''}.` }); }
  if (ee === 'night') out.push({ t: `You’re away overnight ${isT ? 'tonight' : 'tomorrow night'}${!isFlex(me) ? ': take the next day’s work things with you' : ''}.` });
  else if (ee === 'out') { const f = eveEvents(me, k)[0]; out.push({ t: `You’re out ${isT ? 'this' : 'tomorrow'} evening${f && f.date === k ? ` from ${f.start}` : ''}${bb && bb !== me ? `; ${bb} has bedtime` : ''}.` }); }
  return out;
}
/* drop-offs and pick-ups become outings of their own: leave time, travel, weather and what to take */
function routineOutings(k, n) {
  if (!n) return [];
  const out = [], mk2 = (id, o) => ({ id: `rt-${id}-${k}`, date: k, endDate: k, kind: 'kinder', virt: true, ...o });
  /* taking the girls to the grandparents (a timed event with a place, no adult on it): the freelance adult drives them */
  for (const g of eventsOn(k).filter(e => inGP(e) && e.date === k && !e.allDay && e.start && e.place && !(e.who || []).some(x => adults().includes(x)))) {
    if ((flexAdult() || adults()[0]) !== n) continue;
    out.push(mk2('gp-' + placeKey(g.gId || g.id || g.start), { title: 'Girls to the grandparents', kind: 'outing', kit: 'grandma', who: [n, ...((g.who || []).filter(x => kidsList().includes(x)).length ? g.who.filter(x => kidsList().includes(x)) : kidsList())], start: g.start, end: mm2t(toMin(g.start) + 15), place: g.place, notes: g.notes || '' }));
  }
  if (girlsAt(k) !== 'kinder') return out;
  const ins = kidsIn(k), stay = kidsStay(k);
  if (dropBy(k) === n && ins.length) {
    const { ins: ord, lv } = dropPlan(k), first = kidTravel(ord[0]), extra = ord.length > 1 ? Math.max(5, kidTravel(ord[ord.length - 1]) - first) + 10 : 10;
    out.push(mk2('drop', { title: `Drop-off (${ord.join(', then ')})`, kit: 'dropoff', who: [n, ...ord, ...stay], kidsIn: ord, leave: lv, travel: first, start: mm2t(toMin(lv) + first), end: mm2t(toMin(lv) + first + extra), place: kidPlace()[ord[0]] || '' }));
  }
  if (lunchBy(k) === n) for (const x of ins.filter(lunchKid)) out.push(mk2('lunch-' + placeKey(x), { title: `${x}’s pick-up`, kit: 'pickup', who: [n, ...stay], kidsIn: [], start: pickOf(x), end: mm2t(toMin(pickOf(x)) + 15), place: kidPlace()[x] || '' }));
  const late = ins.filter(x => !lunchKid(x));
  if (late.length && pickBy(k) === n) {
    const t = mm2t(Math.min(...late.map(x => toMin(pickOf(x))))), fromWork = meAt(n, k) === 'out' && !isFlex(n), along = fromWork ? [] : [...stay, ...ins.filter(lunchKid)];
    out.push(mk2('pick', { title: `Pick-up (${late.join(' and ')})`, kit: 'pickup', who: [n, ...along], kidsIn: [], start: t, end: mm2t(toMin(t) + 15), place: kidPlace()[late[0]] || '', ...(fromWork ? { noLeave: true, leave: mm2t(toMin(t) - 10) } : {}) }));
  }
  return out;
}
const isGig = e => modOn('gigs') && (e.kind === 'gig' || /focen|fotit|photo ?shoot|shooting/i.test(e.title || ''));
/* getting out of the door in small steps, starting earlier when the girls come along */
const readySteps = e => (kits().ready || {})[kidsOn(e).length ? 'kids' : 'self'] || [];
/* "Leaving soon" (9 Nov 2026): for the last 45 minutes before you leave (30 or 60 in Settings → Phone reminders) the outing
   moves to the very top of Today with a live countdown, the small steps, and the take-along list. The steps and the
   "start getting ready" phone nudge follow the same lead. */
const RUN_LEADS = [30, 45, 60];
const runLead = (n = me) => { const v = +prof(n).runLead; return RUN_LEADS.includes(v) ? v : 45; };
const readyLead = (e, n) => e.noLeave ? 0 : (kidsOn(e).length || +prof(n).readyEarly) ? runLead(n) : 0;
const dayBase = k => new Date(k + 'T00:00:00').getTime();
const leftOn = e => isDone((S.day.done || {})['left:' + outId(e)]); /* "We're on our way" was tapped */
function runOuting(n = me) {
  if (!meValid() || sickOn()) return null;
  const nm = nowMin(), lead = runLead(n);
  return outingsOn(dk, n).find(e => !e.noLeave && e.date === dk && !leftOn(e) && nm >= leaveAt(e) - lead && nm <= leaveAt(e) + 5) || null;
}
const nextReadyStep = e => readySteps(e).find(x => !isDone((S.day.done || {})[`rd:${outId(e)}:${x.id}`]));
/* The run-up, drawn (10 Nov 2026). Everything is worked out from the clock in seconds, so the big countdown, the bar, the
   one gentle line and the label always agree (they used to mix whole minutes and seconds, so "Leave in 6 min" sat above 5:03).
   The bar FILLS toward "go" as time passes, turns amber for the last five minutes, and stays full (counting how far past)
   if you are a little late. lrTick() redraws just these bits every second, with no page redraw. */
const lrSec = at => Math.ceil((at - Date.now()) / 1000);
const lrPhase = s => s <= 0 ? 'late' : s <= 300 ? 'soon' : 'calm';
const lrTime = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const lrCount = s => s <= 0 ? 'Go' : lrTime(s);
const lrLab = (s, t) => s > 0 ? `${s >= 60 ? 'min' : 'sec'} until you leave at ${t}` :`${lrTime(-s)} past ${t}, and that’s okay`;
const lrAria = s => s > 0 ? `${Math.ceil(s / 60)} minutes until you leave` : 'Time to leave';
function lrMsg(s, lead) {
  const m = s / 60;
  return s <= 0 ? 'Time to go. Leaving a little late is okay.' : m > lead * 2 / 3 ? 'Plenty of time. Start with the first step; there’s no rush.' : m > 15 ? 'Halfway. One small step at a time, in any order.' : m > 5 ? 'Nearly time. Whatever isn’t done can ride along in the car.' : 'Almost go time: phone, keys, then out of the door.';
}
const lrPct = (at, lead) => Math.max(0, Math.min(100, 100 - (at - Date.now()) / 6e4 / lead * 100));
/* the bar on its own (Leaving soon, and the calm Today "Next" card): lead minutes long, ticks at the thirds */
function leaveStrip(at, lead) {
  const s = lrSec(at), lb = (p, t) => `<span style="left:${p}%">${t}</span>`;
  return `<div class="tstrip lr-strip" data-at="${at}" data-span="${lead}" data-ph="${lrPhase(s)}" role="img" aria-label="${lrAria(s)}"><div class="tstrip-bar"><i style="width:${lrPct(at, lead).toFixed(1)}%"></i></div><div class="tstrip-ticks" aria-hidden="true">${lb(0, `${lead} min left`)}${lb(33.33, Math.round(lead * 2 / 3))}${lb(66.67, Math.round(lead / 3))}${lb(100, 'go')}</div></div>`;
}
/* the countdown, the bar, one gentle line for where you are in it, and a way to say you've set off */
function runStrip(e, n) {
  const la = leaveAt(e), lead = runLead(n), at = dayBase(e.date) + la * 6e4, nx = readyLead(e, n) > 0 ? nextReadyStep(e) : null, s = lrSec(at), t = mm2t(la);
  return `<div class="lr-top"><span class="lr-count" data-at="${at}" aria-hidden="true">${lrCount(s)}</span><span class="lr-lab" data-at="${at}" data-t="${t}">${lrLab(s, t)}</span></div>
    ${leaveStrip(at, lead)}
    <p class="small lr-msg"><b class="lr-phase" data-at="${at}" data-lead="${lead}">${lrMsg(s, lead)}</b>${nx ? ` Next small step: ${esc(nx.text)}.` : ''}</p>
    <div class="actions"><button class="btn" data-act="go-leaving" data-id="${outId(e)}">${kidsOn(e).length ? 'We’re on our way' : 'I’m on my way'}</button></div>`;
}
function lrTick() {
  const put = (el, v) => { if (el.textContent !== v) el.textContent = v; };
  for (const el of document.querySelectorAll('.lr-count[data-at]')) put(el, lrCount(lrSec(+el.dataset.at)));
  for (const el of document.querySelectorAll('.lr-lab[data-at]')) put(el, lrLab(lrSec(+el.dataset.at), el.dataset.t));
  for (const el of document.querySelectorAll('.lr-phase[data-at]')) put(el, lrMsg(lrSec(+el.dataset.at), +el.dataset.lead));
  for (const el of document.querySelectorAll('.lr-strip[data-at]')) {
    const at = +el.dataset.at, s = lrSec(at), i = el.querySelector('i'), w = lrPct(at, +el.dataset.span).toFixed(1) + '%';
    if (i && i.style.width !== w) i.style.width = w;
    if (el.dataset.ph !== lrPhase(s)) el.dataset.ph = lrPhase(s);
    if (el.getAttribute('aria-label') !== lrAria(s)) el.setAttribute('aria-label', lrAria(s));
  }
}
setInterval(() => { if (!document.hidden) lrTick(); }, 1000); /* nothing to see while Afloat is in the background */
document.addEventListener('visibilitychange', () => { if (!document.hidden) lrTick(); }); /* and catch up the moment you come back */
window.addEventListener('pageshow', lrTick);
function readyHtml(e, n, top) {
  const R = readySteps(e), lead = readyLead(e, n); if (!R.length || !lead || e.date !== dk) return '';
  const la = leaveAt(e), st = la - lead, nm = nowMin(); if (!top && (nm < st - 30 || nm > la + 5)) return '';
  return `<div class="ready"><p class="small"><b>${nm < st ? `Start getting ready at ${mm2t(st)}` : 'Getting out of the door'}</b> <span class="muted">· one small step at a time${kidsOn(e).length ? '; transitions with the girls take longer, and that’s normal' : ''}</span></p>${checklist(`rd:${outId(e)}`, R)}</div>`;
}
/* things done once a season (winter overalls in, winter overalls home) are ticked for that season, not each day */
const monthsApart = (a, b) => { const [y1, m1] = a.split('-').map(Number), [y2, m2] = b.split('-').map(Number); return (y2 * 12 + m2) - (y1 * 12 + m1); };
const onceOn = id => { const v = (kits().onceDone || {})[id]; return !!v && monthsApart(v, mk) <= 4; };
const onceOld = id => onceOn(id) && (kits().onceDone || {})[id] !== mk;
function onceList(items) {
  if (!items.length) return '';
  return `<ul class="checks">${items.map(it => { const on = onceOn(it.raw); return `<li><button class="check${on ? ' on' : ''}" data-act="go-once" data-id="${esc(it.raw)}" aria-pressed="${on}"><span class="box" aria-hidden="true">${I.check}</span><span class="txt">${esc(it.text)}<span class="def">Once this season</span></span></button></li>`; }).join('')}</ul>`;
}
/* evening prep that follows from tomorrow's calendar */
function autoPrep(k) {
  if (!meValid()) return [];
  const out = [], add = (id, text) => out.push({ id: 'ap-' + id, text }), evs = eventsOn(k).filter(e => e.date === k);
  if (evs.some(e => isGig(e) && ((e.who || []).includes(me) || e.src === 'mine'))) { add('bat', 'Charge the spare camera batteries'); add('sd', 'Format the SD cards on the computer'); add('lens', 'Pick the lenses, and pack the microfibre cloth'); }
  if (kidsList().length && !kidsAwayOn(calAdd(k, -1)) && (girlsAt(k) === 'grandma' || evs.some(inGP)) && !evs.some(e => inGP(e) && e.place && !e.allDay)) { add('gpc', 'Pack the girls’ clothes for the grandparents'); add('gpv', 'Pack the vysílačka'); }
  if (k === tk && eveAt(me, dk) === 'night' && leavesHome(me, tk)) add('night', 'Pack tomorrow’s work things to take with you tonight');
  return out;
}
function remindCard() { return remCard(false); }
const remindEditor = () => remEditor();
/* bedtime from Večerníček on, for whoever has it tonight */
function bedtimeCard() {
  if (!meValid() || sickOn() || bedBy(dk) !== me) return '';
  const bt = H('week').bedtime || '18:45', nm = nowMin(); if (nm < toMin(bt) - 45 || nm > toMin(bt) + 150) return '';
  const L = H('lists').bedtime || []; if (!L.length && !S.ui.edit.bedtime) return '';
  const g = girlsAt(tk), tmr = g === 'kinder' ? `Kindergarten tomorrow${kidsStay(tk).length ? ` (${kidsIn(tk).join(' and ')})` : ''}` : g === 'grandma' ? 'Grandparents tomorrow' : 'No kindergarten tomorrow';
  return `<section class="card bedtime"><div class="sec-head"><h2>Bedtime</h2><span class="progress">${countDone('bt', L)} of ${L.length}</span></div>
    <p class="muted small">${ourHome() ? 'Večerníček' : 'Bedtime starts'} at ${esc(bt)}${ourHome() ? ', then upstairs' : ''}. ${tmr}.</p>${wxToday(tk)}
    ${S.ui.edit.bedtime ? editList('lists', 'bedtime', L, 'Add a bedtime step') : checklist('bt', L)}<div class="chips">${editBtn('bedtime')}</div></section>`;
}
/* a gentle check-in in the afternoon dip (prof.dip, e.g. 14:00-17:00), only while you're home */
const DIP_OPTS = [['snack', 'A snack and a big glass of water'], ['rest', 'Ten quiet minutes (a show for the girls is fine)'], ['easy', 'Something easy with the girls: drawing, a bath, a story'], ['air', 'Five minutes in the garden']];
/* the afternoon-dip ideas, worded for whoever is home: the kids by name or none at all */
const dipOpts = () => DIP_OPTS.filter(o => kidsList().length || !/the girls/.test(o[1]) || o[0] === 'rest').map(([v, l]) => [v, kidsList().length ? l.replace(/the girls/g, theKids()) : l.replace(' (a show for the girls is fine)', '')]);
function dipCard() {
  if (!meValid() || sickOn()) return '';
  const w = /^(\d\d:\d\d)\s*-\s*(\d\d:\d\d)$/.exec(prof(me).dip || ''), nm = nowMin(); if (!w || nm < toMin(w[1]) || nm >= toMin(w[2]) || awayNow()) return '';
  const pick = (S.day.dip || {})[me];
  if (pick) return `<section class="card dip"><p class="small"><b>Afternoon dip:</b> ${esc((dipOpts().find(o => o[0] === pick) || [])[1] || '')}. Good call. <button class="link" data-act="dip" data-v="">Something else</button></p></section>`;
  return `<section class="card dip"><div class="sec-head"><h3>The afternoon dip</h3></div><p class="muted small">Energy usually drops about now${nm >= 16 * 60 ? ', and this is the hardest stretch' : ''}. That’s the brain, not you. Pick one small thing:</p>
    <div class="chips">${dipOpts().map(([v, l]) => `<button class="tiny" data-act="dip" data-v="${v}">${l}</button>`).join('')}<a class="tiny" href="#support">More help</a></div></section>`;
}
/* the other adult coming home from work is a transition too: a heads-up from 40 minutes before */
function homecomingCard() {
  if (!meValid()) return '';
  const o = otherOf(me); if (!o || isFlex(o) || meAt(o, dk) !== 'out' || eveAt(o, dk) !== 'home' || awayNow()) return '';
  const h = dayHours(o, dk); if (!h || !h[1]) return '';
  const b = toMin(h[1]), nm = nowMin(); if (nm < b - 40 || nm > b + 5) return '';
  const late = kidsIn(dk).filter(x => !lunchKid(x)), withK = pickBy(dk) === o && late.length ? ` with ${late.join(' and ')}` : '';
  const s = (H('signals') || {})[me], on = s && s.until > Date.now();
  return `<section class="card homecoming"><div class="sec-head"><h3>${esc(o)} is home around ${esc(h[1])}${esc(withK)}</h3></div>
    <p class="muted small">Someone coming in is a change too. Finish or park what you’re doing now, so it doesn’t get cut off in the middle.</p>
    <div class="chips">${on ? '<span class="muted small">Your signal is on.</span>' : `<button class="tiny" data-act="hc-sig">I’ll need 20 minutes to myself when ${esc(o)}’s in</button>`}<button class="tiny" data-act="capture">Park it in the brain dump</button></div></section>`;
}
/* after a photo gig: how many photos, then a culling and editing task sized to it on your own Trello list.
   Rough pace: culling ~600 photos an hour, editing and export ~120 an hour, so about an hour per 100 photos. */
const gigId = e => placeKey(`${e.gId || e.id || e.title}-${e.date}`).slice(0, 60);
const gigEst = n => ({ cull: n / 600, edit: n / 120, total: n / 600 + n / 120 });
const hrsTxt = h => h < 1 ? `${Math.max(5, Math.round(h * 12) * 5)} min` : `${Math.round(h * 2) / 2} h`;
function gigsToSort() {
  if (!meValid()) return [];
  const G = H('gigs').done || {}, out = [];
  for (let i = 0; i <= 4; i++) { const k = calAdd(dk, -i); for (const e of eventsOn(k)) if (e.date === k && isGig(e) && ((e.who || []).includes(me) || e.src === 'mine') && !notOver(e) && !G[gigId(e)] && !out.some(x => gigId(x) === gigId(e))) out.push(e); }
  return out;
}
function gigCard() {
  const gs = gigsToSort(); if (!gs.length) return '';
  const e = gs[0], id = gigId(e), n = +((S.ui.gigN || {})[id] || 0), est = n > 0 ? gigEst(n) : null, my = (H('trello').people || {})[me];
  return `<section class="card gig"><div class="sec-head"><h3>After ${esc(shortTitle(e.title))}</h3><span class="progress">${fmtD(e.date)}</span></div>
    <p class="muted small">How many photos are there to get through? Afloat makes one culling and editing task, sized to the count.</p>
    <div class="addform"><input type="number" inputmode="numeric" min="1" id="gigN_${id}" data-act="gig-n" data-id="${id}" value="${n || ''}" placeholder="Number of photos" aria-label="Number of photos"><label class="small">Deliver by <input type="date" id="gigDue_${id}" data-act="gig-due" data-id="${id}" value="${esc((S.ui.gigDue || {})[id] || calAdd(e.date, 14))}"></label></div>
    ${est ? `<p class="small">About <b>${hrsTxt(est.total)}</b>: culling ~${hrsTxt(est.cull)}, editing and export ~${hrsTxt(est.edit)}. That’s ${Math.max(1, Math.ceil(est.total / 2))} session${Math.ceil(est.total / 2) > 1 ? 's' : ''} of about two hours.</p>` : ''}
    <div class="actions">${my && mcp ? `<button class="btn accent" data-act="gig-make" data-id="${id}" ${est && !S.ui.gigBusy ? '' : 'disabled'}>${S.ui.gigBusy ? 'Making it…' : 'Make the task'}</button>` : '<span class="muted small">Connect Trello and pick your own list to make the task.</span>'}<button class="link" data-act="gig-skip" data-id="${id}">Nothing to edit</button></div></section>`;
}
async function gigMake(id) {
  const e = gigsToSort().find(x => gigId(x) === id), n = +((S.ui.gigN || {})[id] || 0), my = (H('trello').people || {})[me];
  if (!e || !n || !my || !mcp || S.ui.gigBusy) return;
  const est = gigEst(n), due = (S.ui.gigDue || {})[id] || calAdd(e.date, 14), t = shortTitle(e.title);
  const steps = [], cs = Math.max(1, Math.ceil(est.cull / 2)), es = Math.max(1, Math.ceil(est.edit / 2));
  for (let i = 1; i <= cs; i++) steps.push(`Cull${cs > 1 ? `, part ${i} of ${cs}` : ''} (~${hrsTxt(est.cull / cs)})`);
  for (let i = 1; i <= es; i++) steps.push(`Edit${es > 1 ? `, session ${i} of ${es}` : ''} (~${hrsTxt(est.edit / es)})`);
  steps.push('Export and deliver');
  S.ui.gigBusy = true; render(true);
  try {
    const r = await trCreate(my, `Cull & edit: ${t} (${n} photos)`, dueISO(due), `${n} photos from ${e.title} (${fmtD(e.date)}).\nAbout ${hrsTxt(est.total)} in all: culling ~${hrsTxt(est.cull)}, editing and export ~${hrsTxt(est.edit)}.\nMade by Afloat.`);
    const cid = r && (r.id || (r.card && r.card.id));
    if (cid) { try { const c = await trCall('trelloWriteChecklist', { action: 'create', cardId: cid, name: 'Steps' }), clId = c && (c.id || (c.checklist && c.checklist.id));
      if (clId) for (const s2 of steps) await trCall('trelloWriteChecklist', { action: 'add_item', checklistId: clId, text: s2, pos: 'bottom' }); } catch {} }
    const G = H('gigs'); saveHome('gigs', { ...G, done: { ...(G.done || {}), [id]: { n, card: cid || '', at: Date.now() } } });
    toast(`On your list: ${steps.length} steps, due ${fmtD(due)}.`); trLoad();
  } catch (err) { toast(trMsg(err)); }
  S.ui.gigBusy = false; render(true);
}
/* one-time starting lists for a household with children (home/household.baseline): getting-out-of-the-door steps and a
   bedtime list; pick-up times and places are set in Today's setup. The first household's came from its own notes long ago. */
const BASE_V = 2; let baseSeeding = false;
function baselineSeed() {
  if (baseSeeding || !db || !S.loaded || ourHome() || (H('household').baseline || 0) >= BASE_V || !kidsList().length || !adults().length) return;
  baseSeeding = true; try { baselineSeedNow(); } finally { baseSeeding = false; }
}
function baselineSeedNow() {
  saveHome('household', { ...H('household'), baseline: BASE_V });
  const K0 = kits();
  const ready = K0.ready || { kids: [{ id: 'r1', text: 'Toilet for everyone, you too' }, { id: 'r2', text: 'Shoes and jackets on' }, { id: 'r3', text: 'Bags and water bottles by the door' }, { id: 'r4', text: 'Out of the door' }],
    self: [{ id: 's1', text: 'Shower or a quick wash' }, { id: 's2', text: 'Get dressed' }, { id: 's3', text: 'Bag packed' }, { id: 's4', text: 'Shoes on, out of the door' }] };
  saveHome('kits', { ...K0, ready, seeded: true });
  const L = H('lists');
  if (!(L.bedtime || []).length) saveHome('lists', { ...L, bedtime: [{ id: 'bt1', text: 'Dinner' }, { id: 'bt3', text: 'Help with teeth' }, { id: 'bt4', text: 'Bath or a wash' }, { id: 'bt6', text: 'Pyjamas' }, { id: 'bt7', text: 'A story' }, { id: 'bt8', text: 'Tomorrow’s weather, and lay out their clothes' }] });
  const P = { ...H('people') }, pp = { ...(P.people || {}) };
  for (const n of adults()) { const x = { ...(pp[n] || {}) }; if (x.workStyle === 'flex') { if (!x.dip) x.dip = '14:00-17:00'; if (x.readyEarly == null) x.readyEarly = 30; } pp[n] = x; }
  saveHome('people', { ...P, people: pp });
}
/* ---------- taps on this area's buttons (data-act), called from events.js; true = handled ---------- */
function tapOurDays(a, el, e, r) {
  switch (a) {
    case 'dip': S.day = { ...S.day, dip: { ...(S.day.dip || {}), [me]: el.dataset.v || null } }; mergeDoc('days/' + dk, { dip: { [me]: el.dataset.v || null } }); render(true); return true;
    case 'hc-sig': { const h = dayHours(otherOf(me), dk); setSignal('alone', Math.max(20, (h && h[1] ? toMin(h[1]) : nowMin()) + 20 - nowMin())); return true; }
    case 'go-once': { const K = kits(), od = { ...(K.onceDone || {}) }; if (onceOn(el.dataset.id)) delete od[el.dataset.id]; else { od[el.dataset.id] = mk; toast(CHEERS[Math.floor(Math.random() * CHEERS.length)]); } saveHome('kits', { ...K, onceDone: od }); return true; }
    case 'gig-make': gigMake(el.dataset.id); return true;
    case 'gig-skip': { const G = H('gigs'); saveHome('gigs', { ...G, done: { ...(G.done || {}), [el.dataset.id]: { skip: true, at: Date.now() } } }); return true; }
  }
  return false;
}
