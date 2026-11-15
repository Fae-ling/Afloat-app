/* Afloat · app/calm.js · Calm Today: the next-thing card, favourite groups, More for today, hiding unused groups.
   Plain script: shares one scope with the other app/*.js files (loaded in order by index.html). See CLAUDE.md. */
/* ---------- a calmer Today (6 Nov 2026) ----------
   One "next thing" card on top, then the briefing and at most three groups open; everything else folds into "More for
   today" with a count. Favourites (asked once) come first; groups neither of you has opened in three weeks are offered
   to hide (time-critical ones never). "Show everything" (Settings → Today, or in the fold) switches calm off on this
   phone. Data: home/use { [name]: { last: {groupKey: dateKey}, favs: [...], favAsked, hide: [...] }, since }. */
const calmOn = () => { const v = lsGet('afloat.calm'); return v == null ? !window.__CALM_OFF : v !== '0'; }; /* tests opt out with __CALM_OFF */
const TODAY_GROUPS = { morning: 'Your morning', out: 'Going out', home: 'Girls at home', cal: 'Calendar', athome: 'Reminders', care: 'Looking after you', rhythm: 'Today’s beat', bedtime: 'Bedtime', date: 'Date night', tomorrow: 'Tomorrow', board: 'To-dos, dinner and the rest', closing: 'Closing duties' };
const NEVER_QUIET = ['closing', 'bedtime', 'date', 'tomorrow', 'out', 'morning', 'home', 'athome'];
const useOf = (n = me) => (H('use')[n] || {});
function useSet(patch, n = me) { if (!n) return; const o = { ...H('use') }; o[n] = { ...useOf(n), ...patch }; if (!o.since) o.since = dk; mergeDoc('home/use', { [n]: o[n], since: o.since }); }
function useMark(key) {
  if (!me || !key || !TODAY_GROUPS[key]) return; const last = useOf().last || {}; if (last[key] === dk) return;
  const o = { ...H('use') }; o[me] = { ...useOf(), last: { ...last, [key]: dk } }; if (!o.since) o.since = dk;
  /* quiet: no toast and no redraw of its own */ apply('home/use', o); if (!db) mem['home/use'] = o; else q('home/use', async () => { await db.doc('home/use').update({ [me]: { last: { [key]: dk } }, since: o.since }); exists['home/use'] = true; }); /* only this one tap: a whole-document write from a phone with an older copy would undo the other person's favourites */
}
function quietGroups(keys) {
  const U = H('use'), since = U.since; if (!since || dayDiffK(since, dk) < 21) return [];
  const old = calAdd(dk, -21), people = members().map(m => m.name);
  return keys.filter(k => !NEVER_QUIET.includes(k) && !(useOf().keep || []).includes(k) && people.every(n => !((useOf(n).last || {})[k] > old)));
}
/* the one thing to look at now */
function nowThing() {
  S.ui.ntKind = '';
  if (!meValid() || sickOn() || !calmOn() || runOuting()) return ''; /* "leaving soon" is already on top */
  const nm = nowMin(), li = leaveInfo(), sl = slot(), card = (kind, eb, t, sub, go, extra = '') => { S.ui.ntKind = kind;
    return `<section class="card now-thing nt-${kind}"><p class="eyebrow">${eb}</p><h2 class="nt-t">${t}</h2>${sub ? `<p class="small muted">${sub}</p>` : ''}${extra}${go ? `<div class="actions"><button class="link" data-act="now-go" data-id="${go}">Show me</button></div>` : ''}</section>`; };
  if (li && li.next && li.next.m - nm <= 90 && li.next.m - nm >= -10)
    return card('leave', 'Next', li.next.m > nm ? `Leave ${inMins(li.next.m - nm)}` : 'Time to go', `${esc(li.next.t)} · ${esc(li.next.why)}`, li.show ? 'morning' : 'out', transStrip(li.next.m, li));
  if (closingDue() && hMode() !== 'survival') { const { pre, cl, solo } = closingSet(), t = tagOf(), n = countDone(pre, cl);
    if (cl.length && n < cl.length && (solo || !t.close || t.close === me) && eveAt(me, dk) === 'home') return card('closing', 'Now', `${solo ? 'Solo closing duties' : 'Closing duties'}: ${cl.length - n} left`, `About ${minsLeft(pre, cl) || 10} minutes. Kindness to tomorrow-you; any amount counts.`, 'closing'); }
  const rows = dayRows(dk).filter(r => !r.allDay && !r.job), cur = nowRows(rows, nm)[0], nx = rows.find(r => r.s > nm && r.s - nm <= 60 && mineRow(r));
  if (cur) return card('cal', 'Now', esc(cur.title), `until ${cur.en >= 1440 ? 'late' : mm2t(cur.en)}${cur.who ? ' · ' + esc(cur.who) : ''}`, 'cal');
  if (nx) return card('cal', 'Next', esc(nx.title), `${mm2t(nx.s)} · ${inMins(nx.s - nm)}${nx.leave ? ` · leave by ${esc(nx.leave)}` : ''}`, 'cal');
  if ((sl === 'morning' || sl === 'day') && hMode() !== 'survival') { const j = beatPlan().base.find(x => !rjDone(x));
    if (j) return card('beat', 'One house job, if you have room', esc(j.text), `${j.min ? `About ${j.min} minutes. ` : ''}Starting counts; finishing is optional.`, 'rhythm'); }
  if (sl === 'day' && nm >= 13 * 60 && (+careOf(me).rest || 0) < 2) return card('rest', 'Now', 'A 15-minute rest break', 'Just for you. It earns a star.', 'care');
  return card('calm', 'Now', 'Nothing needs you right now', sl === 'night' ? 'Phone away soon. Whatever is left belongs to tomorrow-you.' : 'Rest counts. Afloat will tell you when something comes up.', '');
}
/* the run-up to leaving, drawn: a bar that fills over the last 30 minutes (same bar as Leaving soon), with the next two small steps */
function transStrip(m, li) {
  const nm = nowMin(), left = m - nm;
  const open = [...(li ? li.LL.filter(x => !isDone((S.day.done || {})[pPre(me, 'launch') + ':' + x.id])) : []), ...(li ? li.PX.filter(x => !isDone((S.day.done || {})[`pl:${me}:${x.id}`])) : [])].slice(0, 2);
  const steps = open.length ? open.map(x => esc(x.text)) : (left > 15 ? ['Toilet, water, shoes by the door'] : ['Shoes and jacket on', 'Out of the door']);
  return `${leaveStrip(dayBase(dk) + m * 6e4, 30)}
    <p class="small"><b>Next small steps:</b> ${steps.join(' → ')}</p>`;
}
/* asked once per person: which parts of Today you actually use; they stay at the top */
function favAsk() {
  if (!calmOn() || !meValid() || useOf().favAsked || S.ui.favSkip) return '';
  const pick = S.ui.favPick || [];
  return `<section class="card fav-ask"><h2>Which parts of Today do you actually use?</h2><p class="muted small">Pick up to three. They stay at the top; the rest folds away until you need it.</p>
    <div class="pills">${Object.entries(TODAY_GROUPS).map(([k, l]) => `<button class="pill${pick.includes(k) ? ' on' : ''}" data-act="fav-pick" data-id="${k}" aria-pressed="${pick.includes(k)}">${esc(l)}</button>`).join('')}</div>
    <div class="actions"><button class="btn" data-act="fav-save" ${pick.length ? '' : 'disabled'}>Keep these on top</button><button class="link" data-act="fav-later">Not now</button></div></section>`;
}
/* the groups, calm: what matters now, your favourites, then everything else folded */
function calmGroups(order, B, sec) {
  if (!calmOn()) return order.filter(k => B[k]).map(k => sec('t-' + k, B[k].t, B[k].meta, B[k].body)).join('');
  const hide = useOf().hide || [], have = order.filter(k => B[k] && !hide.includes(k)), li = leaveInfo();
  const crit = have.filter(k => ((k === 'closing' && closingDue()) || k === 'bedtime') || (k === 'out' && li && li.next && li.next.m - nowMin() <= 120 && li.next.m >= nowMin() - 10) || (k === 'morning' && li && li.show) || (k === 'athome' && remNow().length));
  const favs = (useOf().favs || []).filter(k => have.includes(k)), top = [...new Set([...crit, ...favs, ...have])].slice(0, 3), rest = have.filter(k => !top.includes(k));
  let h = top.map(k => sec('t-' + k, B[k].t, B[k].meta, B[k].body)).join('');
  const q = quietGroups(rest), hid = order.filter(k => B[k] && hide.includes(k));
  if (rest.length || hid.length) {
    h += `<section class="grp calm-more" id="sec-calm-more"><details${COL['calm-more'] ? ' open' : ''} data-grp="calm-more"><summary class="grp-h"><span>More for today</span><span class="line"></span><span class="meta">${rest.length}</span></summary>
      <p class="muted small calm-list">${rest.map(k => esc(TODAY_GROUPS[k] || B[k].t)).join(' · ')}</p>
      ${q.map(k => `<p class="note small quiet-ask">Neither of you has opened “${esc(TODAY_GROUPS[k])}” in three weeks. <button class="link" data-act="calm-hide" data-id="${k}">Hide it from Today</button> <button class="link" data-act="calm-keep" data-id="${k}">Keep it</button></p>`).join('')}
      ${rest.map(k => sec('t-' + k, B[k].t, B[k].meta, B[k].body)).join('')}
      ${hid.length ? `<p class="muted small">Hidden: ${hid.map(k => `${esc(TODAY_GROUPS[k])} <button class="link" data-act="calm-unhide" data-id="${k}">show again</button>`).join(' · ')}</p>` : ''}
      <div class="actions"><button class="link" data-act="calm-off">Show everything instead</button></div></details></section>`;
  }
  return h;
}
/* ---------- taps on this area's buttons (data-act), called from events.js; true = handled ---------- */
function tapCalm(a, el, e, r) {
  switch (a) {
    case 'now-go': { const id = el.dataset.id, inFold = !!document.querySelector(`#sec-calm-more #sec-t-${id}`); COL['t-' + id] = false; if (inFold) COL['calm-more'] = true; lsSet('afloat.col', JSON.stringify(COL)); useMark(id); render(true);
      setTimeout(() => { const c = document.getElementById('sec-t-' + id); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 0); return true; }
    case 'fav-pick': { const p = S.ui.favPick || [], id = el.dataset.id; S.ui.favPick = p.includes(id) ? p.filter(x => x !== id) : [...p, id].slice(-3); render(true); return true; }
    case 'fav-save': useSet({ favs: S.ui.favPick || [], favAsked: dk }); S.ui.favPick = null; toast('Those stay at the top of Today.'); return true;
    case 'fav-later': S.ui.favSkip = true; useSet({ favAsked: dk }); return true;
    case 'calm-hide': useSet({ hide: [...new Set([...(useOf().hide || []), el.dataset.id])] }); toast('Hidden from Today. “Show again” is at the bottom of More for today.'); return true;
    case 'calm-keep': useSet({ keep: [...new Set([...(useOf().keep || []), el.dataset.id])] }); return true;
    case 'calm-unhide': useSet({ hide: (useOf().hide || []).filter(x => x !== el.dataset.id) }); return true;
    case 'calm-off': lsSet('afloat.calm', '0'); toast('Today shows everything on this phone. Settings → Today brings calm back.'); render(true); return true;
  }
  return false;
}
