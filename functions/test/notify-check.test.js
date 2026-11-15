// Before a phone notification goes out, the server asks Google whether its event is still on, and still at that time.
const test = require('node:test'), assert = require('node:assert');
const gcal = require('../gcal');

test('notify check: a deleted or cancelled event is gone', () => {
  assert.equal(gcal.checkEvent(null, '2026-11-06T10:00').state, 'gone');
  assert.equal(gcal.checkEvent({ id: 'a', status: 'cancelled' }, '2026-11-06T10:00').state, 'gone');
});

test('notify check: the same start (Prague time, winter and summer) means nothing changed', () => {
  assert.equal(gcal.checkEvent({ status: 'confirmed', start: { dateTime: '2026-11-06T10:00:00+01:00' } }, '2026-11-06T10:00').state, 'same');
  assert.equal(gcal.checkEvent({ status: 'confirmed', start: { dateTime: '2026-07-06T10:00:00+02:00' } }, '2026-07-06T10:00').state, 'same');
  /* Google may answer in UTC; it is still 10:00 in Prague */
  assert.equal(gcal.checkEvent({ status: 'confirmed', start: { dateTime: '2026-11-06T09:00:00Z' } }, '2026-11-06T10:00').state, 'same');
});

test('notify check: a moved event says where it is now and by how much', () => {
  const r = gcal.checkEvent({ status: 'confirmed', start: { dateTime: '2026-11-06T11:30:00+01:00' } }, '2026-11-06T10:00');
  assert.deepEqual([r.state, r.s, r.deltaMs], ['moved', '2026-11-06T11:30', 90 * 60e3]);
  const earlier = gcal.checkEvent({ status: 'confirmed', start: { dateTime: '2026-11-06T09:00:00+01:00' } }, '2026-11-06T10:00');
  assert.equal(earlier.deltaMs, -60 * 60e3);
});

test('notify check: all-day events and items without a start are left alone', () => {
  assert.equal(gcal.checkEvent({ status: 'confirmed', start: { date: '2026-11-06' } }, '2026-11-06T10:00').state, 'same');
  assert.equal(gcal.checkEvent({ status: 'confirmed', start: { dateTime: '2026-11-06T10:00:00+01:00' } }, '').state, 'same');
});
