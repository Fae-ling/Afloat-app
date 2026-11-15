// Afloat's server: does for the installed app what claude.ai did for the artifact.
// Each person signs in with Google, connects their own Trello and Google Calendar once,
// and every call runs with that person's own accounts. Tokens never reach the phone.
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret, defineString } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const trello = require('./trello');
const gcal = require('./gcal');
const claude = require('./claude');
const HH = require('./households');

initializeApp();
const fs = getFirestore();

const OWNER_EMAIL = defineString('OWNER_EMAIL');
const TRELLO_KEY = defineString('TRELLO_KEY');
const GOOGLE_CLIENT_ID = defineString('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = defineSecret('GOOGLE_CLIENT_SECRET');
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');
/* invoker 'public' lets the app reach the functions at all (Cloud Run's door); who() below still lets in only the household */
const opts = { region: 'europe-west1', cors: true, invoker: 'public' };

/* the sign-in door: anyone in a household, plus addresses invited to start one (functions/households.js) */
const allowed = email => HH.allowed(fs, email, OWNER_EMAIL.value());
/* someone who isn't in a household tried to get in: kept (server-only) so the admin can see it in Connections */
async function turnedAway(email, how) {
  try { await fs.collection('access/log/away').add({ email: String(email || '(no email)').toLowerCase().slice(0, 200), how, at: Date.now() }); } catch (e) { console.warn('log', e); }
}
/* who is calling and which household they're in: { uid, email, owner, admin, house: { hid, base, legacy, owner, name } }.
   noHouse: an invited address with no household yet may call (connections, createHousehold) and gets house: null. */
async function who(req, noHouse) {
  const t = req.auth && req.auth.token;
  if (!t || !t.email) throw new HttpsError('unauthenticated', 'Sign in first.', { code: 'not_signed_in' });
  const email = String(t.email).toLowerCase(), admin = email === String(OWNER_EMAIL.value()).toLowerCase();
  if (t.email_verified === false) throw new HttpsError('permission-denied', 'This Google address isn’t verified.', { code: 'not_member' });
  const house = await HH.resolve(fs, email, OWNER_EMAIL.value());
  if (!house) {
    if (noHouse && (await HH.invited(fs, email))) return { uid: req.auth.uid, email, owner: false, admin, house: null, invited: true };
    await turnedAway(email, 'app'); throw new HttpsError('permission-denied', 'Not in a household.', { code: 'not_member' });
  }
  return { uid: req.auth.uid, email, owner: house.owner, admin, house };
}
/* a path inside the caller's household, e.g. at(u, 'apps/afloat/usage/2026-11') */
const at = (u, p) => fs.doc(u.house.base + p);
const priv = uid => fs.doc(`private/${uid}`);
const fail = e => {
  if (e instanceof HttpsError) throw e;
  const code = e.code || 'upstream_error';
  const http = code === 'needs_reauth' || code === 'server_not_connected' ? 'failed-precondition' : code === 'server_unavailable' ? 'unavailable' : code === 'not_in_manifest' ? 'invalid-argument' : 'aborted';
  throw new HttpsError(http, e.message || 'Something went wrong.', { code, retryable: !!e.retryable, retryAfterMs: e.retryAfterMs || null });
};

async function googleAccess(uid) {
  const p = (await priv(uid).get()).data() || {}, g = p.google;
  if (!g || !g.refresh) throw new trello.ToolError('server_not_connected', 'Google Calendar isn’t connected yet.');
  if (g.access && g.exp > Date.now() + 60e3) return g.access;
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: GOOGLE_CLIENT_ID.value(), client_secret: GOOGLE_CLIENT_SECRET.value(), refresh_token: g.refresh, grant_type: 'refresh_token' }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { if (j.error === 'invalid_grant') { await priv(uid).set({ google: { ...g, broken: true } }, { merge: true }); throw new trello.ToolError('needs_reauth', 'Google Calendar needs reconnecting.'); } throw new trello.ToolError('server_unavailable', 'Google didn’t answer.', { retryable: true }); }
  await priv(uid).set({ google: { ...g, access: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000, broken: false } }, { merge: true });
  return j.access_token;
}

/* the same calls the app made to claude.ai connectors: {server, tool, args} → {payload} */
exports.tool = onCall({ ...opts, secrets: [GOOGLE_CLIENT_SECRET], timeoutSeconds: 120 }, async req => {
  const u = await who(req), { server, tool, args = {} } = req.data || {};
  try {
    if (server === 'Trello') {
      const p = (await priv(u.uid).get()).data() || {};
      if (!p.trello || !p.trello.token) throw new trello.ToolError('server_not_connected', 'Trello isn’t connected yet.');
      return { payload: await trello.run(trello.client(TRELLO_KEY.value(), p.trello.token), tool, args) };
    }
    if (server === 'Google Calendar') {
      try { return { payload: await gcal.run(gcal.client(await googleAccess(u.uid)), tool, args) }; }
      catch (e) {
        /* a shared calendar this Google account can't see answers "Not Found": say which account, so it can be shared with it */
        if (e.code === 'tool_error' && /not found/i.test(e.message || '') && args.calendarId && args.calendarId !== 'primary' && !args.eventId) {
          const g = ((await priv(u.uid).get()).data() || {}).google || {};
          throw new trello.ToolError('calendar_not_shared', `The Google account ${g.email || 'you connected'} can’t see this calendar.`, { email: g.email || '' });
        }
        throw e;
      }
    }
    throw new trello.ToolError('not_in_manifest', `Afloat doesn’t use ${server}.`);
  } catch (e) { fail(e); }
});

/* Claude, for sorting the brain dump and reading recipes. Every answer's cost is added to this month's total
   (apps/afloat/usage/<yyyy-mm>, shown in Settings); past the household's monthly cap (apps/afloat/usage/cap, $3 unless
   changed) Claude pauses until the 1st and every feature falls back to its built-in version. */
const DEFAULT_CAP = 3;
const monthKey = (t = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit' }).format(t).slice(0, 7);
exports.sample = onCall({ ...opts, secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 300, memory: '512MiB' }, async req => {
  const u = await who(req), d = req.data || {}, mk = monthKey(), ref = at(u, `apps/afloat/usage/${mk}`);
  try {
    /* each household's own key: the first household uses the server's, everyone else the key they pasted in Connections */
    const key = await HH.claudeKey(fs, u.house, ANTHROPIC_API_KEY.value());
    if (!key) throw new trello.ToolError('no_key', 'Claude isn’t set up for your household yet: paste your own Claude API key in Settings → Connections.');
    const [m, c] = await Promise.all([ref.get(), at(u, 'apps/afloat/usage/cap').get()]);
    const cap = c.exists && +c.data().usd > 0 ? +c.data().usd : DEFAULT_CAP, spent = (m.exists && +m.data().usd) || 0;
    if (spent >= cap && !d.test) throw new trello.ToolError('over_cap', `This month’s Claude budget ($${cap}) is used up. Claude is back on the 1st; built-in ideas until then.`);
    /* the Connections "Test" button may run past the cap, so it is always the same tiny, cheapest call, whatever was sent */
    const out = await claude.ask(key, d.test ? { input: 'Reply with only the word: ok', modelTier: 'quick', maxTokens: 16, feature: 'test' } : d);
    const feat = String(d.feature || 'other').replace(/[^a-z-]/g, '').slice(0, 24) || 'other', who = u.email.split('@')[0].replace(/[^a-z0-9]/gi, '').slice(0, 24) || 'someone';
    await ref.set({ usd: FieldValue.increment(out.usd || 0), calls: FieldValue.increment(1), feature: { [feat]: FieldValue.increment(out.usd || 0) }, by: { [who]: FieldValue.increment(1) }, at: Date.now() }, { merge: true }).catch(e => console.warn('usage', e));
    return out;
  } catch (e) { fail(e); }
});

/* connections: what's connected, connect Trello, connect Google, disconnect */
exports.connections = onCall(opts, async req => {
  const u = await who(req, true), p = (await priv(u.uid).get()).data() || {}, cfg = { trelloKey: TRELLO_KEY.value(), googleClientId: GOOGLE_CLIENT_ID.value() };
  /* invited, no household yet: the app shows "Start your household" */
  if (!u.house) return { email: u.email, invited: true, house: null, config: cfg };
  let away = [], inv = [];
  if (u.admin) {
    try { away = (await fs.collection('access/log/away').orderBy('at', 'desc').limit(10).get()).docs.map(d => d.data()); } catch (e) { console.warn(e); }
    try { inv = await HH.invites(fs); } catch (e) { console.warn(e); }
  }
  const k = u.house.legacy ? null : await fs.doc(`hkeys/${u.house.hid}`).get(), tk = await tkeys(u);
  return { email: u.email, owner: u.owner, admin: u.admin, away, invites: inv, gate: process.env.SIGNIN_GATE === 'on', members: await HH.members(fs, u.house, OWNER_EMAIL.value()),
    house: { hid: u.house.hid, base: u.house.base, legacy: u.house.legacy, name: u.house.name },
    claude: u.house.legacy ? { own: false, set: true } : { own: true, set: !!(k && k.exists && k.data().key), hint: k && k.exists ? k.data().hint || '' : '' },
    trello: p.trello ? { connected: true, name: p.trello.name, username: p.trello.username } : { connected: false },
    google: p.google && p.google.refresh ? { connected: !p.google.broken, email: p.google.email, broken: !!p.google.broken } : { connected: false },
    travel: Object.fromEntries(Object.keys(TR.KEYS).map(x => [x, { set: !!tk[x], hint: tk[x + 'Hint'] || '' }])),
    config: cfg };
});
/* an invited address starts its own household */
exports.createHousehold = onCall(opts, async req => {
  const u = await who(req, true);
  try { const h = await HH.create(fs, u.email, (req.data || {}).name, OWNER_EMAIL.value()); return { house: { hid: h.hid, base: h.base, legacy: false, name: h.name } }; }
  catch (e) { throw new HttpsError('failed-precondition', e.message, { code: e.code || 'tool_error' }); }
});
/* the admin invites a friend's household (an address that may then start one), or takes the invitation back */
exports.invite = onCall(opts, async req => {
  const u = await who(req), { email, remove } = req.data || {};
  if (!u.admin) throw new HttpsError('permission-denied', 'Only the admin can invite households.', { code: 'not_owner' });
  try { if (remove) await HH.uninvite(fs, email); else await HH.invite(fs, email, OWNER_EMAIL.value()); return { invites: await HH.invites(fs) }; }
  catch (e) { throw new HttpsError('invalid-argument', e.message, { code: e.code || 'tool_error' }); }
});
/* a household's own Claude key (not for the first household, which uses the server's): checked with one tiny call, then
   kept server-only in hkeys/<hid>. The phones only ever see its last four characters. */
exports.setClaudeKey = onCall({ ...opts, timeoutSeconds: 60 }, async req => {
  const u = await who(req), key = String((req.data || {}).key || '').trim();
  if (u.house.legacy) throw new HttpsError('failed-precondition', 'This household uses the server’s key.', { code: 'tool_error' });
  if (!u.owner) throw new HttpsError('permission-denied', 'Only the household’s owner can set the Claude key.', { code: 'not_owner' });
  if (!key) { await fs.doc(`hkeys/${u.house.hid}`).delete(); return { set: false }; }
  if (!HH.okKey(key)) throw new HttpsError('invalid-argument', 'That doesn’t look like a Claude API key (it starts with sk-ant-).', { code: 'tool_error' });
  try { await claude.ask(key, { input: 'Reply with only the word: ok', modelTier: 'quick', maxTokens: 16, feature: 'test' }); }
  catch (e) { throw new HttpsError('failed-precondition', 'Anthropic didn’t accept that key: ' + (e.message || 'no answer'), { code: 'tool_error' }); }
  await fs.doc(`hkeys/${u.house.hid}`).set({ key, hint: key.slice(-4), by: u.email, at: Date.now() });
  return { set: true, hint: key.slice(-4) };
});
/* Travel services for Plans (functions/travel.js): each household's own keys for Prague public transport, Google Routes and
   flight status, kept server-only in tkeys/<hid> and checked with one small call first. The owner sets them in Connections. */
const TR = require('./travel');
const tkeys = async u => { const k = await fs.doc(`tkeys/${u.house.hid}`).get(); return (k.exists && k.data()) || {}; };
exports.setTravelKey = onCall({ ...opts, timeoutSeconds: 60 }, async req => {
  const u = await who(req), kind = String((req.data || {}).kind || ''), key = String((req.data || {}).key || '').trim();
  if (!u.owner) throw new HttpsError('permission-denied', 'Only the household’s owner can set travel keys.', { code: 'not_owner' });
  if (!TR.KEYS[kind]) throw new HttpsError('invalid-argument', 'Afloat doesn’t know that service.', { code: 'tool_error' });
  const ref = fs.doc(`tkeys/${u.house.hid}`);
  if (!key) { await ref.set({ [kind]: FieldValue.delete(), [kind + 'Hint']: FieldValue.delete() }, { merge: true }); return { set: false }; }
  if (!TR.okKey(key)) throw new HttpsError('invalid-argument', 'That doesn’t look like a key.', { code: 'tool_error' });
  try { await TR.check(kind, key, fetch); }
  catch (e) { throw new HttpsError('failed-precondition', `${TR.KEYS[kind]} didn’t accept that key: ${e.message || 'no answer'}`, { code: 'tool_error' }); }
  await ref.set({ [kind]: key, [kind + 'Hint']: key.slice(-4), by: u.email, at: Date.now() }, { merge: true });
  return { set: true, hint: key.slice(-4) };
});
exports.travel = onCall({ ...opts, timeoutSeconds: 30 }, async req => {
  const u = await who(req);
  try { return await TR.handle(req.data || {}, await tkeys(u), fetch); }
  catch (e) { throw new HttpsError(e.code === 'no_key' ? 'failed-precondition' : 'unavailable', e.message || 'Something went wrong.', { code: e.code || 'tool_error', retryable: e.code === 'server_unavailable' }); }
});
exports.connectTrello = onCall(opts, async req => {
  const u = await who(req), token = String((req.data || {}).token || '');
  if (!/^[A-Za-z0-9]{32,128}$/.test(token)) throw new HttpsError('invalid-argument', 'That isn’t a Trello token.', { code: 'tool_error' });
  try {
    const me = await trello.client(TRELLO_KEY.value(), token)('GET', '/members/me', { fields: 'username,fullName' });
    await priv(u.uid).set({ trello: { token, name: me.fullName || me.username, username: me.username, at: Date.now() } }, { merge: true });
    return { connected: true, name: me.fullName || me.username };
  } catch (e) { fail(e); }
});
exports.connectGoogle = onCall({ ...opts, secrets: [GOOGLE_CLIENT_SECRET] }, async req => {
  const u = await who(req), { code, redirectUri } = req.data || {};
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: GOOGLE_CLIENT_ID.value(), client_secret: GOOGLE_CLIENT_SECRET.value(), redirect_uri: redirectUri || 'postmessage', grant_type: 'authorization_code' }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.refresh_token) throw new HttpsError('failed-precondition', j.error_description || 'Google didn’t give Afloat lasting access. Try again and tick the calendar box.', { code: 'tool_error' });
  let email = '';
  try { email = JSON.parse(Buffer.from(String(j.id_token).split('.')[1], 'base64url').toString()).email || ''; } catch {}
  await priv(u.uid).set({ google: { refresh: j.refresh_token, access: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000, email, at: Date.now(), broken: false } }, { merge: true });
  return { connected: true, email };
});
exports.disconnect = onCall(opts, async req => {
  const u = await who(req), what = (req.data || {}).what;
  if (!['trello', 'google'].includes(what)) throw new HttpsError('invalid-argument', 'Disconnect what?');
  await priv(u.uid).set({ [what]: FieldValue.delete() }, { merge: true });
  return { ok: true };
});
/* a household's owner adds or removes its members by email */
exports.setMembers = onCall(opts, async req => {
  const u = await who(req);
  try { return { emails: await HH.setMembers(fs, u.house, (req.data || {}).emails, OWNER_EMAIL.value()) }; }
  catch (e) { throw new HttpsError(e.code === 'not_owner' ? 'permission-denied' : 'failed-precondition', e.message, { code: e.code || 'tool_error' }); }
});

/* Friends between households (functions/links.js): links between two people, free/busy and "Want to come?" asks.
   Only the two people in a link ever get an answer about it. */
const LK = require('./links'), TG = require('./together');
async function uidOf(email) { try { return (await require('firebase-admin/auth').getAuth().getUserByEmail(email)).uid; } catch { return null; } }
/* a short note to someone's phones; nothing at night (the card waits on Today instead) */
async function pushTo(email, msg) {
  try {
    const h = LK.local(Date.now()).min; if (h < 4 * 60 || h >= 23 * 60) return;
    const uid = await uidOf(email); if (!uid) return;
    const toks = Object.values(((await priv(uid).get()).data() || {}).push || {}).filter(x => x && x.token).map(x => x.token);
    if (toks.length) await getMessaging().sendEachForMulticast({ tokens: toks, webpush: { headers: { Urgency: 'normal', TTL: '3600' }, data: { title: String(msg.title || '').slice(0, 120), body: String(msg.body || '').slice(0, 300), tag: 'link-' + Date.now(), link: '/#today' } } });
  } catch (e) { console.warn('link push', e); }
}
/* a linked person's events for free/busy: their own Google calendar, plus their household's family calendar (only events
   they are on). Read with THEIR Google connection, used only for this answer, never stored. */
async function linkEvents(L, side) {
  return async (from, to) => {
    const email = HH.norm(L.pair[side === 'a' ? 0 : 1]), name = (L.names || {})[side] || '';
    const uid = await uidOf(email); if (!uid) throw new trello.ToolError('peer_not_connected', 'Their calendar isn’t connected to Afloat.');
    let g;
    try { g = gcal.client(await googleAccess(uid)); } catch { throw new trello.ToolError('peer_not_connected', 'Their Google Calendar isn’t connected to Afloat right now.'); }
    const list = async calId => { const out = []; let tok;
      do { const r = await g('GET', `/calendars/${encodeURIComponent(calId)}/events`, { timeMin: new Date(from).toISOString(), timeMax: new Date(to).toISOString(), singleEvents: true, maxResults: 250, pageToken: tok });
        out.push(...(r.items || [])); tok = r.nextPageToken; } while (tok && out.length < 1500);
      return out; };
    const house = await HH.resolve(fs, email, OWNER_EMAIL.value()), base = house ? house.base : null;
    let family = [], afloat = {}, discreet = [];
    if (base !== null) {
      const app = p => fs.doc(`${base}apps/afloat/${p}`);
      const [c, pr] = await Promise.all([app('home/calendar').get(), app('home/profiles').get()]);
      const calId = c.exists && (c.data() || {}).calId;
      discreet = (((pr.exists && pr.data()) || {}).friends || []).filter(f => f && f.out === 'discreet').map(f => f.name);
      if (calId && name) {
        try { family = await list(calId); } catch (e) { console.warn('link family cal', e.message); }
        const evs = await fs.collection(`${base}apps/afloat/events`).where('endDate', '>=', LK.local(from).date).get();
        for (const d of evs.docs) { const v = d.data() || {}; if (v.gId) afloat[v.gId] = { who: v.who || [], kind: v.kind || '' }; }
      }
    }
    return { own: await list('primary'), family, afloat, name, discreet };
  };
}
exports.links = onCall({ ...opts, secrets: [GOOGLE_CLIENT_SECRET], timeoutSeconds: 60 }, async req => {
  const u = await who(req), d = req.data || {};
  try {
    /* planning together (functions/together.js) rides on the same function: only people connected here can be invited */
    if (/^plan-/.test(String(d.action || ''))) return await TG.handle(fs, { email: u.email, name: d.me }, d, {
      resolve: e => HH.resolve(fs, e, OWNER_EMAIL.value()), members: h => HH.members(fs, h, OWNER_EMAIL.value()), notify: pushTo });
    return await LK.handle(fs, { email: u.email, name: d.me, admin: u.admin }, d, {
      resolve: e => HH.resolve(fs, e, OWNER_EMAIL.value()),
      invite: e => HH.invite(fs, e, OWNER_EMAIL.value()),
      eventsFor: async (L, side, from, to) => (await linkEvents(L, side))(from, to),
      notify: pushTo,
    });
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    if (e instanceof trello.ToolError) fail(e);
    throw new HttpsError(e.code === 'not_owner' ? 'permission-denied' : 'failed-precondition', e.message || 'Something went wrong.', { code: e.code || 'tool_error' });
  }
});

/* this phone's notification token, kept with the person's private data */
exports.pushToken = onCall(opts, async req => {
  const u = await who(req), { token, on } = req.data || {};
  if (!token || typeof token !== 'string' || token.length > 400) throw new HttpsError('invalid-argument', 'No token.');
  const key = require('crypto').createHash('sha256').update(token).digest('hex').slice(0, 24);
  await priv(u.uid).set({ push: { [key]: on ? { token, at: Date.now() } : FieldValue.delete() } }, { merge: true });
  return { ok: true };
});

/* Every 5 minutes from 4:00 to 23:00 (nothing is sent at night, and it halves the runs): send what's due from every household's
   apps/afloat/notify/<uid> (written by the app) to that person's phones.
   Switched on with PUSH=on (a repository variable), because it needs Cloud Scheduler; see the README. */
if (process.env.PUSH === 'on') {
  const { onSchedule } = require('firebase-functions/v2/scheduler');
  /* The app writes the notify list while it is open; an event can be deleted or moved in Google after that. So an item that
     came from a Google event ({ev: {c: calendar, g: event, s: start}}) is checked with that person's own Google account right
     before it is sent. Deleted → not sent. Moved → "moved to …" instead of a wrong leave time. Google not answering → sent as
     planned: a possibly stale reminder beats a missing one. */
  const verify = async (uid, ev) => {
    try {
      const got = await gcal.client(await googleAccess(uid))('GET', `/calendars/${encodeURIComponent(ev.c)}/events/${encodeURIComponent(ev.g)}`);
      return { ...gcal.checkEvent(got, ev.s), name: String(got.summary || '').replace(/\s·\s[^·]+$/, '') };
    } catch (e) { return /not found|deleted|gone/i.test((e && e.message) || '') && e.code === 'tool_error' ? { state: 'gone' } : { state: 'unknown' }; }
  };
  exports.pushDue = onSchedule({ schedule: '*/5 4-22 * * *', region: 'europe-west1', timeZone: 'Europe/Prague', secrets: [GOOGLE_CLIENT_SECRET] }, async () => {
    const now = Date.now(), docs = (await fs.collectionGroup('notify').get()).docs, { getAuth } = require('firebase-admin/auth');
    for (const d of docs) {
      /* a list in a household's folder is only sent to someone who is in that household */
      const hid = HH.notifyHid(d.ref.path); if (!hid) continue;
      if (hid !== HH.LEGACY) { try { const usr = await getAuth().getUser(d.id), h = await HH.resolve(fs, usr.email, OWNER_EMAIL.value()); if (!h || h.hid !== hid) continue; } catch { continue; } }
      const v = d.data() || {}, sent = v.sent || {}, due = (v.items || []).filter(i => i && i.tag && i.at <= now && i.at > now - 20 * 60e3 && !sent[i.tag]);
      if (!due.length) continue;
      const p = (await priv(d.id).get()).data() || {}, toks = Object.entries(p.push || {}).filter(([, x]) => x && x.token);
      const mark = {};
      for (let i of due.slice(0, 5)) {
        mark[i.tag] = now;
        if (i.ev && i.ev.c && i.ev.g) {
          const chk = await verify(d.id, i.ev);
          if (chk.state === 'gone') continue;
          if (chk.state === 'moved') {
            const mt = 'mv-' + i.ev.g + '-' + chk.s; if (sent[mt] || mark[mt]) continue; mark[mt] = now;
            i = { tag: mt, title: `${chk.name || 'An event'} moved to ${chk.s.slice(11)}`, body: 'Open Afloat for the new leave time.', view: 'today' };
          }
        }
        if (!toks.length) continue;
        const r = await getMessaging().sendEachForMulticast({ tokens: toks.map(([, x]) => x.token), webpush: { headers: { Urgency: 'high', TTL: '1800' }, data: { title: String(i.title || '').slice(0, 120), body: String(i.body || '').slice(0, 400), tag: String(i.tag).slice(0, 80), link: '/#' + String(i.view || 'today').replace(/[^a-z]/g, '') } } });
        const bad = r.responses.map((x, j) => !x.success && /registration-token-not-registered|invalid-argument|invalid-registration-token/.test((x.error && x.error.code) || '') ? toks[j][0] : null).filter(Boolean);
        if (bad.length) await priv(d.id).set({ push: Object.fromEntries(bad.map(k => [k, FieldValue.delete()])) }, { merge: true });
      }
      const keep = Object.fromEntries(Object.entries({ ...sent, ...mark }).filter(([, t]) => t > now - 3 * 864e5));
      await d.ref.set({ sent: keep }, { merge: true });
    }
  });
}

/* The door itself: with SIGNIN_GATE=on (a repository variable), Google sign-in only lets the households (and invited addresses) in.
   Anyone else is turned away by Firebase before they get an account, and it's logged for the owner.
   Needs Firebase Authentication upgraded to "Identity Platform" (free at this size); see the README. */
if (process.env.SIGNIN_GATE === 'on') {
  const { beforeUserCreated, beforeUserSignedIn, HttpsError: GateError } = require('firebase-functions/v2/identity');
  const gate = how => async event => {
    const d = event.data || {}, email = String(d.email || '').toLowerCase();
    if (d.emailVerified === false || !(await allowed(email))) { await turnedAway(email, how); throw new GateError('permission-denied', 'This Afloat is private: only its households can sign in.'); }
  };
  exports.gateNewAccount = beforeUserCreated({ region: 'europe-west1' }, gate('new account'));
  exports.gateSignIn = beforeUserSignedIn({ region: 'europe-west1' }, gate('sign-in'));
}
