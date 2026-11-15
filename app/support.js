/* Afloat · app/support.js · Support: brain dump, the hub, signals, overload plans, breathe, break it down, can't start. ("One thing" and the Five-things reset moved into Active → Focus → Taking care of my surroundings, app/surroundings.js, 10 Nov 2026.)
   Plain script: shares one scope with the other app/*.js files (loaded in order by index.html). See CLAUDE.md. */
/* ---------- brain dump ---------- */
function dumpDests() {
  const c = H('trello'), L = trL(), my = (c.people || {})[me];
  return [my && ['mine', 'My to-dos', my], ['shop', shopName('shop', 'Toiletries'), L.shop], ['food', shopName('food', 'Groceries'), L.food], ['med', shopName('med', 'Pharmacy'), L.med], ['chores', 'Chores', L.chores], ['home', 'Household', L.home], ['org', 'Organizace', L.org]].filter(x => x && x[2]);
}

/* ---------- Support: a calm hub, then one tool at a time ----------
   Hub (#support): "how are you right now?" tiles that each open one tool, sick-day mode, and any signals.
   Tools: Can't start (#stuck), Break it down (#breakdown, Claude), Overloaded (#overload: signals and each adult's
   overload plan), Breathe (#breathe: cyclic sighing, box breathing, 5-4-3-2-1), Priorities (#priorities); "The house is a lot" opens Active → Focus → Taking care of my surroundings.
   Data: home/signals {name: {kind, text, until, ack}}, home/support {plans: {name: {...}}, steps: {name: {task, level, steps}}}. */
I.sp_breathe = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3.5"/><circle cx="12" cy="12" r="8" stroke-dasharray="2.5 3"/></svg>';
I.sp_over = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4.5" height="6" rx="1.5"/><rect x="16.5" y="14" width="4.5" height="6" rx="1.5"/></svg>';
I.sp_steps = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19h5v-5h5V9h6"/><path d="M17 6l3 3-3 3"/></svg>';
I.sp_empty = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="16" height="10" rx="2.5"/><path d="M21 10.5v3"/><path d="M6.5 10.5v3"/></svg>';
I.sp_sick = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0Z"/><path d="M12 11v6"/></svg>';
I.sp_signal = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 18V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-4 3Z"/></svg>';
const back = () => `<a class="backlink" href="#support">‹ Support</a>`;
const SP_STATES = [
  ['stuck', 'Can’t get started', 'Want to, but can’t begin', 'stuck', 'accent'],
  ['breakdown', 'It’s too big', 'Turn it into tiny steps', 'sp_steps', 'violet'],
  ['overload', 'Too much input', 'Noise, people, demands', 'sp_over', 'sea'],
  ['breathe', 'Wound up', 'Two minutes to settle', 'sp_breathe', 'sea'],
  ['priorities', 'Running on empty', 'What can be set down today', 'sp_empty', 'amber'],
  ['reset', 'The house is a lot', 'Make the place livable, one step at a time', 'reset', 'amber']];
function vSupport() {
  const sk = sickOn();
  let h = `<section class="hero"><p class="eyebrow">Support</p><h1>What would help right now?</h1><p class="lede">Pick whatever fits. Nothing here needs a reason or a plan.</p></section>`;
  h += signalBanner(true);
  h += `<div class="sp-grid">${SP_STATES.map(([v, t, s, ic, tone]) => `<a class="sp-tile" href="#${v === 'reset' ? 'focus' : v}" ${v === 'priorities' ? 'data-act="sp-empty"' : v === 'reset' ? 'data-act="hm-go"' : ''} style="--tone:var(--${tone});--tone-soft:var(--${tone}-soft)"><span class="ic">${I[ic]}</span><b>${t}</b><span>${s}</span></a>`).join('')}</div>`;
  h += !sk && !kidsList().length ? '' : sk ? `<a class="sp-row sick on" href="#today"><span class="ic">${I.sp_sick}</span><span><b>Sick-day mode is on</b><span>Today shows medicines, temperatures and night shifts.</span></span><span class="go" aria-hidden="true">›</span></a>`
    : `<button class="sp-row sick" data-act="sick-on"><span class="ic">${I.sp_sick}</span><span><b>A kid is sick</b><span>Everything else pauses. Medicine times and temperatures are tracked.</span></span><span class="go" aria-hidden="true">›</span></button>`;
  const sig = (H('signals') || {})[me], hasPlan = meValid() && Object.values((H('support').plans || {})[me] || {}).some(Boolean);
  if (modOn('signals') || (sig && sig.until > Date.now())) h += `<a class="sp-row" href="#overload"><span class="ic">${I.sp_signal}</span><span><b>${sig && sig.until > Date.now() ? 'Your signal is on' : 'Tell the others without talking'}</b><span>A short message on everyone’s Today, like “Words offline, text me”.</span></span><span class="go" aria-hidden="true">›</span></a>`;
  if (meValid() && !hasPlan) h += `<p class="note">On a calm day, write your overload plan together: what you notice first, what helps and what doesn’t. <a class="link" href="#overload">Start it</a></p>`;
  return h;
}

/* ---------- signals: tell the household without talking ---------- */
const SIGNALS = [['words', 'Words offline', 'I can’t talk right now. Text me, yes/no questions are easiest.'], ['quiet', 'Need quiet', 'Too much input. Please keep things low-key around me.'],
  ['alone', 'Need time alone', 'I’m OK, just need some time alone to recharge.'], ['company', 'Need company', 'I’m stuck. Could you come and keep me company?']];
const sigsOn = () => Object.entries(H('signals') || {}).filter(([n, s]) => s && s.until > Date.now() && n);
function signalBanner(hub) {
  return sigsOn().map(([n, s]) => {
    const until = fmtT(s.until), lab = (SIGNALS.find(x => x[0] === s.kind) || [])[1] || 'Signal';
    if (n === me) return `<div class="sigbar mine" data-sw-l="[data-act=sp-sig-off]"><p><b>Your signal: ${esc(lab)}</b> until ${until}. ${s.ack ? `${esc(s.ack)} has seen it ✓` : 'Everyone sees it on Today.'}</p><button class="btn" data-act="sp-sig-off">I’m back</button></div>`;
    return `<div class="sigbar"${s.ack === me ? '' : ' data-sw-r="[data-act=sp-sig-ack]"'}><p><b>${esc(n)}: ${esc(lab)}</b> until ${until}<span>${esc(s.text)}</span></p>${s.ack === me ? '<span class="muted small">You answered ✓</span>' : `<button class="btn" data-act="sp-sig-ack" data-n="${esc(n)}">Got it, I’m with you</button>`}</div>`;
  }).join('') + (hub ? '' : '');
}
function setSignal(kind, mins) {
  const S2 = SIGNALS.find(x => x[0] === kind); if (!S2 || !meValid()) return;
  saveHome('signals', { ...H('signals'), [me]: { kind, text: kind === 'quiet' && kidsList().length ? `Too much input. Please take ${theKids()} and keep things low-key.` : S2[2], until: Date.now() + mins * 6e4, at: Date.now(), ack: '' } });
  toast('Sent. It’s on everyone’s Today.');
}

/* ---------- overloaded ---------- */
const PLAN_F = [['signs', 'What I notice first', 'e.g. snapping, repeating questions, can’t decide anything'], ['helps', 'What helps', 'e.g. dark room, headphones, weighted blanket, being left alone for 30 min'],
  ['avoid', 'Please don’t', 'e.g. ask why, touch me, start a conversation about it'], ['after', 'Afterwards I need', 'e.g. food and water, quiet, talk it over the next day, not right away']];
function vOverload() {
  const pl = H('support').plans || {}, ms = members().map(m => m.name), mine = S.ui.spSig || 'quiet', mins = S.ui.spMin || 45;
  let h = back() + `<section class="hero"><p class="eyebrow">Overloaded</p><h1>Less input first. Everything else can wait.</h1><p class="lede">An overloaded brain can’t start tasks or have big talks. That’s not a choice, and it passes.</p></section>`;
  h += signalBanner();
  h += `<section class="card"><h2>Right now</h2><ul class="sp-list">
    <li><b>Turn the input down.</b> Dim the lights, headphones or ear defenders, phone face down.</li>
    ${kidsList().length ? `<li><b>Hand over ${esc(theKids())}</b> if another adult is home. If not, a show is a perfectly good tool.</li>` : ''}
    <li><b>No questions, no decisions.</b> Not now. They’ll be easier later.</li>
    <li><b>Something for the body.</b> Water, a snack, something to squeeze or twist, pressure of a blanket.</li>
    <li><b>Give it time.</b> Recovery can take longer than the trigger did.</li></ul>
    <a class="btn ghost" href="#breathe">Breathe for two minutes</a></section>`;
  if (meValid() && modOn('signals')) h += `<section class="card"><h2>Tell the household</h2><p class="muted small">One tap puts a short message on everyone’s Today, so nobody has to ask and you don’t have to explain.</p>
    <div class="sp-sigs" role="radiogroup" aria-label="Message">${SIGNALS.map(([k, l, t]) => `<button class="sp-sig${mine === k ? ' on' : ''}" data-act="sp-sig-pick" data-k="${k}" role="radio" aria-checked="${mine === k}"><b>${l}</b><span>${t}</span></button>`).join('')}</div>
    <div class="pills" role="radiogroup" aria-label="For how long">${[20, 45, 90].map(m => `<button class="pill${mins === m ? ' on' : ''}" data-act="sp-sig-min" data-m="${m}" role="radio" aria-checked="${mins === m}">${m} min</button>`).join('')}</div>
    <div class="actions"><button class="btn accent" data-act="sp-sig-send">Send</button></div></section>`;
  const own = meValid() && ms.includes(me), ed = S.ui.planEdit;
  h += `<section class="card"><div class="sec-head"><h2>Overload plans</h2>${own ? `<button class="link" data-act="sp-plan-edit">${ed ? 'Done' : 'Edit mine'}</button>` : ''}</div>
    <p class="muted small">Written on a calm day, read on a hard one. Each of you says what you notice first, what helps and what doesn’t, so the other one knows what to do without asking.</p>
    ${ms.map(n => { const p = pl[n] || {}, me1 = n === me;
      if (me1 && ed) return `<div class="plan edit"><h3>${esc(n)} (you)</h3>${PLAN_F.map(([k, l, ph]) => `<label class="small">${l}<textarea id="pl_${k}" rows="2" data-act="sp-plan" data-f="${k}" placeholder="${esc(ph)}">${esc(p[k] || '')}</textarea></label>`).join('')}</div>`;
      const any = PLAN_F.some(([k]) => p[k]);
      return `<div class="plan"><h3>${esc(n)}${me1 ? ' (you)' : ''}</h3>${any ? `<dl>${PLAN_F.filter(([k]) => p[k]).map(([k, l]) => `<dt>${l}</dt><dd>${esc(p[k])}</dd>`).join('')}</dl>` : `<p class="muted small">${me1 ? 'Not written yet. Tap “Edit mine”.' : 'Not written yet.'}</p>`}</div>`; }).join('')}</section>`;
  return h;
}

/* ---------- breathe ---------- */
const BREATHS = {
  sigh: { name: 'Cyclic sighing', why: 'Two breaths in through the nose, then a long, slow breath out. In a 2023 Stanford study, five minutes a day lifted mood and slowed breathing more than mindfulness meditation did.', ph: [['In through your nose', 2, 1], ['…and a little more', 1, 1.12], ['Long, slow breath out', 6, .55]] },
  box: { name: 'Box breathing', why: 'In, hold, out, hold, four counts each. Steady and easy to count, good when you want something to focus on.', ph: [['Breathe in', 4, 1], ['Hold', 4, 1], ['Breathe out', 4, .55], ['Hold', 4, .55]] }};
const GROUND = ['Name 5 things you can see.', 'Notice 4 things you can feel: your feet, the chair, your clothes, the air.', 'Listen for 3 sounds.', 'Find 2 things you can smell, or two scents you like.', 'One thing you can taste, or one kind thing to say to yourself.'];
const BR = { iv: null };
function brPhase() {
  const b = S.ui.br; if (!b || !b.on) return null;
  const P = BREATHS[b.kind].ph, cyc = P.reduce((a, p) => a + p[1], 0), el = (Date.now() - b.start) / 1e3;
  if (el >= b.mins * 60) return { done: true };
  let t = el % cyc; for (const p of P) { if (t < p[1]) return { p, left: p[1] - t }; t -= p[1]; }
  return { p: P[0], left: P[0][1] };
}
function brTick() {
  const f = brPhase(), c = $('#brCircle'), tx = $('#brText'), rm = $('#brLeft');
  if (!f) { clearInterval(BR.iv); BR.iv = null; return; }
  if (f.done) { clearInterval(BR.iv); BR.iv = null; S.ui.br = { ...S.ui.br, on: false, done: true }; render(true); return; }
  if (c && c.dataset.ph !== f.p[0]) { c.dataset.ph = f.p[0]; c.style.transitionDuration = f.p[1] + 's'; c.style.transform = `scale(${f.p[2]})`; }
  if (tx && tx.textContent !== f.p[0]) tx.textContent = f.p[0];
  if (rm) { const s = Math.max(0, Math.ceil(S.ui.br.mins * 60 - (Date.now() - S.ui.br.start) / 1e3)); rm.textContent = `${Math.floor(s / 60)}:${pad(s % 60)} left`; }
}
function vBreathe() {
  const b = S.ui.br || { kind: 'sigh', mins: 2 }, B2 = BREATHS[b.kind], f = brPhase(), g = S.ui.gr ?? -1;
  let h = back() + `<section class="hero"><p class="eyebrow">Breathe</p><h1>Slow the breath out, and the body follows.</h1></section>`;
  h += `<section class="card sp-breathe">
    <div class="pills" role="radiogroup" aria-label="Kind of breathing">${Object.entries(BREATHS).map(([k, x]) => `<button class="pill${b.kind === k ? ' on' : ''}" data-act="sp-br-kind" data-k="${k}" role="radio" aria-checked="${b.kind === k}">${x.name}</button>`).join('')}</div>
    <div class="br-stage"><div class="br-circle" id="brCircle" style="transform:scale(${f && f.p ? f.p[2] : .7})"></div><p class="br-text" id="brText" aria-live="polite">${b.on && f && f.p ? f.p[0] : b.done ? 'Done. Notice how you feel now.' : 'Ready when you are'}</p></div>
    ${b.on ? `<p class="muted small" id="brLeft"></p><div class="actions"><button class="btn" data-act="sp-br-stop">Stop</button></div>`
      : `<div class="pills" role="radiogroup" aria-label="How long">${[1, 2, 5].map(m => `<button class="pill${b.mins === m ? ' on' : ''}" data-act="sp-br-min" data-m="${m}" role="radio" aria-checked="${b.mins === m}">${m} min</button>`).join('')}</div><div class="actions"><button class="btn accent big" data-act="sp-br-go">Start</button></div>`}
    <p class="muted small">${B2.why}</p></section>`;
  h += `<section class="card"${g >= 0 && g < GROUND.length ? ` data-sw-l="[data-act=sp-gr][data-i='${g + 1}']" data-sw-r="[data-act=sp-gr][data-i='${g - 1}']" data-sw-kind="page"` : ''}><h2>Five senses, one at a time</h2><p class="muted small">For when your thoughts are racing or everything feels far away. Go slowly; there’s no wrong answer.</p>
    ${g < 0 ? `<div class="actions"><button class="btn" data-act="sp-gr" data-i="0">Start</button></div>`
      : g >= GROUND.length ? `<p class="br-text">You’re here. Well done.</p><div class="actions"><button class="btn ghost" data-act="sp-gr" data-i="-1">Again later</button></div>`
      : `<div class="steps-dots" aria-hidden="true">${GROUND.map((_, i) => `<span class="${i <= g ? 'on' : ''}"></span>`).join('')}</div><p class="br-text">${GROUND[g]}</p><div class="actions"><button class="btn accent" data-act="sp-gr" data-i="${g + 1}">${g < GROUND.length - 1 ? 'Next' : 'Done'}</button><button class="btn ghost" data-act="sp-gr" data-i="${g - 1}">${g ? 'Back' : 'Not now'}</button></div>`}</section>`;
  if (b.on && !BR.iv) setTimeout(() => { BR.iv = setInterval(brTick, 200); brTick(); }, 30);
  else if (b.on) setTimeout(brTick, 30);
  return h;
}

/* ---------- break it down (Claude) ---------- */
const BD_LEVELS = [['few', 'A few steps', '3 to 5 steps'], ['small', 'Small steps', '5 to 8 steps'], ['tiny', 'Tiny steps', '8 to 12 very small steps']];
const bdMine = () => ((H('support').steps || {})[me]) || null;
function bdSave(v) { const o = { ...H('support') }; o.steps = { ...(o.steps || {}), [me]: v }; saveHome('support', o); }
async function bdAsk(task, level, n) {
  const lv = (BD_LEVELS.find(x => x[0] === level) || BD_LEVELS[1])[2];
  const text = `Break this task into concrete steps for an adult with ADHD who is finding it hard to start.
Task: "${task}"
Give ${n ? n : lv}.
Rules: the first step is tiny and physical, the kind that takes under a minute (like "Stand up and walk to the kitchen"). One action per step, at most 12 words, starting with a verb. No advice, no encouragement, no numbering. Write in the same language as the task.
Reply with only a JSON array of strings.`;
  const out = await sample.json(text, { modelTier: 'quick', cache: false, feature: 'breakdown' });
  const arr = (Array.isArray(out) ? out : out && Array.isArray(out.steps) ? out.steps : []).map(x => String(typeof x === 'string' ? x : (x && (x.step || x.text)) || '').trim()).filter(Boolean).slice(0, 14);
  if (!arr.length) throw { code: 'invalid_json' };
  return arr;
}
async function bdStart(task, level) {
  S.ui.bd = { thinking: true }; render(true);
  try { const st = await bdAsk(task, level); bdSave({ task, level, steps: st.map(t => ({ id: uid(), t, done: false })), at: Date.now() }); S.ui.bd = null; }
  catch (e) { S.ui.bd = { err: e && e.code === 'invalid_json' ? 'Claude’s answer didn’t come through. Try again.' : 'Couldn’t reach Claude just now. Try again in a minute.', task, level }; }
  render(true);
}
async function bdSplit(id) {
  const cur = bdMine(); if (!cur) return; const i = cur.steps.findIndex(s => s.id === id); if (i < 0) return;
  S.ui.bd = { splitting: id }; render(true);
  try { const st = await bdAsk(cur.steps[i].t + ` (part of: ${cur.task})`, 'tiny', '2 to 4 very small steps');
    const now = bdMine() || cur; const j = now.steps.findIndex(s => s.id === id);
    bdSave({ ...now, steps: [...now.steps.slice(0, j), ...st.map(t => ({ id: uid(), t, done: false })), ...now.steps.slice(j + 1)] }); S.ui.bd = null; }
  catch (e) { S.ui.bd = { err: 'Couldn’t split that step just now. Try again in a minute.' }; }
  render(true);
}
function vBreakdown() {
  const cur = bdMine(), U = S.ui.bd || {}, lvl = S.ui.bdLevel || 'small';
  let h = back() + `<section class="hero"><p class="eyebrow">Break it down</p><h1>Too big to start? Make the first step tiny.</h1><p class="lede">Write the thing that feels like a wall. Claude turns it into steps small enough to just do.</p></section>`;
  if (!meValid()) return h + '<p class="note">Choose who you are on the Today tab first.</p>';
  if (!cur || U.thinking) {
    h += `<section class="card"><form class="sp-bd" data-form="sp-bd"><label class="small" for="bdTask">What feels too big?</label>
      <textarea id="bdTask" name="text" rows="2" required placeholder="e.g. Sort out the girls’ winter clothes">${esc(U.task || '')}</textarea>
      <div class="pills" role="radiogroup" aria-label="How small">${BD_LEVELS.map(([k, l]) => `<button type="button" class="pill${lvl === k ? ' on' : ''}" data-act="sp-bd-lvl" data-k="${k}" role="radio" aria-checked="${lvl === k}">${l}</button>`).join('')}</div>
      <div class="actions"><button class="btn accent" type="submit" ${U.thinking || !sample ? 'disabled' : ''}>${U.thinking ? 'Breaking it down…' : 'Break it down'}</button></div>
      ${!sample ? '<p class="muted small">Claude isn’t available here right now. Meanwhile: write down only the very first thing your hands would do.</p>' : ''}
      ${U.err ? `<p class="note">${esc(U.err)}</p>` : ''}</form></section>`;
    return h;
  }
  const n = cur.steps.filter(s => s.done).length, next = cur.steps.find(s => !s.done);
  h += `<section class="card"><div class="sec-head"><h2>${esc(cur.task)}</h2><span class="progress">${n} of ${cur.steps.length}</span></div>
    <ul class="checks">${cur.steps.map(s => `<li class="bd-step" data-sw-r=".check"${s.done || !sample ? '' : ' data-sw-l="[data-act=sp-bd-split]"'}><button class="check${s.done ? ' on' : ''}" data-act="sp-bd-done" data-id="${s.id}" aria-pressed="${s.done}"><span class="box" aria-hidden="true">${I.check}</span><span class="txt">${esc(s.t)}</span></button>${s.done ? '' : `<button class="tiny" data-act="sp-bd-split" data-id="${s.id}" ${U.splitting || !sample ? 'disabled' : ''} aria-label="Make “${esc(s.t)}” smaller">${U.splitting === s.id ? '…' : 'Smaller'}</button>`}</li>`).join('')}</ul>
    ${U.err ? `<p class="note">${esc(U.err)}</p>` : ''}
    ${next ? `<div class="actions"><button class="btn accent" data-act="timer" data-min="5" data-label="${esc(next.t)}">Do the next one · 5 min</button></div>` : '<p class="alldone">All done. That was a wall, and you got over it.</p>'}
    <div class="actions"><button class="btn ghost" data-act="sp-bd-new">Something else</button></div></section>`;
  return h;
}

/* ---------- can't start ---------- */
const ONRAMPS = [
  ['Move towards it', 'Don’t start. Just go and stand in the room where it happens. Lean on the counter, scroll your phone there. Being in the room is a step.'],
  ['Wiggle on-ramp', 'Put on a song you love. Toes first, then legs, then arms. You’re moving already, so the sink is a small step from there.'],
  ['Built-in wait', 'Kettle on, oven timer set, food ordered. Do care tasks until it’s ready. The finish line is already decided.', [12, 'Until it’s ready']],
  ['Bundle it', 'Save a podcast, audiobook or show for care tasks only, so the boring thing comes with something you look forward to.'],
  ['Make it interesting', 'ADHD brains start on interest, novelty, urgency or challenge, not importance. Race the timer, or turn it into a game with the girls.'],
  ['Take away the sensory cost', 'Gloves for wet or squishy jobs, headphones for the loud hour, a lamp instead of the big light. Often the block is the feel of the task.'],
  ['Say what “done” means', '“Clean the kitchen” is vague. “Counter clear, sink empty” can be finished. Write the finish line first.'],
  ['Heads-up before switching', 'Changing from one thing to another is often the hardest part. A short warning before the switch helps adults and toddlers alike.', [2, 'Switching soon']],
  ['Kindness to future you', 'What small thing would tomorrow-you be glad of? Start there, even if it seems minor.'],
  ['Didn’t happen? Shrink it', 'If five minutes didn’t happen, five minutes was too big. Try three. Finding the right size is the skill.']];
function vStuck() {
  const i = (S.ui.onr ?? Math.floor(Date.now() / 864e5)) % ONRAMPS.length, o = ONRAMPS[i], L = H('live');
  const other = L.who && L.until > Date.now() && L.who !== me;
  return back() + `<section class="hero"><p class="eyebrow">Can’t get started</p><h1>That’s task initiation, not laziness.</h1><p class="lede">Make the way in smaller until it’s easy to step onto.</p></section>
    <section class="card"><h2>Just a few minutes</h2><p class="muted small">When it rings you may stop, finished or not.</p>
      <div class="pills">${[3, 5, 10, 15].map(m => `<button class="pill" data-act="timer" data-min="${m}" data-label="${m} minutes of care">${m} min</button>`).join('')}</div>
      <form class="addform" data-form="one"><input type="text" name="text" placeholder="Or name just one thing: one dish, one sock" required aria-label="The one thing"><button class="btn" type="submit">3 min</button></form>
      <label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="share" data-act="share" ${S.ui.share ? 'checked' : ''}> Let the household see I’m on it</label></section>
    <section class="card sp-company"><h2>Company helps</h2><p class="muted small">Someone nearby, even on a call, makes starting easier. They don’t have to help.</p>
      ${other ? `<button class="btn accent" data-act="timer" data-min="10" data-label="Keeping ${esc(L.who)} company">Join ${esc(L.who)} for 10 min</button>` : `<button class="btn" data-act="timer" data-min="15" data-label="Looking for company" data-share="1">Ask for company · 15 min</button>`}</section>
    <section class="card onramp" data-sw-l="[data-act=sp-onr]" data-sw-r="[data-act=sp-onr]" data-sw-kind="page"><div class="sec-head"><h2>Try an on-ramp</h2><span class="progress">${i + 1} of ${ONRAMPS.length}</span></div>
      <h3>${o[0]}</h3><p>${o[1]}</p>
      <div class="actions">${o[2] ? `<button class="btn ghost" data-act="timer" data-min="${o[2][0]}" data-label="${o[2][1]}">${o[2][1]} · ${o[2][0]} min</button>` : ''}<button class="btn" data-act="sp-onr" data-i="${i + 1}">Another idea</button></div></section>
    <a class="sp-row" href="#breakdown"><span class="ic">${I.sp_steps}</span><span><b>Still too big?</b><span>Break it into tiny steps with Claude.</span></span><span class="go" aria-hidden="true">›</span></a>`;
}
/* ---------- taps on this area's buttons (data-act), called from events.js; true = handled ---------- */
function tapSupport(a, el, e, r) {
  switch (a) {
    case 'sp-empty': S.ui.prev = 'survival'; return true;
    case 'sp-sig-pick': S.ui.spSig = el.dataset.k; render(true); return true;
    case 'sp-sig-min': S.ui.spMin = +el.dataset.m; render(true); return true;
    case 'sp-sig-send': setSignal(S.ui.spSig || 'quiet', S.ui.spMin || 45); return true;
    case 'sp-sig-off': { const o = { ...H('signals') }; o[me] = { ...(o[me] || {}), until: 0 }; saveHome('signals', o); return true; }
    case 'sp-sig-ack': { const n = el.dataset.n, o = { ...H('signals') }; if (o[n]) { o[n] = { ...o[n], ack: me || 'Someone' }; saveHome('signals', o); toast(`${n} will see that you’ve got it.`); } return true; }
    case 'sp-plan-edit': S.ui.planEdit = !S.ui.planEdit; render(true); return true;
    case 'sp-br-kind': S.ui.br = { ...(S.ui.br || { mins: 2 }), kind: el.dataset.k, on: false, done: false }; render(true); return true;
    case 'sp-br-min': S.ui.br = { ...(S.ui.br || { kind: 'sigh' }), mins: +el.dataset.m, done: false }; render(true); return true;
    case 'sp-br-go': S.ui.br = { kind: 'sigh', mins: 2, ...(S.ui.br || {}), on: true, done: false, start: Date.now() }; clearInterval(BR.iv); BR.iv = null; render(true); return true;
    case 'sp-br-stop': clearInterval(BR.iv); BR.iv = null; S.ui.br = { ...S.ui.br, on: false, done: false }; render(true); return true;
    case 'sp-gr': S.ui.gr = +el.dataset.i; render(true); return true;
    case 'sp-onr': S.ui.onr = +el.dataset.i % ONRAMPS.length; render(true); return true;
    case 'sp-bd-lvl': S.ui.bdLevel = el.dataset.k; render(true); return true;
    case 'sp-bd-done': { const c = bdMine(); if (c) bdSave({ ...c, steps: c.steps.map(x => x.id === el.dataset.id ? { ...x, done: !x.done } : x) }); return true; }
    case 'sp-bd-split': bdSplit(el.dataset.id); return true;
    case 'sp-bd-new': { const o = { ...H('support') }; o.steps = { ...(o.steps || {}), [me]: null }; S.ui.bd = null; saveHome('support', o); return true; }
    case 'timer': startTimer(+el.dataset.min, el.dataset.label || 'Timer', el.dataset.share === '1'); return true;
  }
  return false;
}
