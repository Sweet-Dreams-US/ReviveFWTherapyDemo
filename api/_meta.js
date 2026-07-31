// Shared Meta Conversions API helper (server-side only).
// Not a route (leading underscore) — imported by api/track.js and api/inquiry.js.
//
// Sends events to the Meta CAPI /events edge with SHA-256-hashed PII, plus the
// unhashed signals Meta expects (IP, user-agent, _fbp / _fbc cookies). Pixel ID
// and access token come from Vercel env (META_PIXEL_ID, META_CAPI_TOKEN) — never
// hardcoded. The browser Pixel and these server events share an event_id so Meta
// deduplicates them.
const crypto = require('crypto');

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';

function sha256(value) {
  const s = String(value == null ? '' : value).trim().toLowerCase();
  if (!s) return undefined;
  return crypto.createHash('sha256').update(s).digest('hex');
}

// Field-specific normalization per Meta's advanced-matching spec.
function hashEmail(v) {
  const s = String(v == null ? '' : v).trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) ? crypto.createHash('sha256').update(s).digest('hex') : undefined;
}
function hashPhone(v) {
  let d = String(v == null ? '' : v).replace(/[^0-9]/g, '');
  if (!d) return undefined;
  if (d.length === 10) d = '1' + d; // assume US country code when omitted
  return crypto.createHash('sha256').update(d).digest('hex');
}
function hashText(v) { // names, city — lowercase, strip whitespace/punctuation
  const s = String(v == null ? '' : v).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return s ? crypto.createHash('sha256').update(s).digest('hex') : undefined;
}

function getCookie(req, name) {
  const raw = req.headers.cookie || '';
  const m = raw.match(new RegExp('(?:^|;\\s*)' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : undefined;
}
function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || undefined;
}

// Build the user_data block: unhashed signals from the request + hashed PII (if any).
function buildUserData(req, pii) {
  const ud = {};
  const ua = req.headers['user-agent']; if (ua) ud.client_user_agent = String(ua).slice(0, 500);
  const ip = clientIp(req); if (ip) ud.client_ip_address = ip;
  const fbp = getCookie(req, '_fbp'); if (fbp) ud.fbp = fbp;
  const fbc = getCookie(req, '_fbc'); if (fbc) ud.fbc = fbc;
  if (pii && typeof pii === 'object') {
    const em = hashEmail(pii.email); if (em) ud.em = [em];
    const ph = hashPhone(pii.phone); if (ph) ud.ph = [ph];
    const fn = hashText(pii.firstName); if (fn) ud.fn = [fn];
    const ln = hashText(pii.lastName); if (ln) ud.ln = [ln];
    const ct = hashText(pii.city); if (ct) ud.ct = [ct];
    if (pii.externalId) { const ex = sha256(pii.externalId); if (ex) ud.external_id = [ex]; }
  }
  return ud;
}

// POST an array of fully-formed event objects to the CAPI /events edge.
async function sendCapiEvents(events) {
  const PIXEL = process.env.META_PIXEL_ID;
  const TOKEN = process.env.META_CAPI_TOKEN;
  if (!PIXEL || !TOKEN) { console.warn('CAPI not configured (META_PIXEL_ID / META_CAPI_TOKEN missing)'); return { skipped: true }; }
  const payload = { data: events };
  if (process.env.META_TEST_EVENT_CODE) payload.test_event_code = process.env.META_TEST_EVENT_CODE;
  try {
    const r = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${PIXEL}/events?access_token=${TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await r.text();
    if (!r.ok) console.error('CAPI send failed', r.status, text.slice(0, 400));
    return { ok: r.ok, status: r.status, body: text };
  } catch (e) {
    console.error('CAPI send error', e);
    return { ok: false, error: String(e && e.message || e) };
  }
}

module.exports = { GRAPH_VERSION, sha256, hashEmail, hashPhone, hashText, getCookie, clientIp, buildUserData, sendCapiEvents };
