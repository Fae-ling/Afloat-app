/* ---------- Welcome: a new household's first-open setup (10 Nov 2026) ----------
   Shown once to the first person in a household that isn't the first one (home/household.setup unset), in English.
   Short steps, each saved as you go so a reload keeps your place:
   who lives here · children · a couple? · your home · what Afloat helps with · connections. Everything can be
   skipped and changed later in Settings; finishing sets household.setup and hands over to each person's own morning
   setup (vSetup in self-care.js). People who join later skip this: they pick their name and do their own setup. */
const welcomeOn = () => S.loaded && !!db && !ourHome() && !H('household').setup;
const W_STEPS = ['people', 'kids', 'couple', 'home', 'mods', 'connect'];
const wStep = () => { const s = H('household').wStep || 'people'; return W_STEPS.includes(s) ? s : 'people'; };
const wSave = patch => saveHome('household', { ...H('household'), ...patch });
/* the steps that apply: "a couple?" only with two or more adults */
const wSteps = () => W_STEPS.filter(s => s !== 'couple' || adults().length >= 2);
const modLabel = k => { const m = MODS.find(x => x[0] === k) || []; return [m[1], m[2]]; };

function vWelcome() {
  const st = wStep(), steps = wSteps(), i = Math.max(0, steps.indexOf(st)), hh = H('household'), ad = adults(), ks = hh.kids || [];
  const nav = (back = true, next = 'Next', dis = false) => `<div class="actions w-nav">${back && i > 0 ? `<button class="btn ghost" data-act="w-back">Back</button>` : '<span></span>'}<button class="btn accent" data-act="w-next" ${dis ? 'disabled' : ''}>${next}</button></div>`;
  const dots = `<p class="w-dots" aria-label="Step ${i + 1} of ${steps.length}">${steps.map((s, n) => `<span class="${n <= i ? 'on' : ''}"></span>`).join('')}</p>`;
  let body = '';
  if (st === 'people') body = `<h2>Welcome to Afloat</h2><p class="muted">A gentle helper for running a home: what matters today, and nothing that piles up. A few questions first; skip any of them.</p>
    <h3>Who lives here?</h3>
    <p class="muted">The adults who share the care of this home. Children come next.</p>
    ${ad.length ? `<ul class="edit-list">${ad.map(n => `<li><span class="txt">${esc(n)}${n === me ? ` <span class="muted small">· you</span>` : ''}</span>${n !== me ? `<button class="link" data-act="w-rm-adult" data-n="${esc(n)}">Remove</button>` : ''}</li>`).join('')}</ul>` : ''}
    <form class="addform" data-form="w-adult"><input type="text" name="text" id="wAdult" maxlength="30" required placeholder="${ad.length ? 'Someone else who lives here' : 'Your name, as Afloat should call you'}" aria-label="Name"><button class="btn" type="submit">Add</button></form>
    <p class="muted small">Each of you signs in with your own Google account; the owner adds the others’ addresses in Settings → Connections → Household.</p>${nav(true, 'Next', !ad.length)}`;
  else if (st === 'kids') body = `<h2>Children at home?</h2>
    <p class="muted">Their names and birthdays shape the day: drop-offs, pick-ups, bedtime, trips and the ideas Claude gives you. No children? Just go on.</p>
    ${ks.length ? `<ul class="edit-list">${ks.map(n => `<li><span class="txt">${esc(n)}${pInfo(n).birthday ? ` <span class="muted small">· ${esc(pInfo(n).birthday)}</span>` : ''}</span><button class="link" data-act="w-rm-kid" data-n="${esc(n)}">Remove</button></li>`).join('')}</ul>` : ''}
    <form class="addform" data-form="w-kid"><input type="text" name="text" maxlength="30" required placeholder="A child’s name" aria-label="Name"><input type="date" name="bday" aria-label="Birthday"><button class="btn" type="submit">Add</button></form>${nav()}`;
  else if (st === 'couple') { const pick = hh.couple && hh.couple.length === 2 ? hh.couple : ad.length === 2 ? ad : []; const on = modOn('together');
    body = `<h2>Is there a couple here?</h2>
    <p class="muted">Afloat has a Together section for couples: a weekly check-in, a check-up twice a year and date night ideas, just for the two of you. People who live together aren’t always a couple, so it’s up to you.</p>
    ${ad.length > 2 ? `<p class="small">Which two?</p><div class="chips">${ad.map(n => `<button class="whochip pick${(S.ui.wCouple || pick).includes(n) ? ' on' : ''}" data-act="w-cp-pick" data-n="${esc(n)}">${esc(n)}</button>`).join('')}</div>` : ''}
    <div class="w-big"><button class="btn ${on ? 'accent' : 'ghost'}" data-act="w-cp" data-v="yes">${ad.length === 2 ? `Yes, ${esc(ad[0])} and ${esc(ad[1])}` : 'Yes, these two'}</button><button class="btn ${hh.modules && hh.modules.together === false ? 'accent' : 'ghost'}" data-act="w-cp" data-v="no">Not for us</button></div>${nav()}`; }
  else if (st === 'home') { const n = hh.nap || {}, little = ks.filter(k => { const a = ageOf(pInfo(k).birthday); return a === '' || a < 5; });
    body = `<h2>Your home</h2>
    <p class="muted">Kept with your household’s things, only for you. Claude reads it when it suggests trips, date nights and seasonal jobs, so a few honest lines help.</p>
    <label class="small hh-f">Town or city (for the weather)<input type="text" id="w_town" data-act="hh-f" data-f="town" value="${esc(hh.town || '')}" placeholder="e.g. Brno"></label>
    <label class="small hh-f">Home address (so Afloat knows when an event is at home)<input type="text" id="w_addr" data-act="hh-f" data-f="address" value="${esc(hh.address || '')}" placeholder="Street and number, town"></label>
    <label class="small hh-f">In your words<textarea id="w_about" data-act="hh-f" data-f="about" rows="5" placeholder="What’s hard, what helps, the home itself, pets, how you get around. e.g. Two adults with ADHD; leaving the house is the hard part. A flat on the 3rd floor, no lift. One cat. We don’t drive.">${esc(hh.about || '')}</textarea></label>
    ${little.length ? `<div class="hh-nap"><label class="small hh-f">Daytime nap<select id="w_nap" data-act="hh-f" data-f="nap.kid"><option value="">Nobody naps</option>${little.map(k => `<option ${n.kid === k ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select></label>
      ${n.kid ? `<label class="small hh-f">From<input type="time" data-act="hh-f" data-f="nap.from" value="${esc(n.from || '11:30')}"></label><label class="small hh-f">Until<input type="time" data-act="hh-f" data-f="nap.to" value="${esc(n.to || '14:00')}"></label>` : ''}</div>` : ''}${nav()}`; }
  else if (st === 'mods') body = `<h2>What should Afloat help with?</h2>
    <p class="muted">Switched on from what you told it. Switch off anything that doesn’t fit; you can change it any time in Settings.</p>
    <ul class="mod-list">${MODS.filter(([k]) => k !== 'together' || ad.length >= 2).map(([k]) => { const on = modOn(k), [t, d] = modLabel(k); return `<li><button class="mod-row${on ? ' on' : ''}" data-act="mod-sw" data-k="${k}" role="switch" aria-checked="${on}"><span class="mod-sw" aria-hidden="true"></span><span><b>${esc(t)}</b><span class="muted small">${esc(d)}</span></span></button></li>`; }).join('')}</ul>${nav()}`;
  else if (st === 'connect') body = `<h2>Last bit: your apps</h2>
    <p class="muted">Afloat works on its own, and gets better with these. Each of you connects your own, in Settings → Connections:</p>
    <ul class="w-list"><li><b>Google Calendar</b>: your events, leave-by times and who’s going where.</li>
      ${modOn('tasks') ? `<li><b>To-dos and shopping lists</b>: Afloat has its own, ready to use. If you already use Trello, connect it and choose your lists in Settings → Your task lists.</li>` : ''}
      <li><b>Claude API key</b>: ideas, sorting your brain dump, reading photos of invitations. Your household uses its own key and pays Anthropic directly (usually under a dollar a month); without it Afloat uses its built-in ideas. <a href="help/claude-key.html" target="_blank" rel="noopener">How to get one</a>.</li></ul>
    <div class="actions"><button class="btn ghost" data-act="w-conn">Open Connections</button></div>${nav(true, 'Start using Afloat')}`;
  return `<div class="scrim" data-act="noop"><div class="sheet welcome" role="dialog" aria-label="Setting up Afloat">${dots}${body}
    ${st !== 'connect' ? `<p class="w-skip"><button class="link" data-act="w-skip">Skip the rest; I’ll do it later in Settings</button></p>` : ''}</div></div>`;
}
function wGo(d) { const s = wSteps(), i = Math.max(0, s.indexOf(wStep())), n = s[Math.min(s.length - 1, Math.max(0, i + d))]; if (d > 0 && i === s.length - 1) return wDone(); wSave({ wStep: n }); }
function wDone() {
  wSave({ setup: Date.now(), wStep: null });
  if (meValid() && !prof(me).setupDone) S.ui.setup = true;
}
function wSetKids(kids) { wSave({ kids }); }

function tapWelcome(a, el, e, r) {
  switch (a) {
    case 'w-next': wGo(1); return true;
    case 'w-back': wGo(-1); return true;
    case 'w-skip': wDone(); return true;
    case 'w-conn': if (window.claude && window.claude.openConnections) window.claude.openConnections(); return true;
    case 'w-rm-adult': { const n = el.dataset.n; wSave({ members: members().filter(m => m.name !== n) }); return true; }
    case 'w-rm-kid': { const n = el.dataset.n; wSetKids((H('household').kids || []).filter(k => k !== n)); return true; }
    case 'w-cp-pick': { const n = el.dataset.n, cur = S.ui.wCouple || []; S.ui.wCouple = cur.includes(n) ? cur.filter(x => x !== n) : [...cur, n].slice(-2); render(true); return true; }
    case 'w-cp': { const o = H('household'), ad = adults();
      if (el.dataset.v === 'no') { wSave({ modules: { ...(o.modules || {}), together: false }, couple: null }); return true; }
      const c = ad.length === 2 ? ad : (S.ui.wCouple || []); if (c.length !== 2) { toast('Pick the two first.'); return true; }
      wSave({ couple: c, modules: { ...(o.modules || {}), together: true } }); return true; }
  }
  return false;
}
/* the two add-forms (from the submit listener in events.js) */
function submitWelcome(form, fd) {
  const name = String(fd.get('text') || '').trim().slice(0, 30); if (!name) return true;
  if (form.dataset.form === 'w-adult') {
    if (members().some(m => m.name.toLowerCase() === name.toLowerCase())) { toast('Already here.'); return true; }
    wSave({ members: [...members(), { id: uid(), name }] });
    if (!meValid()) { me = name; lsSet('afloat.me', name); }
    form.reset(); return true;
  }
  if (form.dataset.form === 'w-kid') {
    const ks = H('household').kids || []; if (ks.some(k => k.toLowerCase() === name.toLowerCase())) { toast('Already here.'); return true; }
    const bd = String(fd.get('bday') || '');
    if (/^\d{4}-\d\d-\d\d$/.test(bd)) { const P = { ...H('profiles') }; P.people = { ...(P.people || {}), [name]: { ...((P.people || {})[name] || {}), birthday: bd } }; saveHome('profiles', P); }
    wSetKids([...ks, name]); form.reset(); return true;
  }
  return false;
}
