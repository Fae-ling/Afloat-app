/* Afloat · app/beat.js · Today's beat, the restock run and the supply check.
   Plain script: shares one scope with the other app/*.js files (loaded in order by index.html). See CLAUDE.md. */
/* ---------- Today's beat: how every list reaches you, gently (5 Nov 2026) ----------
   From the book (ch. 33): the list is there to take the deciding away ("do the thing for today… knowing I'll get to the
   rest eventually"), not to remind you of what you haven't done; missing days is morally neutral; part of a task counts;
   and if a job keeps being skipped, take it off the list and the whole list gets done again. From Sweepy and Tody: a small
   amount of house time a day, filled with what's ready, so nothing piles up. From shame-free ADHD design: no "overdue",
   no red counts, a neutral welcome back after time away. So:
   - weekly jobs show on their own day only, and never carry over to the next day;
   - beyond them, at most two "if there's room" extras a day, inside your daily house time (30 min unless you change it;
     low energy: 10; survival: the glass balls only): this month's once-a-year job, an every-month job (each given a week
     of the month and shown one at a time), or the every-few-days jobs that are most ready;
   - "Not today" moves a job on (weekly: until its day next week; every few days: two days; monthly and yearly: a week).
     After three skips in a row, Afloat asks kindly whether it should come off the list, come less often, or stay;
   - after three or more days away: "Welcome back. Nothing piled up"; there is no backlog;
   - this month's notes (tick season…) show in the month's first week; the restock run has its own card on its day.
   home/beat: 's:<kind>:<id>' {until, n, last}; daily house time per person in home/rhythms.budget {name: minutes}. */
const BEAT = () => H('beat');
const beatSkipOf = key => BEAT()['s:' + key] || {};
const beatHidden = key => { const s = beatSkipOf(key); return !!(s.until && s.until > dk); };
const beatBudget = (n = me) => { const b = +((rjR().budget || {})[n] ?? 30); return hMode() === 'low' ? Math.min(b, 10) : b; };
const wom = (k = dk) => Math.min(3, Math.floor((+k.slice(8, 10) - 1) / 7));
const doneOn = (v, k = dk) => isDone(v) && keyOf(new Date(v.at - 4 * 36e5)) === k;
function jobDoneToday(j) {
  if (j.kind === 'e') return rjDone(j);
  const v = j.kind === 'm' ? (S.month.done || {})['mm:' + j.id] : j.kind === 'y' ? (S.month.done || {})['m:' + j.id] : j.kind === 'w' ? (S.week.done || {})['r:' + j.id] : null;
  return doneOn(v);
}
/* the jobs that reach you today: base (today's weekly jobs and anything given today) and up to two extras */
function beatPlan(n = me, k = dk) {
  const mine = j => rjMine(j) || (j.sch && (j.sch.who === n || j.sch.who === 'both'));
  const base = rjOnDay(k).filter(j => j.kind !== 'rs' && mine(j) && !beatHidden(j.key));
  if (rjSurv()) return { base: base.filter(j => j.glass), more: [], extras: [], budget: 0, notes: [] };
  /* today's own jobs also keep inside the house time: scheduled and glass-ball jobs first, then in list order; the rest fold
     into "more, if you feel like it" and simply come round next week */
  const budget = beatBudget(n), ord = [...base].sort((a, b) => (!!b.sch - !!a.sch) || (!!b.glass - !!a.glass)), keep = [], more = []; let u = 0;
  for (const j of ord) { const m = rjDone(j) ? 0 : (+j.min || 10); if (!keep.length || j.sch || j.glass || rjDone(j) || u + m <= budget) { keep.push(j); u += m; } else more.push(j); }
  const used0 = u, all = rjAll(), w = wom(k), mo = kMonth(k);
  const free = j => !rjSchOf(j.key) && rjMine(j) && !beatHidden(j.key) && inSeason(j, k);
  const spread = list => list.map((j, i) => ({ ...j, wk: i % 4 })).filter(j => j.wk <= w && free(j) && (!rjDone(j) || jobDoneToday(j)));
  const yr = spread(all.filter(j => j.kind === 'y' && j.month === mo)), mm = spread(all.filter(j => j.kind === 'm'));
  const ev = all.filter(j => j.kind === 'e' && free(j) && (rjState(j) === 'due' || jobDoneToday(j))).sort((a, b) => (jobDoneToday(b) - jobDoneToday(a)) || (rjRatio(b) - rjRatio(a)));
  const pool = [yr[0], mm[0], ev[0], ev[1], yr[1], mm[1]].filter(Boolean), extras = []; let used = used0;
  for (const j of pool) { if (extras.length >= 2) break; const m = +j.min || 10; if (jobDoneToday(j) || used + m <= budget) { extras.push(j); if (!jobDoneToday(j)) used += m; } }
  const notes = w === 0 ? (rjR().monthly || []).filter(x => x.note && x.month === mo) : [];
  return { base: keep, more, extras: more.length ? [] : extras, budget, notes };
}
function beatWelcome() {
  if (S.ui.beatWelcome == null) { const last = lsGet('afloat.seen.' + (me || '')); S.ui.beatWelcome = !!(last && last < dk && dayDiffK(last, dk) >= 3); }
  if (me && lsGet('afloat.seen.' + me) !== dk) lsSet('afloat.seen.' + me, dk);
  return S.ui.beatWelcome;
}
function beatAsk() {
  const all = rjAll(), e = Object.entries(BEAT()).find(([k, v]) => k.startsWith('s:') && v && (v.n || 0) >= 3 && all.some(j => j.key === k.slice(2)));
  if (!e) return ''; const j = rjFind(e[0].slice(2));
  const less = j.kind === 'w' ? 'Every other week instead' : j.kind === 'e' ? `Every ~${(+j.every || 7) * 2} days instead` : '';
  return `<div class="beat-ask"><p class="small"><b>“${esc(j.text)}”</b> has been put off three times. That’s information, not failure. KC Davis took dusting off her list, and then the whole list got done.</p>
    <div class="chips"><button class="tiny" data-act="beat-off" data-id="${esc(j.key)}">Take it off the list</button>${less ? `<button class="tiny" data-act="beat-less" data-id="${esc(j.key)}">${less}</button>` : ''}<button class="tiny" data-act="beat-keep" data-id="${esc(j.key)}">Keep it</button></div></div>`;
}
function beatCard() {
  const P = beatPlan(), all = [...P.base, ...P.extras], left = all.filter(j => !rjDone(j)), mins = left.reduce((a, j) => a + (+j.min || 10), 0), ev = evening();
  const welcome = beatWelcome(), bud = (rjR().budget || {})[me] ?? 30;
  const rows = js => `<ul class="rj-l">${js.map(j => rjRow(j, { skip: true })).join('')}</ul>`;
  return doneFold('beat', 'Today’s beat', all.length - left.length, all.length, `<section class="card beat"><div class="sec-head"><h2>Today’s beat</h2><a class="link" href="#rhythms">All rhythms</a></div>
    ${welcome ? '<p class="note small">Welcome back. Nothing piled up while you were away. Here’s just today.</p>' : ''}
    ${rjSurv() ? '<p class="note small">Survival mode: only the glass balls. Everything else is plastic and will bounce.</p>' : hMode() === 'low' || (ev && ev.type === 'away') ? '<p class="muted small">Optional today. Part of it counts; the rest has its own day again.</p>' : ''}
    ${P.notes.map(x => `<p class="note small">${esc(x.text)}</p>`).join('')}
    ${P.base.length ? rows(P.base) : !P.extras.length ? `<p class="empty">Nothing on today’s beat. Enjoy the gap.</p>` : ''}
    ${P.extras.length ? `<h3 class="beat-h">If there’s room</h3>${rows(P.extras)}` : ''}
    ${P.more.length ? `<details class="beat-more"><summary class="small">${P.more.length} more from today’s rhythm, if you feel like it</summary>${rows(P.more)}</details>` : ''}
    ${all.length && !left.length ? '<p class="alldone">Done. The house got looked after today.</p>' : all.length ? `<p class="muted small">About ${mins} min. Not today is always an option; it comes round again.</p>` : ''}
    ${beatAsk()}
    ${rjSurv() ? '' : `<div class="beat-bud small"><span class="muted">House time a day:</span>${[10, 20, 30, 45].map(m => `<button type="button" class="tiny${+bud === m ? ' on' : ''}" data-act="beat-bud" data-v="${m}">${m} min</button>`).join('')}</div>`}</section>`);
}
function beatSkip(key) {
  const j = rjFind(key); if (!j) return; const s = beatSkipOf(key), n = (s.last && dayDiffK(s.last, dk) <= 45 ? (s.n || 0) : 0) + 1;
  const until = j.kind === 'e' ? calAdd(dk, 2) : j.kind === 'w' ? calAdd(dk, 1) : calAdd(dk, 7), v = { until, n, last: dk };
  S.home.beat = { ...BEAT(), ['s:' + key]: v }; mergeDoc('home/beat', { ['s:' + key]: v }); if (rjSchOf(key)) rjUnsch(key);
  toast(j.kind === 'w' ? 'Moved to next week. Missing days is morally neutral.' : 'It’ll come round again. No pile-up.'); render(true);
}
function beatReset(key) { if ((beatSkipOf(key).n || 0) === 0) return; const v = { ...beatSkipOf(key), n: 0, until: null }; S.home.beat = { ...BEAT(), ['s:' + key]: v }; mergeDoc('home/beat', { ['s:' + key]: v }); }
const RJ_FIELD = { w: 'weekly', e: 'every', m: 'everyMonth', y: 'monthly' };
function beatOff(key) {
  const i = key.indexOf(':'), kind = key.slice(0, i), id = key.slice(i + 1), f = RJ_FIELD[kind]; if (!f) return; const j = rjFind(key);
  saveHome('rhythms', { ...rjR(), [f]: (rjR()[f] || []).filter(x => x.id !== id) }); beatReset(key); toast(`“${j ? j.text : 'It'}” is off the list. It can go back to being done whenever you think of it.`);
}
function beatLess(key) {
  const i = key.indexOf(':'), kind = key.slice(0, i), id = key.slice(i + 1), R = { ...rjR() };
  if (kind === 'w') { const x = (R.weekly || []).find(y => y.id === id); if (!x) return; const { day, ...rest } = x; R.weekly = R.weekly.filter(y => y.id !== id); R.every = [...(R.every || []), { ...rest, every: 14 }]; S.home.rlog = { ...rjLog(), [id]: { last: dk, prev: null } }; mergeDoc('home/rlog', { [id]: { last: dk, prev: null } }); }
  else if (kind === 'e') R.every = (R.every || []).map(y => y.id === id ? { ...y, every: (+y.every || 7) * 2 } : y);
  saveHome('rhythms', R); beatReset(kind === 'w' ? key : key); if (kind === 'w') beatReset('e:' + id); toast('Less often it is.');
}
/* ---------- restock run and supply check: refills around the house, and what's running low goes straight to the shopping list ---------- */
const shopOk = () => !!(mcp && trL().shop);
const shopNorm = t => String(t || '').trim().toLowerCase();
function onShop(name) { const id = trL().shop, t = shopNorm(name); return (S.ui.shopAdded || []).includes(t) || (!!id && (S.trello.cards || []).some(x => x.list && x.list.id === id && !x.complete && shopNorm(x.name) === t)); }
const SUP_GROUPS = [['house', 'Around the house'], ['kitchen', 'Kitchen'], ['clean', 'Laundry and cleaning'], ['body', 'Bathroom'], ['pets', 'Pets'], ['season', 'This time of year'], ['other', 'Other']];
function supplyCheck(open) {
  const L = H('lists'), sup = (L.supplies || []).filter(x => inSeason(x)), can = shopOk();
  const chip = x => { const on = onShop(x.text); return `<button type="button" class="tiny shopchip${on ? ' on' : ''}" data-act="${on ? 'shop-has' : 'to-shop'}" data-text="${esc(x.text)}" ${can ? '' : 'disabled'} aria-pressed="${on}">${on ? '✓ ' : ''}${esc(x.text)}</button>`; };
  const groups = SUP_GROUPS.map(([g, l]) => [l, sup.filter(x => (SUP_GROUPS.some(s => s[0] === x.group) ? x.group : 'other') === g)]).filter(([, xs]) => xs.length);
  const onN = sup.filter(x => onShop(x.text)).length;
  return `<details class="supply"${open ? ' open' : ''}><summary class="small"><b>Supply check</b> · tap what’s running low${onN ? ` · ${onN} already on ${esc(shopName('shop'))}` : ''}</summary>
    ${can ? `<p class="muted small">Ticked ones are already on the shopping list. Tap anything else that’s running low and it goes onto ${esc(shopName('shop'))}.</p>` : '<p class="muted small">Connect Trello under Settings → Connections to send these to your shopping list.</p>'}
    ${groups.map(([l, xs]) => `<p class="small sup-h">${esc(l)}</p><div class="chips">${xs.map(chip).join('')}</div>`).join('')}</details>`;
}
function restockCard(where) {
  const L = H('lists'), R = (L.restock || []).filter(x => inSeason(x)), n = countDone('k', R), all = R.length && n === R.length, run = isDone((S.week.done || {})['rs:run']);
  return (where === 'today' && (all || run) ? x => doneFold('restock', 'Restock run', 1, 1, x) : x => x)(`<section class="card restock"><div class="sec-head"><h2>Restock run</h2><span class="progress">${n} of ${R.length}</span></div>
    <p class="muted small">All the little refills in one go, with music on. About 15 minutes. Anything running out goes onto ${esc(shopName('shop'))} from here.</p>
    ${checklist('k', R)}${R.some(x => x.shop) && shopOk() ? `<div class="chips"><span class="muted small">Out of something here?</span>${R.filter(x => x.shop).map(x => { const on = onShop(x.shop); return `<button type="button" class="tiny shopchip${on ? ' on' : ''}" data-act="${on ? 'shop-has' : 'to-shop'}" data-text="${esc(x.shop)}">${on ? '✓ ' : '🛒 '}${esc(x.shop)}</button>`; }).join('')}</div>` : ''}
    ${supplyCheck(false)}
    ${all || run ? '<p class="alldone">Restocked. Future-you will find what they need.</p>' : `<div class="actions"><button class="btn ghost" data-act="rs-done">That’s enough restocking</button></div>`}</section>`);
}
const SUP_SEED = [['house', ['Toaletní papír', 'Papírové kapesníky', 'Papírové utěrky', 'Pytle na odpadky', 'Mýdlo na ruce', 'Baterie AA a AAA', 'Žárovky']],
  ['kitchen', ['Prostředek na nádobí', 'Tablety do myčky', 'Sůl do myčky', 'Leštidlo do myčky', 'Houbičky na nádobí', 'Pečicí papír', 'Alobal', 'Sáčky na svačiny a mražení']],
  ['clean', ['Prací prostředek', 'Odstraňovač skvrn', 'Čistič na WC', 'Univerzální čistič', 'Hadříky z mikrovlákna', 'Sáčky do vysavače']],
  ['body', ['Zubní pasta', 'Dětská zubní pasta', 'Zubní kartáčky', 'Šampon', 'Sprchový gel', 'Vlhčené ubrousky', 'Náplasti']]];
const SUP_SEASON = [['Podpalovač', [9, 10, 11, 0, 1, 2]], ['Dřevo nebo brikety', [9, 10, 11, 0, 1, 2]], ['Zimní kapalina do ostřikovačů', [9, 10, 11, 0, 1, 2]], ['Opalovací krém', [3, 4, 5, 6, 7, 8]], ['Repelent proti klíšťatům', [3, 4, 5, 6, 7, 8, 9]]];
function supSeed() {
  if (!db || !S.loaded || ourHome() || S.ui.supSeeded) return; const L = H('lists'); if (L.supSeeded) return; S.ui.supSeeded = true;
  const sup = [...SUP_SEED.flatMap(([g, xs]) => xs.map((t, i) => ({ id: `sp-${g}-${i}`, text: t, group: g }))), ...SUP_SEASON.map(([t, ms], i) => ({ id: `sp-season-${i}`, text: t, group: 'season', months: ms }))];
  const R = [...(L.restock || [])], has = t => R.some(x => shopNorm(x.text) === shopNorm(t));
  if (!has('Wipes and tissues: car, outing bag, changing spots')) R.push({ id: 'k11', text: 'Wipes and tissues: car, outing bag, changing spots', shop: 'Vlhčené ubrousky' });
  if (!has('Firewood basket and kindling by the fireplace')) R.push({ id: 'k12', text: 'Firewood basket and kindling by the fireplace', shop: 'Podpalovač', months: [9, 10, 11, 0, 1, 2] });
  saveHome('lists', { ...L, supplies: [...(L.supplies || []), ...sup.filter(x => !(L.supplies || []).some(y => shopNorm(y.text) === shopNorm(x.text)))], restock: R, supSeeded: 1 });
}
function supplyEditor() {
  const L = H('lists'), ed = S.ui.edit.supplies, sup = L.supplies || [];
  return `<section class="card"><div class="sec-head"><h2>Supply check</h2>${editBtn('supplies')}</div><p class="muted small">Things that aren’t food that we keep in stock. On restock day (and any time here) tap what’s running low and it goes onto ${esc(shopName('shop'))}. Write them as they should appear on the shopping list.</p>
    ${ed ? `<ul class="edit-list">${sup.map(x => `<li class="mvrow"><div class="txt rn">${rnInput('lists', 'supplies', x, 'text')}<div class="rn-sub"><select data-act="sup-g" data-id="${x.id}" id="supg_${x.id}" aria-label="Group">${SUP_GROUPS.map(([g, l]) => `<option value="${g}" ${(x.group || 'other') === g ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div><button class="chip x row-x" data-act="del" data-doc="lists" data-field="supplies" data-id="${x.id}" aria-label="Remove">✕</button></li>`).join('')}</ul>
      <form class="addform" data-form="sup-add"><input type="text" name="text" placeholder="e.g. Krém na ruce" required aria-label="New supply"><select name="group" aria-label="Group">${SUP_GROUPS.map(([g, l]) => `<option value="${g}">${l}</option>`).join('')}</select><button class="btn" type="submit">Add</button></form>`
      : supplyCheck(true)}</section>`;
}

/* the cards scroll sideways on their own (the page swipe leaves sideways scrollers alone); the pills follow, and the
   row is as tall as the card on show */
function rjCarSync(force) {
  const c = document.getElementById('rjCar'); if (!c) return; const w = c.clientWidth || 1, i = S.ui.rjPane || 0;
  if (force || Math.round(c.scrollLeft / w) !== i) c.scrollLeft = i * w;
  const p = c.children[i]; if (p) c.style.height = p.offsetHeight + 'px';
  document.querySelectorAll('[data-act=rj-pane]').forEach(b => { const on = +b.dataset.v === i; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
}
let rjScrollT = 0;
document.addEventListener('scroll', e => { const c = e.target; if (!(c instanceof Element) || c.id !== 'rjCar') return; clearTimeout(rjScrollT);
  rjScrollT = setTimeout(() => { const i = Math.max(0, Math.min(2, Math.round(c.scrollLeft / (c.clientWidth || 1)))); if (i !== S.ui.rjPane) { S.ui.rjPane = i; lsSet('afloat.rjPane', String(i)); S.ui.rjSch = null; } rjCarSync(); }, 90); }, true);
function vRhythms() {
  rjSeed(); supSeed(); if (S.ui.rjPane == null) S.ui.rjPane = Math.max(0, Math.min(2, +(lsGet('afloat.rjPane') || 0)));
  const L = H('lists'), SP = H('spaces').spaces || [], i = S.ui.rjPane, es = S.ui.edit.spaces, ec = S.ui.edit.closing, er = S.ui.edit.restock;
  const bt = rjBed(), nm = nowMin(), closingTime = nm >= bt - 15 || nm < 240, awayEv = awayEvent();
  const ev = evening(), surv = rjSurv(), solo = !surv && !!(ev && ev.type === 'away'), { pre, cl } = closingSet(), cn = countDone(pre, cl), cml = minsLeft(pre, cl);
  const tick = `<section class="card"><div class="sec-head"><h2>${surv ? 'Survival closing duties' : solo ? 'Solo closing duties' : 'Closing duties'}</h2><span class="progress">${cn} of ${cl.length}${cml ? ` · about ${cml} min left` : ''}</span></div>
    <p class="muted small">${ev && ev.type === 'date' ? 'Date night: these are optional tonight.' : `Bedtime starts around ${esc(H('week').bedtime || '18:45')}. Roll straight into these while it happens, before anyone sits down.`}</p>
    ${checklist(pre, cl)}${cl.length && cn === cl.length ? '<p class="alldone">All done. Clock out — the evening is yours.</p>' : ''}</section>`;
  rjPaneNow = 0; const today = rjToday() + (isMorning() && meValid() ? sec('r-morning', 'Your morning', '', morningBody()) : '') + (closingTime ? planCard() + prepCard() + (awayEv ? '' : tick) : nm >= 900 && meValid() ? sec('r-plan', 'Ready for tomorrow', planOf('next', me).planned ? 'planned ★' : 'not yet', planCard()) : '');
  let h = `<section class="hero rj-hero"><p class="eyebrow">Rhythms over routines</p><h1>The house, one beat at a time.</h1><p class="lede">Today, this week, this month. A rhythm can skip a beat and still find the groove.</p></section>
    <div class="pills rj-tabs" role="tablist">${['Today', 'This week', 'This month'].map((l, n) => `<button type="button" role="tab" class="pill${n === i ? ' on' : ''}" aria-selected="${n === i}" data-act="rj-pane" data-v="${n}">${l}</button>`).join('')}</div>
    <div class="rj-car" id="rjCar">${[today, (rjPaneNow = 1, rjWeekCard()), (rjPaneNow = 2, rjMonthCard())].map((x, n) => `<div class="rj-pane" data-i="${n}">${x}</div>`).join('')}</div>
    <h2 class="rj-lists-h">The lists</h2>`;
  const P = {};
  P.rules = `<section class="card"><div class="sec-head"><h2>Our three rules</h2></div><ul class="rules">
    <li><span>These lists serve us. We don’t serve them.</span></li><li><span>Missing days is morally neutral.</span></li><li><span>We don’t have to finish the whole task. One bathroom, a few kitchen jobs: it counts.</span></li></ul></section>`;
  P.closing = `<section class="card"><div class="sec-head"><h2>Closing duties</h2>${editBtn('closing')}</div><p class="muted small">If they keep not happening: make the list shorter, swap in something you actually care about, or change when you do it.</p>
    <label class="small" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">Girls’ bedtime starts around <input type="time" id="bedtime" data-act="bedtime" value="${esc(H('week').bedtime || '18:45')}"> <span class="muted">· closing duties show on Today 15 minutes before</span></label>
    ${ec ? editList('lists', 'closing', L.closing, 'Add a closing duty', MINDONE) + `<h3>Survival version</h3>` + editList('lists', 'survival', L.survival, 'Add a survival duty', MINDONE) + `<h3>Solo evenings</h3>` + editList('lists', 'solo', L.solo, 'Add a solo-evening duty', MINDONE) : `<ul class="rules">${(L.closing || []).map(x => `<li><span>${esc(x.text)}</span></li>`).join('') || '<li><span class="muted">None yet</span></li>'}</ul><p class="muted small">Survival version: ${(L.survival || []).map(x => esc(x.text)).join(' · ') || 'none yet'}</p>`}</section>`;
  P.restock = `<section class="card"><div class="sec-head"><h2>Restock run · ${DAYS_LONG[L.restockDay ?? 6]}s</h2>${editBtn('restock')}</div><p class="muted small">All the tedious little refills batched into one task, so they stop interrupting everything else.</p>
    ${er ? `<label class="small">Day: <select data-act="restock-day" id="restockDay" aria-label="Restock day">${DAYS_LONG.map((x, n) => `<option value="${n}" ${(L.restockDay ?? 6) === n ? 'selected' : ''}>${x}</option>`).join('')}</select></label>` + editList('lists', 'restock', L.restock, 'e.g. Toilet paper in the bathroom') : `<div class="chips">${(L.restock || []).map(x => `<span class="chip">${esc(x.text)}</span>`).join('') || '<span class="muted small">Nothing yet</span>'}</div>`}</section>`;
  P.house = `<section class="card"><div class="sec-head"><h2>Our house, room by room</h2>${editBtn('spaces')}</div>
    <p class="muted small">${H('house').size ? `About ${H('house').size} m² over three levels, plus the garden. ` : ''}What “livable” means in each space. Livable, not perfect. Tie one job to a moment that already happens every day.</p>
    <div class="house">${floorsOf(SP, es).map(([k, label, list]) => `<div class="floor floor-${k}"><div class="floor-label">${label}</div><div class="spaces">${list.map(s => spaceCard(s, es)).join('') || '<p class="empty">No spaces here yet.</p>'}</div></div>`).join('')}</div>
    ${es ? `<form class="addform" data-form="space"><input type="text" name="text" placeholder="New space, e.g. Balcony" required aria-label="New space"><select name="floor" aria-label="Floor">${FLOORS.map(f => `<option value="${f[0]}">${f[1]}</option>`).join('')}</select><button class="btn" type="submit">Add space</button></form>` : ''}</section>`;
  const R = rjR();
  const parts = [['r-rules', 'Our three rules', '', P.rules, true],
    ['r-l-weekly', 'Weekly jobs', `${(R.weekly || []).length}`, rjEditor('weekly', 'Weekly jobs', 'On a set day, done whether or not it looks ready. Mark the glass balls: in survival mode only they show.', 'day'), true],
    ['r-l-every', 'Every few days', `${(R.every || []).length}`, rjEditor('every', 'Every few days', 'No fixed day: they come due after about that many days since the last time.', 'every'), true],
    ['r-l-month', 'Every month', `${(R.everyMonth || []).length}`, rjEditor('everyMonth', 'Every month', 'Bigger jobs, once a month, any day you like.', 'none'), true],
    ['r-l-year', 'Once a year', `${(R.monthly || []).length}`, rjEditor('monthly', 'Once a year', 'Seasonal jobs and notes, in the month they belong to.', 'month'), true],
    ['r-closing-l', 'Closing duties', `${(L.closing || []).length}`, P.closing, true], ['r-restock', 'Restock run', `${DAYS_LONG[L.restockDay ?? 6]}s`, P.restock, true], ['r-supplies', 'Supply check', `${(L.supplies || []).length}`, supplyEditor(), true],
    ['r-house', 'The house, room by room', `${SP.length} spaces`, P.house, true], ['r-homerem', 'Reminders', `${remAll().filter(x => !x.date || x.date >= dk).length}`, remEditor(), true]];
  return h + parts.map(p => sec(...p)).join('');
}

const FLOORS = [['attic', 'Attic'], ['first', '1st floor'], ['ground', 'Ground floor'], ['garden', 'Garden'], ['other', 'Elsewhere']];
function floorsOf(spaces, showEmpty) {
  return FLOORS.map(([k, l]) => [k, l, spaces.filter(s => (FLOORS.some(f => f[0] === s.floor) ? s.floor : 'other') === k)])
    .filter(([k, , list]) => list.length || (showEmpty && k !== 'other'));
}
function spaceCard(s, es) {
  return `<div class="space"><div class="sec-head">${es ? rnInput('spaces', 'spaces', s, 'name', 'text', 'rename-space') : `<h3>${esc(s.name)}</h3>`}${es ? `<button class="chip x" data-act="del-space" data-id="${s.id}" aria-label="Remove ${esc(s.name)}">✕</button>` : ''}</div>
    ${s.note ? `<p class="muted small">${esc(s.note)}</p>` : ''}
    ${es ? `<ul class="edit-list">${(s.tasks || []).map(t => `<li><div class="txt rn">${rnInput('spaces', s.id, t, 'text', 'text', 'rename-task', `data-space="${s.id}"`)}</div><button class="chip x row-x" data-act="del-task" data-space="${s.id}" data-id="${t.id}" aria-label="Remove ${esc(t.text)}">✕</button></li>`).join('')}</ul>
      <form class="addform" data-form="task" data-space="${s.id}"><input type="text" name="text" placeholder="Add a job" required aria-label="New job for ${esc(s.name)}"><button class="btn" type="submit">Add</button></form>`
      : `<ul class="small">${(s.tasks || []).map(t => `<li>${esc(t.text)}</li>`).join('')}</ul>`}</div>`;
}
/* ---------- taps on this area's buttons (data-act), called from events.js; true = handled ---------- */
function tapBeat(a, el, e, r) {
  switch (a) {
    case 'rj-pane': { S.ui.rjPane = +el.dataset.v; lsSet('afloat.rjPane', el.dataset.v); S.ui.rjSch = null; const c = document.getElementById('rjCar'); if (c) c.scrollTo({ left: S.ui.rjPane * c.clientWidth, behavior: 'smooth' }); rjCarSync(); setTimeout(() => rjCarSync(), 400); return true; }
    case 'beat-off': beatOff(el.dataset.id); return true;
    case 'beat-less': beatLess(el.dataset.id); return true;
    case 'beat-keep': beatReset(el.dataset.id); render(true); return true;
    case 'beat-bud': saveQuiet('rhythms', { ...rjR(), budget: { ...(rjR().budget || {}), [me]: +el.dataset.v } }); render(true); return true;
    case 'rs-done': toggleKey('week', 'rs:run', true); return true;
    case 'del-space': { const o = { ...H('spaces') }; o.spaces = (o.spaces || []).filter(s => s.id !== el.dataset.id); saveHome('spaces', o); return true; }
    case 'del-task': { const o = { ...H('spaces') }; o.spaces = (o.spaces || []).map(s => s.id === el.dataset.space ? { ...s, tasks: (s.tasks || []).filter(t => t.id !== el.dataset.id) } : s); saveHome('spaces', o); return true; }
  }
  return false;
}
