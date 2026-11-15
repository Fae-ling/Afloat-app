/* Afloat platform: lets the same app code run outside claude.ai.
   Inside a claude.ai artifact (or the tests) window.claude already exists and this file does nothing.
   Installed on its own, it provides window.claude.use(name) for:
     db          → Firebase Firestore (the household's shared data, under apps/<app>/)
     mcp         → Trello and Google Calendar, with each person's own accounts, through Afloat's server
     sample      → Claude through Anthropic's API, through Afloat's server
     assets      → photos in Firebase Storage
     permissions → the Connections screen
   It also shows the sign-in screen and Settings → Connections (Trello, Google Calendar, household). */
(function () {
  if (window.claude && window.claude.use) return;
  const CFG = window.AFLOAT_CONFIG || {}, FB = CFG.firebase || {};
  if (!FB.apiKey) return; /* not set up (or opened as a plain file): the app runs on this device only, as before */
  const script = document.currentScript, APP = (script && script.dataset.app) || 'afloat';
  const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const ROOT = new URL('..', script ? script.src : location.href).href; /* the site root, also from /meals/ */
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const load = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Couldn’t load ' + src)); document.head.appendChild(s); });

  /* ---------- styles for the sign-in screen and the Connections sheet ---------- */
  const css = `.hp-ov{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;padding:24px 16px;background:var(--bg,#EDF3F2);color:var(--ink,#14313A);font-family:system-ui,-apple-system,"Segoe UI",sans-serif;overflow:auto}
.hp-ov.hp-sheet{background:rgba(10,25,30,.45);align-items:flex-end}
.hp-card{width:100%;max-width:440px;background:var(--surface,#fff);border-radius:20px;padding:22px 20px;box-shadow:0 10px 40px rgba(0,0,0,.18);display:flex;flex-direction:column;gap:14px}
.hp-ov.hp-sheet .hp-card{border-radius:20px 20px 0 0;max-height:92vh;overflow:auto;margin:0 auto}
.hp-card h2{margin:0;font-size:1.35rem;font-family:var(--f-display,inherit)} .hp-card h3{margin:0;font-size:.78rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted,#55717A)}
.hp-card p{margin:0;line-height:1.45} .hp-muted{color:var(--muted,#55717A);font-size:.9rem}
.hp-btn{font:inherit;font-weight:700;border:0;border-radius:99px;padding:12px 18px;background:var(--accent,#D4472A);color:var(--accent-ink,#fff);cursor:pointer}
.hp-btn.ghost{background:transparent;color:inherit;border:1.5px solid var(--line,#D0DFDC)} .hp-btn.small{padding:7px 12px;font-size:.88rem}
.hp-row{display:flex;align-items:center;gap:10px;justify-content:space-between;padding:12px 0;border-top:1px solid var(--line,#D0DFDC)}
.hp-row b{display:block} .hp-dot{width:10px;height:10px;border-radius:50%;flex:none;background:var(--muted,#55717A)} .hp-dot.on{background:var(--sea,#257A75)} .hp-dot.bad{background:var(--alert,#C2570F)}
.hp-add{display:flex;gap:8px} .hp-add input{flex:1;min-width:0;font:inherit;padding:10px 12px;border-radius:12px;border:1px solid var(--line,#D0DFDC);background:var(--bg,#fff);color:inherit}
.hp-chips{display:flex;flex-wrap:wrap;gap:6px} .hp-chip{display:inline-flex;gap:6px;align-items:center;padding:5px 10px;border-radius:99px;background:var(--sunk,#E0EBE9);font-size:.88rem}
.hp-away{margin:0;padding-left:1.1em;display:flex;flex-direction:column;gap:4px;font-size:.88rem}
.hp-chip button{border:0;background:none;color:inherit;cursor:pointer;font:inherit;padding:0 2px}
.hp-toast{position:fixed;left:50%;bottom:90px;transform:translateX(-50%);z-index:101;background:var(--ink,#14313A);color:var(--bg,#fff);padding:10px 16px;border-radius:12px;font:600 .92rem system-ui;max-width:90vw}`;
  const style = () => { if (!$('#hp-style')) { const s = document.createElement('style'); s.id = 'hp-style'; s.textContent = css; document.head.appendChild(s); } };
  const toast = t => { style(); const d = document.createElement('div'); d.className = 'hp-toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 4500); };
  function overlay(id, html, sheet) {
    style(); let el = document.getElementById(id);
    if (!el) { el = document.createElement('div'); el.id = id; document.body.appendChild(el); }
    el.className = 'hp-ov' + (sheet ? ' hp-sheet' : ''); el.innerHTML = `<div class="hp-card" role="dialog" aria-modal="true">${html}</div>`; return el;
  }
  const close = id => { const el = document.getElementById(id); if (el) el.remove(); };

  /* ---------- Firebase ---------- */
  let ready = null, F = null, me = null, status = null, onConnClose = null;
  /* which household this person is in (10 Nov 2026): { hid, base, legacy, name }. The first household keeps its data at
     apps/<app>/ (base ''); every other household at households/<hid>/apps/<app>/. Known from the server; kept on the phone
     so Afloat still opens offline. */
  let house = null;
  const houseKey = () => 'afloat.house.' + (me ? me.uid : '');
  const houseFromCache = () => { try { return JSON.parse(localStorage.getItem(houseKey()) || 'null'); } catch { return null; } };
  const houseKeep = h => { house = h; try { localStorage.setItem(houseKey(), JSON.stringify(h)); localStorage.setItem('afloat.base', h.base || ''); } catch {} };
  async function findHouse() {
    if (status && status.house) return houseKeep(status.house);
    /* the server didn't answer (offline, or the tests' emulator has no server): users/<email> says, else the last known */
    try { const u = await F.fs.doc('users/' + String(me.email).toLowerCase()).get(); const hid = u.exists && u.data().hid;
      return houseKeep(hid && hid !== 'legacy' ? { hid, base: `households/${hid}/`, legacy: false, name: '' } : { hid: 'legacy', base: '', legacy: true, name: '' }); }
    catch (e) { console.warn('household', e); }
    house = houseFromCache() || { hid: 'legacy', base: '', legacy: true, name: '' };
  }
  /* an invited address with no household yet starts one */
  function startHouse(msg) {
    overlay('hp-sign', `<h2>Start your household</h2><p>You’re invited to Afloat. Give your household a name; you can add the people you live with afterwards in Settings → Connections.</p>
      <div class="hp-add"><input type="text" id="hpHouse" maxlength="60" placeholder="e.g. The Nováks" aria-label="Household name"></div>${msg ? `<p class="hp-muted">${esc(msg)}</p>` : ''}
      <button class="hp-btn" data-hp="create">Start it</button><p class="hp-muted">Signed in as ${esc(me && me.email)}. Only the people you add can see your household’s things.</p><button class="hp-btn ghost" data-hp="signout">Use another Google account</button>`);
    return new Promise(() => {});
  }
  const call = (name, data, timeout = 300000) => F.app.functions(CFG.region || 'europe-west1').httpsCallable(name, { timeout })(data).then(r => r.data);
  function errOf(e) {
    const d = (e && e.details) || {}, c = String((e && e.code) || '').replace('functions/', '');
    const code = d.code || ({ unauthenticated: 'not_granted', 'permission-denied': 'not_granted', unavailable: 'server_unavailable', 'deadline-exceeded': 'server_unavailable', internal: 'upstream_error' })[c] || 'upstream_error';
    return Object.assign(new Error((e && e.message) || 'Something went wrong.'), { code, retryable: d.retryable || code === 'server_unavailable' || code === 'upstream_error', retryAfterMs: d.retryAfterMs || null });
  }

  function start() {
    if (ready) return ready;
    ready = (async () => {
      await load(SDK + 'firebase-app-compat.js');
      await Promise.all(['auth', 'firestore', 'functions', 'storage'].map(x => load(SDK + `firebase-${x}-compat.js`)));
      /* sign-in runs on Afloat's own address: Chrome keeps other sites' storage apart, which breaks sign-in otherwise */
      const host = location.hostname, app = firebase.initializeApp({ ...FB, authDomain: /\.(web\.app|firebaseapp\.com)$/.test(host) ? host : FB.authDomain });
      const fs = app.firestore();
      /* only the GitHub check (tests/real-firebase) sets this: Firebase's local emulator instead of the live project */
      const EM = CFG.emulators; if (EM) { fs.useEmulator(EM.host, EM.firestore); app.auth().useEmulator(`http://${EM.host}:${EM.auth}`, { disableWarnings: true }); app.functions(CFG.region || 'europe-west1').useEmulator(EM.host, EM.functions); }
      try { await fs.enablePersistence({ synchronizeTabs: true }); } catch {}
      F = { app, fs, auth: app.auth(), st: app.storage() };
      try { await F.auth.getRedirectResult(); } catch (e) { console.warn(e); if (/BLOCKING_FUNCTION|This Afloat is private|private to one household|permission.denied/i.test((e.message || '') + (e.code || ''))) { awayScreen(); return new Promise(() => {}); } }
      me = await new Promise(res => { const off = F.auth.onAuthStateChanged(u => { if (u) { off(); res(u); } else signIn(); }); });
      close('hp-sign');
      try { status = await call('connections', {}, 30000); }
      catch (e) {
        if (e.details && e.details.code === 'not_member') { overlay('hp-sign', `<h2>Not in the household yet</h2><p>${esc(me.email)} isn’t on Afloat’s list.</p><p class="hp-muted">Ask someone in your household to add this address in Settings → Connections → Household, then open Afloat again.</p><button class="hp-btn ghost" data-hp="signout">Use another Google account</button>`); return new Promise(() => {}); }
        console.warn('connections', e);
      }
      if (status && status.invited && !status.house) return startHouse();
      await findHouse();
      await finishPending();
      return F;
    })();
    return ready;
  }
  function signIn(msg) {
    overlay('hp-sign', `<h2>Afloat</h2><p>Sign in with your Google account to open your household.</p>${msg ? `<p class="hp-muted">${esc(msg)}</p>` : ''}<button class="hp-btn" data-hp="google">Sign in with Google</button><p class="hp-muted">Your Trello and Google Calendar get connected separately, in Settings → Connections, so each of you uses your own.</p>`);
  }
  async function doSignIn() {
    const p = new firebase.auth.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' });
    try { await F.auth.signInWithPopup(p); }
    catch (e) { if (/popup|operation-not-supported|web-storage/.test(e.code || '')) await F.auth.signInWithRedirect(p);
      else if (/BLOCKING_FUNCTION|This Afloat is private|private to one household|permission.denied/i.test((e.message || '') + (e.code || ''))) awayScreen();
      else signIn('Sign-in didn’t finish: ' + (e.message || e.code)); }
  }

  /* ---------- connecting Trello and Google Calendar (redirect there and back) ---------- */
  const RETURN = ROOT + 'platform/return.html';
  function connect(what) {
    const cfg = (status && status.config) || {};
    sessionStorage.setItem('hp.back', location.href);
    const state = what + ':' + Math.random().toString(36).slice(2); sessionStorage.setItem('hp.state', state);
    if (what === 'trello') {
      if (!cfg.trelloKey) return toast('Trello isn’t set up on the server yet.');
      location.href = 'https://trello.com/1/authorize?' + new URLSearchParams({ expiration: 'never', name: 'Afloat', scope: 'read,write', response_type: 'token', key: cfg.trelloKey, callback_method: 'fragment', return_url: RETURN });
    } else {
      if (!cfg.googleClientId) return toast('Google isn’t set up on the server yet.');
      location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({ client_id: cfg.googleClientId, redirect_uri: RETURN, response_type: 'code', access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', scope: 'openid email https://www.googleapis.com/auth/calendar', state });
    }
  }
  async function finishPending() {
    let p = null; try { p = JSON.parse(sessionStorage.getItem('hp.pending') || 'null'); } catch {}
    if (!p) return; sessionStorage.removeItem('hp.pending');
    try {
      if (p.what === 'trello') { const r = await call('connectTrello', { token: p.token }); toast(`Trello connected as ${r.name}.`); }
      if (p.what === 'google') { const r = await call('connectGoogle', { code: p.code, redirectUri: RETURN }); toast(`Google Calendar connected${r.email ? ' as ' + r.email : ''}.`); }
      status = await call('connections', {}, 30000);
      openConnections();
    } catch (e) { toast('Connecting didn’t work: ' + (e.message || e.code)); openConnections(); }
  }

  /* ---------- Settings → Connections ---------- */
  /* turned away at sign-in (the household-only door is on) */
  function awayScreen() { overlay('hp-sign', `<h2>This Afloat is private</h2><p>Only its households’ Google accounts can sign in.</p><p class="hp-muted">If you should be here, ask someone in your household to add your Google address in Settings → Connections → Household, or ask for an invitation to start your own.</p><button class="hp-btn ghost" data-hp="google">Try another Google account</button>`); }
  /* Settings → Connections → Claude → Test: one tiny call, and the exact answer or error */
  let claudeTest = {};
  async function testClaude() {
    claudeTest = { busy: true }; openConnections();
    try { const r = await call('sample', { input: 'Reply with only the word: ok', modelTier: 'quick', json: false, test: true, feature: 'test' }, 60000); claudeTest = { ok: true, msg: `Working (${r.model || 'Claude'} said “${String(r.text || '').trim().slice(0, 20)}”)` }; }
    catch (e) { const d = (e && e.details) || {}; claudeTest = { ok: false, msg: `Not working: ${(e && e.message) || 'no answer'}${d.code ? ` (${d.code})` : ''}` }; console.warn('Claude test', e); }
    openConnections();
  }
  async function openConnections() {
    await start();
    try { status = await call('connections', {}, 30000); } catch (e) { console.warn(e); }
    const s = status || { trello: {}, google: {}, members: [] }, t = s.trello || {}, g = s.google || {};
    const row = (dot, title, sub, btn) => `<div class="hp-row"><span class="hp-dot ${dot}"></span><div style="flex:1;min-width:0"><b>${title}</b><span class="hp-muted">${sub}</span></div>${btn}</div>`;
    overlay('hp-conn', `<div style="display:flex;justify-content:space-between;align-items:center"><h2>Connections</h2><button class="hp-btn ghost small" data-hp="close">Done</button></div>
      <p class="hp-muted">Signed in as ${esc(me && me.email)}. Each of you connects your own accounts; Afloat uses them only for you.</p>
      ${row(t.connected ? 'on' : '', 'Trello', t.connected ? `Connected as ${esc(t.name)}` : 'Not connected', t.connected ? '<button class="hp-btn ghost small" data-hp="off-trello">Disconnect</button>' : '<button class="hp-btn small" data-hp="trello">Connect</button>')}
      ${row(g.connected ? 'on' : g.broken ? 'bad' : '', 'Google Calendar', g.connected ? `Connected as ${esc(g.email)}` : g.broken ? 'Needs reconnecting' : 'Not connected', g.connected ? '<button class="hp-btn ghost small" data-hp="off-google">Disconnect</button>' : '<button class="hp-btn small" data-hp="google-cal">Connect</button>')}
      ${(() => { const c = s.claude || {};
        if (c.own && !c.set) return row('', 'Claude', 'Off: your household uses its own Claude API key' + (s.owner ? '' : ' (the owner adds it)') + '. <a href="/help/claude-key.html" target="_blank" rel="noopener">How to get one (10 minutes)</a>', '') + (s.owner ? `<div class="hp-add"><input type="password" id="hpKey" autocomplete="off" placeholder="sk-ant-…" aria-label="Claude API key"><button class="hp-btn small" data-hp="key">Save</button></div>` : '');
        return row(claudeTest.ok === false ? 'bad' : 'on', 'Claude', claudeTest.msg ? esc(claudeTest.msg) : (c.own ? `Your own key (…${esc(c.hint)}). ` : '') + 'Brain-dump sorting, date night ideas, recipes', `<button class="hp-btn ghost small" data-hp="test-claude" ${claudeTest.busy ? 'disabled' : ''}>${claudeTest.busy ? 'Testing…' : 'Test'}</button>${c.own && s.owner ? '<button class="hp-btn ghost small" data-hp="key-off">Remove</button>' : ''}`); })()}
      ${(() => { const on = (() => { try { return localStorage.getItem('afloat.push') === '1' && Notification.permission === 'granted'; } catch { return false; } })();
        return row(on ? 'on' : '', 'Notifications on this phone', !pushReady() ? 'Not set up yet (see the setup guide)' : on ? 'Leave-by reminders with what to take, and home reminders with a time' : 'Off', !pushReady() ? '' : on ? '<button class="hp-btn ghost small" data-hp="push-off">Turn off</button>' : '<button class="hp-btn small" data-hp="push-on">Turn on</button>'); })()}
      ${(() => { const T = s.travel || {}, L = [['golemio', 'Prague public transport', 'Live delays and cancellations for a train, bus or tram in a plan', '/help/golemio-key.html'], ['maps', 'Travel times', 'With traffic or by public transport, instead of a guess (Google Routes API)', '/help/maps-key.html'], ['flights', 'Flight status', 'Delays, terminal and gate for a flight in a plan (AeroDataBox)', '/help/flights-key.html']];
        return `<h3>Travel services for Plans</h3><p class="hp-muted">Optional, each with its own free key. Without one, Afloat guesses as before.</p>` + L.map(([k, t, sub, url]) => { const x = T[k] || {};
          return row(x.set ? 'on' : '', t, x.set ? `On (key …${esc(x.hint)}). ${sub}. <a href="${url}" target="_blank" rel="noopener">Help</a>` : `${sub}. <a href="${url}" target="_blank" rel="noopener">How to get a key (free, 5–15 minutes)</a>`, x.set && s.owner ? `<button class="hp-btn ghost small" data-hp="tkey-off" data-v="${k}">Remove</button>` : '')
            + (!x.set && s.owner ? `<div class="hp-add"><input type="password" id="hpT_${k}" autocomplete="off" placeholder="Paste the key" aria-label="${esc(t)} key"><button class="hp-btn small" data-hp="tkey" data-v="${k}">Save</button></div>` : ''); }).join('') + (s.owner ? '' : '<p class="hp-muted">The owner adds the keys.</p>'); })()}
      <h3>Household${s.house && s.house.name ? ': ' + esc(s.house.name) : ''}</h3>
      <div class="hp-chips">${(s.members || []).filter(Boolean).map((m, i) => `<span class="hp-chip">${esc(m)}${s.owner && i > 0 ? `<button data-hp="rm" data-v="${esc(m)}" aria-label="Remove ${esc(m)}">✕</button>` : ''}</span>`).join('')}</div>
      ${s.owner ? `<div class="hp-add"><input type="email" id="hpMember" placeholder="Google address to add" aria-label="Google address to add"><button class="hp-btn small" data-hp="add">Add</button></div>` : '<p class="hp-muted">Only the owner can add people.</p>'}
      ${s.owner ? `<h3>Who’s kept out</h3><p class="hp-muted">${s.gate ? 'Sign-in is household-only: anyone else is turned away by Google sign-in itself.' : 'Anyone not on the list above can sign in to Google, but sees nothing and can’t use anything.'} The household’s data, connections and Claude only work for the addresses above.</p>
        ${(s.away || []).length ? `<ul class="hp-away">${s.away.map(a => `<li><b>${esc(a.email)}</b> <span class="hp-muted">${new Date(a.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · turned away${a.how === 'app' ? '' : ' at ' + esc(a.how)}</span></li>`).join('')}</ul>` : '<p class="hp-muted">Nobody else has tried to get in.</p>'}` : ''}
      ${s.admin ? `<h3>Friends’ households</h3><p class="hp-muted">Invite a friend’s Google address: they can then sign in and start their own household. Each household sees only its own things and uses its own Claude key.</p>
        <div class="hp-add"><input type="email" id="hpInvite" placeholder="Friend’s Google address" aria-label="Friend’s Google address"><button class="hp-btn small" data-hp="invite">Invite</button></div>
        ${(s.invites || []).length ? `<ul class="hp-away">${s.invites.map(i => `<li><b>${esc(i.email)}</b> <span class="hp-muted">${i.usedAt ? 'started a household' : 'invited, not started yet'}</span>${i.usedAt ? '' : ` <button class="hp-btn ghost small" data-hp="uninvite" data-v="${esc(i.email)}">Take back</button>`}</li>`).join('')}</ul>` : ''}` : ''}
      ${s.owner ? `<h3>Bring back a copy</h3><p class="hp-muted">Puts back everything from a file made with Settings → Download a copy (or the old claude.ai export). Everything in the file replaces the same item here; anything not in the file stays as it is.</p><label class="hp-btn ghost small" style="text-align:center">Choose the file<input type="file" accept=".json,application/json" id="hpImport" hidden></label>` : ''}
      <button class="hp-btn ghost" data-hp="signout">Sign out</button>`, true);
  }
  async function setMembers(list) { try { const r = await call('setMembers', { emails: list }); toast('Household updated.'); status = { ...status, members: [status.members[0], ...r.emails] }; openConnections(); } catch (e) { toast(e.message); } }
  const callThen = async (name, data, msg) => { try { await call(name, data, 60000); if (msg) toast(msg); } catch (e) { toast(e.message); } openConnections(); };
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-hp]'); if (!b) return;
    const a = b.dataset.hp;
    if (a === 'google') return doSignIn();
    if (a === 'signout') { await F.auth.signOut(); location.reload(); }
    if (a === 'close') { close('hp-conn'); const f = onConnClose; onConnClose = null; if (f) f(); return; }
    if (a === 'trello') return connect('trello');
    if (a === 'google-cal') return connect('google');
    if (a === 'test-claude') return testClaude();
    if (a === 'push-on') return pushOn();
    if (a === 'push-off') return pushOff();
    if (a === 'off-trello' || a === 'off-google') { await call('disconnect', { what: a.slice(4) }).catch(err => toast(err.message)); return openConnections(); }
    if (a === 'add') { const v = ($('#hpMember') || {}).value || ''; if (v.trim()) setMembers([...(status.members || []).slice(1), v.trim()]); }
    if (a === 'rm') setMembers((status.members || []).slice(1).filter(x => x !== b.dataset.v));
    if (a === 'invite') { const v = (($('#hpInvite') || {}).value || '').trim(); if (v) callThen('invite', { email: v }, 'Invited ' + v + '.'); }
    if (a === 'uninvite') callThen('invite', { email: b.dataset.v, remove: true }, 'Invitation taken back.');
    if (a === 'key') { const v = (($('#hpKey') || {}).value || '').trim(); if (v) { toast('Checking the key with Anthropic…'); callThen('setClaudeKey', { key: v }, 'Claude is on for your household.'); } }
    if (a === 'key-off') callThen('setClaudeKey', { key: '' }, 'Claude key removed.');
    if (a === 'tkey') { const v = (($('#hpT_' + b.dataset.v) || {}).value || '').trim(); if (v) { toast('Checking the key…'); callThen('setTravelKey', { kind: b.dataset.v, key: v }, 'Saved. Plans use it from now on.'); } }
    if (a === 'tkey-off') callThen('setTravelKey', { kind: b.dataset.v, key: '' }, 'Key removed.');
    if (a === 'create') { const v = (($('#hpHouse') || {}).value || '').trim(); b.disabled = true;
      try { await call('createHousehold', { name: v }); location.reload(); } catch (err) { startHouse(err.message || 'That didn’t work. Try again.'); } }
  });

  /* ---------- one-time move from the claude.ai artifacts, and a household's own facts ----------
     File: { apps: { afloat: { "home/x": {...}, ... }, mealtime: { "recipes/r1": {...} } }, photos: { <id>: { type, data(base64) } } }
     "apps" replaces each item whole. "merge" (same shape) only adds or changes the fields it names and leaves the rest of
     the item as it is: how a household's facts come back without touching anything else (10 Nov 2026). */
  async function importData(file) {
    const j = JSON.parse(await file.text()), apps = j.apps || {};
    let n = 0, ph = 0;
    for (const [app, docs] of Object.entries(apps)) {
      const keys = Object.keys(docs);
      for (let i = 0; i < keys.length; i += 400) {
        const batch = F.fs.batch();
        for (const k of keys.slice(i, i + 400)) { batch.set(F.fs.doc(P(k, app)), clean(docs[k])); n++; }
        await batch.commit();
      }
    }
    for (const [app, docs] of Object.entries(j.merge || {})) {
      const batch = F.fs.batch();
      for (const [k, v] of Object.entries(docs).slice(0, 400)) { batch.set(F.fs.doc(P(k, app)), clean(v), { merge: true }); n++; }
      await batch.commit();
    }
    for (const [id, p] of Object.entries(j.photos || {})) {
      const bin = Uint8Array.from(atob(p.data), c => c.charCodeAt(0));
      await F.st.ref(assetPath(id)).put(new Blob([bin], { type: p.type || 'image/jpeg' }), { contentType: p.type || 'image/jpeg' }); ph++;
    }
    return { n, ph };
  }
  document.addEventListener('change', async e => {
    if (e.target.id !== 'hpImport' || !e.target.files[0]) return;
    toast('Moving your data in…');
    try { const r = await importData(e.target.files[0]); toast(`Done: ${r.n} items${r.ph ? ` and ${r.ph} photos` : ''}. Reloading…`); setTimeout(() => location.reload(), 1500); }
    catch (err) { toast('Import didn’t work: ' + (err.message || err)); }
  });

  /* ---------- the capabilities the apps ask for ---------- */
  const clean = d => JSON.parse(JSON.stringify(d === undefined ? null : d));
  const P = (p, app = APP) => `${(house && house.base) || ''}apps/${app}/${String(p).replace(/^\/+/, '')}`;
  function doc(ref) {
    /* patch: only the fields that changed, each replaced whole ([path segments, value] or [segments, , true] to delete);
       if the document isn't there (yet), the full copy is written instead */
    const patch = (pairs, full) => { const FS = firebase.firestore, args = [];
      for (const [segs, v, del] of pairs) args.push(new FS.FieldPath(...segs), del ? FS.FieldValue.delete() : clean(v));
      return args.length ? ref.update(...args).catch(e => { if (/not-found/.test((e && e.code) || '')) return ref.set(clean(full)); throw e; }) : Promise.resolve(); };
    return { id: ref.id, get: () => ref.get(), set: d => ref.set(clean(d)), update: d => ref.set(clean(d), { merge: true }), patch, delete: () => ref.delete(),
      onSnapshot: (cb, err, opts) => opts ? ref.onSnapshot(opts, cb, err) : ref.onSnapshot(cb, err) };
  }
  function query(q) {
    return { where: (a, o, v) => query(q.where(a, o, v)), orderBy: (a, d) => query(q.orderBy(a, d)), limit: n => query(q.limit(n)), get: () => q.get(), onSnapshot: (cb, err, opts) => opts ? q.onSnapshot(opts, cb, err) : q.onSnapshot(cb, err) };
  }
  /* db.app('mealtime') / db.app('afloat'): the other app's data, e.g. Meals reading the family profiles */
  const makeDb = (fs, app = APP) => ({
    doc: p => doc(fs.doc(P(p, app))),
    collection: c => { const ref = fs.collection(P(c, app)); return { ...query(ref), doc: id => doc(id ? ref.doc(id) : ref.doc()), add: d => ref.add(clean(d)) }; },
    app: name => makeDb(fs, name),
  });
  const makeMcp = () => {
    const m = {
      callTool: async (server, tool, args) => { try { return await call('tool', { server, tool, args: clean(args || {}) }); } catch (e) { throw errOf(e); } },
      listTools: async () => [{ server: 'Trello', kind: 'connector' }, { server: 'Google Calendar', kind: 'connector' }],
      server: async name => new Proxy({}, { get: (_, t) => a => m.callTool(name, t, a).then(r => r.payload) }),
    };
    return m;
  };
  /* plans planned together by several households (functions/together.js): together/<id>, readable by its members only; a phone
     changes only the plan's parts (each part whole, so two people editing different parts don't undo each other) */
  const makeTogether = fs => ({ email: String((me && me.email) || '').toLowerCase(),
    watch: (cb, bad) => fs.collection('together').where('members', 'array-contains', String(me.email).toLowerCase()).onSnapshot(q => cb(q.docs.map(d => ({ id: d.id, ...d.data() }))), bad || (e => console.warn('together', e))),
    save: (id, parts) => { const FS = firebase.firestore, args = []; for (const [k, v] of Object.entries(parts || {})) args.push(new FS.FieldPath('plan', k), v === undefined ? FS.FieldValue.delete() : clean(v));
      return args.length ? fs.doc('together/' + id).update(...args, 'at', Date.now()) : Promise.resolve(); } });
  /* friends between households: links between two people (functions/links.js); the server answers only the two in a link */
  /* travel services for Plans (functions/travel.js): departures, routes, flights, with the household's own keys; status says which are on */
  const makeTravel = () => ({ on: () => Object.fromEntries(Object.entries((status && status.travel) || {}).map(([k, v]) => [k, !!(v && v.set)])),
    call: async (action, data = {}) => { try { return await call('travel', { ...clean(data), action }, 30000); } catch (e) { throw errOf(e); } } });
  const makeLinks = () => ({ call: async (action, data = {}) => { try { return await call('links', { ...clean(data), action }, 60000); } catch (e) { throw errOf(e); } } });
  const b64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res({ type: blob.type || 'image/jpeg', data: String(r.result).split(',')[1] }); r.onerror = rej; r.readAsDataURL(blob); });
  function makeSample() {
    const ask = async (input, o = {}, json) => {
      if (o.signal && o.signal.aborted) throw Object.assign(new Error('Stopped.'), { code: 'aborted' });
      const images = o.images && o.images.length ? await Promise.all(o.images.map(b64)) : undefined;
      const p = call('sample', { input, json, modelTier: o.modelTier, images, feature: o.feature });
      const r = await (o.signal ? Promise.race([p, new Promise((_, rej) => o.signal.addEventListener('abort', () => rej(Object.assign(new Error('Stopped.'), { code: 'aborted' }))))]) : p).catch(e => { throw e.code === 'aborted' ? e : errOf(e); });
      if (o.onText) o.onText({ text: r.text, delta: r.text });
      return r;
    };
    const f = async (input, o) => { const r = await ask(input, o, false); return { text: r.text, truncated: r.truncated }; };
    f.json = async (input, o) => (await ask(input, o, true)).value;
    /* the apps read images.maxCount / mediaTypes / maxInputBytes: a bare `true` made Meals' "Add photos" throw (mediaTypes undefined) */
    f.limits = async () => ({ images: { maxCount: 8, mediaTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'], maxInputBytes: 2000000 } });
    return f;
  }
  const hex32 = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), x => x.toString(16).padStart(2, '0')).join('');
  /* the household's photos: the first household's at assets/<id>, others' at households/<hid>/assets/<id> */
  const assetBase = () => { if (house) return house.base || ''; try { return localStorage.getItem('afloat.base') || ''; } catch { return ''; } };
  const assetPath = id => assetBase() + 'assets/' + id;
  const blobUrl = id => `https://firebasestorage.googleapis.com/v0/b/${FB.storageBucket}/o/${encodeURIComponent(assetPath(id))}?alt=media`;
  const makeAssets = st => ({
    upload: async (blob, o = {}) => { const id = hex32(), type = o.type || blob.type || 'image/jpeg'; await st.ref(assetPath(id)).put(blob, { contentType: type }); return { id, url: blobUrl(id), sizeBytes: blob.size, contentType: type }; },
    delete: id => st.ref(assetPath(id)).delete().catch(() => {}),
    list: async () => ({ assets: [], usage: {} }),
  });
  const perms = { state: async n => (n ? 'granted' : { db: 'granted', mcp: 'granted', sample: 'granted' }), request: async () => ({ db: 'granted', mcp: 'granted', sample: 'granted' }), manage: () => new Promise(res => { onConnClose = res; openConnections(); }) };

  /* the installed app opens even offline */
  if ('serviceWorker' in navigator && location.protocol === 'https:' && window.top === window.self) navigator.serviceWorker.register(ROOT + 'sw.js').catch(() => {});

  const made = {};
  /* ---------- notifications on this phone (Firebase Cloud Messaging) ----------
     Needs the web-push key (FIREBASE_VAPID_KEY in GitHub) and PUSH=on for the server side. The phone's token goes to the
     server (private/<uid>.push); the app writes reminders to notify/<uid> and the server sends them when they're due. */
  const pushReady = () => !!(CFG.vapidKey && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window);
  async function pushOn() {
    try {
      if (!pushReady()) return toast('Notifications aren’t set up for Afloat yet.');
      const perm = await Notification.requestPermission(); if (perm !== 'granted') { toast('Notifications are blocked. Allow them for Afloat in Chrome’s site settings.'); return openConnections(); }
      await start(); await load(SDK + 'firebase-messaging-compat.js');
      const reg = await navigator.serviceWorker.register(ROOT + 'sw.js'), token = await F.app.messaging().getToken({ vapidKey: CFG.vapidKey, serviceWorkerRegistration: reg });
      await call('pushToken', { token, on: true }); try { localStorage.setItem('afloat.push', '1'); localStorage.setItem('afloat.pushToken', token); } catch {}
      toast('Notifications are on for this phone.');
    } catch (e) { console.warn(e); toast('Couldn’t turn notifications on: ' + (e.message || e.code)); }
    openConnections();
  }
  async function pushOff() {
    let t = ''; try { t = localStorage.getItem('afloat.pushToken') || ''; localStorage.removeItem('afloat.push'); } catch {}
    if (t) await call('pushToken', { token: t, on: false }).catch(() => {});
    toast('Notifications are off for this phone.'); openConnections();
  }
  window.claude = {
    platform: 'afloat-app',
    whoami: () => (me ? { uid: me.uid, email: me.email } : null),
    blobUrl,
    openConnections,
    /* which household this is: { hid, base, legacy, name } (null before sign-in) */
    household: () => house,
    use: name => {
      if (name === 'permissions') return Promise.resolve(perms);
      if (!['db', 'mcp', 'sample', 'assets', 'links', 'together', 'travel'].includes(name)) return Promise.resolve(null);
      return made[name] || (made[name] = start().then(f => name === 'db' ? makeDb(f.fs) : name === 'mcp' ? makeMcp() : name === 'sample' ? makeSample() : name === 'links' ? makeLinks() : name === 'together' ? makeTogether(f.fs) : name === 'travel' ? makeTravel() : makeAssets(f.st)));
    },
  };
})();
