/* Afloat · app/surroundings.js · Active → Focus → "Taking care of my surroundings" (10 Nov 2026): one place for making the house livable right now.
   Plain script: shares one scope with the other app/*.js files (loaded in order by index.html). See CLAUDE.md.

   Why it exists: single jobs on Rhythms don't get you cleaning. You need to be able to say "I want to make this place livable right now" and then
   have everything that helps in one place. It replaces what used to be scattered in Support (the Five-things reset, the "just tell me one thing"
   overlay) and connects what lives in Rhythms (today's beat, the every-few-days jobs that are ready), the rooms ("what livable means here",
   Rhythms → The house, room by room) and closing duties. It is a normal Focus session (timer, hard stop from the calendar, Not now, landing with a
   breadcrumb, the Done log) with a cleaning panel in the middle.

   What the research supports (README "Taking care of my surroundings" has the sources and how strong each one is):
   - starting is the barrier, not knowing what to do: an exact, tiny first step (an if-then plan) is easier to start than a good intention
     (Gawrilow and Gollwitzer on ADHD; the "first tiny step" field);
   - one central list and breaking a job into pieces that fit your attention span are the core of CBT for adult ADHD (Safren, Solanto): the
     panel shows one step, or one list, never the whole house;
   - time-limited sprints you are allowed to stop, with stray thoughts parked until after ("distractibility delay"): the session's timer and Not now;
   - bare-minimum versions and energy-matched lists (low-energy days get a smaller list), from ADHD cleaning guidance and KC Davis ("livable", five
     categories, good enough is perfect);
   - stimulation and company (music, a race against the timer, someone in the room: body doubling): the signal "Need company" and the little helpers.
   Body doubling has only weak, uncontrolled evidence so far and the clutter-and-cortisol finding is one small correlational study; both are used as
   gentle options, never as claims in the app.

   Data: session fields in home/focus.now[name]: kind: 'home', room (a space name or ''), way: 'reset'|'list'|'one', hstep (0-5, the Five-things step),
   skip [keys], cur (a pinned key), did [texts]. A per-person Focus area with kind: 'home' (what to have close, editable in Areas) is seeded once
   (home/focus.hmSeeded). Ticks go where they belong: room jobs in days/<dk>.done['sp:<id>'], Rhythms jobs through rjTick, closing duties as usual. */
const HM_NAME = 'Taking care of my surroundings';
const HM_AREA = { match: 'úklid, uklid, uklíz, nádobí, prádlo, vysav, tidy, clean, dishes, laundry, mop',
  need: ['A bin bag, within reach', 'A basket for the laundry', 'Music, a podcast, or a show for the girls', 'Water', 'A cloth and spray where you’re working'] };
const HM_WAYS = [['reset', 'Reset the room', 'Five things, one at a time: trash, dishes, laundry, things with a home, things without one.'],
  ['list', 'The essentials', 'What livable means here, today’s jobs and what’s ready. Tick what you do.'],
  ['one', 'Just one thing', 'I’ll pick it. You do it, then stop or ask for another.']];
const HM_RHY = [['ten', 'Just 10 min', 'Short, and you’re allowed to stop when it rings'], ['b25', '25 + 5', 'One block, then a break'], ['flow', 'Flow', 'Count up; stop when focus fades']];
/* the smallest versions, for when nothing else is left or the day is low */
const HM_MICRO = ['Put away five things that have a home', 'Clear one surface, just one', 'Empty one bin', 'Gather the cups and plates by the sink', 'Take the laundry basket to where it gets washed', 'Wipe one counter'];
const HM_HINTS = [
  'Make the first step tiny and exact, and say when: “after the kettle, I bag the trash”.',
  'Set the timer and stop when it rings. Stopping is allowed; starting is the hard part.',
  'One category at a time (all the trash, then all the dishes), so your eyes always know what they’re looking for.',
  'Bare minimum first: no dishes left overnight, clear walkways, the bin not overflowing. Everything else is a bonus.',
  'Music, a podcast or a race against the timer: a little stimulation helps the boring jobs.',
  'Someone in the room helps, even the girls. If you’re stuck, ask for company.',
  'A thought that isn’t this? Park it in Not now and keep going.',
  'Can’t decide where something goes? A “decide later” box counts as a home.',
  'Supplies where you use them (a cloth and spray in each bathroom, bags under the sink) remove half the starting trouble.'];
const hmArea = () => fxAreas().find(a => a.kind === 'home') || null;
const hmRoom = n => (H('spaces').spaces || []).find(x => x.name === n) || null;
const hmWayDefault = () => ['low', 'survival'].includes(hMode()) ? 'one' : 'reset';
/* the area is seeded once per person, after Focus's own areas; remove it in Areas and it stays removed */
function hmEnsure() {
  const F = fxDoc(); if (!meValid() || !(F.seeded || {})[me] || (F.hmSeeded || {})[me] || S.ui.hmSeeded) return; S.ui.hmSeeded = true;
  const A = { ...(F.areas || {}) };
  if (!Object.values(A).some(a => a && a.kind === 'home' && (!a.owner || a.owner === me))) { const id = uid(); A[id] = { id, owner: me, order: -1, kind: 'home', name: HM_NAME, match: HM_AREA.match, need: HM_AREA.need.map(t => t.replace(', or a show for the girls', kidsList().length ? `, or a show for ${theKids()}` : '')).map(t => ({ id: uid(), text: t })), links: [] }; }
  saveHome('focus', { ...F, areas: A, hmSeeded: { ...(F.hmSeeded || {}), [me]: true } });
}

/* ---------- what's in the way right now ("Can't do that right now") ----------
   A blocker is a plain string in s.block (or S.ui.hmBlock before a session starts, and kept for the next one):
   'quiet' (someone is sleeping: nothing noisy), 'hands' (hands full / the girls need me: only the very small), 'time' (only a few minutes),
   'room:<name>' (can't go in there, or get things from there), 'word:<text>' (can't get to / don't have that: any job that mentions it).
   Jobs that clash are not deleted, they wait: they show as "Waiting for later" and come back when the blocker is cleared. */
const HM_NOISY = /vysav|vacuum|hoover|\bmop|vrta|drill|hlučn|noisy|fén/i;
const hmBlocks = s => (s ? s.block : S.ui.hmBlock) || [];
function hmBlockLabel(b) { const k = b.split(':')[0], v = b.slice(b.indexOf(':') + 1); return k === 'quiet' ? 'Quiet: someone’s sleeping' : k === 'hands' ? 'Hands full' : k === 'time' ? 'Only a few minutes' : k === 'room' ? `Not in ${v}` : `Can’t get to “${v}”`; }
function hmBlocked(text, min, room, bl) {
  const t = String(text).toLowerCase();
  return (bl || []).some(b => b === 'quiet' ? HM_NOISY.test(text) : b === 'hands' ? min > 3 : b === 'time' ? min > 5
    : b.startsWith('room:') ? room === b.slice(5) || t.includes(b.slice(5).toLowerCase()) : b.startsWith('word:') ? t.includes(b.slice(5)) : false);
}
function hmSetBlocks(fn) { const nx = fn(hmBlocks(fxNow())); S.ui.hmBlock = nx; if (fxNow()) fxEdit(s => { s.block = nx; }); else render(true); }
function hmBlockPicker(bl, k) {
  const spaces = H('spaces').spaces || [], on = b => bl.includes(b), kk = k ? ` data-k="${esc(k)}"` : '';
  const pill = (b, l) => `<button class="pill${on(b) ? ' on' : ''}" data-act="hm-blk" data-b="${esc(b)}"${kk} aria-pressed="${on(b)}">${l}</button>`;
  return `<div class="pills">${pill('quiet', 'Someone’s sleeping (no noise)')}${pill('hands', 'My hands are full')}${pill('time', 'Only a few minutes')}</div>
    <p class="muted small">A room I can’t go into (or get things from):</p><div class="pills">${spaces.map(x => pill('room:' + x.name, esc(x.name))).join('')}</div>
    <p class="muted small">Something I can’t get to or don’t have (towels, a bin bag…):</p><div class="addform"><input type="text" id="hmWord" maxlength="30" placeholder="e.g. clean towels" aria-label="Something I can’t get to"><button class="btn" data-act="hm-blkword"${kk}>Add</button></div>`;
}
const hmBlockChips = bl => bl.length ? `<div class="chips hm-blocks">${bl.map(b => `<button class="chip" data-act="hm-blkx" data-b="${esc(b)}" aria-label="Clear: ${esc(hmBlockLabel(b))}">${esc(hmBlockLabel(b))} ✕</button>`).join('')}</div>` : '';

/* ---------- what is on offer: one pool, for this room, today's energy and time of day ---------- */
function hmPool(roomName, bl = []) {
  const mode = hMode(), surv = mode === 'survival', low = mode === 'low', sp = hmRoom(roomName), bp = beatPlan(), seen = new Set();
  const lim = (a, n) => low ? a.slice(0, n) : a;
  const room = surv || !sp ? [] : lim(sp.tasks || [], 3);
  const beat = [...bp.base, ...(low ? [] : [...bp.extras, ...(bp.more || [])])]; beat.forEach(j => seen.add(j.key));
  const ready = surv ? [] : lim(rjAll().filter(j => j.kind === 'e' && rjMine(j) && inSeason(j) && !beatHidden(j.key) && !seen.has(j.key) && !rjSchOf(j.key) && ['due', 'soon'].includes(rjState(j))), 2);
  const cs = closingDue() ? closingSet() : null;
  const held = [], okj = (t, m, rm) => { if (!hmBlocked(t, m, rm, bl)) return true; held.push(t); return false; };
  const roomK = room.filter(t => okj(t.text, 0, roomName)), beatK = beat.filter(j => rjDone(j) || okj(j.text, +j.min || 0, '')), readyK = ready.filter(j => rjDone(j) || okj(j.text, +j.min || 0, ''));
  const clK = cs && cs.cl.length ? { ...cs, cl: cs.cl.filter(x => okj(x.text, +x.min || 0, '')) } : null;
  return { sp, room: roomK, beat: beatK, ready: readyK, cl: clK && clK.cl.length ? clK : null, low, surv, held };
}
/* the order "just one thing" works through: this room, today's rhythm, what's ready, closing duties, then the small ones */
function hmCands(s) {
  const P = hmPool(s.room, s.block || []), skip = s.skip || [], out = [], dn = S.day.done || {};
  const push = (k, text, min, src) => { if (!skip.includes(k)) out.push({ k, text, min: +min || 0, src }); };
  for (const t of P.room) if (!isDone(dn['sp:' + t.id])) push('d:sp:' + t.id, t.text, 0, 'what livable means here');
  for (const j of P.beat) if (!rjDone(j)) push('rj:' + j.key, j.text, j.min, 'today’s rhythm');
  for (const j of P.ready) if (!rjDone(j)) push('rj:' + j.key, j.text, j.min, 'ready when you are');
  if (P.cl) for (const x of P.cl.cl) if (!isDone(dn[P.cl.pre + ':' + x.id])) push('d:' + P.cl.pre + ':' + x.id, x.text, x.min, 'closing duties');
  HM_MICRO.forEach((t, i) => { if (!hmBlocked(t, 2, '', s.block || [])) push('mc:' + i, t, 2, 'a small one'); });
  if (s.cur && !out.some(x => x.k === s.cur) && s.cur.startsWith('rj:')) { const j = rjFind(s.cur.slice(3)); if (j && !rjDone(j)) out.unshift({ k: s.cur, text: j.text, min: +j.min || 0, src: 'from Self-care' }); }
  const cur = s.cur && out.find(x => x.k === s.cur);
  return cur ? [cur, ...out.filter(x => x !== cur)] : out;
}
function hmDoItem(k, text) {
  if (k.startsWith('rj:')) { const j = rjFind(k.slice(3)); if (j && !rjDone(j)) rjTick(j.key); }
  else if (k.startsWith('d:')) toggleKey('day', k.slice(2), true);
  fxEdit(s => { s.did = [...(s.did || []), String(text).slice(0, 80)].slice(-30); s.cur = ''; });
}
/* what got done, for the landing: your own Done taps, room jobs and weekly or monthly jobs ticked since the session began, and the Five-things steps */
function hmDidText(s) {
  const t = s.start || 0, out = [...(s.did || [])], sps = (H('spaces').spaces || []).flatMap(x => x.tasks || []);
  for (const [k, v] of Object.entries(S.day.done || {})) if (k.startsWith('sp:') && isDone(v) && v.at >= t) { const x = sps.find(y => y.id === k.slice(3)); if (x && !out.includes(x.text)) out.push(x.text); }
  for (const j of rjAll()) { const v = j.kind === 'w' ? (S.week.done || {})['r:' + j.id] : j.kind === 'm' ? (S.month.done || {})['mm:' + j.id] : j.kind === 'y' ? (S.month.done || {})['m:' + j.id] : null; if (isDone(v) && v.at >= t && !out.includes(j.text)) out.push(j.text); }
  const five = s.way === 'reset' && s.hstep ? `${s.room || 'Room'} reset: ${STEPS.slice(0, Math.min(STEPS.length, s.hstep)).map(x => x.title.toLowerCase()).join(', ')}` : '';
  return [five, ...out].filter(Boolean).join('; ').slice(0, 300);
}
/* an old Today card, "Resets today", still reads these; a finished Five-things session writes one */
function hmLogReset(s) { mergeDoc('days/' + dk, { done: { ['reset:' + uid()]: { by: me, at: Date.now(), space: s.room || 'A room', partial: (+s.hstep || 0) < STEPS.length } } }); }

/* ---------- the door: a card on top of the Focus picker ---------- */
function hmEntry() {
  const w = fxMins((hmArea() || {}).id, fxWeek0()), c = hmArea() && hmArea().crumb && hmArea().crumb.text, low = ['low', 'survival'].includes(hMode());
  return `<button class="fx-home" data-act="hm-open"><span class="ic" aria-hidden="true">${I.reset}</span><span class="txt"><b>${HM_NAME}</b><span>${low ? 'A small version for a low-energy day' : 'Make this place livable right now'}</span>${c ? `<span class="crumb">↳ ${esc(c)}</span>` : ''}${w ? `<span class="fx-wk">${fxDur(w)} this week</span>` : ''}</span><span class="go" aria-hidden="true">›</span></button>`;
}
function hmGo() { S.ui.hm = { room: S.ui.hmLastRoom || '', way: '', rhythm: 'ten', step: '', share: S.ui.share !== false }; S.ui.fx = null; S.ui.fxAfter = null; if (S.view !== 'focus') location.hash = 'focus'; render(true); scrollTo(0, 0); }

/* ---------- the hub: where, how, how long, the first step, and everything that's in it ---------- */
function hmFirst(way, P) {
  if (way === 'reset') return 'Grab a bag and pick up the trash' + (P.room ? ` in ${P.room}` : '');
  const c = hmCands({ room: P.room, skip: [], block: hmBlocks(null) })[0]; return c ? c.text : 'Put away five things that have a home';
}
function hmListHtml(items) { return `<ul class="small">${items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`; }
function hmDet(title, n, body, open) { return body ? `<details class="hm-det"${open ? ' open' : ''}><summary><b>${title}</b>${n ? ` <span class="muted small">${n}</span>` : ''}</summary>${body}</details>` : ''; }
function hmPreview(P, pool) {
  const sp = pool.sp, rt = sp ? (sp.tasks || []).map(t => t.text) : [];
  return hmDet('The five steps', STEPS.length, `<ol class="small">${STEPS.map(x => `<li><b>${x.title}.</b> <span class="muted">${x.do}</span></li>`).join('')}</ol>`)
    + (sp ? hmDet(`What livable means in ${esc(sp.name)}`, rt.length, rt.length ? hmListHtml(rt) : '<p class="muted small">Nothing written yet. Add what “livable” means here in Rhythms → The house, room by room.</p>') : '')
    + hmDet('Today’s rhythm', pool.beat.length, pool.beat.length ? hmListHtml(pool.beat.map(j => j.text)) : '')
    + hmDet('Ready when you are', pool.ready.length, pool.ready.length ? hmListHtml(pool.ready.map(j => j.text)) : '')
    + (pool.cl ? hmDet('Closing duties', pool.cl.cl.length, hmListHtml(pool.cl.cl.map(x => x.text))) : '')
    + hmDet('The small ones', HM_MICRO.length, hmListHtml(HM_MICRO))
    + hmDet('What helps', HM_HINTS.length, hmListHtml(HM_HINTS));
}
function hmHubView() {
  const P = S.ui.hm, a = hmArea(), mode = hMode(), way = P.way || hmWayDefault(), pool = hmPool(P.room, hmBlocks(null)), spaces = H('spaces').spaces || [], slipIdx = S.ui.slip ?? (Math.floor(Date.now() / 864e5) % SLIPS.length), rhy = P.rhythm || 'ten';
  let h = `<section class="hero fx-hero"><p class="eyebrow"><button class="link" data-act="hm-back">‹ Back</button> · Active · Focus</p><h1>Make this place livable</h1><p class="lede">Livable, not perfect. Choose where and how, and everything that helps is in one place.</p>${fxStopLine(fxStopNext())}</section>`;
  if (mode === 'survival' || mode === 'low') h += `<p class="note small">${MODES[mode].label} today, so the lists are kept small. The Five-things reset is still here if you want it.</p>`;
  h += `<button class="slip" data-act="slip" aria-label="Show another reminder">${I.ring}<p>${esc(SLIPS[slipIdx])}<small>Tap for another</small></p></button>`;
  h += `<section class="card"><h2>Where?</h2>${floorsOf(spaces).filter(f => f[0] !== 'garden').map(([k, l, list]) => `<div class="floorpick"><span class="eyebrow">${l}</span><div class="pills">${list.map(s => `<button class="pill${P.room === s.name ? ' on' : ''}" data-act="hm-room" data-name="${esc(s.name)}">${esc(s.name)}</button>`).join('')}</div></div>`).join('')}<div class="pills"><button class="pill${!P.room ? ' on' : ''}" data-act="hm-room" data-name="">Wherever I am</button></div></section>`;
  h += `<section class="card"><h2>How?</h2><div class="hm-ways">${HM_WAYS.map(([k, t, sub]) => `<button class="hm-way${way === k ? ' on' : ''}" data-act="hm-way" data-v="${k}" aria-pressed="${way === k}"><b>${t}</b><span>${sub}</span></button>`).join('')}</div>
    <h3>How long?</h3><div class="pills">${HM_RHY.map(([v, l]) => `<button class="pill${rhy === v ? ' on' : ''}" data-act="hm-rhy" data-v="${v}">${l}</button>`).join('')}</div><p class="muted small">${esc((HM_RHY.find(r => r[0] === rhy) || HM_RHY[0])[2])}.</p></section>`;
  const first = hmFirst(way, P), bl = hmBlocks(null);
  h += `<section class="card hm-block"><details${bl.length ? ' open' : ''}><summary><b>Anything in the way right now?</b>${bl.length ? ` <span class="muted small">${bl.length}</span>` : ''}</summary><p class="muted small">Someone asleep, hands full, can’t get to something: say so and I’ll only offer what you can do.</p>${hmBlockChips(bl)}${hmBlockPicker(bl)}</details></section>`;
  h += `<section class="card"><h2>The first tiny step</h2><p class="muted small">Saying exactly what you’ll do first makes starting easier than a good intention. Change it if you like.</p>
    <input type="text" id="hmStep" data-hm="step" value="${esc(P.step || '')}" placeholder="${esc(first)}" maxlength="200" aria-label="The first tiny step"><div class="pills"><button class="pill" data-act="hm-step" data-t="${esc(first)}">${esc(first)}</button></div></section>`;
  h += `<section class="card"><div class="sec-head"><h2>What’s in it</h2></div><p class="muted small">You only ever look at the part you’re on. This is all of it, if you want to see.</p>${hmPreview(P, pool)}</section>`;
  if (a && (a.need || []).length) h += `<section class="card"><div class="sec-head"><h2>Close at hand</h2><span class="progress">${countDone('fxn:' + a.id, a.need)} of ${a.need.length}</span></div>${checklist('fxn:' + a.id, a.need)}</section>`;
  h += `<div class="actions hm-start"><button class="btn accent big" data-act="hm-start">Start</button></div><label class="small hm-share"><input type="checkbox" data-act="hm-share" ${P.share !== false ? 'checked' : ''}> Let the household see I’m focusing</label>`;
  return h;
}
function hmStart() {
  const P = S.ui.hm; if (!P) return; const a = hmArea(), way = P.way || hmWayDefault(), step = String(P.step || '').trim() || hmFirst(way, P);
  S.ui.hmLastRoom = P.room;
  fxStart({ area: a ? a.id : '_other', aname: HM_NAME, kind: 'home', room: P.room, way, block: hmBlocks(null), rhythm: P.rhythm || 'ten', share: P.share !== false, step,
    intent: way === 'reset' ? `Reset ${P.room || 'the room'}` : way === 'one' ? 'Just one thing' : `Livable essentials${P.room ? ' · ' + P.room : ''}` });
  S.ui.hm = null; render(true);
}
/* from Self-care's "Clean one thing": ten minutes on that job, straight away */
function hmQuick(key) {
  const j = rjFind(key), a = hmArea(); if (!j) return;
  S.ui.hmLastRoom = ''; fxStart({ area: a ? a.id : '_other', aname: HM_NAME, kind: 'home', room: '', way: 'one', block: hmBlocks(null), cur: 'rj:' + j.key, rhythm: 'ten', share: S.ui.share !== false, intent: j.text, step: '' });
}

/* ---------- while it runs: the panel under the hero, above the clock ---------- */
function hmReset(s, P) {
  const i = Math.max(0, +s.hstep || 0);
  if (i < STEPS.length) { const st = STEPS[i];
    return `<section class="card stepcard hm-step" data-sw-l="[data-act=hm-next]" data-sw-kind="page"><p class="eyebrow">${esc(s.room || 'Reset')} · step ${i + 1} of ${STEPS.length}</p><div class="steps-dots" aria-hidden="true">${STEPS.map((_, k) => `<span class="${k <= i ? 'on' : ''}"></span>`).join('')}</div>
      <h2>${st.title}</h2><p>${st.do}</p><div class="dont">${I.no}<span>${st.dont}</span></div>${stepKids(st) ? `<p class="kids"><b>Little helpers:</b> ${esc(stepKids(st))}</p>` : ''}
      <div class="actions"><button class="btn accent big" data-act="hm-next">${i < STEPS.length - 1 ? 'Done, next' : 'Done, wrap up'}</button><button class="link" data-act="hm-next">Skip this one</button></div>
      ${i < 2 ? '<p class="muted small">Trash and dishes come first because they attract bugs and mould. If that’s all you manage, that’s a real accomplishment.</p>' : ''}</section>`; }
  return `<section class="card hm-step"><p class="eyebrow">${esc(s.room || 'Reset')} · wrap up</p><h2>Last bit: out the door.</h2><p>Take the trash bag out to the bin and drop the laundry basket by the washer. The room is livable now.</p><p class="muted">The dishes can be tomorrow’s job. Saving them for another day is allowed.</p>
    ${P.sp && (P.sp.tasks || []).length ? `<h3>What livable means here</h3><p class="muted small">Only if you have a minute more. None of it is required.</p>${checklist('sp', P.sp.tasks)}` : ''}
    <div class="actions"><button class="btn accent big" data-act="fx-land">Land: that counts</button></div></section>`;
}
function hmOne(s) {
  const c = hmCands(s), cur = c[0], n = (s.did || []).length, bl = s.block || [], put = (s.skip || []).length;
  if (!cur) return `<section class="card hm-one"><h2>${bl.length || put ? 'Nothing fits right now.' : 'That’s everything for now.'}</h2><p class="lede">${bl.length || put ? 'That’s fine. Rest is part of the plan, or clear what’s in the way and I’ll look again.' : 'You can stop here. Rest is part of the plan.'}</p>${hmBlockChips(bl)}${put ? '<button class="link" data-act="hm-unskip">Bring back the ones I put off</button>' : ''}<div class="actions"><button class="btn accent big" data-act="fx-land">Land: that counts</button></div></section>`;
  if (S.ui.hmWhy) return `<section class="card hm-one"><p class="eyebrow">${esc(cur.text)}</p><h2>What’s in the way?</h2><p class="muted small">Pick one and I’ll find something you can do now. This one waits for later.</p>
    <div class="pills"><button class="pill" data-act="hm-skip" data-k="${esc(cur.k)}">Just not this one</button></div>${hmBlockPicker(bl, cur.k)}<div class="actions"><button class="link" data-act="hm-why-x">Never mind</button></div></section>`;
  return `<section class="card hm-one"><p class="eyebrow">Just this one${cur.min ? ` · about ${cur.min} min` : ''} <span class="muted">· ${esc(cur.src)}</span></p><h2>${esc(cur.text)}</h2>
    <div class="actions"><button class="btn accent big" data-act="hm-done" data-k="${esc(cur.k)}">Done</button><button class="btn ghost" data-act="hm-cant">Can’t do that right now</button></div>${hmBlockChips(bl)}
    <p class="muted small">${n ? `${n} done so far. That counts. ` : ''}${c.length > 1 ? 'You only have to look at one.' : 'This is the last one.'} Stopping after any of them is fine.</p></section>`;
}
function hmList(s, P) {
  const dn = S.day.done || {}, rows = js => `<ul class="rj-l">${js.map(j => rjRow(j, { skip: true, noSch: true })).join('')}</ul>`;
  const room = P.sp ? P.room : [], clItems = P.cl ? P.cl.cl : [];
  const total = room.length + P.beat.length + P.ready.length + clItems.length, done = room.filter(t => isDone(dn['sp:' + t.id])).length + P.beat.filter(rjDone).length + P.ready.filter(rjDone).length + (P.cl ? countDone(P.cl.pre, P.cl.cl) : 0);
  return `<section class="card hm-list"><div class="sec-head"><h2>Your list</h2><span class="progress">${done} of ${total}</span></div>${hmBlockChips(s.block || [])}
    ${P.low ? '<p class="note small">A small list for a low-energy day. Part of it counts.</p>' : ''}
    ${room.length ? `<h3>Livable in ${esc(P.sp.name)}</h3>${checklist('sp', room)}` : ''}
    ${P.beat.length ? `<h3>Today’s rhythm</h3>${rows(P.beat)}` : ''}
    ${P.ready.length ? `<h3>Ready when you are</h3>${rows(P.ready)}` : ''}
    ${P.cl ? `<h3>Closing duties</h3>${checklist(P.cl.pre, P.cl.cl)}` : ''}
    ${P.held.length ? `<details class="hm-det"><summary><b>Waiting for later</b> <span class="muted small">${P.held.length}</span></summary>${hmListHtml(P.held)}<p class="muted small">Not lost: they come back when what’s in the way is cleared.</p></details>` : ''}
    ${total ? (done === total ? '<p class="alldone">All of it. The place can look after you again for a while.</p>' : '<p class="muted small">Any one of these is enough. Not today is always an option.</p>') : '<p class="empty">Nothing on the list right now. That’s allowed. “Just one thing” has a small one for you.</p>'}</section>`;
}
function hmRunPanel(s) {
  const way = s.way || 'list', P = hmPool(s.room, s.block || []);
  return (way === 'reset' ? hmReset(s, P) : way === 'one' ? hmOne(s) : hmList(s, P))
    + `<section class="card hm-help"><div class="hm-switch"><span class="muted small">Change how:</span><div class="pills">${HM_WAYS.map(([k, t]) => `<button class="pill${way === k ? ' on' : ''}" data-act="hm-switch" data-v="${k}">${t}</button>`).join('')}</div></div>
    ${way === 'one' ? '' : hmDet('Something in the way?', (s.block || []).length || '', hmBlockChips(s.block || []) + hmBlockPicker(s.block || []), (s.block || []).length > 0)}
    <div class="actions"><button class="btn ghost" data-act="hm-company">Ask for company</button><a class="link" href="#stuck">Can’t get started?</a><a class="link" href="#breakdown">Too big?</a></div>
    ${hmDet('What helps', '', hmListHtml(HM_HINTS))}</section>`;
}

/* ---------- taps and typing ---------- */
document.addEventListener('input', e => { const el = e.target; if (el && el.dataset && el.dataset.hm && S.ui.hm) S.ui.hm[el.dataset.hm] = el.value; });
function tapSurround(a, el, e) {
  switch (a) {
    case 'hm-open': case 'hm-go': hmGo(); return true;
    case 'hm-back': S.ui.hm = null; render(true); return true;
    case 'hm-room': if (S.ui.hm) { S.ui.hm.room = el.dataset.name; render(true); } return true;
    case 'hm-way': if (S.ui.hm) { S.ui.hm.way = el.dataset.v; S.ui.hm.step = ''; render(true); } return true;
    case 'hm-rhy': if (S.ui.hm) { S.ui.hm.rhythm = el.dataset.v; render(true); } return true;
    case 'hm-step': if (S.ui.hm) { S.ui.hm.step = el.dataset.t; render(true); } return true;
    case 'hm-share': if (S.ui.hm) S.ui.hm.share = el.checked; return true;
    case 'hm-start': hmStart(); return true;
    case 'hm-next': fxEdit(s => { s.hstep = Math.min(STEPS.length, (+s.hstep || 0) + 1); }); scrollTo(0, 0); return true;
    case 'hm-done': { const s = fxNow(), c = s && hmCands(s).find(x => x.k === el.dataset.k); if (c) hmDoItem(c.k, c.text); return true; }
    case 'hm-skip': S.ui.hmWhy = false; fxEdit(s => { s.skip = [...(s.skip || []), el.dataset.k]; s.cur = ''; }); return true;
    case 'hm-cant': S.ui.hmWhy = true; render(true); return true;
    case 'hm-why-x': S.ui.hmWhy = false; render(true); return true;
    case 'hm-unskip': fxEdit(s => { s.skip = []; }); return true;
    case 'hm-blk': case 'hm-blkword': {
      const b = a === 'hm-blk' ? el.dataset.b : 'word:' + String(($('#hmWord') || {}).value || '').trim().toLowerCase().slice(0, 30), k = el.dataset.k;
      if (b === 'word:') return true;
      S.ui.hmWhy = false; const had = hmBlocks(fxNow()).includes(b);
      hmSetBlocks(l => a === 'hm-blk' && had ? l.filter(x => x !== b) : l.includes(b) ? l : [...l, b]);
      if (k && !had && fxNow()) fxEdit(s => { s.skip = [...(s.skip || []), k]; s.cur = ''; }); return true; }
    case 'hm-blkx': hmSetBlocks(l => l.filter(x => x !== el.dataset.b)); return true;
    case 'hm-switch': fxEdit(s => { s.way = el.dataset.v; s.cur = ''; }); return true;
    case 'hm-company': setSignal('company', 45); return true;
    case 'slip': { const cur = S.ui.slip ?? (Math.floor(Date.now() / 864e5) % SLIPS.length); S.ui.slip = (cur + 1) % SLIPS.length; render(true); return true; }
  }
  return false;
}
