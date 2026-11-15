/* Afloat · app/render.js · render() and setHtml() (rebuild only what changed, keep scroll, wait while a finger is down), the Meals frame, checklists and list-editing helpers.
   Plain script: shares one scope with the other app/*.js files (loaded in order by index.html). See CLAUDE.md. */
/* ---------- Meals: Mealtime inside Afloat ----------
   In the installed app the recipes, week plan and shopping list live at meals/ and stay loaded in a frame,
   so switching tabs doesn't reload them. */
function vMeals() { return ''; } /* the Meals frame (below) fills this tab */
/* The Meals frame serves two places: the Meals tab (Recipes · Shopping · At home) and Plan → Meal Plan (the week plan).
   It stays loaded either way; the frame is told which one is showing. */
function vMealPlan() { return ''; }
function mealsFrame() {
  const box = $('#meals'); if (!box) return;
  const on = S.view === 'meals' || S.view === 'mealplan', mode = S.view === 'mealplan' ? 'plan' : 'meals';
  box.hidden = !on; document.body.classList.toggle('in-meals', on && mode === 'meals'); document.body.classList.toggle('in-mealplan', on && mode === 'plan'); document.body.classList.toggle('in-rhythms', S.view === 'rhythms');
  if (!on) return;
  const fr = box.querySelector('iframe');
  if (!fr) { box._mode = mode; box.innerHTML = `<iframe src="meals/index.html?mode=${mode}" title="Meals" class="meals-frame"></iframe>`; }
  else if (box._mode !== mode) { box._mode = mode; try { fr.contentWindow.postMessage({ afloatMealsMode: mode }, '*'); } catch (e) { /* the frame asks again when it is ready */ } }
}
addEventListener('message', e => { /* a frame that has just loaded asks which of the two it should show */
  if (!e.data || !e.data.mealsReady) return;
  const box = $('#meals'), fr = box && box.querySelector('iframe');
  if (fr && e.source === fr.contentWindow && box._mode) { try { fr.contentWindow.postMessage({ afloatMealsMode: box._mode }, '*'); } catch (err) { /* ignore */ } }
});

/* ---------- rendering ---------- */
let pending = false;
function render(force) {
  applyColors();
  if (!db) tk = tKey();
  subscribeWeek(); maybeBrief();
  const a = document.activeElement;
  if (!force && a && a.matches('input[type=text], input[type=number], select, textarea') && (a.closest('#app') || a.closest('#sheet'))) { pending = true; return; }
  if (!force && touching) { pending = true; return; } /* never rebuild under a finger: it breaks swipes and taps */
  pending = false;
  if (S.loaded && !window.__afloatReady) window.__afloatReady = Date.now(); /* the household's data is in: tests wait for this (tests/helpers.js) */
  setHtml($('#modesw'), modeSwitch()); { const tn = $('#tabs'); if (tn) tn.style.gridTemplateColumns = `repeat(${tabsNow().length},1fr)`; }
  setHtml($('#tabs'), tabsNow().map(t => { const on = t[2].includes(S.view), last = lsGet('afloat.sub.' + t[0]), target = t[0] === 'help' ? 'support' : t[2].includes(last) ? last : t[2][0]; return `<a href="#${target}" class="${on ? 'on' : ''}" ${on ? 'aria-current="page"' : ''}>${I['t_' + t[0]]}<span>${t[1]}</span></a>`; }).join(''));
  const tb = tabOf(S.view), subnav = tb[2].length > 1 && tb[0] !== 'help' ? `<nav class="subnav" aria-label="${tb[1]}">${tb[2].map(v => `<a href="#${v}" class="${v === S.view ? 'on' : ''}" ${v === S.view ? 'aria-current="page"' : ''}>${SUBL[v]}</a>`).join('')}</nav>` : '';
  const fn = { focus: vFocus, 'focus-areas': vFocusAreas, 'focus-done': vFocusLog, meals: vMeals, mealplan: vMealPlan, today: vToday, tasks: vTasks, care: vCare, calendar: vCalendar, plans: vPlans, family: vFamily, stuck: vStuck, support: vSupport, breakdown: vBreakdown, overload: vOverload, breathe: vBreathe, rhythms: vRhythms, priorities: vPriorities, together: vTogether, trips: vTrips }[S.view];
  const view0 = render.view; render.view = S.view;
  setHtml($('#app'), (isActive() ? '' : fxBar()) + subnav + (S.offline ? `<p class="note">Afloat can’t reach your household’s data right now. Look around as you like; anything you change now stays on this phone only.</p>` : '')
    + (S.slow ? `<p class="note">Can’t reach your household’s lists yet. What you see may be out of date.</p>` : '')
    + (['today', 'rhythms', 'calendar', 'tasks'].includes(S.view) ? staleNote() : '')
    + (S.loaded ? fn() + (S.view !== 'meals' && S.view !== 'mealplan' && meValid() ? `<p class="note-foot"><button class="link" data-act="note" data-v="${esc(S.view)}">✎ Note: this annoyed me / this helped</button></p>` : '') : `<p class="status">Opening your home…</p>`), view0 === S.view);
  mealsFrame(); if (S.view === 'rhythms') requestAnimationFrame(() => rjCarSync()); clearTimeout(render.np); render.np = setTimeout(() => { try { notifyPlan(); } catch (e) { console.warn(e); } }, 3000);
  const which = welcomeOn() ? 'welcome' : S.ui.note ? 'note' : S.ui.setup ? 'setup' : S.ui.brief ? 'brief' : S.ui.task ? 'task' : S.ui.capture ? 'capture' : S.ui.settings ? 'settings' : '';
  const sheet0 = render.sheet; render.sheet = which;
  setHtml($('#sheet'), which === 'welcome' ? vWelcome() : which === 'note' ? vNote() : which === 'setup' ? vSetup() : which === 'brief' ? vBrief() : which === 'task' ? vTask() : which === 'capture' ? vCapture2() : which === 'settings' ? vSettings() : '', sheet0 === which);
}
/* rebuild only what changed; when it's the same screen, keep where each scrolling part was (the page, the briefing,
   a sheet, a sideways row of chips), so an update from the other phone or the minute tick never jumps you to the top */
/* Much of Afloat's wording was written for one household's two girls. Every other household with children gets it worded
   for its own: "the girls" → their child by name or "the kids", "Girls" → "Kids", "a girl" → "a child" (only the visible
   wording these phrases appear in; data-* names like situ-girls are lowercase and untouched). */
function kidWords(html) {
  if (ourHome() || !kidsList().length || !/girl/i.test(html)) return html;
  const k = kidsList(), one = k.length === 1, the = theKids(), The = the.replace(/^t/, 'T');
  return html.replace(/\bthe girls’/g, one ? k[0] + '’s' : the + '’').replace(/\bThe girls’/g, one ? k[0] + '’s' : The + '’')
    .replace(/\bthe girls\b/g, the).replace(/\bThe girls\b/g, The).replace(/\bGirls’/g, 'Kids’').replace(/\bGirls\b/g, one ? k[0] : 'Kids').replace(/\bGirls-/g, 'Kids-').replace(/\ba girl\b/g, 'a child').replace(/\bboth girls\b/g, 'both kids');
}
function setHtml(el, html, same = true) {
  html = kidWords(html);
  if (!el || el._html === html) return;
  const keep = same ? [...el.querySelectorAll('.brief-ov, .sheet, .one, .scrim, .subnav, .chips, .pills, .tv-scroll, .rj-car')].map((n, i) => [i, n.className, n.scrollTop, n.scrollLeft]).filter(x => x[2] || x[3]) : [];
  const y = window.scrollY;
  el.innerHTML = html; el._html = html;
  if (!same) return;
  const now = [...el.querySelectorAll('.brief-ov, .sheet, .one, .scrim, .subnav, .chips, .pills, .tv-scroll, .rj-car')];
  for (const [i, cls, t, l] of keep) { const n = now[i]; if (n && n.className === cls) { n.scrollTop = t; n.scrollLeft = l; } }
  if (el.id === 'app' && Math.abs(window.scrollY - y) > 1) window.scrollTo(0, y);
}
let touching = false;
document.addEventListener('touchstart', () => { touching = true; }, { passive: true, capture: true });
/* the waits let the tap's own click land first: rebuilding right away would replace the button under it and lose the tap */
const untouch = () => { touching = false; setTimeout(() => { if (!touching && pending) render(); }, 250); };
document.addEventListener('touchend', untouch, { passive: true, capture: true });
document.addEventListener('touchcancel', untouch, { passive: true, capture: true });
document.addEventListener('focusout', () => setTimeout(() => { if (pending && !touching) render(); }, 250));

const members = () => (H('household').members || []);
const isDone = v => !!(v && typeof v === 'object');
function checklist(prefix, items, store = 'day') {
  if (!items || !items.length) return `<p class="empty">Nothing here yet.</p>`;
  const src = srcOf(store);
  return `<ul class="checks">${items.map(it => {
    const k = prefix + ':' + it.id, v = src[k], on = isDone(v);
    return `<li data-sw-r=".check" data-sw-r-label="${on ? 'Undo' : '✓ Done'}"><button class="check${on ? ' on' : ''}" data-act="toggle" data-store="${store}" data-key="${esc(k)}" aria-pressed="${on}"><span class="box" aria-hidden="true">${I.check}</span><span class="txt">${esc(it.text)}${it.done ? `<span class="def">Done when: ${esc(it.done)}</span>` : ''}</span>${it.min && !on ? `<span class="mins">${+it.min} min</span>` : ''}${on && v.by ? `<span class="by">${esc(v.by)}</span>` : ''}</button></li>`;
  }).join('')}</ul>`;
}
const srcOf = store => (store === 'week' ? S.week : store === 'month' ? S.month : S.day).done || {};
/* a list with everything ticked folds to one quiet line instead of cluttering Today; tap it to look again (the open state lasts until you reload) */
function doneFold(id, title, n, tot, html) {
  if (!tot || n < tot || !html) return html;
  return `<details class="done-fold" data-dfold="${esc(id)}"${(S.ui.dfo || {})[id] ? ' open' : ''}><summary><span class="ck" aria-hidden="true">✓</span> <b>${esc(title)}</b> <span class="muted small">· all done</span></summary>${html}</details>`;
}
const countDone = (prefix, items, store = 'day') => { const src = srcOf(store); return (items || []).filter(it => isDone(src[prefix + ':' + it.id])).length; };
const minsLeft = (prefix, items) => (items || []).filter(it => !isDone((S.day.done || {})[prefix + ':' + it.id])).reduce((a, it) => a + (+it.min || 0), 0);
function hMode() { const ms = Object.values(S.day.modes || {}).filter(m => RANK[m]); return ms.length ? ms.sort((a, b) => RANK[a] - RANK[b])[0] : (S.day.mode || null); }
function toggleKey(store, key, forceOn) {
  const path = store === 'week' ? 'weeks/' + wk : store === 'month' ? 'months/' + mk : 'days/' + dk, obj = store === 'week' ? S.week : store === 'month' ? S.month : S.day;
  const curOn = isDone((obj.done || {})[key]); if (forceOn && curOn) return;
  const val = curOn ? null : { by: me || '', at: Date.now() };
  obj.done = { ...(obj.done || {}), [key]: val };
  if (val) toast(CHEERS[Math.floor(Math.random() * CHEERS.length)]);
  mergeDoc(path, { done: { [key]: val } }); render(true);
}
const mvBtns = (doc, field, id, grp, n, len) => `<span class="mv"><button class="iconmini" data-act="mv" data-doc="${doc}" data-field="${field}" data-id="${id}" data-dir="-1" ${grp ? `data-grp="${grp}"` : ''} ${n === 0 ? 'disabled' : ''} aria-label="Move up">↑</button><button class="iconmini" data-act="mv" data-doc="${doc}" data-field="${field}" data-id="${id}" data-dir="1" ${grp ? `data-grp="${grp}"` : ''} ${n === len - 1 ? 'disabled' : ''} aria-label="Move down">↓</button></span>`;
function moveList(doc, field, items, grp, labels) {
  return `<ul class="edit-list">${items.map((x, n) => `<li class="mvrow"><div class="txt rn">${rnInput(doc, field, x, 'text')}</div>
    <select data-act="regroup" data-doc="${doc}" data-field="${field}" data-id="${x.id}" data-grp="${grp}" id="rg_${x.id}" aria-label="Move ${esc(x.text)} to">${labels.map((l, i) => `<option value="${i}" ${x[grp] === i ? 'selected' : ''}>${l}</option>`).join('')}</select>
    ${mvBtns(doc, field, x.id, grp, n, items.length)}<button class="chip x" data-act="del" data-doc="${doc}" data-field="${field}" data-id="${x.id}" aria-label="Remove ${esc(x.text)}">✕</button></li>`).join('')}</ul>`;
}
function carryHtml() {
  const R = H('rhythms'), r = +(H('week').resetDay || 0), pos = x => (x - r + 7) % 7, t = pos(dow());
  const open = (R.weekly || []).filter(x => pos(x.day) < t && !isDone(srcOf('week')['r:' + x.id]));
  return open.length ? `<h3>Still open from earlier this week</h3><p class="muted small">Optional. They clear on ${DAYS_LONG[r]} morning either way.</p>${checklist('r', open, 'week')}` : '';
}
const RN_LABEL = { time: 'Reminder time', text: 'Task text', min: 'min', done: 'Done when… (optional)', shop: 'Name on the shopping list (optional)', name: 'Space name' };
function rnInput(doc, field, it, prop, type = 'text', act = 'rename', extra = '') {
  return `<input type="${type}" class="rn-in rn-${prop}" id="rn_${field}_${it.id}_${prop}" value="${esc(it[prop] ?? '')}" placeholder="${RN_LABEL[prop]}" aria-label="${RN_LABEL[prop]}" data-act="${act}" data-doc="${doc}" data-field="${field}" data-id="${it.id}" data-prop="${prop}" ${type === 'number' ? 'min="1" max="120"' : ''} ${extra}>`;
}
/* saves without forcing a redraw, so tabbing to the next field keeps focus */
function saveQuiet(name, obj) {
  const path = 'home/' + name; if (db) putDoc(path, obj); else mem[path] = obj; apply(path, obj);
  /* after the tap that blurred this field has focused the next one, so the redraw waits instead of stealing it */
  setTimeout(() => render(), 0); toast('Saved.');
}
const MINDONE = `<input type="number" name="min" min="1" max="120" placeholder="min" aria-label="Minutes it takes" style="width:5.5em"><input type="text" name="done" placeholder="Done when… (optional)" aria-label="Done when">`;
const editBtn = sec => `<button class="link" data-act="edit" data-sec="${sec}">${S.ui.edit[sec] ? 'Done' : 'Edit'}</button>`;
const WHEN_FIELDS = ['closing', 'solo', 'survival', 'girlsHome'];
const whenSel = (it, attrs) => `<select class="when-sel" ${attrs} aria-label="When this shows">${WHEN.map(([v, l]) => `<option value="${v}" ${whenOf(it) === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
function editList(doc, field, items, placeholder, extra = '') {
  return `<ul class="edit-list">${(items || []).map((it, n, arr) => `<li><div class="txt rn">${rnInput(doc, field, it, 'text')}${WHEN_FIELDS.includes(field) ? `<div class="rn-sub">${whenSel(it, `data-act="when-set" data-doc="${doc}" data-field="${field}" data-id="${it.id}"`)}</div>` : ''}${extra === MINDONE ? `<div class="rn-sub">${rnInput(doc, field, it, 'min', 'number')}${rnInput(doc, field, it, 'done')}</div>` : ''}${field === 'restock' ? `<div class="rn-sub">${rnInput(doc, field, it, 'shop')}</div>` : ''}</div>${mvBtns(doc, field, it.id, '', n, arr.length)}<button class="chip x row-x" data-act="del" data-doc="${doc}" data-field="${field}" data-id="${it.id}" aria-label="Remove ${esc(it.text)}">✕</button></li>`).join('')}</ul>
  <form class="addform" data-form="add" data-doc="${doc}" data-field="${field}"><input type="text" name="text" placeholder="${esc(placeholder)}" required aria-label="${esc(placeholder)}">${extra}<button class="btn" type="submit">Add</button></form>`;
}
const daySelect = (sel = dow()) => `<select name="day" aria-label="Day">${DAYS.map((d, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${d}</option>`).join('')}</select>`;
const monthSelect = (sel = monthIdx()) => `<select name="month" aria-label="Month">${MONTHS.map((m, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${m}</option>`).join('')}</select>`;
const levelSelect = (name, label) => `<select name="${name}" aria-label="${label}"><option value="3">${label}: high</option><option value="2" selected>${label}: medium</option><option value="1">${label}: low</option></select>`;
const whoSelect = () => `<select name="who" aria-label="Who">${members().map(m => `<option ${m.name === me ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select>`;

/* ---------- collapsible groups (secOpen and dedupeHead are in today.js) ---------- */
let COL = {}; try { COL = JSON.parse(lsGet('afloat.col') || '{}') || {}; } catch { COL = {}; }
const CHEV = '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
const secClose = () => '</div></section>';
const sec = (id, title, meta, body, defCol) => body ? secOpen(id, title, meta, defCol) + dedupeHead(title, body) + secClose() : '';
/* a card that opens with the same title as its section header loses the repeat (its links stay) */
const normT = t => String(t).replace(/<[^>]+>/g, '').replace(/[’']/g, "'").trim().toLowerCase();

/* ---------- time of day (slot() and ghAsk() are in today.js) ---------- */
const SLOT_LABEL = { morning: 'Morning', day: 'Afternoon', evening: 'Evening', night: 'Late night' };
const SLOT_SUB = { morning: 'Here’s today, most important first.', day: 'A quick check-in for the middle of the day.', evening: 'Here’s the shape of tonight.', night: 'Just the essentials. Then rest.' };
const SLOT_ORDER = { morning: ['morning', 'out', 'home', 'cal', 'athome', 'care', 'rhythm', 'bedtime', 'date', 'tomorrow', 'board', 'closing'], day: ['out', 'home', 'cal', 'athome', 'rhythm', 'care', 'board', 'date', 'bedtime', 'tomorrow', 'closing'], evening: ['bedtime', 'date', 'out', 'cal', 'closing', 'tomorrow', 'athome', 'care', 'board', 'rhythm'], night: ['closing', 'bedtime', 'out', 'cal', 'care', 'date', 'tomorrow', 'board', 'rhythm'] };
/* ---------- taps on this area's buttons (data-act), called from events.js; true = handled ---------- */
function tapRender(a, el, e, r) {
  switch (a) {
    case 'note': { S.ui.note = { view: el.dataset.v || (location.hash || '#today').slice(1), sec: S.ui.lastSec || '' }; render(true); return true; }
    case 'toggle': toggleKey(el.dataset.store, el.dataset.key); return true;
    case 'mv': {
      const doc = el.dataset.doc, f = el.dataset.field, grp = el.dataset.grp, dir = +el.dataset.dir, o = { ...H(doc) }, arr = [...(o[f] || [])], i = arr.findIndex(x => x.id === el.dataset.id); if (i < 0) return true;
      let j = i + dir; while (grp && j >= 0 && j < arr.length && arr[j][grp] !== arr[i][grp]) j += dir; if (j < 0 || j >= arr.length) return true;
      [arr[i], arr[j]] = [arr[j], arr[i]]; o[f] = arr; saveHome(doc, o); return true;
    }
    case 'edit': S.ui.edit[el.dataset.sec] = !S.ui.edit[el.dataset.sec]; render(true); return true;
    case 'del': { const doc = el.dataset.doc, f = el.dataset.field, o = { ...H(doc) }; o[f] = (o[f] || []).filter(x => x.id !== el.dataset.id); saveHome(doc, o); return true; }
  }
  return false;
}
