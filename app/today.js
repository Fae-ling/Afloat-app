/* Afloat · app/today.js · The Today screen: vToday, its header cards (greeting, who are you, energy), collapsible groups, time of day, sick-day and tag cards.
   Plain script: shares one scope with the other app/*.js files (loaded in order by index.html). See CLAUDE.md. */
/* ---------- Today ---------- */
function vToday() {
  if (sickOn()) return vSick();
  const mode = hMode(), d = dow(), L = H('lists'), R = H('rhythms'), tc = H('trello'), ev = evening(), sl = slot();
  const dateStr = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' }).format(shifted());
  const canShop = shopOk();
  let h = `<section class="hero"><p class="eyebrow">${DAYS_LONG[d]} · ${dateStr}</p><h1>${greeting()}</h1></section>`;
  baselineSeed(); careSeedClean();
  h += (meValid() && !sickOn() ? (() => { const ro = runOuting(); return ro ? outingCard(ro, me, true) : ''; })() : '') + whoCard() + coupleAsk() + signalBanner() + liveBanner() + fxOthers() + (meValid() && !sickOn() ? nowThing() + ghAsk() + situCard(dk, { open: needsSetup(dk) }) + workHoursCard() + newsCard() + favAsk() : '') + briefCard()
    + (meValid() ? remindCard() + lkCard() + homecomingCard() + dipCard() + gigCard() + epNowCard() + pxTodayCards() + epAfterCard() : '');
  const B = {};
  /* 10 Nov 2026: the "Energy and focus" box is gone from Today. The tank check-in lives at the top of Self-care, and "just tell me one thing"
     moved into Active → Focus → Taking care of my surroundings. */
  { const oc = outingCards(me, true); if (oc) B.out = { t: 'Going out', meta: `${(oc.match(/class="card outing"/g) || []).length}`, body: oc }; }
  { const hc = remCard(true); if (hc) B.athome = { t: 'Reminders', meta: `${remNow().length} now`, body: hc }; }
  B.care = { t: 'Looking after you', meta: me && members().some(m => m.name === me) ? `★ ${careStars(me)}` : '', body: careNudge() };
  if (mode === 'survival') {
    const sv = L.survival || [];
    B.closing = { t: 'Tonight, the minimum', meta: `${countDone('s', sv)} of ${sv.length}`,
      body: `<section class="card"><div class="sec-head"><h2>Survival closing duties</h2><span class="progress">${countDone('s', sv)} of ${sv.length}</span></div><p class="muted small">Only what tomorrow truly needs. Then sit down.</p>${checklist('s', sv)}</section>`
        + `<section class="card"><div class="sec-head"><h2>Glass balls</h2></div><p class="muted small">The things that would shatter if dropped. Everything else is plastic and will bounce.</p>${checklist('g', L.glass || [])}</section>`
        + `<p class="note">Rhythms and monthly jobs are paused for today. Nothing is overdue in this app, and today is a kindness day.</p>` };
  } else {
    supSeed(); const bp = beatPlan(), bAll = [...bp.base, ...bp.extras];
    let rb = beatCard();
    if ((L.restockDay ?? 6) === d && (L.restock || []).length) rb += restockCard('today');
    B.rhythm = { t: 'Today’s beat', meta: bAll.length ? `${bAll.filter(rjDone).length} of ${bAll.length}` : '', body: rb };
    const { solo, pre, cl, hidden } = closingSet(), n = countDone(pre, cl), ml = minsLeft(pre, cl);
    const myNight = !!(ev && ev.type === 'away' && ev.who === me) || (meValid() && eveAt(me, dk) !== 'home'), showClosing = closingDue() && !myNight;
    if (showClosing) B.closing = { t: solo ? 'Solo closing duties' : 'Closing duties', meta: `${n} of ${cl.length}${ml ? ` · ~${ml} min` : ''}`,
      body: doneFold('closing', solo ? 'Solo closing duties' : 'Closing duties', n, cl.length, `<section class="card"><div class="sec-head"><h2>${solo ? 'Solo closing duties' : 'Closing duties'}</h2><span class="progress">${n} of ${cl.length}${ml ? ` · about ${ml} min left` : ''}</span></div>
      <p class="muted small">${ev && ev.type === 'date' ? 'Optional tonight. Tomorrow can absorb them.' : solo ? 'Just the essentials. Bedtime alone is already a full job.' : mode === 'low' ? 'Pick the ones that matter most for tomorrow. Leaving the rest is fine.' : 'A few kindnesses to tomorrow-you, ideally right after dinner, before anyone sits down.'}</p>
      ${checklist(pre, cl)}${hidden && kidsList().length && girlsAt(tk) !== 'kinder' ? `<p class="muted small">${hidden} kindergarten job${hidden === 1 ? '' : 's'} left out: no kindergarten tomorrow.</p>` : ''}${cl.length && n === cl.length ? '<p class="alldone">All done. Clock out — the evening is yours.</p>' : ''}</section>`) };
  }
  if (sl === 'morning') { const ml = meValid() && leavesHome(me, dk) ? fits(prof(me).launch, dk) : []; B.morning = { t: 'Your morning', meta: ml.length ? `${countDone(pPre(me, 'launch'), ml)} of ${ml.length} packed` : meValid() ? meLbl(me, meAt(me, dk)) : '', body: morningBody() }; }
  if ((sl === 'morning' || sl === 'day') && girlsAt(dk) === 'home') B.home = { t: 'Girls at home', meta: `${countDone('gh', H('lists').girlsHome || [])} of ${(H('lists').girlsHome || []).length}`, body: girlsHomeCard(dk) };
  const gSoon = upcomingGaps().filter(g => keyOf(new Date(g.s)) <= calAdd(realToday(), 14)).length;
  B.cal = { t: 'Calendar', meta: `${gSoon ? `Hlídání needed: ${gSoon} · ` : ''}${eventsOn(dayKey()).filter(notOver).length} still today`, body: calTodayBody() };
  /* 10 Nov 2026: no all-day "Tonight" group. What was in it now shows only when it matters: bedtime (for whoever has it, from 45 minutes
     before), the date night card (on a date night), and getting ready for tomorrow (from 15:00). The solo-evening text and the tag team
     repeated Today's setup at the top ("Your evening", "Who does what"), so they are gone. */
  { const xDate = meValid() && !(ev && ev.type === 'date') && dateEvOn(dk) ? `<section class="card evening"><div class="sec-head"><h2>Date night</h2></div><p>${esc(shortTitle(dateEvOn(dk).title))} tonight${dateEvOn(dk).start ? ` at ${esc(dateEvOn(dk).start)}` : ''}. Closing duties are optional; tomorrow can absorb them.</p>${ideasCard(true)}${dateListHtml()}</section>` : '';
    const dn = xDate || (ev && ev.type === 'date' ? eveningCard(ev) : '');
    if (dn) B.date = { t: 'Date night', meta: '', body: dn };
    const bd = bedtimeCard(); if (bd) B.bedtime = { t: 'Bedtime', meta: `${countDone('bt', H('lists').bedtime || [])} of ${(H('lists').bedtime || []).length}`, body: bd };
    const tm = (closingWindow() || nowMin() >= 900 ? planCard() : '') + (closingWindow() ? prepCard() : '') + (nowMin() >= 17 * 60 ? prepOutingsCard(tk) : '');
    if (tm.trim()) B.tomorrow = { t: 'Tomorrow', meta: '', body: tm }; }
  let board = trSection();
  const resets = Object.entries(S.day.done || {}).filter(([k, v]) => k.startsWith('reset:') && isDone(v));
  if (resets.length) board += `<section class="card"><h2>Resets today</h2><div class="chips">${resets.map(([, v]) => `<span class="chip">${esc(v.space || 'A room')}${v.by ? ' · ' + esc(v.by) : ''}${v.partial ? ' · partly' : ''}</span>`).join('')}</div></section>`;
  if (board.trim()) B.board = { t: 'Board, dinner and the rest', meta: '', body: board };
  /* while closing duties are due, they go to the top for whoever has them; whoever has bedtime gets Bedtime first */
  let order = SLOT_ORDER[sl];
  if (B.closing && closingDue() && meValid()) { const t = tagOf(), lead = B.bedtime && t.kids === me && t.close && t.close !== me ? 'bedtime' : 'closing';
    order = [lead, ...(lead === 'bedtime' ? [] : ['bedtime']), ...order.filter(k => k !== 'closing' && k !== 'bedtime'), ...(lead === 'bedtime' ? ['closing'] : [])]; }
  h += calmGroups(order, B, sec);
  return h;
}
/* ---------- Today's header cards ---------- */
function greeting() {
  const h = new Date().getHours(), n = me ? ', ' + esc(me) : '';
  if (h < 4) return 'Still up' + n + '?';
  if (h < 11) return 'Good morning' + n;
  if (h < 17) return 'Good afternoon' + n;
  return 'Good evening' + n;
}
function whoCard() {
  const ms = members();
  if (!ms.length) return `<section class="card"><h2>Who lives here?</h2><p class="muted">Add everyone who shares the care of this home, so you can see who did what.</p>
    <form class="addform" data-form="member"><input type="text" name="text" placeholder="A name" required aria-label="Name"><button class="btn" type="submit">Add</button></form></section>`;
  if (!ms.some(m => m.name === me)) return `<section class="card"><h2>Which one are you?</h2><p class="muted small">Only this device remembers it.</p><div class="pills">${ms.map(m => `<button class="pill" data-act="iam" data-name="${esc(m.name)}">${esc(m.name)}</button>`).join('')}</div></section>`;
  return '';
}
function liveBanner() {
  const L = H('live');
  if (!L || !L.who || !(L.until > Date.now())) return '';
  const until = new Date(L.until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (L.who === me) return `<div class="banner"><p><b>You’re on it:</b> ${esc(L.task)} until ${until}. The household can see it.</p></div>`;
  return `<div class="banner"><p><b>${esc(L.who)} is on it:</b> ${esc(L.task)}, until ${until}. Company makes it easier.</p><button class="btn" data-act="timer" data-min="10" data-label="Keeping ${esc(L.who)} company">Join for 10 min</button></div>`;
}
function modeCard(mode) {
  const ms = members().map(m => m.name), modes = S.day.modes || {};
  const mine = ms.length ? me : (me || 'us');
  const rows = ms.length ? [me, ...ms.filter(n => n !== me)].filter(Boolean) : [mine];
  const diff = new Set(Object.values(modes)).size > 1;
  const row = n => {
    if (n === mine) return `<div class="who-row"><b>${ms.length ? 'You' : 'Today'}</b><div class="mini-modes" role="radiogroup" aria-label="Your energy today">${Object.entries(MODES).map(([k, x]) => `<button class="mm${modes[n] === k ? ' on' : ''}" data-act="mode" data-who="${esc(n)}" data-m="${k}" role="radio" aria-checked="${modes[n] === k}"><i></i>${x.label}</button>`).join('')}</div></div>`;
    return `<div class="who-row"><b>${esc(n)}</b><div class="mini-modes">${modes[n] ? `<span class="mm on ro" data-m="${modes[n]}"><i></i>${MODES[modes[n]].label}</span>` : '<span class="muted small">Hasn’t checked in yet</span>'}</div></div>`;
  };
  return `<section class="card" id="energy"><div class="sec-head"><h2>How’s everyone’s tank?</h2></div>
    ${ms.length && !ms.includes(me) ? '<p class="muted small">Choose who you are above to check in.</p>' : `<div class="who-modes">${rows.map(row).join('')}</div>`}
    ${mode ? `<p class="muted small">${diff ? 'Different tanks today. The list follows whoever has least, so nobody gets pushed past empty.' : MODES[mode].sub + '.'}</p>` : '<p class="muted small">Pick your own; only you can set yours. Today’s list shrinks to fit whoever has least.</p>'}</section>`;
}
/* ---------- collapsible groups (COL and CHEV live in render.js) ---------- */
function secOpen(id, title, meta = '', defCol = false) {
  const col = COL[id] ?? defCol;
  return `<section class="grp" id="sec-${id}"><button class="grp-h" data-act="grp" data-id="${id}" data-def="${defCol ? 1 : 0}" aria-expanded="${!col}">${CHEV}<span>${title}</span><span class="line"></span>${meta ? `<span class="meta">${meta}</span>` : ''}</button><div class="grp-b"${col ? ' hidden' : ''}>`;
}
function dedupeHead(title, body) {
  if (!/^\s*<section class="card/.test(body)) return body;
  const t = document.createElement('template'); t.innerHTML = body;
  const c = t.content.firstElementChild, hd = c && c.querySelector(':scope > .sec-head'), h2 = hd && hd.querySelector(':scope > h2');
  if (!h2 || normT(h2.textContent) !== normT(title)) return body;
  h2.remove(); const pr = hd.querySelector(':scope > .progress'); if (pr) pr.remove();
  if (!hd.children.length) hd.remove(); else hd.classList.add('tools');
  return t.innerHTML;
}
/* ---------- time of day ---------- */
function slot() { const h = new Date().getHours(); return h >= 4 && h < 11 ? 'morning' : h >= 11 && h < 17 ? 'day' : h >= 17 && h < 22 ? 'evening' : 'night'; }
/* "still home today?" once a morning while the girls are on an open-ended home stretch */
function ghAsk() {
  const gh = girlsHomeRange(); if (!gh || gh.until || gh.from >= dk || situOf(dk).girlsConfirmed || situOf(dk).girls || !kidsList().length) return '';
  const dw = (new Date(dk + 'T12:00').getDay() + 6) % 7; if (dw >= 5 || czHoliday(dk)) return '';
  return `<section class="card ghask"><h2>Are the girls staying home today?</h2><p class="muted small">They’ve been home since ${fmtD(gh.from)} (${GH_REASONS.find(r => r[0] === gh.reason)?.[1].toLowerCase() || 'home'}).</p>
    <div class="actions"><button class="btn accent" data-act="gh-yes">Yes, home today</button><button class="btn ghost" data-act="gh-back" data-k="${dk}">Back to kindergarten</button></div></section>`;
}
/* ---------- small Today helpers ---------- */
function careSlotGroup() { const m = nowMin(); return m < 630 ? 0 : m < 840 ? 1 : m < 1080 ? 2 : 3; }
function tagCard() {
  const ms = members(); if (ms.length < 2) return '';
  const t = tagOf();
  const role = (key, title, sub) => `<div class="role"><h3>${title}</h3><p class="muted small">${sub}</p><div class="pills">${ms.map(m => `<button class="pill${t[key] === m.name ? ' on' : ''}" data-act="tag" data-role="${key}" data-name="${esc(m.name)}">${esc(m.name)}</button>`).join('')}</div></div>`;
  return `<section class="card"><div class="sec-head"><h2>Tonight’s tag team</h2>${t.kids && t.close ? '<button class="link" data-act="tag-swap">Swap</button>' : ''}</div>
    <div class="duo">${role('kids', 'With the girls', 'Bath, teeth, stories, bed')}${role('close', 'Closing duties', 'Roll straight in while bedtime happens, before sitting down')}</div>
    <p class="muted small">Deciding early saves the evening negotiation. Then you both clock out at the same time.</p></section>`;
}
function trSection() { return modOn('tasks') ? trSectionAll() : ''; }
/* ---------- taps on this area's buttons (data-act), called from events.js; true = handled ---------- */
function tapToday(a, el, e, r) {
  switch (a) {
    case 'tag': {
      const ms = members().map(m => m.name), role = el.dataset.role, other = role === 'kids' ? 'close' : 'kids', name = el.dataset.name;
      const t = { ...(S.day.tag || {}), [role]: name }; if (ms.length === 2) t[other] = ms.find(n => n !== name);
      S.day = { ...S.day, tag: t }; mergeDoc('days/' + dk, { tag: t }); render(true); return true;
    }
    case 'tag-swap': { const t = tagOf(), n = { kids: t.close, close: t.kids }; S.day = { ...S.day, tag: n }; mergeDoc('days/' + dk, { tag: n }); render(true); return true; }
    case 'grp': { const id = el.dataset.id, def = el.dataset.def === '1', col = COL[id] ?? def; COL[id] = !col; lsSet('afloat.col', JSON.stringify(COL)); render(true); return true; }
    case 'gh-yes': setSitu(dk, { girlsConfirmed: true }); toast('Home day it is. The lists have adjusted.'); return true;
  }
  return false;
}
