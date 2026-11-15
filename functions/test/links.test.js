// Friends between households (10 Nov 2026): links between two people, free/busy, "Want to come?" asks.
const test = require('node:test'), assert = require('node:assert');
const LK = require('../links');

/* a pretend Firestore with array-contains queries */
function fakeFs() {
  const data = new Map();
  const snap = (id, v) => ({ id, exists: v !== undefined, data: () => (v === undefined ? undefined : JSON.parse(JSON.stringify(v))) });
  return { data,
    doc: p => ({ get: async () => snap(p.split('/').pop(), data.get(p)), set: async v => data.set(p, JSON.parse(JSON.stringify(v))), delete: async () => data.delete(p) }),
    collection: c => ({ where: (f, op, v) => ({ get: async () => ({ docs: [...data.keys()].filter(k => k.startsWith(c + '/') && (data.get(k)[f] || []).includes(v)).map(k => snap(k.split('/').pop(), data.get(k))) }) }) }) };
}
const NOW = Date.parse('2026-11-10T17:00:00Z'); /* 18:00 in Prague */
const HOUSES = { 'ane@x.cz': { hid: 'legacy' }, 'sam@x.cz': { hid: 'legacy' }, 'jo@x.cz': { hid: 'h2' } };
function deps(over = {}) {
  const sent = [];
  return { sent, now: () => NOW, resolve: async e => HOUSES[e] || null, invite: async e => sent.push(['invite', e]), notify: async (e, m) => sent.push([e, m.title]), eventsFor: async () => ({ own: [] }), ...over };
}
const ANE = { email: 'ane@x.cz', name: 'Alex', admin: true }, IF = { email: 'JO@x.cz', name: 'Jo' }, SAM = { email: 'sam@x.cz', name: 'Sam' };

test('a link is asked, answered and seen only by the two people in it', async () => {
  const fs = fakeFs(), D = deps();
  const r = await LK.handle(fs, ANE, { action: 'request', email: 'Jo@X.cz', prof: 'fr_jo', share: { busy: true } }, D);
  assert.equal(r.link.status, 'asked'); assert.deepEqual(r.link.share, { busy: true, titles: false, come: false });
  assert.deepEqual(D.sent[0], ['jo@x.cz', 'Alex wants to connect in Afloat']);
  const l1 = await LK.handle(fs, IF, { action: 'list' }, D);
  assert.equal(l1.links.length, 1); assert.equal(l1.links[0].mine, 'answering'); assert.equal(l1.links[0].peerName, 'Alex');
  assert.deepEqual(l1.links[0].theirs, { busy: false, titles: false, come: false }, 'nothing is shared before it is on');
  assert.equal((await LK.handle(fs, SAM, { action: 'list' }, D)).links.length, 0, 'the rest of the household sees nothing');
  await assert.rejects(LK.handle(fs, SAM, { action: 'share', id: r.link.id, share: { busy: true } }, D), e => e.code === 'not_found', 'nor can it touch it');
  await assert.rejects(LK.handle(fs, ANE, { action: 'answer', id: r.link.id, yes: true }, D), e => e.code === 'not_found', 'only the other person answers');
  const a = await LK.handle(fs, IF, { action: 'answer', id: r.link.id, yes: true, share: { come: true } }, D);
  assert.equal(a.link.status, 'on'); assert.deepEqual(a.link.theirs, { busy: true, titles: false, come: false });
  const again = await LK.handle(fs, ANE, { action: 'request', email: 'jo@x.cz' }, D);
  assert.equal(again.already, true, 'asking twice finds the same link');
  await LK.handle(fs, IF, { action: 'unlink', id: r.link.id }, D);
  assert.equal((await LK.handle(fs, ANE, { action: 'list' }, D)).links.length, 0, 'either side can unlink');
});

test('someone not in Afloat, someone in the same household, and inviting', async () => {
  const fs = fakeFs(), D = deps();
  assert.deepEqual(await LK.handle(fs, ANE, { action: 'request', email: 'new@x.cz' }, D), { notHere: true, canInvite: true });
  assert.deepEqual(await LK.handle(fs, SAM, { action: 'request', email: 'new@x.cz' }, D), { notHere: true, canInvite: false });
  await assert.rejects(LK.handle(fs, ANE, { action: 'request', email: 'sam@x.cz' }, D), e => e.code === 'same_house');
  await assert.rejects(LK.handle(fs, SAM, { action: 'invite', email: 'new@x.cz' }, D), e => e.code === 'not_owner');
  await LK.handle(fs, ANE, { action: 'invite', email: 'new@x.cz' }, D);
  assert.deepEqual(D.sent.pop(), ['invite', 'new@x.cz']);
});

test('free/busy needs their switch, and gives blocks within 08:00–23:00 only', async () => {
  const fs = fakeFs();
  const own = [
    { id: 'e1', summary: 'Climbing', start: { dateTime: '2026-11-12T16:00:00+01:00' }, end: { dateTime: '2026-11-12T18:00:00+01:00' } },
    { id: 'e2', summary: 'Sleepover', start: { dateTime: '2026-11-12T21:00:00+01:00' }, end: { dateTime: '2026-11-13T09:00:00+01:00' } },
    { id: 'e3', summary: 'Free time', transparency: 'transparent', start: { dateTime: '2026-11-14T10:00:00+01:00' }, end: { dateTime: '2026-11-14T12:00:00+01:00' } },
    { id: 'e4', summary: 'Said no', attendees: [{ self: true, responseStatus: 'declined' }], start: { dateTime: '2026-11-15T10:00:00+01:00' }, end: { dateTime: '2026-11-15T12:00:00+01:00' } },
    { id: 'e5', summary: 'Therapy', start: { dateTime: '2026-11-16T10:00:00+01:00' }, end: { dateTime: '2026-11-16T11:00:00+01:00' } },
    { id: 'e6', summary: 'Secret', visibility: 'private', start: { dateTime: '2026-11-16T12:00:00+01:00' }, end: { dateTime: '2026-11-16T13:00:00+01:00' } },
  ];
  const family = [
    { id: 'f1', summary: 'Dentist · Mia, Zoe', start: { dateTime: '2026-11-17T10:00:00+01:00' }, end: { dateTime: '2026-11-17T11:00:00+01:00' } },
    { id: 'f2', summary: 'Board games · Alex, Sam', start: { dateTime: '2026-11-17T19:00:00+01:00' }, end: { dateTime: '2026-11-17T22:00:00+01:00' } },
    { id: 'f3', summary: 'Picnic', start: { dateTime: '2026-11-18T10:00:00+01:00' }, end: { dateTime: '2026-11-18T12:00:00+01:00' } },
    { id: 'f4', summary: 'Coffee · Alex, Robin', start: { dateTime: '2026-11-19T10:00:00+01:00' }, end: { dateTime: '2026-11-19T11:00:00+01:00' } },
  ];
  const D = deps({ eventsFor: async (L, side) => { assert.equal(side, 'a'); return { own, family, afloat: { f3: { who: ['Alex'], kind: 'outing' } }, name: 'Alex', discreet: ['Robin'] }; } });
  const r = await LK.handle(fs, ANE, { action: 'request', email: 'jo@x.cz' }, D);
  await LK.handle(fs, IF, { action: 'answer', id: r.link.id, yes: true }, D);
  await assert.rejects(LK.handle(fs, IF, { action: 'busy', id: r.link.id }, D), e => e.code === 'not_shared', 'off until Alex shares');
  await LK.handle(fs, ANE, { action: 'share', id: r.link.id, share: { busy: true } }, D);
  const b = await LK.handle(fs, IF, { action: 'busy', id: r.link.id }, D);
  assert.equal(Object.keys(b.days).length, 31); assert.equal(b.today, '2026-11-10'); assert.equal(b.titles, false);
  assert.deepEqual(b.days['2026-11-12'], [{ s: 960, e: 1080 }, { s: 1260, e: 1380 }], 'clipped at 23:00, no titles');
  assert.deepEqual(b.days['2026-11-13'], [{ s: 480, e: 540 }], 'the morning after starts at 08:00');
  assert.deepEqual(b.days['2026-11-14'], [], 'transparent events are free'); assert.deepEqual(b.days['2026-11-15'], [], 'declined ones too');
  assert.deepEqual(b.days['2026-11-17'], [{ s: 1140, e: 1320 }], 'only family events she is on');
  assert.deepEqual(b.days['2026-11-18'], [{ s: 600, e: 720 }], 'Afloat’s own who-is-going counts');
  assert.ok(!JSON.stringify(b).includes('Climbing'), 'no titles anywhere');
  await LK.handle(fs, ANE, { action: 'share', id: r.link.id, share: { busy: true, titles: true } }, D);
  const t = await LK.handle(fs, IF, { action: 'busy', id: r.link.id }, D);
  assert.deepEqual(t.days['2026-11-12'][0], { s: 960, e: 1080, t: 'Climbing' });
  assert.deepEqual(t.days['2026-11-17'][0], { s: 1140, e: 1320, t: 'Board games' }, 'names after "·" are taken off');
  assert.deepEqual(t.days['2026-11-16'], [{ s: 600, e: 660 }, { s: 720, e: 780 }], 'health and private events stay untitled');
  assert.deepEqual(t.days['2026-11-19'], [{ s: 600, e: 660 }], 'events with a Discreet friend stay untitled');
});

test('Want to come?: needs their switch, answered by the other side, cleared by either', async () => {
  const fs = fakeFs(), D = deps();
  const r = await LK.handle(fs, ANE, { action: 'request', email: 'jo@x.cz', share: { come: true } }, D), id = r.link.id;
  await LK.handle(fs, IF, { action: 'answer', id, yes: true }, D);
  await assert.rejects(LK.handle(fs, ANE, { action: 'ask', id, title: 'Cinema', date: '2026-11-14' }, D), e => e.code === 'not_shared');
  await assert.rejects(LK.handle(fs, IF, { action: 'ask', id, title: 'Cinema', date: '2026-11-09' }, D), e => e.code === 'bad_date');
  const x = await LK.handle(fs, IF, { action: 'ask', id, title: ' Cinema ', date: '2026-11-14', start: '19:00', end: '21:30', place: 'Lucerna', note: 'The new one' }, D);
  const ask = x.link.asks[0]; assert.equal(ask.fromMe, true); assert.equal(ask.title, 'Cinema'); assert.equal(ask.status, 'open');
  assert.deepEqual(D.sent.pop(), ['ane@x.cz', 'Want to come? Cinema']);
  await assert.rejects(LK.handle(fs, IF, { action: 'reply', id, ask: ask.id, yes: true }, D), e => e.code === 'not_found', 'not your own ask');
  const y = await LK.handle(fs, ANE, { action: 'reply', id, ask: ask.id, yes: true }, D);
  assert.equal(y.link.asks[0].status, 'yes'); assert.equal(y.link.asks[0].fromMe, false);
  assert.deepEqual(D.sent.pop(), ['jo@x.cz', 'Alex: yes']);
  const z = await LK.handle(fs, IF, { action: 'done', id, ask: ask.id }, D);
  assert.equal(z.link.asks.length, 0);
});

test('Prague time helpers', () => {
  assert.deepEqual(LK.local(Date.parse('2026-11-10T23:30:00Z')), { date: '2026-11-11', min: 30 });
  assert.equal(new Date(LK.instant('2026-07-01', 8 * 60)).toISOString(), '2026-07-01T06:00:00.000Z', 'summer time');
  assert.equal(new Date(LK.instant('2026-12-01', 8 * 60)).toISOString(), '2026-12-01T07:00:00.000Z', 'winter time');
});
