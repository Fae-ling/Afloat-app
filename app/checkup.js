/* Afloat · app/checkup.js · Together: the twice-yearly relationship check-up.
   Plain script: shares one scope with the other app/*.js files (loaded in order by index.html). See CLAUDE.md. */
/* ---------- Together: the relationship check-up, twice a year (relationship module, part 2) ----------
   Inspired by the Marriage Checkup (Córdova et al., an annual assessment and feedback visit; lasting gains in intimacy and
   felt acceptance), done at home. Each of you answers on your own phone in about ten minutes: how you're doing on nine areas
   (1–5), up to two that matter most right now, what's strongest, what you'd love more of, anything worrying you.
   Your answers are hidden from the other until both of you have finished; then the summary shows strengths first,
   then what's worth talking about, and you pick one or two focus areas (with ✦ ideas from Claude). Due six months after the last.
   Data: home/checkup { round (date it began), 'ans:<name>': {round, areas {key: 1–5}, star [keys], strong, more, worry, done},
   focus {round, keys, ideas, at}, past [{round, date, areas {name: {...}}, focus}] newest first }. One field per person. */
const CU_AREAS = [['time', 'Time together, just the two of us'], ['close', 'Feeling close and understood'], ['fun', 'Fun and play'], ['talk', 'Talking things through'],
  ['team', 'Teamwork with the girls and the house'], ['load', 'A fair share of the mental load'], ['money', 'Handling money worries together'], ['touch', 'Affection and intimacy'], ['own', 'Room for each other’s own needs']];
const CU_LBL = Object.fromEntries(CU_AREAS);
const CU_SCALE = ['', 'Hard right now', 'Not great', 'Okay', 'Good', 'Really good'];
const cu = () => H('checkup');
const cuRound = () => cu().round || '';
const cuAns = n => { const a = cu()['ans:' + n]; return a && a.round === cuRound() ? a : null; };
const cuDone = n => !!(cuAns(n) && cuAns(n).done);
const cuBoth = () => { const p = relPair(); return !!p && !!cuRound() && p.every(cuDone); };
const cuLast = () => (cu().past || [])[0] || null;
const cuDueOn = () => { const L = cuLast(); return L ? calAdd(L.date, 182) : null; };
const cuDue = () => !cuRound() && (!cuDueOn() || cuDueOn() <= dk);
const cuSet = patch => mergeDoc('home/checkup', patch);
function cuMine() { return cuAns(me) || { round: cuRound(), areas: {}, star: [], strong: '', more: '', worry: '' }; }
function cuSave(patch) { const a = { ...cuMine(), ...patch, round: cuRound() }; cuSet({ ['ans:' + me]: a }); }
function cuStart() { if (!cuRound()) cuSet({ round: dk }); S.ui.cuOpen = true; render(true); }
/* the part of the Together page about the check-up */
function checkupSection() {
  const p = relPair(); if (!p || !meValid() || !p.includes(me)) return '';
  const o = partnerOf(me), r = cuRound(), L = cuLast(), F = cu().focus;
  if (!r) {
    const focus = F && L && F.round === L.round && (F.keys || []).length ? `<p class="small"><b>Your focus since ${fmtD(L.date)}:</b> ${F.keys.map(k => esc(CU_LBL[k] || k)).join(', ')}</p>` : '';
    return `<section class="card cu"><div class="sec-head"><h2>Relationship check-up</h2><span class="progress">${cuDue() ? 'Ready when you are' : `Next: ${fmtD(cuDueOn())}`}</span></div>${focus}
      <p class="muted small">Twice a year, about ten minutes each, on your own. Then a summary you read together: what’s strong, and one or two things to look after.</p>
      ${cuDue() || S.ui.cuEarly ? `<div class="actions"><button class="btn accent" data-act="cu-start">Start my answers</button></div>` : `<div class="actions"><button class="link" data-act="cu-early">Do one sooner</button></div>`}
      ${L ? cuCompare(L, null) : ''}</section>`;
  }
  if (!cuDone(me) && !S.ui.cuOpen) return `<section class="card cu"><div class="sec-head"><h2>Relationship check-up</h2><span class="progress">${cuDone(o) ? `${esc(o)} is done` : 'Started'}</span></div>
    <p class="muted small">About ten minutes, on your own. ${esc(o)} sees your answers only once you’ve both finished.</p><div class="actions"><button class="btn accent" data-act="cu-open">${cuAns(me) ? 'Carry on' : 'Start my answers'}</button></div></section>`;
  if (!cuDone(me)) return cuForm(o);
  if (!cuDone(o)) return `<section class="card cu"><div class="sec-head"><h2>Relationship check-up</h2><span class="progress">Waiting for ${esc(o)}</span></div>
    <p class="muted small">Your answers are in. The summary opens when ${esc(o)} has finished too; nothing of yours is shown before then.</p><div class="actions"><button class="link" data-act="cu-edit">Change my answers</button></div></section>`;
  return cuSummary(p, o);
}
function cuForm(o) {
  const a = cuMine(), star = a.star || [], n = CU_AREAS.filter(([k]) => a.areas[k]).length;
  return `<section class="card cu"><div class="sec-head"><h2>Your check-up answers</h2><span class="progress">${n} of ${CU_AREAS.length}</span></div>
    <p class="muted small">How are the two of you doing on each of these, as it feels to you right now? There are no wrong answers. Tap ☆ on up to two that matter most to you at the moment.</p>
    ${CU_AREAS.map(([k, l]) => `<div class="cu-area"><p class="small"><b>${esc(l)}</b> <button class="link cu-star" data-act="cu-star" data-k="${k}" aria-pressed="${star.includes(k)}" aria-label="Matters most to me">${star.includes(k) ? '★' : '☆'}</button></p>
      <div class="pills cu-scale">${[1, 2, 3, 4, 5].map(v => `<button type="button" class="pill${a.areas[k] === v ? ' on' : ''}" data-act="cu-rate" data-k="${k}" data-v="${v}" aria-label="${CU_SCALE[v]}">${v}</button>`).join('')}</div>${a.areas[k] ? `<span class="muted small">${CU_SCALE[a.areas[k]]}</span>` : ''}</div>`).join('')}
    <p class="muted small">1 hard right now · 3 okay · 5 really good</p>
    <label class="small">What’s strongest between us right now? <textarea data-act="cu-f" data-f="strong" id="cu_strong" rows="2">${esc(a.strong || '')}</textarea></label>
    <label class="small">One thing I’d love more of <textarea data-act="cu-f" data-f="more" id="cu_more" rows="2">${esc(a.more || '')}</textarea></label>
    <label class="small">Anything worrying me (optional) <textarea data-act="cu-f" data-f="worry" id="cu_worry" rows="2">${esc(a.worry || '')}</textarea></label>
    <div class="actions"><button class="btn accent" data-act="cu-done" ${n === CU_AREAS.length ? '' : 'disabled'}>I’m done</button><button class="link" data-act="cu-close">Save and finish later</button></div>
    ${n < CU_AREAS.length ? `<p class="muted small">Rate all ${CU_AREAS.length} to finish.</p>` : ''}</section>`;
}
/* strengths first, then what's worth talking about: low for either of you, far apart, or starred */
function cuSplit(A) {
  const ns = Object.keys(A), sc = k => ns.map(n => (A[n].areas || {})[k] || 0);
  const strong = [], talk = [];
  for (const [k] of CU_AREAS) { const s = sc(k), lo = Math.min(...s), hi = Math.max(...s), st = ns.some(n => (A[n].star || []).includes(k));
    if (lo >= 4) strong.push(k); else if (lo <= 2 || hi - lo >= 2 || st) talk.push({ k, lo, st, gap: hi - lo }); }
  talk.sort((a, b) => (b.st - a.st) || (a.lo - b.lo) || (b.gap - a.gap));
  return { strong, talk: talk.map(x => x.k) };
}
const cuRow = (A, k) => `<li><b>${esc(CU_LBL[k])}</b> <span class="muted small">${Object.entries(A).map(([n, a]) => `${n === me ? 'you' : esc(n)} ${(a.areas || {})[k] || '–'}${(a.star || []).includes(k) ? '★' : ''}`).join(' · ')}</span></li>`;
function cuSummary(p, o) {
  const A = Object.fromEntries(p.map(n => [n, cuAns(n)])), { strong, talk } = cuSplit(A), F = cu().focus && cu().focus.round === cuRound() ? cu().focus : { keys: [] }, fk = F.keys || [];
  const words = (f, lab) => p.map(n => A[n][f] ? `<li>${n === me ? 'You' : esc(n)}: ${esc(A[n][f])}</li>` : '').join('') ? `<p class="small"><b>${lab}</b></p><ul class="bf-list">${p.map(n => A[n][f] ? `<li>${n === me ? 'You' : esc(n)}: ${esc(A[n][f])}</li>` : '').join('')}</ul>` : '';
  return `<section class="card cu"><div class="sec-head"><h2>Your check-up, together</h2><span class="progress">${fmtD(cuRound())}</span></div>
    <p class="muted small">Read it side by side. Start with what’s good; it’s real, and it’s what you build on.</p>
    ${strong.length ? `<p class="small"><b>Going well for both of you</b></p><ul class="bf-list">${strong.map(k => cuRow(A, k)).join('')}</ul>` : ''}
    ${words('strong', 'What’s strongest')}
    ${talk.length ? `<p class="small"><b>Worth talking about</b> <span class="muted">· lower for one of you, far apart, or starred as mattering most</span></p><ul class="bf-list">${talk.map(k => cuRow(A, k)).join('')}</ul>` : '<p class="small">Nothing stands out as needing work. Lovely.</p>'}
    ${words('more', 'What you’d love more of')}${words('worry', 'Worries')}
    <p class="small"><b>Pick one or two to look after until the next check-up</b></p>
    <div class="pills">${(talk.length ? talk : CU_AREAS.map(x => x[0])).map(k => `<button type="button" class="pill${fk.includes(k) ? ' on' : ''}" data-act="cu-focus" data-k="${k}">${esc(CU_LBL[k])}</button>`).join('')}</div>
    ${fk.length && sample ? `<div class="actions"><button class="btn ghost" data-act="cu-ideas" ${S.ui.cuIdeas ? 'disabled' : ''}>${S.ui.cuIdeas ? 'Thinking…' : '✦ Small ideas for these'}</button></div>` : ''}
    ${(F.ideas || []).length ? `<ul class="bf-list">${F.ideas.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    ${cuLast() ? cuCompare(cuLast(), A) : ''}
    <div class="actions"><button class="btn accent" data-act="cu-close-round" ${fk.length ? '' : 'disabled'}>Save it; see you in six months</button></div>
    <p class="muted small">If something here feels too big to handle on your own, a couples therapist can help; that’s a strong move, not a failure.</p></section>`;
}
/* how this round compares with the last one (or the last one on its own) */
function cuCompare(L, A) {
  const avg = (X, k) => { const v = Object.values(X || {}).map(a => (a.areas || {})[k]).filter(Boolean); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
  const rows = CU_AREAS.map(([k, l]) => { const was = avg(L.areas, k), now = A ? avg(A, k) : null; if (was == null) return '';
    const d = now == null ? 0 : now - was; return `<li>${esc(l)} <span class="muted small">${A ? `${was.toFixed(1)} → ${now.toFixed(1)} ${d >= 0.5 ? '↑' : d <= -0.5 ? '↓' : ''}` : was.toFixed(1)}</span></li>`; }).join('');
  return rows ? `<details class="cu-cmp"><summary class="small">${A ? `Compared with ${fmtD(L.date)}` : `Last check-up, ${fmtD(L.date)} (average of you both)`}</summary><ul class="bf-list">${rows}</ul></details>` : '';
}
async function cuIdeas() {
  const F = cu().focus || {}, keys = F.keys || []; if (!sample || !keys.length) return; S.ui.cuIdeas = true; render(true);
  const A = Object.fromEntries((relPair() || []).map(n => [n, cuAns(n)]));
  const text = `A couple did a relationship check-up. ${houseFacts()}
They want to look after: ${keys.map(k => CU_LBL[k]).join('; ')}. What they'd love more of: ${Object.values(A).map(a => a && a.more).filter(Boolean).join('; ') || 'not said'}.
Suggest 4 small, concrete, low-effort practices for the next months that fit their life (at home, short, easy to remember, no grand gestures). One sentence each, warm and practical, no therapy jargon. Reply with only a JSON array of strings.`;
  try { const out = await askClaude(text, { feature: 'checkup' }); const arr = (Array.isArray(out) ? out : (out && out.items) || []).map(x => String(x).trim()).filter(Boolean).slice(0, 5);
    cuSet({ focus: { ...F, ideas: arr } }); } catch (e) { toast(claudeWhy(e)); }
  S.ui.cuIdeas = false; render(true);
}
function cuCloseRound() {
  const p = relPair(); if (!p || !cuBoth()) return;
  const A = Object.fromEntries(p.map(n => [n, cuAns(n)])), F = cu().focus || {};
  const past = [{ round: cuRound(), date: dk, areas: A, focus: F.keys || [] }, ...(cu().past || []).filter(x => x.round !== cuRound())].slice(0, 12);
  cuSet({ past, round: '' }); toast('Saved. The next check-up comes round in six months.');
}
/* reminders: due (Sunday evenings and date night), and when the other one has finished */
function cuNudges(sl) {
  const out = []; if (!relPair() || !meValid() || !relPair().includes(me) || sl === 'morning' || sl === 'night') return out;
  const o = partnerOf(me), d = dow();
  if (cuRound() && cuDone(o) && !cuDone(me) && sl === 'evening') out.push({ t: `${o} has done the check-up answers. Yours whenever you have ten quiet minutes.`, act: 'go-together' });
  else if (cuRound() && cuBoth() && sl === 'evening') out.push({ t: 'Your check-up summary is ready to read together.', act: 'go-together' });
  else if (cuDue() && sl === 'evening' && (d === 6 || d === relDay())) out.push({ t: 'Your twice-yearly relationship check-up is due: about ten minutes each.', act: 'go-together' });
  return out;
}
const cuFocusLine = () => { const F = cu().focus, L = cuLast(); return F && L && F.round === L.round && (F.keys || []).length ? F.keys.map(k => CU_LBL[k] || k).join(' and ') : ''; };
/* ---------- taps on this area's buttons (data-act), called from events.js; true = handled ---------- */
function tapCheckup(a, el, e, r) {
  switch (a) {
    case 'cu-start': cuStart(); return true;
    case 'cu-open': S.ui.cuOpen = true; render(true); return true;
    case 'cu-close': S.ui.cuOpen = false; render(true); return true;
    case 'cu-early': S.ui.cuEarly = true; render(true); return true;
    case 'cu-rate': cuSave({ areas: { ...(cuMine().areas || {}), [el.dataset.k]: +el.dataset.v } }); return true;
    case 'cu-star': { const st = cuMine().star || [], k = el.dataset.k; if (!st.includes(k) && st.length >= 2) { toast('Two at most: pick the ones that matter most right now.'); return true; } cuSave({ star: st.includes(k) ? st.filter(x => x !== k) : [...st, k] }); return true; }
    case 'cu-done': cuSave({ done: Date.now() }); S.ui.cuOpen = false; toast(cuDone(partnerOf(me)) ? 'Both done. Your summary is ready.' : `Saved. ${partnerOf(me)} sees nothing until they’ve finished too.`); scrollTo(0, 0); return true;
    case 'cu-edit': cuSave({ done: null }); S.ui.cuOpen = true; return true;
    case 'cu-focus': { const F = cu().focus && cu().focus.round === cuRound() ? cu().focus : { round: cuRound(), keys: [] }, ks = F.keys || [], k = el.dataset.k;
      if (!ks.includes(k) && ks.length >= 2) { toast('One or two is plenty.'); return true; } cuSet({ focus: { ...F, round: cuRound(), keys: ks.includes(k) ? ks.filter(x => x !== k) : [...ks, k], ideas: [] } }); return true; }
    case 'cu-ideas': cuIdeas(); return true;
    case 'cu-close-round': cuCloseRound(); return true;
  }
  return false;
}
