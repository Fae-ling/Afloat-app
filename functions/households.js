// Households: one Afloat, many households (10 Nov 2026).
//
// The first (legacy) household stays exactly where it always was: data under apps/<app>/, members in
// access/members plus OWNER_EMAIL. It is called "legacy" here and its base path is ''.
// Every other household lives under households/<hid>/: the household document holds { name, owner, members: [emails] },
// its data is at households/<hid>/apps/<app>/..., and users/<email> = { hid } says which household an address belongs to.
// A new household can only be started by an address the admin (OWNER_EMAIL) invited: invites/<email>.
// Each new household brings its own Claude key, kept server-only in hkeys/<hid>.
//
// Everything here takes the Firestore instance as an argument, so the tests can use a pretend one.

const EMAIL = /^[^@\s/]+@[^@\s/]+\.[^@\s/]+$/;
const norm = e => String(e || '').trim().toLowerCase();
const okEmail = e => EMAIL.test(norm(e));
const LEGACY = 'legacy';
const baseOf = hid => (hid === LEGACY ? '' : `households/${hid}/`);
const newId = () => require('crypto').randomBytes(9).toString('base64url').replace(/[^A-Za-z0-9]/g, 'x');

async function legacyMembers(fs) {
  const m = await fs.doc('access/members').get();
  return ((m.exists && m.data().emails) || []).map(norm);
}

/* which household an address belongs to: { hid, base, legacy, owner, name } or null */
async function resolve(fs, email, adminEmail) {
  email = norm(email); const admin = norm(adminEmail);
  if (!email) return null;
  if (email === admin || (await legacyMembers(fs)).includes(email)) return { hid: LEGACY, base: '', legacy: true, owner: email === admin, name: '' };
  const u = await fs.doc(`users/${email}`).get(), hid = u.exists && u.data().hid;
  if (!hid || hid === LEGACY) return null;
  const h = await fs.doc(`households/${hid}`).get();
  if (!h.exists) return null;
  const d = h.data() || {};
  if (!(d.members || []).map(norm).includes(email)) return null;
  return { hid, base: baseOf(hid), legacy: false, owner: norm(d.owner) === email, name: d.name || '' };
}

/* invited to start a household (and not in one yet) */
async function invited(fs, email) {
  email = norm(email); if (!email) return false;
  const i = await fs.doc(`invites/${email}`).get();
  return !!(i.exists && !(i.data() || {}).usedAt);
}

/* may this address sign in at all (the sign-in door) */
async function allowed(fs, email, adminEmail) {
  return !!(await resolve(fs, email, adminEmail)) || (await invited(fs, email));
}

/* the members of a household, owner first */
async function members(fs, house, adminEmail) {
  if (house.legacy) return [norm(adminEmail), ...(await legacyMembers(fs))];
  const d = (await fs.doc(`households/${house.hid}`).get()).data() || {};
  return [norm(d.owner), ...(d.members || []).map(norm).filter(e => e !== norm(d.owner))];
}

/* an invited address starts its own household */
async function create(fs, email, name, adminEmail) {
  email = norm(email);
  if (await resolve(fs, email, adminEmail)) throw Object.assign(new Error('This address is already in a household.'), { code: 'already_member' });
  if (!(await invited(fs, email))) throw Object.assign(new Error('Starting a household needs an invitation.'), { code: 'not_invited' });
  const hid = newId(), at = Date.now();
  await fs.doc(`households/${hid}`).set({ name: String(name || '').trim().slice(0, 60) || 'Our household', owner: email, members: [email], at });
  await fs.doc(`users/${email}`).set({ hid, at });
  await fs.doc(`invites/${email}`).set({ usedAt: at, hid }, { merge: true });
  return { hid, base: baseOf(hid), legacy: false, owner: true, name: String(name || '').trim().slice(0, 60) || 'Our household' };
}

/* the owner sets who else is in the household (a list of emails, without the owner) */
async function setMembers(fs, house, emails, adminEmail) {
  if (!house.owner) throw Object.assign(new Error('Only the owner can change who’s in the household.'), { code: 'not_owner' });
  const list = [...new Set((emails || []).map(norm).filter(okEmail))].slice(0, 20);
  if (house.legacy) {
    const clash = [];
    for (const e of list) { const u = await fs.doc(`users/${e}`).get(); if (u.exists && u.data().hid && u.data().hid !== LEGACY) clash.push(e); }
    if (clash.length) throw Object.assign(new Error(`${clash.join(', ')} is already in another household.`), { code: 'other_household' });
    await fs.doc('access/members').set({ emails: list, at: Date.now() });
    return list;
  }
  const ref = fs.doc(`households/${house.hid}`), d = (await ref.get()).data() || {}, owner = norm(d.owner);
  const want = list.filter(e => e !== owner), was = (d.members || []).map(norm).filter(e => e !== owner);
  const legacy = [norm(adminEmail), ...(await legacyMembers(fs))];
  for (const e of want) {
    if (was.includes(e)) continue;
    const u = await fs.doc(`users/${e}`).get();
    if (legacy.includes(e) || (u.exists && u.data().hid && u.data().hid !== house.hid)) throw Object.assign(new Error(`${e} is already in another household.`), { code: 'other_household' });
  }
  await ref.set({ ...d, members: [owner, ...want], at: Date.now() });
  for (const e of want) if (!was.includes(e)) await fs.doc(`users/${e}`).set({ hid: house.hid, at: Date.now() });
  for (const e of was) if (!want.includes(e)) { const u = await fs.doc(`users/${e}`).get(); if (u.exists && u.data().hid === house.hid) await fs.doc(`users/${e}`).delete(); }
  return want;
}

/* the admin's invitations: list, add, remove (a used one stays, as a record) */
async function invites(fs) {
  const q = await fs.collection('invites').get();
  return q.docs.map(d => ({ email: d.id, ...(d.data() || {}) })).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 50);
}
async function invite(fs, email, adminEmail) {
  email = norm(email);
  if (!okEmail(email)) throw Object.assign(new Error('That isn’t an email address.'), { code: 'bad_email' });
  if (await resolve(fs, email, adminEmail)) throw Object.assign(new Error(`${email} is already in a household.`), { code: 'already_member' });
  await fs.doc(`invites/${email}`).set({ at: Date.now() });
  return email;
}
async function uninvite(fs, email) {
  email = norm(email); const i = await fs.doc(`invites/${email}`).get();
  if (i.exists && !(i.data() || {}).usedAt) await fs.doc(`invites/${email}`).delete();
}

/* a notify document's path → the household it belongs to ('legacy' or a hid) */
function notifyHid(path) {
  const m = /^households\/([^/]+)\/apps\/[^/]+\/notify\/[^/]+$/.exec(path);
  if (m) return m[1];
  return /^apps\/[^/]+\/notify\/[^/]+$/.test(path) ? LEGACY : null;
}

/* the household's Claude key: the server's own for the first household, the household's own for everyone else */
async function claudeKey(fs, house, serverKey) {
  if (house.legacy) return serverKey;
  const k = await fs.doc(`hkeys/${house.hid}`).get();
  return (k.exists && (k.data() || {}).key) || '';
}
const okKey = k => /^sk-ant-[A-Za-z0-9_-]{20,200}$/.test(String(k || '').trim());

module.exports = { LEGACY, norm, okEmail, baseOf, resolve, invited, allowed, members, create, setMembers, invites, invite, uninvite, notifyHid, claudeKey, okKey };
