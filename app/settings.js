/* Afloat · app/settings.js · Priorities, Settings sheet, the timer (life ring).
   Plain script: shares one scope with the other app/*.js files (loaded in order by index.html). See CLAUDE.md. */
/* ---------- Priorities ---------- */
function vPriorities() {
  const items = H('priorities').items || [], L = H('lists');
  const pm = S.ui.prev || hMode() || 'full', tiers = MODES[pm].tiers, ep = S.ui.edit.prio;
  const cell = (imp, eff) => {
    const t = TIER(imp, eff), its = items.filter(x => x.impact === imp && x.effort === eff);
    return `<div class="cell t${t}${t > tiers ? ' dropped' : ''}">${its.map(x => `<span class="it"><span>${esc(x.text)}</span></span>`).join('')}</div>`;
  };
  return back() + `<section class="hero"><p class="eyebrow">The nine square</p><h1>Most good, least energy.</h1>
    <p class="lede">Sort what matters by impact and effort. When life gets heavy, the outer squares get set down without guilt.</p></section>
    <section class="card" data-sw-l="@prev:${Object.keys(MODES)[Math.min(Object.keys(MODES).length - 1, Object.keys(MODES).indexOf(pm) + 1)]}" data-sw-r="@prev:${Object.keys(MODES)[Math.max(0, Object.keys(MODES).indexOf(pm) - 1)]}" data-sw-kind="page"><div class="sec-head"><h2>Preview a day</h2></div>
      <div class="pills">${Object.entries(MODES).map(([k, m]) => `<button class="pill${pm === k ? ' on' : ''}" data-act="prev" data-m="${k}">${m.label}</button>`).join('')}</div>
      <div class="legend"><span><i style="background:var(--sea)"></i>Even in survival mode</span><span><i style="background:var(--amber)"></i>On running-low days</span><span><i style="background:var(--line)"></i>Full-tank days only</span></div>
      <div class="nine-wrap"><div class="nine" role="table" aria-label="Priorities by impact and effort">
        <span></span><span class="ax">Low effort</span><span class="ax">Medium effort</span><span class="ax">High effort</span>
        ${[3, 2, 1].map(imp => `<span class="ax ay">${['', 'Low', 'Medium', 'High'][imp]} impact</span>${[1, 2, 3].map(eff => cell(imp, eff)).join('')}`).join('')}
      </div></div>
      ${pm !== 'full' ? `<p class="muted small">Faded squares are de-prioritised, not failed. “I’ve set the floors down for something more important right now.”</p>` : ''}
      <div class="sec-head"><span></span>${editBtn('prio')}</div>
      ${ep && items.length ? `<ul class="edit-list">${items.map(x => `<li class="mvrow"><div class="txt rn">${rnInput('priorities', 'items', x, 'text')}</div><div class="rn-sub"><select data-act="regroup" data-doc="priorities" data-field="items" data-id="${x.id}" data-grp="impact" id="pi_${x.id}" aria-label="Impact of ${esc(x.text)}">${[3, 2, 1].map(v => `<option value="${v}" ${x.impact === v ? 'selected' : ''}>Impact: ${['', 'low', 'medium', 'high'][v]}</option>`).join('')}</select><select data-act="regroup" data-doc="priorities" data-field="items" data-id="${x.id}" data-grp="effort" id="pe_${x.id}" aria-label="Effort of ${esc(x.text)}">${[1, 2, 3].map(v => `<option value="${v}" ${x.effort === v ? 'selected' : ''}>Effort: ${['', 'low', 'medium', 'high'][v]}</option>`).join('')}</select></div><button class="chip x" data-act="del" data-doc="priorities" data-field="items" data-id="${x.id}" aria-label="Remove ${esc(x.text)}">✕</button></li>`).join('')}</ul>` : ''}
      ${ep ? `<form class="addform" data-form="prio"><input type="text" name="text" placeholder="e.g. Showering" required aria-label="New priority">${levelSelect('impact', 'Impact')}${levelSelect('effort', 'Effort')}<button class="btn" type="submit">Add</button></form>` : ''}
    </section>
    ${secOpen('p-glass', 'Glass and plastic', `${(L.glass || []).length} glass balls`)}<section class="card"><div class="sec-head"><h2>Glass and plastic</h2>${editBtn('glass')}</div>
      <p class="muted small">Glass balls shatter if dropped: feeding people, meds, caring for kids and pets, mental health. Recycling, home-cooked, organic, folded: plastic. They bounce, and you can pick them up later.</p>
      ${S.ui.edit.glass ? editList('lists', 'glass', L.glass, 'Add a glass ball') : `<div class="chips">${(L.glass || []).map(x => `<span class="chip">${esc(x.text)}</span>`).join('') || '<span class="muted small">None yet</span>'}</div>`}</section>${secClose()}`;
}

/* ---------- Rest ---------- */
/* ---------- Settings ---------- */
/* per-person connection check: what works for whoever is looking, and how to fix what doesn't */
const trFix = e => e ? ' <button class="tiny" data-act="perm-manage">Connections</button>' : '';
function connBox() {
  const st = (ok, err, idle) => ok ? '<span class="badge ok">Working</span>' : err ? '<span class="badge warn">Not working</span>' : `<span class="badge">${idle || 'Not checked yet'}</span>`;
  const T = S.trello, G = S.gcal, B = S.tb;
  const trOk = T.status === 'ok' && B.status !== 'error', trErr = T.status === 'error' || B.status === 'error';
  const errOf = T.status === 'error' ? T.err : B.status === 'error' ? B.err : null;
  return `<h3>Connections for ${esc(me || 'you')}</h3>
    <p class="muted small">Each of you connects your own Trello and Google Calendar once; Afloat uses them only for you. This shows how it looks for you, on this device.</p>
    <ul class="edit-list conn">
      <li><span class="txt"><b>Trello</b> ${st(trOk, trErr, T.status === 'loading' || B.status === 'loading' ? 'Checking…' : '')}${trOk ? `<span class="def">${tbBoards().length} board${tbBoards().length === 1 ? '' : 's'}: ${esc(tbBoards().map(b => b.name).join(', '))}${(S.tb.me || {}).fullName ? ' · signed in as ' + esc(S.tb.me.fullName) : ''}</span>` : ''}${trErr ? `<span class="def">${esc(trMsg(errOf))}${errOf && errOf.code ? ` (${esc(errOf.code)})` : ''}</span>` : ''}</span></li>
      <li><span class="txt"><b>Google Calendar</b> ${st(G.status === 'ok', G.status === 'error', G.status === 'loading' ? 'Checking…' : '')}${G.status === 'error' ? `<span class="def">${esc(connMsg(G.err, 'Google Calendar'))}${G.err && G.err.code ? ` (${esc(G.err.code)})` : ''}</span>` : ''}</span></li>
      <li><span class="txt"><b>Claude, for sorting the inbox</b> ${sample ? '<span class="badge ok">Available</span>' : '<span class="badge">Off</span>'}</span></li>
    </ul>
    <div class="actions"><button class="btn accent" data-act="perm-manage">Connect Trello, Google and people…</button><button class="btn ghost" data-act="conn-check">Check again</button></div>`;
}
function vSettings() {
  const ms = members();
  return `<div class="scrim" data-act="close-settings"><div class="sheet" role="dialog" aria-label="Household" data-stop="1">
    <div class="sec-head"><h2>Our household</h2><button class="link" data-act="close-settings">Close</button></div>
    <ul class="edit-list">${ms.map(m => `<li><span class="txt">${esc(m.name)}${m.name === me ? ' <span class="muted small">· you, on this device</span>' : ''}</span>${m.name !== me ? `<button class="pill" data-act="iam" data-name="${esc(m.name)}">This is me</button>` : ''}<button class="chip x" data-act="del-member" data-id="${m.id}" aria-label="Remove ${esc(m.name)}">✕</button></li>`).join('')}</ul>
    <form class="addform" data-form="member"><input type="text" name="text" placeholder="Add a person" required aria-label="Add a person"><button class="btn" type="submit">Add</button></form>
    <h3>${ourHome() ? 'The girls' : 'Children'}</h3><p class="muted small">Used for the calendar, babysitting checks and sick-day medicines.</p>
    <div class="chips">${(H('household').kids || []).map((k, i) => `<span class="chip">${esc(k)}<button class="x" data-act="del-kid" data-i="${i}" aria-label="Remove ${esc(k)}">✕</button></span>`).join('')}</div>
    <form class="addform" data-form="kid"><input type="text" name="text" placeholder="Add a child’s name" required aria-label="Child’s name"><button class="btn" type="submit">Add</button></form>
    ${modsCard()}
    ${aboutCard()}
    ${kidsList().length ? `<h3>Paediatrician</h3><form class="addform" data-form="doctor"><input type="text" name="text" value="${esc(H('household').doctor || '')}" placeholder="Name and phone number" required aria-label="Paediatrician name and phone"><button class="btn" type="submit">Save</button></form>` : ''}
    ${meValid() ? '<button class="link" data-act="setup" style="align-self:flex-start">My mornings: wake-up time and launch list</button>' : ''}
    ${jobCard()}
    <label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="sound" data-act="sound" ${S.ui.sound ? 'checked' : ''}> Chime when a timer ends (this device only)</label>
    ${meValid() ? (() => { const P = ntPrefs(); return `<h3>Phone reminders</h3><p class="muted small">Leave-by, getting ready and medicine always ring. Other reminders ring on their own up to your daily ceiling; the rest come together at 7:00, 12:00 and 18:00. Nothing rings between 23:00 and 4:00.</p>
      <div class="pills">${[[4, '4 a day'], [6, '6 a day'], [10, '10 a day'], [0, 'No ceiling']].map(([v, l]) => `<button class="pill${(+P.cap || 0) === v && P.bundle ? ' on' : ''}" data-act="nt-cap" data-v="${v}" aria-pressed="${(+P.cap || 0) === v}">${l}</button>`).join('')}</div>
      <h3>Leaving soon</h3><p class="muted small">Before you leave for something, it moves to the top of Today with a countdown, the small steps and what to take. Start getting ready:</p>
      <div class="pills">${RUN_LEADS.map(v => `<button class="pill${runLead() === v ? ' on' : ''}" data-act="run-lead" data-v="${v}" aria-pressed="${runLead() === v}">${v} min before</button>`).join('')}</div>`; })() : ''}
    ${meValid() ? `<h3>Today</h3><label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-act="${calmOn() ? 'calm-off' : 'calm-on'}" ${calmOn() ? 'checked' : ''}> Calm Today: one next thing, three groups open, the rest folded (this phone)</label>${(useOf().favs || []).length ? `<p class="muted small">On top for you: ${(useOf().favs || []).map(k => esc(TODAY_GROUPS[k] || k)).join(', ')}. <button class="link" data-act="fav-again">Choose again</button></p>` : ''}` : ''}
    ${usageBox()}
    ${backupBox()}
    ${connBox()}
    ${trPickCard()}
    <p class="small">${H('trello').boardUrl ? `<a class="link" href="${esc(H('trello').boardUrl)}" target="_blank" rel="noopener">Your household’s board on Trello</a> · ` : ''}<a class="link" href="#meals">Meals</a></p>
    <p class="muted small">To add someone, put their Google address under Household in Connections. Everyone then sees the same lists and ticks live, and connects their own Trello and Google Calendar.</p>
    <p class="muted small">Built on ideas from KC Davis’s <i>How to Keep House While Drowning</i>: care tasks are morally neutral, and your space exists to serve you.</p>
  </div></div>`;
}

/* ---------- timer (life ring) ---------- */
const T = { end: 0, total: 0, left: 0, paused: false, label: '', iv: null, rang: false };
const C = 2 * Math.PI * 88;
function startTimer(min, label, share) {
  T.total = min * 60e3; T.end = Date.now() + T.total; T.left = T.total; T.paused = false; T.label = label; T.rang = false;
  clearInterval(T.iv); T.iv = setInterval(tick, 250); drawTimer(true); tick();
  if ((share || S.ui.share) && me && db) saveHome('live', { who: me, task: label, until: T.end });
}
function stopTimer() {
  clearInterval(T.iv); $('#timer').hidden = true;
  const L = H('live'); if (db && L.who === me && L.until > Date.now()) saveHome('live', { who: '', task: '', until: 0 });
}
function tick() {
  if (!T.paused) T.left = Math.max(0, T.end - Date.now());
  const m = Math.floor(T.left / 60e3), s = Math.floor(T.left / 1e3) % 60;
  const num = $('#tnum'), arc = $('#tarc');
  if (num) num.textContent = m + ':' + pad(s);
  if (arc) arc.setAttribute('stroke-dashoffset', (C * (1 - T.left / T.total)).toFixed(1));
  if (T.left === 0 && !T.rang) { T.rang = true; chime(); drawTimer(false); }
}
function drawTimer() {
  const done = T.left === 0 && T.rang;
  const el = $('#timer'); el.hidden = false;
  el.innerHTML = `<div class="tbox" role="dialog" aria-label="Timer"><p class="tlabel">${esc(T.label)}</p>
    <div class="tring"><svg viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="100" cy="100" r="88" fill="none" stroke="var(--line)" stroke-width="22"/>
      <circle id="tarc" cx="100" cy="100" r="88" fill="none" stroke="var(--accent)" stroke-width="22" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="0"/>
      <circle cx="100" cy="100" r="88" fill="none" stroke="var(--ring-band)" stroke-opacity=".9" stroke-width="22" stroke-dasharray="${(C / 16).toFixed(2)} ${(C * 3 / 16).toFixed(2)}" stroke-dashoffset="${(C / 32).toFixed(2)}"/>
    </svg><div class="num"><b id="tnum" aria-live="off">0:00</b><span class="muted small">${done ? 'time’s up' : 'left'}</span></div></div>
    ${done ? `<p>You can stop now, finished or not. If you’re in the groove, keep going.</p><div class="actions"><button class="btn ghost" data-act="t-more">5 more min</button><button class="btn accent" data-act="t-stop">I’m done</button></div>`
      : `<p class="muted small">Permission to stop when it rings.</p><div class="actions"><button class="btn ghost" data-act="t-pause">${T.paused ? 'Resume' : 'Pause'}</button><button class="btn ghost" data-act="t-add">+5 min</button><button class="btn" data-act="t-stop">Stop</button></div>`}</div>`;
  tick();
}
function chime() {
  if (!S.ui.sound) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [523.25, 659.25, 783.99].forEach((f, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * .22); g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + i * .22 + .03); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * .22 + 1.2);
      o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + i * .22); o.stop(ctx.currentTime + i * .22 + 1.3); });
  } catch {}
}
/* ---------- taps on this area's buttons (data-act), called from events.js; true = handled ---------- */
/* Your task lists: Afloat's own lists on or off, which board is the household's, each person's own list, the household list and the three shopping
   lists (home/trello: board, boardUrl, people, lists.home, pick). Shown once Trello is connected and its boards are in. */
function trPickCard() {
  if (!modOn('tasks')) return '';
  const own = ownOn(), sw = `<ul class="mod-list"><li><button class="mod-row${own ? ' on' : ''}" data-act="own-sw" role="switch" aria-checked="${own}"><span class="mod-sw" aria-hidden="true"></span><span><b>Afloat’s own lists</b><span class="muted small">Simple to-do and shopping lists kept in Afloat, shared by everyone here. No other app needed; they sit next to Trello if you use it too.</span></span></button></li></ul>`;
  if (!tbBoards().length) return `<h3>Your task lists</h3>${sw}<p class="muted small">Or connect Trello in Connections, then choose its lists here.</p>`;
  const c = H('trello'), L = trL(), opt = (cur, none = 'Not set') => `<option value="">${none}</option>` + tbBoards().map(b => `<optgroup label="${esc(b.name)}">${b.lists.filter(l => !isDoneList(l.name)).map(l => `<option value="${esc(l.id)}" ${l.id === cur ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</optgroup>`).join('');
  const row = (k, label, cur, hint) => `<label class="small hh-f">${label}<select data-act="trp" data-k="${k}" id="trp_${k.replace(/[^a-z0-9]/gi, '_')}">${opt(cur)}</select>${hint ? `<span class="muted small">${hint}</span>` : ''}</label>`;
  return `<h3>Your task lists</h3>${sw}<p class="muted small">Which lists Afloat uses. Everyone in the household sees the same choices.</p>
    <label class="small hh-f">The household’s board (Trello) or Afloat’s own lists<select data-act="trp" data-k="board" id="trp_board"><option value="">Not set</option>${tbBoards().map(b => `<option value="${esc(b.id)}" ${b.id === c.board ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select></label>
    ${adults().map(n => row('person:' + n, `${esc(n)}’s own to-dos`, (c.people || {})[n])).join('')}
    ${row('home', 'Shared household to-dos', (c.lists || {}).home, 'Shown on Today as “Household”')}
    ${row('food', 'Groceries', L.food, modOn('meals') ? 'Meals sends the shopping list here' : '')}${row('shop', 'Toiletries and cleaning', L.shop, 'The restock run and supply check send things here')}${row('med', 'Pharmacy', L.med, '')}`;
}
/* About your home: the household's own facts (core.js → houseFacts), kept in its data, never in the code */
function aboutCard() {
  const hh = H('household'), n = hh.nap || {}, ks = kidsList(), f = (k, label, v, ph, type = 'text') => `<label class="small hh-f">${label}<input type="${type}" id="hh_${k.replace('.', '_')}" data-act="hh-f" data-f="${k}" value="${esc(v || '')}" placeholder="${esc(ph)}"></label>`;
  return `<h3>About your home</h3><p class="muted small">Kept with your household’s things, only for you. Claude reads it for ideas (trips, date nights, the season check), so a few honest lines help.</p>
    ${f('town', 'Town or city (for the weather)', hh.town, 'e.g. Brno')}${f('address', 'Home address (what counts as home, where drives start)', hh.address, 'Street and number, town')}
    <label class="small hh-f">In your words<textarea id="hh_about" data-act="hh-f" data-f="about" rows="4" placeholder="e.g. Two adults with ADHD; leaving the house is the hard part. A flat on the 3rd floor, no lift. One cat. We don’t drive.">${esc(hh.about || '')}</textarea></label>
    ${ks.length ? `<div class="hh-nap"><label class="small hh-f">Daytime nap<select id="hh_nap_kid" data-act="hh-f" data-f="nap.kid"><option value="">Nobody naps</option>${ks.map(k => `<option ${n.kid === k ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select></label>
      ${n.kid ? f('nap.from', 'From', n.from || '11:30', '11:30', 'time') + f('nap.to', 'Until', n.to || '14:00', '14:00', 'time') : ''}</div>` : ''}`;
}
/* What Afloat helps with: the household's modules (MODS in core.js), for everyone in the household */
function modsCard() {
  return `<h3>What Afloat helps with</h3><p class="muted small">Switch off what doesn’t fit your household: its tab, cards and nudges go away for everyone here. Nothing it saved is deleted, so switching it back on brings it all back.</p>
    <ul class="mod-list">${MODS.map(([k, t, d]) => { const on = modOn(k); return `<li><button class="mod-row${on ? ' on' : ''}" data-act="mod-sw" data-k="${k}" role="switch" aria-checked="${on}"><span class="mod-sw" aria-hidden="true"></span><span><b>${t}</b><span class="muted small">${d}</span></span></button></li>`; }).join('')}</ul>`;
}
function tapSettings(a, el, e, r) {
  switch (a) {
    case 'own-sw': { saveHome('trello', { ...H('trello'), own: !ownOn() }); setTimeout(() => tbLoad(true).then(trLoad), 50); return true; }
    case 'mod-sw': { const k = el.dataset.k; if (!MODS.some(m => m[0] === k)) return true; const o = H('household'); saveHome('household', { ...o, modules: { ...(o.modules || {}), [k]: !modOn(k) } }); return true; }
    case 'backup': backupMake(); return true;
    case 'nt-cap': { const v = +el.dataset.v; savePeople(me, { notify: { ...ntPrefs(), cap: v, bundle: v > 0 } }, true); notifySig = ''; return true; }
    case 'run-lead': savePeople(me, { runLead: +el.dataset.v }, true); notifySig = ''; return true;
    case 'fav-again': useSet({ favAsked: null, favs: [] }); S.ui.favSkip = false; S.ui.settings = false; render(true); return true;
    case 'del-kid': { const o = { ...H('household') }; o.kids = (o.kids || []).filter((_, i) => i !== +el.dataset.i); saveHome('household', o); return true; }
    case 'iam': me = el.dataset.name; lsSet('afloat.me', me); render(true); return true;
    case 'del-member': { const o = { ...H('household') }; o.members = (o.members || []).filter(m => m.id !== el.dataset.id); saveHome('household', o); return true; }
    case 'prev': S.ui.prev = el.dataset.m || el.dataset.k; render(true); return true;
    case 'close-settings': S.ui.settings = false; render(true); return true;
    case 't-pause': if (T.paused) { T.end = Date.now() + T.left; T.paused = false; } else { T.paused = true; } drawTimer(); return true;
    case 't-add': T.end += 5 * 60e3; T.total += 5 * 60e3; tick(); return true;
    case 't-more': T.total = 5 * 60e3; T.end = Date.now() + T.total; T.left = T.total; T.rang = false; drawTimer(); return true;
    case 't-stop': stopTimer(); return true;
  }
  return false;
}
/* ---------- a copy of the household's data (9 Nov 2026) ----------
   Everything Afloat and Meals keep in Firestore, as one JSON file in the same shape as the "Moving in" import in
   Connections, so a copy can be brought back there by the owner. Photos stay in Firebase Storage (only their links are in
   the copy). Phone-notification lists (notify/*) are left out: they're rebuilt by the app. A nudge on the briefing in the
   first week of a month when the last copy is more than a month old (home/household.backupAt). */
const BACKUP = { afloat: ['home', 'days', 'weeks', 'months', 'plans', 'events', 'usage', 'restlog'], mealtime: ['recipes', 'plan', 'shopping', 'pantry', 'kitchen', 'allergenTags', 'settings', 'people'] };
function backupBox() {
  if (!db) return ''; const at = H('household').backupAt;
  return `<h3>A copy of everything</h3><p class="muted small">Afloat’s and Meals’ data in one file, to keep somewhere safe (your computer, Google Drive). ${at ? `Last copy: ${esc(fmtD(keyOf(new Date(at))))}.` : 'No copy yet.'} It can be brought back in Connections → Bring back a copy.</p>
    <div class="actions"><button class="btn ghost" data-act="backup" ${S.ui.backup ? 'disabled' : ''}>${S.ui.backup ? 'Making the copy…' : 'Download a copy'}</button></div>`;
}
async function backupMake() {
  if (!db || S.ui.backup) return; S.ui.backup = true; render(true);
  try {
    const apps = {}, n = { docs: 0 };
    for (const [app, cols] of Object.entries(BACKUP)) {
      const d = app === 'afloat' ? db : db.app ? db.app(app) : null; if (!d) continue; apps[app] = {};
      for (const c of cols) { const s = await d.collection(c).get().catch(() => ({ docs: [] })); for (const x of s.docs) { apps[app][c + '/' + x.id] = x.data(); n.docs++; } }
    }
    const blob = new Blob([JSON.stringify({ made: new Date().toISOString(), by: me || '', apps, photos: {} }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `afloat-copy-${realToday()}.json`; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    mergeDoc('home/household', { backupAt: Date.now() }); toast(`Copy made: ${n.docs} items. Keep the file somewhere safe.`);
  } catch (e) { console.warn(e); toast('The copy didn’t work: ' + ((e && e.message) || 'try again')); }
  S.ui.backup = false; render(true);
}
const backupDue = () => { const at = H('household').backupAt || 0; return +dk.slice(8) <= 7 && Date.now() - at > 30 * 864e5; };
