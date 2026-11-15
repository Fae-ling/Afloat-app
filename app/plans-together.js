/* Afloat · app/plans-together.js · Planning together with another household (11 Nov 2026).
   Plain script: shares one scope with the other app/*.js files (loaded in order by index.html). See CLAUDE.md.
   Everyone in a household already sees its plans (home/planner). To plan with a friend in ANOTHER household, the plan moves to
   together/<id> (functions/together.js): only people you're connected with in Afloat (links.js) can be invited, they say yes or
   not now, and joining brings their household in. Every phone then reads and writes that one plan directly (firestore.rules lets
   members change only the plan), so ticks and new items show on everyone's phones at once.
   Inside the shared plan each household keeps its own "who's going" (plan.whoBy[hid]); `by` on a step or a thing to take says
   who does it or brings it ("who brings what"), so Today only shows you your own and the unclaimed ones.
   The rest of Plans doesn't need to know: pxAll(), pxGet() and pxSave() (plans.js) include these plans through tgPlans() and tgSave(). */
S.tg = { off: false, docs: {}, invites: [], at: 0, started: false };
let tgSvc = null, tgStop = null;
const tgLow = e => String(e || '').trim().toLowerCase();
const tgEmail = () => tgLow(tgSvc && tgSvc.email);
const tgHid = () => { try { const h = window.claude && typeof window.claude.household === 'function' ? window.claude.household() : null; return (h && h.hid) || 'legacy'; } catch { return 'legacy'; } };
/* a shared plan as the rest of Plans sees it: `by` is my household's lead (whose phone does the bookkeeping), `who` is my household's own */
function tgPlan(T) {
  const P = T.plan || {}, hid = tgHid(), H = (T.houses || {})[hid] || {}, names = T.names || {}, lead = names[tgLow(H.lead)] || P.by || '';
  return { ...P, id: T.id, by: tgLow(H.lead) === tgEmail() ? me : lead, who: ((P.whoBy || {})[hid] || [tgLow(H.lead) === tgEmail() ? me : lead]).filter(Boolean),
    shared: { owner: T.owner, names: Object.values(names).filter(Boolean), houses: Object.keys(T.houses || {}).length, invited: Object.keys(T.invited || {}) } };
}
const tgPlans = () => Object.values(S.tg.docs).map(tgPlan);
/* a change to a shared plan: only the parts that changed, on everyone's phones; `who` is this household's own */
function tgSave(id, patch) {
  const T = S.tg.docs[id]; if (!T) return;
  const parts = { ...patch }; delete parts.id; delete parts.shared; delete parts.by;
  if ('who' in parts) { parts.whoBy = { ...((T.plan || {}).whoBy || {}), [tgHid()]: parts.who }; delete parts.who; }
  S.tg.docs[id] = { ...T, plan: { ...(T.plan || {}), ...parts } };
  if (tgSvc) tgSvc.save(id, parts).catch(e => { console.warn('together save', e); toast('That didn’t reach the shared plan. Check the connection.'); });
  render(true);
}
async function tgStart() {
  if (S.tg.started || S.tg.off) return; S.tg.started = true;
  try { tgSvc = window.claude && window.claude.use ? await window.claude.use('together') : null; } catch { tgSvc = null; }
  if (!tgSvc || !tgSvc.watch) { S.tg.off = true; return; }
  tgStop = tgSvc.watch(list => { S.tg.docs = Object.fromEntries(list.map(T => [T.id, T])); pxSync(); render(); });
}
async function tgLoad() {
  if (S.tg.off || !meValid() || S.lk.off) return; tgStart();
  try { const r = await lkCall('plan-list'); S.tg.invites = r.invites || []; S.tg.at = Date.now(); render(); } catch (e) { if (e.code === 'off') S.tg.off = true; }
}
/* with the friends' links: every 5 minutes while open, straight away when you come back */
function tgRefresh(back) { if (!S.tg.off && meValid() && Date.now() - (S.tg.at || 0) > (back ? 60e3 : LK_EVERY)) tgLoad(); }
/* the friends this plan could be planned with: connected in Afloat (the server checks again) */
const tgFriends = () => (S.lk.list || []).filter(l => l.status === 'on');
async function tgShare(pid, linkId) {
  const p = pxGet(pid); if (!p) return null;
  try {
    if (p.shared) { await lkCall('plan-share', { id: pid, link: linkId }); toast('Asked. It shows on their Today.'); tgLoad(); return pid; }
    const { shared, by, who, ...rest } = p, plan = { ...rest, by: me, whoBy: { [tgHid()]: who || [me] } };
    const r = await lkCall('plan-share', { plan, link: linkId }); if (!r || !r.id) return null;
    /* until everyone's phones have it, keep it here so it doesn't blink away */
    S.tg.docs[r.id] = { id: r.id, plan: { ...plan, id: r.id }, owner: tgEmail(), members: [tgEmail()], houses: { [tgHid()]: { lead: tgEmail(), people: [tgEmail()] } }, names: { [tgEmail()]: me }, invited: Object.fromEntries((r.invited || []).map(e => [e, {}])) };
    const D = pxDoc(), plans = { ...(D.plans || {}) }; delete plans[pid];
    saveHome('planner', { ...D, plans, moved: { ...(D.moved || {}), [pid]: r.id } });
    if (S.ui.pxOpen === pid) S.ui.pxOpen = r.id;
    toast('Asked. Once they say yes, you plan it together.'); render(true); tgStart(); return r.id;
  } catch (e) { toast(e.message || 'That didn’t work.'); return null; }
}
async function tgAnswer(id, yes) {
  try { await lkCall('plan-answer', { id, yes }); S.tg.invites = S.tg.invites.filter(x => x.id !== id); if (yes) { S.ui.pxOpen = id; if (S.view !== 'plans') location.hash = 'plans'; toast('You’re in. Everything you add shows on their phones too.'); } render(true); tgStart(); }
  catch (e) { toast(e.message || 'That didn’t work.'); }
}
async function tgLeave(id) {
  try { await lkCall('plan-leave', { id }); delete S.tg.docs[id]; S.ui.pxOpen = null; toast('Left. The others keep their plan.'); render(true); }
  catch (e) { toast(e.message || 'That didn’t work.'); }
}
/* ---------- on screen ---------- */
function tgInvitesHtml() {
  const L = S.tg.invites || []; if (!L.length) return '';
  return `<section class="card px-card tg-inv"><div class="sec-head"><h3>Do it together?</h3></div><ul class="bf-list">${L.map(x => `<li><p class="small"><b>${esc(x.from || 'A friend')}</b> asks you to plan <b>${esc(x.title)}</b> with them${x.start ? ` · ${esc(fmtD(x.start))}${x.end && x.end !== x.start ? ' to ' + esc(fmtD(x.end)) : ''}` : ''}${x.place ? ' · ' + esc(x.place) : ''}.</p>
    <p class="muted small">Joining brings your household in: you all see and change the same plan.</p><div class="actions"><button type="button" class="btn small" data-act="tg-join" data-id="${esc(x.id)}">Join</button><button type="button" class="link" data-act="tg-no" data-id="${esc(x.id)}">Not now</button></div></li>`).join('')}</ul></section>`;
}
/* who can do or bring something: the household's adults, or everyone planning a shared plan */
const tgPeople = p => p.shared ? [...new Set([...p.shared.names, ...(p.who || [])])] : members().map(m => m.name);
const tgBy = (p, k, x) => tgPeople(p).length > 1 ? `<button type="button" class="tiny px-by${x.by ? ' on' : ''}" data-act="px-by" data-k="${k}" data-p="${p.id}" data-i="${x.id}" title="Who does it">${x.by ? esc(x.by) : 'who?'}</button>` : '';
function tgSection(p) {
  if (S.tg.off || S.lk.off || !meValid()) return '';
  const fr = tgFriends();
  if (p.shared) {
    const pend = p.shared.invited.length;
    return pxSec('Planning together', '', `<p class="small">With ${esc(p.shared.names.filter(n => n !== me).join(', ') || 'your household')}${p.shared.houses > 1 ? '' : ' (waiting for them to join)'}. Ticks and new things show on everyone’s phones.</p>
      ${pend ? `<p class="muted small">${pend} invitation${pend > 1 ? 's' : ''} waiting for an answer.</p>` : ''}
      ${fr.length ? `<div class="chips">${fr.map(l => `<button type="button" class="tiny" data-act="tg-share" data-p="${p.id}" data-id="${esc(l.id)}">+ ${esc(lkName(l))}</button>`).join('')}</div>` : ''}
      <p class="muted small">Tap “who?” on a step or a thing to take to say who does it or brings it. Your Today only shows yours and the unclaimed ones.</p>
      <button type="button" class="link small" data-act="tg-leave" data-id="${p.id}">${S.ui.tgArm === p.id ? 'Tap again to leave this plan' : 'Leave this plan'}</button>`);
  }
  if (!fr.length) return pxSec('Do it together', '', `<p class="muted small">Everyone in your household already sees this plan. To plan with a friend in another household, connect with them first (Us → Family → their profile → Connect in Afloat).</p>`);
  const going = fr.filter(l => { const f = lkFriend(l); return f && (p.who || []).includes(f.name); });
  return pxSec('Do it together', '', `<p class="muted small">Everyone in your household already sees this plan. Ask a friend in another household to plan it with you: once they say yes, you all change the same plan.</p>
    <div class="chips">${[...going, ...fr.filter(l => !going.includes(l))].map(l => `<button type="button" class="tiny${going.includes(l) ? ' on' : ''}" data-act="tg-share" data-p="${p.id}" data-id="${esc(l.id)}">Do it with ${esc(lkName(l))}</button>`).join('')}</div>`);
}
/* the event form: friends going who are connected in Afloat can be asked to plan it with you, ticked by default */
function tgFormHtml(ev) {
  if (S.tg.off || S.lk.off || !ev.plan) return '';
  const L = tgFriends().filter(l => { const f = lkFriend(l); return f && (ev.who || []).includes(f.name); }); if (!L.length) return '';
  const no = ev.planNo || [];
  return `<div class="tg-form">${L.map(l => `<label class="small" style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-evf="planwith" data-id="${esc(l.id)}" ${no.includes(l.id) ? '' : 'checked'}> Do it together with ${esc(lkName(l))} (in Afloat)</label>`).join('')}</div>`;
}
/* after "Save and plan": ask the ticked friends */
function tgFromForm(ev, pid) {
  if (S.tg.off || S.lk.off || !pid) return;
  const L = tgFriends().filter(l => { const f = lkFriend(l); return f && (ev.who || []).includes(f.name) && !(ev.planNo || []).includes(l.id); });
  (async () => { let id = pid; for (const l of L) { id = (await tgShare(id, l.id)) || id; } })();
}
function tapPlansTogether(a, el) {
  const id = el.dataset.id;
  switch (a) {
    case 'tg-join': tgAnswer(id, true); return true;
    case 'tg-no': tgAnswer(id, false); return true;
    case 'tg-share': tgShare(el.dataset.p, id); return true;
    case 'tg-leave': if (S.ui.tgArm !== id) { S.ui.tgArm = id; render(true); return true; } S.ui.tgArm = null; tgLeave(id); return true;
    case 'px-by': { const p = pxGet(el.dataset.p), k = el.dataset.k === 'pack' ? 'pack' : 'steps'; if (!p) return true; const P = ['', ...tgPeople(p)];
      pxList(p.id, k, L => L.map(x => x.id === el.dataset.i ? { ...x, by: P[(P.indexOf(x.by || '') + 1) % P.length] } : x)); return true; }
  }
  return false;
}
