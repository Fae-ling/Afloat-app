// Google Calendar for Afloat: answers the tool calls the app made to claude.ai's Google Calendar
// connector (list_events, create_event, ...) with the signed-in person's own Google account.
const { ToolError } = require('./trello');
const TZ = 'Europe/Prague';

/* "2026-11-04T10:00:00" in Prague → RFC 3339 with the right offset */
function withOffset(local, tz = TZ) {
  if (!local) return undefined;
  if (/[zZ]|[+-]\d\d:\d\d$/.test(local)) return local;
  const s = local.length === 10 ? local + 'T00:00:00' : local.length === 16 ? local + ':00' : local;
  const guess = new Date(s + 'Z');
  const part = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(guess).map(p => [p.type, p.value]));
  const asTz = Date.UTC(+part.year, +part.month - 1, +part.day, +part.hour, +part.minute, +part.second);
  const off = Math.round((asTz - guess.getTime()) / 60000), sign = off >= 0 ? '+' : '-', a = Math.abs(off);
  return `${s}${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}

function client(accessToken, fetchImpl = fetch) {
  return async (method, path, query = {}, body) => {
    const u = new URL('https://www.googleapis.com/calendar/v3' + path);
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, String(v));
    const r = await fetchImpl(u.toString(), { method, headers: { authorization: 'Bearer ' + accessToken, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    if (r.status === 401) throw new ToolError('needs_reauth', 'Google Calendar needs reconnecting.');
    if (r.status === 429 || r.status >= 500) throw new ToolError('server_unavailable', 'Google Calendar didn’t answer.', { retryable: true });
    if (r.status === 204) return {};
    const text = await r.text(); let j = {}; try { j = text ? JSON.parse(text) : {}; } catch {}
    if (!r.ok) throw new ToolError('tool_error', (j.error && j.error.message) || text.slice(0, 300) || ('Google said ' + r.status));
    return j;
  };
}

const cal = id => encodeURIComponent(id || 'primary');
const sendUpdates = l => ({ ALL: 'all', NONE: 'none', EXTERNAL_ONLY: 'externalOnly' })[l] || undefined;
const when = (t, allDay, tz) => allDay ? { date: String(t).slice(0, 10) } : { dateTime: withOffset(t, tz), timeZone: tz };
const perms = g => g ? { guestsCanModify: g.guestsCanModify, guestsCanInviteOthers: g.guestsCanInviteOthers, guestsCanSeeOtherGuests: g.guestsCanSeeGuests } : {};
const clean = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

function fields(a, tz) {
  const e = clean({ summary: a.summary, description: a.description, location: a.location, colorId: a.colorId, visibility: a.visibility, ...perms(a.guestPermissions) });
  if (a.startTime) e.start = when(a.startTime, a.allDay, tz);
  if (a.endTime) e.end = when(a.endTime, a.allDay, tz);
  if (a.overrideReminders) e.reminders = { useDefault: false, overrides: a.overrideReminders };
  else if (a.useDefaultReminders !== undefined) e.reminders = { useDefault: !!a.useDefaultReminders };
  if (a.availability) e.transparency = a.availability === 'AVAILABILITY_FREE' ? 'transparent' : 'opaque';
  if (a.recurrenceData) e.recurrence = a.recurrenceData;
  if (a.addGoogleMeetUrl) e.conferenceData = { createRequest: { requestId: 'afloat-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), conferenceSolutionKey: { type: 'hangoutsMeet' } } };
  return e;
}
/* the connector reported availability; keep that so the app reads both */
const out = e => e && e.id ? { ...e, availability: e.transparency === 'transparent' ? 'AVAILABILITY_FREE' : 'AVAILABILITY_BUSY' } : e;

async function run(call, tool, a) {
  const tz = a.timeZone || TZ;
  if (tool === 'list_calendars') { const r = await call('GET', '/users/me/calendarList', { maxResults: a.pageSize || 250, pageToken: a.pageToken });
    return { calendars: (r.items || []).map(c => ({ id: c.id, summary: c.summaryOverride || c.summary, description: c.description || '', timeZone: c.timeZone, accessRole: c.accessRole, primary: !!c.primary, backgroundColor: c.backgroundColor })), nextPageToken: r.nextPageToken }; }
  if (tool === 'list_events') {
    const r = await call('GET', `/calendars/${cal(a.calendarId)}/events`, { timeMin: withOffset(a.startTime || new Date().toISOString(), tz), timeMax: a.endTime ? withOffset(a.endTime, tz) : undefined, singleEvents: true, orderBy: a.orderBy === 'startTime' ? 'startTime' : undefined, maxResults: Math.min(a.pageSize || 250, 2500), pageToken: a.pageToken, q: a.fullText, timeZone: tz });
    return { summary: r.summary, timeZone: r.timeZone, accessRole: r.accessRole, defaultReminders: r.defaultReminders, updated: r.updated, events: (r.items || []).map(out), nextPageToken: r.nextPageToken };
  }
  if (tool === 'get_event') return out(await call('GET', `/calendars/${cal(a.calendarId)}/events/${encodeURIComponent(a.eventId)}`));
  if (tool === 'create_event') {
    const e = fields(a, tz); if (a.attendees) e.attendees = a.attendees;
    return out(await call('POST', `/calendars/${cal(a.calendarId)}/events`, { sendUpdates: sendUpdates(a.notificationLevel), conferenceDataVersion: a.addGoogleMeetUrl ? 1 : undefined }, e));
  }
  if (tool === 'update_event') {
    const e = fields(a, tz);
    if (a.addedAttendees || a.removedAttendeeEmails) {
      const cur = await call('GET', `/calendars/${cal(a.calendarId)}/events/${encodeURIComponent(a.eventId)}`);
      const rm = (a.removedAttendeeEmails || []).map(x => x.toLowerCase());
      const list = (cur.attendees || []).filter(x => !rm.includes(String(x.email).toLowerCase()));
      for (const n of a.addedAttendees || []) if (!list.some(x => String(x.email).toLowerCase() === String(n.email).toLowerCase())) list.push(n);
      e.attendees = list;
    }
    if (a.startTime && !a.endTime) {
      const cur = await call('GET', `/calendars/${cal(a.calendarId)}/events/${encodeURIComponent(a.eventId)}`);
      const s0 = Date.parse(cur.start.dateTime || cur.start.date), e0 = Date.parse(cur.end.dateTime || cur.end.date), ns = Date.parse(e.start.dateTime || e.start.date);
      const ne = new Date(ns + (e0 - s0)).toISOString(); e.end = a.allDay ? { date: ne.slice(0, 10) } : { dateTime: ne, timeZone: tz };
    }
    return out(await call('PATCH', `/calendars/${cal(a.calendarId)}/events/${encodeURIComponent(a.eventId)}`, { sendUpdates: sendUpdates(a.notificationLevel), conferenceDataVersion: a.addGoogleMeetUrl ? 1 : undefined }, e));
  }
  if (tool === 'delete_event') { await call('DELETE', `/calendars/${cal(a.calendarId)}/events/${encodeURIComponent(a.eventId)}`, { sendUpdates: sendUpdates(a.notificationLevel) }); return { deleted: true }; }
  if (tool === 'respond_to_event') {
    const cur = await call('GET', `/calendars/${cal(a.calendarId)}/events/${encodeURIComponent(a.eventId)}`);
    const att = (cur.attendees || []).map(x => x.self ? { ...x, responseStatus: a.responseStatus } : x);
    return out(await call('PATCH', `/calendars/${cal(a.calendarId)}/events/${encodeURIComponent(a.eventId)}`, { sendUpdates: 'all' }, { attendees: att }));
  }
  throw new ToolError('not_in_manifest', `Afloat doesn’t know ${tool}.`);
}

/* A Google dateTime as Afloat writes starts: "2026-11-06T10:00", Prague time */
function pragueMinute(iso) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(iso)).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
/* Is the event a phone notification was made for still on, and still when the app thought? `s` is its start as the app saw it.
   → { state: 'gone' } | { state: 'same' } | { state: 'moved', s: new start, deltaMs } */
function checkEvent(got, s) {
  if (!got || got.status === 'cancelled') return { state: 'gone' };
  const st = got.start && got.start.dateTime; if (!st || !s) return { state: 'same' };
  const now = pragueMinute(st); if (now === s) return { state: 'same' };
  return { state: 'moved', s: now, deltaMs: Date.parse(withOffset(now + ':00')) - Date.parse(withOffset(s + ':00')) };
}

module.exports = { client, run, withOffset, checkEvent, pragueMinute };
