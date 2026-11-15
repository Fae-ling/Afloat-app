/* Afloat · app/date-ideas.js · Together: date night ideas (staying in / going out, Claude ideas, extra date nights).
   Plain script: shares one scope with the other app/*.js files (loaded in order by index.html). See CLAUDE.md. */
/* ---------- Together: date night ideas (relationship module, part 3) ----------
   Each date night: one relaxing, low-mental-energy idea (kind 'fun' in the data, kept so saved picks still work), one deeper
   talk-or-explore prompt and, every other week, something new to try (shared novel activities are a well-studied way to keep
   closeness alive). All at home, after bedtime, with little or no preparation.
   Each date night's picks live in home/relationship['night:<date>'] so both phones show the same; "Another one" moves on.
   home/relationship.ideas: used {id: date}, fav [id], own [{id, kind, text}]. The check-up focus nudges the mix. */
const IDEA_KINDS = [['deep', 'Something to explore together'], ['fun', 'Something relaxing'], ['new', 'Something new to try'], ['out', 'Going out']];
const IDEA_LBL = Object.fromEntries(IDEA_KINDS);
const IDEAS = {
  deep: ['What’s a moment from this month you’d like to keep?', 'What did you need more of as a kid, and do you get it now?', 'Which version of us, from any year, do you miss a little?',
    'What’s something you’re quietly proud of that I might not know about?', 'When do you feel most like yourself these days?', 'What’s one thing about the girls that surprised you lately?',
    'If we had a free Saturday with no to-dos, what would you want it to look like?', 'What’s a small thing I do that makes your day easier?', 'What’s something you’d like to get better at this year?',
    'Which of your friends do you miss, and what would help you see them?', 'What do you think we do really well as a team?', 'What’s a worry you’ve been carrying that you haven’t said out loud?',
    'What did your family do at home that you want the girls to have too?', 'What would make next week feel ten per cent lighter for you?', 'Where would you live for a year if anything were possible?',
    'What’s a song that takes you straight back to a time in your life? Play it.', 'When did you last feel really looked after, and by whom?', 'What do you think the girls will remember about this year?',
    'What’s a dream you’ve put on hold? Is there a tiny version of it?', 'What did you learn about yourself from the last hard week?', 'What do you love about how the other one parents?',
    'What would you tell yourself from five years ago?', 'Which rule of our house would you happily throw out?', 'What’s something you want to try together before the girls are at school?'],
  fun: ['Make a pot of tea, put on something cosy, and don’t talk unless you want to', 'Take turns giving each other a ten-minute shoulder or foot massage', 'Put on an album neither of you has heard in years and just listen',
    'Share a blanket on the sofa and watch a comfort film you both know by heart', 'Run a warm bath or foot soak, and take turns having a quiet half hour', 'Light a candle or two, dim the lights and read your own books side by side',
    'Look through old photos on your phones, no commentary required', 'Do a slow jigsaw or a colouring page together while a podcast plays', 'Order or reheat something you both love, and eat it slowly with no screens until you’re done',
    'Listen to a calm playlist or a bedtime podcast lying on the floor, eyes closed', 'Do ten minutes of gentle stretching together, then lie there', 'Sit by the fireplace with a hot drink and watch the fire for a while',
    'Wrap up in blankets on the sofa and put on a gentle series, no deciding needed', 'Cook something very simple together, with music on, and zero pressure to make it nice', 'Take turns brushing or scratching each other’s head or back'],
  new: ['Try a 20-minute online cooking class or video and make it together', 'Do a two-person yoga or stretching video on the living-room floor', 'Learn the basics of a dance (swing, salsa) from a video',
    'Take turns teaching each other something you know in ten minutes', 'Start a jigsaw puzzle and give it the whole evening', 'Write and seal a letter to each other to open in a year',
    'Make a playlist together for a future road trip', 'Try a new kind of tea or wine and actually take tasting notes', 'Do a sketching or watercolour tutorial side by side',
    'Watch a film in a language neither of you speaks, with subtitles', 'Try a short meditation for couples, then talk about how it felt', 'Plan one small outing for a weekend the girls are at the grandparents’'],
  out: ['Dinner somewhere neither of you has been, in a part of Prague you rarely go to', 'An evening walk along the Vltava, then one drink wherever looks cosy', 'A late film at a small cinema, then talk it over on the way home',
    'A board game café: pick a game neither of you knows', 'Climbing, bowling or table tennis: something with a bit of play in it', 'Live music or a jazz club, even for one set',
    'A long walk somewhere with a view at dusk, with a thermos and a snack', 'A cheap-and-cheerful food hunt: try three small things in three places', 'A cooking or pottery class for two',
    'Go back to a place from early in your relationship', 'A museum or gallery that’s open late', 'An escape room, then dinner to argue about the clues']
};
/* seasonal and holiday ideas come first in their window: [from 'MM-DD', to 'MM-DD', kind, text] */
const IDEA_SEASON = [['10-20', '10-31', 'fun', 'Light a pumpkin lantern or a few candles, dim the lights and sit with a hot drink'], ['10-20', '10-31', 'in', 'A spooky film night with the lights off and popcorn'],
  ['10-20', '10-31', 'out', 'A Halloween or dušičky evening walk with candles, then something warm to drink'], ['11-25', '12-23', 'out', 'A Christmas market with svařák or punč, then dinner somewhere warm'],
  ['11-25', '12-23', 'fun', 'Put on Christmas music and decorate a few cukroví at an easy pace, with a cup of tea'], ['11-25', '12-23', 'new', 'Make the girls’ Advent surprises together, with Christmas music on'],
  ['12-01', '12-05', 'fun', 'Plan Mikuláš for the girls: who plays the čert, and what goes in the stockings?'], ['12-27', '12-31', 'deep', 'What did this year teach you, and what do you want more of next year?'],
  ['02-07', '02-14', 'new', 'Write each other a short love letter, old-fashioned, by hand'], ['02-07', '02-14', 'out', 'A Valentine’s dinner a few days early or late, when it’s quieter'],
  ['03-20', '04-25', 'fun', 'Decorate a few kraslice together for Easter, slowly, with a podcast on'], ['05-01', '05-01', 'out', 'A 1 May walk under a blossoming tree: the Czech tradition says a kiss there keeps you close'],
  ['06-01', '08-31', 'out', 'A summer evening outdoors: a beer garden or a picnic by the river at sunset'], ['06-01', '08-31', 'fun', 'Dinner in the garden with candles once the girls are asleep'],
  ['09-15', '11-15', 'new', 'An autumn evening walk to collect leaves for the girls, then tea and a film']];
const ideaSeason = (k, kind) => { const md = k.slice(5); return IDEA_SEASON.map((x, i) => ({ i, x })).filter(({ x }) => md >= x[0] && md <= x[1] && (x[2] === kind || (x[2] === 'in' && kind === 'fun'))).map(({ i }) => 's' + i); };
const ideaId = (kind, i) => `${kind}${i}`;
const ideaTxt = id => { const own = ((H('relationship').ideas || {}).own || []).find(x => x.id === id); if (own) return own.text;
  if (/^s\d+$/.test(id)) return forKids((IDEA_SEASON[+id.slice(1)] || [])[3] || '') || ''; const k = id.replace(/\d+$/, ''), i = +id.slice(k.length); return forKids((IDEAS[k] || [])[i] || '') || ''; };
const ideaTheme = id => { const own = ((H('relationship').ideas || {}).own || []).find(x => x.id === id); return own ? own.theme || '' : ''; };
/* a date night is the weekly one (Wednesday) or any event you're both on called Rande, date or date night */
const DATE_RX = /(^|[^a-zà-ž])(rande|randíčko|randicko|date night|date)([^a-zà-ž]|$)/i;
const dateEvOn = k => { const p = relPair(); if (!p) return null; return eventsOn(k).filter(e => e.date === k && DATE_RX.test(e.title || '') && p.every(n => (e.who || []).includes(n))).sort((a, b) => (a.start || '').localeCompare(b.start || ''))[0] || null; };
const isDateNight = k => (new Date(k + 'T12:00').getDay() + 6) % 7 === relDay() || !!dateEvOn(k);
const dateNightK = () => { for (let i = 0; i <= 7; i++) { const k = calAdd(dk, i); if (isDateNight(k)) return k; } return dk; };
/* each date night keeps its own picks: home/relationship['night:<date>'] {mode, in, out, asked_in, asked_out, why, whyMode} */
const nightKey = () => 'night:' + dateNightK();
const nightGet = () => H('relationship')[nightKey()] || {};
function nightSet(patch) { const f = nightKey(), v = { ...nightGet(), ...patch }; S.home.relationship = { ...H('relationship'), [f]: v }; mergeDoc('home/relationship', { [f]: v }); render(true); }
const ideaFresh = kind => ((H('relationship').ideas || {}).own || []).filter(x => x.kind === kind && x.claude && x.at && x.at >= calAdd(dk, -6)).map(x => x.id); /* Claude's, from this week */
const ideaPool = kind => [...ideaFresh(kind), ...ideaSeason(dateNightK(), kind).filter(id => ideaTxt(id)), ...(IDEAS[kind] || []).map((_, i) => ideaId(kind, i)).filter(id => ideaTxt(id)), ...((H('relationship').ideas || {}).own || []).filter(x => x.kind === kind && !x.claude).map(x => x.id)];
const hashStr = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
function ideaNext(kind, after) {
  const pool = ideaPool(kind), used = (H('relationship').ideas || {}).used || {}, seas = ideaSeason(dateNightK(), kind), cl = ideaFresh(kind);
  const rank = id => cl.includes(id) ? cl.indexOf(id) - 100 : seas.includes(id) ? 1 : 2; /* Claude's in the order given */
  const order = [...pool].sort((a, b) => (rank(a) - rank(b)) || (hashStr(dateNightK() + a) - hashStr(dateNightK() + b))), fresh = order.filter(id => !used[id]);
  const list = fresh.length ? fresh : order, i = after ? (list.indexOf(after) + 1) % list.length : 0;
  return list[i] || '';
}
/* staying in by default; going out when the girls are away or someone is babysitting that evening, or when you say so */
function ideaMode() {
  const m = nightGet().mode; if (m) return m;
  const ev = dateEvOn(dateNightK()); if (ev && ev.place) return 'out';
  const k = dateNightK(), sit = eventsOn(k).some(e => inGP(e) && !e.allDay && (e.end || '') >= '20:00');
  return kidsAwayOn(k) || sit ? 'out' : 'in';
}
const newWeek = () => (hashStr(dateNightK()) % 2 === 0) || /fun|time/.test(((cu().focus || {}).keys || []).join(' '));
function ideasTonight() {
  const R = nightGet(), out = {}, mode = ideaMode();
  const kinds = mode === 'out' ? ['out', 'deep'] : ['fun', 'deep', ...(newWeek() || R.new ? ['new'] : [])];
  for (const k of kinds) out[k] = (R[mode] || {})[k] || ideaNext(k);
  return out;
}
const ideaPickSet = (patch) => { const mode = ideaMode(); nightSet({ mode, [mode]: { ...ideasTonight(), ...patch } }); };
function ideasCard(compact) {
  if (!relPair() || !meValid() || !relPair().includes(me)) return '';
  ideaAutoAsk();
  const mode = ideaMode(), T = ideasTonight(), I2 = H('relationship').ideas || {}, fav = I2.fav || [], R = nightGet(), k = dateNightK(), dev = dateEvOn(k);
  const order = mode === 'out' ? ['out', 'deep'] : /talk|close/.test(((cu().focus || {}).keys || []).join(' ')) ? ['deep', 'fun', 'new'] : ['fun', 'deep', 'new'];
  const row = kd => { const id = T[kd]; if (!id) return ''; const on = fav.includes(id), done = (I2.used || {})[id] === dk, th = ideaTheme(id);
    return `<li class="idea"><span class="eyebrow">${esc(kd === 'deep' && mode === 'out' ? 'To talk about on the way' : IDEA_LBL[kd])}${th ? ` · ${esc(th)}` : ''}</span><p>${esc(ideaTxt(id))}</p>
      <div class="chips"><button class="tiny" data-act="idea-next" data-k="${kd}">Another one</button><button class="tiny${on ? ' on' : ''}" data-act="idea-fav" data-id="${id}" aria-pressed="${on}">${on ? '★ Kept' : '☆ Keep'}</button><button class="tiny${done ? ' on' : ''}" data-act="idea-used" data-id="${id}">${done ? 'Done ✓' : 'We did this'}</button></div></li>`; };
  const w = wxSpan(homeTown(), k, 18 * 60, 22 * 60), needSit = mode === 'out' && !kidsAwayOn(k) && !eventsOn(k).some(inGP);
  return `<section class="card ideas"><div class="sec-head"><h${compact ? 3 : 2}>${compact ? 'Ideas for tonight' : 'Date night ideas'}</h${compact ? 3 : 2}>${compact ? '' : `<span class="progress">${k === dk ? 'Tonight' : fmtD(k)}</span>`}</div>
    ${dev ? `<p class="small"><b>${esc(shortTitle(dev.title))}</b>${dev.start ? ` · ${esc(dev.start)}` : ''}${dev.place ? ` · ${esc(dev.place)}` : ''}${k !== dk && compact ? ` · ${fmtD(k)}` : ''}</p>` : ''}
    <div class="pills">${[['in', 'Staying in'], ['out', 'Going out']].map(([v, l]) => `<button type="button" class="pill${mode === v ? ' on' : ''}" data-act="idea-mode" data-v="${v}">${l}</button>`).join('')}</div>
    ${!compact && mode === 'in' ? '<p class="muted small">At home, after bedtime, almost no preparation. Pick one, or none: watching something together counts too.</p>' : ''}
    ${needSit ? `<p class="small note">For a night out ${esc(theKids())} need${kidsList().length === 1 ? 's' : ''} someone. <button class="linkish" data-act="go-cal">Ask the grandparents in the calendar</button></p>` : ''}
    ${mode === 'out' && w ? `<p class="small wx">${wxIcon(w)} ${k === dk ? 'This evening' : 'That evening'}: ${w.tMin}–${w.tMax} °C, ${esc(wxWord(w.code))}${w.p >= 30 ? `, ${w.p}% chance of rain` : ''}.</p>` : ''}
    ${R.why && R.whyMode === mode ? `<p class="muted small">✦ ${esc(R.why)}</p>` : ''}${S.ui.ideaErr ? `<p class="muted small">${esc(S.ui.ideaErr)} Built-in ideas for now.</p>` : ''}
    <ul class="ideas-l">${order.map(row).join('')}</ul>
    ${sample ? `<div class="actions"><button class="btn ghost" data-act="idea-ask" ${S.ui.ideaAsk ? 'disabled' : ''}>${S.ui.ideaAsk ? 'Thinking…' : '✦ Fresh ideas from Claude'}</button></div>` : ''}
    ${compact ? '' : ideasMore()}</section>`;
}
function ideasMore() {
  const I2 = H('relationship').ideas || {}, fav = (I2.fav || []).filter(ideaTxt), own = (I2.own || []).filter(x => !x.claude);
  return `${fav.length ? `<details><summary class="small">Kept ideas (${fav.length})</summary><ul class="bf-list">${fav.map(id => `<li>${esc(ideaTxt(id))} <button class="link" data-act="idea-fav" data-id="${id}">remove</button></li>`).join('')}</ul></details>` : ''}
    <details><summary class="small">Add your own${own.length ? ` (${own.length})` : ''}</summary>
      ${own.length ? `<ul class="bf-list">${own.map(x => `<li>${esc(x.text)} <span class="muted small">· ${esc(IDEA_LBL[x.kind] || '')}</span> <button class="link" data-act="idea-del" data-id="${x.id}">remove</button></li>`).join('')}</ul>` : ''}
      <form class="addform" data-form="idea-add"><input type="text" name="text" placeholder="e.g. Karaoke to our old playlist" required aria-label="Your own idea"><select name="kind" aria-label="Kind">${IDEA_KINDS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select><button class="btn" type="submit">Add</button></form></details>`;
}
/* the little list on the date-night card: going out keeps "Before you go" (lists.date); staying in gets "Before you sit down" */
const DATE_IN = [{ id: 'di1', text: 'Girls asleep, the monitor on' }, { id: 'di2', text: 'Phones on silent, in another room' }, { id: 'di3', text: 'Something to drink or nibble ready' }, { id: 'di4', text: 'Pick tonight’s idea (or a film) before you sit down' }];
function dateListHtml() {
  const out = ideaMode() === 'out', L = H('lists'), f = out ? 'date' : 'dateIn', items = out ? (L.date || []) : (L.dateIn || DATE_IN), pre = out ? 'd' : 'di';
  if (!out && !L.dateIn && db && S.loaded && !S.ui.dateInSeeded) { S.ui.dateInSeeded = true; setTimeout(() => saveHome('lists', { ...H('lists'), dateIn: DATE_IN }), 0); }
  if (!items.length && !S.ui.edit[f]) return `<div class="chips">${editBtn(f)}</div>`;
  return `<div class="sec-head"><h3>${out ? 'Before you go' : 'Before you sit down'}</h3>${editBtn(f)}</div>${S.ui.edit[f] ? editList('lists', f, items, out ? 'Add something for going out' : 'Add something for staying in') : checklist(pre, items)}`;
}
const ideasSave = patch => { const I2 = H('relationship').ideas || {}; mergeDoc('home/relationship', { ideas: { ...I2, ...patch } }); };
/* what Claude gets: the date, the season and holidays coming up, the forecast for that evening, the week's calendar,
   whether the girls are away, the check-up focus and ideas you kept. Fetched once per week and mode, on date-night week. */
function ideaContext(mode) {
  const k = dateNightK(), dt = new Date(k + 'T12:00'), hol = [];
  for (let i = -3; i <= 40; i++) { const x = calAdd(k, i), h = czHoliday(x); if (h) hol.push(`${h} (${fmtD(x)})`); }
  const es = easterSun(dt.getFullYear()), md = k.slice(5), around = [];
  if (md >= '10-15' && md <= '11-02') around.push('Halloween and dušičky'); if (md >= '11-20' && md <= '12-24') around.push('Advent and Christmas markets'); if (md >= '11-28' && md <= '12-05') around.push('Mikuláš on 5 December');
  if (md >= '12-26' || md <= '01-01') around.push('the end of the year'); if (md >= '02-01' && md <= '02-14') around.push('Valentine’s Day'); if (md >= '01-20' && md <= '03-05') around.push('masopust season');
  const ed = keyOf(es); if (k >= calAdd(ed, -21) && k <= calAdd(ed, 1)) around.push('Easter'); if (md >= '04-25' && md <= '05-01') around.push('1 May, the Czech day of love');
  const w = wxSpan(homeTown(), k, 18 * 60, 22 * 60), evs = [];
  for (let i = -3; i <= 4; i++) { const x = calAdd(k, i); for (const e of eventsOn(x)) if (e.date === x && evs.length < 10) evs.push(`${fmtD(x)}: ${shortTitle(e.title)}`); }
  const F = ((cu().focus || {}).keys || []).map(x => CU_LBL[x]), kept = ((H('relationship').ideas || {}).fav || []).map(ideaTxt).filter(Boolean).slice(0, 5);
  return [`Date night: ${dt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}, evening, in ${homeTown()} area. ${houseFacts()}`,
    dateEvOn(k) ? `It's in their calendar as "${shortTitle(dateEvOn(k).title)}"${dateEvOn(k).start ? ` at ${dateEvOn(k).start}` : ''}${dateEvOn(k).place ? `, at ${dateEvOn(k).place}` : ''}${(dateEvOn(k).notes || '').trim() ? ` (notes: ${String(dateEvOn(k).notes).trim().slice(0, 160)})` : ''}; build around that.` : '',
    mode === 'out' ? (!kidsList().length ? 'They plan to go out.' : kidsAwayOn(k) ? 'The children are at their grandparents’, so they can go out.' : 'They plan to go out; someone will be with the children.') : kidsList().length ? `Staying in: the children (${kidsAged().join(', ')}) are asleep.` : 'Staying in, at home.',
    w ? `Forecast that evening: ${w.tMin}–${w.tMax} °C, ${wxWord(w.code)}${w.p >= 30 ? `, ${w.p}% chance of rain` : ''}.` : '',
    around.length ? `Season and occasions around now: ${around.join(', ')}.` : '', hol.length ? `Czech public holidays coming up: ${hol.slice(0, 3).join('; ')}.` : '',
    evs.length ? `Their calendar this week (for context only, don't repeat it back): ${evs.join('; ')}.` : '',
    F.length ? `From their relationship check-up they want to look after: ${F.join(', ')}.` : '', kept.length ? `Ideas they liked before: ${kept.join('; ')}.` : ''].filter(Boolean).join('\n');
}
async function ideaAsk(auto) {
  if (!sample || S.ui.ideaAsk) return; const mode = ideaMode(); S.ui.ideaAsk = true; render(true);
  if (auto) nightSet({ ['asked_' + mode]: Date.now() });
  const want = mode === 'out' ? `{"theme": "a short theme if the season or an occasion suggests one, else empty", "out": ["three different date ideas out, each at most 20 words"], "deep": "one question to talk about on the way", "why": "one short sentence on why these fit this week"}`
    : `{"theme": "a short theme if the season or an occasion suggests one, else empty", "fun": "one relaxing at-home idea that needs almost no mental energy: cosy, slow, sensory, nothing to think about or perform", "deep": "one deeper idea for the two of them to explore together: a meaningful question, or a short shared exploration such as a what-if, a values or memory prompt, or something to dream up together", "new": "one new thing to try at home", "why": "one short sentence on why these fit this week"}`;
  const text = `Suggest date night ideas for a couple, using the household details below. Where those don’t say otherwise, assume low effort and low cost, and that many evenings they simply want to rest.
${ideaContext(mode)}
Make the ideas fit the season, the weather and the week; theme them around an occasion when there is one. For staying in, give a real contrast: the relaxing idea is for a tired brain (calm, cosy, comforting, nothing goofy, competitive or performative, no games or challenges), and the deeper one is for when they have energy to really explore something together. Keep them realistic, warm and low-effort, no therapy jargon, no specific venue names unless you are sure they exist near where they live. Each idea at most 20 words.
Reply with only JSON: ${want}`;
  try {
    let out; try { out = await askClaude(text, { feature: 'dates' }) || {}; } catch (e) { S.ui.ideaErr = claudeWhy(e); if (!auto) toast(S.ui.ideaErr); S.ui.ideaAsk = false; render(true); return; }
    S.ui.ideaErr = ''; const I2 = H('relationship').ideas || {}, own = [...(I2.own || [])], pick = {}, theme = String(out.theme || '').trim().slice(0, 40);
    const put = (kd, t) => { t = String(t || '').trim(); if (!t) return null; const id = 'c' + uid(); own.push({ id, kind: kd, text: t.slice(0, 200), claude: true, theme, at: dk }); return id; };
    if (mode === 'out') { const ids = (Array.isArray(out.out) ? out.out : [out.out]).map(t => put('out', t)).filter(Boolean); if (ids[0]) pick.out = ids[0]; }
    else for (const kd of ['fun', 'new']) { const id = put(kd, out[kd]); if (id) pick[kd] = id; }
    const dq = put('deep', out.deep); if (dq) pick.deep = dq;
    if (Object.keys(pick).length) { ideasSave({ own: own.slice(-80) }); nightSet({ mode, [mode]: { ...ideasTonight(), ...pick }, why: String(out.why || '').trim().slice(0, 200), whyMode: mode }); }
    else if (!auto) toast('Nothing came back. Try again in a moment.');
  } catch (e) { console.warn('date ideas:', e); if (!auto) toast('Claude answered, but the ideas couldn’t be saved. Try again.'); }
  S.ui.ideaAsk = false; render(true);
}
/* Claude's ideas are the default: asked once per week and mode, from two days before date night */
const ideaAsked = new Set();
function ideaAutoAsk() {
  if (!sample || S.ui.ideaAsk || !S.loaded) return; const mode = ideaMode(), R = nightGet();
  const nk = nightKey(); if (R['asked_' + mode] || ideaAsked.has(nk + mode) || dayDiffK(dk, dateNightK()) > 2) return;
  ideaAsked.add(nk + mode); setTimeout(() => { if (nightKey() === nk && !nightGet()['asked_' + ideaMode()] && ideaMode() === mode) ideaAsk(true); }, 1200); /* after the week has loaded on both phones */
}
/* ---------- taps on this area's buttons (data-act), called from events.js; true = handled ---------- */
function tapDateIdeas(a, el, e, r) {
  switch (a) {
    case 'idea-next': { const T = ideasTonight(), k = el.dataset.k; ideaPickSet({ [k]: ideaNext(k, T[k]) }); return true; }
    case 'idea-mode': nightSet({ mode: el.dataset.v }); return true;
    case 'idea-fav': { const f = (H('relationship').ideas || {}).fav || [], id = el.dataset.id; ideasSave({ fav: f.includes(id) ? f.filter(x => x !== id) : [...f, id] }); return true; }
    case 'idea-used': { const u = { ...((H('relationship').ideas || {}).used || {}) }, id = el.dataset.id; if (u[id] === dk) delete u[id]; else u[id] = dk; ideasSave({ used: u }); return true; }
    case 'idea-del': ideasSave({ own: ((H('relationship').ideas || {}).own || []).filter(x => x.id !== el.dataset.id) }); return true;
    case 'idea-ask': ideaAsk(false); return true;
    case 'go-cal': S.ui.brief = false; lsSet('afloat.brief', dk + slot()); location.hash = 'calendar'; render(true); scrollTo(0, 0); return true;
  }
  return false;
}
