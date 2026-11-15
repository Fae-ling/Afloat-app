/* Afloat · app/rhythms.js · Rhythms: Today · This week · This month cards, the season check, the lists, the one-time list upgrade.
   Plain script: shares one scope with the other app/*.js files (loaded in order by index.html). See CLAUDE.md. */
/* ---------- Rhythms ---------- */
/* ---------- Rhythms: Today · This week · This month (rebuilt 5 Nov 2026) ----------
   KC Davis, How to Keep House While Drowning: rhythms over routines (a set day, done whether or not it looks "ready";
   missed beats are morally neutral, nothing is ever "overdue"), four to six small weekly jobs per space, bigger jobs
   monthly, one restock run, closing duties with a survival version, glass balls first (food, kids, meds, pets), good
   enough is perfect. Plus, chosen 5 Nov 2026: Tody-style jobs "every ~N days" that slowly turn due; minutes per job and
   what fits the gap you have; an owner per job (or together, or anyone) and little jobs for the girls; a 15-minute
   together sprint; tap any job to give it a day and a time (Afloat only: it shows on Today and can send a phone reminder);
   and Claude checks the lists once a season and suggests changes you tick to keep.
   home/rhythms: weekly [{id, text, day 0-6, min, owner, months, glass}], every [{id, text, every (days), min, owner, months, glass}],
     everyMonth [{id, text, min, owner}], monthly (once a year, by month) [{id, text, month 0-11, note}], v, review {...}.
   home/rlog {id: {last, prev}} for the every-few-days jobs. home/sched {'<kind>:<id>': {date, at, who, text, min}}.
   Done: weekly in weeks/<wk>.done['r:<id>'] (restock 'rs:run'), every month 'mm:<id>' and once a year 'm:<id>' in months/<mk>.done,
   home reminders 'hr:<id>' on the day. */
const rjR = () => H('rhythms');
let rjPaneNow = 0; /* which card is being drawn, so a job opened on one card doesn't open on the others */
const rjLog = () => H('rlog');
const rjSchAll = () => H('sched');
const kMonth = k => +k.slice(5, 7) - 1;
const kDow = k => (new Date(k + 'T12:00').getDay() + 6) % 7;
const inSeason = (x, k = dk) => !(x.months || []).length || x.months.includes(kMonth(k));
const rjWeek0 = () => calAdd(dk, -dow());
const rjSurv = () => hMode() === 'survival';
const rjMine = j => !j.owner || j.owner === 'both' || j.owner === me;
const rjOwnerLbl = j => !j.owner ? '' : j.owner === 'both' ? 'together' : j.owner === me ? 'you' : j.owner;
const rjBed = () => toMin(H('week').bedtime || '18:45');
function rjSchOf(key) { const s = rjSchAll()[key]; return s && s.date && s.date >= dk ? s : null; }
function rjAll() {
  const R = rjR(), L = H('lists'), out = [];
  for (const x of R.weekly || []) out.push({ ...x, kind: 'w' });
  if ((L.restock || []).length) out.push({ kind: 'rs', id: 'run', text: 'Restock run: the little refills', min: 15, day: L.restockDay ?? 6, sub: (L.restock || []).map(x => x.text).slice(0, 3).join(', ') + ((L.restock || []).length > 3 ? '…' : '') });
  for (const x of R.every || []) out.push({ ...x, kind: 'e' });
  for (const x of R.everyMonth || []) out.push({ ...x, kind: 'm' });
  for (const x of R.monthly || []) if (!x.note) out.push({ ...x, kind: 'y' });
  return out.map(j => ({ ...j, key: j.kind + ':' + j.id }));
}
const rjFind = key => rjAll().find(j => j.key === key) || null;
function rjDone(j) {
  if (j.kind === 'w') return isDone((S.week.done || {})['r:' + j.id]);
  if (j.kind === 'rs') { const R = (H('lists').restock || []).filter(x => inSeason(x)); return isDone((S.week.done || {})['rs:run']) || (R.length > 0 && countDone('k', R) === R.length); }
  if (j.kind === 'm') return isDone((S.month.done || {})['mm:' + j.id]);
  if (j.kind === 'y') return isDone((S.month.done || {})['m:' + j.id]);
  if (j.kind === 'hr') return isDone((S.day.done || {})['rem:' + j.id]);
  if (j.kind === 'e') return (rjLog()[j.id] || {}).last === dk;
  return false;
}
const rjAge = j => { const l = (rjLog()[j.id] || {}).last; return l ? dayDiffK(l, dk) : null; };
function rjState(j) { const a = rjAge(j), ev = Math.max(1, +j.every || 7); if (a == null) return 'new'; const r = a / ev; return r >= 1 ? 'due' : r >= 0.7 ? 'soon' : 'fresh'; }
const rjRatio = j => { const a = rjAge(j); return a == null ? 0.5 : a / Math.max(1, +j.every || 7); };
const rjAgeLbl = j => { const a = rjAge(j), ev = +j.every || 7, every = ev === 1 ? 'daily' : `every ~${ev} days`; return a == null ? every : a === 0 ? `done today · ${every}` : `${rjState(j) === 'due' ? 'ready · ' : ''}last time ${a === 1 ? 'yesterday' : a + ' days ago'} · ${every}`; };
/* jobs that belong to a day: weekly jobs on their weekday and the restock run, unless given another day; anything scheduled for it */
function rjOnDay(k) {
  const d = kDow(k), out = [];
  for (const j of rjAll()) {
    const s = rjSchOf(j.key);
    if (s) { if (s.date === k) out.push({ ...j, sch: s }); continue; }
    if ((j.kind === 'w' || j.kind === 'rs') && j.day === d && inSeason(j, k)) out.push(j);
  }
  return out.filter(j => !rjSurv() || j.glass || j.sch);
}
const rjSort = (a, b) => ((a.sch && a.sch.at) || '99').localeCompare((b.sch && b.sch.at) || '99');
/* one job: tick on the left, tap the text to give it a day and a time */
function rjRow(j, o = {}) {
  const on = rjDone(j), st = j.kind === 'e' ? rjState(j) : '', open = (S.ui.rjSch || {}).key === j.key && (S.ui.rjSch.pane ?? rjPaneNow) === rjPaneNow;
  const meta = [o.showDate && j.sch && j.sch.date !== dk ? esc(fmtD(j.sch.date)) : '', !o.time && j.sch && j.sch.at ? `<b>${esc(j.sch.at)}</b>` : '', j.min ? `~${j.min} min` : '',
    rjOwnerLbl(j) ? esc(rjOwnerLbl(j)) : '', j.kind === 'e' ? esc(rjAgeLbl(j)) : '', o.fits && !on ? '<span class="rj-fit">fits now</span>' : ''].filter(Boolean).join(' · ');
  return `<li class="rj${on ? ' on' : ''}${st ? ' st-' + st : ''}${o.past ? ' past' : ''}" data-sw-r="@rj-tick:${esc(j.key)}" data-sw-r-label="${on ? 'Undo' : '✓ Done'}">${o.time ? `<span class="rj-time">${esc(o.time)}</span>` : ''}
    <button class="rj-box" data-act="rj-tick" data-id="${esc(j.key)}" aria-pressed="${on}" aria-label="${on ? 'Not done yet' : 'Done'}: ${esc(j.text)}"><span class="box" aria-hidden="true">${I.check}</span></button>
    ${o.noSch ? `<span class="rj-t"><span class="txt">${esc(j.text)}</span>${meta ? `<span class="rj-m small">${meta}</span>` : ''}</span>`
      : `<button class="rj-t" data-act="rj-open" data-id="${esc(j.key)}" aria-expanded="${open}"><span class="txt">${esc(j.text)}</span>${j.sub ? `<span class="muted small">${esc(j.sub)}</span>` : ''}${meta ? `<span class="rj-m small">${meta}</span>` : ''}</button>`}${o.skip && !on ? `<button class="rj-skip small" data-act="beat-skip" data-id="${esc(j.key)}">Not today</button>` : ''}</li>${open ? rjSchPanel(j) : ''}`;
}
/* good moments for a job on a given day, from how the day goes */
function rjSlots(k) {
  const out = [], nm = nowMin(), bt = rjBed(), wkd = kDow(k) >= 5, add = (t, l) => { if (!(k === dk && toMin(t) <= nm) && !out.some(x => x[0] === t)) out.push([t, l]); };
  if (k === dk && nm < 21 * 60) { const t = Math.ceil((nm + 5) / 15) * 15; out.push([mm2t(t), 'Now']); }
  if (wkd) add('09:30', 'Morning');
  else if (isFlex(me) && girlsAt(k) === 'kinder') add('09:00', 'After drop-off');
  if ((isFlex(me) || wkd) && napOf()) add(napOf().from, `${napOf().kid}’s nap`);
  if (!wkd && !isFlex(me)) { const hrs = dayHours(me, k); if (hrs && hrs[1]) add(mm2t(toMin(hrs[1]) + 20), 'Once you’re home'); }
  add(mm2t(bt + 60), 'After bedtime');
  return out.slice(0, 4);
}
function rjSchPanel(j) {
  const u = S.ui.rjSch, days = Array.from({ length: 7 }, (_, i) => calAdd(dk, i)), other = otherOf(me), cur = rjSchOf(j.key);
  const dl = k => k === dk ? 'Today' : k === tk ? 'Tomorrow' : DAYS[kDow(k)];
  return `<li class="rj-sch" aria-label="When to do it">
    <p class="small"><b>When?</b></p><div class="pills">${days.map(k => `<button type="button" class="pill${u.date === k ? ' on' : ''}" data-act="rj-day" data-k="${k}">${dl(k)}</button>`).join('')}<input type="date" id="rjDate" data-act="rj-date" value="${esc(u.date)}" aria-label="Another day"></div>
    <div class="pills">${rjSlots(u.date).map(([t, l]) => `<button type="button" class="pill${u.at === t ? ' on' : ''}" data-act="rj-at" data-v="${t}">${esc(l)} <span class="muted">${t}</span></button>`).join('')}<input type="time" id="rjTime" data-act="rj-time" value="${esc(u.at || '')}" aria-label="Time"></div>
    ${other ? `<div class="pills">${[[me, 'Me'], [other, other], ['both', 'Together']].map(([v, l]) => `<button type="button" class="pill${(u.who || me) === v ? ' on' : ''}" data-act="rj-who" data-v="${esc(v)}">${esc(l)}</button>`).join('')}</div>` : ''}
    <div class="actions"><button class="btn accent" data-act="rj-save" ${u.at ? '' : 'disabled'}>Save</button>${cur ? '<button class="btn ghost" data-act="rj-unsch">Back to its usual day</button>' : ''}<button class="btn ghost" data-act="rj-close">Cancel</button></div>
    <p class="muted small">It shows on Today at that time${lsGet('afloat.push') === '1' ? ' and your phone reminds you' : ''}.</p></li>`;
}
function rjOpen(key) {
  if ((S.ui.rjSch || {}).key === key && S.ui.rjSch.pane === (S.ui.rjPane || 0)) { S.ui.rjSch = null; render(true); return; }
  const s = rjSchOf(key), j = rjFind(key); if (!j) return;
  S.ui.rjSch = { key, pane: S.ui.rjPane || 0, date: s ? s.date : dk, at: s ? s.at : '', who: s ? s.who : (j.owner && j.owner !== '' ? j.owner : me) }; render(true);
}
function rjSave() {
  const u = S.ui.rjSch, j = u && rjFind(u.key); if (!j || !u.at || !u.date) return;
  const v = { date: u.date, at: u.at, who: u.who || me, text: j.text, min: +j.min || 0, by: me || '', ts: Date.now() };
  S.home.sched = { ...rjSchAll(), [u.key]: v }; mergeDoc('home/sched', { [u.key]: v }); S.ui.rjSch = null;
  toast(`${j.text}: ${u.date === dk ? 'today' : u.date === tk ? 'tomorrow' : fmtD(u.date)} at ${u.at}.`); render(true);
}
function rjUnsch(key) { S.home.sched = { ...rjSchAll(), [key]: null }; mergeDoc('home/sched', { [key]: null }); S.ui.rjSch = null; render(true); }
function rjTick(key) {
  const i = key.indexOf(':'), kind = key.slice(0, i), id = key.slice(i + 1);
  setTimeout(() => { const j = rjFind(key); if (j && rjDone(j)) beatReset(key); }, 0);
  if (kind === 'w') toggleKey('week', 'r:' + id);
  else if (kind === 'rs') toggleKey('week', 'rs:run');
  else if (kind === 'm') toggleKey('month', 'mm:' + id);
  else if (kind === 'y') toggleKey('month', 'm:' + id);
  else if (kind === 'hr') toggleKey('day', 'rem:' + id);
  else if (kind === 'e') {
    const l = rjLog()[id] || {}, val = l.last === dk ? { last: l.prev || null, prev: null } : { last: dk, prev: l.last || null };
    S.home.rlog = { ...rjLog(), [id]: val }; mergeDoc('home/rlog', { [id]: val });
    if (val.last === dk) { toast(CHEERS[Math.floor(Math.random() * CHEERS.length)]); if (rjSchOf(key)) rjUnsch(key); }
    render(true);
  }
}
/* what Today's card lists: the day in time order, then "any time today" */
function rjToday() {
  if (!meValid()) return '<section class="card"><h2>Today</h2><p class="empty">Choose who you are on the Today tab first.</p></section>';
  const nm = nowMin(), bt = rjBed(), surv = rjSurv(), rows = [], allDay = [];
  for (const r of dayRows(dk)) { if (r.job) continue; if (r.allDay) { allDay.push(r.title); continue; } rows.push({ t: r.s, en: r.en, ev: r }); }
  const onDay = rjOnDay(dk);
  for (const j of onDay.filter(j => j.sch && j.sch.at && (j.sch.who === me || j.sch.who === 'both' || !j.sch.who))) rows.push({ t: toMin(j.sch.at), en: toMin(j.sch.at) + Math.max(10, +j.min || 15), job: j });
  for (const x of remOn(dk).filter(x => x.at)) rows.push({ t: toMin(x.at), en: toMin(x.at) + 10, job: { kind: 'hr', id: x.id, key: 'rem:' + x.id, text: x.text }, noSch: true });
  const { pre, cl } = closingSet(); rows.push({ t: bt - 15, en: bt + 60, closing: true, txt: `Closing duties · ${countDone(pre, cl)} of ${cl.length}` });
  rows.sort((a, b) => a.t - b.t);
  const next = rows.find(r => r.t > nm), gap = (next ? next.t : bt - 15) - nm, gapOk = gap >= 10 && nm >= 6 * 60 && nm < bt - 15;
  const bp = beatPlan(), anyR = [...bp.base.filter(j => !(j.sch && j.sch.at)), ...onDay.filter(j => j.kind === 'rs'),
    ...remOn(dk).filter(x => !x.at).map(x => ({ kind: 'hr', id: x.id, key: 'rem:' + x.id, text: x.text, noSch: true })), ...bp.extras];
  const fits = j => gapOk && !rjDone(j) && +j.min > 0 && +j.min <= gap;
  const row = r => r.job ? rjRow(r.job, { time: mm2t(r.t), noSch: r.noSch, past: r.en <= nm && rjDone(r.job) })
    : r.closing ? `<li class="rj ev${r.en <= nm ? ' past' : ''}"><span class="rj-time">${mm2t(r.t)}</span><span class="rj-dot" aria-hidden="true"></span><span class="rj-t"><span class="txt">${esc(r.txt)}</span></span></li>`
    : `<li class="rj ev${r.en <= nm ? ' past' : ''}${r.t <= nm && r.en > nm ? ' now' : ''}"><span class="rj-time">${mm2t(r.t)}</span><span class="rj-dot" style="background:${rowHex(r.ev)}" aria-hidden="true"></span><span class="rj-t"><span class="txt">${esc(r.ev.title)}</span>${r.ev.who ? `<span class="rj-m small">${esc(r.ev.who)}</span>` : ''}</span></li>`;
  const other = otherOf(me), theirs = other ? onDay.filter(j => j.owner === other && !(j.sch && j.sch.at)).length : 0;
  return `<section class="card rj-card"><div class="sec-head"><h2>Today</h2><span class="progress">${esc(DAYS_LONG[dow()])}</span></div>
    ${surv ? '<p class="note small">Survival mode: only the glass balls (food, the girls, meds, pets). The rest can wait without guilt.</p>' : ''}
    ${allDay.length ? `<p class="small muted">All day: ${allDay.map(esc).join(', ')}</p>` : ''}
    <ul class="rj-l rj-it">${rows.map(row).join('')}</ul>
    ${gapOk ? `<p class="small rj-gap">About <b>${gap >= 120 ? Math.floor(gap / 60) + ' h' : gap + ' min'}</b> free ${next ? `before ${esc(next.ev ? next.ev.title : next.job ? next.job.text : next.txt)}` : 'until closing duties'}.${anyR.some(fits) ? ' Marked jobs fit.' : ''}</p>` : ''}
    <h3>Any time today</h3>${anyR.length ? `<ul class="rj-l">${anyR.map(j => rjRow(j, { fits: fits(j), noSch: j.noSch, skip: !j.noSch && j.kind !== 'rs' })).join('')}</ul>` : '<p class="empty">Nothing on today’s rhythm. That’s allowed.</p>'}
    ${theirs ? `<p class="muted small">${esc(other)} has ${theirs} of today’s jobs.</p>` : ''}
    <div class="actions"><button class="btn ghost" data-act="rj-sprint">15 minutes together</button></div>
    <p class="muted small">Tap a job to give it a time. A body double helps: ${members().length > 1 ? 'start the sprint, each of you picks one thing, stop when it rings' : 'start the sprint with a friend on a call, or a video of someone tidying, and stop when it rings'}.</p></section>`;
}
function rjWeekCard() {
  const w0 = rjWeek0(), surv = rjSurv(), wj = rjAll().filter(j => (j.kind === 'w' || j.kind === 'rs') && inSeason(j)), done = wj.filter(rjDone).length;
  const dayHtml = k => { const js = rjOnDay(k).sort(rjSort);
    return `<div class="rj-wd${k === dk ? ' today' : ''}${k < dk ? ' past' : ''}"><h3>${esc(DAYS_LONG[kDow(k)])}${k === dk ? ' <span class="badge">today</span>' : ''} <span class="muted small">${esc(fmtD(k).replace(/^\w+ /, ''))}</span></h3>
      ${js.length ? `<ul class="rj-l">${js.map(j => rjRow(j)).join('')}</ul>` : '<p class="muted small">Nothing set. A free day.</p>'}</div>`; };
  const ks = Array.from({ length: 7 }, (_, i) => calAdd(w0, i)), past = ks.filter(k => k < dk), pj = past.flatMap(k => rjOnDay(k)), pd = pj.filter(rjDone).length;
  /* earlier days fold into one line: what's left of them can still be done, and missing them is morally neutral */
  const days = (past.length ? `<details class="rj-wd past"><summary class="small"><b>Earlier this week</b> · ${pd} of ${pj.length} done${pj.length > pd ? ', the rest can still happen or not' : ''}</summary>${past.map(dayHtml).join('')}</details>` : '') + ks.filter(k => k >= dk).map(dayHtml).join('');
  const ev = rjAll().filter(j => j.kind === 'e' && inSeason(j) && (!surv || j.glass)).sort((a, b) => rjRatio(b) - rjRatio(a));
  return `<section class="card rj-card"><div class="sec-head"><h2>This week</h2><span class="progress">${done} of ${wj.length} done</span></div>
    ${surv ? '<p class="note small">Survival mode: only the glass balls show.</p>' : ''}${days}
    <h3>Every few days</h3><p class="muted small">No fixed day. A job warms up as its time comes, and a missed week doesn’t pile up.</p>
    ${ev.length ? `<ul class="rj-l">${ev.map(j => rjRow(j, { showDate: true })).join('')}</ul>` : '<p class="empty">None yet.</p>'}</section>`;
}
function rjMonthCard() {
  const m = monthIdx(), R = rjR(), em = rjAll().filter(j => j.kind === 'm'), yr = rjAll().filter(j => j.kind === 'y' && j.month === m), notes = (R.monthly || []).filter(x => x.note && x.month === m);
  const all = [...em, ...yr], done = all.filter(rjDone).length, nx = (R.monthly || []).filter(x => x.month === (m + 1) % 12 && !x.note).map(x => x.text);
  return `<section class="card rj-card"><div class="sec-head"><h2>${esc(MONTHS[m])}</h2><span class="progress">${done} of ${all.length} done</span></div>
    <h3>Every month</h3>${em.length ? `<ul class="rj-l">${em.map(j => rjRow(j, { showDate: true })).join('')}</ul>` : '<p class="empty">None yet.</p>'}
    <h3>This time of year</h3>${notes.map(x => `<p class="note small">${esc(x.text)}</p>`).join('')}${yr.length ? `<ul class="rj-l">${yr.map(j => rjRow(j, { showDate: true })).join('')}</ul>` : '<p class="empty">Nothing special this month.</p>'}
    <p class="muted small">Skip what doesn’t matter this time, and help can be asked for or paid for.${nx.length ? ` Coming in ${esc(MONTHS[(m + 1) % 12])}: ${nx.map(esc).join('; ')}.` : ''}</p></section>${rjReviewCard()}`;
}
/* ---------- Claude's season check of the lists ----------
   From the 15th of the month before a season turns until the 14th of its first month (spring, summer, autumn, winter),
   Claude reads every list, the season and how the family lives, and suggests at most eight changes. Nothing changes
   until you tick the ones to keep and press Apply. You can also ask any time. */
const RJ_SEASONS = [[1, 'spring'], [4, 'summer'], [7, 'autumn'], [10, 'winter']];
function rjSeasonKey(k = dk) {
  const mo = kMonth(k), dd = +k.slice(8, 10), y = +k.slice(0, 4);
  for (const [m0, name] of RJ_SEASONS) if ((mo === m0 && dd >= 15) || (mo === (m0 + 1) % 12 && dd <= 14)) return `${mo === 0 && m0 === 10 ? y - 1 : y}-${name}`;
  return null;
}
const rjSeasonName = () => { const mo = monthIdx(); return mo >= 2 && mo <= 4 ? 'spring' : mo >= 5 && mo <= 7 ? 'summer' : mo >= 8 && mo <= 10 ? 'autumn' : 'winter'; };
const rjNextWindow = () => { const y = +dk.slice(0, 4); for (let i = 0; i < 14; i++) { const k = calAdd(dk, i * 7); if (rjSeasonKey(k)) { const mo = kMonth(k); return new Date(y + (mo < kMonth(dk) ? 1 : 0), RJ_SEASONS.find(s => s[0] === mo || (s[0] + 1) % 12 === mo)[0], 15); } } return null; };
function rjReviewCard() {
  const Rv = rjR().review || {}, key = rjSeasonKey(), busy = S.ui.rjAsk;
  if (sample && key && Rv.key !== key && !busy && !S.ui.rjAsked) { S.ui.rjAsked = true; setTimeout(() => rjAsk(key), 1500); }
  const items = (Rv.items || []), open = items.length && !Rv.closed, nw = rjNextWindow();
  return `<section class="card rj-review"><div class="sec-head"><h2>✦ Season check</h2>${Rv.at ? `<span class="progress">${esc(fmtD(keyOf(new Date(Rv.at))))}</span>` : ''}</div>
    ${open ? `<p class="small">${esc(Rv.summary || 'A few suggestions for the lists.')}</p>
      <ul class="rj-l">${items.map((x, i) => { const on = (Rv.pick || {})[i] !== false; return `<li class="rj${on ? ' on' : ''}"><button class="rj-box" data-act="rj-rv-pick" data-id="${i}" aria-pressed="${on}" aria-label="Keep this suggestion"><span class="box" aria-hidden="true">${I.check}</span></button>
        <span class="rj-t"><span class="txt">${esc(rjRvLabel(x))}</span>${x.why ? `<span class="rj-m small">${esc(x.why)}</span>` : ''}</span></li>`; }).join('')}</ul>
      <div class="actions"><button class="btn accent" data-act="rj-rv-apply">Apply the ticked ones</button><button class="btn ghost" data-act="rj-rv-close">Not now</button></div>`
    : `<p class="muted small">Once a season Claude reads the lists, the time of year and how your days go, and suggests what to add, drop or move. You choose; nothing changes by itself.${!key && nw ? ` Next check from ${esc(nw.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }))}.` : ''}</p>`}
    ${S.ui.rjErr ? `<p class="muted small">${esc(S.ui.rjErr)}</p>` : ''}
    ${sample ? `<div class="actions"><button class="btn ghost" data-act="rj-rv-ask" ${busy ? 'disabled' : ''}>${busy ? 'Reading the lists…' : open ? 'Ask again' : '✦ Check the lists now'}</button></div>` : ''}</section>`;
}
const RJ_LIST_LBL = { weekly: 'weekly', every: 'every few days', month: 'every month', season: 'once a year', restock: 'restock run', closing: 'closing duties' };
function rjRvLabel(x) {
  const where = RJ_LIST_LBL[x.list] || x.list, f = [x.day != null && x.list === 'weekly' ? DAYS_LONG[x.day] : '', x.every ? `every ~${x.every} days` : '', x.month != null && x.list === 'season' ? MONTHS[x.month] : '', x.min ? `~${x.min} min` : ''].filter(Boolean).join(', ');
  const cur = x.id ? rjRvItem(x.list, x.id) : null;
  return x.op === 'remove' ? `Drop from ${where}: ${cur ? cur.text : x.text || ''}` : x.op === 'change' ? `Change (${where}): ${cur ? cur.text : ''}${x.text && cur && x.text !== cur.text ? ` → ${x.text}` : ''}${f ? ` (${f})` : ''}` : `Add to ${where}: ${x.text}${f ? ` (${f})` : ''}`;
}
const RJ_LISTS = { weekly: ['rhythms', 'weekly'], every: ['rhythms', 'every'], month: ['rhythms', 'everyMonth'], season: ['rhythms', 'monthly'], restock: ['lists', 'restock'], closing: ['lists', 'closing'] };
const rjRvItem = (list, id) => { const L = RJ_LISTS[list]; return L ? (H(L[0])[L[1]] || []).find(x => x.id === id) || null : null; };
function rjListsText() {
  const R = rjR(), L = H('lists'), f = (arr, fn) => (arr || []).map(x => `  ${x.id}: ${x.text}${fn ? fn(x) : ''}`).join('\n');
  const mo = x => (x.months || []).length ? `; only in ${x.months.map(i => MONTHS[i].slice(0, 3)).join(' ')}` : '';
  const own = x => x.owner ? `; ${x.owner === 'both' ? 'together' : x.owner}` : '';
  return [`weekly (on a set day):\n${f(R.weekly, x => ` [${DAYS_LONG[x.day]}${x.min ? `, ${x.min} min` : ''}${own(x)}${mo(x)}]`)}`,
    `every (every few days, no fixed day):\n${f(R.every, x => ` [every ${x.every} days${x.min ? `, ${x.min} min` : ''}${own(x)}${mo(x)}]`)}`,
    `month (every month):\n${f(R.everyMonth, x => x.min ? ` [${x.min} min]` : '')}`,
    `season (once a year, in a given month):\n${f(R.monthly, x => ` [${MONTHS[x.month]}${x.note ? ', a note' : ''}]`)}`,
    `restock (one run on ${DAYS_LONG[L.restockDay ?? 6]}):\n${f(L.restock)}`, `closing (every evening):\n${f(L.closing)}`,
    `put off lately (“Not today” in a row):\n${Object.entries(H('beat')).filter(([k, v]) => k.startsWith('s:') && v && v.n >= 2).map(([k, v]) => { const j = rjFind(k.slice(2)); return j ? `  ${j.id}: ${j.text} (${v.n} times)` : ''; }).filter(Boolean).join('\n') || '  nothing'}`].join('\n\n');
}
async function rjAsk(key) {
  if (!sample || S.ui.rjAsk) return; S.ui.rjAsk = true; S.ui.rjErr = ''; render(true);
  const ks = kidsList().map(n => { const a = ageOf(pInfo(n).birthday); return a !== '' ? `${n} (${a})` : n; }).join(' and ');
  const text = `You help a family keep house the KC Davis way (How to Keep House While Drowning): care tasks are morally neutral and functional; rhythms over routines; four to six small weekly jobs per space keep it livable; bigger jobs monthly; one restock run; closing duties each evening with a survival version; glass balls (food, children, medicine, pets) before plastic ones; good enough is perfect; fewer, kinder jobs beat a long list.
${houseFacts()}
Today is ${new Date(dk + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}; the season ahead is ${(key || '').split('-')[1] || rjSeasonName()}. Czech context (holidays, winter tyres, heating season, ticks, kindergarten year from September).
Their lists, with ids:
${rjListsText()}
Suggest at most 8 changes that would really help this season: something missing, something that no longer earns its place, a job on the wrong day or too often, a seasonal job coming up. Prefer removing or simplifying over adding. Keep each job short and kind, at most 12 words.
Reply with only JSON: {"summary": "one or two sentences", "items": [{"op": "add" | "remove" | "change", "list": "weekly" | "every" | "month" | "season" | "restock" | "closing", "id": "existing id for remove or change", "text": "job text for add or a new wording", "day": 0-6 (Monday = 0, weekly only), "every": days (every only), "month": 0-11 (season only), "min": minutes, "why": "a short reason"}]}`;
  try {
    let out; try { out = await askClaude(text, { feature: 'season' }) || {}; } catch (e) { S.ui.rjErr = claudeWhy(e); S.ui.rjAsk = false; render(true); return; }
    const items = (Array.isArray(out.items) ? out.items : []).filter(x => x && RJ_LISTS[x.list] && ['add', 'remove', 'change'].includes(x.op) && (x.op === 'add' ? String(x.text || '').trim() : rjRvItem(x.list, x.id))).slice(0, 8)
      .map(x => ({ op: x.op, list: x.list, id: x.id || '', text: String(x.text || '').trim().slice(0, 120), ...(Number.isInteger(x.day) && x.day >= 0 && x.day <= 6 ? { day: x.day } : {}), ...(+x.every > 0 ? { every: Math.round(+x.every) } : {}), ...(Number.isInteger(x.month) && x.month >= 0 && x.month <= 11 ? { month: x.month } : {}), ...(+x.min > 0 ? { min: Math.round(+x.min) } : {}), why: String(x.why || '').trim().slice(0, 160) }));
    saveQuiet('rhythms', { ...rjR(), review: { key: key || rjSeasonKey() || `${dk.slice(0, 4)}-${rjSeasonName()}`, at: Date.now(), summary: String(out.summary || '').trim().slice(0, 300), items, pick: {}, closed: !items.length } });
    if (!items.length) toast('Claude read the lists and has nothing to change. Nice.');
  } catch (e) { console.warn('season check:', e); S.ui.rjErr = 'Claude answered, but the suggestions couldn’t be read. Try again.'; }
  S.ui.rjAsk = false; render(true);
}
function rjApply() {
  const Rv = rjR().review || {}, pick = Rv.pick || {}, chosen = (Rv.items || []).filter((_, i) => pick[i] !== false); if (!chosen.length) { rjRvClose(); return; }
  const docs = { rhythms: { ...rjR() }, lists: { ...H('lists') } };
  for (const x of chosen) {
    const [doc, field] = RJ_LISTS[x.list], arr = [...(docs[doc][field] || [])], fields = {};
    for (const f of ['day', 'every', 'month', 'min']) if (x[f] != null) fields[f] = x[f];
    if (x.op === 'add') arr.push({ id: uid(), text: x.text, ...(x.list === 'weekly' && fields.day == null ? { day: 6 } : {}), ...(x.list === 'every' && !fields.every ? { every: 7 } : {}), ...(x.list === 'season' && fields.month == null ? { month: monthIdx() } : {}), ...fields });
    else { const i = arr.findIndex(y => y.id === x.id); if (i < 0) continue; if (x.op === 'remove') arr.splice(i, 1); else arr[i] = { ...arr[i], ...(x.text ? { text: x.text } : {}), ...fields }; }
    docs[doc][field] = arr;
  }
  docs.rhythms.review = { ...Rv, closed: true, applied: chosen.length };
  saveHome('lists', docs.lists); saveHome('rhythms', docs.rhythms); toast(`${chosen.length} change${chosen.length === 1 ? '' : 's'} made to the lists.`);
}
function rjRvClose() { saveQuiet('rhythms', { ...rjR(), review: { ...(rjR().review || {}), closed: true } }); render(true); }
/* ---------- the lists themselves (below the cards): edit text, day, how often, minutes, who, season ---------- */
function rjEditor(field, title, sub, kind) {
  const its = rjR()[field] || [], ed = S.ui.edit['rj-' + field], other = otherOf(me), ms = members().map(m => m.name);
  const who = x => `<select data-act="rj-f" data-field="${field}" data-id="${x.id}" data-f="owner" id="rjo_${field}_${x.id}" aria-label="Who"><option value="">Anyone</option>${[...ms, ...kidsList()].map(n => `<option value="${esc(n)}" ${x.owner === n ? 'selected' : ''}>${esc(n)}</option>`).join('')}<option value="both" ${x.owner === 'both' ? 'selected' : ''}>Together</option></select>`;
  const when = x => kind === 'day' ? `<select data-act="rj-f" data-field="${field}" data-id="${x.id}" data-f="day" id="rjd_${field}_${x.id}" aria-label="Day">${DAYS_LONG.map((d, i) => `<option value="${i}" ${x.day === i ? 'selected' : ''}>${d}</option>`).join('')}</select>`
    : kind === 'every' ? `<label class="small">every <input type="number" min="1" max="365" class="rn-in rn-min" data-act="rj-f" data-field="${field}" data-id="${x.id}" data-f="every" id="rje_${field}_${x.id}" value="${+x.every || 7}" aria-label="Every how many days"> days</label>`
    : kind === 'month' ? `<select data-act="rj-f" data-field="${field}" data-id="${x.id}" data-f="month" id="rjm_${field}_${x.id}" aria-label="Month">${MONTHS.map((d, i) => `<option value="${i}" ${x.month === i ? 'selected' : ''}>${d}</option>`).join('')}</select>` : '';
  const season = x => kind === 'day' || kind === 'every' ? `<div class="rj-mo">${MONTHS.map((d, i) => `<button type="button" class="tiny${(x.months || []).includes(i) ? ' on' : ''}" data-act="rj-mo" data-field="${field}" data-id="${x.id}" data-m="${i}" aria-pressed="${(x.months || []).includes(i)}">${d.slice(0, 1)}</button>`).join('')}<span class="muted small">${(x.months || []).length ? 'only these months' : 'all year'}</span></div>` : '';
  const view = kind === 'month' ? MONTHS.map((mn, i) => { const xs = its.filter(x => x.month === i); return xs.length ? `<li><span class="txt small"><b>${mn.slice(0, 3)}</b> ${xs.map(x => esc(x.text)).join(' · ')}</span></li>` : ''; }).join('')
    : its.map(x => `<li><span class="txt small">${esc(x.text)} <span class="muted">· ${[kind === 'day' ? DAYS[x.day] : kind === 'every' ? `every ${x.every || 7} d` : '', x.min ? x.min + ' min' : '', x.owner ? (x.owner === 'both' ? 'together' : x.owner) : '', (x.months || []).length ? x.months.map(i => MONTHS[i].slice(0, 3)).join(' ') : ''].filter(Boolean).join(' · ')}</span></span></li>`).join('');
  const add = `<form class="addform" data-form="add" data-doc="rhythms" data-field="${field}"><input type="text" name="text" placeholder="${kind === 'every' ? 'e.g. Vacuum the stairs' : kind === 'month' ? 'e.g. Chimney sweep' : kind === 'day' ? 'e.g. Wash the bath mats' : 'e.g. Clean the oven'}" required aria-label="New job">${kind === 'day' ? daySelect() : kind === 'month' ? monthSelect() : kind === 'every' ? '<input type="number" name="every" min="1" max="365" value="7" aria-label="Every how many days">' : ''}<input type="number" name="min" min="1" max="240" placeholder="min" aria-label="Minutes"><button class="btn" type="submit">Add</button></form>`;
  return `<section class="card"><div class="sec-head"><h2>${title}</h2>${editBtn('rj-' + field)}</div><p class="muted small">${sub}</p>
    ${ed ? `<ul class="edit-list">${(kind === 'month' ? [...its].sort((a, b) => a.month - b.month) : its).map(x => `<li class="mvrow"><div class="txt rn">${rnInput('rhythms', field, x, 'text')}<div class="rn-sub">${when(x)}${kind !== 'month' ? rnInput('rhythms', field, x, 'min', 'number') + who(x) : ''}${kind === 'month' ? `<button type="button" class="tiny${x.note ? ' on' : ''}" data-act="rj-note" data-field="${field}" data-id="${x.id}">a note, not a job</button>` : `<button type="button" class="tiny${x.glass ? ' on' : ''}" data-act="rj-glass" data-field="${field}" data-id="${x.id}" aria-pressed="${!!x.glass}">glass ball</button>`}</div>${season(x)}</div><button class="chip x row-x" data-act="del" data-doc="rhythms" data-field="${field}" data-id="${x.id}" aria-label="Remove">✕</button></li>`).join('')}</ul>${add}`
      : `<ul class="edit-list">${view || '<li class="muted small">None yet.</li>'}</ul>`}</section>`;
}
/* ---------- a new household's starting rhythms (10 Nov 2026), from the book: a few small weekly jobs, every-few-days jobs
   that say "ready", a handful of monthly and once-a-year ones. Kids' jobs only with children. Everything can be changed,
   and the season check (Claude) tunes it to the household. The first household's lists were built long ago (v: 2). ---------- */
const RJ_SEED = {
  weekly: [{ id: 'w2-laundry', text: 'Laundry: everything, cold wash, no sorting', day: 0, min: 20 }, { id: 'w2-laundry2', text: 'Laundry, round two', day: 5, min: 20 },
    { id: 'w2-paper', text: 'Paper basket: letters, bills and forms', day: 6, min: 10 }, { id: 'w2-kitchen', text: 'Kitchen: wipe the hob, microwave and sink', day: 2, min: 10 },
    { id: 'w2-sheets', text: 'Fresh sheets on one bed', day: 3, min: 10 },
    { id: 'w2-winterkit', kids: 1, text: 'Kids’ winter things dry and still fitting: mittens, hats, boots', day: 0, min: 5, months: [10, 11, 0, 1, 2] }],
  every: [{ id: 'e2-vac', text: 'Vacuum where it shows most', every: 4, min: 15 }, { id: 'e2-bath', text: 'Bathroom: sink, tub and toilet, two wipes and done', every: 7, min: 10 },
    { id: 'e2-mop', text: 'Mop the kitchen floor', every: 10, min: 15 }, { id: 'e2-towels', text: 'Fresh kitchen towels and dishcloth', every: 3, min: 2 },
    { id: 'e2-hood', text: 'Cooker hood: wash the grease filter', every: 90, min: 10 },
    { id: 'e2-toys', kids: 1, text: 'Toy rotation: a few toys away, a few back', every: 14, min: 10 }],
  everyMonth: [{ id: 'm2-wm', text: 'Washing machine: clean the filter, run an empty hot wash', min: 20 }, { id: 'm2-dw', text: 'Dishwasher: rinse the filter', min: 5 },
    { id: 'm2-fridge', text: 'Fridge: old things out, one shelf wiped', min: 15 }, { id: 'm2-money', text: 'Money check-in: bills paid, what’s coming next month', min: 20 },
    { id: 'm2-meds', text: 'Medicine box: anything out of date or running low?', min: 10 }],
  monthly: [{ id: 'y2-radiators', month: 9, text: 'Bleed the radiators as the heating starts' },
    { id: 'y2-mikulas', kids: 1, month: 10, text: 'Mikuláš (5 December): plan the evening and the little parcels' }, { id: 'y2-xmas', month: 11, text: 'Christmas: the presents list (good enough is perfect)' },
    { id: 'y2-easter', kids: 1, month: 2, text: 'Easter: eggs to dye' }, { id: 'y2-spring', month: 3, text: 'Winter things away, summer things down' },
    { id: 'y2-kg-year', kids: 1, month: 7, text: 'New school or kindergarten year: forms, fees and fresh spare clothes for September' }] };
function rjSeed() {
  if (!db || !S.loaded || ourHome() || (rjR().v || 0) >= 2 || S.ui.rjSeeded) return; S.ui.rjSeeded = true;
  const R = { ...rjR() }, kids = kidsList().length > 0, fit = xs => xs.filter(x => kids || !x.kids).map(({ kids: _, ...x }) => x);
  const has = (arr, x) => arr.some(y => y.id === x.id || String(y.text).toLowerCase() === String(x.text).toLowerCase()), add = (k) => [...(R[k] || []), ...fit(RJ_SEED[k]).filter(x => !has(R[k] || [], x))];
  const weekly = add('weekly'), every = add('every'), everyMonth = add('everyMonth'), monthly = add('monthly');
  const log = { ...rjLog() }; every.forEach((x, i) => { if (!log[x.id]) log[x.id] = { last: calAdd(dk, -Math.round((+x.every || 7) * (0.25 + ((i * 3) % 7) / 10))), prev: null }; });
  saveHome('rlog', log); saveHome('rhythms', { ...R, weekly, every, everyMonth, monthly, v: 2 });
}
/* ---------- taps on this area's buttons (data-act), called from events.js; true = handled ---------- */
function tapRhythms(a, el, e, r) {
  switch (a) {
    case 'rj-tick': rjTick(el.dataset.id); return true;
    case 'beat-skip': beatSkip(el.dataset.id); return true;
    case 'rj-open': rjOpen(el.dataset.id); return true;
    case 'rj-day': S.ui.rjSch = { ...S.ui.rjSch, date: el.dataset.k, at: el.dataset.k !== (S.ui.rjSch || {}).date ? '' : S.ui.rjSch.at }; render(true); return true;
    case 'rj-at': S.ui.rjSch = { ...S.ui.rjSch, at: el.dataset.v }; render(true); return true;
    case 'rj-who': S.ui.rjSch = { ...S.ui.rjSch, who: el.dataset.v }; render(true); return true;
    case 'rj-save': rjSave(); return true;
    case 'rj-unsch': rjUnsch(S.ui.rjSch.key); return true;
    case 'rj-close': S.ui.rjSch = null; render(true); return true;
    case 'rj-sprint': startTimer(15, 'Together: 15 minutes, one thing each, then stop', true); toast('15 minutes. Pick one thing each; stop when it rings.'); return true;
    case 'rj-rv-pick': { const Rv = rjR().review || {}, pk = { ...(Rv.pick || {}) }, i = el.dataset.id; pk[i] = pk[i] === false; saveQuiet('rhythms', { ...rjR(), review: { ...Rv, pick: pk } }); render(true); return true; }
    case 'rj-rv-apply': rjApply(); return true;
    case 'rj-rv-close': rjRvClose(); return true;
    case 'rj-rv-ask': rjAsk(rjSeasonKey()); return true;
    case 'rj-mo': case 'rj-glass': case 'rj-note': { const d = el.dataset, R = rjR(), arr = R[d.field] || [];
      saveQuiet('rhythms', { ...R, [d.field]: arr.map(x => { if (x.id !== d.id) return x; if (d.act === 'rj-glass') return { ...x, glass: !x.glass }; if (d.act === 'rj-note') return { ...x, note: !x.note };
        const m = +d.m, ms = x.months || []; return { ...x, months: ms.includes(m) ? ms.filter(y => y !== m) : [...ms, m].sort((a, b) => a - b) }; }) }); render(true); return true; }
  }
  return false;
}
