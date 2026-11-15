/* Afloat · app/plans-more.js · Plans: costs and who owes whom, reminders for single steps, and bookings read from an email or a
   screenshot (11 Nov 2026). Plain script: shares one scope with the other app/*.js files (loaded in order by index.html). See CLAUDE.md.
   plan.costs [{ id, text, amt, by (who paid), for [names] (empty = everyone), settle (a payment back) }], plan.cur ('Kč' by default)
   step.rem 'HH:MM' + step.remBy: a reminder on the step's day (home/reminders, ref 'pxs:<step id>'), for whoever does the step.
   Bookings: the confirmation email pasted, or a screenshot or photo; Claude reads it into journeys, stays and steps, reviewed first.
   (Gmail itself isn't read: its read access is a "restricted" Google scope that needs Google's security assessment.) */
const PC_CUR = ['Kč', '€', '£', '$'];
const pcPeople = p => p.shared ? p.shared.names.filter(Boolean) : members().map(m => m.name);
const pcR = n => Math.round(n * 100) / 100;
const pcFmt = (n, cur) => `${(Math.round(n * 100) / 100).toLocaleString('cs-CZ', { maximumFractionDigits: 2 })} ${cur}`;
/* who paid what, what each person's share is, and the fewest payments that settle it. Pure, so it can be tested. */
function pcBalance(costs, people) {
  const net = Object.fromEntries(people.map(n => [n, 0])); let total = 0;
  for (const c of costs || []) {
    const amt = +c.amt || 0, by = c.by, f = (c.for && c.for.length ? c.for : people).filter(n => n in net || n === by); if (!amt || !by || !f.length) continue;
    if (!(by in net)) net[by] = 0; if (!c.settle) total += amt;
    net[by] += amt; for (const n of f) { if (!(n in net)) net[n] = 0; net[n] -= amt / f.length; }
  }
  const owe = Object.entries(net).filter(([, v]) => v < -0.005).map(([n, v]) => [n, -v]).sort((a, b) => b[1] - a[1]), get = Object.entries(net).filter(([, v]) => v > 0.005).sort((a, b) => b[1] - a[1]), moves = [];
  let i = 0, j = 0;
  while (i < owe.length && j < get.length) { const x = Math.min(owe[i][1], get[j][1]); moves.push({ from: owe[i][0], to: get[j][0], amt: pcR(x) }); owe[i][1] -= x; get[j][1] -= x; if (owe[i][1] < 0.005) i++; if (get[j][1] < 0.005) j++; }
  return { total: pcR(total), net: Object.fromEntries(Object.entries(net).map(([n, v]) => [n, pcR(v)])), moves };
}
function pcHtml(p) {
  const ppl = pcPeople(p), cur = p.cur || 'Kč', L = p.costs || [], B = pcBalance(L, ppl);
  if (ppl.length < 2 && !L.length) return '';
  return pxSec('Costs', B.total ? pcFmt(B.total, cur) : '', `
    ${L.length ? `<ul class="pl-its">${L.map(c => `<li class="pl-it"><span class="txt small">${c.settle ? `↩ ${esc(c.by)} paid ${esc((c.for || [])[0] || '')} back` : `${esc(c.text)} · paid by ${esc(c.by)}${c.for && c.for.length && c.for.length < ppl.length ? ` · for ${esc(c.for.join(', '))}` : ''}`} · <b>${esc(pcFmt(+c.amt, cur))}</b></span>${pxDel('costs', p.id, c.id, c.text || 'payment')}</li>`).join('')}</ul>` : `<p class="muted small">Who paid for what: tickets, the cottage, the shopping. Afloat works out who owes whom, with as few payments as possible.</p>`}
    ${B.moves.length ? `<p class="small"><b>To settle up:</b></p><ul class="pl-its">${B.moves.map(m => `<li class="pl-it"><span class="txt small">${esc(m.from)} → ${esc(m.to)}: <b>${esc(pcFmt(m.amt, cur))}</b></span><button type="button" class="tiny" data-act="pc-settle" data-p="${p.id}" data-from="${esc(m.from)}" data-to="${esc(m.to)}" data-amt="${m.amt}">Paid</button></li>`).join('')}</ul>` : L.length ? '<p class="muted small">All square.</p>' : ''}
    <form class="addform" data-form="pc-add" data-p="${p.id}"><input type="text" name="text" placeholder="e.g. Train tickets" required aria-label="What for"><input type="number" inputmode="decimal" step="0.01" min="0" name="amt" placeholder="0" required aria-label="How much" style="max-width:7em">
      <select name="by" aria-label="Paid by">${ppl.map(n => `<option${n === me ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>
      <select name="cur" aria-label="Currency">${PC_CUR.map(x => `<option${x === cur ? ' selected' : ''}>${x}</option>`).join('')}</select><button class="btn" type="submit">Add</button></form>
    <details><summary class="small">Only for some of you</summary><p class="muted small">Untick who it isn’t for, then add it.</p><div class="chips">${ppl.map(n => `<label class="small"><input type="checkbox" form="" data-pcfor="${esc(n)}" checked> ${esc(n)}</label>`).join(' ')}</div></details>`);
}
/* ---------- reminders for single steps ---------- */
const pmRemBtn = (p, s) => pxDue(p, s) && !s.done ? `<button type="button" class="tiny${s.rem ? ' on' : ''}" data-act="pm-rem" data-p="${p.id}" data-i="${s.id}" title="${s.rem ? 'Reminder at ' + esc(s.rem) + ' on the day. Tap to turn off' : 'Remind me on the day'}" aria-pressed="${!!s.rem}">🔔${s.rem ? ' ' + esc(s.rem) : ''}</button>` : '';
/* every phone keeps its own person's step reminders in step with the plans: on its day, at its time, until it's ticked */
function pmRemSync() {
  const want = [];
  for (const p of pxAll()) { if (p.closed) continue;
    for (const s of p.steps || []) { const due = pxDue(p, s), who = s.by || s.remBy || p.by; if (!s.rem || s.done || !due || due < dk || who !== me) continue;
      want.push({ ref: 'pxs:' + s.id, text: `${p.title}: ${s.text}`.slice(0, 120), who: me, at: s.rem, date: due, src: 'plan' }); } }
  const L = remAll(), mine = L.filter(r => String(r.ref || '').startsWith('pxs:') && r.who === me);
  const keep = mine.filter(r => want.some(w => w.ref === r.ref && w.date === r.date && w.at === r.at && w.text === r.text));
  const add = want.filter(w => !keep.some(r => r.ref === w.ref));
  if (keep.length === mine.length && !add.length) return;
  remSave([...L.filter(r => !mine.includes(r) || keep.includes(r)), ...add.map(w => ({ id: uid(), days: [], home: false, live: false, ...w }))]);
}
/* ---------- bookings: an email or a screenshot → journeys, stays and steps ---------- */
const bk = () => S.ui.bk || (S.ui.bk = { files: [], text: '' });
function bkHtml(p) {
  if (!sample || p.kind === 'deadline') return '';
  const B = S.ui.bk && S.ui.bk.p === p.id ? S.ui.bk : null;
  if (!B) return `<p class="small"><button type="button" class="btn ghost small" data-act="bk-open" data-p="${p.id}">✉ Add a booking</button> <span class="muted">Paste the confirmation email, or a screenshot: trains, flights, a hotel, a car.</span></p>`;
  if (B.res) {
    const R = B.res, row = (g, x, t) => `<li><label class="nb-row"><input type="checkbox" data-act="bk-tog" data-g="${g}" data-i="${x.id}" ${x.on ? 'checked' : ''}> <span>${t}</span></label></li>`;
    return `<div class="bk card-in"><p class="small"><b>From the booking</b>${R.summary ? ': ' + esc(R.summary) : ''}</p><ul class="bf-list nb-l">
      ${R.legs.map(l => row('legs', l, `🧭 <b>${esc(l.label)}</b> · ${esc(fmtD(l.date))} ${esc(l.time)}${l.place ? ' · from ' + esc(l.place) : ''}${l.ref ? ' · ref ' + esc(l.ref) : ''}`)).join('')}
      ${R.stays.map(x => row('stays', x, `🛏 <b>${esc(x.name)}</b> · ${esc(fmtD(x.checkin))} to ${esc(fmtD(x.checkout))}${x.ref ? ' · ref ' + esc(x.ref) : ''}`)).join('')}
      ${R.steps.map(x => row('steps', x, `✓ ${esc(x.text)}${x.due ? ' · ' + esc(fmtD(x.due)) : ''}`)).join('')}
      ${R.pack.map(x => row('pack', x, `🎒 ${esc(x.text)}`)).join('')}</ul>
      <div class="actions"><button class="btn accent small" data-act="bk-save" data-p="${p.id}">Add the ticked ones</button><button class="link" data-act="bk-close">Cancel</button></div></div>`;
  }
  return `<div class="bk card-in"><p class="small"><b>Add a booking.</b> Paste the confirmation email, or add a screenshot or photo. Claude reads it; you check it before anything is added.</p>
    <textarea id="bkText" rows="4" placeholder="Paste the email here" aria-label="The booking">${esc(B.text || '')}</textarea>
    <label class="btn ghost small" style="display:inline-block">📷 Screenshots<input type="file" id="bkFiles" accept="image/*" multiple hidden></label>${B.files.length ? ` <span class="small">${B.files.length} ready</span>` : ''}
    ${B.err ? `<p class="note">${esc(B.err)}</p>` : ''}
    <div class="actions"><button class="btn small" data-act="bk-read" data-p="${p.id}" ${B.busy ? 'disabled' : ''}>${B.busy ? 'Reading…' : '✦ Read it'}</button><button class="link" data-act="bk-close">Cancel</button></div></div>`;
}
async function bkRead(pid) {
  const B = bk(), p = pxGet(pid); if (!p) return; B.text = ($('#bkText') || {}).value || B.text || '';
  if (!B.files.length && !B.text.trim()) { B.err = 'Paste the email or add a screenshot first.'; return render(true); }
  B.busy = true; B.err = ''; render(true);
  const q = `Read this travel booking or confirmation (an email, a screenshot or a ticket; Czech or English) for a trip plan: "${p.title}", ${p.start} to ${p.end}. Today is ${dk}.
Reply with only JSON: {"summary": "one short line", "legs": [{"label": "short, e.g. Flight OK652 PRG→LIS or Train to Brno", "mode": "flight" | "transit" | "drive", "date": "YYYY-MM-DD", "time": "HH:MM it leaves", "from": "station, stop or airport it leaves from", "to": "where it arrives", "number": "flight number or train/line number, or empty", "ref": "booking reference, seat or coach if given"}],
"stays": [{"name": "", "address": "", "checkin": "YYYY-MM-DD", "checkin_time": "HH:MM or empty", "checkout": "YYYY-MM-DD", "checkout_time": "HH:MM or empty", "ref": ""}],
"steps": [{"text": "at most 9 words, only what the booking asks for: online check-in, pay the rest, print the ticket, bring the card used", "due": "YYYY-MM-DD"}], "pack": ["things the booking says to bring: ID, the payment card, printed ticket"]}
Leave out anything that already happened. Empty lists are fine.
${B.text.trim() ? 'The text:\n' + B.text.trim().slice(0, 9000) : '(It is in the images.)'}`;
  try {
    const o = await sample.json(q, { images: B.files.length ? B.files.slice(0, 4) : undefined, cache: false, feature: 'booking' }) || {}, okD = d => /^\d{4}-\d\d-\d\d$/.test(String(d || '')), okT = t => /^\d{1,2}:\d\d$/.test(String(t || '')) ? String(t).padStart(5, '0') : '';
    B.res = { summary: pxClean(o.summary, 120),
      legs: (o.legs || []).filter(l => l && okD(l.date) && l.date >= dk).slice(0, 8).map(l => ({ id: uid(), on: true, label: pxClean(l.label, 40) || 'Journey', mode: ['flight', 'transit', 'drive'].includes(l.mode) ? l.mode : 'transit', date: l.date, time: okT(l.time), place: pxClean(l.from, 120), to: pxClean(l.to, 120), number: pxClean(l.number, 10), ref: pxClean(l.ref, 40) })),
      stays: (o.stays || []).filter(x => x && x.name && okD(x.checkin)).slice(0, 6).map(x => ({ id: uid(), on: true, name: pxClean(x.name, 60), address: pxClean(x.address, 160), checkin: x.checkin, cin: okT(x.checkin_time), checkout: okD(x.checkout) ? x.checkout : x.checkin, cout: okT(x.checkout_time), ref: pxClean(x.ref, 40) })),
      steps: (o.steps || []).filter(x => x && x.text).slice(0, 6).map(x => ({ id: uid(), on: true, text: pxClean(x.text, 90), due: okD(x.due) && x.due >= dk ? x.due : '' })),
      pack: (o.pack || []).map(x => pxClean(x && x.text || x, 60)).filter(Boolean).slice(0, 6).map(t => ({ id: uid(), on: true, text: t })) };
    if (!B.res.legs.length && !B.res.stays.length && !B.res.steps.length) { B.res = null; B.err = 'Nothing with a date came out of it. Paste the whole email, or try a sharper screenshot.'; }
  } catch (e) { B.err = claudeWhy(e); }
  B.busy = false; render(true);
}
function bkSave(pid) {
  const R = (S.ui.bk || {}).res, p = pxGet(pid); if (!R || !p) return; const on = a => a.filter(x => x.on);
  const legs = on(R.legs).map(l => pxLeg({ label: l.label, date: l.date, time: l.time, place: l.place, mode: l.mode, ref: l.ref, ...(l.mode === 'flight' ? { flight: l.number.replace(/\s+/g, '').toUpperCase(), early: 120 } : l.mode === 'transit' ? { stop: l.place, line: l.number, dep: l.time } : {}) }));
  const stops = on(R.stays).flatMap(x => [{ id: uid(), date: x.checkin, time: x.cin, text: `Check in: ${x.name}${x.address ? ', ' + x.address : ''}${x.ref ? ' (ref ' + x.ref + ')' : ''}`.slice(0, 160) }, ...(x.checkout !== x.checkin ? [{ id: uid(), date: x.checkout, time: x.cout, text: `Check out: ${x.name}${x.cout ? ' by ' + x.cout : ''}` }] : [])]);
  const steps = on(R.steps).filter(x => !(p.steps || []).some(y => y.text.toLowerCase() === x.text.toLowerCase() && (y.due || '') === (x.due || ''))).map(x => ({ id: uid(), text: x.text, ...(x.due ? { due: x.due } : { days: 1 }) })), pack = on(R.pack).filter(x => !(p.pack || []).some(y => y.text.toLowerCase() === x.text.toLowerCase())).map(x => ({ id: uid(), text: x.text }));
  const dates = [...legs.map(l => l.date), ...stops.map(s => s.date)].filter(Boolean).sort(), patch = { legs: [...(p.legs || []), ...legs], stops: [...(p.stops || []), ...stops], steps: [...(p.steps || []), ...steps], pack: [...(p.pack || []), ...pack] };
  if (dates.length && (dates[0] < p.start || dates[dates.length - 1] > p.end)) { patch.start = dates[0] < p.start ? dates[0] : p.start; patch.end = dates[dates.length - 1] > p.end ? dates[dates.length - 1] : p.end; }
  pxSave(pid, patch); S.ui.bk = null; render(true);
  toast(`Added: ${[legs.length && `${legs.length} journey${legs.length > 1 ? 's' : ''}`, stops.length && `${on(R.stays).length} stay${on(R.stays).length > 1 ? 's' : ''}`, steps.length && `${steps.length} step${steps.length > 1 ? 's' : ''}`, pack.length && `${pack.length} to take`].filter(Boolean).join(', ') || 'nothing'}.`);
}
function pmForm(kind, f, fd) {
  const pid = f.dataset.p, p = pxGet(pid); if (!p) return false;
  if (kind === 'pc-add') {
    const amt = Math.round((+String(fd.get('amt') || '').replace(',', '.') || 0) * 100) / 100, text = pxClean(fd.get('text'), 60), by = String(fd.get('by') || me), cur = PC_CUR.includes(fd.get('cur')) ? fd.get('cur') : 'Kč';
    if (!(amt > 0) || !text) { toast('Say what it was and how much.'); return true; }
    const ppl = pcPeople(p), off = [...document.querySelectorAll('[data-pcfor]')].filter(x => !x.checked).map(x => x.dataset.pcfor), fo = ppl.filter(n => !off.includes(n));
    pxSave(pid, { costs: [...(p.costs || []), { id: uid(), text, amt, by, for: fo.length === ppl.length ? [] : fo }], ...(cur !== (p.cur || 'Kč') ? { cur } : {}) }); return true; }
  if (kind === 'pm-remtime') { const t = String(fd.get('time') || ''); if (!/^\d\d:\d\d$/.test(t)) return true; pxList(pid, 'steps', L => L.map(x => x.id === f.dataset.i ? { ...x, rem: t, remBy: x.remBy || me } : x)); S.ui.pmRem = null; return true; }
  return false;
}
function tapPlansMore(a, el) {
  const pid = el.dataset.p, i = el.dataset.i;
  switch (a) {
    case 'pc-settle': { const p = pxGet(pid); if (!p) return true; pxSave(pid, { costs: [...(p.costs || []), { id: uid(), text: '', amt: +el.dataset.amt, by: el.dataset.from, for: [el.dataset.to], settle: true }] }); toast('Noted as paid.'); return true; }
    case 'pm-rem': { const p = pxGet(pid), s = p && (p.steps || []).find(x => x.id === i); if (!s) return true;
      if (s.rem) { pxList(pid, 'steps', L => L.map(x => x.id === i ? (({ rem, remBy, ...r }) => r)(x) : x)); toast('Reminder off.'); return true; }
      S.ui.pmRem = S.ui.pmRem === i ? null : i; render(true); return true; }
    case 'bk-open': S.ui.bk = { p: pid, files: [], text: '' }; render(true); return true;
    case 'bk-close': S.ui.bk = null; render(true); return true;
    case 'bk-read': bkRead(pid); return true;
    case 'bk-tog': { const R = (S.ui.bk || {}).res, x = R && (R[el.dataset.g] || []).find(y => y.id === i); if (x) x.on = !!el.checked; return true; }
    case 'bk-save': bkSave(pid); return true;
  }
  return false;
}
