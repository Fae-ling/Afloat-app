/* Afloat · app/together.js · Together: weekly check-in and Who holds what (Fair Play).
   Plain script: shares one scope with the other app/*.js files (loaded in order by index.html). See CLAUDE.md. */
/* ---------- Together: the weekly check-in on date night (relationship module, part 1) ----------
   Shaped on Gottman's weekly "State of the Union" (appreciations, what's going well, one concern taken in turns as speaker
   and listener, one request each) and on regular check-ins helping couples where one or both have ADHD (CHADD).
   Kept short and warm, with at most one topic. Data on the week (weeks/<wk>), one field per person so writes never clash:
   'relAppr:<name>' [{id, text, at}] (jotted during the week, hidden from the other until the check-in starts),
   relStep (0 not started, 1–4 the steps, 5 done), relTalk {by, feel, about, need}, 'relReq:<name>' (one request each).
   home/relationship: history [{wk, date, req: {name: text}, talked}] newest first; parked [{id, text, by, at}]. */
const REL_STEPS = ['Before we start', 'Appreciations', 'What’s going well', 'One thing to talk about', 'One request each', 'Done'];
/* the couple: the two adults the household named when it switched Together on (home/household.couple), else the first two */
const relPair = () => { const a = adults(); if (a.length < 2 || !modOn('together')) return null; const c = (H('household').couple || []).filter(n => a.includes(n)); return c.length === 2 ? c : a.slice(0, 2); };
/* a household with two or more adults, Together never switched: asked once on Today whether there's a couple here.
   With three or more adults, they pick which two. "Not for us" switches it off; Settings can change it later. */
function coupleAsk() {
  if (ourHome() || !meValid() || typeof (H('household').modules || {}).together === 'boolean') return '';
  const a = adults(); if (a.length < 2) return '';
  const pick = S.ui.couple || (a.length === 2 ? a : (a.includes(me) ? [me] : []));
  return `<section class="card"><div class="sec-head"><h2>Is there a couple here?</h2></div>
    <p class="muted small">Afloat has a Together section for couples: a weekly check-in, a check-up twice a year and date night ideas, just for the two of you. People who live together aren’t always a couple, so it’s off unless you say so.</p>
    ${a.length > 2 ? `<p class="small">Which two?</p><div class="chips">${a.map(n => `<button class="whochip pick${pick.includes(n) ? ' on' : ''}" style="--c:${pColor(n)}" data-act="cp-pick" data-n="${esc(n)}" aria-pressed="${pick.includes(n)}">${esc(n)}</button>`).join('')}</div>` : ''}
    <div class="actions"><button class="btn accent" data-act="cp-yes" ${pick.length === 2 ? '' : 'disabled'}>${a.length === 2 ? `Yes, ${esc(a[0])} and ${esc(a[1])} are a couple` : 'Yes, these two'}</button><button class="btn ghost" data-act="cp-no">Not for us</button></div></section>`;
}
const relDay = () => { const W = H('week').evenings || {}, d = Object.keys(W).find(x => W[x] && W[x].type === 'date'); return d == null ? 2 : +d; };
const apprOf = n => S.week['relAppr:' + n] || [];
/* each person keeps their own place ('relStep:<name>'), so one of you tapping Next or Finish never pulls the other's
   phone along or closes it mid-sentence. The old shared relStep is still read for weeks begun before this. */
const relStepOf = n => { const v = S.week['relStep:' + n]; return v != null ? +v || 0 : +S.week.relStep || 0; };
const relStep = () => relStepOf(me);
/* done for you once you finished, or when the other finished and you haven't started (you did it on their phone) */
const relDone = () => !!S.week.relSkipped || relStep() >= 5 || (relStep() === 0 && (relPair() || []).some(n => relStepOf(n) >= 5));
const relReqOf = n => S.week['relReq:' + n] || '';
function relSet(patch) { S.week = { ...S.week, ...patch }; mergeDoc('weeks/' + wk, patch); render(true); }
const relLast = () => (H('relationship').history || []).find(x => x.wk !== wk) || null;
/* this week's entry, with the requests read live, so one added after the other finished shows straight away */
const relThis = () => { const T = (H('relationship').history || []).find(x => x.wk === wk); if (!T) return null;
  const pair = relPair() || []; return { ...T, req: { ...(T.req || {}), ...Object.fromEntries(pair.filter(n => relReqOf(n)).map(n => [n, relReqOf(n)])) } }; };
/* Each person's request is written to that week's own record ('relReq:<name>', one field each, so phones can't overwrite
   each other). The history copy in home/relationship is only a convenience: it is written from a fresh read of the shared
   doc (never from one phone's possibly stale copy), and last weeks' requests are read back from their week's record,
   so a request missing from the copy still shows, and the copy is repaired. */
function relHistWrite(k, patch) {
  const path = 'home/relationship';
  const up = list => { const mk = x => ({ ...x, ...patch, req: { ...(x.req || {}), ...(patch.req || {}) } });
    return list.some(x => x.wk === k) ? list.map(x => x.wk === k ? mk(x) : x) : [mk({ wk: k, date: dk }), ...list].slice(0, 30); };
  const R = H('relationship'); apply(path, { ...R, history: up(R.history || []) }); setTimeout(() => render(), 0);
  if (!db) { mem[path] = H('relationship'); return Promise.resolve(); }
  return q(path, async () => { const s = await db.doc(path).get(), cur = s.exists ? (s.data() || {}) : H('relationship');
    await db.doc(path).set({ ...cur, history: up(cur.history || []) }); exists[path] = true; });
}
const relPast = {}; /* week key -> that week's record, fetched once (null while on its way) */
function relPastLoad() {
  (H('relationship').history || []).filter(x => x.wk !== wk).slice(0, 6).forEach(x => {
    const p = 'weeks/' + x.wk; if (x.wk in relPast) return;
    if (!db) { relPast[x.wk] = mem[p] || {}; return; }
    relPast[x.wk] = null;
    db.doc(p).get().then(s => { relPast[x.wk] = s.exists ? (s.data() || {}) : {}; relRepair(); render(); }).catch(() => { relPast[x.wk] = {}; });
  });
}
const relReqFor = x => { const W = relPast[x.wk] || {}, req = { ...(x.req || {}) }; (relPair() || []).forEach(n => { if (W['relReq:' + n]) req[n] = W['relReq:' + n]; }); return req; };
function relRepair() {
  (H('relationship').history || []).filter(x => x.wk !== wk && relPast[x.wk]).forEach(x => { const nx = relReqFor(x);
    if (Object.keys(nx).some(n => nx[n] && nx[n] !== (x.req || {})[n])) relHistWrite(x.wk, { req: nx }); });
}
/* keep the saved history in step when a request is written or changed after finishing */
function relSyncHist() { const T = (H('relationship').history || []).find(x => x.wk === wk); if (!T) return; const nx = relThis();
  if (Object.keys(nx.req).some(n => nx.req[n] && nx.req[n] !== (T.req || {})[n])) relHistWrite(wk, { req: nx.req }); }
const relNav = (st, nextLabel = 'Next') => `<div class="actions"><button class="btn accent" data-act="rel-step" data-v="${st + 1}">${nextLabel}</button>${st > 1 ? `<button class="link" data-act="rel-step" data-v="${st - 1}">Back</button>` : ''}</div>`;
function apprList(n, mine) {
  const A = apprOf(n);
  if (!A.length) return `<p class="muted small">${mine && relStep() === 0 ? 'Nothing yet.' : `${mine ? 'Nothing written.' : `${esc(n)} hasn’t written any.`} Say one out loud now; it counts just as much.`}</p>`;
  return `<ul class="edit-list">${A.map(x => `<li><div class="txt">${esc(x.text)}</div>${mine && relStep() === 0 ? `<button class="chip x row-x" data-act="rel-appr-del" data-id="${x.id}" aria-label="Remove">✕</button>` : ''}</li>`).join('')}</ul>`;
}
/* ---------- who holds what (Fair Play, 6 Nov 2026): each household area has someone who thinks of it and plans it, and
   someone who does it. Seeing the thinking is the point; it isn't a score. Data: home/areas { list: [{id, name, think, act}] } ---------- */
/* the starting areas: kids' ones only with children, gigs only with that module ([name, needs]) */
const AREA_SEED = [['Kindergarten or school logistics (bags, notices, forms)', 'kids'], ['Doctors, dentists and vaccinations'], ['Babysitting and grandparents', 'kids'], ['Meal planning and the shopping lists'], ['Laundry'], ['Bills and money'], ['Birthdays and presents'], ['Pets'], ['The car'], ['Repairs around the house'], ['Weekend trips', 'trips'], ['Photo gigs and editing', 'gigs']];
function areasList() { const A = H('areas'); return A.list || AREA_SEED.map(([n, m], i) => ({ id: 'a' + i, name: n, think: '', act: '', m })).filter(x => !x.m || modOn(x.m)).map(({ m, ...x }) => x); }
function areasSave(list) { saveHome('areas', { ...H('areas'), list }); }
function areasCard() {
  const L = areasList(), ppl = adults(), who = [...ppl, 'both'];
  const count = n => L.filter(x => x.think === n).length, set = L.filter(x => x.think).length;
  const lbl = v => v === 'both' ? 'Both' : v ? esc(v) : '–';
  return `<section class="card areas"><div class="sec-head"><h2>Who holds what</h2><span class="progress">${set} of ${L.length}</span></div>
    <p class="muted small">For each area: who <b>thinks of it</b> (notices, plans, remembers) and who <b>does it</b>. The thinking is the invisible part. Not a score; something to look at together, maybe at a check-in.</p>
    ${set ? `<p class="small">${ppl.map(n => `${esc(n)} holds the thinking for ${count(n)}`).join(' · ')}${count('both') ? ` · shared ${count('both')}` : ''}.</p>` : ''}
    <details${COL['areas'] ? ' open' : ''} data-grp="areas"><summary class="small">${set ? 'Change' : 'Fill it in'} (${L.length} areas)</summary>
    <ul class="areas-l">${L.map(x => `<li><b>${esc(x.name)}</b><div class="area-row"><span class="small muted">Thinks:</span>${who.map(v => `<button class="tiny${x.think === v ? ' on' : ''}" data-act="area-set" data-id="${x.id}" data-f="think" data-v="${esc(v)}">${lbl(v)}</button>`).join('')}</div>
      <div class="area-row"><span class="small muted">Does:</span>${who.map(v => `<button class="tiny${x.act === v ? ' on' : ''}" data-act="area-set" data-id="${x.id}" data-f="act" data-v="${esc(v)}">${lbl(v)}</button>`).join('')}<button class="link small" data-act="area-del" data-id="${x.id}" aria-label="Remove ${esc(x.name)}">remove</button></div></li>`).join('')}</ul>
    <form class="addform" data-form="area-add"><input type="text" name="text" placeholder="Another area" required aria-label="Another area"><button class="btn" type="submit">Add</button></form></details></section>`;
}
/* ---------- taps on this area's buttons (data-act), called from events.js; true = handled ---------- */
function tapTogether(a, el, e, r) {
  switch (a) {
    case 'cp-pick': { const n = el.dataset.n, cur = S.ui.couple || (adults().includes(me) ? [me] : []); S.ui.couple = cur.includes(n) ? cur.filter(x => x !== n) : [...cur, n].slice(-2); render(true); return true; }
    case 'cp-yes': { const a = adults(), c = a.length === 2 ? a : (S.ui.couple || []); if (c.length !== 2) return true; const o = H('household'); saveHome('household', { ...o, couple: c, modules: { ...(o.modules || {}), together: true } }); S.ui.couple = null; toast('Together is on: Us → Together.'); return true; }
    case 'cp-no': { const o = H('household'); saveHome('household', { ...o, modules: { ...(o.modules || {}), together: false } }); toast('Together stays off. Settings can switch it on later.'); return true; }
    case 'area-set': { const L = areasList().map(x => x.id === el.dataset.id ? { ...x, [el.dataset.f]: x[el.dataset.f] === el.dataset.v ? '' : el.dataset.v } : x); areasSave(L); return true; }
    case 'area-del': areasSave(areasList().filter(x => x.id !== el.dataset.id)); return true;
    case 'rel-appr-del': relSet({ ['relAppr:' + me]: apprOf(me).filter(x => x.id !== el.dataset.id) }); return true;
  }
  return false;
}
