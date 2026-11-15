/* Afloat · app/boot.js · Swiping between screens, routing (#hash), and start-up: route(); boot().
   Plain script: shares one scope with the other app/*.js files (loaded in order by index.html). See CLAUDE.md. */
/* ---------- swiping (platform/swipe.js) ----------
   Left/right on a page goes to the neighbouring screen, in tab order (Today, Tasks, Calendar, Plans, Rhythms, Week plan, Meals, Self-care, Together,
   Trips, Family, Support); on a Support tool, swiping right goes back to Support. Sheets close when swiped down from the top. */
const SW_ORDER = ['today', 'tasks', 'calendar', 'plans', 'rhythms', 'mealplan', 'meals', 'care', 'together', 'trips', 'family', 'support'];
function swipePage(dir) {
  if (($('#sheet') && $('#sheet').innerHTML.trim()) || S.ui.ev || S.ui.gpf || S.ui.gpw || !$('#timer').hidden) return false;
  if (tabOf(S.view)[0] === 'help' && S.view !== 'support') { if (dir === 'r') { location.hash = 'support'; return true; } return false; }
  const ord = (isActive() ? ACT_VIEWS : SW_ORDER).filter(viewOn), i = ord.indexOf(S.view), j = i + (dir === 'l' ? 1 : -1); if (i < 0 || j < 0 || j >= ord.length) return false;
  location.hash = ord[j]; return true;
}
function swipeTabs(dir) {
  if (($('#sheet') && $('#sheet').innerHTML.trim()) || S.ui.ev || S.ui.gpf || S.ui.gpw) return false;
  const TS = tabsNow(), i = TS.findIndex(t => t[0] === tabOf(S.view)[0]), j = i + (dir === 'l' ? 1 : -1); if (j < 0 || j >= TS.length) return false;
  const t = TS[j], last = lsGet('afloat.sub.' + t[0]); location.hash = t[0] === 'help' ? 'support' : t[2].includes(last) ? last : t[2][0]; return true;
}
if (window.SWIPE) {
  SWIPE.tabs = swipeTabs;
  SWIPE.page = swipePage; SWIPE.pageEl = () => $('#app');
  SWIPE.sheetEl = t => t.closest('.sheet, .one, .brief-ov');
  SWIPE.sheet = s => { const b = s.querySelector('button[data-act$="close"], button[data-act^="close-"]'); if (b) { b.click(); return true; } const sc = s.closest('.scrim[data-act]'); if (sc && sc.dataset.act !== 'noop') { sc.click(); return true; } return false; };
}
function route() { const h = location.hash.slice(1); S.view = VIEWS.some(v => v[0] === h) && viewOn(h) ? h : 'today'; lsSet('afloat.sub.' + tabOf(S.view)[0], S.view); render(true); }
addEventListener('hashchange', () => { route(); scrollTo(0, 0); });
route(); boot();
