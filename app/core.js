/* Afloat · app/core.js · Shared helpers ($, esc, uid, local storage), dates (the day turns at 4:00), the state S, Claude for short suggestions.
   Plain script: shares one scope with the other app/*.js files (loaded in order by index.html). See CLAUDE.md. */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => Math.random().toString(36).slice(2, 9);
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

/* ---------- dates: the day turns over at 4 am, so late closing duties count for "today" ---------- */
const shifted = () => new Date(Date.now() - 4 * 3600e3);
const pad = n => String(n).padStart(2, '0');
const keyOf = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const dayKey = () => keyOf(shifted());
const dow = () => (shifted().getDay() + 6) % 7;           // 0 = Monday
const monthIdx = () => shifted().getMonth();
const monthKey = () => { const d = shifted(); return d.getFullYear() + '-' + pad(d.getMonth() + 1); };
const weekStart = () => { const d = shifted(); d.setDate(d.getDate() - dow()); return keyOf(d); };
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const DAYS_LONG = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const MODES = {
  full:     { label: 'Full tank',     sub: 'Room for the whole list', tiers: 3 },
  low:      { label: 'Running low',   sub: 'What matters, skip the rest', tiers: 2 },
  survival: { label: 'Survival mode', sub: 'Bare minimum, kindly', tiers: 1 },
};
const SLIPS = [
  'Care tasks are morally neutral. A mess says nothing about your worth.',
  'A pile of laundry is just laundry.',
  'Your home exists to serve you, not the other way round.',
  'Partly done still counts. Five percent of a task is real care.',
  'Missing a day is morally neutral. The rhythm will still be here tomorrow.',
  'Rest is a right, not a reward you earn by finishing.',
  'Good enough is the goal. Functional beats perfect.',
  'Skipping the closing duties tonight can be kindness to right-now you.',
  'Paper plates are a tool, not a failure.',
  'If something never gets done on the list, take it off the list.',
  'Not everything has to be clean at the same time.',
  'You do not have to do better to start feeling better.',
  'The best way to do a task is the way it actually gets done.',
  'Tidy because the space needs a reset, not because messy is bad.',
];
const STEPS = [
  { title: 'Trash', do: 'Grab a bag. Pick up every bit of trash in the room and bag it. Stack boxes and big items beside the bag.', dont: 'Don’t take it out yet.', kids: ['{a} can be the “trash monster” and feed the bag.', '{b} can hand you things.'] },
  { title: 'Dishes', do: 'Gather every cup, plate and utensil and bring them to the sink or a counter.', dont: 'Don’t wash them now.', kids: ['{a} can carry plastic cups and spoons to the sink.', '{b} can bring the spoons.'] },
  { title: 'Laundry', do: 'Take a basket and collect all clothes, shoes and towels. Park the basket next to the trash.', dont: 'Don’t start a load yet.', kids: ['Basket basketball: {all} throw{s} clothes into the basket.'] },
  { title: 'Things with a home', do: 'Pick one corner or surface. Put back everything that has a home; pile up whatever doesn’t. Then move to the next spot.', dont: 'Ignore everything that isn’t in this spot.', kids: ['Toys go into bins with no sorting. Make it a race or a song; little ones love dropping things in.'] },
  { title: 'Things without a home', do: 'Now look at the pile. Let go of what is only clutter. For things that matter, choose a home. Any home works.', dont: 'A “decide later” box counts as a home.', kids: ['This one needs grown-up brains. A show for {the} is a perfectly good tool here.'] },
];
/* the Five Things' little-helper line, from the household's children by name ('' without children) */
const stepKids = st => { const k = kidsList(); if (!k.length) return ''; const all = k.length === 1 ? k[0] : k.slice(0, -1).join(', ') + ' and ' + k[k.length - 1];
  return st.kids.filter((x, i) => i === 0 || k.length > 1).map(x => x.replace(/\{a\}/g, k[0]).replace(/\{b\}/g, k[1] || '').replace(/\{all\}/g, all).replace(/\{s\}/g, k.length === 1 ? 's' : '').replace(/\{the\}/g, theKids())).join(' '); };
const CHEERS = ['Done. That counts.', 'Tick! Future-you says thanks.', 'One less thing in your head.', 'Nice. Momentum.', 'Look at that, it happened.', 'Done. Small things add up.'];
const RANK = { survival: 1, low: 2, full: 3 };
const TR = 'Trello';
/* where connections are fixed (the claude.ai artifact version was retired on 9 Nov 2026) */
const CONN_WHERE = 'Settings → Connections';
const TIER = (impact, effort) => { const s = (3 - impact) + (effort - 1); return s <= 1 ? 1 : s === 2 ? 2 : 3; };

/* ---------- state ---------- */
const S = {
  view: 'today',
  home: { household: { members: [] }, lists: {}, rhythms: {}, spaces: {}, priorities: {}, rest: {}, live: {} },
  day: { mode: null, done: {} }, month: { done: {} }, week: { done: {} }, restlog: [],
  loaded: false, slow: false,
  trello: { status: 'idle', cards: [] }, trTried: false,
  ui: { edit: {}, settings: false, slip: null, prev: null,
        capture: false, dest: null, dumpText: '', sending: false,
        share: lsGet('afloat.share') !== '0', sound: lsGet('afloat.sound') !== '0' },
};
let me = lsGet('afloat.me') || '';
/* the first household (the admin's), whose starting lists were written for it long ago; other households start from the
   generic ones (10 Nov 2026). Without Firebase (the tests) it counts as the first household. */
const ourHome = () => { const h = window.claude && window.claude.household && window.claude.household(); return !h || h.legacy !== false; };
/* ---------- what Afloat helps with: the household's modules (10 Nov 2026) ----------
   home/household.modules = { kids: true, partners: false, … }. A module nobody switched uses its default, worked out from
   the household itself (kids → there are children; Together and Signals → two or more adults; partners and photo gigs →
   only the first household, until another one says so). Settings → What Afloat helps with switches them; off means the
   tab, cards, prompts and nudges for it are gone, and nothing it saved is deleted. */
const MODS = [
  ['kids', 'Kids’ days', 'Drop-offs, pick-ups, bedtime, kids at home, sick days and babysitting gaps', () => (H('household').kids || []).length > 0],
  /* not from the number of adults: people who live together aren't always a couple, so a new household is asked (coupleAsk in together.js) */
  ['together', 'Together', 'For a couple: a weekly check-in, a check-up and date night ideas, just for the two of you', () => false],
  ['trips', 'Trips', 'Weekend trip ideas (a morning, an afternoon or a whole day) and a Thursday nudge; sized to the kids’ day if there are children', () => true],
  ['signals', 'Signals', 'Short messages to the others without talking (“Need quiet”, “Words offline”)', () => (H('household').members || []).length >= 2],
  ['partners', 'Partners in Family', 'Partners, metamours and comets alongside friends, for polyamorous households', () => ourHome()],
  ['meals', 'Meals', 'Recipes, the week’s meals, shopping and what’s at home', () => true],
  ['tasks', 'Tasks', 'To-dos from your task app (Trello for now)', () => true],
  ['gigs', 'Photo gigs', 'Gear prep before a photo shoot and an editing task after it', () => ourHome()],
];
/* the first household keeps everything it had unless it switches something off */
const modOn = k => { const v = (H('household').modules || {})[k]; if (typeof v === 'boolean') return v; const m = MODS.find(x => x[0] === k); return !m || ourHome() || !!m[3](); };
/* which screens belong to a module (the rest are always there) */
const VIEW_MOD = { meals: 'meals', mealplan: 'meals', together: 'together', trips: 'trips', tasks: 'tasks' };
const viewOn = v => !VIEW_MOD[v] || modOn(VIEW_MOD[v]);
/* ---------- the household's own facts (10 Nov 2026) ----------
   Nothing about a household lives in the code (the files are public): Settings → About your home keeps them on
   home/household: town (weather), address (what counts as home, where drives start), about (anything Claude should know,
   in your words) and nap { kid, from, to } (a child's daytime nap, which trips and the day plan work around). */
const hhAbout = () => String(H('household').about || '').trim();
const homeAddr = () => String(H('household').address || '').trim();
const napOf = () => { const n = H('household').nap || {}; return n.kid && kidsList().includes(n.kid) ? { kid: n.kid, from: n.from || '11:30', to: n.to || '14:00' } : null; };
const kidsAged = () => kidsList().map(n => { const a = typeof ageOf === 'function' ? ageOf(pInfo(n).birthday) : ''; return a !== '' ? `${n} (${a})` : n; });
/* who the household is, for Claude: the people, where they live and the household's own words */
function houseFacts() {
  const ad = (H('household').members || []).map(m => m.name).filter(Boolean), ks = kidsAged(), where = homeAddr() || (H('household').town || '');
  return [`The household: ${ad.length ? ad.join(' and ') : 'one adult'}${ks.length ? `, with ${ks.length === 1 ? 'a child' : 'children'}: ${ks.join(' and ')}` : ', no children'}.`,
    where ? `They live in or near ${where}.` : '', napOf() ? `${napOf().kid} naps about ${napOf().from}–${napOf().to}.` : '', hhAbout() ? `In their words: ${hhAbout().slice(0, 1200)}` : ''].filter(Boolean).join(' ');
}
/* a built-in line written about children: worded for this household's, or null when it has none (then it's left out) */
const forKids = t => /\bthe girls\b/.test(t || '') ? (kidsList().length ? String(t).replace(/the girls’/g, theKids() + '’').replace(/the girls/g, theKids()) : null) : t;
/* how the household's children are called in passing: one child by name, otherwise "the kids" ("the girls" at home here) */
const theKids = () => { const k = kidsList(); return k.length === 1 ? k[0] : ourHome() ? 'the girls' : 'the kids'; };
let db = null, mcp = null, dk = dayKey(), mk = monthKey(), wk = '';

/* ---------- Claude for short suggestions (date nights, the check-up, packing): one retry on a hiccup, a plain reason when it fails ---------- */
async function askClaude(text, opts = {}) {
  try { return await sample.json(text, { modelTier: 'quick', cache: false, ...opts }); }
  catch (e) { const c = e && e.code; console.warn('Claude:', c, e && e.message);
    if (c === 'not_granted' || c === 'aborted' || c === 'over_cap') throw e;
    await new Promise(r => setTimeout(r, c === 'rate_limited' ? 4000 : 1200));
    /* a hiccup (busy, no answer) tries the same cheap model again; only an answer that wasn't usable goes to the bigger one */
    return await sample.json(text, { cache: false, ...opts, modelTier: /^(rate_limited|server_unavailable|upstream_error)$/.test(c) ? 'quick' : 'default' }); }
}
function claudeWhy(e) {
  const c = e && e.code, m = String((e && e.message) || '');
  if (/credit|billing|balance/i.test(m)) return 'Claude’s API credit has run out. Top it up in the Anthropic console (Billing), then try again.';
  if (c === 'over_cap' || /budget .* is used up/i.test(m)) return m || 'This month’s Claude budget is used up. Built-in ideas until the 1st.';
  if (c === 'rate_limited' || /overloaded|busy/i.test(m)) return 'Claude is busy right now. Try again in a minute.';
  if (c === 'not_granted') return 'Claude isn’t set up for Afloat on this account.';
  if (c === 'server_unavailable' || /network|offline|fetch/i.test(m)) return 'Couldn’t reach Claude. Check the connection and try again.';
  if (/JSON/i.test(m)) return 'Claude’s answer came back garbled. Try again.';
  return 'Claude didn’t answer' + (m && m.length < 140 ? `: ${m}` : '.') + ' Try again in a moment.';
}
/* ---------- errors a phone ran into (9 Nov 2026): kept in home/errors { list: [{ at, by, view, msg, where }] }, at most 30,
   so the next fix starts from the exact file and line ("Copy them all" in the ✎ Note sheet includes them). Network hiccups
   are left out; the same error is kept once a day. */
const ERRS = [];
function errKeep(msg, where) {
  msg = String(msg || '').replace(/^Uncaught /, '').slice(0, 300); if (!msg || /network|failed to fetch|load failed|offline|aborted|quota/i.test(msg)) return;
  where = String(where || '').replace(/^.*\/((?:app|platform|meals)\/)/, '$1').slice(0, 80);
  if (ERRS.some(x => x.msg === msg && x.where === where)) return;
  ERRS.push({ at: Date.now(), by: me || '', view: S.view, msg, where }); clearTimeout(errKeep.t); errKeep.t = setTimeout(errSave, 5000);
}
function errSave() {
  if (!db || !ERRS.length) return;
  const old = (S.home.errors || {}).list || [], add = ERRS.splice(0).filter(e => !old.some(x => x.msg === e.msg && x.where === e.where && x.at > Date.now() - 864e5));
  if (add.length) db.doc('home/errors').set({ list: [...old, ...add].slice(-30) }).catch(() => {});
}
addEventListener('error', e => { if (e && e.message) errKeep(e.message, e.filename ? `${e.filename}:${e.lineno}` : ''); });
addEventListener('unhandledrejection', e => { const r = e && e.reason; errKeep(r && (r.message || r.code) || String(r), r && r.stack && (String(r.stack).match(/(?:app|platform|meals)\/[\w.-]+:\d+/) || [])[0]); });
