/* Afloat · app/notes-usage.js · ✎ Note sheet, and Claude this month (cost so far, monthly cap).
   Plain script: shares one scope with the other app/*.js files (loaded in order by index.html). See CLAUDE.md. */
/* ---------- ✎ Note: "this annoyed me / this helped", kept for the next change to Afloat. Data: home/notes { list: [...] } ---------- */
/* ---------- Claude this month (6 Nov 2026): what Afloat's Claude features cost so far, and the monthly cap.
   The server adds each answer's cost to usage/<yyyy-mm>; past the cap (usage/cap, $3 unless changed) Claude pauses until
   the 1st and every feature falls back to its built-in version. ---------- */
const FEAT_L = { notice: 'Reading photos and notices', sorting: 'Sorting the brain dump', breakdown: 'Break it down', dates: 'Date night ideas', trips: 'Trip ideas', packing: 'What to take', plan: 'Ready for tomorrow', season: 'Season check', checkup: 'Check-up ideas', test: 'Tests', other: 'Other ideas and suggestions' };
function usageLoad() {
  if (!db || S.usage && Date.now() - S.usage.at < 6e4) return; const mk = dk.slice(0, 7);
  S.usage = { at: Date.now(), mk, m: null, cap: null };
  Promise.all([db.doc('usage/' + mk).get(), db.doc('usage/cap').get()]).then(([m, c]) => { S.usage = { at: Date.now(), mk, m: m.exists ? m.data() : {}, cap: c.exists ? c.data() : {} }; render(true); }).catch(e => console.warn('usage', e));
}
function usageBox() {
  if (!sample) return ''; usageLoad(); const U = S.usage || {}, m = U.m, cap = +((U.cap || {}).usd) || 3;
  const usd = m ? +m.usd || 0 : null, czk = x => Math.round(x * 21);
  return `<h3>Claude this month</h3>${m == null ? '<p class="muted small">Checking…</p>' : `<p class="small"><b>$${usd.toFixed(2)}</b> (about ${czk(usd)} Kč) of a $${cap} cap, ${m.calls || 0} answers.${usd >= cap ? ' The cap is reached: Claude is back on the 1st, built-in ideas until then.' : ''}</p>`}
    <div class="pills">${[1, 3, 5, 10].map(v => `<button class="pill${cap === v ? ' on' : ''}" data-act="usage-cap" data-v="${v}">$${v} a month</button>`).join('')}</div>
    ${m && m.feature && Object.keys(m.feature).length ? `<p class="muted small">Where it went: ${Object.entries(m.feature).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([k, v]) => `${esc(FEAT_L[k] || k)} $${(+v || 0).toFixed(2)}`).join(' · ')}</p>` : ''}
    <p class="muted small">Most features use Claude’s cheapest model; only reading photos (receipts, recipes, notices) uses the stronger one. About 21 Kč to the dollar.</p>`;
}
function vNote() {
  const N = S.ui.note || {}; const list = (H('notes').list || []).slice(-30).reverse();
  return `<div class="scrim" data-act="note-close"><div class="sheet" role="dialog" aria-label="A note about Afloat"><div class="sec-head"><h2>A note about Afloat</h2><button class="link" data-act="note-close">Close</button></div>
    <p class="muted small">For the next time Afloat gets changed. It remembers which screen you were on${N.sec ? ` (${esc(TODAY_GROUPS[N.sec] || N.view)})` : N.view ? ` (${esc(N.view)})` : ''}.</p>
    <div class="seg">${[['annoyed', 'This annoyed me'], ['helped', 'This helped']].map(([k, l]) => `<button class="${N.kind === k ? 'on' : ''}" data-act="note-kind" data-v="${k}">${l}</button>`).join('')}</div>
    <textarea id="noteText" rows="3" placeholder="Optional: a few words" aria-label="What happened">${esc(N.text || '')}</textarea>
    <div class="actions"><button class="btn" data-act="note-save" ${N.kind ? '' : 'disabled'}>Save the note</button></div>
    ${list.length ? `<details><summary class="small">Notes so far (${(H('notes').list || []).length})${(H('errors').list || []).length ? ` · errors Afloat ran into (${H('errors').list.length})` : ''}</summary><ul class="bf-list">${list.map(x => `<li><b>${x.kind === 'helped' ? 'Helped' : 'Annoyed'}</b> · ${esc(x.by)} · ${esc(fmtD(x.at))}${x.where ? ` · ${esc(x.where)}` : ''}${x.text ? `<br><span class="small">${esc(x.text)}</span>` : ''}</li>`).join('')}</ul>
      <div class="actions"><button class="link" data-act="note-copy">Copy them all (to paste into a chat with Claude)</button></div></details>` : ''}</div></div>`;
}
function noteSave() {
  const N = S.ui.note || {}; if (!N.kind || !me) return; const t = ($('#noteText') || {}).value || '';
  const o = { ...H('notes') }; o.list = [...(o.list || []), { id: uid(), by: me, at: dk, t: Date.now(), kind: N.kind, text: t.trim().slice(0, 600), where: N.sec ? TODAY_GROUPS[N.sec] || N.sec : N.view || '' }].slice(-200);
  saveHome('notes', o); S.ui.note = null; toast(N.kind === 'helped' ? 'Noted. Good to know what works.' : 'Noted. That goes into the next change.'); render(true);
}
/* ---------- taps on this area's buttons (data-act), called from events.js; true = handled ---------- */
function tapNotesUsage(a, el, e, r) {
  switch (a) {
    case 'usage-cap': { const v = +el.dataset.v; if (db) db.doc('usage/cap').set({ usd: v, by: me, at: Date.now() }).catch(e => toast('Couldn’t save the cap.')); S.usage = { ...(S.usage || {}), cap: { usd: v } }; toast(`Claude stops for the month at $${v}.`); render(true); return true; }
    case 'note-kind': S.ui.note = { ...(S.ui.note || {}), kind: el.dataset.v, text: ($('#noteText') || {}).value || '' }; render(true); return true;
    case 'note-save': noteSave(); return true;
    case 'note-close': S.ui.note = null; render(true); return true;
    case 'note-copy': { const t = (H('notes').list || []).map(x => `${x.at} ${x.by} ${x.kind === 'helped' ? 'HELPED' : 'ANNOYED'}${x.where ? ' [' + x.where + ']' : ''}: ${x.text || '(no words)'}`).concat((H('errors').list || []).map(x => `${new Date(x.at).toISOString()} ${x.by} ERROR [${x.view}] ${x.where}: ${x.msg}`)).join('\n'); (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast('Copied.'), () => toast('Couldn’t copy on this phone.')); return true; }
  }
  return false;
}
