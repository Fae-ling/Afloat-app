// The server answers in the same shapes the app reads from claude.ai's connectors.
const test = require('node:test'), assert = require('node:assert');
const trello = require('../trello'), gcal = require('../gcal'), claude = require('../claude');

/* a pretend Trello REST API */
function fakeTrello() {
  const log = [];
  const B = { b1: { id: 'b1', name: 'Domácnost', url: 'https://trello.com/b/x', idOrganization: 'w1', closed: false, lists: [{ id: 'l1', name: 'Nákupy' }, { id: 'l2', name: 'To-do' }] } };
  const cards = [{ id: 'c1', name: 'Milk', desc: '', url: 'https://trello.com/c/1', due: null, dueComplete: false, closed: false, idList: 'l1', idBoard: 'b1', idMembers: ['m2'], labels: [{ id: 'lab1', name: '', color: 'red' }] }];
  const f = async (url, init = {}) => {
    const u = new URL(url), p = u.pathname.replace('/1', ''), m = init.method || 'GET', body = init.body ? Object.fromEntries(new URLSearchParams(init.body)) : {};
    log.push([m, p, Object.fromEntries(u.searchParams), body]);
    const ok = x => ({ ok: true, status: 200, text: async () => JSON.stringify(x) });
    if (p === '/members/me') return ok({ id: 'm1', username: 'alex', fullName: 'Alex', prefs: { timezoneInfo: { timezoneCurrent: 'Europe/Prague' } } });
    if (p === '/members/me/boards') return ok([{ ...B.b1, organization: { displayName: 'Happy mind palace' } }]);
    if (p === '/boards/b1') return ok(B.b1);
    if (p === '/boards/b1/members') return ok([{ id: 'm1', fullName: 'Alex', username: 'alex' }, { id: 'm2', fullName: 'Sam', username: 'sam' }]);
    if (p === '/boards/b1/memberships') return ok([{ memberType: 'admin', member: { id: 'm1', fullName: 'Alex', username: 'alex' } }, { memberType: 'normal', member: { id: 'm2', fullName: 'Sam', username: 'sam' } }]);
    if (p === '/boards/b1/labels') return ok([{ id: 'lab1', name: '', color: 'red' }]);
    if (p === '/boards/b1/cards/open') return ok(cards);
    if (p === '/cards' && m === 'POST') return ok({ id: 'c9', name: body.name, url: 'https://trello.com/c/9', idBoard: 'b1' });
    if (p === '/cards/c1' && m === 'PUT') return ok({ ...cards[0], ...body, idBoard: 'b1' });
    if (p === '/cards/c1/idLabels') return ok([]);
    if (p === '/checklists/k1') return ok({ id: 'k1', idCard: 'c1', idBoard: 'b1' });
    if (p === '/cards/c1/checkItem/i1') return ok({ id: 'i1', name: 'Step', state: body.state });
    if (p === '/unauth') return { ok: false, status: 401, text: async () => 'invalid token' };
    return { ok: false, status: 404, text: async () => 'not found ' + p };
  };
  return { f, log };
}

test('Trello: boards, lists, labels and members keep claude.ai’s ids', async () => {
  const { f } = fakeTrello(), call = trello.client('K', 'T', f);
  const bl = await trello.run(call, 'trelloReadBoard', { action: 'list', limit: 100 });
  assert.equal(bl.boards[0].id, 'ari:cloud:trello::board/workspace/w1/b1');
  assert.equal(bl.boards[0].workspace.displayName, 'Happy mind palace');
  const g = await trello.run(call, 'trelloReadBoard', { action: 'get', boardId: bl.boards[0].id });
  assert.deepEqual(g.lists.map(l => l.id), ['ari:cloud:trello::list/workspace/w1/l1', 'ari:cloud:trello::list/workspace/w1/l2']);
  const lab = await trello.run(call, 'trelloReadBoard', { action: 'list_labels', boardId: bl.boards[0].id });
  assert.deepEqual(lab.labels[0], { id: 'ari:cloud:trello::label/workspace/w1/lab1', name: '', color: 'red' });
  const mem = await trello.run(call, 'trelloReadMember', { action: 'list_by_board', boardId: bl.boards[0].id });
  assert.deepEqual(mem.members.map(m => [m.id, m.fullName, m.role]), [['ari:cloud:trello::user/m1', 'Alex', 'admin'], ['ari:cloud:trello::user/m2', 'Sam', 'member']]);
  const me = await trello.run(call, 'trelloReadMember', { action: 'get_me' });
  assert.equal(me.id, 'ari:cloud:trello::user/m1'); assert.equal(me.prefs.timezone, 'Europe/Prague');
});

test('Trello: cards come grouped like the connector, with list, board, labels and members', async () => {
  const { f } = fakeTrello(), call = trello.client('K', 'T', f);
  const r = await trello.run(call, 'trelloReadCard', { action: 'list_by_board', boardIdOrUrl: 'ari:cloud:trello::board/workspace/w1/b1', limit: 50 });
  const c = r.cards.nodes[0];
  assert.equal(c.id, 'ari:cloud:trello::card/workspace/w1/c1');
  assert.deepEqual(c.list, { id: 'ari:cloud:trello::list/workspace/w1/l1', name: 'Nákupy' });
  assert.equal(c.board.name, 'Domácnost'); assert.equal(c.labels[0].color, 'red'); assert.equal(c.members[0].fullName, 'Sam');
  assert.equal(r.cards.pageInfo.hasNextPage, false);
});

test('Trello: writes go to the right REST calls with Trello’s own ids', async () => {
  const { f, log } = fakeTrello(), call = trello.client('K', 'T', f);
  const cr = await trello.run(call, 'trelloWriteCard', { action: 'create', listId: 'ari:cloud:trello::list/workspace/w1/l2', name: 'Call the bank', due: '2026-11-05T08:00:00.000Z' });
  assert.equal(cr.id, 'ari:cloud:trello::card/workspace/w1/c9');
  assert.deepEqual(log.find(x => x[1] === '/cards')[3], { idList: 'l2', name: 'Call the bank', due: '2026-11-05T08:00:00.000Z' });
  await trello.run(call, 'trelloWriteCard', { action: 'mark_done', cardId: 'ari:cloud:trello::card/workspace/w1/c1' });
  const put = () => log.filter(x => x[0] === 'PUT').pop()[3];
  assert.equal(put().dueComplete, 'true');
  await trello.run(call, 'trelloWriteCard', { action: 'move', cardId: 'ari:cloud:trello::card/workspace/w1/c1', listId: 'ari:cloud:trello::list/workspace/w1/l2' });
  assert.equal(put().idList, 'l2');
  await trello.run(call, 'trelloWriteCard', { action: 'attach_label', cardId: 'x/c1', labelId: 'ari:cloud:trello::label/workspace/w1/lab1' });
  assert.equal(log.filter(x => x[1] === '/cards/c1/idLabels').pop()[3].value, 'lab1');
  const it = await trello.run(call, 'trelloWriteChecklist', { action: 'update_item', checklistId: 'ari:cloud:trello::checklist/workspace/w1/k1', itemId: 'ari:cloud:trello::check-item/workspace/w1/i1', checked: true });
  assert.equal(it.state, 'complete'); assert.equal(it.id, 'ari:cloud:trello::check-item/workspace/w1/i1');
});

test('Trello: an expired token says “needs reconnecting”', async () => {
  const { f } = fakeTrello(), call = trello.client('K', 'T', f);
  await assert.rejects(() => call('GET', '/unauth'), e => e.code === 'needs_reauth');
});

test('Google: Prague times get the right offset in winter and summer', () => {
  assert.equal(gcal.withOffset('2026-11-04T10:00:00'), '2026-11-04T10:00:00+01:00');
  assert.equal(gcal.withOffset('2026-07-04T10:00:00'), '2026-07-04T10:00:00+02:00');
  assert.equal(gcal.withOffset('2026-11-04T10:00:00Z'), '2026-11-04T10:00:00Z');
});

test('Google: create and update events from the connector’s arguments', async () => {
  const log = [];
  const f = async (url, init) => { log.push([init.method, url, init.body ? JSON.parse(init.body) : null]);
    if (init.method === 'GET') return { ok: true, status: 200, text: async () => JSON.stringify({ id: 'e1', start: { dateTime: '2026-11-13T18:00:00+01:00' }, end: { dateTime: '2026-11-13T19:00:00+01:00' }, attendees: [{ email: 'a@x.cz', self: true }, { email: 'old@x.cz' }] }) };
    return { ok: true, status: 200, text: async () => JSON.stringify({ id: 'e1', transparency: 'transparent', updated: 'u' }) }; };
  const call = gcal.client('AT', f);
  const r = await gcal.run(call, 'create_event', { calendarId: 'fam@group.calendar.google.com', summary: 'Writing retreat', startTime: '2026-11-13T18:00:00', endTime: '2026-11-15T14:00:00', location: 'Chata', overrideReminders: [{ method: 'popup', minutes: 30 }], availability: 'AVAILABILITY_FREE', visibility: 'private', recurrenceData: ['RRULE:FREQ=WEEKLY;BYDAY=FR'], addGoogleMeetUrl: true, attendees: [{ email: 'ed@x.cz' }], guestPermissions: { guestsCanModify: true, guestsCanSeeGuests: false }, notificationLevel: 'ALL' });
  const [m, url, body] = log[0];
  assert.equal(m, 'POST'); assert.match(url, /calendars\/fam%40group\.calendar\.google\.com\/events\?sendUpdates=all&conferenceDataVersion=1/);
  assert.deepEqual(body.start, { dateTime: '2026-11-13T18:00:00+01:00', timeZone: 'Europe/Prague' });
  assert.deepEqual(body.end, { dateTime: '2026-11-15T14:00:00+01:00', timeZone: 'Europe/Prague' });
  assert.equal(body.transparency, 'transparent'); assert.deepEqual(body.recurrence, ['RRULE:FREQ=WEEKLY;BYDAY=FR']);
  assert.equal(body.guestsCanModify, true); assert.equal(body.guestsCanSeeOtherGuests, false);
  assert.ok(body.conferenceData.createRequest.requestId);
  assert.equal(r.availability, 'AVAILABILITY_FREE');
  const all = await gcal.run(call, 'create_event', { summary: 'Trip', startTime: '2026-11-20T00:00:00', endTime: '2026-11-23T00:00:00', allDay: true });
  assert.deepEqual(log[1][2].start, { date: '2026-11-20' }); assert.deepEqual(log[1][2].end, { date: '2026-11-23' }); assert.ok(all);
  log.length = 0;
  await gcal.run(call, 'update_event', { eventId: 'e1', addedAttendees: [{ email: 'new@x.cz' }], removedAttendeeEmails: ['old@x.cz'], notificationLevel: 'ALL' });
  const patch = log.find(x => x[0] === 'PATCH')[2];
  assert.deepEqual(patch.attendees.map(a => a.email), ['a@x.cz', 'new@x.cz']);
});

test('Claude: JSON answers are parsed, images go with the last message', async () => {
  let sent;
  const f = async (url, init) => { sent = JSON.parse(init.body); return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: '```json\n[{"a":1}]\n```' }], stop_reason: 'end_turn', model: 'm' }) }; };
  const r = await claude.ask('KEY', { input: 'Sort these', json: true, modelTier: 'quick', images: [{ type: 'image/png', data: 'AAAA' }] }, f);
  assert.deepEqual(r.value, [{ a: 1 }]); assert.equal(sent.model, 'claude-haiku-5-5');
  assert.equal(sent.messages[0].content[0].type, 'image'); assert.equal(sent.messages[0].content[1].text, 'Sort these');
  await assert.rejects(() => claude.ask('', { input: 'x' }, f), e => e.code === 'not_granted');
});

test('Claude: each answer’s cost in dollars, by model', () => {
  assert.equal(claude.costOf('claude-haiku-5-5', { input_tokens: 100000, output_tokens: 100000 }).toFixed(2), '0.06');
  assert.equal(claude.costOf('claude-sonnet-5-5-20261001', { input_tokens: 10000, output_tokens: 1000 }).toFixed(3), '0.030');
  assert.equal(claude.costOf('claude-haiku-5-5', { input_tokens: 200000, output_tokens: 0 }).toFixed(2), '0.10');
  assert.ok(claude.costOf('claude-haiku-5-5', { input_tokens: 1000, cache_read_input_tokens: 9000 }) < claude.costOf('claude-haiku-5-5', { input_tokens: 10000 }));
});
