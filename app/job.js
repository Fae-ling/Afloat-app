/* Afloat · app/job.js · The day a job starts: saved work hours, switch from freelance and back.
   Plain script: shares one scope with the other app/*.js files (loaded in order by index.html). See CLAUDE.md. */
/* ---------- the day a job starts (6 Nov 2026): a saved switch from freelance to set hours, ready to flip in one tap.
   prof(n).job = { start, finish, days, travel }; switching keeps the old setup in prof(n).wasFlex to switch back.
   With a job, this person does drop-off on the way (dropsOff), and the household's sick-day carer can be set. ---------- */
function jobCard() {
  if (!meValid()) return ''; const p = prof(me), j = p.job || {}, on = !!p.wasFlex, o = otherOf(me), hh = H('household');
  return `<h3>When ${on ? 'I have' : 'I start'} a job</h3>
    <p class="muted small">${on ? 'Afloat is set to your job’s hours. Switch back any time; nothing else is lost.' : 'Fill this in whenever you like. When the job starts, one tap switches Afloat from freelance to set hours: leave and back times, drop-off on the way, the briefings.'}</p>
    <form class="addform" data-form="job"><label class="small">Starts <input type="time" name="start" value="${esc(j.start || '08:30')}"></label><label class="small">Finishes <input type="time" name="finish" value="${esc(j.finish || '16:30')}"></label><label class="small">Travel <input type="number" name="travel" min="0" max="180" value="${esc(String(j.travel ?? 30))}" style="width:4.5em"> min</label><button class="btn ghost" type="submit">Save</button></form>
    <div class="actions">${on ? `<button class="btn ghost" data-act="job-off">Back to freelance</button>` : `<button class="btn" data-act="job-on">The job has started: switch now</button>`}</div>
    ${o ? `<p class="small">When a girl is sick: <span class="pills">${[me, o, ''].map(v => `<button class="pill${(hh.sickCarer || '') === v ? ' on' : ''}" data-act="sick-carer" data-v="${esc(v)}">${v ? esc(v) + ' stays home' : 'We decide each time'}</button>`).join('')}</span></p>` : ''}`;
}
function jobOn() {
  const f = document.querySelector('form[data-form=job]'), p = prof(me);
  const j = f ? { ...(p.job || {}), start: f.start.value || '', finish: f.finish.value || '', travel: Math.max(0, Math.min(180, +f.travel.value || 0)) } : (p.job || {});
  if (!j.start) return toast('Fill in when the job starts first.');
  const tr = +j.travel || 0, leave = mm2t(toMin(j.start) - tr - (kidsList().length ? 25 : 5)), back = mm2t(toMin(j.finish || '16:30') + tr);
  savePeople(me, { job: j, wasFlex: { workStyle: p.workStyle || 'flex', workdays: p.workdays || null, leave: p.leave || '', back: p.back || '', start: p.start || '', dropsOff: !!p.dropsOff }, workStyle: 'fixed', workdays: j.days || [0, 1, 2, 3, 4], leave, back, start: j.start, dropsOff: true });
  toast(`Switched: out at ${leave} with drop-off on the way, back around ${back}.`);
}
function jobOff() { const p = prof(me), w = p.wasFlex || {}; savePeople(me, { workStyle: w.workStyle || 'flex', workdays: w.workdays || [0, 1, 2, 3, 4], leave: w.leave || '', back: w.back || '', start: w.start || '', dropsOff: !!w.dropsOff, wasFlex: null }); toast('Back to freelance.'); }
function vTogether() {
  const pair = relPair(), day = DAYS_LONG[relDay()];
  let h = `<section class="hero"><p class="eyebrow">Together</p><h1>A small check-in, once a week.</h1><p class="lede">About 15 minutes on ${day} date night. Warm things first, then one topic at most.</p></section>`;
  if (!pair || !meValid()) return h + `<section class="card"><p class="muted small">This needs both of you set up in Afloat.</p></section>`;
  if (!pair.includes(me)) return h + `<section class="card"><p class="muted small">Together is for ${esc(pair[0])} and ${esc(pair[1])}. Their check-ins stay between the two of them.</p></section>`;
  const o = partnerOf(me), st = relDone() ? 5 : relStep(), isDay = dow() === relDay(), last = relLast();
  relPastLoad(); const lreq = last ? relReqFor(last) : {};
  if (st === 0) {
    h += `<section class="card"><div class="sec-head"><h2>This week’s appreciations</h2><span class="progress">${apprOf(me).length}</span></div>
      <p class="muted small">Jot small things ${esc(o)} did this week that you liked, whenever you notice them. ${esc(o)} sees them only when you start the check-in together.</p>
      ${apprList(me, true)}
      <form class="addform" data-form="rel-appr"><input type="text" name="text" placeholder="e.g. Took the girls so I could finish editing" required aria-label="Something you appreciated"><button class="btn" type="submit">Add</button></form>
      <p class="muted small">${esc(o)} has written ${apprOf(o).length || 'none yet'}.</p></section>`;
    h += `<section class="card"><div class="sec-head"><h2>${isDay ? 'Tonight’s check-in' : `Next check-in: ${day}`}</h2></div>
      ${Object.values(lreq).some(v => v) ? `<p class="small"><b>Last time you asked each other:</b></p><ul class="bf-list">${Object.entries(lreq).filter(([, v]) => v).map(([n, v]) => `<li>${n === me ? 'You' : esc(n)}: ${esc(v)}</li>`).join('')}</ul>` : ''}
      <p class="muted small">Four short steps: appreciations, what’s going well, one thing to talk about (optional), one request each. Sit together; one phone is enough.</p>
      <div class="actions"><button class="btn accent" data-act="rel-step" data-v="1">Start the check-in</button>${isDay ? '<button class="link" data-act="rel-skip">Not this week</button>' : ''}</div></section>`;
  } else if (st < 5) {
    h += `<section class="card rel-step"><div class="sec-head"><h2>${REL_STEPS[st]}</h2><span class="progress">${st} of 4</span></div>${relStepBody(st, o)}${relNav(st, st === 4 ? 'Finish' : 'Next')}</section>
      <div class="actions"><button class="link" data-act="rel-step" data-v="0">Pause, carry on later</button><a class="link" href="#overload">Too much right now</a></div>`;
  } else {
    const req = (relThis() || {}).req || {}, mine = req[me] || relReqOf(me), theirs = req[o] || relReqOf(o);
    h += `<section class="card"><div class="sec-head"><h2>${S.week.relSkipped ? 'Skipped this week' : 'Check-in done ★'}</h2></div>
      ${S.week.relSkipped ? '<p class="muted small">That’s fine. Next week is another go.</p>' : `<p class="muted small">Nicely done. Your requests stay on Today for the week, as a quiet reminder.</p>
      <ul class="bf-list rel-reqs">${mine ? `<li>You asked ${esc(o)}: ${esc(mine)}</li>` : ''}${theirs ? `<li>${esc(o)} asked you: ${esc(theirs)}</li>` : `<li class="muted">${esc(o)} hasn’t added a request yet. It shows here as soon as they do.</li>`}</ul>
      ${mine ? '' : `<label class="small">Your request: ${esc(o)}, this week could you… <input type="text" id="rq_me" data-act="rel-req" placeholder="Your request" aria-label="Your request"></label>`}`}
      <div class="actions"><button class="link" data-act="rel-step" data-v="1">Open it again</button></div></section>`;
  }
  h += ideasCard(false) + checkupSection() + areasCard();
  const hist = (H('relationship').history || []).filter(x => x.wk !== wk).slice(0, 6);
  if (hist.length) h += `<section class="card"><div class="sec-head"><h2>Earlier weeks</h2></div><ul class="bf-list">${hist.map(x => `<li><b>${fmtD(x.date)}</b>${Object.entries(relReqFor(x)).filter(([, v]) => v).map(([n, v]) => ` · ${esc(n)}: ${esc(v)}`).join('')}</li>`).join('')}</ul></section>`;
  return h;
}
function relStepBody(st, o) {
  if (st === 1) return `<p class="muted small">Take turns reading them out. For each one, say what it shows about the other person (“…that’s so you: thoughtful”).</p>
    <h3>From you</h3>${apprList(me, true)}<h3>From ${esc(o)}</h3>${apprList(o, false)}`;
  if (st === 2) return `${cuFocusLine() ? `<p class="small"><b>Your focus from the check-up:</b> ${esc(cuFocusLine())}. Anything on that this week?</p>` : ''}<p class="muted small">Pick one or two, no need to cover them all:</p><ul class="bf-list"><li>What felt good between us this week?</li><li>What got easier, at home or with the girls?</li><li>A moment you’d like more of?</li><li>Something silly that made you laugh?</li></ul>`;
  if (st === 3) {
    const t = S.week.relTalk || {}, P = H('relationship').parked || [], by = t.by || '';
    const say = t.feel || t.about || t.need ? `“I feel ${esc(t.feel || '…')} about ${esc(t.about || '…')}, and what I need is ${esc(t.need || '…')}.”` : '';
    return `<p class="muted small">Optional. One topic, the smallest one that matters. If either of you is tired or overloaded, park it instead; that’s a good choice, not avoiding.</p>
      ${P.length ? `<p class="small"><b>Parked from before</b></p><ul class="edit-list">${P.map(x => `<li><div class="txt">${esc(x.text)} <span class="muted small">· ${esc(x.by)}</span></div><button class="chip x row-x" data-act="rel-unpark" data-id="${x.id}" aria-label="Talked about it">✓</button></li>`).join('')}</ul>` : ''}
      <div class="situ-row"><span class="small"><b>Who starts?</b></span><div class="pills">${[me, o].map(n => `<button type="button" class="pill${by === n ? ' on' : ''}" data-act="rel-by" data-v="${esc(n)}">${n === me ? 'Me' : esc(n)}</button>`).join('')}</div></div>
      ${by ? `<div class="rel-say"><p class="small"><b>${by === me ? 'You speak' : `${esc(by)} speaks`}</b>: say it softly. Describe the situation, not what’s wrong with the other person.</p>
        <div class="addform"><label class="small">I feel <input type="text" data-act="rel-talk" data-f="feel" id="rt_feel" value="${esc(t.feel || '')}" placeholder="worried, tired, left out…"></label>
        <label class="small">about <input type="text" data-act="rel-talk" data-f="about" id="rt_about" value="${esc(t.about || '')}" placeholder="the situation, e.g. evenings this week"></label>
        <label class="small">and I need <input type="text" data-act="rel-talk" data-f="need" id="rt_need" value="${esc(t.need || '')}" placeholder="what would help, said positively"></label></div>
        ${say ? `<p class="small">${say}</p>` : ''}
        <p class="small"><b>${by === me ? esc(o) : 'You'} listen</b>: to understand, not to answer. No defending yet. Say back what you heard, then ask “is there more?”</p>
        <div class="chips"><button class="tiny" data-act="timer" data-min="3" data-label="Speaker’s turn">3-minute turns</button><button class="tiny" data-act="rel-by" data-v="${esc(by === me ? o : me)}">Swap turns</button>${t.about ? '<button class="tiny" data-act="rel-park">Park it for next week</button>' : ''}</div></div>` : ''}`;
  }
  if (st === 4) return `<p class="muted small">Each of you: one thing the other could do this week to help you feel closer. Small, doable and positive: “text me once at lunch”, not “stop ignoring me”.</p>
    <label class="small">${esc(o)}, this week could you… <input type="text" id="rq_me" data-act="rel-req" value="${esc(relReqOf(me))}" placeholder="Your request" aria-label="Your request"></label>
    ${relReqOf(o) ? `<p class="small"><b>${esc(o)} asks you:</b> ${esc(relReqOf(o))}</p>` : `<p class="muted small">${esc(o)} can type theirs on this phone too: <button class="link" data-act="rel-req-other">write ${esc(o)}’s</button></p>`}
    ${S.ui.relOther ? `<label class="small">${esc(o)}’s request for you <input type="text" id="rq_o" data-act="rel-req" data-n="${esc(o)}" value="${esc(relReqOf(o))}"></label>` : ''}`;
  return '';
}
function relFinish() {
  const pair = relPair(); if (!pair) return;
  /* take what's in the boxes right now, in case the phone didn't save the last typing before Finish was tapped */
  const box = { rq_me: me, rq_o: partnerOf(me) }, typed = {};
  Object.entries(box).forEach(([id, n]) => { const el = document.getElementById(id); if (el && el.value.trim()) typed['relReq:' + n] = el.value.trim(); });
  if (Object.keys(typed).length) { S.week = { ...S.week, ...typed }; mergeDoc('weeks/' + wk, typed); }
  const R = H('relationship'), req = Object.fromEntries(pair.map(n => [n, relReqOf(n)])), t = S.week.relTalk || {};
  const T0 = (R.history || []).find(x => x.wk === wk) || {};
  Object.keys(req).forEach(n => { if (!req[n] && (T0.req || {})[n]) req[n] = T0.req[n]; }); /* never blank out what the other already saved */
  relHistWrite(wk, { req: Object.fromEntries(Object.entries(req).filter(([, v]) => v)), talked: !!t.about || !!T0.talked });
  relSet({ ['relStep:' + me]: 5, relSkipped: false });
}
/* nudges elsewhere: the date-night card, the briefing, and this week's request on Today */
function relNudges(sl) {
  const out = []; if (!relPair() || !meValid() || !relPair().includes(me)) return out;
  const o = partnerOf(me), d = dow(), st = relDone() ? 5 : relStep(), T0 = relThis() || ((H('relationship').history || [])[0]);
  relPastLoad(); const T = T0 && { ...T0, req: T0.wk === wk ? T0.req : relReqFor(T0) };
  if (d !== relDay() && dateEvOn(dk) && (sl === 'evening' || sl === 'day')) out.push({ t: `Date night today (${shortTitle(dateEvOn(dk).title)}): ideas are ready.`, act: 'go-together' });
  if (d === relDay() && st < 5 && (sl === 'evening' || sl === 'day')) out.push({ t: `Check-in tonight: about 15 minutes, together.`, act: 'go-together' });
  else if (d < relDay() && sl === 'evening' && !apprOf(me).length) out.push({ t: `Something ${o} did this week you appreciated? Jot it for ${DAYS_LONG[relDay()]}.`, act: 'go-together' });
  out.push(...cuNudges(sl));
  if (T && T.req && T.req[o] && (sl === 'morning' || sl === 'day') && dayDiffK(T.date, dk) <= 7 && !(d === relDay() && T.wk !== wk)) out.push({ t: `${o} asked this week: “${T.req[o]}”` });
  return out;
}
const dayDiffK = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 864e5);
/* ---------- taps on this area's buttons (data-act), called from events.js; true = handled ---------- */
function tapJob(a, el, e, r) {
  switch (a) {
    case 'job-on': jobOn(); return true;
    case 'job-off': jobOff(); return true;
    case 'sick-carer': saveHome('household', { ...H('household'), sickCarer: el.dataset.v || '' }); return true;
    case 'rel-step': { const v = +el.dataset.v; if (v === 5) relFinish(); else relSet({ ['relStep:' + me]: v }); scrollTo(0, 0); return true; }
    case 'rel-skip': relSet({ relStep: 5, relSkipped: true }); return true;
    case 'rel-by': relSet({ relTalk: { ...(S.week.relTalk || {}), by: el.dataset.v } }); return true;
    case 'rel-park': { const t = S.week.relTalk || {}, R = H('relationship'); if (!t.about) return true;
      saveHome('relationship', { ...R, parked: [...(R.parked || []), { id: uid(), text: [t.feel && `feeling ${t.feel}`, `about ${t.about}`, t.need && `needs ${t.need}`].filter(Boolean).join(', '), by: t.by || me, at: Date.now() }] });
      relSet({ relTalk: { by: t.by } }); toast('Parked for next week.'); return true; }
    case 'rel-unpark': { const R = H('relationship'); saveHome('relationship', { ...R, parked: (R.parked || []).filter(x => x.id !== el.dataset.id) }); return true; }
    case 'rel-req-other': S.ui.relOther = true; render(true); return true;
  }
  return false;
}
