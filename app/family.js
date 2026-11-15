/* Afloat · app/family.js · Family profiles and contacts, partners & friends, food & meals on profiles, birthdays as calendar events.
   Plain script: shares one scope with the other app/*.js files (loaded in order by index.html). See CLAUDE.md. */
/* ---------- family: profiles and contacts ---------- */
const friendsL = () => H('profiles').friends || [];
const friendNames = () => friendsL().map(f => f.name);
const isFriend = n => friendNames().includes(n);
const pInfo = n => (H('profiles').people || {})[n] || friendsL().find(f => f.name === n) || {};
const pColor = n => pInfo(n).color || PCOLORS[Math.abs([...String(n)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)) % PCOLORS.length];
const dot = n => `<span class="pdot" style="background:${pColor(n)}" aria-hidden="true"></span>`;
function everyone() {
  const ads = members().map(m => m.name);
  return [...ads, ...kidsList().filter(k => !ads.includes(k))];
}
function ageOf(bd) { if (!bd) return ''; const b = new Date(bd + 'T12:00'), n = new Date(); let y = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) y--; return y; }
const hm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const CGROUPS = ['Health', 'Kindergarten', 'Family', 'Babysitting', 'Home & services', 'Other'];
const hero = (eb, t, l) => `<section class="hero"><p class="eyebrow">${eb}</p><h1>${t}</h1>${l ? `<p class="lede">${l}</p>` : ''}</section>`;
function contactCard(c, ec) {
  if (ec) return `<div class="contact edit">${['name', 'role', 'phone', 'email', 'note'].map(f => `<input type="${f === 'email' ? 'email' : f === 'phone' ? 'tel' : 'text'}" class="rn-in" id="ct_${c.id}_${f}" value="${esc(c[f] || '')}" placeholder="${{ name: 'Name', role: 'Who they are', phone: 'Phone', email: 'Email', note: 'Note (hours, address…)' }[f]}" data-act="c-field" data-id="${c.id}" data-f="${f}" aria-label="${f}">`).join('')}
    <div class="rn-sub"><select data-act="c-field" data-id="${c.id}" data-f="group" id="ct_${c.id}_g" aria-label="Group">${CGROUPS.map(g => `<option ${(c.group || 'Other') === g ? 'selected' : ''}>${g}</option>`).join('')}</select><button class="chip x" data-act="c-del" data-id="${c.id}" aria-label="Remove ${esc(c.name)}">✕</button></div></div>`;
  const line = (v, label) => v ? `<div class="cline"><span class="sel">${esc(v)}</span><button class="tiny" data-act="copy" data-v="${esc(v)}" aria-label="Copy ${label}">Copy</button></div>` : '';
  return `<div class="contact"><b>${esc(c.name)}</b>${c.role ? `<span class="muted small">${esc(c.role)}</span>` : ''}${line(c.phone, 'phone number')}${line(c.email, 'email')}${c.note ? `<span class="small muted">${esc(c.note)}</span>` : ''}</div>`;
}
function vFamily() {
  const ppl = everyone(), C = H('contacts').list || [], ec = S.ui.edit.contacts;
  let h = hero('Family', 'Everyone in one place.', 'Profiles for all of you, birthdays and colours for the calendar, and the numbers you need when you need them.');
  h += sec('f-people', 'People', `${ppl.length}`, `<div class="people-grid">${ppl.map(n => { const i = pInfo(n), age = ageOf(i.birthday), mem = members().some(m => m.name === n);
    return `<div class="pcard${S.ui.food === 'h:' + n ? ' wide' : ''}"><div class="sec-head"><b>${dot(n)} ${esc(n)}</b><span class="muted small">${age !== '' ? age + (age === 1 ? ' year' : ' years') : ''}</span></div>
      <label class="small">Birthday <input type="date" id="bd_${esc(n)}" data-act="prof-f" data-n="${esc(n)}" data-f="birthday" value="${esc(i.birthday || '')}"></label>
      ${colPick('p:' + n, 'Colour', pColor(n), swatches(PSW(), pColor(n), 'pcol', `data-n="${esc(n)}"`))}
      ${mem ? `<span class="muted small">${n === me ? 'You, on this device' : 'Uses Afloat'}</span>` : `<button class="tiny" data-act="kid-user" data-n="${esc(n)}">Give ${esc(n)} her own Afloat</button>`}
      ${foodBlock('h:' + n)}</div>`; }).join('')}</div>
    <p class="muted small">${kidsList().length ? `Adults and children are added in Household settings (top right). “Give … own Afloat” is for later: then ${esc(theKids())} can pick their name and tick their own self-care stars.` : 'People are added in Household settings (top right).'}</p>`);
  const F = friendsL();
  const pm = modOn('partners');
  h += sec('f-friends', pm ? 'Partners & friends' : 'Friends', `${F.length}`, `${F.length ? `<div class="fr-list">${F.map(f => S.ui.frEdit === f.id ? friendEditor(f) : friendCard(f)).join('')}</div>` : '<p class="empty">Nobody yet.</p>'}
    <form class="addform" data-form="friend"><input type="text" name="text" placeholder="Add someone: name" required aria-label="Name"><button class="btn" type="submit">Add</button></form>
    <p class="muted small">${pm ? 'Partners, metamours and close friends' : 'Close friends and chosen family'} who are part of your life. Everyone with access to Afloat can see these profiles, so keep anything private out of them. They can be ticked on events and invited through Google${kidsList().length ? `, and the ones you trust with ${esc(theKids())} are offered when you need a babysitter` : ''}.</p>`);
  const body = CGROUPS.map(g => { const cs = C.filter(c => (c.group || 'Other') === g); return cs.length ? `<h3>${g}</h3><div class="contacts">${cs.map(c => contactCard(c, ec)).join('')}</div>` : ''; }).join('')
    + (ec ? `<form class="addform" data-form="contact"><input type="text" name="text" placeholder="Name" required aria-label="Name"><input type="text" name="role" placeholder="Who they are" aria-label="Who they are"><input type="tel" name="phone" placeholder="Phone" aria-label="Phone"><input type="email" name="email" placeholder="Email" aria-label="Email"><select name="group" aria-label="Group">${CGROUPS.map(g => `<option>${g}</option>`).join('')}</select><button class="btn" type="submit">Add</button></form>` : '')
    + `<div class="actions">${editBtn('contacts')}</div><p class="muted small">Tapping a number may not start a call from inside Afloat, so each one has a Copy button.</p>`;
  h += sec('f-contacts', 'Contacts', `${C.length}`, C.length || ec ? body : `<p class="empty">No contacts yet.</p><div class="actions">${editBtn('contacts')}</div>`);
  return h;
}

/* ---------- partners & friends: profiles ---------- */
const FR_TYPES = [['partner', 'Partner'], ['nesting', 'Nesting partner'], ['metamour', 'Metamour'], ['comet', 'Comet (now and then)'], ['complicated', 'It’s complicated'], ['friend', 'Close friend'], ['family', 'Chosen family']];
/* without partners in Family, only friends and chosen family (and whatever a profile already is) */
const frTypes = cur => modOn('partners') ? FR_TYPES : FR_TYPES.filter(([v]) => v === 'friend' || v === 'family' || v === cur);
const FR_OUT = [['open', 'Open: fine to mention anywhere'], ['close', 'Family and close friends know'], ['discreet', 'Discreet: careful with photos, titles and invites']];
const initials = n => String(n || '?').split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase();
const avatar = (f, big) => f.photo ? `<img class="av${big ? ' big' : ''}" src="${esc(f.photo)}" alt="">` : `<span class="av${big ? ' big' : ''}" style="background:${pColor(f.name)}" aria-hidden="true">${esc(initials(f.name))}</span>`;
function nextDate(md) { if (!md) return null; const t = new Date(realToday() + 'T12:00'); let d = new Date(`${t.getFullYear()}-${md.slice(5, 10)}T12:00`); if (d < t) d = new Date(`${t.getFullYear() + 1}-${md.slice(5, 10)}T12:00`); return d; }
const inDays = d => Math.round((d - new Date(realToday() + 'T12:00')) / 864e5);
function connLine(f) {
  const l = (f.linked || []).map(esc).join(' & '), poss = l ? l + '’s ' : '';
  switch (f.type) {
    case 'partner': return `${poss}partner`.replace(/^p/, 'P');
    case 'nesting': return `${poss}nesting partner`.replace(/^n/, 'N');
    case 'metamour': return l ? `Metamour, through ${l}` : 'Metamour';
    case 'comet': return l ? `Comet partner of ${l}: now and then` : 'Comet partner: now and then';
    case 'complicated': return l ? `It’s complicated, with ${l}` : 'It’s complicated';
    case 'friend': return l ? `Close friend of ${l}` : 'Close friend';
    case 'family': return 'Chosen family';
    default: return l ? `Connected to ${l}` : '';
  }
}
function friendCard(f) {
  const line = (label, v) => v ? `<div class="cline"><span class="muted small">${label}</span><span class="sel">${esc(v)}</span><button class="tiny" data-act="copy" data-v="${esc(v)}" aria-label="Copy ${label}">Copy</button></div>` : '';
  const bd = nextDate(f.birthday), an = nextDate(f.since), age = ageOf(f.birthday);
  const facts = [
    connLine(f),
    f.kidsName && kidsList().length ? `${esc(theKids().replace(/^t/, 'T'))} call${kidsList().length === 1 ? 's' : ''} them <b>${esc(f.kidsName)}</b>` : '',
    f.regular ? `Usual time: ${esc(f.regular)}` : '',
    bd ? `Birthday ${bd.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}${age !== '' && f.birthday.slice(0, 4) !== '1900' ? ` (turns ${age + 1})` : ''}${inDays(bd) <= 30 ? ` · in ${inDays(bd)} days` : ''}` : '',
    an ? `Together since ${new Date(f.since + 'T12:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}${inDays(an) <= 30 ? ` · anniversary in ${inDays(an)} days` : ''}` : '',
    f.food ? `Food: ${esc(f.food)}` : '',
    f.meal && f.meal.on && window.FOOD ? `In Meals: ${esc(foodLine(foodGet('f:' + f.id), false))}` : '',
    (() => { const fv = ((f.meal || {}).favorites || []).map(r => S.mt.recipes[r]).filter(Boolean); return fv.length ? `Favourite dishes: ${esc(fv.join(', '))}` : ''; })()].filter(Boolean);
  return `<article class="fr-card">
    <div class="fr-top">${avatar(f)}<div class="fr-name"><b>${esc(f.name)}</b>${f.nick ? ` <span class="muted">“${esc(f.nick)}”</span>` : ''}${f.pronouns ? `<span class="muted small">${esc(f.pronouns)}</span>` : ''}${f.rel ? `<span class="rel">${esc(f.rel)}</span>` : ''}</div><button class="tiny" data-act="fr-edit" data-id="${f.id}">Edit</button></div>
    ${(f.canSit && kidsList().length) || f.out === 'discreet' ? `<div class="chips">${f.canSit && kidsList().length ? `<span class="badge ok">Trusted with ${esc(theKids())}</span>` : ''}${f.out === 'discreet' ? '<span class="badge warn">Discreet</span>' : ''}</div>` : ''}
    ${facts.length ? `<ul class="fr-facts">${facts.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}
    ${line('Phone', f.phone)}${line('Email', f.email)}${line(f.msgApp || 'Messages', f.msg)}${line('Address', f.address)}
    <p class="muted small">${f.email ? '✉ Google invitations go to ' + esc(f.email) : 'No email saved, so no Google invitations.'}</p>${lkBlock(f)}
    ${f.notes ? `<p class="small fr-notes">${esc(f.notes)}</p>` : ''}
  </article>`;
}
function friendEditor(f) {
  const inp = (fld, label, type = 'text', ph = '') => `<label class="small fr-f">${label}<input type="${type}" id="fr_${f.id}_${fld}" data-act="fr-f" data-id="${f.id}" data-f="${fld}" value="${esc(f[fld] || '')}" placeholder="${esc(ph)}"${type === 'email' ? ' autocomplete="off"' : ''}></label>`;
  const sel = (fld, label, opts) => `<label class="small fr-f">${label}<select id="fr_${f.id}_${fld}" data-act="fr-f" data-id="${f.id}" data-f="${fld}"><option value="">—</option>${opts.map(([v, l]) => `<option value="${v}" ${f[fld] === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
  return `<article class="fr-card editing">
    <div class="fr-top">${avatar(f, true)}<div class="fr-name"><b>${esc(f.name)}</b><span class="fr-photo"><label class="tiny">${f.photo ? 'Change photo' : 'Add photo'}<input type="file" accept="image/*" data-act="fr-photo" data-id="${f.id}" hidden></label>${f.photo ? `<button class="tiny" data-act="fr-nophoto" data-id="${f.id}">Remove</button>` : ''}</span></div><button class="tiny" data-act="fr-edit" data-id="">Done</button></div>
    <fieldset><legend>Who they are</legend>
      ${inp('nick', 'Nickname')}${inp('pronouns', 'Pronouns', 'text', 'e.g. she/her, they/them')}
      ${sel('type', 'Relationship', frTypes(f.type))}
      <div class="fr-f small">Connected to<div class="chips">${members().map(m => `<button type="button" class="whochip pick${(f.linked || []).includes(m.name) ? ' on' : ''}" style="--c:${pColor(m.name)}" data-act="fr-link" data-id="${f.id}" data-n="${esc(m.name)}" aria-pressed="${(f.linked || []).includes(m.name)}">${esc(m.name)}</button>`).join('')}</div></div>
      ${inp('rel', 'In your words', 'text', modOn('partners') ? 'e.g. my partner’s girlfriend' : 'e.g. friend from university')}
      ${colPick('p:' + f.name, 'Colour', pColor(f.name), swatches(PSW(), pColor(f.name), 'pcol', `data-n="${esc(f.name)}"`))}</fieldset>
    <fieldset><legend>Contact</legend>
      ${inp('phone', 'Phone', 'tel')}${inp('email', 'Email (Google invitations go here)', 'email')}
      ${sel('msgApp', 'Messaging app', [['Signal', 'Signal'], ['WhatsApp', 'WhatsApp'], ['Telegram', 'Telegram'], ['Messenger', 'Messenger'], ['Discord', 'Discord'], ['Instagram', 'Instagram']])}${inp('msg', 'Handle or number there')}
      ${inp('address', 'Address (for visits and pick-ups)')}</fieldset>
    <fieldset><legend>Dates</legend>
      ${inp('birthday', 'Birthday', 'date')}${modOn('partners') || f.since ? inp('since', 'Together since (anniversary)', 'date') : ''}
      <p class="muted small">Birthdays${modOn('partners') ? ' and anniversaries' : ''} show up on the calendar.</p></fieldset>
    <fieldset><legend>${kidsList().length ? 'With the family' : 'Together'}</legend>
      ${kidsList().length ? `${inp('kidsName', `What ${esc(theKids())} call${kidsList().length === 1 ? 's' : ''} them`, 'text', 'e.g. teta Eva')}
      <label class="small fr-check"><input type="checkbox" id="fr_${f.id}_sit" data-act="fr-f" data-id="${f.id}" data-f="canSit" ${f.canSit ? 'checked' : ''}> Trusted to look after ${esc(theKids())} (offered when a babysitter is needed)</label>` : ''}
      ${inp('regular', 'Usual time together', 'text', 'e.g. Thursday evenings')}
      ${modOn('partners') || f.out ? sel('out', 'How open', FR_OUT) : ''}</fieldset>
    <fieldset><legend>Food &amp; meals</legend>
      ${inp('food', 'Food and drink notes', 'text', 'e.g. vegetarian, no coffee after 3')}
      ${window.FOOD ? `<label class="small fr-check"><input type="checkbox" id="fd_${f.id}_on" data-act="food-f" data-k="f:${f.id}" data-f="on" ${f.meal && f.meal.on ? 'checked' : ''}> We cook for ${esc(f.name)} sometimes (show in Meals)</label>
      ${f.meal && f.meal.on ? foodFields('f:' + f.id) : ''}` : ''}</fieldset>
    <fieldset><legend>Notes</legend>
      <label class="small fr-f">Things worth remembering: gift ideas, how they like to be included, agreements you’ve made together<textarea id="fr_${f.id}_notes" data-act="fr-f" data-id="${f.id}" data-f="notes" rows="3">${esc(f.notes || '')}</textarea></label></fieldset>
    <div class="actions"><button class="btn accent" data-act="fr-edit" data-id="">Done</button><button class="btn ghost" data-act="fr-del" data-id="${f.id}">${S.ui.frDel === f.id ? 'Tap again to remove' : 'Remove ' + esc(f.name)}</button></div>
  </article>`;
}
/* ---------- food & meals on each profile (used by the Meals tab) ----------
   Stored as profiles.people[name].meal (household) or friend.meal (friends, shown in Meals when meal.on).
   Shared fields and nutrition guidelines are in platform/food.js. Custom allergens are Meals' own list (apps/mealtime/allergenTags);
   favourite recipes are hearted on a recipe in Meals. */
S.mt = { tags: [], recipes: {}, pantry: [] };
let mtOn = false;
function mtLoad() {
  if (mtOn || !db || !db.app) return; mtOn = true;
  const m = db.app('mealtime'), upd = () => { if (S.view === 'family') render(); };
  m.collection('allergenTags').onSnapshot(s => { S.mt.tags = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)); upd(); }, () => {});
  m.collection('recipes').onSnapshot(s => { S.mt.recipes = Object.fromEntries(s.docs.map(d => [d.id, (d.data() || {}).name || ''])); upd(); }, () => {});
  m.collection('pantry').onSnapshot(s => { S.mt.pantry = s.docs.map(d => ({ id: d.id, ...d.data() })); }, () => {});
}
const foodKid = key => key.startsWith('h:') && kidsList().includes(key.slice(2)) && !members().some(m => m.name === key.slice(2));
const foodRaw = key => key.startsWith('h:') ? ((H('profiles').people || {})[key.slice(2)] || {}).meal || {} : (friendsL().find(f => f.id === key.slice(2)) || {}).meal || {};
/* a person's food profile with everything filled in, plus child and age the way Meals sees them */
function foodGet(key) {
  const F = window.FOOD, raw = foodRaw(key), home = key.startsWith('h:'), m = F.meal(raw, home), kid = foodKid(key);
  const a = home ? F.ageFrom(pInfo(key.slice(2)).birthday) : null;
  return { ...m, child: kid, age: kid ? (a != null ? a : (+raw.age || null)) : null };
}
function foodSave(key, patch, quiet) {
  const F = window.FOOD, raw = foodRaw(key), home = key.startsWith('h:');
  const keep = {}; for (const k of ['id', 'age', 'on']) if (raw[k] != null) keep[k] = raw[k];
  const next = { ...F.meal(raw, home), ...keep, ...patch }, o = { ...H('profiles') };
  if (home) { const n = key.slice(2); o.people = { ...(o.people || {}), [n]: { ...((o.people || {})[n] || {}), meal: next } }; }
  else o.friends = friendsL().map(f => f.id === key.slice(2) ? { ...f, meal: next } : f);
  quiet ? saveQuiet('profiles', o) : saveHome('profiles', o);
}
const alName = id => ((window.FOOD.ALLERGENS.find(a => a[0] === id) || [])[1]) || ((S.mt.tags.find(t => t.id === id) || {}).label) || '';
function foodLine(p, home) {
  const F = window.FOOD, S2 = F.SLOTS, al = p.allergens.map(alName).filter(Boolean);
  const sl = a => a.length === S2.length ? 'all meals' : a.length ? a.join(', ') : 'no meals';
  const at = !p.regular ? (home ? 'Not usually at the table' : '') : sl(p.meals.weekday) === sl(p.meals.weekend) ? `At home for ${sl(p.meals.weekday)}` : `Weekdays: ${sl(p.meals.weekday)} · weekends: ${sl(p.meals.weekend)}`;
  return [(F.PERSON_DIETS.find(d => d[0] === p.diet) || [])[1], al.length ? 'Allergies: ' + al.join(', ') : '', p.avoid.length ? 'Won’t eat: ' + p.avoid.join(', ') : '', at].filter(Boolean).join(' · ');
}
function foodBlock(key) {
  if (!window.FOOD) return '';
  mtLoad();
  const open = S.ui.food === key;
  return `<div class="food${open ? ' open' : ''}"><div class="sec-head"><b class="small">Food &amp; meals</b><button class="tiny" data-act="food-edit" data-k="${esc(key)}">${open ? 'Done' : 'Edit'}</button></div>
    ${open ? foodFields(key) : `<span class="muted small">${esc(foodLine(foodGet(key), true))}</span>`}</div>`;
}
function foodFields(key) {
  const F = window.FOOD, p = foodGet(key), home = key.startsWith('h:'), k = esc(key), id = 'fd_' + key.replace(/[^A-Za-z0-9]/g, '_');
  const tog = (act, on, label, extra) => `<button type="button" class="tiny${on ? ' on' : ''}" data-act="${act}" data-k="${k}" ${extra} aria-pressed="${on}">${esc(label)}</button>`;
  const g = F.guide(p), favs = p.favorites.filter(r => S.mt.recipes[r] !== undefined);
  return `<div class="food-f">
    <label class="small">Diet <select id="${id}_diet" data-act="food-f" data-k="${k}" data-f="diet">${F.PERSON_DIETS.map(([v, l]) => `<option value="${v}" ${p.diet === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="small fr-check"><input type="checkbox" id="${id}_reg" data-act="food-f" data-k="${k}" data-f="regular" ${p.regular ? 'checked' : ''}> ${home ? 'Usually at the table at home' : 'Usually at the table (added to meals by default)'}</label>
    ${p.regular ? [['weekday', 'Weekdays (Mon–Fri)'], ['weekend', 'Weekends']].map(([w, l]) => `<div class="small"><span class="muted">Eats at home · ${l}</span><div class="chips">${F.SLOTS.map(sl => tog('food-slot', p.meals[w].includes(sl), sl, `data-w="${w}" data-s="${esc(sl)}"`)).join('')}</div></div>`).join('') : ''}
    <label class="small">Sex, for nutrition guidelines <select id="${id}_sex" data-act="food-f" data-k="${k}" data-f="sex"><option value="" ${!p.sex ? 'selected' : ''}>Not specified</option><option value="f" ${p.sex === 'f' ? 'selected' : ''}>Female</option><option value="m" ${p.sex === 'm' ? 'selected' : ''}>Male</option></select></label>
    ${p.child ? `<p class="muted small">${p.age != null ? `Age ${p.age}, from the birthday above.` : 'Add a birthday above so portions follow her age.'}</p>` : ''}
    <label class="small">Daily calories (optional) <input type="number" min="500" max="5000" step="50" id="${id}_kcal" data-act="food-f" data-k="${k}" data-f="kcalTarget" value="${esc(p.kcalTarget || '')}" placeholder="${F.guide({ ...p, kcalTarget: null }).kcal}"></label>
    <p class="muted small">${esc(g.label)}: about ${g.kcal} kcal, at least ${g.protein} g protein and ${g.fruitveg} g fruit &amp; veg a day.</p>
    <div class="small"><span class="muted">Food allergies</span><div class="chips">${[...F.ALLERGENS, ...S.mt.tags.map(t => [t.id, t.label])].map(([a, l]) => tog('food-al', p.allergens.includes(a), l, `data-a="${esc(a)}"`)).join('')}</div></div>
    <form class="addform" data-form="food-tag" data-k="${k}"><input type="text" name="text" id="${id}_tag" placeholder="Add your own, e.g. Cashew" aria-label="New allergen" required><button class="btn" type="submit">Add</button></form>
    <label class="small">Won’t eat (comma separated) <input type="text" id="${id}_avoid" data-act="food-f" data-k="${k}" data-f="avoid" value="${esc(p.avoid.join(', '))}" placeholder="mushrooms, coriander"></label>
    <label class="small">Likes (comma separated) <input type="text" id="${id}_likes" data-act="food-f" data-k="${k}" data-f="likes" value="${esc(p.likes.join(', '))}" placeholder="pasta, soup"></label>
    ${home ? `<label class="small">Notes <textarea id="${id}_notes" rows="2" data-act="food-f" data-k="${k}" data-f="notes">${esc(p.notes)}</textarea></label>` : ''}
    <div class="small"><span class="muted">Favourite recipes</span>${favs.length ? `<div class="chips">${favs.map(r => `<span class="tiny">${esc(S.mt.recipes[r])} <button type="button" class="link" data-act="food-unfav" data-k="${k}" data-r="${esc(r)}" aria-label="Remove ${esc(S.mt.recipes[r])} from favourites">✕</button></span>`).join('')}</div>` : '<p class="muted small">None yet. Tap ♥ on a recipe in Meals.</p>'}</div>
    <p class="muted small">Meals uses this to suggest dishes everyone can eat and to size portions.</p></div>`;
}
function foodTag(key, label) {
  const F = window.FOOD, l = label.toLowerCase(), std = F.ALLERGENS.find(a => a[1].toLowerCase() === l || a[0] === l);
  let tid = std ? std[0] : (S.mt.tags.find(t => t.label.toLowerCase() === l) || {}).id;
  if (!tid) {
    tid = 'x-' + (F.slug(label) || uid()); if (S.mt.tags.some(t => t.id === tid)) tid += '-' + uid().slice(0, 4);
    const t = { label, keywords: [l], createdAt: Date.now() }; S.mt.tags = [...S.mt.tags, { id: tid, ...t }];
    if (db && db.app) db.app('mealtime').doc('allergenTags/' + tid).set(t).catch(() => toast('Couldn’t save the new allergen.'));
  }
  const p = foodGet(key); if (!p.allergens.includes(tid)) foodSave(key, { allergens: [...p.allergens, tid] });
}
function photoToData(file) {
  return new Promise((res, rej) => { const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => { const S2 = 192, c = document.createElement('canvas'); c.width = c.height = S2; const k = Math.max(S2 / img.width, S2 / img.height), w = img.width * k, h = img.height * k;
      c.getContext('2d').drawImage(img, (S2 - w) / 2, (S2 - h) / 2, w, h); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.82)); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('bad image')); }; img.src = url; });
}
const setFriend = (id, patch, quiet) => { const o = { ...H('profiles') }; o.friends = friendsL().map(f => f.id === id ? { ...f, ...patch } : f); quiet ? saveQuiet('profiles', o) : saveHome('profiles', o); };
/* birthdays and anniversaries as calendar entries (Afloat only, never written to Google) */
function dateEvents() {
  const out = [], [a, b] = calRange[0] ? calRange : [calAdd(realToday(), -1), calAdd(realToday(), 60)];
  const add = (md, title, who) => { if (!md) return; for (const y of [+a.slice(0, 4), +a.slice(0, 4) + 1]) { const k = `${y}-${md.slice(5, 10)}`; if (k >= a && k <= b) out.push({ id: '', title, date: k, endDate: k, allDay: true, start: '', end: '', kind: 'family', who: [who], src: 'mine', isDate: true, notes: '' }); } };
  for (const n of everyone()) add(pInfo(n).birthday, `🎂 ${n}’s birthday`, n);
  for (const f of friendsL()) { add(f.birthday, `🎂 ${f.name}’s birthday`, f.name); if (f.since) add(f.since, `♡ ${f.name}: anniversary`, f.name); }
  return out;
}
/* ---------- taps on this area's buttons (data-act), called from events.js; true = handled ---------- */
function tapFamily(a, el, e, r) {
  switch (a) {
    case 'fr-del': { if (S.ui.frDel !== el.dataset.id) { S.ui.frDel = el.dataset.id; render(true); return true; } S.ui.frDel = null; S.ui.frEdit = null; const o = { ...H('profiles') }; o.friends = friendsL().filter(f => f.id !== el.dataset.id); saveHome('profiles', o); return true; }
    case 'food-edit': S.ui.food = S.ui.food === el.dataset.k ? null : el.dataset.k; render(true); return true;
    case 'food-unfav': { const p = foodGet(el.dataset.k); foodSave(el.dataset.k, { favorites: p.favorites.filter(r => r !== el.dataset.r) }); return true; }
    case 'fr-edit': S.ui.frEdit = el.dataset.id || null; S.ui.frDel = null; S.ui.colOpen = null; render(true); if (el.dataset.id) setTimeout(() => { const c = document.querySelector('.fr-card.editing'); if (c) c.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 0); return true;
    case 'fr-link': { const f = friendsL().find(x => x.id === el.dataset.id); if (!f) return true; const l = f.linked || [], n = el.dataset.n; setFriend(f.id, { linked: l.includes(n) ? l.filter(x => x !== n) : [...l, n] }); return true; }
    case 'fr-nophoto': setFriend(el.dataset.id, { photo: '' }); return true;
    case 'copy': { const v = el.dataset.v; try { navigator.clipboard.writeText(v).then(() => toast('Copied.'), () => toast('Press and hold the text to copy it.')); } catch { toast('Press and hold the text to copy it.'); } return true; }
    case 'c-del': { const o = { ...H('contacts') }; o.list = (o.list || []).filter(c => c.id !== el.dataset.id); saveHome('contacts', o); return true; }
    case 'kid-user': { const o = { ...H('household') }; if (!(o.members || []).some(m => m.name === el.dataset.n)) o.members = [...(o.members || []), { id: uid(), name: el.dataset.n }]; saveHome('household', o); toast(`${el.dataset.n} can now choose her name in Afloat.`); return true; }
  }
  return false;
}
