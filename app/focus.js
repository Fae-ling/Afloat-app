/* Afloat · app/focus.js · Active mode's Focus module (10 Nov 2026): areas you work on, a focus session (launch, rhythm,
   a hard stop from the calendar, a "Not now" catcher, landing with a breadcrumb), the Done log, and what the other phone sees.
   Plain script: shares one scope with the other app/*.js files (loaded in order by index.html). See CLAUDE.md.

   Why it works like this (research, Nov 2026, in README "Focus"):
   - ADHD brains are slow to warm up and then hate being cut off, so the default rhythm is Flow (count up, stop when focus
     fades, break ≈ a fifth of the time); fixed Blocks (25/5, 50/10) and a 10-minute on-ramp are there for harder days.
   - Time blindness: time is drawn (a ring and a bar), and the session knows its hard stop from the calendar (getting ready
     for a pick-up), with a landing warning ten minutes before, also as a phone notification.
   - Stating the intention and checking in at the end is the core of body-doubling services (Focusmate, FLOWN); the other
     phone sees the session and can keep you company.
   - Stray thoughts go into "Not now" instead of a new tab; landing leaves a breadcrumb for the next start.
   home/focus = { areas: { id: { id, name, owner, order, need: [{id,text}], links: [{id,text,url}], match, est, crumb: {text, at} } },
                  now: { person: session|null }, log: { id: { by, area, start, end, mins, intent, did, crumb, feel } }, seeded: { person: true } }
   session = { area, aname, intent, step, card, rhythm: 'flow'|'block'|'ten', blk, brk, start, off, offAt, paused, phase: 'work'|'break'|'land',
               base, blocks, brkEnd, body, endAt, share, touch (last saved), caught: [{id,text}] } */

/* ---------- areas ---------- */
/* everyone's starting areas: admin and house projects, and photo editing with the Photo gigs module (a household's own
   areas are added in Active → Areas) */
const FX_SEED = [
  { gigs: 1, name: 'Photo editing', match: 'focení, foto, fotk, photo, edit, úprav, upravit, probrat, cull, lightroom, gig', need: ['Lightroom open on the right catalogue', 'The card or drive with the photos plugged in', 'Headphones and something to listen to', 'Water and a snack', 'Phone face down, out of reach'], links: [] },
  { name: 'House projects', match: 'brán, gate, oprav, postavit, namontovat, ovladač, garáž, dílna, workshop', need: ['The tools for it, in one place', 'Phone on silent', 'Water'], links: [] },
  { name: 'Admin & paperwork', match: 'faktur, platb, pojišť, úřad, formulář, smlouv, billing, daně, tax', need: ['Laptop and charger', 'The papers or emails it needs', 'Water'], links: [] }];
const FX_RHY = [['flow', 'Flow', 'Count up; stop when focus fades'], ['b25', '25 + 5', 'Short blocks with breaks'], ['b50', '50 + 10', 'Longer blocks'], ['ten', 'Just 10 min', 'An on-ramp; keep going if it’s flowing']];
const FX_FEEL = [[1, '😮‍💨', 'Hard going'], [2, '🙂', 'Okay'], [3, '✨', 'In the zone']];
const fxDoc = () => H('focus') || {};
const fxAreas = (n = me) => Object.values(fxDoc().areas || {}).filter(a => a && a.name && (!a.owner || a.owner === n)).sort((a, b) => (a.order || 0) - (b.order || 0));
const fxArea = id => (fxDoc().areas || {})[id] || null;
const fxAreaName = id => id === '_other' ? 'Something else' : (fxArea(id) || {}).name || 'Focus';
const fxSaveArea = (id, part) => { const F = fxDoc(), A = { ...(F.areas || {}) }; A[id] = part === null ? null : { ...(A[id] || { id, owner: me, need: [], links: [] }), ...part }; saveHome('focus', { ...F, areas: A }); };
const fxUrl = u => { u = String(u || '').trim(); if (u && !/^[a-z]+:/i.test(u)) u = 'https://' + u; return /^https?:\/\//i.test(u) ? u : ''; };
function fxSeed() {
  const F = fxDoc(); if (!meValid() || (F.seeded || {})[me]) return;
  const A = { ...(F.areas || {}) };
  FX_SEED.filter(s => !s.gigs || modOn('gigs')).forEach((s, i) => { const id = uid(); A[id] = { id, owner: me, order: i, name: s.name, match: s.match, need: s.need.map(t => ({ id: uid(), text: t })), links: s.links.map(([text, url]) => ({ id: uid(), text, url })) }; });
  saveHome('focus', { ...F, areas: A, seeded: { ...(F.seeded || {}), [me]: true } });
}
/* 10 Nov 2026: the first seeds had only English-ish Trello words, so Czech task names ("Upravit fotky…") found no area;
   areas still on those exact words get the fuller list once */
const FX_OLD_MATCH = { ['focení, foto, photo, edit, cull, lightroom, gig']: 'focení, foto, fotk, photo, edit, úprav, upravit, probrat, cull, lightroom, gig', ['ux, ui, portfolio, figma, coursera, case study, design']: 'ux, ui, portfolio, figma, coursera, course, kurz, case study, design', ['job, cv, práce, pohovor, interview, linkedin, application']: 'job, cv, životopis, práce, pohovor, interview, linkedin, application' };
function fxMigrate() {
  const F = fxDoc(), A = { ...(F.areas || {}) }; let ch = false;
  for (const [k, a] of Object.entries(A)) if (a && FX_OLD_MATCH[a.match]) { A[k] = { ...a, match: FX_OLD_MATCH[a.match] }; ch = true; }
  if (ch) saveHome('focus', { ...F, areas: A });
}
/* time spent, from the log */
const fxLog = (n = me) => Object.entries(fxDoc().log || {}).filter(([, x]) => x && x.by === n).map(([id, x]) => ({ id, ...x })).sort((a, b) => b.start - a.start);
const fxMins = (area, since = 0, n = me) => fxLog(n).filter(x => (!area || x.area === area) && x.start >= since).reduce((s, x) => s + (+x.mins || 0), 0);
const fxDur = m => { m = Math.round(m); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ' ' + (m % 60) + ' min' : ''}`; };
const fxHrs = m => `${Math.round(m / 6) / 10} h`;
const fxWeek0 = () => new Date(weekStart() + 'T00:00:00').getTime();

/* ---------- the hard stop: the next thing the calendar needs you for ---------- */
function fxStopNext(n = me) {
  const nm = nowMin(), c = [];
  try { for (const e of outingsOn(dk, n)) { if (e.noLeave || leftOn(e)) continue; const la = leaveAt(e), lead = Math.max(readyLead(e, n), 15), m = la - lead;
    if (m > nm - 60) c.push({ m, why: readyLead(e, n) > 15 ? `getting ready for ${shortTitle(e.title)}` : `leaving at ${mm2t(la)} for ${shortTitle(e.title)}` }); } } catch (e) { console.warn(e); }
  try { const r = dayRows(dk).find(r => !r.allDay && !r.job && r.s > nm && mineRow(r) && !girlsAwayRow(r)); if (r) c.push({ m: r.s - 5, why: shortTitle(r.title) }); } catch (e) { console.warn(e); }
  const b = c.sort((x, y) => x.m - y.m)[0]; if (!b) return null;
  const d = new Date(); d.setHours(0, 0, 0, 0); return { ...b, at: d.getTime() + b.m * 6e4 };
}

/* ---------- the session ---------- */
const fxNow = (n = me) => { const s = (fxDoc().now || {})[n]; return s && s.start ? s : null; };
const fxPut = (s, n = me) => { const F = fxDoc(); saveHome('focus', { ...F, now: { ...(F.now || {}), [n]: s && { ...s, touch: Date.now() } } }); };
/* a session nobody has touched for two hours (no pause, break, block or thought), or one left paused, isn't shown to the others:
   a forgotten session shouldn't keep asking for a quiet house all day (10 Nov 2026) */
const FX_STALE = 2 * 36e5;
const fxStale = (s, now = Date.now()) => !!s && s.phase !== 'land' && (!!s.paused || now - Math.max(s.touch || 0, s.start || 0, s.phase === 'break' ? s.brkEnd || 0 : 0) > FX_STALE);
function fxState(s, now = Date.now()) {
  const worked = Math.max(0, (s.offAt || now) - s.start - (s.off || 0)), stop = s.phase === 'land' ? null : fxStopNext();
  const blockLeft = s.phase === 'work' && s.rhythm !== 'flow' ? s.blk * 6e4 - (worked - (s.base || 0)) : null;
  return { worked, blockLeft, brkLeft: s.phase === 'break' ? s.brkEnd - now : null, stop, stopLeft: stop ? stop.at - now : null };
}
const fxClock = ms => { const t = Math.max(0, Math.round(ms / 1e3)), h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, sec = t % 60; return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`; };
const fxBreakFor = (s, mins) => s.rhythm === 'flow' ? Math.max(5, Math.min(20, Math.round(mins / 5))) : s.rhythm === 'ten' ? 5 : s.brk;
function fxStart(o) {
  const r = o.rhythm || 'flow', blk = r === 'b25' ? 25 : r === 'b50' ? 50 : r === 'ten' ? 10 : 0;
  const s = { area: o.area || '_other', aname: o.aname || fxAreaName(o.area || '_other'), cardName: String(o.cardName || '').slice(0, 300), intent: String(o.intent || '').slice(0, 200), step: String(o.step || '').slice(0, 200), card: o.card || '', rhythm: blk ? (r === 'ten' ? 'ten' : 'block') : 'flow', blk, brk: r === 'b50' ? 10 : 5,
    start: Date.now(), off: 0, offAt: 0, phase: 'work', base: 0, blocks: 0, body: 0, share: o.share !== false, caught: [] };
  if (o.px && o.px.p) s.px = { p: String(o.px.p), i: String(o.px.i || '') }; /* a step from a plan (plans.js): landing offers to tick it */
  if (o.kind === 'home') Object.assign(s, { kind: 'home', room: o.room || '', way: o.way || 'list', hstep: 0, cur: o.cur || '', skip: [], did: [], block: o.block || [] });
  if (o.area && fxArea(o.area) && !o.fromTask) fxSaveArea(o.area, { rhythm: r });
  fxPut(s); S.ui.fx = null; S.ui.fxSug = null; S.ui.fxAfter = null; fxTick.primed = false;
  if (S.ui.fxNoiseOn) fxNoise(true); if (S.ui.fxWakeOn) fxWake(true);
  if (S.view !== 'focus') location.hash = 'focus'; render(true); fxEnsure();
}
function fxEdit(fn) { const s = fxNow(); if (!s) return; const n = { ...s }; fn(n, Date.now()); fxPut(n); render(true); fxEnsure(); }
const fxResume = (s, now) => { if (s.offAt) { s.off = (s.off || 0) + (now - s.offAt); s.offAt = 0; } s.paused = false; };
function fxLand() { fxEdit((s, now) => { if (s.phase === 'break') { fxResume(s, s.brkEnd < now ? s.brkEnd : now); } if (!s.offAt) s.offAt = now; s.phase = 'land'; s.endAt = now; }); fxNoise(false); fxWake(false); }
function fxSaveLand() {
  const s = fxNow(); if (!s) return;
  const g = id => String(($('#' + id) || {}).value || '').trim().slice(0, 300), did = g('fxDid'), crumb = g('fxCrumb'), mins = Math.round(fxState(s).worked / 6e4), F = fxDoc();
  const log = { ...(F.log || {}) }, cut = Date.now() - 200 * 864e5;
  for (const [k, v] of Object.entries(log)) if (!v || v.start < cut) delete log[k]; /* about half a year is kept */
  log[uid()] = { by: me, area: s.area, aname: s.aname || fxAreaName(s.area), card: s.card || '', cardName: s.cardName || '', start: s.start, end: s.endAt || Date.now(), mins, intent: s.intent || '', did, crumb, feel: +(S.ui.fxFeel || 0) };
  const A = { ...(F.areas || {}) }; if (A[s.area] && crumb) A[s.area] = { ...A[s.area], crumb: { text: crumb, at: Date.now() } };
  const CR = { ...(F.crumbs || {}) }; if (s.card && crumb) CR[s.card] = { text: crumb, at: Date.now() };
  const crKeep = Object.entries(CR).filter(([, v]) => v).sort((x, y) => y[1].at - x[1].at).slice(0, 80).map(([k]) => k); for (const k of Object.keys(CR)) if (!crKeep.includes(k)) CR[k] = null; /* the last 80 breadcrumbs */
  saveHome('focus', { ...F, log, areas: A, crumbs: CR, now: { ...(F.now || {}), [me]: null } });
  if (s.kind === 'home' && s.way === 'reset' && (+s.hstep || 0) > 0) hmLogReset(s);
  if (s.card && S.ui.fxTrDone && mcp) trDone(s.card); S.ui.fxTrDone = false;
  if (s.px && S.ui.fxPxDone) pxList(s.px.p, 'steps', L => L.map(x => x.id === s.px.i ? { ...x, done: true } : x)); S.ui.fxPxDone = false;
  S.ui.fxAfter = mins >= 10 ? { mins, brk: fxBreakFor(s, mins) } : { mins, brk: 0 }; S.ui.fxFeel = 0;
  toast(mins >= 1 ? `${fxDur(mins)} of focus. That counts.` : 'Starting counts too.'); render(true);
}

/* ---------- ticking, sound, screen ---------- */
function fxEnsure() { const s = fxNow(); if (s && s.phase !== 'land') { if (!fxTick.iv) fxTick.iv = setInterval(fxTick, 1000); } else if (fxTick.iv) { clearInterval(fxTick.iv); fxTick.iv = 0; } }
function fxTick() {
  const s = fxNow(); if (!s || s.phase === 'land') { fxEnsure(); return; }
  const st = fxState(s), main = s.phase === 'break' ? st.brkLeft : st.blockLeft != null ? st.blockLeft : st.worked;
  document.querySelectorAll('[data-fx-clock=main]').forEach(el => { el.textContent = fxClock(main); });
  document.querySelectorAll('[data-fx-clock=stop]').forEach(el => { el.textContent = st.stopLeft != null ? fxDur(Math.max(0, st.stopLeft / 6e4)) : ''; });
  const arc = $('#fx-arc'); if (arc) arc.setAttribute('stroke-dashoffset', (FX_C * (1 - fxFrac(s, st))).toFixed(1));
  /* moments that deserve a sound and a redraw; on the first tick after opening, the ones already past are only noted */
  const evs = [];
  if (st.blockLeft != null && st.blockLeft <= 0) evs.push(['blk-' + (s.blocks || 0), 1]);
  if (st.brkLeft != null && st.brkLeft <= 0) evs.push(['brk-' + (s.blocks || 0), 1]);
  if (st.stop && st.stopLeft <= 10 * 6e4) evs.push(['warn-' + st.stop.m, 1]);
  if (st.stop && st.stopLeft <= 0) evs.push(['stop-' + st.stop.m, 1]);
  if (s.rhythm === 'flow' && st.worked >= 90 * 6e4) evs.push(['body-' + Math.floor(st.worked / (90 * 6e4)), 0]);
  const fired = S.ui.fxFired || (S.ui.fxFired = {}); let redraw = false;
  for (const [k, snd] of evs) { const key = s.start + ':' + k; if (fired[key]) continue; fired[key] = 1; redraw = true; if (snd && fxTick.primed) chime(); }
  fxTick.primed = true;
  if (redraw) render(true);
}
const FX_C = 2 * Math.PI * 88;
function fxFrac(s, st) {
  if (s.phase === 'break') return Math.max(0, st.brkLeft) / (s.brkLen || s.brk * 6e4 || 1);
  if (st.blockLeft != null) return Math.max(0, st.blockLeft) / (s.blk * 6e4);
  const win = st.stop ? Math.max(st.worked + Math.max(0, st.stopLeft), 6e4) : 90 * 6e4; /* Flow: how much of the time you have is used */
  return Math.min(1, st.worked / win);
}
function fxNoise(on) {
  try {
    if (on && !S.ui.fxAud) { const AC = window.AudioContext || window.webkitAudioContext, ctx = new AC(), n = ctx.sampleRate * 4, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0); let last = 0;
      for (let i = 0; i < n; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; } /* brown noise: soft and low, like a distant waterfall */
      const src = ctx.createBufferSource(), g = ctx.createGain(); src.buffer = buf; src.loop = true; g.gain.value = 0.25; src.connect(g).connect(ctx.destination); src.start(); S.ui.fxAud = { ctx, src }; }
    else if (!on && S.ui.fxAud) { S.ui.fxAud.ctx.close(); S.ui.fxAud = null; }
  } catch (e) { console.warn(e); }
}
async function fxWake(on) {
  try { if (on && 'wakeLock' in navigator) S.ui.fxWL = await navigator.wakeLock.request('screen'); else if (!on && S.ui.fxWL) { await S.ui.fxWL.release(); S.ui.fxWL = null; } } catch (e) { console.warn(e); }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.ui.fxWakeOn && fxNow() && fxNow().phase !== 'land') fxWake(true); });

/* phone notifications for a running session (added to notifyPlan in reminders.js); they always ring */
function fxNotify() {
  const s = fxNow(); if (!s || s.phase === 'land') return [];
  const st = fxState(s), now = Date.now(), rd = t => Math.round(t / 6e4) * 6e4, out = [], nm = s.aname || fxAreaName(s.area);
  if (st.stop && st.stopLeft > 10 * 6e4) out.push({ tag: `fx-warn-${s.start}`, at: rd(st.stop.at - 10 * 6e4), title: 'Ten minutes to land', body: `${nm}: jot down where you’ll pick up. Next: ${st.stop.why}.`, view: 'focus', live: true });
  if (st.stop && st.stopLeft > 0) out.push({ tag: `fx-stop-${s.start}`, at: rd(st.stop.at), title: 'Time to land', body: `Next: ${st.stop.why}.`, view: 'focus', live: true });
  if (st.blockLeft != null && st.blockLeft > 0 && !s.offAt) out.push({ tag: `fx-blk-${s.start}-${s.blocks || 0}`, at: rd(now + st.blockLeft), title: s.rhythm === 'ten' ? 'Ten minutes done' : 'Block done', body: s.rhythm === 'ten' ? 'Keep going or stop here; both count.' : `Time for a ${s.brk}-minute break.`, view: 'focus', live: true });
  if (st.brkLeft != null && st.brkLeft > 0) out.push({ tag: `fx-brk-${s.start}-${s.blocks || 0}`, at: rd(now + st.brkLeft), title: 'Break’s over', body: `Back to ${nm} when you’re ready.`, view: 'focus', live: true });
  return out;
}

/* ---------- the header switch, the bar in Home, the other phone ---------- */
const modeSwitch = () => `<a href="#today" class="${isActive() ? '' : 'on'}" ${isActive() ? '' : 'aria-current="true"'}>Home</a><a href="#focus" class="${isActive() ? 'on' : ''}" ${isActive() ? 'aria-current="true"' : ''}>${fxNow() && fxNow().phase !== 'land' ? '<i class="fx-dot" aria-hidden="true"></i>' : ''}Active</a>`;
function fxBar() {
  const s = meValid() && fxNow(); if (!s) return '';
  fxEnsure(); const st = fxState(s);
  return `<a class="fx-bar" href="#focus"><i class="fx-dot" aria-hidden="true"></i><span><b>${s.phase === 'land' ? 'Landing' : s.phase === 'break' ? 'On a break' : s.offAt ? 'Paused' : fxStale(s) ? 'Still going?' : 'Focusing'}</b> · ${esc(s.aname || fxAreaName(s.area))}</span>${s.phase === 'land' ? '' : `<span class="fx-bar-t" data-fx-clock="main">${fxClock(s.phase === 'break' ? st.brkLeft : st.blockLeft != null ? st.blockLeft : st.worked)}</span>`}<span class="go" aria-hidden="true">›</span></a>`;
}
function fxOthers() {
  if (!meValid()) return '';
  return members().map(m => m.name).filter(n => n !== me).map(n => {
    const s = fxNow(n); if (!s || !s.share || s.phase === 'land' || fxStale(s)) return '';
    const st = fxStopNextSafe(n), until = st ? ` until about ${mm2t(st.m)}` : '';
    return `<div class="banner fx-other"><p><b>${esc(n)} is focusing</b> on ${esc(s.aname || 'something')}${until}. A quiet house helps.</p><button class="btn ghost" data-act="timer" data-min="25" data-label="Keeping ${esc(n)} company">Keep ${esc(n)} company · 25 min</button></div>`;
  }).join('');
}
const fxStopNextSafe = n => { try { return n === me ? fxStopNext(n) : null; } catch { return null; } }; /* the other person's calendar view isn't loaded here, so no guess */

/* ---------- Focus: pick, get ready, run, land ---------- */
function vFocus() {
  if (meValid()) { const F = fxDoc(); if (!(F.seeded || {})[me]) setTimeout(fxSeed, 0); else if (Object.values(F.areas || {}).some(a => a && FX_OLD_MATCH[a.match])) setTimeout(fxMigrate, 0); }
  fxEnsure(); hmEnsure();
  const s = fxNow(), ro = meValid() && !sickOn() ? runOuting() : null;
  let h = (ro ? outingCard(ro, me, true) : '') + signalBanner() + fxOthers();
  if (!meValid()) return h + `<section class="hero"><p class="eyebrow">Focus</p><h1>Pick who you are first</h1><p class="lede">Settings → who’s using this phone.</p></section>`;
  if (s && s.phase === 'land') return h + fxLandView(s);
  if (s) return h + fxRunView(s);
  if (S.ui.hm) return h + hmHubView();
  if (S.ui.fx) return h + fxPrepView(S.ui.fx);
  return h + fxPickView();
}
function fxStopLine(st, lead = 'You have') {
  if (!st) return `<p class="muted small">Nothing in the calendar needs you for a while. Stop whenever focus fades.</p>`;
  const left = Math.round((st.at - Date.now()) / 6e4);
  return left > 0 ? `<p class="fx-stop"><b>${lead} until ${mm2t(st.m)}</b> · ${fxDur(left)} · then ${esc(st.why)}.</p>` : `<p class="fx-stop late"><b>Time to wrap up:</b> ${esc(st.why)}.</p>`;
}
/* the picker (10 Nov 2026): your open Trello tasks are the options, so it is always current. Same set as the Tasks view
   (taskCards: your own list, lists you count as tasks, cards you're on), each phone showing its own person's. In Progress and
   high priority first, then by date. A task whose board, list or name hits an area's Trello words brings that area's
   checklist and links along; a breadcrumb is kept per card. Areas stay below for work that isn't a card. */
const FX_PROG = /progress|doing|rozprac|dělám|working on|právě/i;
const fxHay = c => `${c.name} ${(c.list && c.list.name) || ''} ${(c.board && c.board.name) || ''}`.toLowerCase();
const fxWords = a => String((a && a.match) || '').toLowerCase().split(/[,;]/).map(x => x.trim()).filter(x => x.length > 1);
const fxAreaFor = c => fxAreas().find(a => fxWords(a).some(w => fxHay(c).includes(w))) || null;
const fxBoardOf = c => (c.board && c.board.name) || (c.list && c.list.id && (tbListBoard(c.list.id) || {}).name) || '';
/* tasks handed between the two of you (home/tasks.handed), as cards: the loaded card when Trello has it, else the record */
const fxMyTrId = () => (S.tb.me || {}).id || '';
const fxAsCard = h => (S.trello.cards || []).find(c => c.id === h.cardId) || { id: h.cardId, name: h.name || 'A task', url: h.url || '', board: { name: h.boardName || '' }, list: { id: '', name: '' }, due: h.due || null, labels: [] };
const fxToMe = h => fxMyTrId() ? h.toId === fxMyTrId() : h.toName === me;
const fxHandedIn = () => handed().filter(h => fxToMe(h) && !(S.trello.cards || []).some(c => c.id === h.cardId && (c.closed || c.dueComplete || c.complete)));
const fxHandedOut = () => handed().filter(h => h.by === me && !fxToMe(h) && !(S.trello.cards || []).some(c => c.id === h.cardId && (c.closed || c.dueComplete || c.complete)));
const fxFromOf = c => { const h = fxHandedIn().find(x => x.cardId === c.id); return h ? (h.byName || h.by || '') : ''; };
function fxTasks() {
  let cs = []; try { cs = taskCards(); } catch { return []; }
  for (const h of fxHandedIn()) if (!cs.some(c => c.id === h.cardId)) cs.push(fxAsCard(h));
  const rank = c => (fxFromOf(c) ? 0 : 8) + (FX_PROG.test((c.list && c.list.name) || '') ? 0 : 4) + (prioOf(c) === 'high' ? 0 : 2) + (c.due && dayDiff(c.due) <= 0 ? 0 : 1);
  return cs.slice().sort((a, b) => rank(a) - rank(b) || byPrio(a, b));
}
const fxCrumbOf = id => ((fxDoc().crumbs || {})[id] || {}).text || '';
const fxCardMins = id => fxLog().filter(x => x.card === id).reduce((s, x) => s + (+x.mins || 0), 0);
/* each area gets a colour (in its order), so a task's stripe says which area it belongs to; no area = quiet grey */
const FX_HUES = ['sea', 'violet', 'amber', 'accent'];
const fxHue = a => a ? FX_HUES[Math.max(0, fxAreas().findIndex(x => x.id === a.id)) % FX_HUES.length] : 'line';
const fxGroupOf = c => fxFromOf(c) ? 'handed' : FX_PROG.test((c.list && c.list.name) || '') ? 'prog' : c.due && dayDiff(c.due) <= 7 ? 'soon' : 'rest';
const FX_GROUPS = [['handed', 'Handed to you'], ['prog', 'In progress'], ['soon', 'Coming up'], ['rest', 'Everything else']];
function fxTaskRow(c) {
  const a = fxAreaFor(c), cr = fxCrumbOf(c.id), from = fxFromOf(c), m = fxCardMins(c.id), d = c.due ? dayDiff(c.due) : null;
  const meta = [from ? `<span class="fx-from">from ${esc(from)}</span>` : '', c.due ? `<span class="fx-due${d <= 0 ? ' now' : ''}">${esc(dueLabel(c.due))}</span>` : '', `<span>${esc(fxBoardOf(c))}${c.list && c.list.name ? ' › ' + esc(c.list.name) : ''}</span>`].filter(Boolean).join('');
  return `<li class="fx-t" data-n="${esc(fxHay(c))}" style="--hue:var(--${fxHue(a)});--hue-soft:var(--${fxHue(a)}-soft, var(--sunk))">
    <button class="fx-t-main" data-act="fx-task" data-id="${esc(c.id)}"><span class="fx-t-top">${a ? `<span class="fx-t-area">${esc(a.name)}</span>` : ''}${prioTag(c)}${m ? `<span class="fx-t-mins">${fxDur(m)} so far</span>` : ''}</span>
      <b class="fx-t-name">${esc(c.name)}</b><span class="fx-t-meta">${meta}</span>${cr ? `<span class="fx-t-crumb">↳ ${esc(cr)}</span>` : ''}</button>
    <button class="fx-t-go" data-act="fx-qs" data-id="${esc(c.id)}" aria-label="Start now: ${esc(c.name)}"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg></button></li>`;
}
function fxPickView() {
  const as = fxAreas().filter(a => a.kind !== 'home'), A = S.ui.fxAfter, wk = fxMins('', fxWeek0()), all = fxTasks(), F = S.ui.fxF || 'all', other = otherOf(me) || 'them', out = fxHandedOut();
  const cnt = k => all.filter(c => fxGroupOf(c) === k).length, chips = [['all', 'All', all.length], ...FX_GROUPS.filter(([k]) => k !== 'rest').map(([k, l]) => [k, k === 'handed' ? `From ${other}` : l, cnt(k)]).filter(x => x[2]),
    ...as.map(a => ['a:' + a.id, a.name, all.filter(c => (fxAreaFor(c) || {}).id === a.id).length]).filter(x => x[2]), ...(out.length ? [['out', `Handed to ${other}`, out.length]] : [])];
  const list = F === 'out' ? out.map(fxAsCard) : F === 'all' ? all : F.startsWith('a:') ? all.filter(c => (fxAreaFor(c) || {}).id === F.slice(2)) : all.filter(c => fxGroupOf(c) === F);
  let h = `<section class="hero fx-hero"><p class="eyebrow">Active · Focus</p><h1>What are you going to work on?</h1>${fxStopLine(fxStopNext())}</section>`;
  if (A) h += `<section class="card fx-after"><h2>${A.mins >= 1 ? fxDur(A.mins) + ' of focus.' : 'You started.'} That counts.</h2>${A.brk ? `<p class="muted small">Now a real break: about ${A.brk} minutes. Move, water, a window. The phone is the least restful option.</p><div class="actions"><button class="btn accent" data-act="fx-break-go" data-min="${A.brk}">Start a ${A.brk}-minute break ★</button><button class="link" data-act="fx-after-x">Not now</button></div>` : `<div class="actions"><button class="link" data-act="fx-after-x">Close</button></div>`}</section>`;
  h += hmEntry();
  h += `<section class="fx-tasks">`;
  if (!mcp) h += `<p class="note">Connect Trello in Settings → Connections and your tasks show up here.</p>`;
  else if (!all.length && !out.length) h += `<p class="note">${S.trello.status === 'loading' || S.trello.status === 'idle' ? 'Loading your tasks…' : S.trello.status === 'error' ? 'Trello can’t be reached right now. Areas below still work.' : 'No open tasks. Pick an area below, or add one with +.'}</p>`;
  else {
    h += `<div class="fx-tools"><label class="fx-search"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 16l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><input type="search" data-fxq placeholder="Find a task" aria-label="Find a task"></label>
      <div class="fx-chips" role="tablist" aria-label="Show">${chips.map(([k, l, n]) => `<button class="fx-chip${F === k ? ' on' : ''}" role="tab" aria-selected="${F === k}" data-act="fx-filter" data-k="${esc(k)}">${esc(l)} <i>${n}</i></button>`).join('')}</div></div>`;
    if (F === 'all') h += FX_GROUPS.map(([k, l]) => { const xs = list.filter(c => fxGroupOf(c) === k); if (!xs.length) return '';
      const rows = `<ul class="fx-tl">${xs.map(fxTaskRow).join('')}</ul>`;
      return k === 'rest' ? `<details class="fx-grp" ${S.ui.fxRest ? 'open' : ''} data-act="fx-rest"><summary><h3>${l}</h3><span class="progress">${xs.length}</span><span class="chev" aria-hidden="true">›</span></summary>${rows}</details>` : `<div class="fx-grp"><div class="fx-grp-h"><h3>${l}</h3><span class="progress">${xs.length}</span></div>${rows}</div>`; }).join('');
    else h += list.length ? `<ul class="fx-tl">${list.map(fxTaskRow).join('')}</ul>` : '<p class="muted small">Nothing here right now.</p>';
    h += `<p class="muted small fx-hint">Tap a task to get ready for it, or ▶ to start straight away.</p>`;
  }
  h += `</section><h3 class="fx-or">Not a Trello task?</h3><div class="fx-areas">${as.map(a => { const c = a.crumb && a.crumb.text, w = fxMins(a.id, fxWeek0());
    return `<button class="fx-area" data-act="fx-pick" data-id="${esc(a.id)}" style="--hue:var(--${fxHue(a)})"><b>${esc(a.name)}</b><span>${c ? '↳ ' + esc(c) : (a.need || []).length ? `${(a.need || []).length} things to get ready` : 'Ready when you are'}</span>${w ? `<span class="fx-wk">${fxDur(w)} this week</span>` : ''}</button>`; }).join('')}
    <button class="fx-area other" data-act="fx-pick" data-id="_other"><b>Something else</b><span>Name it as you start</span></button><button class="fx-area other" data-act="fx-ten"><b>Just start</b><span>Ten minutes on anything</span></button></div>`;
  if (!as.length) h += `<p class="muted small">Add areas you work on (with what you need and links) in <a class="link" href="#focus-areas">Areas</a>.</p>`;
  if (wk) h += `<p class="muted small fx-wkline">${fxDur(wk)} of focus this week. <a class="link" href="#focus-done">See it</a></p>`;
  return h;
}
function fxCards(a) {
  let cs = []; try { cs = taskCards(); } catch { return []; }
  const words = String((a && a.match) || '').toLowerCase().split(/[,;]/).map(x => x.trim()).filter(x => x.length > 1);
  const hay = c => `${c.name} ${(c.list && c.list.name) || ''} ${(c.board && c.board.name) || ''}`.toLowerCase();
  return (S.ui.fxAll || !words.length ? cs : cs.filter(c => words.some(w => hay(c).includes(w)))).sort(byDue).slice(0, S.ui.fxAll ? 10 : 5);
}
function fxPrepView(P) {
  const a = fxArea(P.area), other = P.area === '_other', name = P.fromTask ? P.cardName : other ? 'Something else' : a ? a.name : 'Focus', cards = other || P.fromTask ? [] : fxCards(a), sug = S.ui.fxSug;
  const card = P.card && (S.trello.cards || []).find(c => c.id === P.card), crumb = (P.card && fxCrumbOf(P.card)) || (a && a.crumb && a.crumb.text);
  let h = `<section class="hero"><p class="eyebrow"><button class="link" data-act="fx-back">‹ Back</button>${P.fromTask ? ` · ${esc(a ? a.name : card ? fxBoardOf(card) : 'Trello')}` : ''}</p><h1>${esc(name)}</h1>${card && card.url ? `<p class="small"><a class="link" href="${esc(card.url)}" target="_blank" rel="noopener">Open in Trello ↗</a></p>` : ''}${fxStopLine(fxStopNext())}</section>`;
  if (crumb) h += `<div class="note fx-crumb"><b>Last time you stopped at:</b> ${esc(crumb)}</div>`;
  if (a && (a.need || []).length) h += `<section class="card"><div class="sec-head"><h2>What you need</h2><span class="progress">${countDone('fxn:' + a.id, a.need)} of ${a.need.length}</span></div>${checklist('fxn:' + a.id, a.need)}</section>`;
  if (a && (a.links || []).length) h += `<div class="chips fx-links">${a.links.map(l => fxUrl(l.url) ? `<a class="chip" href="${esc(fxUrl(l.url))}" target="_blank" rel="noopener">${esc(l.text || l.url)} ↗</a>` : '').join('')}</div>`;
  h += `<section class="card"><h2>This session</h2>
    ${cards.length || S.ui.fxAll ? `<div class="fx-cardpick">${cards.map(c => `<button class="pill${P.card === c.id ? ' on' : ''}" data-act="fx-card" data-id="${esc(c.id)}" data-name="${esc(c.name)}">${esc(c.name)}</button>`).join('')}${!S.ui.fxAll ? '<button class="link" data-act="fx-allcards">All my tasks</button>' : ''}</div>` : (S.trello.cards || []).length ? '<button class="link" data-act="fx-allcards">Pick one of my Trello tasks</button>' : ''}
    <label class="small" for="fxIntent">Done for now means…</label><input type="text" id="fxIntent" data-fx="intent" value="${esc(P.intent || '')}" placeholder="e.g. ${P.fromTask ? 'the first part of it' : 'finish the first draft'}" maxlength="200">
    <label class="small" for="fxStep">The first tiny step</label><input type="text" id="fxStep" data-fx="step" value="${esc(P.step || '')}" placeholder="e.g. open the file and find where you were" maxlength="200">
    ${sample ? `<div class="actions"><button class="link" data-act="fx-sug" ${sug && sug.busy ? 'disabled' : ''}>${sug && sug.busy ? '✦ Thinking…' : '✦ Suggest tiny first steps'}</button></div>` : ''}
    ${sug && sug.err ? `<p class="note">${esc(sug.err)}</p>` : ''}${sug && sug.list ? `<div class="pills fx-sug">${sug.list.map(t => `<button class="pill" data-act="fx-step" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div>` : ''}
    <h3>Rhythm</h3><div class="pills fx-rhy">${FX_RHY.map(([v, l, sub]) => `<button class="pill${(P.rhythm || 'flow') === v ? ' on' : ''}" data-act="fx-rhy" data-v="${v}" title="${esc(sub)}">${l}</button>`).join('')}</div>
    <p class="muted small">${esc((FX_RHY.find(r => r[0] === (P.rhythm || 'flow')) || FX_RHY[0])[2])}.</p>
    <div class="fx-opts"><label class="small"><input type="checkbox" data-act="fx-opt" data-k="share" ${P.share !== false ? 'checked' : ''}> Let the household see I’m focusing</label>
      <label class="small"><input type="checkbox" data-act="fx-opt" data-k="noise" ${S.ui.fxNoiseOn ? 'checked' : ''}> Brown noise</label>
      <label class="small"><input type="checkbox" data-act="fx-opt" data-k="wake" ${S.ui.fxWakeOn ? 'checked' : ''}> Keep the screen on</label></div>
    <div class="actions"><button class="btn accent" data-act="fx-go">Start</button></div></section>`;
  return h;
}
function fxRunView(s) {
  const st = fxState(s), brk = s.phase === 'break', paused = !!s.offAt && !brk, blkDone = st.blockLeft != null && st.blockLeft <= 0, warn = st.stop && st.stopLeft <= 10 * 6e4;
  const main = brk ? st.brkLeft : st.blockLeft != null ? st.blockLeft : st.worked, sub = brk ? 'break left' : s.rhythm === 'flow' ? 'focused' : 'left in this block';
  let h = `<section class="hero fx-run"><p class="eyebrow">${esc(s.aname || fxAreaName(s.area))}${s.share ? ' · the household can see' : ''}</p><h1>${esc(s.intent || s.cardName || 'Focus')}</h1>${s.cardName && s.intent && s.intent !== s.cardName ? `<p class="small muted">Trello: ${esc(s.cardName)}</p>` : ''}${s.step && !brk ? `<p class="lede">First step: ${esc(s.step)}</p>` : ''}</section>`;
  if (warn) h += `<section class="card fx-warn"><h2>${st.stopLeft > 0 ? 'Ten minutes to land' : 'Time to land'}</h2><p>Write where you’ll pick up while it’s fresh. Next: ${esc(st.stop.why)}.</p><div class="actions"><button class="btn accent" data-act="fx-land">Land now</button></div></section>`;
  if (blkDone && s.rhythm === 'ten') h += `<section class="card fx-prompt"><h2>Ten minutes done. That was the hard part.</h2><div class="actions"><button class="btn accent" data-act="fx-flow">Keep going</button><button class="btn ghost" data-act="fx-land">Stop here, it counts</button></div></section>`;
  else if (blkDone) h += `<section class="card fx-prompt"><h2>Block done</h2><p class="muted small">A ${s.brk}-minute break keeps the next block good. In the groove? Keep going.</p><div class="actions"><button class="btn accent" data-act="fx-brk">Take the break</button><button class="btn ghost" data-act="fx-more">Another block</button><button class="link" data-act="fx-land">Land</button></div></section>`;
  if (brk && st.brkLeft <= 0) h += `<section class="card fx-prompt"><h2>Break’s over</h2><div class="actions"><button class="btn accent" data-act="fx-back2">Back to it</button><button class="link" data-act="fx-land">Land instead</button></div></section>`;
  if (!brk && s.rhythm === 'flow' && st.worked >= 90 * 6e4 && (s.body || 0) < Math.floor(st.worked / (90 * 6e4))) h += `<section class="card fx-prompt"><h2>${fxDur(Math.floor(st.worked / 6e4))} in. Body check.</h2><p class="muted small">Water, toilet, a stretch, food? Hyperfocus forgets the body.</p><div class="actions"><button class="btn ghost" data-act="fx-body">Done, back to it</button><button class="link" data-act="fx-land">Land</button></div></section>`;
  if (s.kind === 'home' && !brk) h += hmRunPanel(s);
  h += `<section class="card fx-ringcard"><div class="tring fx-ring${brk ? ' brk' : ''}${paused ? ' paused' : ''}"><svg viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="88" fill="none" stroke="var(--line)" stroke-width="18"/><circle id="fx-arc" cx="100" cy="100" r="88" fill="none" stroke="${brk ? 'var(--sea)' : 'var(--accent)'}" stroke-width="18" stroke-linecap="round" stroke-dasharray="${FX_C.toFixed(1)}" stroke-dashoffset="${(FX_C * (1 - fxFrac(s, st))).toFixed(1)}"/></svg>
    <div class="num"><b data-fx-clock="main">${fxClock(main)}</b><span class="muted small">${paused ? 'paused' : sub}</span></div></div>
    ${st.stop ? `<p class="fx-stop${warn ? ' late' : ''}">Until ${mm2t(st.stop.m)} · <span data-fx-clock="stop">${fxDur(Math.max(0, st.stopLeft / 6e4))}</span> · then ${esc(st.stop.why)}</p>` : ''}
    ${brk ? '<p class="muted small">Move, water, a window. Not the phone, if you can.</p>' : s.rhythm === 'flow' ? '<p class="muted small">Focus fading? That’s the signal to land, not a failure.</p>' : ''}
    <div class="actions fx-ctl">${brk ? `<button class="btn" data-act="fx-back2">Back to it</button>` : `<button class="btn ghost" data-act="fx-pause">${paused ? 'Resume' : 'Pause'}</button>`}<button class="btn ghost${S.ui.fxNoiseOn ? ' on' : ''}" data-act="fx-noise" aria-pressed="${!!S.ui.fxNoiseOn}">${S.ui.fxNoiseOn ? 'Noise off' : 'Brown noise'}</button><button class="btn" data-act="fx-land">I’m done · land</button></div></section>`;
  h += `<section class="card fx-catch"><h2>Not now</h2><p class="muted small">A thought that isn’t this? Park it here and get back. You’ll sort them when you land.</p>
    <form class="addform" data-form="fx-catch"><input type="text" name="text" placeholder="e.g. reply to that message, buy batteries" aria-label="A thought for later" required maxlength="200"><button class="btn" type="submit">Park it</button></form>
    ${(s.caught || []).length ? `<ul class="fx-caught">${s.caught.map(c => `<li>${esc(c.text)}</li>`).join('')}</ul>` : ''}</section>`;
  return h;
}
function fxLandView(s) {
  const mins = Math.round(fxState(s).worked / 6e4), c = s.caught || [];
  return `<section class="hero"><p class="eyebrow">Landing · ${esc(s.aname || fxAreaName(s.area))}</p><h1>${mins >= 1 ? fxDur(mins) + ' of focus' : 'You started'}. That counts.</h1></section>
    <section class="card"><label class="small" for="fxDid">What got done (even a bit)</label><input type="text" id="fxDid" value="${esc(S.ui.fxDid || (s.kind === 'home' ? hmDidText(s) : ''))}" placeholder="${esc(s.intent || s.cardName || 'e.g. the first half')}" maxlength="300">
      <label class="small" for="fxCrumb">Where to pick up next time</label><input type="text" id="fxCrumb" value="${esc(S.ui.fxCrumb || '')}" placeholder="e.g. halfway through step 3" maxlength="300">
      <p class="muted small">Future you starts faster with a breadcrumb.</p>
      ${s.card && mcp && (S.trello.cards || []).some(c => c.id === s.card) ? `<label class="small fx-trdone"><input type="checkbox" id="fxTrDone" ${S.ui.fxTrDone ? 'checked' : ''} data-act="fx-trdone"> “${esc(s.cardName || 'This task')}” is finished: mark it done in Trello</label>` : ''}
      ${s.px && pxGet(s.px.p) ? `<label class="small fx-trdone"><input type="checkbox" id="fxPxDone" ${S.ui.fxPxDone ? 'checked' : ''} data-act="fx-pxdone"> That step is done: tick it in “${esc(pxGet(s.px.p).title)}”</label>` : ''}
      <h3>How did it go?</h3><div class="pills">${FX_FEEL.map(([v, e, l]) => `<button class="pill${+S.ui.fxFeel === v ? ' on' : ''}" data-act="fx-feel" data-v="${v}" aria-label="${l}">${e} ${l}</button>`).join('')}</div></section>
    ${c.length ? `<section class="card"><h2>Parked thoughts</h2><ul class="fx-caught">${c.map(x => `<li>${esc(x.text)}</li>`).join('')}</ul><div class="actions">${mcp ? '<button class="btn" data-act="fx-c-dump">Sort into Trello</button>' : ''}<button class="btn ghost" data-act="fx-c-inbox">Into my inbox</button><button class="link" data-act="fx-c-drop">Let them go</button></div></section>` : ''}
    <div class="actions"><button class="btn accent" data-act="fx-save">Save and land</button><button class="link" data-act="fx-unland">Back, I’m not done</button></div>`;
}
async function fxSuggest() {
  const P = S.ui.fx; if (!P || !sample) return;
  const intent = String(($('#fxIntent') || {}).value || P.intent || '').trim(); P.intent = intent;
  S.ui.fxSug = { busy: true }; render(true);
  const text = `Suggest three different tiny first steps for an adult who is about to start a focus session and is finding it hard to begin.
Area: "${fxAreaName(P.area)}"${intent ? `\nWhat they want done this session: "${intent}"` : ''}${P.cardName ? `\nTrello task: "${P.cardName}"` : ''}
Rules: each step takes under two minutes, is concrete and physical or on-screen (like "Open the folder from Saturday's shoot"), one action, at most 10 words, starting with a verb. No advice, no numbering. Same language as the area or task.
Reply with only a JSON array of three strings.`;
  try { const out = await askClaude(text, { feature: 'focus-steps' }), arr = (Array.isArray(out) ? out : (out && out.steps) || []).map(x => String(x || '').trim()).filter(Boolean).slice(0, 3);
    S.ui.fxSug = arr.length ? { list: arr } : { err: 'Claude’s answer didn’t come through. Try again.' }; }
  catch (e) { S.ui.fxSug = { err: claudeWhy(e) }; }
  render(true);
}

/* ---------- Areas: edit what each area needs ---------- */
function vFocusAreas() {
  if (meValid() && !(fxDoc().seeded || {})[me]) setTimeout(fxSeed, 0);
  const as = fxAreas(), m0 = new Date(dk.slice(0, 7) + '-01T00:00:00').getTime();
  let h = `<section class="hero"><p class="eyebrow">Active · Areas</p><h1>What you work on</h1><p class="lede">Each area keeps what you need to start, its links and the Trello words that find its tasks.</p></section>`;
  h += as.map(a => { const ed = S.ui.fxEd === a.id, w = fxMins(a.id, fxWeek0()), mo = fxMins(a.id, m0), since = a.estFrom || 0, done = since ? fxMins(a.id, since) : 0;
    return `<section class="card fx-areacard"><div class="sec-head"><h2>${esc(a.name)}</h2><button class="link" data-act="fx-ed" data-id="${esc(a.id)}">${ed ? 'Done' : 'Edit'}</button></div>
      <p class="muted small">${w ? fxDur(w) + ' this week · ' : ''}${mo ? fxDur(mo) + ' this month' : 'Nothing logged this month'}${+a.est ? ` · ${fxHrs(done)} of about ${+a.est} h` : ''}</p>
      ${ed ? `<label class="small">Name <input type="text" data-fxset="name" data-id="${esc(a.id)}" value="${esc(a.name)}" maxlength="60"></label>
        <label class="small">Trello words (comma-separated) <input type="text" data-fxset="match" data-id="${esc(a.id)}" value="${esc(a.match || '')}" maxlength="200" placeholder="e.g. portfolio, figma"></label>
        <label class="small">About how many hours is the current piece of work? <input type="number" min="0" max="500" inputmode="numeric" data-fxset="est" data-id="${esc(a.id)}" value="${+a.est || ''}" placeholder="e.g. 15"></label>
        <h3>What you need</h3><ul class="edit-list">${(a.need || []).map(x => `<li><span class="txt">${esc(x.text)}</span><button class="chip x row-x" data-act="fx-need-x" data-id="${esc(a.id)}" data-i="${esc(x.id)}" aria-label="Remove ${esc(x.text)}">✕</button></li>`).join('')}</ul>
        <form class="addform" data-form="fx-need" data-id="${esc(a.id)}"><input type="text" name="text" placeholder="e.g. headphones" required maxlength="120" aria-label="Something you need"><button class="btn" type="submit">Add</button></form>
        <h3>Links</h3><ul class="edit-list">${(a.links || []).map(x => `<li><span class="txt">${esc(x.text)} <span class="muted small">${esc(x.url)}</span></span><button class="chip x row-x" data-act="fx-link-x" data-id="${esc(a.id)}" data-i="${esc(x.id)}" aria-label="Remove ${esc(x.text)}">✕</button></li>`).join('')}</ul>
        <form class="addform" data-form="fx-link" data-id="${esc(a.id)}"><input type="text" name="text" placeholder="Name" required maxlength="60" aria-label="Link name"><input type="text" name="url" placeholder="https://…" required maxlength="400" aria-label="Link address"><button class="btn" type="submit">Add</button></form>
        <div class="actions">${S.ui.fxDel === a.id ? `<button class="btn" data-act="fx-del-yes" data-id="${esc(a.id)}">Yes, remove ${esc(a.name)}</button><button class="link" data-act="fx-del" data-id="">Keep it</button>` : `<button class="link" data-act="fx-del" data-id="${esc(a.id)}">Remove this area</button>`}</div>`
      : `<p class="small">${(a.need || []).map(x => esc(x.text)).join(' · ') || '<span class="muted">Nothing to get ready</span>'}</p>`}</section>`; }).join('');
  h += `<form class="addform" data-form="fx-area"><input type="text" name="text" placeholder="A new area, e.g. Portfolio case study" required maxlength="60" aria-label="New area"><button class="btn" type="submit">Add</button></form>`;
  return h;
}

/* ---------- Done: a gentle log (no streaks) ---------- */
function vFocusLog() {
  const L = fxLog(), wk = fxMins('', fxWeek0()), cut = Date.now() - 14 * 864e5, recent = L.filter(x => x.start >= cut), by = {};
  for (const x of L.filter(x => x.start >= fxWeek0())) by[x.aname || fxAreaName(x.area)] = (by[x.aname || fxAreaName(x.area)] || 0) + (+x.mins || 0);
  let h = `<section class="hero"><p class="eyebrow">Active · Done</p><h1>${wk ? fxDur(wk) + ' of focus this week' : 'Nothing logged this week yet'}</h1><p class="lede">Every session counts, short ones too. No streaks here.</p></section>`;
  if (Object.keys(by).length) h += `<div class="chips">${Object.entries(by).sort((a, b) => b[1] - a[1]).map(([n, m]) => `<span class="chip">${esc(n)} · ${fxDur(m)}</span>`).join('')}</div>`;
  const days = {}; for (const x of recent) (days[keyOf(new Date(x.start))] = days[keyOf(new Date(x.start))] || []).push(x);
  h += Object.entries(days).map(([k, xs]) => `<section class="card"><div class="sec-head"><h3>${esc(fmtD(k))}</h3><span class="progress">${fxDur(xs.reduce((s, x) => s + (+x.mins || 0), 0))}</span></div><ul class="fx-log">${xs.map(x => `<li><b>${esc(x.cardName || x.aname || fxAreaName(x.area))}</b>${x.cardName ? ` <span class="muted small">${esc(x.aname || '')}</span>` : ''} · ${fxDur(+x.mins || 0)}${x.feel ? ' ' + (FX_FEEL.find(f => f[0] === x.feel) || [])[1] : ''}${x.did ? `<span class="def">${esc(x.did)}</span>` : x.intent ? `<span class="def">${esc(x.intent)}</span>` : ''}</li>`).join('')}</ul></section>`).join('');
  if (L.length > recent.length) h += `<p class="muted small">${L.length - recent.length} older sessions are kept for the totals in Areas.</p>`;
  if (!L.length) h += `<p class="note">Sessions show here after you land. <a class="link" href="#focus">Start one</a></p>`;
  return h;
}

/* ---------- inputs and forms ---------- */
document.addEventListener('input', e => { const el = e.target;
  if (el && el.dataset && 'fxq' in el.dataset) { const q = el.value.trim().toLowerCase(); document.querySelectorAll('.fx-tl li').forEach(li => { li.hidden = !!q && !li.dataset.n.includes(q); }); document.querySelectorAll('.fx-grp').forEach(g => { const any = [...g.querySelectorAll('li')].some(li => !li.hidden); g.hidden = !!q && !any; if (q && g.tagName === 'DETAILS' && any) g.open = true; }); return; } if (el && el.dataset && el.dataset.fx && S.ui.fx) S.ui.fx[el.dataset.fx] = el.value; if (el && (el.id === 'fxDid' || el.id === 'fxCrumb')) S.ui[el.id] = el.value; });
document.addEventListener('change', e => {
  const el = e.target; if (!el || !el.dataset || !el.dataset.fxset) return;
  const k = el.dataset.fxset, v = k === 'est' ? Math.max(0, Math.min(500, +el.value || 0)) : String(el.value || '').trim().slice(0, k === 'name' ? 60 : 200);
  if (k === 'name' && !v) return;
  fxSaveArea(el.dataset.id, k === 'est' ? { est: v, estFrom: v ? ((fxArea(el.dataset.id) || {}).est ? (fxArea(el.dataset.id) || {}).estFrom || Date.now() : Date.now()) : 0 } : { [k]: v });
});
function fxForm(f) {
  const fd = new FormData(f), text = String(fd.get('text') || '').trim(), id = f.dataset.id, a = id ? fxArea(id) : null; if (!text) return;
  if (f.dataset.form === 'fx-catch') { fxEdit(s => { s.caught = [...(s.caught || []), { id: uid(), text: text.slice(0, 200) }]; }); toast('Parked. Back to it.'); }
  else if (f.dataset.form === 'fx-area') { const nid = uid(); fxSaveArea(nid, { id: nid, owner: me, order: fxAreas().length, name: text.slice(0, 60), need: [], links: [] }); S.ui.fxEd = nid; }
  else if (f.dataset.form === 'fx-need' && a) fxSaveArea(id, { need: [...(a.need || []), { id: uid(), text: text.slice(0, 120) }] });
  else if (f.dataset.form === 'fx-link' && a) { const url = fxUrl(fd.get('url')); if (!url) return toast('That link needs to start with https://'); fxSaveArea(id, { links: [...(a.links || []), { id: uid(), text: text.slice(0, 60), url }] }); }
  f.reset(); render(true);
}

/* ---------- taps on this area's buttons (data-act), called from events.js; true = handled ---------- */
I.t_fnow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>';
I.t_fareas = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3.5l8.5 4.5-8.5 4.5L3.5 8z"/><path d="M3.5 12.5l8.5 4.5 8.5-4.5"/><path d="M3.5 16.5l8.5 4.5 8.5-4.5" opacity=".5"/></svg>';
I.t_fdone = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M8 12.5l2.8 2.8L16.5 9.5"/></svg>';
function tapFocus(a, el, e) {
  switch (a) {
    case 'fx-pick': { const ar = fxArea(el.dataset.id); S.ui.fx = { area: el.dataset.id, intent: '', step: '', card: '', rhythm: (ar && ar.rhythm) || 'flow', share: S.ui.share !== false }; S.ui.fxSug = null; S.ui.fxAll = false; S.ui.fxAfter = null; render(true); scrollTo(0, 0); return true; }
    case 'fx-task': { const c = fxTasks().find(x => x.id === el.dataset.id) || fxHandedOut().map(fxAsCard).find(x => x.id === el.dataset.id); if (!c) return true; const ar = fxAreaFor(c);
      S.ui.fx = { area: ar ? ar.id : '_other', aname: ar ? ar.name : fxBoardOf(c) || 'Trello', card: c.id, cardName: c.name, fromTask: true, intent: '', step: '', rhythm: (ar && ar.rhythm) || 'flow', share: S.ui.share !== false }; S.ui.fxSug = null; S.ui.fxAfter = null; render(true); scrollTo(0, 0); return true; }
    case 'fx-filter': S.ui.fxF = el.dataset.k; render(true); return true;
    case 'fx-rest': if (e && e.target && e.target.closest('summary')) setTimeout(() => { S.ui.fxRest = el.open; }, 0); return false;
    case 'fx-qs': { const c = fxTasks().find(x => x.id === el.dataset.id) || fxHandedOut().map(fxAsCard).find(x => x.id === el.dataset.id); if (!c) return true; const ar = fxAreaFor(c);
      fxStart({ area: ar ? ar.id : '_other', aname: ar ? ar.name : fxBoardOf(c) || 'Trello', card: c.id, cardName: c.name, fromTask: true, rhythm: (ar && ar.rhythm) || 'flow', intent: '', share: S.ui.share !== false }); return true; }
    case 'fx-trdone': S.ui.fxTrDone = el.checked; return true;
    case 'fx-pxdone': S.ui.fxPxDone = el.checked; return true;
    case 'fx-back': S.ui.fx = null; S.ui.fxSug = null; render(true); return true;
    case 'fx-ten': fxStart({ area: '_other', rhythm: 'ten', intent: 'Just ten minutes', share: S.ui.share !== false }); return true;
    case 'fx-rhy': if (S.ui.fx) { S.ui.fx.rhythm = el.dataset.v; render(true); } return true;
    case 'fx-opt': { const k = el.dataset.k; if (k === 'share' && S.ui.fx) S.ui.fx.share = el.checked; if (k === 'noise') S.ui.fxNoiseOn = el.checked; if (k === 'wake') S.ui.fxWakeOn = el.checked; return true; }
    case 'fx-card': if (S.ui.fx) { const on = S.ui.fx.card === el.dataset.id; S.ui.fx.card = on ? '' : el.dataset.id; S.ui.fx.cardName = on ? '' : el.dataset.name; if (!on && !String(S.ui.fx.intent || '').trim()) S.ui.fx.intent = el.dataset.name; render(true); } return true;
    case 'fx-allcards': S.ui.fxAll = true; render(true); return true;
    case 'fx-sug': fxSuggest(); return true;
    case 'fx-step': if (S.ui.fx) { S.ui.fx.step = el.dataset.t; render(true); } return true;
    case 'fx-go': { const P = S.ui.fx || {}, g = id => String(($('#' + id) || {}).value || '').trim(); fxStart({ ...P, intent: g('fxIntent') || P.intent || '', step: g('fxStep') || P.step || '' }); return true; }
    case 'fx-pause': fxEdit((s, now) => { if (s.offAt) fxResume(s, now); else { s.offAt = now; s.paused = true; } }); if (fxNow() && fxNow().offAt) fxNoise(false); else if (S.ui.fxNoiseOn) fxNoise(true); return true;
    case 'fx-noise': S.ui.fxNoiseOn = !S.ui.fxNoiseOn; fxNoise(S.ui.fxNoiseOn); render(true); return true;
    case 'fx-brk': fxEdit((s, now) => { s.phase = 'break'; s.offAt = now; s.brkLen = s.brk * 6e4; s.brkEnd = now + s.brkLen; s.blocks = (s.blocks || 0) + 1; }); return true;
    case 'fx-back2': fxEdit((s, now) => { fxResume(s, now); s.phase = 'work'; s.base = now - s.start - (s.off || 0); }); return true;
    case 'fx-more': fxEdit((s, now) => { s.base = now - s.start - (s.off || 0); s.blocks = (s.blocks || 0) + 1; }); return true;
    case 'fx-flow': fxEdit(s => { s.rhythm = 'flow'; }); return true;
    case 'fx-body': fxEdit((s, now) => { s.body = Math.floor(Math.max(0, now - s.start - (s.off || 0)) / (90 * 6e4)); }); return true;
    case 'fx-land': fxLand(); return true;
    case 'fx-unland': fxEdit((s, now) => { if (s.phase === 'land') { fxResume(s, now); s.phase = 'work'; s.endAt = 0; } }); if (S.ui.fxNoiseOn) fxNoise(true); return true;
    case 'fx-feel': S.ui.fxFeel = +el.dataset.v; render(true); return true;
    case 'fx-save': fxSaveLand(); S.ui.fxDid = ''; S.ui.fxCrumb = ''; return true;
    case 'fx-c-dump': { const s = fxNow(); if (!s) return true; S.ui.dumpText = [String(S.ui.dumpText || '').trim(), ...(s.caught || []).map(x => x.text)].filter(Boolean).join('\n'); fxEdit(n => { n.caught = []; }); S.ui.capture = true; S.ui.cap = null; render(true); return true; }
    case 'fx-c-inbox': { const s = fxNow(); if (!s) return true; saveInbox([...inbox(), ...(s.caught || []).map(x => ({ id: uid(), text: x.text, at: Date.now() }))]); fxEdit(n => { n.caught = []; }); toast('In your inbox, for the next brain dump.'); return true; }
    case 'fx-c-drop': fxEdit(n => { n.caught = []; }); return true;
    case 'fx-break-go': { const m = +el.dataset.min || 5; S.ui.fxAfter = null; try { restBreak(1); } catch (e) { console.warn(e); } startTimer(m, 'A real break'); return true; }
    case 'fx-after-x': S.ui.fxAfter = null; render(true); return true;
    case 'fx-ed': S.ui.fxEd = S.ui.fxEd === el.dataset.id ? '' : el.dataset.id; S.ui.fxDel = ''; render(true); return true;
    case 'fx-need-x': { const ar = fxArea(el.dataset.id); if (ar) fxSaveArea(ar.id, { need: (ar.need || []).filter(x => x.id !== el.dataset.i) }); return true; }
    case 'fx-link-x': { const ar = fxArea(el.dataset.id); if (ar) fxSaveArea(ar.id, { links: (ar.links || []).filter(x => x.id !== el.dataset.i) }); return true; }
    case 'fx-del': S.ui.fxDel = el.dataset.id; render(true); return true;
    case 'fx-del-yes': fxSaveArea(el.dataset.id, null); S.ui.fxDel = ''; S.ui.fxEd = ''; toast('Removed. Its logged time stays in Done.'); return true;
  }
  return false;
}
