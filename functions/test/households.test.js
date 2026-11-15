// Households (10 Nov 2026): the first household stays where it was; new ones start from an invitation and keep apart.
const test = require('node:test'), assert = require('node:assert');
const H = require('../households');

/* a pretend Firestore: doc(path).get/set/delete, collection(path).get */
function fakeFs(seed = {}) {
  const data = new Map(Object.entries(seed));
  const snap = (id, v) => ({ id, exists: v !== undefined, data: () => (v === undefined ? undefined : JSON.parse(JSON.stringify(v))) });
  return {
    data,
    doc: p => ({ get: async () => snap(p.split('/').pop(), data.get(p)), set: async (v, o) => data.set(p, o && o.merge ? { ...(data.get(p) || {}), ...v } : v), delete: async () => data.delete(p) }),
    collection: c => ({ get: async () => ({ docs: [...data.keys()].filter(k => k.startsWith(c + '/') && k.split('/').length === c.split('/').length + 1).map(k => snap(k.split('/').pop(), data.get(k))) }) }),
  };
}
const ADMIN = 'Owner@Example.com';

test('the first household: the admin and the members on access/members, base path unchanged', async () => {
  const fs = fakeFs({ 'access/members': { emails: ['partner@example.com'] } });
  const a = await H.resolve(fs, 'owner@example.com', ADMIN), p = await H.resolve(fs, 'PARTNER@example.com', ADMIN);
  assert.deepEqual([a.hid, a.base, a.owner, a.legacy], ['legacy', '', true, true]);
  assert.deepEqual([p.hid, p.base, p.owner], ['legacy', '', false]);
  assert.equal(await H.resolve(fs, 'stranger@example.com', ADMIN), null);
  assert.equal(await H.allowed(fs, 'stranger@example.com', ADMIN), false);
});

test('a new household needs an invitation, and the invitation is used up', async () => {
  const fs = fakeFs();
  await assert.rejects(H.create(fs, 'friend@example.com', 'Friends', ADMIN), e => e.code === 'not_invited');
  await H.invite(fs, 'Friend@Example.com', ADMIN);
  assert.equal(await H.allowed(fs, 'friend@example.com', ADMIN), true, 'an invited address may sign in');
  const h = await H.create(fs, 'friend@example.com', '  The Nováks ', ADMIN);
  assert.match(h.base, /^households\/[A-Za-z0-9]+\/$/);
  const r = await H.resolve(fs, 'friend@example.com', ADMIN);
  assert.deepEqual([r.hid, r.owner, r.legacy, r.name], [h.hid, true, false, 'The Nováks']);
  assert.equal(await H.invited(fs, 'friend@example.com'), false, 'the invitation is used');
  await assert.rejects(H.create(fs, 'friend@example.com', 'Again', ADMIN), e => e.code === 'already_member');
});

test('the admin can’t invite someone who is already in a household', async () => {
  const fs = fakeFs({ 'access/members': { emails: ['partner@example.com'] } });
  await assert.rejects(H.invite(fs, 'partner@example.com', ADMIN), e => e.code === 'already_member');
  await assert.rejects(H.invite(fs, 'not an email', ADMIN), e => e.code === 'bad_email');
  await H.invite(fs, 'a@example.com', ADMIN); await H.uninvite(fs, 'a@example.com');
  assert.equal(await H.invited(fs, 'a@example.com'), false);
});

test('a household owner adds and removes members; nobody can be in two households', async () => {
  const fs = fakeFs({ 'access/members': { emails: ['partner@example.com'] } });
  await H.invite(fs, 'friend@example.com', ADMIN);
  const h = await H.create(fs, 'friend@example.com', 'F', ADMIN);
  await H.setMembers(fs, h, ['their.partner@example.com'], ADMIN);
  const m = await H.resolve(fs, 'their.partner@example.com', ADMIN);
  assert.deepEqual([m.hid, m.owner], [h.hid, false]);
  assert.deepEqual(await H.members(fs, h, ADMIN), ['friend@example.com', 'their.partner@example.com']);
  await assert.rejects(H.setMembers(fs, m, ['x@example.com'], ADMIN), e => e.code === 'not_owner');
  await assert.rejects(H.setMembers(fs, h, ['partner@example.com'], ADMIN), e => e.code === 'other_household', 'a first-household member can’t be taken');
  const first = await H.resolve(fs, 'owner@example.com', ADMIN);
  await assert.rejects(H.setMembers(fs, first, ['partner@example.com', 'their.partner@example.com'], ADMIN), e => e.code === 'other_household');
  await H.setMembers(fs, h, [], ADMIN);
  assert.equal(await H.resolve(fs, 'their.partner@example.com', ADMIN), null, 'a removed member is out');
  assert.equal(fs.data.has('users/their.partner@example.com'), false);
});

test('a users/ entry alone isn’t enough: the household has to list the address', async () => {
  const fs = fakeFs({ 'households/h1': { owner: 'a@example.com', members: ['a@example.com'] }, 'users/b@example.com': { hid: 'h1' } });
  assert.equal(await H.resolve(fs, 'b@example.com', ADMIN), null);
});

test('notify documents belong to the household in their path', () => {
  assert.equal(H.notifyHid('apps/afloat/notify/uid1'), 'legacy');
  assert.equal(H.notifyHid('households/h1/apps/afloat/notify/uid1'), 'h1');
  assert.equal(H.notifyHid('somewhere/else/notify/uid1'), null);
});

test('Claude keys: the first household uses the server’s, others only their own', async () => {
  const fs = fakeFs({ 'hkeys/h1': { key: 'sk-ant-own' } });
  assert.equal(await H.claudeKey(fs, { legacy: true }, 'sk-ant-server'), 'sk-ant-server');
  assert.equal(await H.claudeKey(fs, { legacy: false, hid: 'h1' }, 'sk-ant-server'), 'sk-ant-own');
  assert.equal(await H.claudeKey(fs, { legacy: false, hid: 'h2' }, 'sk-ant-server'), '', 'no key: Claude is off, never the server’s');
  assert.equal(H.okKey('sk-ant-api03-' + 'a'.repeat(40)), true);
  assert.equal(H.okKey('hello'), false);
});
