/* Afloat · app/links.js · Friends between households: a person-to-person link with a friend in another Afloat household,
   when they're free (blocks only, or titles for close partners) and "Want to come?" asks. The server (functions/links.js) only
   ever answers the two people in a link, so nothing here is saved in the household's data: one adult's links are never the other's.
   Plain script: shares one scope with the other app/*.js files (loaded in order by index.html). See CLAUDE.md. */
S.lk = { off: false, list: [], status: '', at: 0, busy: {} };
let lkSvc = null;
const LK_EVERY = 5 * 60e3;
const lkMin = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const lkToMin = t => { const m = /^(\d\d):(\d\d)$/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : null; };
const lkDay = k => new Date(k + 'T12:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
/* the friend profile a link belongs to: the one chosen when connecting, else the one with that email */
const lkFriend = l => friendsL().find(f => f.id === l.prof) || friendsL().find(f => [f.email, f.afloatEmail].map(x => String(x || '').toLowerCase()).includes(l.peer)) || null;
const lkName = l => (lkFriend(l) || {}).name || l.peerName || l.peer;
const lkOf = f => (S.lk.list || []).find(l => l.prof === f.id) || (S.lk.list || []).find(l => !l.prof && [f.email, f.afloatEmail].map(x => String(x || '').toLowerCase()).includes(l.peer)) || null;

async function lkCall(action, data) {
  if (!lkSvc) lkSvc = window.claude && window.claude.use ? await window.claude.use('links') : null;
  if (!lkSvc) { S.lk.off = true; throw Object.assign(new Error('Connecting with friends isn’t available here.'), { code: 'off' }); }
  return lkSvc.call(action, { ...data, me });
}
async function lkLoad() {
  if (!meValid() || S.lk.off || S.lk.status === 'loading') return;
  S.lk.status = 'loading';
  try { const r = await lkCall('list'); S.lk = { ...S.lk, list: r.links || [], status: 'ok', at: Date.now(), err: null }; }
  catch (e) { S.lk = { ...S.lk, status: e.code === 'off' ? 'off' : 'error', at: Date.now(), err: e.message }; }
  render();
}
/* called from refreshOutside (store.js): every 5 minutes while open, and straight away when you come back */
function lkRefresh(back) { if (!S.lk.off && meValid() && Date.now() - (S.lk.at || 0) > (back ? 60e3 : LK_EVERY)) lkLoad(); }
/* after any change: the server's answer for that link replaces ours */
function lkPut(link) { if (!link) return; const L = S.lk.list.filter(x => x.id !== link.id); S.lk.list = link.status ? [...L, link] : L; }
async function lkDo(action, data, msg) {
  try { const r = await lkCall(action, data); if (r.gone) S.lk.list = S.lk.list.filter(x => x.id !== data.id); else lkPut(r.link); if (msg) toast(msg); render(true); return r; }
  catch (e) { toast(e.message || 'That didn’t work.'); render(true); return null; }
}

/* ---------- the switches: what I let the other person do ---------- */
const LK_SW = [['busy', 'See when I’m free', 'Only when you’re busy, never what it is.'], ['titles', 'Also see my events’ titles', 'For close partners. Health, private and Discreet events stay untitled.'], ['come', 'Ask me to things', '“Want to come?” lands on your Today.']];
function lkSwitches(pre, s, live) {
  return `<div class="lk-sw">${LK_SW.map(([k, label, sub]) => k === 'titles' && !s.busy && live ? '' : `<label class="small lk-row"><input type="checkbox" ${live ? `data-act="lk-share" data-id="${esc(live)}" data-k="${k}"` : `id="${pre}_${k}"`}${s[k] ? ' checked' : ''}> <span><b>${label}</b><br><span class="muted">${sub}</span></span></label>`).join('')}</div>`;
}
const lkRead = pre => Object.fromEntries(LK_SW.map(([k]) => [k, !!(document.getElementById(`${pre}_${k}`) || {}).checked]));

/* ---------- on a friend's profile in Us → Family ---------- */
function lkBlock(f) {
  if (S.lk.off || !meValid()) return '';
  const l = lkOf(f), nm = esc(f.name);
  let h = '';
  if (!l) {
    if (S.ui.lkNew === f.id) {
      const res = S.ui.lkRes && S.ui.lkRes.fid === f.id ? S.ui.lkRes : null;
      h = `<div class="lk-box"><p class="small"><b>Connect with ${nm} in Afloat.</b> Only works if ${nm} uses Afloat too. Only you and ${nm} see this connection: not the rest of your household, not theirs.</p>
        <label class="small fr-f">${nm}’s Afloat address (the Google account they sign in with)<input type="email" id="lkEmail" value="${esc(f.afloatEmail || f.email || '')}" autocomplete="off"></label>
        <p class="small muted">What you let ${nm} do (all can change later):</p>${lkSwitches('lkN', { busy: false, titles: false, come: false })}
        ${res ? `<p class="small">${esc(res.email)} isn’t in Afloat yet.${res.canInvite ? '' : ' Only the person who runs this Afloat can invite a new household.'}</p>${res.canInvite ? `<button class="btn ghost small" data-act="lk-invite" data-id="${f.id}">Invite them to start a household</button>` : ''}` : ''}
        <div class="actions"><button class="btn small" data-act="lk-send" data-id="${f.id}">Send</button><button class="link" data-act="lk-new" data-id="">Cancel</button></div></div>`;
    } else h = `<button class="tiny" data-act="lk-new" data-id="${f.id}">Connect in Afloat</button>`;
    return `<div class="lk">${h}</div>`;
  }
  if (l.status === 'asked' && l.mine === 'asked') return `<div class="lk"><p class="small muted">Waiting for ${nm} to say yes in Afloat.</p><button class="link small" data-act="lk-unlink" data-id="${esc(l.id)}">Take it back</button></div>`;
  if (l.status === 'asked') return `<div class="lk"><p class="small"><b>${nm} wants to connect in Afloat.</b> Answer on Today.</p></div>`;
  const t = l.theirs, theyShare = [t.busy && (t.titles ? 'when they’re busy, with titles' : 'when they’re free'), t.come && 'asking them to things'].filter(Boolean);
  h = `<p class="small"><span class="badge ok">Connected in Afloat</span> <span class="muted">Only you see this.</span></p>
    <p class="small">${nm} shares with you: ${theyShare.length ? theyShare.join(', ') : 'nothing yet'}.</p>
    <div class="actions">${t.busy ? `<button class="btn small" data-act="lk-free" data-id="${esc(l.id)}">When is ${nm} free?</button>` : ''}${t.come ? `<button class="btn ghost small" data-act="lk-ask" data-id="${esc(l.id)}">Want to come?</button>` : ''}</div>
    ${S.ui.lkFree === l.id ? lkFreeView(l) : ''}${S.ui.lkAsk && S.ui.lkAsk.id === l.id ? lkAskForm(l) : ''}
    <details class="lk-more"><summary class="small">What you share with ${nm}</summary>${lkSwitches('', l.share, l.id)}<button class="link small" data-act="lk-unlink" data-id="${esc(l.id)}">Disconnect</button></details>`;
  return `<div class="lk">${h}</div>`;
}

/* ---------- when are they free: the next weeks, 08:00–23:00 ---------- */
/* my own busy times that day (events I'm on), so a shared free time can say "you're free too" */
function lkMine(k) {
  try { return eventsOn(k).filter(e => !e.allDay && e.start && !e.free && (e.who || []).includes(me)).map(e => ({ s: lkToMin(e.start), e: e.end && e.end > e.start ? lkToMin(e.end) : 1440 })).filter(b => b.s != null); }
  catch { return []; }
}
function lkGaps(blocks, from, to, min = 45) {
  const out = []; let t = from;
  for (const b of [...blocks].sort((x, y) => x.s - y.s)) { if (b.s - t >= min) out.push({ s: t, e: Math.min(b.s, to) }); t = Math.max(t, b.e); }
  if (to - t >= min) out.push({ s: t, e: to });
  return out.filter(g => g.e - g.s >= min);
}
function lkFreeView(l) {
  const B = S.lk.busy[l.id];
  if (!B || B.status === 'loading') return `<p class="small muted lk-free">Asking ${esc(lkName(l))}’s calendar…</p>`;
  if (B.status === 'error') return `<p class="small lk-free">${esc(B.err || 'Couldn’t get their free times.')} <button class="link small" data-act="lk-free" data-id="${esc(l.id)}">Try again</button></p>`;
  const now = new Date(), nowM = now.getHours() * 60 + now.getMinutes(), keys = Object.keys(B.days).sort(), show = S.ui.lkAll ? keys : keys.slice(0, 14);
  const rows = show.map(k => {
    const from = k === B.today ? Math.max(B.from, Math.ceil((nowM + 15) / 15) * 15) : B.from;
    if (from >= B.to) return '';
    const gaps = lkGaps(B.days[k], from, B.to), mine = lkMine(k);
    const busy = B.titles ? B.days[k].filter(b => b.t).map(b => `${esc(b.t)} ${lkMin(b.s)}–${lkMin(b.e)}`) : [];
    const we = [0, 6].includes(new Date(k + 'T12:00').getDay());
    return `<li class="${we ? 'we' : ''}"><b>${lkDay(k)}</b> ${gaps.length ? gaps.map(g => { const both = !mine.some(m => m.s < g.e && m.e > g.s);
      return `${l.theirs.come ? `<button class="chip${both ? ' ok' : ''}" data-act="lk-ask" data-id="${esc(l.id)}" data-d="${k}" data-s="${lkMin(g.s)}" data-e="${lkMin(g.e)}">` : `<span class="chip${both ? ' ok' : ''}">`}${lkMin(g.s)}–${lkMin(g.e)}${both ? ' ✓' : ''}${l.theirs.come ? '</button>' : '</span>'}`; }).join(' ') : '<span class="muted small">busy all day</span>'}
      ${busy.length ? `<div class="muted small">Busy: ${busy.join(' · ')}</div>` : ''}</li>`;
  }).join('');
  return `<div class="lk-free"><p class="small muted">${esc(lkName(l))}’s free times, 08:00–23:00. ✓ = you’re free too.${l.theirs.come ? ' Tap a time to ask.' : ''}</p><ul class="lk-days">${rows}</ul>
    <div class="actions">${S.ui.lkAll ? '' : `<button class="link small" data-act="lk-all">Show the whole month</button>`}<button class="link small" data-act="lk-free" data-id="">Close</button></div></div>`;
}

/* ---------- "Want to come?" ---------- */
function lkAskForm(l) {
  const a = S.ui.lkAsk, nm = esc(lkName(l));
  return `<div class="lk-box"><p class="small"><b>Ask ${nm}</b>: it lands on their Today, and they say yes or not this time.</p>
    <label class="small fr-f">What<input type="text" id="lkT" maxlength="80" placeholder="e.g. Cinema, a walk, dinner at ours" value="${esc(a.title || '')}"></label>
    <div class="row-2"><label class="small fr-f">Day<input type="date" id="lkD" value="${esc(a.date || tKey())}" min="${esc(realToday())}"></label><label class="small fr-f">From<input type="time" id="lkS" value="${esc(a.start || '')}"></label><label class="small fr-f">To<input type="time" id="lkE" value="${esc(a.end || '')}"></label></div>
    <label class="small fr-f">Where (optional)<input type="text" id="lkP" maxlength="120"></label>
    <label class="small fr-f">A note (optional)<input type="text" id="lkNote" maxlength="300"></label>
    <div class="actions"><button class="btn small" data-act="lk-ask-send" data-id="${esc(l.id)}">Send</button><button class="link" data-act="lk-ask" data-id="">Cancel</button></div></div>`;
}
const lkWhen = x => `${lkDay(x.date)}${x.start ? ' ' + x.start + (x.end ? '–' + x.end : '') : ''}${x.place ? ' · ' + esc(x.place) : ''}`;

/* ---------- Today: only when something waits for me ---------- */
function lkCard() {
  if (S.lk.off || !meValid() || !(S.lk.list || []).length) return '';
  const items = [];
  for (const l of S.lk.list) {
    const nm = esc(lkName(l));
    if (l.status === 'asked' && l.mine === 'answering') {
      const f = lkFriend(l);
      items.push(`<div class="lk-item"><p><b>${nm}</b> wants to connect in Afloat. Only the two of you will see it.</p>
        ${f ? '' : `<label class="small fr-f">Who is this in your Family?<select id="lkProf_${esc(l.id)}"><option value="">Add ${nm} as a new friend</option>${friendsL().map(x => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</select></label>`}
        <p class="small muted">What you let ${nm} do (all can change later in Family):</p>${lkSwitches('lkA_' + l.id, { busy: false, titles: false, come: false })}
        <div class="actions"><button class="btn small" data-act="lk-yes" data-id="${esc(l.id)}">Connect</button><button class="btn ghost small" data-act="lk-no" data-id="${esc(l.id)}">Not now</button></div></div>`);
    }
    for (const x of l.asks || []) {
      if (!x.fromMe && x.status === 'open') items.push(`<div class="lk-item"><p><b>${nm}:</b> want to come? <b>${esc(x.title)}</b><br><span class="small">${lkWhen(x)}</span>${x.note ? `<br><span class="small muted">${esc(x.note)}</span>` : ''}</p>
        <div class="actions"><button class="btn small" data-act="lk-reply" data-id="${esc(l.id)}" data-x="${esc(x.id)}" data-yes="1">Yes</button><button class="btn ghost small" data-act="lk-reply" data-id="${esc(l.id)}" data-x="${esc(x.id)}">Not this time</button></div></div>`);
      if (x.fromMe && x.status === 'yes') items.push(`<div class="lk-item"><p><b>${nm} is coming:</b> ${esc(x.title)}<br><span class="small">${lkWhen(x)}</span></p>
        <div class="actions"><button class="btn small" data-act="lk-cal" data-id="${esc(l.id)}" data-x="${esc(x.id)}">Put it in the calendar</button><button class="link small" data-act="lk-done" data-id="${esc(l.id)}" data-x="${esc(x.id)}">Done</button></div></div>`);
      if (x.fromMe && x.status === 'no') items.push(`<div class="lk-item"><p><b>${nm}</b> can’t make it this time: ${esc(x.title)}</p><div class="actions"><button class="link small" data-act="lk-done" data-id="${esc(l.id)}" data-x="${esc(x.id)}">OK</button></div></div>`);
    }
  }
  return items.length ? `<section class="card lk-card"><div class="sec-head"><h2>From friends</h2></div>${items.join('')}</section>` : '';
}

/* ---------- taps on this area's buttons (data-act), called from events.js; true = handled ---------- */
function tapLinks(a, el) {
  const id = el.dataset.id, val = i => String((document.getElementById(i) || {}).value || '').trim();
  switch (a) {
    case 'lk-new': S.ui.lkNew = id || null; S.ui.lkRes = null; render(true); return true;
    case 'lk-send': {
      const f = friendsL().find(x => x.id === id), em = val('lkEmail').toLowerCase(); if (!f) return true;
      if (!em) { toast('Type their address first.'); return true; }
      lkDo('request', { email: em, prof: f.id, share: lkRead('lkN') }).then(r => {
        if (!r) return;
        if (r.notHere) { S.ui.lkRes = { fid: f.id, email: em, canInvite: r.canInvite }; render(true); return; }
        if (em !== String(f.email || '').toLowerCase() && em !== String(f.afloatEmail || '').toLowerCase()) saveHome('profiles', { ...H('profiles'), friends: friendsL().map(x => x.id === f.id ? { ...x, afloatEmail: em } : x) });
        S.ui.lkNew = null; S.ui.lkRes = null; toast(r.already ? `You’re already connected with ${f.name}, or waiting.` : `Sent. ${f.name} will see it on their Today.`); render(true);
      });
      return true;
    }
    case 'lk-invite': { const r = S.ui.lkRes; if (r) lkDo('invite', { email: r.email }).then(x => { if (x) { toast(`Invited. ${r.email} can now sign in to Afloat and start a household; then send this again.`); S.ui.lkRes = null; render(true); } }); return true; }
    case 'lk-yes': case 'lk-no': {
      const l = S.lk.list.find(x => x.id === id); if (!l) return true;
      if (a === 'lk-no') { lkDo('answer', { id, yes: false }, 'Okay. Nothing was shared.'); return true; }
      let f = lkFriend(l); const pick = val('lkProf_' + id);
      if (!f && pick) f = friendsL().find(x => x.id === pick) || null;
      if (!f) { addFriend(l.peerName || l.peer.split('@')[0], '', l.peer); f = friendsL().find(x => x.name === (l.peerName || l.peer.split('@')[0])) || null; }
      if (f && ![f.email, f.afloatEmail].map(x => String(x || '').toLowerCase()).includes(l.peer)) saveHome('profiles', { ...H('profiles'), friends: friendsL().map(x => x.id === f.id ? { ...x, afloatEmail: l.peer } : x) });
      lkDo('answer', { id, yes: true, prof: f ? f.id : null, share: lkRead('lkA_' + id) }, `Connected with ${f ? f.name : lkName(l)}.`);
      return true;
    }
    case 'lk-share': {
      const l = S.lk.list.find(x => x.id === id); if (!l) return true;
      const s = { ...l.share, [el.dataset.k]: !!el.checked }; if (!s.busy) s.titles = false;
      lkPut({ ...l, share: s }); lkDo('share', { id, share: s }); return true;
    }
    case 'lk-unlink': { const l = S.lk.list.find(x => x.id === id); if (l && l.status === 'on' && !confirm(`Disconnect from ${lkName(l)}? They’ll stop seeing what you share, and you what they share.`)) return true; lkDo('unlink', { id }, 'Disconnected.'); return true; }
    case 'lk-free': {
      S.ui.lkFree = id || null; S.ui.lkAll = false; S.ui.lkAsk = null; if (!id) { render(true); return true; }
      S.lk.busy[id] = { status: 'loading' }; render(true);
      lkCall('busy', { id }).then(r => { S.lk.busy[id] = { ...r, status: 'ok', at: Date.now() }; }, e => { S.lk.busy[id] = { status: 'error', err: e.message }; }).then(() => render(true));
      return true;
    }
    case 'lk-all': S.ui.lkAll = true; render(true); return true;
    case 'lk-ask': S.ui.lkAsk = id ? { id, date: el.dataset.d || '', start: el.dataset.s || '', end: el.dataset.e || '' } : null; render(true); setTimeout(() => { const t = document.getElementById('lkT'); if (t) t.focus(); }, 50); return true;
    case 'lk-ask-send': {
      const title = val('lkT'); if (!title) { toast('Say what it is.'); return true; }
      lkDo('ask', { id, title, date: val('lkD'), start: val('lkS'), end: val('lkE'), place: val('lkP'), note: val('lkNote') }).then(r => { if (r) { const l = S.lk.list.find(x => x.id === id); S.ui.lkAsk = null; toast(`Asked. ${l ? lkName(l) : 'They'} will see it on their Today.`); render(true); } });
      return true;
    }
    case 'lk-reply': lkDo('reply', { id, ask: el.dataset.x, yes: !!el.dataset.yes }, el.dataset.yes ? 'Said yes. They’ll put it in the calendar and invite you.' : 'Said not this time.'); return true;
    case 'lk-done': lkDo('done', { id, ask: el.dataset.x }); return true;
    case 'lk-cal': {
      const l = S.lk.list.find(y => y.id === id), x = l && (l.asks || []).find(y => y.id === el.dataset.x); if (!x) return true;
      const f = lkFriend(l);
      newEv({ title: x.title, kind: 'family', who: [me, ...(f ? [f.name] : [])], date: x.date, start: x.start, end: x.end, place: x.place, notes: x.note || '' });
      lkDo('done', { id, ask: x.id });
      location.hash = 'calendar'; render(true); scrollTo(0, 0);
      toast(f && f.email ? `Check it and Save: ${f.name} gets a Google invitation.` : 'Check it and Save.');
      return true;
    }
  }
  return false;
}
