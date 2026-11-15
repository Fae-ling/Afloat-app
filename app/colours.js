/* Afloat · app/colours.js · Family calendar setup and colours: who is going decides the colour (PAL, autoColorId, toGoogle).
   Plain script: shares one scope with the other app/*.js files (loaded in order by index.html). See CLAUDE.md. */
/* ---------- family calendar: Afloat keeps who's going, Google keeps the event ---------- */
const GC = 'Google Calendar';
/* event kinds: a fixed set Afloat sets itself (no editor). Colour comes from who's going, never from the kind. */
const KIND_DEFAULTS = [['doctor', 'Doctor or dentist', '11'], ['kinder', 'Kindergarten', '5'], ['grandma', 'At grandma’s', '3'], ['sitter', 'Babysitting', '6'], ['outing', 'Outing or trip', '10'], ['family', 'Family', '7'], ['work', 'Work', '8'], ['other', 'Other', '1']];
const KINDS = Object.fromEntries(KIND_DEFAULTS.map(([id, label, color]) => [id, { label, color }]));
const buildKinds = () => {};
const calCfg = () => H('calendar');

/* ---------- colours: the one place to change them ----------
   Rule: an event's colour says WHAT it is (its type); a person's colour says WHO.
   Everything uses Google Calendar's own 11 colours (same names, same order), so Afloat and your phones always match.
   An event follows its type's colour unless it has its own colour (set here or in Google). */
/* Google Calendar's 24 colours, in the order its phone app lists them (English name, Czech name, hex).
   The 11 with number keys are the classic ones Google's connector can write; the 13 newer ones
   live only in Afloat, and Google gets the nearest classic colour for them. */
const PAL = [['radicchio', 'Radicchio', 'Fuchsiová', '#AD1457'], ['cherry', 'Cherry blossom', 'Třešňový květ', '#D81B60'], ['4', 'Flamingo', 'Lososová', '#E67C73'], ['11', 'Tomato', 'Rajčatová', '#D50000'], ['6', 'Tangerine', 'Mandarinková', '#F4511E'], ['pumpkin', 'Pumpkin', 'Dýňová', '#EF6C00'], ['mango', 'Mango', 'Mangová', '#F09300'], ['5', 'Banana', 'Banánová', '#F6BF26'], ['citron', 'Citron', 'Citronová', '#E4C441'], ['avocado', 'Avocado', 'Avokádová', '#C0CA33'], ['pistachio', 'Pistachio', 'Pistáciová', '#7CB342'], ['10', 'Basil', 'Bazalková', '#0B8043'], ['2', 'Sage', 'Šalvějová', '#33B679'], ['eucalyptus', 'Eucalyptus', 'Eukalyptová', '#009688'], ['7', 'Peacock', 'Azurová', '#039BE5'], ['cobalt', 'Cobalt', 'Kobaltová', '#4285F4'], ['1', 'Lavender', 'Levandulová', '#7986CB'], ['9', 'Blueberry', 'Borůvková', '#3F51B5'], ['wisteria', 'Wisteria', 'Fialková', '#B39DDB'], ['amethyst', 'Amethyst', 'Ametystová', '#9E69AF'], ['3', 'Grape', 'Vínová', '#8E24AA'], ['cocoa', 'Cocoa', 'Kakaová', '#795548'], ['8', 'Graphite', 'Uhlová', '#616161'], ['birch', 'Birch', 'Březová', '#A79B8E']];
const GCOL = Object.fromEntries(PAL.map(([k, en, cz, hex]) => [k, [en, hex, cz]]));
const GORDER = PAL.map(p => p[0]);
const CLASSIC = GORDER.filter(k => /^\d+$/.test(k));
const PPAL = GORDER.map(id => GCOL[id]); /* people choose from the same 24 colours */
const PCOLORS = PPAL.map(x => x[1]);
const kindCol = k => String((KINDS[k] || KINDS.other).color);
const kindHex = k => (GCOL[kindCol(k)] || GCOL[1])[1];
/* an event's colour comes from WHO is going:
   one of you (plus any friends) → that person's colour · two or more of you → the "Together" colour
   only friends → the first friend's colour · nobody ticked → Graphite. A single event can still have its own colour. */
const hexRgb = h => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); return m ? [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)) : null; };
/* hex → nearest of all 24 (for Afloat) */
function hexToG(hex, among = GORDER) { const c = hexRgb(hex); if (!c) return null; let best = '8', bd = 1e9;
  for (const id of among) { const g = hexRgb(GCOL[id][1]), d = (g[0] - c[0]) ** 2 + (g[1] - c[1]) ** 2 + (g[2] - c[2]) ** 2; if (d < bd) { bd = d; best = id; } } return best; }
/* what Google gets: the colour itself if it's a classic one, otherwise the nearest classic one */
const NEAR = { radicchio: '11', cherry: '4', pumpkin: '6', mango: '6', citron: '5', avocado: '5', pistachio: '2', eucalyptus: '2', cobalt: '7', wisteria: '1', amethyst: '3', cocoa: '8', birch: '8' }; /* picked by eye */
const toGoogle = k => CLASSIC.includes(String(k)) ? String(k) : NEAR[k] || hexToG((GCOL[k] || GCOL[8])[1], CLASSIC);
const togetherCol = () => String(calCfg().togetherColor || '7');
const NOBODY_COL = '8';
const hhOf = e => (e.who || []).filter(n => everyone().includes(n));
function autoColorId(e) {
  const hh = hhOf(e);
  if (hh.length === 1) return hexToG(pColor(hh[0])) || NOBODY_COL;
  if (hh.length > 1) return togetherCol();
  const fr = (e.who || []).filter(isFriend); if (fr.length) return hexToG(pColor(fr[0])) || NOBODY_COL;
  return NOBODY_COL;
}
const evColor = e => e.color && GCOL[e.color] ? e.color : autoColorId(e);
/* in Afloat, an event with several people also gets a stripe in each person's colour */
function ecs(e) {
  if (e.kind === 'mine' && !e.isDate) return '';
  const ppl = (e.who || []).slice(0, 6), hx = (GCOL[evColor(e)] || GCOL[8])[1];
  const stripe = ppl.length > 1 && !e.color ? `--ppl:linear-gradient(to bottom,${ppl.map((n, i) => `${pColor(n)} ${(i * 100 / ppl.length).toFixed(1)}% ${((i + 1) * 100 / ppl.length).toFixed(1)}%`).join(',')});` : '';
  return `--kc:${hx};${stripe}`;
}
let colSig = '';
function applyColors() {
  buildKinds(); const sig = JSON.stringify(KINDS); if (sig === colSig) return; colSig = sig;
  let el = document.getElementById('kc-style'); if (!el) { el = document.createElement('style'); el.id = 'kc-style'; document.head.appendChild(el); }
  el.textContent = `:root{--kc-other:${kindHex('other')}}\n` + Object.keys(KINDS).map(k => `.k-${k}{--kc:${kindHex(k)}}`).join('\n') + '\n.k-mine{--kc:var(--line)}';
}
const PAL_NOTE = '<p class="muted small palnote"><i class="approxdot"></i> Afloat-only colour: Google Calendar’s connection can’t set it yet, so your phones show the nearest classic colour.</p>';
const isApprox = v => { const k = GCOL[v] ? String(v) : (PAL.find(p => p[3].toLowerCase() === String(v).toLowerCase()) || [])[0]; return !!k && !CLASSIC.includes(k); };
function swatches(list, cur, act, attrs = '') {
  const any = list.some(([, , val]) => isApprox(val));
  return `<div class="swatches" role="radiogroup">${list.map(([name, hex, val]) => { const on = String(cur).toLowerCase() === String(val).toLowerCase();
    return `<button type="button" class="sw${on ? ' on' : ''}${isApprox(val) ? ' approx' : ''}" style="--sw:${hex}" data-act="${act}" data-v="${val}" ${attrs} role="radio" aria-checked="${on}" aria-label="${name}" title="${name}"></button>`; }).join('')}</div>${any ? PAL_NOTE : ''}`;
}
const PSW = () => GSW().map(([n, h]) => [n, h, h]);
const GSW = () => GORDER.map(id => [`${GCOL[id][0]} (${GCOL[id][2]})${CLASSIC.includes(id) ? '' : ` · on phones: ${GCOL[toGoogle(id)][0]}`}`, GCOL[id][1], id]);
function colPick(key, label, hex, body) {
  const open = S.ui.colOpen === key;
  return `<div class="colrow"><button type="button" class="colbtn" data-act="col-open" data-k="${esc(key)}" aria-expanded="${open}"><span class="pdot big" style="background:${hex}"></span>${label}<span class="muted small">${open ? 'Done' : 'Change'}</span></button>${open ? body : ''}</div>`;
}
function setPersonColor(n, hex) {
  const o = { ...H('profiles') }, before = Object.fromEntries(Object.entries(S.events || {}).map(([id, e]) => [id, autoColorId(e)]));
  if (isFriend(n)) o.friends = friendsL().map(f => f.name === n ? { ...f, color: hex } : f);
  else o.people = { ...(o.people || {}), [n]: { ...pInfo(n), color: hex } };
  saveHome('profiles', o); recolourGoogle(id => before[id] !== autoColorId(S.events[id]));
}
/* keep Google's colours in step when the rule's inputs change */
async function recolourGoogle(pick, quiet) {
  const c = calCfg(); if (!mcp || !c.calId) return 0;
  const ids = Object.entries(S.events || {}).filter(([id, e]) => e.gId && !e.color && (e.endDate || e.date) >= realToday() && pick(id, e)).map(([id]) => id).slice(0, 60);
  let n = 0; for (const id of ids) { const e = S.events[id]; try { const r = await mcp.callTool(GC, 'update_event', { calendarId: c.calId, eventId: e.gId, colorId: toGoogle(autoColorId(e)), notificationLevel: 'NONE' }, { cache: false });
    const upd = ((r && r.payload) || {}).updated; if (upd) { S.events = { ...S.events, [id]: { ...e, gUpd: upd } }; if (db) q('events/' + id, () => db.doc('events/' + id).update({ gUpd: upd })); } n++; } catch (er) { if (/not found|deleted|gone/i.test(String(er && er.message))) continue; break; } } /* one deleted in Google is skipped, not the end of the run */
  if (n && !quiet) toast(`Recoloured ${n} upcoming event${n === 1 ? '' : 's'} in Google to match.`);
  return n;
}
function setTogether(id) { saveHome('calendar', { ...calCfg(), togetherColor: id }); recolourGoogle((i, e) => hhOf(e).length > 1); }
S.events = {}; S.gcal = { status: 'idle', events: [], mine: [] };
const gIso = d => `${keyOf(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
const addMin = (t, n) => { const m = toMin(t) + n; return `${pad(Math.floor((m % 1440) / 60))}:${pad(m % 60)}`; };
const showMine = () => lsGet('afloat.mine') === '1';
/* household names match inside words (Eva in Evička); friends' names only as whole words, so "If" doesn't match every "if" */
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const uniq = a => [...new Set(a)];
const friendsByEmail = ems => friendsL().filter(f => f.email && ems.includes(f.email.toLowerCase())).map(f => f.name);
/* ---------- taps on this area's buttons (data-act), called from events.js; true = handled ---------- */
function tapColours(a, el, e, r) {
  switch (a) {
    case 'col-open': S.ui.colOpen = S.ui.colOpen === el.dataset.k ? null : el.dataset.k; render(true); return true;
  }
  return false;
}
