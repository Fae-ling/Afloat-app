// Claude for Afloat, through Anthropic's API: the same calls the app made with claude.ai's
// `sample` capability. Input is a string or a list of messages; images arrive as base64.
const { ToolError } = require('./trello');

const MODELS = { quick: 'claude-haiku-5-5', default: 'claude-sonnet-5-5', complex: 'claude-opus-5-5' };
/* US dollars per million tokens (input, output), from Anthropic's price list (Nov 2026). Haiku's long-prompt rate applies over 100k tokens. */
const PRICES = { 'claude-haiku-5-5': [0.10, 0.50, 0.50, 2.50], 'claude-sonnet-5-5': [2, 10], 'claude-opus-5-5': [4, 20] };
function costOf(model, u = {}) {
  const key = Object.keys(PRICES).find(k => String(model || '').startsWith(k)) || 'claude-sonnet-5-5', p = PRICES[key];
  const inTok = (+u.input_tokens || 0) + (+u.cache_creation_input_tokens || 0) * 1.25 + (+u.cache_read_input_tokens || 0) * 0.1, out = +u.output_tokens || 0;
  const long = p.length > 2 && inTok > 100000;
  return (inTok * (long ? p[2] : p[0]) + out * (long ? p[3] : p[1])) / 1e6;
}

function messagesOf(input, images = []) {
  const msgs = typeof input === 'string' ? [{ role: 'user', content: input }] : (Array.isArray(input) ? input : []).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '') }));
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') throw new ToolError('tool_error', 'The last message has to be from the user.');
  if (images.length) {
    const last = msgs[msgs.length - 1];
    last.content = [...images.slice(0, 10).map(i => ({ type: 'image', source: { type: 'base64', media_type: i.type || 'image/jpeg', data: i.data } })), { type: 'text', text: last.content }];
  }
  return msgs;
}

/* pull the JSON out of an answer, even if it came wrapped in a code fence */
function parseJson(text) {
  const t = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(t); } catch {}
  const a = t.search(/[[{]/), b = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch {} }
  throw new ToolError('tool_error', 'Claude’s answer wasn’t valid JSON.', { text });
}

async function ask(key, d, fetchImpl = fetch) {
  if (!key) throw new ToolError('not_granted', 'Claude isn’t set up for Afloat yet.');
  const body = { model: MODELS[d.modelTier] || MODELS.default, max_tokens: Math.min(+d.maxTokens || 8000, 16000), messages: messagesOf(d.input, d.images || []) };
  if (d.json) body.system = 'Reply with only valid JSON: no prose, no code fences.';
  const send = b => fetchImpl('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify(b) });
  let r = await send(body), j = await r.json().catch(() => ({}));
  /* a model name the account can't use: try the default model once */
  if ((r.status === 404 || (j.error && j.error.type === 'not_found_error')) && body.model !== MODELS.default) { body.model = MODELS.default; r = await send(body); j = await r.json().catch(() => ({})); }
  if (!r.ok) console.warn('Anthropic API', r.status, j.error && j.error.type, j.error && j.error.message);
  if (r.status === 429 || r.status === 529) throw new ToolError('rate_limited', 'Claude is busy. Try again in a minute.', { retryable: true, retryAfterMs: 5000 });
  if (!r.ok) throw new ToolError('tool_error', (j.error && j.error.message) || 'Claude didn’t answer.');
  const text = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
  const out = { text, truncated: j.stop_reason === 'max_tokens', model: j.model, usd: costOf(j.model || body.model, j.usage) };
  if (d.json) out.value = parseJson(text);
  return out;
}

module.exports = { ask, parseJson, messagesOf, MODELS, PRICES, costOf };
