// Planning together across households (11 Nov 2026).
const test = require('node:test'), assert = require('node:assert');
const TG = require('../together');

function fakeFs() {
  const data = new Map();
  const snap = (id, v) => ({ id, exists: v !== undefined, data: () => (v === undefined ? undefined : JSON.parse(JSON.stringify(v))) });
  return { data,
    doc: p => ({ get: async () => snap(p.split('/').pop(), data.get(p)), set: async v => data.set(p, JSON.parse(JSON.stringify(v))), delete: async () => data.delete(p) }),
    collection: c => ({ where: (f, op, v) => ({ get: async () => ({ docs: [...data.keys()].filter(k => k.startsWith(c + '/') && (data.get(k)[f] || []).includes(v)).map(k => snap(k.split('/').pop(), data.get(k))) }) }) }) };
}
const HOUSES = { 'ane@x.cz': { hid: 'legacy', legacy: true }, 'sam@x.cz': { hid: 'legacy', legacy: true }, 'jo@x.cz': { hid: 'h2' }, 'quinn@x.cz': { hid: 'h2' }, 'zed@x.cz': { hid: 'h3' } };
const PEOPLE = { legacy: ['ane@x.cz', 'sam@x.cz'], h2: ['jo@x.cz', 'quinn@x.cz'], h3: ['zed@x.cz'] };
function deps() { const sent = []; return { sent, now: () => 1, resolve: async e => HOUSES[e] || null, members: async h => PEOPLE[h.hid], notify: async (e, m) => sent.push([e, m.title]) }; }
const ANE = { email: 'ane@x.cz', name: 'Alex' }, SAM = { email: 'sam@x.cz', name: 'Sam' }, IF = { email: 'Jo@x.cz', name: 'Jo' }, ZED = { email: 'zed@x.cz', name: 'Zed' };
const linked = fs => { fs.data.set('links/LinkAneIf1', { pair: ['ane@x.cz', 'jo@x.cz'], status: 'on' }); fs.data.set('links/LinkAneZed1', { pair: ['ane@x.cz', 'zed@x.cz'], status: 'asked' }); };
const PLAN = { id: 'local1', title: 'Lisbon', kind: 'trip', start: '2026-12-01', end: '2026-12-05', pack: [{ id: 'a', text: 'Passports' }] };

test('a plan is shared with a connected friend, who joins with their household', async () => {
  const fs = fakeFs(), D = deps(); linked(fs);
  const r = await TG.handle(fs, ANE, { action: 'plan-share', plan: PLAN, link: 'LinkAneIf1' }, D);
  const T = fs.data.get('together/' + r.id);
  assert.deepEqual(T.members, ['ane@x.cz', 'sam@x.cz'], 'my whole household is in from the start');
  assert.equal(T.plan.id, r.id); assert.deepEqual(r.invited, ['jo@x.cz']); assert.deepEqual(T.inv, ['jo@x.cz']);
  assert.equal(D.sent[0][0], 'jo@x.cz');
  const l = await TG.handle(fs, IF, { action: 'plan-list' }, D);
  assert.equal(l.invites.length, 1); assert.equal(l.invites[0].title, 'Lisbon'); assert.equal(l.invites[0].from, 'Alex'); assert.deepEqual(l.plans, []);
  assert.equal((await TG.handle(fs, { email: 'quinn@x.cz' }, { action: 'plan-list' }, D)).invites.length, 0, 'only the invited person is asked');
  await TG.handle(fs, IF, { action: 'plan-answer', id: r.id, yes: true }, D);
  const T2 = fs.data.get('together/' + r.id);
  assert.deepEqual(T2.members, ['ane@x.cz', 'sam@x.cz', 'jo@x.cz', 'quinn@x.cz'], 'their household joins too');
  assert.equal(T2.houses.h2.lead, 'jo@x.cz'); assert.deepEqual(T2.inv, []);
  assert.deepEqual((await TG.handle(fs, { email: 'quinn@x.cz' }, { action: 'plan-list' }, D)).plans, [r.id]);
  assert.equal(D.sent[1][0], 'ane@x.cz', 'the one who asked hears the yes');
});

test('only connected people can be invited; strangers can do nothing', async () => {
  const fs = fakeFs(), D = deps(); linked(fs);
  await assert.rejects(TG.handle(fs, ANE, { action: 'plan-share', plan: PLAN, link: 'LinkAneZed1' }, D), e => e.code === 'not_linked', 'a link not yet on');
  await assert.rejects(TG.handle(fs, SAM, { action: 'plan-share', plan: PLAN, link: 'LinkAneIf1' }, D), e => e.code === 'not_linked', 'someone else’s link');
  const r = await TG.handle(fs, ANE, { action: 'plan-share', plan: PLAN, link: 'LinkAneIf1' }, D);
  await assert.rejects(TG.handle(fs, ZED, { action: 'plan-answer', id: r.id, yes: true }, D), e => e.code === 'not_found', 'not invited, cannot join');
  await assert.rejects(TG.handle(fs, ZED, { action: 'plan-leave', id: r.id }, D), e => e.code === 'not_found');
  await assert.rejects(TG.handle(fs, ANE, { action: 'plan-share', plan: { title: 'x'.repeat(10), big: 'y'.repeat(300000) }, link: 'LinkAneIf1' }, D), e => e.code === 'too_big');
});

test('saying no, sharing an already shared plan, and leaving', async () => {
  const fs = fakeFs(), D = deps(); linked(fs);
  const r = await TG.handle(fs, ANE, { action: 'plan-share', plan: PLAN, link: 'LinkAneIf1' }, D);
  await TG.handle(fs, IF, { action: 'plan-answer', id: r.id, yes: false }, D);
  assert.deepEqual(fs.data.get('together/' + r.id).invited, {}); assert.deepEqual(fs.data.get('together/' + r.id).members, ['ane@x.cz', 'sam@x.cz']);
  await TG.handle(fs, SAM, { action: 'plan-share', id: r.id, plan: PLAN, link: 'LinkAneIf1' }, D).then(() => assert.fail('Sam has no link'), e => assert.equal(e.code, 'not_linked'));
  const again = await TG.handle(fs, ANE, { action: 'plan-share', id: r.id, plan: PLAN, link: 'LinkAneIf1' }, D);
  assert.equal(again.id, r.id, 'asking again invites to the same plan');
  await TG.handle(fs, IF, { action: 'plan-answer', id: r.id, yes: true }, D);
  await TG.handle(fs, SAM, { action: 'plan-leave', id: r.id }, D);
  const T = fs.data.get('together/' + r.id);
  assert.deepEqual(T.members, ['jo@x.cz', 'quinn@x.cz'], 'leaving takes the whole household out');
  assert.equal(T.owner, 'jo@x.cz', 'the plan carries on with the others');
  const last = await TG.handle(fs, { email: 'quinn@x.cz' }, { action: 'plan-leave', id: r.id }, D);
  assert.ok(last.deleted); assert.equal(fs.data.get('together/' + r.id), undefined);
});
