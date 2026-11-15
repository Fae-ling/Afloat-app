/* Afloat · app/self-care.js · Self-care (ticks, water, rest breaks, stars), personal mornings, evening prep and My setup (home/people).
   Plain script: shares one scope with the other app/*.js files (loaded in order by index.html). See CLAUDE.md. */
/* ---------- self-care: personal ticks, water, stars ---------- */
const CARE_GROUPS = ['Morning', 'Meals', 'Through the day', 'Evening'];
const STARMSG = ['★ Gold star!', '★ Nice. Body maintained.', '★ That’s care, not a chore.', '★ Look at you, looking after you.', '★ Tiny win, real win.', '★ Your future self says thank you.', '★ Shiny. Keep going.'];
const careOf = n => ((S.day.care || {})[n]) || {};
const waterGoal = () => +(H('lists').waterGoal || 8);
const toMin = t => { const [a, b] = String(t || '0:0').split(':'); return (+a || 0) * 60 + (+b || 0); };
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
/* rest breaks (5 Nov 2026, replacing the Rest tab): at least four 15-minute breaks a day, just for you; each earns a star */
const REST_GOAL = 4;
function careStars(n) { const c = careOf(n); return (H('lists').care || []).filter(x => isDone(c[x.id])).length + Math.min(+c.water || 0, waterGoal()) + Math.min(+c.rest || 0, REST_GOAL); }
const careMax = () => (H('lists').care || []).length + waterGoal() + REST_GOAL;
function restBreak(d) {
  if (!meOk()) return;
  const other = otherOf(me), before = careStars(me), n = Math.max(0, Math.min(12, (+careOf(me).rest || 0) + d));
  setCare({ rest: n });
  if (d > 0) {
    let msg = n === REST_GOAL ? '★★ Four breaks today. That’s looking after you.' : n < REST_GOAL ? `★ Break ${n} of ${REST_GOAL}.` : '★ A bonus break. Good.';
    if (other && before <= careStars(other) && careStars(me) > careStars(other)) msg += ` You just pulled ahead of ${other}.`;
    toast(msg);
  }
  render(true);
}
function restCard() {
  const r = +careOf(me).rest || 0, other = otherOf(me), ro = other ? +careOf(other).rest || 0 : 0;
  return `<section class="card"><div class="sec-head"><h2>Rest breaks</h2><span class="progress">${r} of ${REST_GOAL}${r >= REST_GOAL ? ' ★' : ''}</span></div>
    <div class="drops rest" aria-hidden="true">${Array.from({ length: Math.max(REST_GOAL, r) }, (_, i) => `<span class="drop${i < r ? ' on' : ''}"></span>`).join('')}</div>
    <p class="muted small">Four small breaks a day, about 15 minutes each, just for you: something you choose, that recharges you, and not on call. Scrolling while refereeing snacks doesn’t count.${other ? ` ${esc(other)}: ${ro} of ${REST_GOAL}.` : ''}</p>
    <div class="actions"><button class="btn accent" data-act="rest-timer">Start a 15-minute break</button><button class="btn ghost" data-act="rest" data-d="1">+ I took one</button><button class="btn ghost" data-act="rest" data-d="-1" ${r ? '' : 'disabled'}>Undo</button></div></section>`;
}
const weekStars = n => Object.values(((S.week.care || {})[n]) || {}).reduce((a, v) => a + (+v || 0), 0);
function groupDone(n, g) { const its = (H('lists').care || []).filter(x => (x.group || 0) === g); return its.length > 0 && its.every(x => isDone(careOf(n)[x.id])); }
function setCare(patch) {
  S.day = { ...S.day, care: { ...(S.day.care || {}), [me]: { ...careOf(me), ...patch } } };
  mergeDoc('days/' + dk, { care: { [me]: patch } });
  const st = careStars(me), wc = S.week.care || {};
  S.week = { ...S.week, care: { ...wc, [me]: { ...(wc[me] || {}), [dk]: st } } };
  mergeDoc('weeks/' + wk, { care: { [me]: { [dk]: st } } });
}
const meOk = () => { if (me && members().some(m => m.name === me)) return true; toast('Choose who you are first, on the Today tab.'); return false; };
function toggleCare(id, force) {
  if (!meOk()) return;
  const it = (H('lists').care || []).find(x => x.id === id); if (!it) return;
  if (it.kind === 'clean' && !force && !isDone(careOf(me)[id])) { const j = careOf(me).cleanJob && rjFind(careOf(me).cleanJob); if (j && !rjDone(j)) return cleanDone(id); S.ui.cleanPick = !S.ui.cleanPick; render(true); return; }
  const on = isDone(careOf(me)[id]), g = it.group || 0, wasDone = groupDone(me, g), other = otherOf(me), before = careStars(me);
  setCare({ [id]: on ? null : { at: Date.now() } });
  if (!on) {
    let msg = STARMSG[Math.floor(Math.random() * STARMSG.length)];
    if (!wasDone && groupDone(me, g)) msg = `★★ ${CARE_GROUPS[g]} complete!`;
    if (careStars(me) === careMax()) msg = '★★★ Every self-care box today. Legendary.';
    if (other && before <= careStars(other) && careStars(me) > careStars(other)) msg += ` You just pulled ahead of ${other}.`;
    S.ui.burst = id; setTimeout(() => { S.ui.burst = null; }, 700);
    toast(msg);
  }
  render(true);
}
function water(d) {
  if (!meOk()) return;
  const goal = waterGoal(), other = otherOf(me), before = careStars(me), n = Math.max(0, Math.min(20, (+careOf(me).water || 0) + d));
  setCare({ water: n });
  if (d > 0) {
    let msg = n === goal ? '★★ Water goal reached! Hydration hero.' : n < goal ? `★ Glass ${n} of ${goal}.` : '★ Bonus glass. Well watered.';
    if (other && before <= careStars(other) && careStars(me) > careStars(other)) msg += ` You just pulled ahead of ${other}.`;
    toast(msg);
  }
  render(true);
}
function careList(its) {
  const c = careOf(me), hm = nowMin();
  return `<ul class="checks">${its.map(x => {
    const on = isDone(c[x.id]), late = x.time && !on && hm > toMin(x.time);
    return `<li data-sw-r=".check" data-sw-r-label="${on ? 'Undo' : '✓ Done'}"><button class="check star${on ? ' on' : ''}${S.ui.burst === x.id ? ' burst' : ''}" data-act="care" data-id="${x.id}" aria-pressed="${on}"><span class="box" aria-hidden="true">${on ? '★' : ''}</span><span class="txt">${esc(x.text)}${x.tip ? `<span class="def">${esc(x.tip)}</span>` : ''}</span>${x.time && !on ? `<span class="mins${late ? ' late' : ''}">${late ? 'Yet?' : 'by ' + esc(x.time)}</span>` : ''}${on ? `<span class="by">${fmtT(c[x.id].at)}</span>` : ''}</button>${x.kind === 'clean' ? cleanBlock(x) : ''}</li>`;
  }).join('')}</ul>`;
}
/* ---------- "Clean one thing" (10 Nov 2026): a self-care task that offers the jobs on today's Rhythms card ----------
   Tap it and pick one of today's jobs (today's beat, jobs given today, the ones that are ready); Done ticks the job in Rhythms and the star here,
   "Start 10 minutes" opens it in Active → Focus → Taking care of my surroundings. Seeded once into lists.care (kind: 'clean'); delete or rename it freely.
   Per person per day: day.care[name].cleanJob (the chosen job's key), .cleanJobText (what got done). */
function careSeedClean() {
  const L = H('lists'); if (!db || !S.loaded || !meValid() || L.cleanSeeded || S.ui.cleanSeeded) return; S.ui.cleanSeeded = true;
  const care = L.care || [];
  saveHome('lists', { ...L, care: care.some(x => x.kind === 'clean') ? care : [...care, { id: 'care-clean', text: 'Clean one thing', group: 2, kind: 'clean', tip: 'One job from today’s rhythm is plenty.' }], cleanSeeded: dk });
}
function cleanOptions() {
  const seen = new Set(), out = [], bp = beatPlan();
  for (const j of [...bp.base, ...bp.extras, ...(bp.more || []), ...rjOnDay(dk).filter(j => j.kind !== 'rs' && rjMine(j))]) if (j && !seen.has(j.key) && !rjDone(j)) { seen.add(j.key); out.push(j); }
  return out;
}
function cleanBlock(x) {
  const c = careOf(me), on = isDone(c[x.id]), job = c.cleanJob ? rjFind(c.cleanJob) : null;
  if (on) return c.cleanJobText ? `<p class="muted small clean-did">${esc(c.cleanJobText)}</p>` : '';
  if (job && !rjDone(job)) return `<div class="clean-pick chosen"><p class="small"><b>${esc(job.text)}</b>${job.min ? ` · about ${+job.min} min` : ''}</p><div class="actions"><button class="btn accent" data-act="clean-done" data-id="${esc(x.id)}">Done ★</button><button class="btn ghost" data-act="clean-go" data-key="${esc(job.key)}">Start 10 minutes</button><button class="link" data-act="clean-open">Another one</button></div></div>`;
  if (!S.ui.cleanPick) return '';
  const opts = cleanOptions();
  return `<div class="clean-pick"><p class="small"><b>Which one?</b> From today’s rhythm. One is enough.</p>${opts.length ? `<div class="pills">${opts.slice(0, 8).map(j => `<button class="pill" data-act="clean-pick" data-key="${esc(j.key)}">${esc(j.text)}${j.min ? ` <span class="muted">${+j.min} min</span>` : ''}</button>`).join('')}</div>` : '<p class="muted small">Nothing left on today’s rhythm. Anything small counts: one cup, one surface, one corner.</p>'}
    <div class="actions"><button class="link" data-act="clean-any" data-id="${esc(x.id)}">Something else, I did one</button><button class="link" data-act="clean-x">Not now</button></div></div>`;
}
function cleanDone(id, none) {
  const job = !none && careOf(me).cleanJob ? rjFind(careOf(me).cleanJob) : null;
  if (job && !rjDone(job)) rjTick(job.key);
  setCare({ cleanJob: null, cleanJobText: job ? job.text : '' }); S.ui.cleanPick = false; toggleCare(id, true);
}
function scoreLine(a, b) {
  if (!b) return 'Every star is a kindness to tomorrow-you.';
  const x = careStars(a), y = careStars(b);
  if (!x && !y) return 'Fresh day, zero stars each. The first glass of water takes the lead.';
  if (x > y) return `You’re ahead by ${x - y}. Maybe bring ${esc(b)} a glass of water?`;
  if (y > x) { const next = (H('lists').care || []).find(it => !isDone(careOf(a)[it.id])); return `${esc(b)} is ahead by ${y - x}. ${next ? esc(next.text) + ' would' : 'A glass of water would'} close the gap.`; }
  return 'Neck and neck. The next star takes the lead.';
}
function vCare() {
  const ms = members().map(m => m.name), items = H('lists').care || [], goal = waterGoal(), ec = S.ui.edit.care;
  let h = `<section class="hero"><p class="eyebrow">Self-care</p><h1>Look after the people who look after everything.</h1>
    <p class="lede">Teeth, water, food, daylight: the basics ADHD brains drop first. Each one earns a gold star, and you can see how the other is doing.</p></section>`;
  if (!me || !ms.includes(me)) return h + whoCard();
  careSeedClean();
  const max = careMax(), other = otherOf(me), w = +careOf(me).water || 0;
  h += modeCard(hMode());
  h += `<section class="card"><div class="sec-head"><h2>Today’s stars</h2></div><div class="score">${[me, other].filter(Boolean).map(n => { const st = careStars(n);
      return `<div class="sc${n === me ? ' me' : ''}"><b>${esc(n)}${n === me ? ' (you)' : ''}</b><span class="stars">★ ${st}<small> / ${max}</small></span><div class="track"><div class="fill" style="width:${max ? Math.min(100, st / max * 100) : 0}%"></div></div><span class="muted small">★ ${weekStars(n)} this week</span></div>`; }).join('')}</div>
    <p class="muted small">${scoreLine(me, other)}</p></section>`;
  h += secOpen('c-water', 'Water', `${w} of ${goal} glasses`) + `<section class="card"><div class="sec-head"><h2>Water</h2><span class="progress">${w} of ${goal} glasses · ${String(w / 4).replace('.', ',')} l</span></div>
    <div class="drops" aria-hidden="true">${Array.from({ length: Math.max(goal, w) }, (_, i) => `<span class="drop${i < w ? ' on' : ''}"></span>`).join('')}</div>
    <div class="actions"><button class="btn accent" data-act="water" data-d="1">+ I drank a glass</button><button class="btn ghost" data-act="water" data-d="-1" ${w ? '' : 'disabled'}>Undo</button></div>
    <p class="muted small">A glass is about 250 ml. Easy wins: a full bottle where you work, a glass with every coffee${kidsList().length ? `, one while ${esc(theKids())} brush${kidsList().length === 1 ? 'es' : ''} their teeth` : ', one with every meal'}.</p></section>` + secClose();
  h += secOpen('c-rest', 'Rest breaks', `${+careOf(me).rest || 0} of ${REST_GOAL}`) + restCard() + secClose();
  const cg = careSlotGroup();
  [0, 1, 2, 3].map(i => (cg + i) % 4).forEach(gi => { const its = items.filter(x => (x.group || 0) === gi); if (!its.length) return; const dn = its.filter(x => isDone(careOf(me)[x.id])).length;
    h += sec('c-g' + gi + '-' + dk, CARE_GROUPS[gi] + (gi === cg ? ' · now' : ''), `${dn} of ${its.length}${dn === its.length ? ' ★' : ''}`, `<section class="card">${careList(its)}</section>`, dn === its.length); });
  if (other) { const c = careOf(other), done = items.filter(x => isDone(c[x.id]));
    h += secOpen('c-other', esc(other) + ' so far today', `★ ${careStars(other)}`) + `<section class="card"><div class="sec-head"><h2>${esc(other)} so far today</h2></div>
      ${done.length || c.water || c.rest ? `<div class="chips">${done.map(x => `<span class="chip">★ ${esc(x.text)}</span>`).join('')}${c.water ? `<span class="chip">★ ${+c.water} glass${+c.water === 1 ? '' : 'es'} of water</span>` : ''}${c.rest ? `<span class="chip">★ ${+c.rest} rest break${+c.rest === 1 ? '' : 's'}</span>` : ''}</div>` : '<p class="empty">Nothing ticked yet today.</p>'}
      <p class="muted small">Cheer each other on, but only ${esc(other)} can tick ${esc(other)}’s boxes.</p></section>` + secClose(); }
  if (ec) h += `<section class="card"><div class="sec-head"><h2>Edit the self-care list</h2>${editBtn('care')}</div>
    <p class="muted small">One shared list; each of you ticks your own. Items with a time show a gentle “Yet?” once it passes, here and on Today.</p>
    <ul class="edit-list">${items.map((x, n, arr) => `<li class="mvrow"><div class="txt rn">${rnInput('lists', 'care', x, 'text')}<div class="rn-sub">${rnInput('lists', 'care', x, 'time', 'time')}<select data-act="regroup" data-doc="lists" data-field="care" data-id="${x.id}" data-grp="group" id="cg_${x.id}" aria-label="Section">${CARE_GROUPS.map((g, i) => `<option value="${i}" ${(x.group || 0) === i ? 'selected' : ''}>${g}</option>`).join('')}</select></div></div>${mvBtns('lists', 'care', x.id, '', n, arr.length)}<button class="chip x" data-act="del" data-doc="lists" data-field="care" data-id="${x.id}" aria-label="Remove ${esc(x.text)}">✕</button></li>`).join('')}</ul>
    <form class="addform" data-form="add" data-doc="lists" data-field="care"><input type="text" name="text" placeholder="e.g. Vitamins" required aria-label="New self-care item"><select name="group" aria-label="Section">${CARE_GROUPS.map((g, i) => `<option value="${i}">${g}</option>`).join('')}</select><input type="time" name="time" aria-label="Reminder time (optional)"><button class="btn" type="submit">Add</button></form>
    <label class="small">Daily water goal <select data-act="water-goal" id="waterGoal">${[6, 7, 8, 9, 10, 12].map(v => `<option value="${v}" ${v === goal ? 'selected' : ''}>${v} glasses (${String(v / 4).replace('.', ',')} l)</option>`).join('')}</select></label></section>`;
  else h += `<div class="actions"><button class="link" data-act="edit" data-sec="care">Edit the self-care list</button></div>`;
  return h;
}
/* on Today: meals or other timed items that have just passed, plus a water nudge */
function careNudge() {
  if (!me || !members().some(m => m.name === me)) return '';
  const items = H('lists').care || [], c = careOf(me), hm = nowMin(), other = otherOf(me);
  const late = items.filter(x => x.time && !isDone(c[x.id]) && hm > toMin(x.time) && hm - toMin(x.time) < 240);
  const w = +c.water || 0, goal = waterGoal(), expected = Math.floor(Math.max(0, Math.min(1, (hm - 480) / 720)) * goal);
  return `<section class="card care-mini"><div class="sec-head"><h2>Looking after you</h2><a class="link" href="#care">Self-care</a></div>
    <p class="small"><span class="stars">★ ${careStars(me)}</span> you${other ? ` · <span class="stars">★ ${careStars(other)}</span> ${esc(other)}` : ''}</p>
    ${late.length ? careList(late) : ''}
    ${w < expected ? `<div class="actions"><span class="small">${w} of ${goal} glasses so far.</span><button class="tiny" data-act="water" data-d="1">+ Glass of water</button></div>` : ''}</section>`;
}

/* ---------- personal mornings: launch list, morning list, evening prep ---------- */
const PSUG = {
  launch: ['Keys', 'Phone', 'Keycard', 'Wallet', 'Headphones', 'Glasses', 'Work laptop', 'Charger', 'Breakfast or lunch', 'Meds', 'Water bottle', 'Umbrella or rain jacket'],
  evening: ['Breakfast for tomorrow: pack it, or decide where to buy it', 'Everything from the launch list by the door', 'Phone on the charger', 'Clothes for tomorrow out', 'Check tomorrow’s weather'],
  morning: ['Kids up, dressed and fed', 'Kindergarten or school bag and snacks', 'Pets: breakfast', 'Weather check for the kids’ clothes', 'Coffee before anything else'],
};
const PLIST = { launch: 'Can’t leave the house without', evening: 'Evening prep for tomorrow', morning: 'My morning' };
const PNOTE = { launch: 'They show up every workday morning, ready to tick at the door.', evening: 'Shows in the evening before a workday, so the morning is just grab and go.', morning: 'Your own morning jobs, on top of the Care tab basics.' };
const prof = n => ((H('people').people || {})[n]) || {};
const workday = (n, d = dow()) => (prof(n).workdays || [0, 1, 2, 3, 4]).includes(d);
const pPre = (n, l) => `p:${n}:${l}`;
const pOpen = (n, l) => (prof(n)[l] || []).filter(x => !isDone((S.day.done || {})[pPre(n, l) + ':' + x.id]));
const isMorning = () => { const m = nowMin(); return m >= 240 && m < 660; };
const closingWindow = () => { const bt = toMin(H('week').bedtime || '18:45'), nm = nowMin(); return nm >= bt - 15 || nm < 240; };
/* closing duties only make sense at home. If you're tagged on an event that's happening right now, you count as home only when
   its place is explicitly "home", "online" or the household's address (Settings → About your home); no place, or any other place, means you're out (6 Nov 2026). */
const placeIsHome = p => { const x = String(p || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
  const own = String(homeAddr()).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().split(',')[0];
  return /^(home|online)\b/.test(x) || (own.length >= 5 && x.includes(own)); };
function awayEvent(n = me) {
  if (!n) return null; const now = Date.now();
  return eventsOn(dk).find(e => !e.allDay && e.start && !e.free && (e.who || []).includes(n) && !placeIsHome(e.place) && !girlsAwayRow({ e }) && (() => { const [a, b] = evSpan(e); return a <= now && now < b; })()) || null;
}
const closingDue = () => closingWindow() && !awayEvent();
/* the girls are somewhere else (grandparents, a sitter) and no adult is on the event: once it has started it needs no space under "Now" */
const girlsAwayRow = r => !!(r && r.e && inGP(r.e) && (r.e.src === 'gp' || !(r.e.who || []).some(x => adults().includes(x))));
/* what's relevant to you right now: events you're tagged on come first; events that name other people only are not yours */
const taggedRow = r => !!(r && r.e && Array.isArray(r.e.who) && r.e.who.includes(me));
const mineRow = r => !r.e || !Array.isArray(r.e.who) || !r.e.who.length || r.e.who.includes(me);
const nowRows = (rows, nm) => { const c = rows.filter(r => !r.allDay && r.s <= nm && r.en > nm && !girlsAwayRow(r) && mineRow(r)); return [...c.filter(taggedRow), ...c.filter(r => !taggedRow(r))]; };
const meValid = () => !!me && members().some(m => m.name === me);
/* ---------- people's own settings (home/people.people[name]): mornings, evening prep, My setup ---------- */
function savePeople(n, patch, quiet) {
  const o = { ...H('people') }; o.people = { ...(o.people || {}), [n]: { ...prof(n), ...patch } };
  quiet ? saveQuiet('people', o) : saveHome('people', o);
}
function morningBody() {
  if (!meValid()) return '';
  const p = prof(me), other = otherOf(me), wd = leavesHome(me, dk), L = fits(p.launch, dk), M = fits(p.morning, dk), hid = (p.morning || []).length - M.length;
  let h = todayPlanHtml();
  const X = planOf('today', me).launch || [], BL = wd ? L : [];
  if (BL.length || X.length) { const n = countDone(pPre(me, 'launch'), BL) + countDone(`pl:${me}`, X), tot = BL.length + X.length;
    h += doneFold('launch', 'Before you leave', n, tot, `<section class="card launch"><div class="sec-head"><h2>Before you leave</h2><span class="progress">${n} of ${tot}</span></div>
      <p class="muted small">${p.leave && wd ? `You head out around ${esc(p.leave)}${isFlex(me) && meAt(me, dk) !== 'out' ? ' for drop-off' : ''}. ` : ''}Their overnight home is the launch pad in the hallway.</p>${BL.length ? checklist(pPre(me, 'launch'), BL) : ''}${X.length ? `<h3>Extra for today</h3>${checklist(`pl:${me}`, X)}` : ''}${n === tot ? '<p class="alldone">Everything’s with you. Have a good day.</p>' : ''}</section>`); }
  if (M.length) h += doneFold('morning', 'Your morning', countDone(pPre(me, 'morning'), M), M.length, `<section class="card"><div class="sec-head"><h2>Your morning</h2><span class="progress">${countDone(pPre(me, 'morning'), M)} of ${M.length}</span></div>${checklist(pPre(me, 'morning'), M)}${hid ? `<p class="muted small">${hid} item${hid === 1 ? '' : 's'} for other kinds of days left out.</p>` : ''}</section>`);
  if (!h) h += `<section class="card"><p class="muted small">${wd ? 'No morning lists yet.' : `${meLbl(me, meAt(me, dk))} today, so no launch list.`}</p></section>`;
  if (other) { const op = prof(other), oL = op.launch || [], oM = op.morning || [], bits = [];
    const oLd = countDone(pPre(other, 'launch'), oL), oMd = countDone(pPre(other, 'morning'), oM);
    if (leavesHome(other, dk) && oL.length && oLd < oL.length) bits.push(`launch list ${oLd} of ${oL.length}`);
    if (oM.length && oMd < oM.length) bits.push(`morning ${oMd} of ${oM.length}`);
    if (bits.length) h += `<p class="muted small">${esc(other)}: ${bits.join(' · ')}.</p>`; }
  return h + `<div class="actions"><button class="link" data-act="setup">Edit my morning lists</button></div>`;
}
/* evening prep follows tomorrow: kindergarten bags only before a kindergarten day, work things only before heading out */
function prepItems() { if (!meValid()) return []; const E0 = fits(prof(me).evening, tk), E = leavesHome(me, tk) || girlsAt(tk) === 'kinder' ? E0 : E0.filter(x => whenOf(x) === 'home' || whenOf(x) === 'in');
  return [...E, ...autoPrep(tk).filter(x => !E.some(y => y.text.toLowerCase() === x.text.toLowerCase()))]; }
function prepCard() {
  if (!meValid()) return '';
  const p = prof(me), E = prepItems(); if (!E.length) return '';
  return doneFold('prep', 'Your prep for tomorrow', countDone(pPre(me, 'evening'), E), E.length, `<section class="card launch"><div class="sec-head"><h2>Your prep for tomorrow</h2><span class="progress">${countDone(pPre(me, 'evening'), E)} of ${E.length}</span></div>
    <p class="muted small">So tomorrow-you${p.wake ? ` at ${esc(p.wake)}` : ''} can just grab and go.</p>${checklist(pPre(me, 'evening'), E)}</section>`);
}
function vSetup() {
  const p = prof(me), first = !p.setupDone, wds = p.workdays || [0, 1, 2, 3, 4];
  const listEd = l => { const items = p[l] || [];
    return `<div class="setup-list"><h3>${PLIST[l]}</h3><p class="muted small">${PNOTE[l]}</p>
      ${items.length ? `<ul class="edit-list">${items.map((x, n) => `<li><div class="txt rn"><input type="text" class="rn-in" id="pl_${l}_${x.id}" value="${esc(x.text)}" data-act="p-rename" data-list="${l}" data-id="${x.id}" aria-label="Edit ${esc(x.text)}">${l !== 'launch' ? `<div class="rn-sub">${whenSel(x, `data-act="p-when" data-list="${l}" data-id="${x.id}"`)}</div>` : ''}</div><span class="mv"><button class="iconmini" data-act="p-mv" data-list="${l}" data-id="${x.id}" data-dir="-1" ${n === 0 ? 'disabled' : ''} aria-label="Move up">↑</button><button class="iconmini" data-act="p-mv" data-list="${l}" data-id="${x.id}" data-dir="1" ${n === items.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button></span><button class="chip x" data-act="p-del" data-list="${l}" data-id="${x.id}" aria-label="Remove ${esc(x.text)}">✕</button></li>`).join('')}</ul>` : ''}
      <div class="chips">${PSUG[l].filter(sg => !items.some(x => x.text.toLowerCase() === sg.toLowerCase())).map(sg => `<button class="tiny" data-act="p-sug" data-list="${l}" data-text="${esc(sg)}">+ ${esc(sg)}</button>`).join('')}</div>
      <form class="addform" data-form="p-add" data-list="${l}"><input type="text" name="text" placeholder="Add your own" required aria-label="Add to ${PLIST[l]}"><button class="btn" type="submit">Add</button></form></div>`; };
  return `<div class="scrim" data-act="${first ? 'noop' : 'close-setup'}"><div class="sheet" role="dialog" aria-label="Morning setup">
    <div class="sec-head"><h2>${first ? `Let’s set up your mornings, ${esc(me)}` : 'Your mornings'}</h2>${first ? '' : '<button class="link" data-act="close-setup">Close</button>'}</div>
    ${first ? '<p class="muted small">Two minutes now saves a lot of early-morning searching. Tap suggestions to add them, or write your own. You can change everything later from the Rhythms tab.</p>' : ''}
    <div class="addform"><label class="small" style="display:flex;gap:8px;align-items:center">I get up around <input type="time" id="pWake" data-act="p-field" data-f="wake" value="${esc(p.wake || '')}"></label><label class="small" style="display:flex;gap:8px;align-items:center">I leave around <input type="time" id="pLeave" data-act="p-field" data-f="leave" value="${esc(p.leave || '')}"></label><label class="small" style="display:flex;gap:8px;align-items:center">and I’m back around <input type="time" id="pBack" data-act="p-field" data-f="back" value="${esc(p.back || '')}"></label></div>
    <p class="muted small">${kidsList().length ? `Leave and back times let Afloat spot when nobody is home with ${esc(theKids())} on days without kindergarten or school.` : 'Leave and back times give you a leave-by reminder and tell the household when you’re back.'}</p>
    <div><p class="small">My work</p><div class="pills"><button class="pill${!isFlex(me) ? ' on' : ''}" data-act="p-style" data-v="fixed">Set workdays</button><button class="pill${isFlex(me) ? ' on' : ''}" data-act="p-style" data-v="flex">Freelance / flexible</button></div></div>
    ${isFlex(me) ? '<p class="muted small">Afloat won’t assume you’re out. On kindergarten days you’re working from home (your launch list still shows for drop-off); when the girls are home, you’re home with them. Add gigs and meetings to the calendar with your name on them and they count as you being busy. Change any single day in Today’s setup.</p>'
      : `<div><p class="small">Days I head out to work</p><div class="pills">${DAYS.map((dn, i) => `<button class="pill${wds.includes(i) ? ' on' : ''}" data-act="p-day" data-i="${i}">${dn}</button>`).join('')}</div></div>`}
    ${listEd('launch')}${listEd('evening')}${listEd('morning')}${remindEditor()}
    <div class="actions"><button class="btn accent big" data-act="setup-done">${first ? 'All set' : 'Done'}</button></div>
  </div></div>`;
}
function pEdit(l, fn) { const p = prof(me); savePeople(me, { [l]: fn([...(p[l] || [])]) }); }
/* ---------- taps on this area's buttons (data-act), called from events.js; true = handled ---------- */
function tapSelfCare(a, el, e, r) {
  switch (a) {
    case 'care': toggleCare(el.dataset.id); return true;
    case 'clean-open': setCare({ cleanJob: null }); S.ui.cleanPick = true; render(true); return true;
    case 'clean-x': S.ui.cleanPick = false; render(true); return true;
    case 'clean-pick': setCare({ cleanJob: el.dataset.key }); S.ui.cleanPick = false; render(true); return true;
    case 'clean-done': cleanDone(el.dataset.id); return true;
    case 'clean-any': cleanDone(el.dataset.id, true); return true;
    case 'clean-go': { const j = rjFind(el.dataset.key); if (j) hmQuick(j.text); return true; }
    case 'setup': if (meValid()) { S.ui.setup = true; S.ui.settings = false; S.ui.brief = false; render(true); } return true;
    case 'close-setup': S.ui.setup = false; render(true); return true;
    case 'setup-done': savePeople(me, { setupDone: true }); S.ui.setup = false; toast('★ Mornings set. Future-you thanks you.'); if (lsGet('afloat.brief') !== dk + slot()) S.ui.brief = true; render(true); return true;
    case 'p-sug': pEdit(el.dataset.list, a => [...a, { id: uid(), text: el.dataset.text }]); return true;
    case 'p-del': pEdit(el.dataset.list, a => a.filter(x => x.id !== el.dataset.id)); return true;
    case 'p-mv': pEdit(el.dataset.list, a => { const i = a.findIndex(x => x.id === el.dataset.id), j = i + +el.dataset.dir; if (i >= 0 && j >= 0 && j < a.length) [a[i], a[j]] = [a[j], a[i]]; return a; }); return true;
    case 'p-style': savePeople(me, { workStyle: el.dataset.v === 'flex' ? 'flex' : 'fixed' }); return true;
    case 'p-day': { const w = [...(prof(me).workdays || [0, 1, 2, 3, 4])], i = +el.dataset.i; savePeople(me, { workdays: w.includes(i) ? w.filter(x => x !== i) : [...w, i].sort() }); return true; }
    case 'water': water(+el.dataset.d); return true;
    case 'rest': restBreak(+el.dataset.d); return true;
    case 'rest-timer': restBreak(1); startTimer(15, 'Rest break: this time is yours'); return true;
  }
  return false;
}
