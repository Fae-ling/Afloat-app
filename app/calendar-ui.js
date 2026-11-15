/* Afloat · app/calendar-ui.js · The Calendar screen: week lanes, month grid, list, timetable; girls' time with grandparents.
   Plain script: shares one scope with the other app/*.js files (loaded in order by index.html). See CLAUDE.md. */
/* ---------- calendar UI: week with family lanes, month grid, list ---------- */
const calAdd = (k, n) => { const d = new Date(k + 'T12:00'); d.setDate(d.getDate() + n); return keyOf(d); };
const weekStartOf = k => { const d = new Date(k + 'T12:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return keyOf(d); };
const realToday = () => keyOf(new Date());
const fmtShort = k => new Date(k + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const shortTitle = t => String(t).replace(/\s·\s.*$/, '');
function ensureRange(sel) {
  const c = calCfg();
  if (!mcp || !(c.calId || c.gpId) || S.gcal.status === 'idle' || S.gcal.status === 'loading') return;
  if (sel < calRange[0] || sel > calRange[1]) { S.ui.calFocus = sel; setTimeout(calLoad, 0); }
}
function dotsFor(es) {
  const seen = new Set(), out = [];
  for (const e of es) { if (e.kind === 'mine' && !e.isDate) continue; const ppl = (e.who || []).length ? e.who : ['']; for (const n of ppl) if (!seen.has(n)) { seen.add(n); out.push(`<s style="background:${n ? pColor(n) : GCOL[NOBODY_COL][1]}"${n ? ` title="${esc(n)}"` : ''}></s>`); } }
  return out.slice(0, 5).join('') + (out.length > 5 ? '<em>+</em>' : '');
}
function colourLegend(withLink) {
  const ppl = [...everyone(), ...friendNames().filter(n => !everyone().includes(n))];
  return `<p class="muted small legend">${ppl.map(n => `<span><i style="background:${pColor(n)}"></i>${esc(n)}</span>`).join('')}<span><i style="background:${GCOL[togetherCol()][1]}"></i>Together</span>${withLink ? '<button class="linkish" data-act="go-colours">Change colours</button>' : ''}</p>`;
}
/* ---------- timetable (Today and Week): days across, hours down, like a school rozvrh ---------- */
function daySegs(k, evs) {
  const d0 = tsOf(k), d1 = tsOf(calAdd(k, 1)), segs = [], bg = [];
  for (const e of evs) {
    if (e.allDay) continue;
    const [a, b] = evSpan(e); if (b <= d0 || a >= d1) continue;
    const g = { e, s: Math.max(0, (a - d0) / 6e4), en: Math.min(1440, (b - d0) / 6e4), from: a < d0, to: b > d1 };
    (e.kind === 'grandma' || (g.from && g.to) ? bg : segs).push(g);
  }
  /* overlapping events share the width side by side; background bands (grandparents, multi-day) get their own lanes too */
  const laneOut = list => {
    list.sort((x, y) => x.s - y.s || y.en - x.en);
    let cl = [], lanes = [], end = -1;
    const flush = () => { cl.forEach(g => g.n = lanes.length); cl = []; lanes = []; };
    for (const g of list) {
      if (g.s >= end) { flush(); end = -1; }
      let i = lanes.findIndex(t => t <= g.s); if (i < 0) { i = lanes.length; lanes.push(0); }
      lanes[i] = g.en; g.lane = i; cl.push(g); end = Math.max(end, g.en);
    }
    flush();
  };
  laneOut(segs); laneOut(bg);
  return { segs, bg };
}
/* the week as a class schedule: a column per day, events stacked as cards in the colour of who's going */
function weekCards(days) {
  const evs = allEvents(), today = realToday(), sel = S.ui.calSel || today;
  const act = e => e.src === 'gp' ? 'gw-open' : e.src === 'mine' || e.src === 'invite' ? 'noop' : 'ev-open';
  const ids = e => `data-id="${esc(e.id || '')}" data-g="${esc(e.gId || '')}"`;
  const lbl = e => `${esc(shortTitle(e.title))}, ${esc(evTime(e))}${(e.who || []).length ? ', ' + esc(e.who.join(', ')) : ''}`;
  const dots = e => (e.who || []).length > 1 ? `<i class="wk-dots">${e.who.slice(0, 5).map(n => `<s style="background:${pColor(n)}"></s>`).join('')}</i>` : '';
  const cols = days.map((k, i) => {
    const es = evs.filter(e => e.date <= k && (e.endDate || e.date) >= k);
    const isBand = e => e.allDay || e.kind === 'grandma' || (e.date < k && (e.endDate || e.date) > k);
    const bands = es.filter(isBand), timed = es.filter(e => !isBand(e));
    const st = e => e.date < k ? '00:00' : e.start || '00:00';
    timed.sort((a, b) => st(a).localeCompare(st(b)));
    const gaps = gapsOn(k).map(g => ({ g, t: keyOf(new Date(g.s)) === k ? hm(new Date(g.s)) : '00:00' }));
    const items = [...timed.map(e => ({ e, t: st(e) })), ...gaps].sort((a, b) => a.t.localeCompare(b.t));
    const card = it => it.g ? `<button class="wk-gap" data-act="go-sit" aria-label="Hlídání needed ${esc(fmtGap(it.g))}"><b>${keyOf(new Date(it.g.s)) === k ? hm(new Date(it.g.s)) : '…'}</b><span>Hlídání?</span></button>`
      : (e => `<button class="wk-card" style="${ecs(e)}" data-act="${act(e)}" ${ids(e)} aria-label="${lbl(e)}"><b>${e.date < k ? 'until ' + esc(e.end) : esc(e.start)}</b><span lang="cs">${esc(shortTitle(e.title))}</span>${dots(e)}</button>`)(it.e);
    const band = e => `<button class="wk-band" style="${ecs(e)}" data-act="${act(e)}" ${ids(e)} aria-label="${lbl(e)}">${e.date < k && i ? '↳ ' : ''}${esc(shortTitle(e.title))}</button>`;
    return `<div class="wk-col${k === today ? ' today' : ''}${k === sel ? ' sel' : ''}${girlsAt(k) === 'home' ? ' ghome' : ''}" data-act="cal-sel" data-k="${k}">
      <button class="wk-head" data-act="${k === sel ? 'cal-day' : 'cal-sel'}" data-k="${k}" aria-label="${dayLabel(k)}${k === sel ? ', open this day' : ''}"><span>${DAYS[i]}</span><b>${+k.slice(8)}</b></button>
      ${bands.map(band).join('')}${items.map(card).join('')}${!es.length && !gaps.length ? '<span class="wk-free">free</span>' : ''}</div>`;
  });
  return `<div class="wk">${cols.join('')}</div>`;
}
function timetable(days, wide) {
  const evs = allEvents(), today = realToday(), sel = S.ui.calSel || today, HH = wide ? 56 : 42;
  const per = days.map(k => ({ k, ...daySegs(k, evs), all: evs.filter(e => e.allDay && e.date <= k && (e.endDate || e.date) >= k), gaps: gapsOn(k) }));
  let h0 = 7, h1 = 21;
  for (const p of per) for (const g of p.segs) { h0 = Math.min(h0, Math.floor(g.s / 60)); h1 = Math.max(h1, Math.ceil(g.en / 60)); }
  h1 = Math.min(24, Math.max(h1, h0 + 1));
  const y = m => (Math.min(Math.max(m, h0 * 60), h1 * 60) - h0 * 60) / 60 * HH;
  const act = e => e.src === 'gp' ? 'gw-open' : e.src === 'mine' || e.src === 'invite' ? 'noop' : 'ev-open';
  const ids = e => `data-id="${esc(e.id || '')}" data-g="${esc(e.gId || '')}"`;
  const lbl = e => `${esc(shortTitle(e.title))}, ${esc(evTime(e))}${(e.who || []).length ? ', ' + esc(e.who.join(', ')) : ''}`;
  const chips = e => (e.who || []).length ? `<span class="tt-who">${e.who.map(n => `<span class="whochip" style="--c:${pColor(n)}">${esc(n)}</span>`).join('')}</span>` : '';
  const dots = e => (e.who || []).length ? `<span class="tt-dots">${e.who.map(n => `<i style="background:${pColor(n)}"></i>`).join('')}</span>` : '';
  /* on the day view a box never clips its text: short events get a compact layout, and every box can grow taller than its time slot */
  const blk = g => { const e = g.e, top = y(g.s), h = Math.max(wide ? 28 : 22, y(g.en) - top), n = g.n || 1, l = g.lane || 0, dur = g.en - g.s;
    const size = !wide ? '' : dur >= 90 ? '' : dur >= 45 ? ' mid' : ' short', meta = `${esc(evTime(e))}${e.place ? ' · ' + esc(e.place) : ''}`;
    return `<button class="tt-ev k-${e.kind}${g.from ? ' from' : ''}${g.to ? ' to' : ''}${size}" style="${ecs(e)}top:${top}px;${wide ? 'min-height' : 'height'}:${h}px;left:calc(${l} * var(--evw) / ${n} + 1px);width:calc(var(--evw) / ${n} - 2px)" data-act="${act(e)}" ${ids(e)} aria-label="${lbl(e)}">`
      + (wide ? (size === ' short' ? `<span class="tt-row"><b>${esc(e.title)}</b><span class="tt-meta">${meta}</span>${dots(e)}</span>`
        : size === ' mid' ? `<b>${esc(e.title)}</b><span class="tt-row"><span class="tt-meta">${meta}</span>${chips(e)}</span>`
        : `<b>${esc(e.title)}</b><span class="tt-meta">${meta}</span>${chips(e)}`)
              : `${!g.from && h >= 34 ? `<em>${esc(e.start)}</em>` : ''}<b>${esc(shortTitle(e.title))}</b>${dots(e)}`) + '</button>'; };
  const bgb = g => { const e = g.e, top = y(g.s), h = Math.max(18, y(g.en) - top), n = g.n || 1, l = g.lane || 0;
    return `<button class="tt-bg k-${e.kind}" style="${ecs(e)}top:${top}px;height:${h}px;left:calc(var(--bgl) + (100% - var(--bgl)) * ${l} / ${n});width:calc((100% - var(--bgl)) / ${n} - ${n > 1 ? 2 : 0}px);right:auto" data-act="${act(e)}" ${ids(e)} aria-label="${lbl(e)}"><span>${esc(shortTitle(e.title))}</span>${wide ? chips(e) : ''}</button>`; };
  const gapb = (k, gp) => { const d0 = tsOf(k), s = Math.max(0, (gp.s - d0) / 6e4), en = Math.min(1440, (gp.e - d0) / 6e4); if (en <= s) return ''; const top = y(s);
    return `<button class="tt-gap" style="top:${top}px;height:${Math.max(20, y(en) - top)}px" data-act="go-sit" aria-label="Hlídání needed">${wide ? 'Hlídání needed: you’re both busy' : 'Hlídání?'}</button>`; };
  const nowM = new Date().getHours() * 60 + new Date().getMinutes();
  const head = wide ? '' : `<div class="tt-head"><span></span>${per.map(p => { const i = (new Date(p.k + 'T12:00').getDay() + 6) % 7;
    return `<button class="wd${p.k === sel ? ' sel' : ''}${p.k === today ? ' today' : ''}${girlsAt(p.k) === 'home' ? ' ghome' : ''}" data-act="${p.k === sel ? 'cal-day' : 'cal-sel'}" data-k="${p.k}" aria-label="${dayLabel(p.k)}${p.k === sel ? ', open this day' : ''}"><span>${DAYS[i]}</span><b>${+p.k.slice(8)}</b>${p.gaps.length ? '<i class="gapmark" title="Hlídání needed"></i>' : ''}</button>`; }).join('')}</div>`;
  const anyAll = per.some(p => p.all.length);
  const allrow = anyAll ? `<div class="tt-allrow"><span class="tt-lab">all day</span>${per.map(p => `<div class="tt-allc">${p.all.map(e => { const from = e.date < p.k, to = (e.endDate || e.date) > p.k;
    return `<button class="tt-chip k-${e.kind}${from ? ' from' : ''}${to ? ' to' : ''}" style="${ecs(e)}" data-act="${act(e)}" ${ids(e)} aria-label="${lbl(e)}">${from && p.k !== days[0] && !wide ? '&nbsp;' : esc(wide ? e.title : shortTitle(e.title))}</button>`; }).join('')}</div>`).join('')}</div>` : '';
  const hours = Array.from({ length: h1 - h0 }, (_, i) => `<span style="top:${i * HH}px">${wide ? pad(h0 + i) + ':00' : h0 + i}</span>`).join('');
  const cols = per.map(p => `<div class="tt-col${wide && p.bg.length && p.segs.length ? ' split' : ''}${p.k === today ? ' today' : ''}${!wide && p.k === sel ? ' sel' : ''}" data-act="${wide ? 'tt-new' : 'cal-sel'}" data-k="${p.k}" data-h0="${h0}" data-hh="${HH}">${p.bg.map(bgb).join('')}${p.gaps.map(g => gapb(p.k, g)).join('')}${p.segs.map(blk).join('')}${p.k === today && nowM >= h0 * 60 && nowM <= h1 * 60 ? `<i class="tt-now" style="top:${y(nowM)}px"></i>` : ''}${wide && !p.segs.length && !p.bg.length && !p.all.length ? '<span class="tt-free">Nothing planned. Tap a time to add something.</span>' : ''}</div>`).join('');
  return `<div class="tt${wide ? ' wide' : ''}" style="--cols:${days.length};--hh:${HH}px">${head}${allrow}<div class="tt-grid" style="height:${(h1 - h0) * HH}px"><div class="tt-hours">${hours}</div>${cols}</div></div>`;
}
function calUI() {
  let view = S.ui.calView || lsGet('afloat.calview') || 'week';
  if (view === 'lanes') view = 'week';
  const sel = S.ui.calSel || realToday(), today = realToday(), evs = allEvents();
  const on = k => evs.filter(e => e.date <= k && (e.endDate || e.date) >= k);
  ensureRange(sel);
  let label, body = '';
  if (view === 'month') {
    const first = sel.slice(0, 8) + '01', gs = weekStartOf(first), mon = sel.slice(0, 7);
    label = new Date(first + 'T12:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    body = `<div class="mgrid" role="grid" aria-label="${label}">${DAYS.map(d => `<span class="mh">${d.slice(0, 2)}</span>`).join('')}${Array.from({ length: 42 }, (_, i) => { const k = calAdd(gs, i), es = on(k);
      return `<button class="mc${k.slice(0, 7) !== mon ? ' out' : ''}${k === today ? ' today' : ''}${k === sel ? ' sel' : ''}${kidsAwayOn(k) ? ' away' : ''}${girlsAt(k) === 'home' ? ' ghome' : ''}${czHoliday(k) || kinderClosed(k) ? ' special' : ''}" data-act="${k === sel ? 'cal-day' : 'cal-sel'}" data-k="${k}" ${czHoliday(k) || kinderClosed(k) ? `title="${esc(czHoliday(k) || kinderClosed(k))}"` : ''} aria-label="${dayLabel(k)}${czHoliday(k) || kinderClosed(k) ? ', ' + esc(czHoliday(k) || kinderClosed(k)) : ''}${es.length ? ', ' + es.length + ' events' : ''}"><b>${+k.slice(8)}</b><i class="mdots">${dotsFor(es)}</i>${gapsOn(k).length ? '<i class="gapmark" title="Hlídání needed"></i>' : ''}</button>`; }).join('')}</div>`;
  } else if (view === 'week') {
    const ws = weekStartOf(sel), days = Array.from({ length: 7 }, (_, i) => calAdd(ws, i));
    label = `${+days[0].slice(8)} ${days[0].slice(5, 7) === days[6].slice(5, 7) ? '' : new Date(days[0] + 'T12:00').toLocaleDateString('en-GB', { month: 'short' }) + ' '}– ${fmtShort(days[6])}`;
    body = weekCards(days) + '<p class="muted small tt-hint">Tap a day to pick it, tap it again to open it.</p>';
  } else if (view === 'today') {
    label = sel === today ? 'Today' : new Date(sel + 'T12:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
    body = (kidsAwayOn(sel) ? '<p class="note">The girls are with their grandparents.</p>' : girlsAt(sel) === 'home' ? '<p class="note ghnote">The girls are home this day, not at kindergarten.</p>' : '') + timetable([sel], true);
  } else {
    label = 'Coming up';
    body = agendaHtml(60);
  }
  const es = on(sel);
  const dayPanel = view === 'list' || view === 'today' ? '' : `<section class="card dayp" data-sw-l="@cal-sel:${calAdd(sel, 1)}" data-sw-r="@cal-sel:${calAdd(sel, -1)}" data-sw-kind="page"><div class="sec-head"><h2>${dayLabel(sel)}</h2><div class="calbtns"><button class="tiny" data-act="cal-day" data-k="${sel}">Open day</button><button class="tiny" data-act="ev-new-day" data-k="${sel}">+ Add</button></div></div>
    ${kidsAwayOn(sel) ? '<p class="note">The girls are with their grandparents.</p>' : girlsAt(sel) === 'home' ? '<p class="note ghnote">The girls are home this day, not at kindergarten.</p>' : czHoliday(sel) || kinderClosed(sel) ? `<p class="note">${esc(czHoliday(sel) || kinderClosed(sel))}: no kindergarten.</p>` : ''}
    ${gapsOn(sel).map(g => `<p class="note">Hlídání needed ${esc(fmtGap(g).replace(/^[^,]*, /, ''))}: you’re both busy. <button class="linkish" data-act="sit-gp" data-s="${g.s}" data-e="${g.e}">Grandparents</button> · <button class="linkish" data-act="sit-other" data-s="${g.s}" data-e="${g.e}">Babysitter</button></p>`).join('')}
    ${es.length ? `<ul class="evlist">${es.map(evRow).join('')}</ul>` : '<p class="empty">Nothing planned. A free day.</p>'}</section>`;
  const G = S.gcal, status = G.status === 'loading' ? 'Checking Google…' : G.status === 'error' ? connMsg(G.err, 'Google Calendar') : '';
  const back = view === 'today' ? sel !== today : view === 'week' ? weekStartOf(sel) !== weekStartOf(today) : view === 'month' ? sel.slice(0, 7) !== today.slice(0, 7) : false;
  return `<section class="calwrap">
    <div class="calbar"><div class="seg" role="tablist" aria-label="Calendar view">${[['today', 'Today'], ['week', 'Week'], ['month', 'Month'], ['list', 'List']].map(([v, l]) => `<button role="tab" aria-selected="${view === v}" class="${view === v ? 'on' : ''}" data-act="cal-view" data-v="${v}">${l}</button>`).join('')}</div>
      <button class="btn accent addev" data-act="ev-new" aria-label="New event">+</button></div>
    ${view === 'list' ? `<h2 class="callabel">${label}</h2>` : `<div class="calnav"><button class="navbtn" data-act="cal-move" data-d="-1" aria-label="Previous">‹</button><h2 class="callabel">${label}</h2><button class="navbtn" data-act="cal-move" data-d="1" aria-label="Next">›</button></div>${back ? `<button class="tiny backtoday" data-act="cal-today">Back to ${view === 'today' ? 'today' : view === 'week' ? 'this week' : 'this month'}</button>` : ''}`}
    ${status ? `<p class="muted small">${esc(status)}</p>` : ''}
    ${view === 'list' ? body : `<div class="calbody" data-sw-l="[data-act=cal-move][data-d='1']" data-sw-r="[data-act=cal-move][data-d='-1']" data-sw-kind="page">${body}</div>`}
    <div class="calfoot">${kidsList().length ? `<button class="btn ghost gpbtn" data-act="gp-new">+ ${esc(theKids().replace(/^t/, 'T'))} with grandparents</button>` : ''}
    ${view !== 'list' ? colourLegend(true) : ''}
  </section>${dayPanel}`;
}

/* ---------- girls' time with grandparents: written to the grandparents' calendar ---------- */
const gpPeople = () => (calCfg().gpPeople && calCfg().gpPeople.length ? calCfg().gpPeople : adults().map(n => `${n}’s parents`));
const girlsTitle = g => g.length === 2 ? `${g[0]} & ${g[1]}` : g.join(', ');
function nextDow(i) { const d = new Date(); d.setHours(12, 0, 0, 0); const diff = (i - ((d.getDay() + 6) % 7) + 7) % 7 || 7; d.setDate(d.getDate() + diff); return keyOf(d); }
function gpWhoCard() {
  const f = S.ui.gpw, c = calCfg(), all = [...everyone(), ...friendNames().filter(n => !everyone().includes(n))];
  return `<section class="card gpform"><div class="sec-head"><h2>Who’s going</h2><button class="link" data-act="gw-cancel">Cancel</button></div>
    <p><b>${esc(f.title)}</b> · ${esc(dShort(f.date))}</p>
    <p class="muted small">This event is on ${esc(c.gpName || 'the grandparents’ calendar')}, which you can only read. Choose who is really going. It changes Afloat only and is never written to Google, so nothing changes for your parents. With one of you on it, it no longer counts as the girls being away, so there’s no drop-off and no hlídání to sort out.</p>
    <div class="pills">${all.map(n => `<button type="button" class="pill${f.who.includes(n) ? ' on' : ''}" data-act="gw-tog" data-n="${esc(n)}">${esc(n)}</button>`).join('')}</div>
    <div class="actions"><button class="btn accent" data-act="gw-save">Save</button>${f.had ? '<button class="link" data-act="gw-reset">Back to what the calendar says</button>' : ''}</div></section>`;
}
function newGp(seed) {
  const gps = gpPeople();
  S.ui.gpf = { gp: gps[gps.length - 1], girls: [...kidsList()], from: nextDow(5), fromT: '09:00', to: nextDow(5), toT: '17:00', drop: '', pick: '', notes: '', ...seed };
  S.ui.ev = null;
}
function gpPreset(k) {
  const f = S.ui.gpf, sat = nextDow(5), sun = calAdd(sat, 1), fri = calAdd(sat, -1);
  if (k === 'sat') Object.assign(f, { from: sat, fromT: '09:00', to: sat, toT: '17:00' });
  if (k === 'over') Object.assign(f, { from: sat, fromT: '16:00', to: sun, toT: '11:00' });
  if (k === 'weekend') Object.assign(f, { from: fri, fromT: '17:00', to: sun, toT: '17:00' });
  if (k === 'tomorrow') { const t = tKey(); Object.assign(f, { from: t, fromT: '09:00', to: t, toT: '17:00' }); }
}
const dShort = k => k ? new Date(k + 'T12:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
function gpSummary(f) {
  const same = f.from === f.to, ad = !f.fromT && !f.toT;
  const when = ad ? (same ? dShort(f.from) : `${dShort(f.from)} – ${dShort(f.to)}`) : same ? `${dShort(f.from)}, ${f.fromT}–${f.toT}` : `${dShort(f.from)} ${f.fromT} → ${dShort(f.to)} ${f.toT}`;
  const legs = [f.drop && `${f.drop === 'gp' ? 'Grandparents collect them' : f.drop + ' drops off'}`, f.pick && `${f.pick === 'gp' ? 'grandparents bring them back' : f.pick + ' picks up'}`].filter(Boolean).join(', ');
  return `<b>${esc(girlsTitle(f.girls) || 'Nobody yet')}</b> with ${esc(f.gp)} · ${esc(when)}${legs ? ' · ' + esc(legs) : ''}`;
}
function gpForm() {
  const f = S.ui.gpf, c = calCfg(), adults = members().map(m => m.name);
  const legPills = (key, title) => `<div><p class="small">${title}</p><div class="pills">${[...adults, 'gp'].map(n => `<button type="button" class="pill${f[key] === n ? ' on' : ''}" data-act="gp-leg" data-k="${key}" data-n="${esc(n)}">${n === 'gp' ? 'Grandparents' : esc(n)}</button>`).join('')}</div></div>`;
  return `<section class="card gpform"><div class="sec-head"><h2>${f.id ? 'Edit time with grandparents' : esc(theKids().replace(/^t/, 'T')) + ' with grandparents'}</h2><button class="link" data-act="gp-cancel">Cancel</button></div>
    ${c.gpId ? `<p class="muted small">Saved to <b>${esc(c.gpName)}</b>, so all the grandparents see it. Only the title, times and drop-off/pick-up go there, never your other events.</p>` : '<p class="note">Choose the grandparents’ calendar in Calendar settings first, then this is written there too.</p>'}
    <form data-form="gp" class="evgrid">
      <div><p class="small">With</p><div class="pills">${gpPeople().map(g => `<button type="button" class="pill${f.gp === g ? ' on' : ''}" data-act="gp-who" data-g="${esc(g)}">${esc(g)}</button>`).join('')}</div></div>
      <div><p class="small">Which girls</p><div class="chips">${kidsList().map(n => `<button type="button" class="whochip pick${f.girls.includes(n) ? ' on' : ''}" style="--c:${pColor(n)}" data-act="gp-girl" data-n="${esc(n)}" aria-pressed="${f.girls.includes(n)}">${esc(n)}</button>`).join('')}</div></div>
      <div><p class="small">Quick pick</p><div class="chips">${[['tomorrow', 'Tomorrow'], ['sat', 'Saturday, day'], ['over', 'Saturday overnight'], ['weekend', 'Whole weekend']].map(([k, l]) => `<button type="button" class="tiny" data-act="gp-preset" data-k="${k}">${l}</button>`).join('')}</div></div>
      <div class="gp-range">
        <div class="gp-end"><span class="eyebrow">From</span><input type="date" id="gpFrom" data-gpf="from" value="${esc(f.from)}" required aria-label="From date"><input type="time" id="gpFromT" data-gpf="fromT" value="${esc(f.fromT)}" aria-label="Drop-off time"></div>
        <span class="gp-arrow" aria-hidden="true">→</span>
        <div class="gp-end"><span class="eyebrow">Until</span><input type="date" id="gpTo" data-gpf="to" value="${esc(f.to)}" required aria-label="Until date"><input type="time" id="gpToT" data-gpf="toT" value="${esc(f.toT)}" aria-label="Pick-up time"></div>
      </div>
      <p class="muted small">Leave both times empty for whole days.</p>
      ${legPills('drop', 'Drop-off')}${legPills('pick', 'Pick-up')}
      <input type="text" id="gpNotes" data-gpf="notes" value="${esc(f.notes)}" placeholder="Note for everyone (optional), e.g. pack the swimsuits" aria-label="Note">
      <p class="gp-sum">${gpSummary(f)}</p>
      <div class="actions"><button class="btn accent" type="submit" ${S.ui.gpBusy ? 'disabled' : ''}>${S.ui.gpBusy ? 'Saving…' : 'Save'}</button>${f.id ? `<button type="button" class="btn ghost" data-act="gp-del">${S.ui.armDel ? 'Tap again to delete' : 'Delete'}</button>` : ''}</div>
    </form></section>`;
}
function gpGBody(f) {
  const ad = !f.fromT && !f.toT, t = `${girlsTitle(f.girls)} – ${f.gp}`;
  const legs = [f.drop && `Odvoz: ${f.drop === 'gp' ? 'prarodiče' : f.drop}`, f.pick && `Vyzvednutí: ${f.pick === 'gp' ? 'prarodiče' : f.pick}`].filter(Boolean).join('\n');
  let startTime, endTime;
  if (ad) { startTime = f.from + 'T00:00:00'; endTime = calAdd(f.to, 1) + 'T00:00:00'; }
  else { startTime = `${f.from}T${f.fromT || '09:00'}:00`; endTime = `${f.to}T${f.toT || '17:00'}:00`; }
  return { summary: t, description: `${legs}${legs && f.notes ? '\n' : ''}${f.notes || ''}\n(Afloat)`.trim(), startTime, endTime, ...(ad ? { allDay: true } : {}), colorId: kindCol('grandma'), useDefaultReminders: true };
}
async function saveGp() {
  const f = S.ui.gpf, c = calCfg();
  if (!f.girls.length) return toast('Pick at least one of the girls.');
  if (!f.from || !f.to || f.to < f.from || (f.to === f.from && f.fromT && f.toT && f.toT <= f.fromT)) return toast('The end needs to be after the start.');
  const id = f.id || uid() + uid(), ad = !f.fromT && !f.toT;
  const doc = { title: `${girlsTitle(f.girls)} with ${f.gp}`, kind: 'grandma', who: [...f.girls], date: f.from, endDate: f.to, allDay: ad, start: ad ? '' : f.fromT, end: ad ? '' : f.toT, place: '', notes: [f.drop && `Drop-off: ${f.drop === 'gp' ? 'grandparents' : f.drop}`, f.pick && `Pick-up: ${f.pick === 'gp' ? 'grandparents' : f.pick}`, f.notes].filter(Boolean).join(' · '), gp: f.gp, drop: f.drop, pick: f.pick, gpNotes: f.notes, gpOnly: true, gId: null, gpGId: f.gpGId || null, by: me || '', at: Date.now() };
  S.ui.gpBusy = true; render(true);
  const put = d => { S.events = { ...S.events, [id]: d }; return db ? q('events/' + id, () => db.doc('events/' + id).set(d)) : Promise.resolve(); };
  await put(doc);
  if (c.gpId && mcp) {
    try {
      if (doc.gpGId) await mcp.callTool(GC, 'update_event', { calendarId: c.gpId, eventId: doc.gpGId, ...gpGBody(f) }, { cache: false });
      else { const r = await mcp.callTool(GC, 'create_event', { calendarId: c.gpId, ...gpGBody(f) }, { cache: false }); const p = r.payload || {}, g = p.id || (p.event && p.event.id); if (g) await put({ ...doc, gpGId: g }); }
      toast(`★ Saved to ${c.gpName}.`); calLoad();
    } catch (e) { toast('Saved in Afloat. ' + connMsg(e, 'Google Calendar')); }
  } else toast('Saved in Afloat.');
  S.ui.gpBusy = false; S.ui.gpf = null; render(true);
}
/* ---------- the Calendar screen ---------- */
function vCalendar() {
  const c = calCfg(), G = S.gcal;
  let h = '';
  if (!mcp) h += '<p class="note">Google Calendar can’t be reached from this view. Events you add are kept in Afloat.</p>';
  else if (!c.calId) h += `<section class="card"><div class="sec-head"><h2>Choose the shared calendar</h2></div>
    <p class="muted small">Pick the private calendar just for the two of you, for example a new one called <b>Rodina</b>, shared only with ${esc(otherOf(me) || 'the people you live with')} with permission to make changes. Everything you add in Afloat goes here. Don’t pick a calendar the grandparents can see.</p>
    ${S.ui.cals ? `<div class="pills">${S.ui.cals.filter(x => x.id !== calCfg().gpId).map(x => `<button class="pill" data-act="cal-pick" data-id="${esc(x.id)}" data-name="${esc(x.summary || x.id)}">${esc(x.summary || x.id)}</button>`).join('')}</div>` : `<button class="btn" data-act="cal-list">Show my calendars</button>`}</section>`;
  if (S.ui.gpf) h += gpForm();
  else if (S.ui.ev) h += photoPanel() + evForm();
  else if (S.ui.gpw) h += gpWhoCard();
  const gN = upcomingGaps().length;
  if (!S.ui.gpf && !S.ui.ev) h += inviterCard();
  if (!S.ui.gpf && !S.ui.ev && gN) h += `<button class="sitbanner" data-act="go-sit"><i class="gapmark"></i>Hlídání needed: ${gN} coming up<span aria-hidden="true">↓</span></button>`;
  h += calUI();
  if (!S.ui.gpf && !S.ui.ev) h += `<div id="sitwrap">${sitCard()}</div>`;
  const status = G.status === 'loading' ? 'Checking Google…' : G.status === 'error' ? connMsg(G.err, 'Google Calendar') : '';
  h += sec('cal-colours', 'Colours', '', `<section class="card" id="colours-card"><p class="muted small">Events take the colour of <b>who’s going</b>: one of you means your colour; two or more of you means the Together colour (in Afloat you also see a stripe for each person); only friends means the friend’s colour; nobody ticked means grey. Google Calendar shows the same colours, except the 13 newer ones marked with a small ring, which show there as the nearest classic colour.</p>
    ${colourLegend(false)}
    ${colPick('together', 'Together colour', GCOL[togetherCol()][1], swatches(GSW(), togetherCol(), 'together-col'))}
    <p class="muted small">Change each person’s colour in <a class="link" href="#family">Us → Family</a>. Any single event can still have its own colour.</p></section>`, true);
  h += sec('cal-settings', 'Calendar settings', '', `<section class="card">
    ${c.calId ? `<p class="small">Shared calendar: <b>${esc(c.calName || c.calId)}</b> <button class="link" data-act="cal-change">Change</button></p>` : ''}
    <p class="small"><b>Grandparents’ calendar</b> (read only): ${c.gpId ? `<b>${esc(c.gpName)}</b> <button class="link" data-act="gp-clear">Stop reading it</button>` : 'none'}</p>
    <label class="small">Grandparents’ names (comma-separated) <input type="text" id="gpPeople" data-act="gp-people" value="${esc(gpPeople().join(', '))}"></label>
    <p class="muted small">Afloat shows its events as the girls being with their grandparents. It only writes there when you use “+ Grandparents” (or tick “Also put it on…”), and then only that one event.</p>
    ${!c.gpId ? (S.ui.cals2 ? `<div class="pills">${S.ui.cals2.filter(x => x.id !== c.calId).map(x => `<button class="pill" data-act="gp-pick" data-id="${esc(x.id)}" data-name="${esc(x.summary || x.id)}">${esc(x.summary || x.id)}</button>`).join('')}</div>` : '<button class="btn ghost" data-act="gp-list">Choose the grandparents’ calendar</button>') : ''}
    <label class="small">Kindergarten hours on weekdays (the girls are looked after then; leave empty to switch off) <input type="text" id="kinderH" data-act="kinder-h" value="${esc(calCfg().kinder ?? '07:30-16:00')}" placeholder="07:30-16:00" style="width:8em"></label>
    <p class="muted small">“Hlídání needed” appears when you’re both on events at the same time and the girls aren’t going, aren’t on the grandparents’ calendar, and it’s outside those hours. Events without names don’t count, so tick who’s going.</p>
    <label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="showMine" data-act="show-mine" ${showMine() ? 'checked' : ''}> Also show my own Google calendar (only on this device)</label>
    <div class="actions"><button class="btn ghost" data-act="cal-refresh">Refresh from Google</button></div>
    <p class="muted small">Events added on your phones in Google show up here too. Start the title with a name, like “${esc(kidsList()[0] || me || 'Eva')}: photo day”, and Afloat knows who it’s for.</p></section>`, true);
  return h;
}
function calTodayBody() {
  const t = dayKey(), tm = tKey(), a = eventsOn(t).filter(notOver), b = eventsOn(tm).filter(notOver), sit = sitCard(14, 'Hlídání needed soon');
  if (!a.length && !b.length) return sit;
  return sit + `<section class="card"><div class="sec-head"><h2>Coming up</h2><a class="link" href="#calendar">Calendar</a></div>
    ${a.length ? `<h3>Today</h3><ul class="evlist">${a.map(evRow).join('')}</ul>` : ''}${b.length ? `<h3>Tomorrow</h3><ul class="evlist">${b.map(evRow).join('')}</ul>` : ''}</section>`;
}
/* ---------- taps on this area's buttons (data-act), called from events.js; true = handled ---------- */
function tapCalendarUi(a, el, e, r) {
  switch (a) {
    case 'go-colours': COL['cal-colours'] = false; lsSet('afloat.col', JSON.stringify(COL)); render(true); setTimeout(() => { const c = document.getElementById('sec-cal-colours'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 0); return true;
    case 'go-sit': { const w = document.getElementById('sitwrap'); if (w) w.scrollIntoView({ behavior: 'smooth', block: 'start' }); return true; }
    case 'sit-gp': { const s = new Date(+el.dataset.s), e = new Date(+el.dataset.e); newGp({ from: keyOf(s), fromT: hm(s), to: hm(e) === '00:00' ? keyOf(new Date(+el.dataset.e - 1)) : keyOf(e), toT: hm(e) === '00:00' ? '23:59' : hm(e) }); if (S.view !== 'calendar') location.hash = 'calendar'; render(true); scrollTo(0, 0); return true; }
    case 'ev-new': newEv({ date: S.ui.calSel && S.ui.calSel >= realToday() ? S.ui.calSel : tKey() }); render(true); scrollTo(0, 0); return true;
    case 'ev-new-day': newEv({ date: el.dataset.k }); render(true); scrollTo(0, 0); return true;
    case 'cal-sel': S.ui.calSel = el.dataset.k; render(true); return true;
    case 'cal-view': S.ui.calView = el.dataset.v; lsSet('afloat.calview', el.dataset.v); render(true); return true;
    case 'cal-today': S.ui.calSel = realToday(); render(true); return true;
    case 'cal-day': S.ui.calSel = el.dataset.k; S.ui.calView = 'today'; lsSet('afloat.calview', 'today'); render(true); scrollTo(0, 0); return true;
    case 'cal-move': { const v = S.ui.calView || lsGet('afloat.calview') || 'week', cur = S.ui.calSel || realToday(), d = +el.dataset.d;
      if (v === 'month') { const x = new Date(cur.slice(0, 8) + '01T12:00'); x.setMonth(x.getMonth() + d); S.ui.calSel = keyOf(x); } else S.ui.calSel = calAdd(cur, (v === 'today' ? 1 : 7) * d);
      render(true); return true; }
    case 'gp-new': newGp({}); render(true); scrollTo(0, 0); return true;
    case 'gw-tog': { const w = S.ui.gpw.who, n = el.dataset.n; S.ui.gpw.who = w.includes(n) ? w.filter(x => x !== n) : [...w, n]; render(true); return true; }
    case 'gw-cancel': S.ui.gpw = null; render(true); return true;
    case 'gw-save': { const f = S.ui.gpw; S.ui.gpw = null; saveHome('gpwho', { ...H('gpwho'), by: { ...gpWhoMap(), [gpKey(f.g)]: f.who } }); toast('Saved in Afloat. Your parents’ calendar is untouched.'); return true; }
    case 'gw-reset': { const f = S.ui.gpw, by = { ...gpWhoMap() }; delete by[gpKey(f.g)]; S.ui.gpw = null; saveHome('gpwho', { ...H('gpwho'), by }); toast('Back to what the calendar says.'); return true; }
    case 'gp-cancel': S.ui.gpf = null; render(true); return true;
    case 'gp-who': S.ui.gpf.gp = el.dataset.g; render(true); return true;
    case 'gp-girl': { const g = S.ui.gpf.girls, n = el.dataset.n; S.ui.gpf.girls = g.includes(n) ? g.filter(x => x !== n) : [...g, n]; render(true); return true; }
    case 'gp-preset': gpPreset(el.dataset.k); render(true); return true;
    case 'gp-leg': { const f = S.ui.gpf, k = el.dataset.k; f[k] = f[k] === el.dataset.n ? '' : el.dataset.n; render(true); return true; }
    case 'gp-del': { if (!S.ui.armDel) { S.ui.armDel = true; render(true); return true; } S.ui.ev = { id: S.ui.gpf.id, gpGId: S.ui.gpf.gpGId }; S.ui.gpf = null; deleteEvent(); return true; }
    case 'cal-list': mcp && mcp.callTool(GC, 'list_calendars', {}, { cache: false }).then(r => { S.ui.cals = ((r.payload || {}).calendars || []).filter(x => !/#holiday|#contacts/.test(x.id)); render(true); }).catch(e => toast(connMsg(e, 'Google Calendar'))); return true;
    case 'cal-pick': saveHome('calendar', { calId: el.dataset.id, calName: el.dataset.name }); S.ui.cals = null; setTimeout(calLoad, 50); return true;
    case 'cal-change': saveHome('calendar', { ...calCfg(), calId: '' }); S.ui.cals = null; return true;
    case 'cal-refresh': calLoad(); return true;
    case 'gp-list': mcp && mcp.callTool(GC, 'list_calendars', {}, { cache: false }).then(r => { S.ui.cals2 = ((r.payload || {}).calendars || []).filter(x => !/#holiday|#contacts/.test(x.id)); render(true); }).catch(e => toast(connMsg(e, 'Google Calendar'))); return true;
    case 'gp-pick': saveHome('calendar', { ...calCfg(), gpId: el.dataset.id, gpName: el.dataset.name }); S.ui.cals2 = null; setTimeout(calLoad, 50); return true;
    case 'gp-clear': saveHome('calendar', { ...calCfg(), gpId: '', gpName: '' }); S.gcal = { ...S.gcal, gp: [] }; return true;
  }
  return false;
}
