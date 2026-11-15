// Planning together across households (11 Nov 2026): one plan, several households, everyone edits it.
//
// together/<id> = { plan, owner, members: [emails], houses: { [hid]: { lead, people: [emails] } }, names: { [email]: name },
//   invited: { [email]: { by, byName, at } }, at }
// - Only someone you're connected with in Afloat (an 'on' link, functions/links.js) can be invited, and they answer first.
// - Joining brings the joiner's whole household in (they plan the trip together anyway, and a household shares its plans).
//   `lead` is the person in each household whose phone does that household's bookkeeping (moving with the calendar event,
//   the afterwards list). The plan itself is read and written by the phones directly; the rules (firestore.rules) let only
//   members read it and only change `plan` and `at`. Who is in it changes only here.
// - Leaving takes your household out; the last household leaving deletes it.
// Everything takes the Firestore instance and a few helpers as arguments, so the tests can use pretend ones.

const norm = e => String(e || '').trim().toLowerCase();
const clip = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
const newId = () => require('crypto').randomBytes(9).toString('base64url').replace(/[^A-Za-z0-9]/g, 'x');
const err = (code, message) => Object.assign(new Error(message), { code });
const MAX_HOUSES = 6, MAX_BYTES = 200000;

/* a plan from a phone: an object, not too big, its id set to the shared id */
function cleanPlan(p, id) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) throw err('bad_plan', 'That plan didn’t come through.');
  const s = JSON.stringify(p);
  if (s.length > MAX_BYTES) throw err('too_big', 'That plan is too big to share.');
  const q = JSON.parse(s); q.id = id; q.title = clip(q.title, 80) || 'A plan'; delete q.shared; return q;
}
const okId = id => /^[A-Za-z0-9]{6,40}$/.test(String(id || ''));
/* what someone sees about an invitation before joining: just enough to decide */
const invView = (id, T, email) => ({ id, title: (T.plan || {}).title || 'A plan', kind: (T.plan || {}).kind || '', start: (T.plan || {}).start || '', end: (T.plan || {}).end || '',
  place: (T.plan || {}).place || '', from: ((T.invited || {})[email] || {}).byName || '', who: Object.values(T.names || {}).filter(Boolean) });

/* data: { action: 'plan-…', … }. me: { email, name }. deps: { resolve(email) → household, members(household) → [emails], notify(email, msg), now } */
async function handle(fs, me, data, deps) {
  const email = norm(me.email), d = data || {}, a = String(d.action || ''), now = deps.now ? deps.now() : Date.now();
  const linkOn = async linkId => {
    if (!okId(linkId)) throw err('not_linked', 'You can only plan together with someone you’re connected with in Afloat.');
    const s = await fs.doc(`links/${linkId}`).get(), L = s.exists ? s.data() : null, pair = ((L && L.pair) || []).map(norm);
    if (!L || L.status !== 'on' || !pair.includes(email)) throw err('not_linked', 'You can only plan together with someone you’re connected with in Afloat.');
    return pair.find(e => e !== email);
  };
  const mine = async () => { const h = await deps.resolve(email); if (!h) throw err('not_member', 'You aren’t in a household.'); return { h, people: (await deps.members(h)).map(norm) }; };
  const load = async id => {
    if (!okId(id)) throw err('not_found', 'That plan isn’t shared any more.');
    const ref = fs.doc(`together/${id}`), s = await ref.get(); return { ref, T: s.exists ? s.data() : null };
  };
  const invite = async (ref, T, id, peer) => {
    if ((T.members || []).map(norm).includes(peer)) return T;
    if (Object.keys(T.houses || {}).length >= MAX_HOUSES) throw err('too_many', 'That’s as many households as one plan can hold.');
    const invited = { ...(T.invited || {}), [peer]: { by: email, byName: clip(me.name, 40), at: now } }, N = { ...T, invited, inv: Object.keys(invited), at: now };
    await ref.set(N);
    await deps.notify(peer, { title: `Plan it together? ${(T.plan || {}).title || ''}`.trim(), body: `${clip(me.name, 40) || email} asks you to plan it with them in Afloat.` });
    return N;
  };

  if (a === 'plan-list') {
    const [m, i] = await Promise.all([fs.collection('together').where('members', 'array-contains', email).get(), fs.collection('together').where('inv', 'array-contains', email).get()]);
    return { plans: m.docs.map(s => s.id), invites: i.docs.filter(s => ((s.data() || {}).invited || {})[email]).map(s => invView(s.id, s.data(), email)) };
  }
  if (a === 'plan-share') {
    const peer = await linkOn(d.link);
    if (d.id) {
      const { ref, T } = await load(d.id);
      if (T) { if (!(T.members || []).map(norm).includes(email)) throw err('not_found', 'That plan isn’t shared any more.'); const N = await invite(ref, T, d.id, peer); return { id: d.id, invited: Object.keys(N.invited || {}) }; }
    }
    const { h, people } = await mine(), id = okId(d.id) ? d.id : newId(), ref = fs.doc(`together/${id}`);
    const T = { plan: cleanPlan(d.plan, id), owner: email, members: people, houses: { [h.hid]: { lead: email, people } }, names: { [email]: clip(me.name, 40) }, invited: {}, inv: [], at: now };
    await ref.set(T); const N = await invite(ref, T, id, peer);
    return { id, invited: Object.keys(N.invited || {}) };
  }
  const { ref, T } = await load(d.id);
  if (!T) throw err('not_found', 'That plan isn’t shared any more.');
  const inv = (T.invited || {})[email];
  if (a === 'plan-answer') {
    if (!inv) throw err('not_found', 'There’s nothing to answer here.');
    const rest = { ...(T.invited || {}) }; delete rest[email];
    if (!d.yes) { await ref.set({ ...T, invited: rest, inv: Object.keys(rest), at: now }); return { gone: true }; }
    const { h, people } = await mine();
    const was = (T.houses || {})[h.hid], all = [...new Set([...(T.members || []).map(norm), ...people])];
    const N = { ...T, members: all, houses: { ...(T.houses || {}), [h.hid]: was || { lead: email, people } }, names: { ...(T.names || {}), [email]: clip(me.name, 40) }, invited: rest, inv: Object.keys(rest), at: now };
    await ref.set(N);
    await deps.notify(inv.by, { title: `${clip(me.name, 40) || email} is planning it with you`, body: (T.plan || {}).title || '' });
    return { id: d.id };
  }
  if (!(T.members || []).map(norm).includes(email)) throw err('not_found', 'That plan isn’t shared any more.');
  if (a === 'plan-invite') { const peer = await linkOn(d.link), N = await invite(ref, T, d.id, peer); return { id: d.id, invited: Object.keys(N.invited || {}) }; }
  if (a === 'plan-leave') {
    const hid = Object.keys(T.houses || {}).find(k => (T.houses[k].people || []).map(norm).includes(email));
    const out = new Set(hid ? T.houses[hid].people.map(norm) : [email]), houses = { ...(T.houses || {}) }; if (hid) delete houses[hid];
    const members = (T.members || []).map(norm).filter(e => !out.has(e));
    if (!members.length) { await ref.delete(); return { gone: true, deleted: true }; }
    const names = Object.fromEntries(Object.entries(T.names || {}).filter(([e]) => !out.has(norm(e))));
    const owner = out.has(norm(T.owner)) ? (Object.values(houses)[0] || {}).lead || members[0] : T.owner;
    await ref.set({ ...T, members, houses, names, owner, at: now });
    return { gone: true };
  }
  throw err('bad_action', 'Afloat doesn’t know that.');
}

module.exports = { handle, cleanPlan };
