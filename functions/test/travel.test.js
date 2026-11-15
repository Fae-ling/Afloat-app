// Travel services for Plans (11 Nov 2026): Golemio departures, Google Routes, AeroDataBox, with pretend answers.
const test = require('node:test'), assert = require('node:assert');
const TR = require('../travel');
const fake = (status, body, seen = []) => async (url, opts) => { seen.push([url, opts]); return { status, ok: status < 300, json: async () => body }; };

test('departures: the planned train found on the board, with its delay', async () => {
  const seen = [], body = { stops: [{ stop_name: 'Praha-Smíchov' }], departures: [
    { route: { short_name: 'S7' }, trip: { headsign: 'Beroun', is_canceled: false }, departure_timestamp: { scheduled: '2026-11-12T07:40:00+01:00', predicted: '2026-11-12T07:46:00+01:00' }, delay: { is_available: true, minutes: 6 }, stop: { platform_code: '3' } },
    { route: { short_name: 'S7' }, trip: { headsign: 'Beroun', is_canceled: true }, departure_timestamp: { scheduled: '2026-11-12T08:10:00+01:00', predicted: '2026-11-12T08:10:00+01:00' }, delay: { is_available: false } },
    { route: { short_name: '12' }, trip: { headsign: 'Sídliště Barrandov' }, departure_timestamp: { scheduled: '2026-11-12T07:41:00+01:00' }, delay: { is_available: true, minutes: 0 } }] };
  const r = await TR.handle({ action: 'departures', stop: 'Smíchov', date: '2026-11-12', time: '07:40', line: 's 7' }, { golemio: 'k'.repeat(20) }, fake(200, body, seen));
  assert.equal(r.stop, 'Praha-Smíchov'); assert.equal(r.list.length, 3);
  assert.deepEqual(r.match, { line: 'S7', to: 'Beroun', planned: '07:40', real: '07:46', late: 6, cancelled: false, platform: '3' });
  assert.match(seen[0][0], /names=Sm%C3%ADchov/); assert.match(seen[0][0], /timeFrom=2026-11-12T07%3A40%3A00/); assert.equal(seen[0][1].headers['X-Access-Token'], 'k'.repeat(20));
  const c = TR.match(r.list, '08:10', 'S7'); assert.ok(c.cancelled, 'a cancelled train is found too');
  assert.equal(TR.match(r.list, '09:00', 'S7'), null, 'nothing near the time: no match');
});

test('route: minutes with traffic, and the usual minutes', async () => {
  const seen = [];
  const r = await TR.handle({ action: 'route', from: 'Home, Praha', to: 'Letiště Václava Havla', mode: 'car' }, { maps: 'm'.repeat(30) }, fake(200, { routes: [{ duration: '2460s', staticDuration: '1800s', distanceMeters: 21400 }] }, seen));
  assert.deepEqual(r, { found: true, mins: 41, usual: 30, km: 21.4, mode: 'DRIVE' });
  const b = JSON.parse(seen[0][1].body); assert.equal(b.travelMode, 'DRIVE'); assert.equal(b.routingPreference, 'TRAFFIC_AWARE'); assert.equal(seen[0][1].headers['X-Goog-FieldMask'], 'routes.duration,routes.staticDuration,routes.distanceMeters');
  const t = await TR.route('m'.repeat(30), fake(200, { routes: [{ duration: '1500s' }] }, seen), { from: 'a', to: 'b', mode: 'train', arrive: new Date(Date.now() + 864e5).toISOString() });
  assert.equal(t.mins, 25); assert.ok(JSON.parse(seen[1][1].body).arrivalTime, 'public transport asks for the arrival time');
});

test('flight: status, revised time, terminal and gate; both answer shapes', async () => {
  const f = await TR.handle({ action: 'flight', number: 'ok 652', date: '2026-12-01' }, { flights: 'f'.repeat(30) }, fake(200, [{ number: 'OK 652', status: 'Delayed', airline: { name: 'Czech Airlines' },
    departure: { airport: { iata: 'PRG', shortName: 'Ruzyně', municipalityName: 'Prague' }, scheduledTime: { local: '2026-12-01 06:45+01:00' }, revisedTime: { local: '2026-12-01 07:20+01:00' }, terminal: '1', gate: 'B6', checkInDesk: '201-205' },
    arrival: { airport: { iata: 'LIS', name: 'Lisbon' }, scheduledTime: { local: '2026-12-01 09:10+00:00' } } }]));
  assert.equal(f.late, 35); assert.equal(f.dep.code, 'PRG'); assert.equal(f.dep.gate, 'B6'); assert.equal(f.arr.planned, '09:10'); assert.equal(f.dep.date, '2026-12-01'); assert.ok(!f.cancelled);
  const g = await TR.flight('k'.repeat(20), fake(200, [{ status: 'Canceled', departure: { airport: { iata: 'PRG' }, scheduledTimeLocal: '2026-12-01 06:45' }, arrival: {} }]), { number: 'FR1234', date: '2026-12-01' });
  assert.ok(g.cancelled); assert.equal(g.dep.planned, '06:45');
  assert.deepEqual(await TR.flight('k'.repeat(20), fake(404, null), { number: 'FR1', date: '2026-12-01' }), { found: false, number: 'FR1' });
  await assert.rejects(TR.flight('k'.repeat(20), fake(200, []), { number: 'hello', date: '2026-12-01' }), e => e.code === 'bad_input');
});

test('no key, a refused key, and a busy service', async () => {
  await assert.rejects(TR.handle({ action: 'flight', number: 'OK1', date: '2026-12-01' }, {}, fake(200, [])), e => e.code === 'no_key');
  await assert.rejects(TR.handle({ action: 'route', from: 'a', to: 'b' }, { maps: 'x'.repeat(20) }, fake(403, {})), e => e.code === 'bad_key');
  /* 12 Nov 2026 bug: AeroDataBox answers "no such flight" with 204 and an empty body; the key check (flight OK1 today) failed with "Unexpected end of JSON input" */
  const empty = status => async () => ({ status, ok: status < 300, json: async () => { throw new SyntaxError('Unexpected end of JSON input'); } });
  assert.deepEqual(await TR.flight('k'.repeat(20), empty(204), { number: 'OK1', date: '2026-12-01' }), { found: false, number: 'OK1' }, '204 with no body is "not found"');
  assert.equal(await TR.check('flights', 'k'.repeat(20), empty(204)), true, 'a good key passes the check even when the test flight does not exist');
  assert.equal(await TR.check('flights', 'k'.repeat(20), empty(200)), true, 'so does an empty 200');
  await assert.rejects(TR.check('flights', 'k'.repeat(20), fake(403, { message: 'You are not subscribed to this API.' })), e => e.code === 'bad_key' && /not subscribed/.test(e.message), 'RapidAPI’s own reason is passed on');
  await assert.rejects(TR.check('flights', 'k'.repeat(20), empty(401)), e => e.code === 'bad_key', 'a 401 with no body is still a bad key');
  await assert.rejects(TR.handle({ action: 'departures', stop: 'a' }, { golemio: 'x'.repeat(20) }, fake(429, {})), e => e.code === 'server_unavailable');
  await assert.rejects(TR.handle({ action: 'departures', stop: 'a' }, { golemio: 'x'.repeat(20) }, async () => { throw new Error('offline'); }), e => e.code === 'server_unavailable');
  assert.ok(TR.okKey('AIza' + 'x'.repeat(30))); assert.ok(!TR.okKey('short')); assert.ok(!TR.okKey('has spaces in it here ok'));
});
