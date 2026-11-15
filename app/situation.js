/* Afloat · app/situation.js · Our week (evenings out, date night) and the day's situation: where the girls are, where each adult is, Today's setup.
   Plain script: shares one scope with the other app/*.js files (loaded in order by index.html). See CLAUDE.md. */
/* ---------- our week: own-time evenings and date night ---------- */
/* evenings come from the calendar (5 Nov 2026): one of you with an evening event of your own is out, so it's a solo evening
   for the other; a "Rande" with both of you, or Wednesday (the date-night day) with nobody out, is date night. d is a weekday,
   0 = Monday, for today or the next six days. */
function evening(d = dow()) {
  const k = calAdd(dk, ((d - dow()) % 7 + 7) % 7);
  if (dateEvOn(k)) return d === relDay() ? { type: 'date' } : null; /* an extra date on another day has its own card on Today */
  const out = members().map(m => m.name).filter(n => eveAt(n, k) !== 'home');
  /* two adults: one out is the other's solo evening. With three or more, a solo evening is when everyone else is out (closingSet) */
  if (out.length === 1 && members().length === 2) return { type: 'away', who: out[0] };
  return !out.length && d === relDay() ? { type: 'date' } : null;
}
/* households of one adult or several (10 Nov 2026): otherOf is "another adult" (the first), others all of them; the
   couple's partner comes from Together (partnerOf); everyone else out tonight = a solo evening for whoever's home */
const otherOf = name => members().map(m => m.name).find(n => n !== name);
const othersOf = name => members().map(m => m.name).filter(n => n !== name);
const partnerOf = name => { const p = relPair(); return p && p.includes(name) ? p.find(n => n !== name) : null; };
const othersOutTonight = (name, k = dk) => { const o = othersOf(name); return o.length > 0 && o.every(n => eveAt(n, k) !== 'home'); };
function eveningCard(ev) {
  if (!ev) return '';
  if (ev.type === 'date' && relPair() && !relPair().includes(me)) return `<section class="card evening"><div class="sec-head"><h2>Date night</h2></div><p>${esc(relPair().join(' and '))} have their evening. Nothing here needs you.</p></section>`;
  if (ev.type === 'date') return `<section class="card evening"><div class="sec-head"><h2>Date night</h2></div><p>Tonight is for the two of you. Closing duties are optional; tomorrow can absorb them.</p>${relPair() ? `<div class="actions">${relDone() ? '<span class="alldone">Check-in done ★</span>' : '<a class="btn accent" href="#together">Start the check-in (15 min)</a>'}</div>${ideasCard(true)}` : ''}${dateListHtml()}</section>`;
  const who = ev.who, solo = othersOf(who).join(' and ') || null;
  if (me && me === who) return `<section class="card evening"><div class="sec-head"><h2>Your own-time evening</h2></div><p>${esc(solo || 'The other adult')} has the girls and the house tonight. Nothing here needs you. Enjoy it.</p></section>`;
  return `<section class="card evening"><div class="sec-head"><h2>Solo evening${solo ? ' for ' + esc(solo) : ''}</h2></div><p>It’s ${esc(who)}’s own time tonight. Doing bedtime alone is a full job, so the closing list shrinks to the solo version and the rhythm is optional.</p>
    <p class="muted small">Protect the evening: no chore texts. Anything that can’t wait goes in the brain dump for tomorrow.</p></section>`;
}
const fmtT = t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
function dueFor(key) {
  const d = new Date();
  if (key === 'tonight') d.setHours(20, 0, 0, 0);
  else if (key === 'tomorrow') { d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); }
  else if (key === 'weekend') { d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7)); d.setHours(9, 0, 0, 0); }
  else if (key === 'week') { d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); d.setHours(9, 0, 0, 0); }
  else return null;
  return d.toISOString();
}
const canTr = () => !!(mcp && H('trello').board);

/* ---------- the day's situation: where the girls are, where each adult is ----------
   Everything that adapts (opening screen, mornings, evening prep, closing duties, hlídání check) asks these. */
function easterSun(y) { const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1; return new Date(y, mo - 1, da, 12); }
const CZ_FIXED = { '01-01': 'New Year’s Day', '05-01': 'Labour Day', '05-08': 'Liberation Day', '07-05': 'Cyril and Methodius', '07-06': 'Jan Hus Day', '09-28': 'Czech Statehood Day', '10-28': 'Independence Day', '11-17': 'Freedom and Democracy Day', '12-24': 'Christmas Eve', '12-25': 'Christmas Day', '12-26': 'St Stephen’s Day' };
function czHoliday(k) {
  const f = CZ_FIXED[k.slice(5)]; if (f) return f;
  const es = easterSun(+k.slice(0, 4)), gf = new Date(es), em = new Date(es); gf.setDate(es.getDate() - 2); em.setDate(es.getDate() + 1);
  return k === keyOf(gf) ? 'Good Friday' : k === keyOf(em) ? 'Easter Monday' : '';
}
const situOf = k => ((k === dk ? S.planT : k === tk ? S.planN : null) || {}).situ || {};
const setSitu = (k, patch) => { const cur = situOf(k), next = { ...cur, ...patch };
  if (k === dk) S.planT = { ...(S.planT || {}), situ: next }; else if (k === tk) S.planN = { ...(S.planN || {}), situ: next };
  mergeDoc('plans/' + k, { situ: next }); render(true); };
const GH_REASONS = [['cold', 'Runny noses'], ['ill', 'Not quite well'], ['holiday', 'Holiday'], ['closed', 'Kindergarten closed'], ['choice', 'Home day'], ['other', 'Other']];
const girlsHomeRange = () => (H('situation').girlsHome || null);
function girlsAwayDay(k) {
  const ks = kidsList(), a = tsOf(k, '10:00'), b = tsOf(k, '15:00');
  return eventsOn(k).some(e => inGP(e) && (!(e.who || []).length || ks.every(n => e.who.includes(n))) && (() => { const [x, y] = evSpan(e); return x <= a && y >= b; })());
}
/* 'kinder' | 'home' (staying home on a kindergarten day) | 'free' (weekend or holiday) | 'grandma' | 'sick' */
function girlsAt(k) {
  if (!kidsList().length) return 'none';
  const o = situOf(k).girls; if (o) return o;
  if (k === dk && sickOn()) return 'sick';
  if (girlsAwayDay(k)) return 'grandma';
  const gh = girlsHomeRange(), dw = (new Date(k + 'T12:00').getDay() + 6) % 7;
  if (dw >= 5 || czHoliday(k) || kinderClosed(k)) return 'free';
  if (gh && gh.from <= k && (gh.until ? gh.until >= k : k <= calAdd(realToday(), 1))) return 'home'; /* open-ended: only today and tomorrow are assumed */
  return kinderWin() ? 'kinder' : 'home';
}
const GIRLS_LBL = { kinder: 'Kindergarten', home: 'Home with us', grandma: 'With grandparents', free: 'Home (no kindergarten)', sick: 'Sick-day mode', none: '' };
/* where each adult is during the day. Fixed hours: 'out' at work · 'home' home with the girls · 'off' home, not working · 'away' away from home (from the calendar).
   Freelance: 'wfh' working time · 'home' home with the girls · 'outkids' out with the girls · 'out' out alone ·
   'off' free without the girls (still work and rest, never a "day off"). From our-days.md, section 11. */
const ME_OPTS = { flex: [['wfh', 'Working time'], ['home', 'Home with the girls'], ['outkids', 'Out with the girls'], ['out', 'Out alone'], ['off', 'Free without the girls']],
  fixed: [['out', 'At work'], ['home', 'Home with the girls'], ['off', 'Home, not working'], ['away', 'Away from home']] };
function meLbl(n, v, k = dk) {
  if (v === 'wfh' && girlsAt(k) === 'kinder' && kidsStay(k).length) return `Working, ${kidsStay(k).join(' and ')} at home`;
  const o = ME_OPTS[isFlex(n) ? 'flex' : 'fixed'].find(x => x[0] === v) || ME_OPTS.flex.find(x => x[0] === v) || ME_OPTS.fixed.find(x => x[0] === v);
  return o ? o[1] : '';
}
const isFlex = n => prof(n).workStyle === 'flex';
/* leaving the house in the morning: for work, or (freelance) for the kindergarten drop-off */
const leavesHome = (n, k) => meAt(n, k) === 'out' || meAt(n, k) === 'outkids' || (dropBy(k) === n && kidsIn(k).length > 0);
/* tagged on a timed event that covers the middle of the day (even one that began yesterday) at a place that isn't home, online or our address;
   no place counts as away too (6 Nov 2026) */
function awayDay(n, k) {
  const a = tsOf(k, '10:00'), b = tsOf(k, '15:00');
  if (pxAwayOn(n, k)) return true;
  return eventsOn(k).some(e => !e.allDay && e.start && !e.free && (e.who || []).includes(n) && !kidsOn(e).length && !inGP(e) && !placeIsHome(e.place) && (() => { const [x, y] = evSpan(e); return x <= a && y >= b; })());
}
const notHere = v => v === 'out' || v === 'away';
function meAt(n, k) {
  const o = situOf(k)[n]; if (o) return o;
  if (k === tk && situOf(dk)[n] && situOf(dk)[n] !== 'out' && girlsAt(dk) === 'home' && girlsAt(tk) === 'home') return situOf(dk)[n]; /* a home stretch carries over */
  const dw = (new Date(k + 'T12:00').getDay() + 6) % 7;
  if (isFlex(n)) { const g = girlsAt(k); return g === 'grandma' ? 'off' : g === 'kinder' ? 'wfh' : 'home'; } /* freelance: work fits around the girls */
  if (workday(n, dw) && !czHoliday(k)) return 'out'; /* a date the night before means straight to work */
  return awayDay(n, k) ? 'away' : 'off';
}
const workWin = (n, k = dk) => { const h = dayHours(n, k); return !isFlex(n) && h && h[0] && h[1] ? h : null; };
/* items can say when they apply; untagged items that mention kindergarten only show on kindergarten days */
const WHEN = [['', 'Always'], ['kinder', 'Kindergarten days'], ['home', 'Girls-at-home days'], ['out', 'When I head out'], ['in', 'When I’m home']];
const whenOf = it => it.when !== undefined ? it.when : /kindergarten|školk/i.test(it.text || '') ? 'kinder' : '';
function ctxOf(k, n) { const g = girlsAt(k), m = meAt(n || me, k); return { kinder: g === 'kinder', girlsHome: g === 'home' || g === 'free' || g === 'sick' || kidsStay(k).length > 0, out: m === 'out' || m === 'outkids' }; }
function fits(items, k, n) { const c = ctxOf(k, n); return (items || []).filter(it => { const w = whenOf(it); return !w || (w === 'kinder' ? c.kinder : w === 'home' ? c.girlsHome : w === 'out' ? c.out : w === 'in' ? !c.out : true); }); }
/* closing duties are for tomorrow's sake, so they follow tomorrow's situation */
function closingSet() {
  const L = H('lists'), ev = evening(), surv = hMode() === 'survival', solo0 = !surv && !!(ev && ev.type === 'away');
  const solo = solo0 || (!surv && meValid() && othersOutTonight(me) && eveAt(me, dk) === 'home');
  const pre = surv ? 's' : solo ? 'o' : 'c', all = (surv ? L.survival : solo ? L.solo : L.closing) || [];
  return { pre, surv, solo, cl: fits(all, tk, me), hidden: all.length - fits(all, tk, me).length };
}
const ghDays = gh => { let n = 0; for (let k = gh.from; k <= realToday(); k = calAdd(k, 1)) { const dw = (new Date(k + 'T12:00').getDay() + 6) % 7; if (dw < 5 && !czHoliday(k)) n++; } return n; };
const fmtD = k => new Date(k + 'T12:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
/* who has the girls when, on days they're home and both adults are around */
const shiftOf = k => situOf(k).shift || {};
/* the day's headline facts, used by the opening screen, Today and Plan tomorrow */
function dayFacts(k) {
  const out = [], g = girlsAt(k), other = otherOf(me), mm = meAt(me, k), om = other ? meAt(other, k) : null, gh = girlsHomeRange(), hol = czHoliday(k);
  const isT = k === dk, when = isT ? 'today' : 'tomorrow';
  if (g === 'home') out.push({ t: `The girls are home ${when}${gh && gh.from <= k ? ` (${GH_REASONS.find(r => r[0] === gh.reason)?.[1].toLowerCase() || 'staying home'}, since ${fmtD(gh.from)}${isT ? `: ${ghDays(gh)} kindergarten day${ghDays(gh) === 1 ? '' : 's'} so far` : ''})` : ''}.`, act: 'go-situ' });
  else if (g === 'kinder') out.push({ t: `Kindergarten day${kinderWin() ? ` (${kinderWin()[0]}–${kinderWin()[1]})` : ''}.`, act: 'go-situ' });
  else if (g === 'grandma') out.push({ t: `The girls are with their grandparents ${when}.` });
  else if (g === 'free' && hol) out.push({ t: `${hol}: no kindergarten ${when}.` });
  else if (g === 'free' && kinderClosed(k)) out.push({ t: `${kinderClosed(k)}: no kindergarten ${when}.` });
  if (g === 'home' || g === 'free') {
    const avail = [me, other].filter(Boolean).filter(n => !notHere(meAt(n, k)));
    if (!avail.length) out.push({ t: `You’re both heading out ${when} and the girls are home. Who has them?`, act: 'go-situ', warn: true });
    else if (avail.length === 1 && g === 'home') out.push({ t: avail[0] === me ? `You have the girls ${when}${om === 'out' ? ` while ${other} is at work` : ''}.` : `${other} has the girls ${when}.` });
    const sh = shiftOf(k); if (sh.am || sh.pm) out.push({ t: `Girls: ${sh.am ? `${sh.am === me ? 'you' : sh.am} in the morning` : ''}${sh.am && sh.pm ? ', ' : ''}${sh.pm ? `${sh.pm === me ? 'you' : sh.pm} in the afternoon` : ''}.` });
  }
  const hrs = dayHours(me, k), st = (situOf(k).start || {})[me];
  if (mm === 'out' && !isFlex(me) && hrs && hrs[0]) out.push({ t: `You head out around ${hrs[0]}${st ? ` (starting at ${st})` : ''}${hrs[1] ? `, home around ${hrs[1]}` : ''}.` });
  else if (mm === 'outkids') out.push({ t: `You’re out with the girls ${when}.` });
  else if (mm === 'away' && !isFlex(me)) out.push({ t: `You’re away from home ${when}.` });
  else if (mm === 'off' && isFlex(me) && g !== 'grandma') out.push({ t: `No girls ${when}: time for work, and for rest.` });
  return out.concat(ourDayFacts(k));
}
/* the card where you set the day up: compact summary, tap to change.
   Rows: the girls (and which of them go, on kindergarten days), you, your evening, a later start at work,
   and who does drop-off, pick-up and bedtime (worked out from the calendar; tap to change for this day). */
function situCard(k, opts = {}) {
  if (!meValid() || !kidsList().length) return '';
  const g0 = girlsAt(k), g = g0 === 'free' ? 'home' : g0, other = otherOf(me), gh = girlsHomeRange(), open = S.ui.situOpen === k || opts.open, isT = k === dk, S0 = situOf(k);
  const gOver = !!S0.girls, mOver = !!(S0[me] || S0.kids || S0.drop || S0.pick || S0.lunch || S0.bed || (S0.eve || {})[me] || (S0.start || {})[me]);
  const pill = (act, v, cur, label, extra = '') => `<button type="button" class="pill${cur === v ? ' on' : ''}" data-act="${act}" data-k="${k}" data-v="${esc(v)}" ${extra}>${label}</button>`;
  const ins = kidsIn(k), stay = kidsStay(k), who = n => n === me ? 'you' : esc(n);
  const gl = g0 === 'kinder' && ins.length ? `${esc(ins.join(' and '))} at kindergarten${stay.length ? `, ${esc(stay.join(' and '))} home` : ''}` : GIRLS_LBL[g0] || '';
  const eveTxt = n => eveAt(n, k) === 'home' ? '' : `, ${eveAt(n, k) === 'night' ? (meAt(n, k) === 'away' ? 'overnight' : 'away overnight') : 'out in the evening'}`;
  const db = dropBy(k), lb = lunchBy(k), pb = pickBy(k), bb = bedBy(k), late = ins.filter(x => !lunchKid(x)), lunch = ins.filter(lunchKid);
  const roles = [db ? `drop-off ${who(db)}` : '', lunch.length && lb ? `${esc(lunch.join(' and '))}’s lunch pick-up ${who(lb)}` : '', late.length && pb ? `${esc(late.join(' and '))}’s pick-up ${who(pb)}` : '', bb ? `bedtime ${who(bb)}` : ''].filter(Boolean);
  const sum = `<b>Girls:</b> ${gl}${g === 'home' && gh && gh.from <= k ? ` <span class="muted">since ${fmtD(gh.from)}</span>` : ''} · <b>You:</b> ${meLbl(me, meAt(me, k), k)}${eveTxt(me)}${other ? ` · <b>${esc(other)}:</b> ${meLbl(other, meAt(other, k), k)}${eveTxt(other)}` : ''}${roles.length ? `<span class="situ-roles">${roles.join(' · ').replace(/^./, c => c.toUpperCase())}</span>` : ''}`;
  if (!open) return `<button class="situ-sum${dayFacts(k).some(f => f.warn) ? ' warn' : ''}" data-act="situ-open" data-k="${k}"><span class="eyebrow">${opts.title || (isT ? 'Today’s setup' : 'Tomorrow’s setup')}</span><span>${sum}</span><span class="muted small">Change</span></button>`;
  const canShift = (g === 'home' || g === 'free') && other && !notHere(meAt(me, k)) && !notHere(meAt(other, k));
  const p = prof(me), st = (S0.start || {})[me], hrs = dayHours(me, k), adultsL = [me, other].filter(Boolean);
  const roleRow = (r, label, cur, note) => `<div class="situ-row"><span class="small"><b>${label}</b>${note ? ` <span class="muted">${note}</span>` : ''}</span><div class="pills">${adultsL.map(n => `<button type="button" class="pill${cur === n ? ' on' : ''}" data-act="situ-role" data-k="${k}" data-r="${r}" data-v="${esc(n)}">${n === me ? 'Me' : esc(n)}</button>`).join('')}</div></div>`;
  const evOn = eveEvents(me, k)[0];
  return `<section class="card situ" id="situ-${k}"><div class="sec-head"><h2>${opts.title || (isT ? 'Today’s setup' : 'Tomorrow’s setup')}</h2>${opts.open ? `<button class="link" data-act="situ-ok" data-k="${k}">Done</button>` : `<button class="link" data-act="situ-open" data-k="">Done</button>`}</div>
    <p class="muted small">Afloat shapes ${isT ? 'today' : 'tomorrow'}’s lists around this: only what fits the day shows up.</p>
    <div class="situ-row"><span class="small"><b>The girls</b></span><div class="pills">
      ${pill('situ-girls', 'kinder', g, 'Kindergarten')}${pill('situ-girls', 'home', g, 'Home with us')}${pill('situ-girls', 'grandma', g, 'With grandparents')}</div></div>
    ${g0 === 'kinder' && kidsList().length > 1 ? `<div class="situ-sub"><span class="small">Who goes</span><div class="pills">${kidsList().map(x => `<button type="button" class="tiny${ins.includes(x) ? ' on' : ''}" data-act="situ-kid" data-k="${k}" data-v="${esc(x)}" aria-pressed="${ins.includes(x)}">${esc(x)}</button>`).join('')}</div>
      ${stay.length ? `<p class="muted small">${esc(stay.join(' and '))} stays home with ${db === me || !db ? 'you' : esc(db)}; drop-off is just ${esc(ins.join(' and '))}.</p>` : ''}
      <div class="addform">${ins.map(x => `<label class="small">${esc(x)}’s pick-up <input type="time" id="kp_${placeKey(x)}_${k}" data-act="kid-pick" data-n="${esc(x)}" value="${esc(pickOf(x))}"></label>`).join('')}</div>
      <p class="muted small">Usual pick-up times, for every kindergarten day. Change them when a girl starts staying longer.</p></div>` : ''}
    ${g0 === 'home' ? `<div class="situ-sub"><div class="pills">${GH_REASONS.map(([v, l]) => `<button type="button" class="tiny${(gh && gh.reason) === v ? ' on' : ''}" data-act="gh-reason" data-v="${v}">${l}</button>`).join('')}</div>
      <label class="small">Home until <select data-act="gh-until" id="ghUntil_${k}"><option value="">Not sure yet (I’ll be asked each morning)</option>${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(i => calAdd(k, i)).filter(x => { const dw = (new Date(x + 'T12:00').getDay() + 6) % 7; return dw < 5; }).slice(0, 8).map(x => `<option value="${x}" ${gh && gh.until === x ? 'selected' : ''}>${x === k ? 'Just ' + (isT ? 'today' : 'tomorrow') : 'Up to and including ' + fmtD(x)}</option>`).join('')}</select></label>
      ${gh && gh.from < k ? `<label class="small">Home since <input type="date" data-act="gh-from" value="${esc(gh.from)}"></label>` : ''}</div>` : ''}
    <div class="situ-row"><span class="small"><b>You</b></span><div class="pills">${ME_OPTS[isFlex(me) ? 'flex' : 'fixed'].map(([v, l]) => pill('situ-me', v, meAt(me, k), l)).join('')}</div></div>
    ${!isFlex(me) && meAt(me, k) === 'out' && p.leave ? `<div class="situ-sub"><label class="small">Starting work at <input type="time" id="st_${k}" data-act="situ-start" data-k="${k}" value="${esc(st || p.start || '')}" max="09:00"></label>
      <p class="muted small">${hrs ? `Leave around ${hrs[0]}${hrs[1] ? `, home around ${hrs[1]}` : ''}.` : ''} After 7:00 the drive can take up to an hour and a half; 9:00 is the latest start.</p></div>` : ''}
    <div class="situ-row"><span class="small"><b>Your evening</b>${evOn && !(S0.eve || {})[me] ? ` <span class="muted">from the calendar: ${esc(shortTitle(evOn.title))}</span>` : ''}</span><div class="pills">${Object.entries(EVE_LBL).map(([v, l]) => pill('situ-eve', v, eveAt(me, k), l)).join('')}</div></div>
    ${other ? `<p class="small muted">${esc(other)}: ${meLbl(other, meAt(other, k), k)}${eveTxt(other)}${situOf(k)[other] || (S0.eve || {})[other] ? '' : ' (from the calendar)'}. Only ${esc(other)} can change theirs.</p>` : ''}
    ${other && (db || pb || bb || (lunch.length && lb)) ? `<div class="situ-sub roles"><p class="small"><b>Who does what</b> <span class="muted">· worked out from the calendar; tap to change for ${isT ? 'today' : 'tomorrow'}</span></p>
      ${db ? roleRow('drop', 'Drop-off', db, S0.drop ? '(changed)' : '') : ''}${lunch.length && lb ? roleRow('lunch', `${esc(lunch.join(' and '))} after lunch`, lb, `${esc(lunch.map(pickOf).join(', '))}${S0.lunch ? ' (changed)' : ''}`) : ''}
      ${late.length && pb ? roleRow('pick', 'Pick-up', pb, `${esc(late.map(x => pickOf(x)).filter((v, i, a) => a.indexOf(v) === i).join(', '))}${S0.pick ? ' (changed)' : ''}`) : ''}${bb ? roleRow('bed', 'Bedtime', bb, S0.bed ? '(changed)' : '') : ''}</div>` : ''}
    ${canShift ? `<div class="situ-row"><span class="small"><b>Who has the girls</b></span><div class="shift">${['am', 'pm'].map(s => `<span class="small">${s === 'am' ? 'Morning' : 'Afternoon'}</span><div class="pills">${[me, other].map(n => `<button type="button" class="pill${shiftOf(k)[s] === n ? ' on' : ''}" data-act="situ-shift" data-k="${k}" data-s="${s}" data-v="${esc(n)}">${esc(n)}</button>`).join('')}</div>`).join('')}</div></div>` : ''}
    ${(gOver || mOver) ? `<button class="linkish small" data-act="situ-reset" data-k="${k}">Back to the usual for this day</button>` : ''}
  </section>`;
}
/* asks each of you once for your usual work hours, so the hlídání check knows when you're out */
function workHoursCard() {
  if (!meValid() || !kidsList().length) return '';
  const p = prof(me), wds = p.workdays || [0, 1, 2, 3, 4]; if (isFlex(me) || !wds.length || (p.leave && p.back)) return '';
  let snooze = 0; try { snooze = +localStorage.getItem('afloat.whSnooze') || 0; } catch {}
  if (Date.now() < snooze) return '';
  const other = otherOf(me);
  return `<section class="card whcard"><h2>When are you usually out on workdays?</h2>
    <p class="muted small">Then Afloat can ${kidsList().length ? `warn you when nobody is home with ${esc(theKids())}` : 'plan your leave-by times around it'}${other && kidsList().length ? `, for example if ${esc(other)} has an appointment while you’re at work` : ''}. Only you can set yours.</p>
    <div class="addform"><label class="small">I leave around <input type="time" id="whLeave" data-act="p-field" data-f="leave" value="${esc(p.leave || '')}"></label><label class="small">and I’m back around <input type="time" id="whBack" data-act="p-field" data-f="back" value="${esc(p.back || '')}"></label></div>
    <p class="muted small">Workdays: ${wds.map(i => DAYS[i]).join(', ')}. Freelance, or no set hours? Say so in <button class="linkish" data-act="setup">My mornings</button>.</p>
    <div class="actions"><button class="btn ghost" data-act="wh-later">Not now</button></div></section>`;
}
/* open the setup by itself when the girls are home and you haven't said where you'll be */
/* opens by itself only for the freelance adult (whose day depends on the girls), once a day, until they say Done */
const needsSetup = k => meValid() && isFlex(me) && girlsAt(k) === 'home' && !situOf(k)[me] && !(situOf(k).ok || {})[me] && !ghAsk();
/* the household's list for days the girls stay home */
function girlsHomeCard(k) {
  if (girlsAt(k) !== 'home') return '';
  const L = H('lists').girlsHome || [], gh = girlsHomeRange(), pre = 'gh';
  return doneFold('gh', 'Girls at home', S.ui.edit.girlsHome ? 0 : countDone(pre, L), L.length, `<section class="card ghcard"><div class="sec-head"><h2>Girls at home</h2><span class="progress">${countDone(pre, L)} of ${L.length}</span></div>
    <p class="muted small">${gh && gh.reason === 'cold' ? 'Runny noses, not sick-day serious. ' : ''}A home day with small kids is a full job. These keep it gentle; the rest of the house can wait.</p>
    ${S.ui.edit.girlsHome ? editList('lists', 'girlsHome', L, 'Add something for home days') : checklist(pre, L)}
    <div class="chips">${editBtn('girlsHome')}${gh && !gh.until ? `<button class="tiny" data-act="gh-back" data-k="${tk}">Back to kindergarten tomorrow</button>` : ''}<button class="tiny" data-act="sick-on">It’s more serious: sick-day mode</button></div></section>`);
}
/* ---------- taps on this area's buttons (data-act), called from events.js; true = handled ---------- */
function tapSituation(a, el, e, r) {
  switch (a) {
    case 'situ-open': S.ui.situOpen = el.dataset.k || null; render(true); if (el.dataset.k) setTimeout(() => { const c = document.getElementById('situ-' + el.dataset.k); if (c) c.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, 0); return true;
    case 'situ-shift': { const k = el.dataset.k, sh = { ...shiftOf(k) }; sh[el.dataset.s] = sh[el.dataset.s] === el.dataset.v ? null : el.dataset.v; setSitu(k, { shift: sh }); return true; }
    case 'situ-reset': { const k = el.dataset.k, o = situOf(k); setSitu(k, { girls: null, [me]: null, shift: null, kids: null, drop: null, pick: null, lunch: null, bed: null, eve: { ...(o.eve || {}), [me]: null }, start: { ...(o.start || {}), [me]: null } }); return true; }
    case 'situ-kid': { const k = el.dataset.k, v = el.dataset.v, ins = kidsIn(k), next = ins.includes(v) ? ins.filter(x => x !== v) : [...ins, v];
      if (!next.length) { toast('Nobody at kindergarten? Choose “Home with us” above.'); return true; }
      setSitu(k, { kids: next.length === kidsList().length ? null : kidsList().filter(x => next.includes(x)) }); return true; }
    case 'situ-role': { const k = el.dataset.k, r = el.dataset.r; setSitu(k, { [r]: situOf(k)[r] === el.dataset.v ? null : el.dataset.v }); return true; }
    case 'situ-ok': { const k = el.dataset.k; S.ui.situOpen = null; setSitu(k, { ok: { ...(situOf(k).ok || {}), [me]: true } }); return true; }
    case 'gh-reason': { const gh = girlsHomeRange(); if (gh) saveHome('situation', { ...H('situation'), girlsHome: { ...gh, reason: el.dataset.v } }); return true; }
    case 'wh-later': try { localStorage.setItem('afloat.whSnooze', String(Date.now() + 7 * 864e5)); } catch {} render(true); return true;
    case 'gh-back': { const k = el.dataset.k, gh = girlsHomeRange(); if (gh) { const u = calAdd(k, -1); saveHome('situation', { ...H('situation'), girlsHome: u < gh.from ? null : { ...gh, until: u } }); }
      toast(k === dk ? 'Kindergarten today: the lists have adjusted.' : 'Back to kindergarten tomorrow. Tonight’s prep includes the bags again.'); return true; }
    case 'sick-on': { const sk = { ...H('sick') }; const old = Date.now() - 3 * 864e5; sk.active = true; sk.since = Date.now(); sk.doses = (sk.doses || []).filter(x => x.at > old); sk.temps = (sk.temps || []).filter(x => x.at > old); saveHome('sick', sk); if (S.view !== 'today') location.hash = 'today'; scrollTo(0, 0); toast('Sick-day mode is on. Everything else can wait.'); return true; }
  }
  return false;
}
