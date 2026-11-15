/* Afloat · app/store.js · Firestore reads and writes (writeDoc, mergeDoc, saveHome), subscriptions, boot(), keeping calendar/Trello current, connection messages, toast, icons, tabs.
   Plain script: shares one scope with the other app/*.js files (loaded in order by index.html). See CLAUDE.md. */
/* ---------- store ---------- */
const exists = {};       // which documents are known to exist in Firestore
const mem = {};          // used only when the shared store is unavailable
/* Saving only what changed (9 Nov 2026). known[path] is the last copy this phone saw or wrote. writeDoc() compares the
   new version with it and sends only the fields that changed, down into nested maps (people.Eva.evening, not the whole
   document), so two phones changing different parts of the same document at about the same time no longer undo each
   other. Lists (arrays) are still saved whole. A document this phone hasn't seen yet is written whole, as before. */
const known = {};
const clone = x => JSON.parse(JSON.stringify(x === undefined ? null : x));
const isMap = x => !!x && typeof x === 'object' && !Array.isArray(x);
function fieldChanges(a, b, pre = [], out = []) {
  for (const k of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) {
    const p = [...pre, k], x = a ? a[k] : undefined, y = b ? b[k] : undefined;
    if (y === undefined) { if (x !== undefined) out.push([p, null, true]); continue; }
    if (isMap(x) && isMap(y) && p.length < 6 && Object.keys(y).every(Boolean)) fieldChanges(x, y, p, out);
    else if (JSON.stringify(x) !== JSON.stringify(y)) out.push([p, y]);
  }
  return out;
}
/* write data to path: only the changed fields when we know the stored copy, otherwise the whole document */
function putDoc(path, data) {
  const before = known[path], d = db.doc(path), full = clone(data);
  return q(path, async () => {
    const ch = before !== undefined && exists[path] && d.patch && Object.keys(full || {}).every(Boolean) ? fieldChanges(before, full) : null;
    if (ch && !ch.length) return;
    if (ch && ch.length <= 400) await d.patch(ch, full); else await d.set(full);
    exists[path] = true;
  });
}
const queues = {};
function q(path, fn) {
  queues[path] = (queues[path] || Promise.resolve()).then(fn).catch(e => {
    if (e && /permission/.test(e.code || '')) toast('Afloat couldn’t save that: this Google account isn’t in the household. Check Settings → Connections.');
    else if (e && e.code === 'quota_exceeded') toast('The shared storage is full. Delete a few old entries and try again.');
    else toast('That didn’t save. Check your connection and try again.');
    console.warn(e);
  });
  return queues[path];
}
function deepMerge(a, b) { const o = { ...a }; for (const k in b) o[k] = (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') ? deepMerge(a[k], b[k]) : b[k]; return o; }
function apply(path, data) {
  const [c, id] = path.split('/'); known[path] = clone(data || {});
  if (c === 'home') S.home[id] = data || {};
  else if (c === 'days' && id === dk) S.day = { mode: null, done: {}, ...(data || {}) };
  else if (c === 'months' && id === mk) S.month = { done: {}, ...(data || {}) };
  else if (c === 'weeks' && id === wk) S.week = { done: {}, ...(data || {}) };
  else if (c === 'plans' && id === dk) S.planT = data || {};
  else if (c === 'plans' && id === tk) S.planN = data || {};
}
function writeDoc(path, data) {
  const w = db ? putDoc(path, data) : null; /* putDoc compares with the copy from before this change, so it goes first */
  apply(path, data); render(true);
  if (!db) { mem[path] = data; return Promise.resolve(); }
  return w;
}
function mergeDoc(path, partial) {
  if (!db) { mem[path] = deepMerge(mem[path] || {}, partial); apply(path, mem[path]); render(true); return Promise.resolve(); }
  if (known[path] !== undefined) known[path] = deepMerge(known[path], clone(partial)); /* Firestore merges the same way */
  return q(path, async () => {
    if (!exists[path]) { const s = await db.doc(path).get(); exists[path] = s.exists; }
    if (exists[path]) await db.doc(path).update(partial);
    else { await db.doc(path).set(partial); exists[path] = true; }
  });
}
const H = name => S.home[name] || {};
function saveHome(name, obj) { return writeDoc('home/' + name, obj); }

let unsubDay = [], unsubHome = null, unsubWeek = null;
/* the weekly cycle starts on the chosen reset day at 4 am (Monday unless changed) */
function weekKey() { const d = shifted(), r = +(H('week').resetDay || 0); d.setDate(d.getDate() - ((dow() - r + 7) % 7)); return keyOf(d); }
function subscribeWeek() {
  const k = weekKey(); if (k === wk && (unsubWeek || !db)) return;
  wk = k; S.week = mem['weeks/' + wk] ? { done: {}, ...mem['weeks/' + wk] } : { done: {} };
  if (!db) return;
  if (unsubWeek) unsubWeek();
  unsubWeek = db.doc('weeks/' + wk).onSnapshot(s => { exists['weeks/' + wk] = s.exists; apply('weeks/' + wk, s.data()); relSyncHist(); render(); }, e => console.warn(e));
}
function subscribeDay() {
  unsubDay.forEach(u => u()); unsubDay = [];
  dk = dayKey(); mk = monthKey(); tk = tKey();
  S.day = { mode: null, done: {} }; S.month = { done: {} }; S.planT = {}; S.planN = {};
  for (const pk of [dk, tk]) unsubDay.push(db.doc('plans/' + pk).onSnapshot(s => { exists['plans/' + pk] = s.exists; apply('plans/' + pk, s.data()); render(); }, e => console.warn(e)));
  unsubDay.push(db.doc('days/' + dk).onSnapshot(s => { exists['days/' + dk] = s.exists; apply('days/' + dk, s.data()); render(); }, e => console.warn(e)));
  unsubDay.push(db.doc('months/' + mk).onSnapshot(s => { exists['months/' + mk] = s.exists; apply('months/' + mk, s.data()); render(); }, e => console.warn(e)));
}
async function boot() {
  render(true);
  try { [db, mcp] = window.claude ? await Promise.all([window.claude.use('db'), window.claude.use('mcp').catch(() => null)]) : [null, null]; } catch { db = null; }
  /* task apps behind one connector (platform/todo.js): Afloat's own lists next to Trello */
  if (db && window.afloatTodo) mcp = window.afloatTodo.wrap(mcp, db, { on: () => ownOn(), me: () => me, people: () => adults() });
  if (window.claude) window.claude.use('sample').then(f => { sample = f || null; render(); }).catch(() => {});
  if (window.claude) window.claude.use('permissions').then(pm => { S.perm = pm || null; }).catch(() => {});
  if (!db) { S.loaded = true; S.offline = true; render(true); return; }
  const slowT = setTimeout(() => { S.slow = true; render(); }, 10000);
  unsubHome = db.collection('home').onSnapshot(s => {
    /* also told when the server confirms the cached copy unchanged, so "can't reach" doesn't show by mistake */
    if (S.loaded && s.docChanges && s.docChanges().length === 0) { if (!s.metadata.fromCache) { clearTimeout(slowT); if (S.slow) { S.slow = false; render(); } } return; }
    s.docs.forEach(d => { exists['home/' + d.id] = true; apply('home/' + d.id, d.data()); });
    if (!s.metadata.fromCache) { clearTimeout(slowT); S.slow = false; }
    S.loaded = true; render();
    if (!S.trTried && mcp) { S.trTried = true; trLoad(); if (!(S.tb.boards.length && Date.now() - (S.tb.at || 0) < TB_TTL) || ownOn() !== tbBoards().some(b => b.id === 'af:board')) tbLoad(true).then(trLoad); }
    if (!S.lkTried && meValid()) { S.lkTried = true; lkLoad(); tgLoad(); }
    if (!S.calTried && mcp && (H('calendar').calId || H('calendar').gpId || showMine())) { S.calTried = true; calLoad(); }
  }, e => { clearTimeout(slowT); S.loaded = true; S.slow = true; render(); console.warn(e); }, { includeMetadataChanges: true });
  subscribeDay();
  subscribeEvents(); setTimeout(evBackfill, 8000);
}
/* ---------- calendar events from Firestore (9 Nov 2026) ----------
   Only what can be on screen: events that end EV_BACK days ago or later (further back once the calendar is browsed to an
   older month) plus every repeating event, whose first date can be long ago. Older one-off events stay stored, untouched;
   Google's own copy shows them when an old month is opened. evBackfill() once gives older documents the fields these two
   queries need (endDate, rrule). */
const EV_BACK = 60, evParts = { win: {}, rep: {} }, chased = {};
let evFrom = '', evUnsub = [];
const evCutoff = () => [calAdd(realToday(), -EV_BACK), calRange[0] || '9999'].sort()[0];
function subscribeEvents() {
  if (!db) return; const from = evCutoff(); if (evFrom && from >= evFrom) return; evFrom = from;
  const old = evUnsub; evUnsub = [];
  const on = part => s => { evParts[part] = Object.fromEntries(s.docs.map(d => [d.id, d.data()])); eventsChanged({ ...evParts.rep, ...evParts.win }); };
  evUnsub.push(db.collection('events').where('endDate', '>=', from).onSnapshot(on('win'), e => console.warn(e)));
  evUnsub.push(db.collection('events').where('rrule', '>', '').onSnapshot(on('rep'), e => console.warn(e)));
  old.forEach(u => u()); /* after the new ones, so nothing seems to vanish in between */
}
async function evBackfill() {
  if (!db || !S.loaded || H('household').evIdx) return;
  try {
    const all = await db.collection('events').get();
    for (const d of all.docs) { const e = d.data() || {}, fix = {};
      if (!e.endDate && e.date) fix.endDate = e.date;
      if (e.recur && !e.rrule) fix.rrule = toRRULE(e.recur, e.date);
      if (Object.keys(fix).length) await db.doc('events/' + d.id).update(fix); }
    mergeDoc('home/household', { evIdx: 1 });
  } catch (e) { console.warn('evBackfill', e); }
}
function eventsChanged(next) {
  const prev = S.events || {}; S.events = next;
    /* deleted on the other phone: its copy from Google mustn't linger here as a plain Google event until the next check */
    const gone = Object.entries(prev).filter(([id, e]) => !S.events[id] && (e.gId || e.gpGId));
    if (gone.length && S.gcal.at) S.gcal = { ...S.gcal, events: (S.gcal.events || []).filter(x => !gone.some(([, e]) => e.gId && (x.gId === e.gId || x.master === e.gId))), gp: (S.gcal.gp || []).filter(x => !gone.some(([, e]) => e.gpGId && x.gId === e.gpGId)) };
    /* added or changed on the other phone: Google's list here is missing it, so look again now instead of at the next check */
    const R = S.gcal.range;
    if (R && mcp && S.gcal.status !== 'loading') {
      const fresh = Object.entries(S.events).filter(([id, e]) => e.gId && e.by !== me && !chased[id] && (e.endDate || e.date) >= R[0] && e.date < R[1] && !(S.gcal.events || []).some(x => x.gId === e.gId || (e.recur && x.master === e.gId)));
      if (fresh.length) { fresh.forEach(([id]) => { chased[id] = 1; }); setTimeout(() => { if (S.gcal.status !== 'loading') calLoad(); }, 1500); }
    }
    if (S.gcal.status === 'ok' && S.gcal.recAt !== S.gcal.at) { S.gcal.recAt = S.gcal.at; reconcile(S.gcal.events || [], S.gcal.gp || []); }
  render();
}
/* ---------- keeping everything current (6 Nov 2026) ----------
   Live, on both phones the moment anyone changes it: everything in Firestore (home/*, plans, days, weeks, months, events).
   Looked up from outside, so only as fresh as the last look: Google Calendar (family, grandparents, your own, tomorrow), Trello
   and the forecast. One rule decides when to look again, whatever asked: every 3 minutes (calendar) or 5 (Trello) while the
   app is open; at once when you come back to it after 30 s (calendar) or a minute (Trello), or the phone is back online;
   and again each minute after a hiccup (no signal, Google didn't answer), unless the problem needs you (reconnect, share).
   Phone notifications are checked against Google by the server just before they're sent (functions/index.js). */
/* Only when it matters: if the calendar or Trello hasn't been checked for ten minutes, say so, so old information never passes
   for current. Quiet otherwise. A problem only you can fix (reconnect, share the calendar) is named; a hiccup just says it's retrying. */
function staleNote() {
  const out = [], chk = (x, name) => {
    if (!x || x.status !== 'error' || !x.at || Date.now() - x.at < 10 * 6e4) return;
    out.push(NEEDS_YOU.test((x.err && x.err.code) || '') ? connMsg(x.err, name) : `Couldn’t check ${name} since ${fmtT(x.at)}. What you see may be out of date; Afloat keeps trying.`);
  };
  chk(S.gcal, 'Google Calendar'); chk(S.trello, 'Trello');
  return out.map(t => `<p class="note">${esc(t)}</p>`).join('');
}
const REFRESH = { cal: 3 * 6e4, calBack: 30e3, tr: 5 * 6e4, trBack: 60e3 };
const NEEDS_YOU = /^(needs_reauth|server_not_connected|not_in_manifest|calendar_not_shared)$/;
function dueAgain(x, every) {
  if (!x) return false;
  if (x.status === 'ok') return Date.now() - (x.at || 0) > every;
  if (x.status === 'error') return !NEEDS_YOU.test((x.err && x.err.code) || '') && Date.now() - (x.errAt || 0) > 50e3;
  return false;
}
function refreshOutside(why) {
  if (document.hidden || !mcp) return;
  const back = why === 'back' || why === 'online';
  if (dueAgain(S.gcal, back ? REFRESH.calBack : REFRESH.cal) && !S.ui.ev && !S.ui.gpf && !S.ui.gpw) calLoad();
  if (dueAgain(S.trello, back ? REFRESH.trBack : REFRESH.tr) && !S.ui.task && !S.ui.capture) trLoad();
  if (!S.ui.lkAsk && !S.ui.lkNew) { lkRefresh(back); tgRefresh(back); }
}
setInterval(() => {
  try { notifyPlan(); } catch (e) { console.warn(e); }
  if (db && dayKey() !== dk) subscribeDay();
  refreshOutside('tick');
  render();
}, 60000);
document.addEventListener('visibilitychange', () => { if (document.hidden) return; if (S.planMine && Date.now() - (S.planMine.at || 0) > 60000) { S.planMine = { ...S.planMine, at: 0 }; render(); } refreshOutside('back'); });
window.addEventListener('online', () => refreshOutside('online'));
window.addEventListener('pageshow', e => { if (e.persisted) refreshOutside('back'); });

/* ---------- toast ---------- */
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 4200); }

/* ---------- icons ---------- */
const I = {
  check: '<svg viewBox="0 0 24 24" fill="none" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.2 4.2L19 7"/></svg>',
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 18c2 0 2-1.5 4.5-1.5S10 18 12 18s2.5-1.5 4.5-1.5S19 18 21 18"/><circle cx="12" cy="9.5" r="3.5"/><path d="M12 2.5v1.5M5.6 5.1l1 1M18.4 5.1l-1 1M3.5 11.5H5M19 11.5h1.5"/></svg>',
  reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/></svg>',
  stuck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 19h4c5 0 6-9 11-9h3"/><path d="M18 7l3 3-3 3"/></svg>',
  rhythms: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2.5 12c1.6 0 1.6-5 3.2-5s1.6 10 3.2 10 1.6-10 3.2-10 1.6 10 3.2 10 1.6-5 3.2-5 1.5 0 3 0"/></svg>',
  priorities: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3.5" y="3.5" width="5" height="5" rx="1.2" fill="currentColor"/><rect x="9.5" y="3.5" width="5" height="5" rx="1.2"/><rect x="15.5" y="3.5" width="5" height="5" rx="1.2"/><rect x="3.5" y="9.5" width="5" height="5" rx="1.2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1.2"/><rect x="15.5" y="15.5" width="5" height="5" rx="1.2"/><rect x="3.5" y="15.5" width="5" height="5" rx="1.2"/><rect x="9.5" y="15.5" width="5" height="5" rx="1.2"/><rect x="15.5" y="9.5" width="5" height="5" rx="1.2"/></svg>',
  care: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
  rest: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
  no: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M6 18L18 6"/></svg>',
  ring: '<svg viewBox="0 0 30 30" aria-hidden="true"><circle cx="15" cy="15" r="10" fill="none" stroke="var(--ring-band)" stroke-width="6"/><circle cx="15" cy="15" r="10" fill="none" stroke="var(--accent)" stroke-width="6" stroke-dasharray="7.854 7.854"/></svg>',
};
const TABS = [['today', 'Today', ['today', 'tasks']], ['plan', 'Ahead', ['calendar', 'plans', 'rhythms', 'mealplan']], ['meals', 'Meals', ['meals']], ['us', 'Us', ['care', 'together', 'trips', 'family']], ['help', 'Support', ['support', 'stuck', 'breakdown', 'overload', 'breathe', 'priorities']]];
const SUBL = { today: 'Today', tasks: 'Tasks', meals: 'Meals', mealplan: 'Week menu', rhythms: 'Rhythms', calendar: 'Calendar', plans: 'Projects', care: 'Self-care', family: 'Family', together: 'Together', trips: 'Trips', support: 'Support', stuck: 'Can’t start', breakdown: 'Break it down', overload: 'Overloaded', breathe: 'Breathe', priorities: 'Priority', focus: 'Focus', 'focus-areas': 'Areas', 'focus-done': 'Done' };
const VIEWS = Object.keys(SUBL).map(k => [k, SUBL[k]]);
/* Active mode (10 Nov 2026): a second set of tabs for doing things (Focus now; Move and others later), so Home doesn't grow.
   The mode is simply which set of tabs the screen belongs to; the header switch (render.js) jumps between them. */
const ACT_TABS = [['fnow', 'Focus', ['focus']], ['fareas', 'Areas', ['focus-areas']], ['fdone', 'Done', ['focus-done']]];
const ACT_VIEWS = ACT_TABS.flatMap(t => t[2]);
const isActive = (v = S.view) => ACT_VIEWS.includes(v);
/* the household's modules decide which screens are there (Meals, Tasks, Together, Trips); a tab with none left is gone */
const liveTabs = ts => ts.map(t => [t[0], t[1], t[2].filter(viewOn)]).filter(t => t[2].length);
const tabsNow = () => liveTabs(isActive() ? ACT_TABS : TABS);
const tabOf = v => liveTabs([...TABS, ...ACT_TABS]).find(t => t[2].includes(v)) || liveTabs(TABS)[0];
I.t_today = I.today; I.t_us = I.care;
I.t_meals = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3v8a2 2 0 0 0 2 2v8M10 3v8a2 2 0 0 1-2 2M8 3v6"/><path d="M17 21V3c-2 1.5-3 4-3 7s1 4 3 4"/></svg>';
I.t_plan = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M7.5 14h2M11 14h2M14.5 14h2M7.5 17h2"/></svg>';
I.t_help = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/><path d="M6 6l3.5 3.5M18 6l-3.5 3.5M6 18l3.5-3.5M18 18l-3.5-3.5"/></svg>';
/* ---------- connection problems, in plain words ---------- */
function connMsg(e, name) {
  switch (e && e.code) {
    case 'needs_reauth': return `${name} needs reconnecting in ${CONN_WHERE}.`;
    case 'server_not_connected': return `${name} isn’t connected for you yet. Connect it in ${CONN_WHERE}.`;
    case 'server_unavailable': return `${name} didn’t answer. Try again in a minute.`;
    case 'calendar_not_shared': { const em = (String(e.message || '').match(/account (\S+@\S+) /) || [])[1] || 'the Google account you connected';
      return `${em} can’t see “${e.cal || 'this calendar'}”. Connect the Google account that has it in ${CONN_WHERE}, or share the calendar with ${em} (with permission to make changes).`; }
    case 'tool_error': return `${name} refused that${e.cal ? ` for “${e.cal}”` : ''}: ` + String(e.message || '').slice(0, 140);
    default: return `Couldn’t reach ${name} right now.`;
  }
}
