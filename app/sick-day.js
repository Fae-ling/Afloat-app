/* Afloat · app/sick-day.js · Sick-day mode.
   Plain script: shares one scope with the other app/*.js files (loaded in order by index.html). See CLAUDE.md. */
/* ---------- sick-day mode ---------- */
const sickOn = () => !!H('sick').active;
const kidsList = () => (modOn('kids') ? H('household').kids || [] : []);
const lastDose = id => (H('sick').doses || []).filter(x => x.med === id).sort((a, b) => b.at - a.at)[0];
const dosesIn24 = id => (H('sick').doses || []).filter(x => x.med === id && x.at > Date.now() - 864e5).length;
function medStatus(m) {
  const last = lastDose(m.id), n24 = dosesIn24(m.id);
  if (!last) return { txt: 'Not given yet', ready: true, n24 };
  const due = last.at + (+m.every || 0) * 3600e3, now = Date.now(), by = last.by ? ' by ' + last.by : '';
  if (now >= due) return { txt: `Last at ${fmtT(last.at)}${by}. Can be given again now.`, ready: true, n24, due };
  const mins = Math.ceil((due - now) / 6e4);
  return { txt: `Last at ${fmtT(last.at)}${by}. Next from ${fmtT(due)} (in ${Math.floor(mins / 60) ? Math.floor(mins / 60) + ' h ' : ''}${mins % 60} min).`, ready: false, n24, due };
}
const kidSelect = id => `<select name="kid" id="${id}" aria-label="Which child">${kidsList().map(k => `<option>${esc(k)}</option>`).join('')}<option value="">Not specified</option></select>`;
function vSick() {
  const sk = H('sick'), L = H('lists'), hh = H('household'), meds = sk.meds || [], ms = members();
  const temps = (sk.temps || []).filter(x => x.at > Date.now() - 2 * 864e5).sort((a, b) => b.at - a.at).slice(0, 8);
  const night = S.day.night || {};
  const since = sk.since ? new Date(sk.since).toLocaleDateString('en-GB', { weekday: 'long' }) : '';
  let h = `<section class="hero"><p class="eyebrow">Sick-day mode${since ? ' · since ' + since : ''}</p><h1>Caring for a sick kid is the whole job today.</h1>
    <p class="lede">Everything else in Afloat is paused and nothing piles up. Fed, watered and resting counts as a good day, for adults too.</p>${hh.sickCarer ? `<p class="small">As agreed, <b>${esc(hh.sickCarer)}</b> stays home with them${hh.sickCarer === me ? '' : '; tell work early, and hand over the medicine notes below'}.</p>` : ''}</section>`;
  h += `<section class="card sos"><div class="sec-head"><h2>If you’re worried, call</h2></div>
    <div class="nums"><span><b>Paediatrician</b> ${hh.doctor ? esc(hh.doctor) : '<span class="muted">add the number in Household settings</span>'}</span><span><b>Ambulance</b> 155</span><span><b>Emergency</b> 112</span></div>
    ${hh.doctorHours ? `<p class="small"><b>Hours for sick children:</b> ${esc(hh.doctorHours)}</p>` : ''}${hh.afterHours ? `<p class="small"><b>Outside those hours:</b> ${esc(hh.afterHours)}</p>` : ''}${hh.doctorUrl ? `<p class="small"><a class="link" href="${esc(hh.doctorUrl)}" target="_blank" rel="noopener">Practice website</a> (holiday hours and stand-in doctor are posted there)</p>` : ''}
    <p class="muted small">Trust your gut. Calling to ask is always allowed.</p></section>`;
  h += careNudge();
  h += `<section class="card"><div class="sec-head"><h2>Medicines</h2></div>
    <p class="muted small">Use the dose on the label or the one your doctor gave. Afloat only keeps time, so nobody has to remember who gave what at 3 am.</p>
    ${meds.length ? `<ul class="edit-list">${meds.map(m => { const st = medStatus(m), arm = S.ui.armMed === m.id, over = m.maxDay && st.n24 >= m.maxDay;
      return `<li class="med"><div class="txt"><b>${esc(m.name)}</b>${m.kid ? ` <span class="muted">· ${esc(m.kid)}</span>` : ''}<span class="def">${m.dose ? esc(m.dose) + ' · ' : ''}every ${+m.every} h${m.maxDay ? ` · max ${+m.maxDay} a day` : ''}${m.remind !== false || m.trello ? ' · reminder for both' : ''}</span><span class="def ${st.ready ? 'ok' : ''}">${esc(st.txt)} ${st.n24} in the last 24 h.</span>
        ${arm ? `<span class="def warn">${over ? `That would be more than the ${+m.maxDay} a day you entered.` : `That’s earlier than every ${+m.every} h.`} Only give it if a doctor said so.</span>` : ''}</div>
        <div class="med-act">${arm ? `<button class="btn accent" data-act="give" data-id="${m.id}" data-force="1">Given anyway</button><button class="link" data-act="give-cancel">Cancel</button>` : `<button class="btn ${st.ready ? 'accent' : 'ghost'}" data-act="give" data-id="${m.id}">Given now</button>`}
        <button class="chip x" data-act="del-med" data-id="${m.id}" aria-label="Remove ${esc(m.name)}">✕</button></div></li>`; }).join('')}</ul>` : '<p class="empty">No medicines added yet.</p>'}
    <form class="addform" data-form="med">${kidsList().length ? kidSelect('medKid') : ''}<input type="text" name="text" placeholder="Medicine, e.g. Nurofen" required aria-label="Medicine name"><input type="text" name="dose" placeholder="Dose from label or doctor" aria-label="Dose"><input type="number" name="every" min="1" max="48" placeholder="every … h" required aria-label="Hours between doses" style="width:7em"><input type="number" name="maxDay" min="1" max="12" placeholder="max/day" aria-label="Maximum doses per day (optional)" style="width:6.5em">
      <label class="small" style="display:flex;gap:6px;align-items:center"><input type="checkbox" name="remind" checked> Remind us when the next dose is due</label><button class="btn" type="submit">Add</button></form>
    <p class="muted small">With a reminder, each “Given now” sets one for both of you at the next dose time: on Today and on both phones, always ringing.</p></section>`;
  h += `<section class="card"><div class="sec-head"><h2>Temperature log</h2></div>
    <form class="addform" data-form="temp">${kidsList().length ? kidSelect('tempKid') : ''}<input type="text" name="text" inputmode="decimal" placeholder="e.g. 38,4" required aria-label="Temperature in °C" style="flex:0 1 8em"><button class="btn" type="submit">Log</button></form>
    ${temps.length ? `<ul class="edit-list">${temps.map(t => `<li><span class="txt small"><b>${esc(t.t)} °C</b>${t.kid ? ' · ' + esc(t.kid) : ''} <span class="muted">· ${new Date(t.at).toLocaleDateString('en-GB', { weekday: 'short' })} ${fmtT(t.at)}${t.by ? ' · ' + esc(t.by) : ''}</span></span></li>`).join('')}</ul>` : '<p class="muted small">Handy when the doctor asks “how high, and since when?”</p>'}</section>`;
  if (ms.length > 1) h += `<section class="card"><div class="sec-head"><h2>Tonight’s night shifts</h2></div><p class="muted small">Split the night so at least one of you gets a stretch of real sleep.</p>
    <div class="duo">${[['first', 'Until 2 am'], ['second', 'From 2 am']].map(([k, l]) => `<div class="role"><h3>${l}</h3><div class="pills">${ms.map(m => `<button class="pill${night[k] === m.name ? ' on' : ''}" data-act="night" data-k="${k}" data-name="${esc(m.name)}">${esc(m.name)}</button>`).join('')}</div></div>`).join('')}</div></section>`;
  h += `<section class="card"><div class="sec-head"><h2>Sick-day basics</h2><span class="progress">${countDone('x', L.sick)} of ${(L.sick || []).length}</span></div>${checklist('x', L.sick || [])}</section>`;
  h += trSection();
  h += `<section class="card"><div class="sec-head"><h2>Everyone’s on the mend?</h2></div><p class="muted small">Ending sick-day mode brings the normal lists back. Consider marking tomorrow as Survival mode: recovery days count too.</p>
    <div class="actions"><button class="btn" data-act="sick-off">End sick-day mode</button></div></section>`;
  return h;
}
async function giveMed(id, force) {
  const sk = { ...H('sick') }, med = (sk.meds || []).find(m => m.id === id); if (!med) return;
  const st = medStatus(med);
  if (!force && (!st.ready || (med.maxDay && st.n24 >= med.maxDay))) { S.ui.armMed = id; render(true); return; }
  S.ui.armMed = null;
  const dose = { id: uid(), med: id, at: Date.now(), by: me || '' };
  sk.doses = [...(sk.doses || []).filter(x => x.at > Date.now() - 3 * 864e5), dose];
  saveHome('sick', sk);
  if (med.remind === false && !med.trello) toast(`${med.name} logged at ${fmtT(dose.at)}. Next from ${fmtT(dose.at + med.every * 3600e3)}.`);
  if (med.trello || med.remind !== false) {
    const due = new Date(dose.at + med.every * 3600e3);
    remDel(x => x.ref === 'med:' + id);
    remAdd([{ text: `${med.name}${med.kid ? ' for ' + med.kid : ''} can be given again${med.dose ? ' (' + med.dose + ')' : ''}`, who: 'both', at: hm(due), date: keyOf(due), live: true, src: 'sick', ref: 'med:' + id }]);
    toast(`${med.name} logged at ${fmtT(dose.at)}. We’ll both be reminded at ${hm(due)}.`);
  }
}
/* while the page is open, a gentle nudge when a dose becomes due */
setInterval(() => {
  if (!sickOn()) return;
  for (const m of H('sick').meds || []) {
    const last = lastDose(m.id); if (!last) continue;
    const due = last.at + m.every * 3600e3, key = m.id + last.id;
    if (Date.now() >= due && Date.now() - due < 30 * 6e4 && !S.notified[key]) { S.notified[key] = 1; toast(`${m.name}${m.kid ? ' for ' + m.kid : ''} can be given again now.`); chime(); render(); }
  }
}, 30000);
S.notified = {};
/* ---------- taps on this area's buttons (data-act), called from events.js; true = handled ---------- */
function tapSickDay(a, el, e, r) {
  switch (a) {
    case 'sick-off': remDel(x => x.src === 'sick'); saveHome('sick', { ...H('sick'), active: false }); toast('Sick-day mode is off. Go gently.'); return true;
    case 'give': giveMed(el.dataset.id, el.dataset.force === '1'); return true;
    case 'give-cancel': S.ui.armMed = null; render(true); return true;
    case 'del-med': { const sk = { ...H('sick') }; sk.meds = (sk.meds || []).filter(m => m.id !== el.dataset.id); saveHome('sick', sk); return true; }
    case 'night': { const n = { ...(S.day.night || {}), [el.dataset.k]: el.dataset.name }, ms = members().map(m => m.name); if (ms.length === 2) n[el.dataset.k === 'first' ? 'second' : 'first'] = ms.find(x => x !== el.dataset.name); S.day = { ...S.day, night: n }; mergeDoc('days/' + dk, { night: n }); render(true); return true; }
  }
  return false;
}
