/* Afloat · app/reminders.js · Reminders (home/reminders, one-off reminders) and phone notifications (notifyPlan, bundles, daily ceiling).
   Plain script: shares one scope with the other app/*.js files (loaded in order by index.html). See CLAUDE.md. */
/* ---------- reminders: one system for every nudge at a time (6 Nov 2026) ----------
   To-dos live in Trello; reminders live here. home/reminders { list: [R], migrated } with
   R = { id, text, who: a name or 'both', at: 'HH:MM' or '', days: [0-6, Monday = 0] (empty = every day), date: 'YYYY-MM-DD'
   for a one-off (then days are ignored), home: only while you're at home, live: always rings (medicine, leaving),
   src: 'you' | 'photo' | 'sick' | 'plan' | 'seed', ref: what made it (to remove it again) }.
   Ticks: days/<date>.done['rem:<id>']. They show on Today in the Reminders group (from their time; home-only ones only
   while you're home), in the briefing when they're due, and ring on your phone at their time (Settings → Phone reminders).
   Edited in Rhythms → The lists → Reminders (also under My mornings). One-offs are dropped a week after their day. */
const remAll = () => H('reminders').list || [];
function remSave(list) { saveHome('reminders', { ...H('reminders'), list: list.filter(x => !x.date || x.date >= calAdd(dk, -7)) }); }
function remAdd(items) { const L = remAll(); remSave([...L, ...items.filter(x => x.text && !L.some(y => y.ref && y.ref === x.ref && y.date === x.date && y.at === x.at)).map(x => ({ id: uid(), who: me, at: '', days: [], date: '', home: false, live: false, src: 'you', ...x }))]); }
const remDel = pred => remSave(remAll().filter(x => !pred(x)));
const remUpd = (id, patch) => remSave(remAll().map(x => x.id === id ? { ...x, ...patch } : x));
const remDayOk = (x, k) => x.date ? x.date === k : !(x.days || []).length || x.days.includes((new Date(k + 'T12:00').getDay() + 6) % 7);
const remOn = (k = dk, n = me) => remAll().filter(x => (x.who === n || x.who === 'both') && remDayOk(x, k)).sort((a, b) => (a.at || '00:00').localeCompare(b.at || '00:00'));
const remTicked = x => isDone((S.day.done || {})['rem:' + x.id]);
/* the ones that are yours now: their time has come, not ticked, and home-only ones only while you're home */
function remNow(nm = nowMin()) { const away = awayNow(); return remOn().filter(x => !remTicked(x) && (!x.at || nm >= toMin(x.at)) && !(x.home && away) && nm >= 5 * 60 && nm < 22 * 60); }
/* one-time import of the three old systems (reminders at a time, home reminders, reminders from photos) */
function remMigrate() {
  if (!db || !S.loaded || H('reminders').migrated) return;
  const out = [...remAll()], has = (t, w) => out.some(y => y.text.trim().toLowerCase() === String(t).trim().toLowerCase() && (y.who === w || y.who === 'both' || w === 'both'));
  for (const n of adults()) for (const r of prof(n).remind || []) if (r.text && !has(r.text, n)) out.push({ id: uid(), text: r.text, who: n, at: r.at || '', days: r.days || [], date: '', home: false, live: /medic|léky|lék |tablet|pill|prášek|dose|dávk/i.test(r.text), src: 'you' });
  for (const r of H('lists').homeRem || []) if (r.text && !has(r.text, 'both')) out.push({ id: uid(), text: r.text, who: 'both', at: r.from || '', days: r.days || [], date: '', home: true, live: false, src: 'you' });
  for (const r of H('oneoff').list || []) if (!r.done && r.title && r.date >= dk) out.push({ id: uid(), text: r.title, who: r.who || me, at: r.time || '', days: [], date: r.date, home: false, live: false, src: 'photo' });
  saveHome('reminders', { ...H('reminders'), list: out, migrated: 1 });
}
/* the household's starting reminders: with children, the five-minute pick-up before bedtime (anything else is the
   household's own, in Rhythms → The lists → Reminders). The first household's were written long ago and stay as they are. */
function remSeed() {
  remMigrate(); const R = H('reminders'); if (!db || !S.loaded || !R.migrated || R.seeded || ourHome()) return;
  const out = [...remAll()];
  if (kidsList().length) out.push({ id: uid(), text: `Five-minute pick-up with ${theKids()}: toys into the bins`, who: 'both', at: '18:20', days: [], date: '', home: true, live: false, src: 'seed' });
  saveHome('reminders', { ...R, list: out, seeded: 1 });
}
function awayNow(n = me, at = nowMin()) {
  const m = meAt(n, dk), ww = workWin(n);
  if (m === 'out' && ww && at >= toMin(ww[0]) - 15 && at < toMin(ww[1])) return true;
  return outingsOn(dk, n).some(e => at >= leaveAt(e) && at < (e.end ? toMin(e.end) : toMin(e.start) + 60) + travelOf(e).m);
}
/* Today's Reminders group: only the ones that are current (their time has come, not ticked). A ticked one leaves Today and shows under Done today in the Reminders editor. */
function remCard(full) {
  remSeed();
  if (!meValid() || sickOn() && !remOn().some(x => x.live)) return '';
  const now = remNow(); if (!now.length) return '';
  return `<section class="card remind"><div class="sec-head"><h3>Reminders</h3><span class="progress">${now.length} now</span></div>
    ${checklist('rem', now.map(x => ({ id: x.id, text: `${x.at ? x.at + ' · ' : ''}${x.text}` })))}
    ${full ? '<p class="muted small"><a class="link" href="#rhythms" data-act="rem-edit-go">All reminders</a></p>' : ''}</section>`;
}
/* one editor for all of them */
function remEditor() {
  const L = remAll().filter(x => !x.date || x.date >= dk).sort((a, b) => (!!a.date - !!b.date) || (a.at || '').localeCompare(b.at || '')), ppl = adults(), o = otherOf(me);
  const whoPills = x => [...ppl, 'both'].map(v => `<button type="button" class="tiny${x.who === v ? ' on' : ''}" data-act="rem-who" data-id="${x.id}" data-v="${esc(v)}">${v === 'both' ? (ppl.length > 2 ? 'Everyone' : 'Both') : v === me ? 'Me' : esc(v)}</button>`).join('');
  const src = { photo: 'from a photo', sick: 'sick-day medicine', plan: 'from Ready for tomorrow' };
  return `<section class="card rem-ed"><div class="sec-head"><h2>Reminders</h2></div>
    <p class="muted small">Everything Afloat nudges you about at a time. They show on Today from their time until ticked, and ring on your phone (Settings → Phone reminders). “Only while home” ones wait until the calendar says you’re home. To-dos belong on Trello instead.</p>
    ${remOn().filter(remTicked).length ? `<p class="muted small"><b>Done today:</b> ${remOn().filter(remTicked).map(x => `${x.at ? esc(x.at) + ' ' : ''}${esc(x.text)}`).join(' · ')}</p>` : ''}
    ${L.length ? `<ul class="edit-list rem-l">${L.map(x => `<li><div class="txt rn"><input type="text" class="rn-in" value="${esc(x.text)}" data-act="rem-f" data-id="${x.id}" data-f="text" aria-label="Reminder">
      <div class="rn-sub"><input type="time" class="rn-in" value="${esc(x.at || '')}" data-act="rem-f" data-id="${x.id}" data-f="at" aria-label="At">${x.date ? `<input type="date" class="rn-in" value="${esc(x.date)}" data-act="rem-f" data-id="${x.id}" data-f="date" aria-label="On"><span class="muted small">once</span>` : DAYS.map((d, i) => `<button type="button" class="tiny${(x.days || []).includes(i) ? ' on' : ''}" data-act="rem-day" data-id="${x.id}" data-d="${i}">${d}</button>`).join('')}</div>
      <div class="rn-sub">${whoPills(x)}<button type="button" class="tiny${x.home ? ' on' : ''}" data-act="rem-home" data-id="${x.id}" aria-pressed="${!!x.home}">Only while home</button>${x.live ? '<span class="muted small">always rings</span>' : ''}${src[x.src] ? `<span class="muted small">${src[x.src]}</span>` : ''}</div></div>
      <button class="chip x row-x" data-act="rem-del" data-id="${x.id}" aria-label="Remove ${esc(x.text)}">✕</button></li>`).join('')}</ul>` : '<p class="empty">No reminders yet.</p>'}
    <form class="addform" data-form="rem-add"><input type="text" name="text" placeholder="${kidsList().length ? 'e.g. Swap the kindergarten pyjamas' : 'e.g. Water the plants'}" required aria-label="New reminder"><input type="time" name="at" aria-label="At"><input type="date" name="date" aria-label="Once, on (leave empty for every day)">
      <select name="who" aria-label="For">${[[me, 'For me'], ...othersOf(me).map(n => [n, 'For ' + n]), ...(o ? [['both', ppl.length > 2 ? 'For everyone' : 'For both']] : [])].map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select>
      <label class="small"><input type="checkbox" name="home"> Only while home</label><button class="btn" type="submit">Add</button></form>
    <p class="muted small">No days ticked means every day. A date makes it a one-off.</p></section>`;
}

/* ---------- phone notifications (needs Settings → Connections → Notifications on this phone) ----------
   Afloat writes each person's next reminders to notify/<their sign-in id>; the server sends them when they're due.
   Leave-by (15 minutes before, with what's still to take) and home reminders that have a time. */
let notifySig = '';
/* The server only knows what the app last wrote, and the app may be closed when an event is deleted or moved in Google. So
   each leave-by item carries the Google event it came from ({calendar, event, start}); just before sending, the server asks
   Google: deleted → nothing is sent; moved → a "moved to …" note instead of a wrong leave time. */
function evCheck(e) {
  const g = e.gInst || e.gId; if (!g || !e.start || e.allDay || (e.recur && !e.gInst)) return null;
  const c = calCfg(), cal = e.src === 'mine' || e.src === 'invite' ? 'primary' : e.src === 'gp' ? c.gpId : c.calId;
  return cal ? { c: cal, g, s: `${e.date}T${e.start}` } : null;
}
function notifyPlan() {
  const cl = window.claude, uid = cl && cl.whoami && (cl.whoami() || {}).uid;
  if (!db || !uid || !meValid() || lsGet('afloat.push') !== '1') return;
  const items = [], base = k => new Date(k + 'T00:00:00').getTime();
  for (const k of [dk, tk]) for (const e of outingsOn(k)) {
    const la = leaveAt(e), at = base(k) + (la - 15) * 6e4, pre = `go:${outId(e)}`, chk = evCheck(e), ev = chk ? { ev: chk } : {};
    const open = packFor(e).filter(x => x.launch ? !(k === dk && isDone((S.day.done || {})[pPre(me, 'launch') + ':' + x.id])) : !isDone((S.month.done || {})[pre + ':' + x.id])).map(x => x.text);
    if (e.noLeave) { items.push({ tag: `go-${outId(e)}-${k}`, at, title: `${shortTitle(e.title)} on your way home`, body: open.length ? open.slice(0, 3).join('; ') : 'Check the notice board.', view: 'today', ...ev }); continue; }
    items.push({ tag: `go-${outId(e)}-${k}`, at, title: `Leave at ${mm2t(la)} for ${shortTitle(e.title)}`, body: open.length ? 'Take: ' + open.slice(0, 6).join(', ') : 'Everything’s packed.', view: 'today', ...ev });
    const lead = readyLead(e, me);
    if (lead > 15) {
      items.push({ tag: `rd-${outId(e)}-${k}`, at: base(k) + (la - lead) * 6e4, title: `Time to start getting ready`, body: `Leave at ${mm2t(la)} for ${shortTitle(e.title)}. First step: ${(readySteps(e)[0] || {}).text || 'shoes on'}.`, view: 'today', ...ev });
      /* a gentle halfway nudge, naming the next small step that isn't ticked yet */
      const mid = Math.round(lead * 2 / 3), nx = k === dk ? nextReadyStep(e) : readySteps(e)[0];
      if (mid > 15 && (k !== dk || nx || !readySteps(e).length)) items.push({ tag: `rd-${outId(e)}-mid-${k}`, at: base(k) + (la - mid) * 6e4, title: `${mid} minutes to go`, body: `${nx ? `Next small step: ${nx.text}. ` : ''}Leave at ${mm2t(la)}; no rush.`, view: 'today', ...ev });
    }
  }
  for (const k of [dk, tk]) { const L = H('lists'); if ((L.restockDay ?? 6) === kDow(k) && (L.restock || []).length && !(k === dk && rjDone({ kind: 'rs', id: 'run' }))) items.push({ tag: `restock-${k}`, at: base(k) + 10 * 36e5, title: 'Restock run today', body: `Music on, about 15 minutes. Anything running low goes onto ${shopName('shop')} from Today.`, view: 'today' }); }
  for (const [key, sv] of Object.entries(H('sched'))) if (sv && (sv.date === dk || sv.date === tk) && sv.at && (!sv.who || sv.who === me || sv.who === 'both')) { const j = rjFind(key); if (j && !(sv.date === dk && rjDone(j))) items.push({ tag: `job-${key.replace(/[^A-Za-z0-9-]/g, '-')}-${sv.date}`, at: base(sv.date) + toMin(sv.at) * 6e4, title: j.text, body: `${j.min ? `About ${j.min} minutes. ` : ''}Starting counts; finishing is optional.`, view: 'rhythms' }); }
  for (const k of [dk, tk]) for (const x of remOn(k).filter(x => x.at && !(k === dk && remTicked(x)))) items.push({ tag: `rem-${x.id}-${k}`, at: base(k) + toMin(x.at) * 6e4, title: x.text, body: x.home ? 'If you’re home now.' : 'A reminder from Afloat.', view: 'today', ...(x.live ? { live: true } : {}) });
  try { items.push(...fxNotify()); } catch (e) { console.warn(e); }
  const out = notifyBundle(items.filter(x => x.at > Date.now() - 5 * 6e4)).sort((a, b) => a.at - b.at).slice(0, 30), sig = JSON.stringify(out);
  if (sig === notifySig) return; notifySig = sig;
  q('notify/' + uid, () => db.doc('notify/' + uid).update({ name: me, items: out, at: Date.now() }));
}

/* the notification ceiling (6 Nov 2026): leave-by, getting ready and medicine ring on their own, always. Everything else
   rings by itself only while the day's count stays under your ceiling (Settings → Phone reminders, 6 by default); the
   rest, plus restock and scheduled jobs, wait for one of three bundles at 7:00, 12:00 and 18:00 ("Later today: …"). */
const NT_SLOTS = [7 * 60, 12 * 60, 18 * 60], NT_SLOT_T = ['This morning', 'This afternoon', 'This evening'];
const ntPrefs = (n = me) => ({ cap: 6, bundle: true, ...(prof(n).notify || {}) });
const ntLive = x => x.live || /^(go|rd)-/.test(x.tag) || /medic|léky|lék |pill|tablet|prášek|dose|dávk/i.test(x.title);
function notifyBundle(items) {
  const P = ntPrefs(); if (!P.bundle) return items;
  const out = [], byDay = {};
  for (const x of items) { const k = keyOf(new Date(x.at)); (byDay[k] = byDay[k] || []).push(x); }
  for (const [k, xs] of Object.entries(byDay)) {
    const live = xs.filter(ntLive), low = xs.filter(x => !ntLive(x) && /^(restock|job)-/.test(x.tag)), norm = xs.filter(x => !ntLive(x) && !low.includes(x)).sort((a, b) => a.at - b.at);
    const room = Math.max(2, (+P.cap || 99) - live.length), alone = norm.slice(0, room), wait = [...norm.slice(room), ...low];
    out.push(...live, ...alone);
    const groups = {};
    for (const x of wait) { const m = new Date(x.at).getHours() * 60 + new Date(x.at).getMinutes(); let i = NT_SLOTS.length - 1; while (i > 0 && NT_SLOTS[i] > m) i--; (groups[i] = groups[i] || []).push(x); }
    for (const [i, g] of Object.entries(groups)) { const at = new Date(k + 'T00:00:00').getTime() + NT_SLOTS[i] * 6e4;
      out.push({ tag: `dg-${i}-${k}`, at: Math.max(at, Math.min(...g.map(x => x.at)) - 3 * 36e5), title: `${NT_SLOT_T[i]} from Afloat`, body: g.sort((a, b) => a.at - b.at).map(x => `${fmtT(new Date(x.at).toISOString())} ${x.title}`).join(' · ').slice(0, 380), view: 'today' }); }
  }
  return out;
}
window.__notifyBundle = notifyBundle; /* for the tests */
/* ---------- one-off reminders ---------- */
/* the gentle background facts of the day */
function oneoffAdd(items, who = me) { remAdd(items.map(x => ({ text: x.title, who, at: x.time || '19:00', date: x.date, src: 'photo', ref: 'photo:' + x.title }))); }
/* ---------- taps on this area's buttons (data-act), called from events.js; true = handled ---------- */
function tapReminders(a, el, e, r) {
  switch (a) {
    case 'rem-who': remUpd(el.dataset.id, { who: el.dataset.v }); return true;
    case 'rem-day': { const x = remAll().find(y => y.id === el.dataset.id), d = +el.dataset.d; if (x) remUpd(x.id, { days: (x.days || []).includes(d) ? x.days.filter(y => y !== d) : [...(x.days || []), d].sort() }); return true; }
    case 'rem-home': { const x = remAll().find(y => y.id === el.dataset.id); if (x) remUpd(x.id, { home: !x.home }); return true; }
    case 'rem-del': remDel(x => x.id === el.dataset.id); return true;
    case 'rem-edit-go': COL['r-homerem'] = false; lsSet('afloat.col', JSON.stringify(COL)); return true;
  }
  return false;
}
