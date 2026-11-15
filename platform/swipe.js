/* Swiping, shared by Afloat and Meals.
   Mark an element with what a swipe should do, as a CSS selector of the button to press:
     data-sw-r="…"   swipe right   ·   data-sw-l="…"   swipe left   ·   data-sw-d="…"   swipe down (from the top)
   The selector is looked up inside the element first, then on the whole page; "." means the element itself;
   "@action" presses a made-up button with data-act="action" and the element's data-sw-id as data-id;
   "@action:value" passes value as both data-id and data-k instead.
   A row that only goes one way lets the other way through to the page, so a list never blocks changing screens.
   Swiping along an element marked data-sw-tabs (the bottom tab bar) calls window.SWIPE.tabs(dir) to jump a whole tab.
   data-sw-kind="row" (default) slides the element and colours what's revealed; "page" nudges it and slides on.
   Anything not marked falls back to window.SWIPE.page(dir) (dir 'l' or 'r'), e.g. the neighbouring sub-tab,
   and to window.SWIPE.sheet() for swiping a sheet down to close it.
   Never starts in a text field, a slider, or inside something that scrolls sideways. */
(function () {
  const H = window.SWIPE = window.SWIPE || {};
  const DEAD = 12, ROW = 0.3, ROW_MIN = 70, PAGE = 80;
  let st = null, justSwiped = 0;
  const typing = t => t.closest('input:not([type=checkbox]):not([type=radio]), textarea, select, [contenteditable=true], input[type=range]');
  const scrollsX = (t, stop) => { for (let n = t; n && n !== stop && n !== document.body; n = n.parentElement) { const cs = getComputedStyle(n); if (/(auto|scroll)/.test(cs.overflowX) && n.scrollWidth > n.clientWidth + 2) return true; } return false; };
  const scrollTopOf = t => { for (let n = t; n && n !== document.documentElement; n = n.parentElement) { const cs = getComputedStyle(n); if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 2) return n.scrollTop; } return window.scrollY; };
  function press(el, sel) {
    if (sel === '.') { el.click(); return true; }
    if (sel[0] === '@') { const [a, arg] = sel.slice(1).split(/:(.*)/s), b = document.createElement('button'); b.hidden = true; b.dataset.act = a;
      if (arg != null) { b.dataset.id = arg; b.dataset.k = arg; } else if (el.dataset.swId) b.dataset.id = el.dataset.swId; document.body.appendChild(b); b.click(); b.remove(); return true; }
    const b = el.querySelector(sel) || document.querySelector(sel); if (b && !b.disabled) { b.click(); return true; } return false;
  }
  /* every marked element under the finger, innermost first: the first that goes the way of the swipe takes it */
  const rowsOf = t => { const out = []; for (let n = t.closest('[data-sw-r],[data-sw-l]'); n; n = n.parentElement && n.parentElement.closest('[data-sw-r],[data-sw-l]')) out.push(n); return out; };
  const rowFor = (s0, dir) => s0.rows.find(r => r.dataset['sw' + dir.toUpperCase()]) || null;
  function reset(el, ms = 180) { if (!el) return; el.style.transition = `transform ${ms}ms ease, opacity ${ms}ms ease`; el.style.transform = ''; el.style.opacity = ''; el.classList.remove('sw-r', 'sw-l', 'sw-on'); setTimeout(() => { el.style.transition = ''; }, ms + 20); }
  document.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) { st = null; return; }
    const t = e.target; if (!(t instanceof Element) || typing(t)) { st = null; return; }
    const p = e.touches[0];
    st = { x: p.clientX, y: p.clientY, t, axis: null, dx: 0, dy: 0, at: Date.now(),
      rows: rowsOf(t), tabs: t.closest('[data-sw-tabs]'), down: t.closest('[data-sw-d]'), top: scrollTopOf(t) <= 0, sx: scrollsX(t) };
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!st) return; const p = e.touches[0]; st.dx = p.clientX - st.x; st.dy = p.clientY - st.y;
    if (!st.axis) { if (Math.abs(st.dx) < DEAD && Math.abs(st.dy) < DEAD) return; st.axis = Math.abs(st.dx) > Math.abs(st.dy) * 1.3 ? 'x' : 'y'; }
    if (st.axis === 'x') {
      if (st.sx) return;
      const dir = st.dx > 0 ? 'r' : 'l', r = st.tabs ? null : rowFor(st, dir);
      for (const o of st.rows) if (o !== r && o.style.transform) reset(o, 0);
      if (r) {
        const kind = r.dataset.swKind || 'row', w = r.offsetWidth || 300, far = kind === 'row' ? Math.max(ROW_MIN, w * ROW) : PAGE;
        r.style.transition = 'none'; r.style.transform = `translateX(${kind === 'row' ? st.dx : st.dx * 0.35}px)`;
        r.classList.toggle('sw-r', dir === 'r'); r.classList.toggle('sw-l', dir === 'l'); r.classList.toggle('sw-on', Math.abs(st.dx) >= far);
      } else if (H.page) {
        const app = H.pageEl && H.pageEl(); if (app) { app.style.transition = 'none'; app.style.transform = `translateX(${st.dx * 0.25}px)`; app.style.opacity = String(1 - Math.min(.35, Math.abs(st.dx) / 900)); }
      }
    } else if (st.axis === 'y' && st.dy > 0 && st.top) {
      const s = st.down || (H.sheetEl && H.sheetEl(st.t)); if (s) { s.style.transition = 'none'; s.style.transform = `translateY(${Math.max(0, st.dy * 0.6)}px)`; }
    }
  }, { passive: true });
  const end = () => {
    if (!st || !st.axis) { st = null; return; }
    const s0 = st; st = null;
    if (s0.axis === 'x' && !s0.sx) {
      const dir = s0.dx > 0 ? 'r' : 'l';
      if (s0.tabs) { if (Math.abs(s0.dx) >= 50 && H.tabs) { justSwiped = Date.now(); H.tabs(dir); } return; }
      const r = rowFor(s0, dir), sel = r && r.dataset['sw' + dir.toUpperCase()];
      if (sel) {
        const kind = r.dataset.swKind || 'row', far = kind === 'row' ? Math.max(ROW_MIN, (r.offsetWidth || 300) * ROW) : PAGE;
        if (Math.abs(s0.dx) >= far) { justSwiped = Date.now(); r.style.transition = 'transform 160ms ease, opacity 160ms ease'; r.style.transform = `translateX(${dir === 'r' ? 60 : -60}%)`; r.style.opacity = '0.4';
          setTimeout(() => { press(r, sel); reset(r, 0); }, 150); }
        else reset(r);
        return;
      }
      const app = H.pageEl && H.pageEl();
      if (H.page && Math.abs(s0.dx) >= PAGE) { justSwiped = Date.now(); if (H.page(dir)) { if (app) { app.style.transition = ''; app.style.transform = ''; app.style.opacity = ''; } return; } }
      reset(app);
    } else if (s0.axis === 'y') {
      const s = s0.down || (H.sheetEl && H.sheetEl(s0.t)); if (!s) return;
      if (s0.top && s0.dy > 110) { justSwiped = Date.now(); const sel = s.dataset && s.dataset.swD; if (sel ? press(s, sel) : H.sheet && H.sheet(s)) return; }
      reset(s);
    }
  };
  document.addEventListener('touchend', end, { passive: true });
  document.addEventListener('touchcancel', () => { if (st) { st.rows.forEach(r => reset(r)); reset(H.pageEl && H.pageEl()); st = null; } }, { passive: true });
  /* the tap a finished swipe leaves behind doesn't count as a tap */
  document.addEventListener('click', e => { if (Date.now() - justSwiped < 400 && e.isTrusted) { e.preventDefault(); e.stopPropagation(); } }, true);
})();
