// POST /api/inquiry — public endpoint for waitlist, contact, and giveaway forms.
// 1) Stores the inquiry in Supabase (source of truth — this blocks the response).
// 2) Best-effort: emails info@revivefw.com via Resend + appends to a Google Sheet
//    webhook + sends a Meta Conversions API "Lead" event.
//    Step 2 runs after the DB write via Promise.allSettled — it can never fail the submission.
const { buildUserData, sendCapiEvents } = require('./_meta.js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) { res.status(500).json({ error: 'Server not configured' }); return; }

  try {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
    body = body || {};

    if (body.company) { res.status(200).json({ ok: true }); return; } // honeypot

    const allowedTypes = ['waitlist', 'giveaway', 'contact'];
    const type = allowedTypes.includes(body.type) ? body.type : 'waitlist';
    const email = String(body.email || '').trim().toLowerCase();
    let firstName = String(body.firstName || body.name || '').trim();
    const lastName = String(body.lastName || '').trim();
    const message = body.goal || body.message || null;

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { res.status(400).json({ error: 'A valid email is required' }); return; }
    // Name is optional for quick email-only waitlist signups — derive a placeholder from the email.
    if (!firstName) firstName = email.split('@')[0].slice(0, 120);

    // --- Cloudflare Turnstile bot check (enforced only when the secret is configured) ---
    const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY;
    if (TURNSTILE_SECRET) {
      const token = body['cf-turnstile-response'] || body.turnstileToken || '';
      if (!token) { res.status(400).json({ error: 'Please complete the bot check and try again.' }); return; }
      try {
        const params = new URLSearchParams({ secret: TURNSTILE_SECRET, response: String(token) });
        const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
        if (ip) params.append('remoteip', ip);
        const vr = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params,
        });
        const vj = await vr.json().catch(() => ({ success: false }));
        if (vj.success === false) { res.status(400).json({ error: 'Bot verification failed. Please try again.' }); return; }
      } catch (e) {
        // Fail open on a Turnstile outage so real signups are never lost (the honeypot still applies).
        console.error('turnstile verify error (allowing through)', e);
      }
    }

    const row = {
      type,
      first_name: firstName.slice(0, 120),
      last_name: lastName.slice(0, 120),
      email: email.slice(0, 200),
      phone: String(body.phone || '').trim().slice(0, 40) || null,
      tier: body.tier ? String(body.tier).slice(0, 40) : null,
      instagram: body.instagram ? String(body.instagram).trim().slice(0, 80) : null,
      goal: message ? String(message).slice(0, 2000) : null,
      payload: body,
      source: String(body.source || req.headers['referer'] || '').slice(0, 300) || null,
    };

    // --- 1) Primary store: Supabase (must succeed) ---
    const r = await fetch(`${SUPABASE_URL}/rest/v1/inquiries`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
    });
    if (!r.ok) {
      const t = await r.text();
      console.error('inquiry insert failed', r.status, t);
      res.status(502).json({ error: 'Could not save your submission. Please try again.' });
      return;
    }

    // --- 2) Best-effort notifications (never block or fail the response) ---
    await Promise.allSettled([sendEmail(type, row), sendToSheet(row), sendMetaLead(row, req, body.metaEventId)]);

    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('inquiry error', e);
    res.status(500).json({ error: 'Unexpected error. Please try again.' });
  }
};

async function sendEmail(type, row) {
  const KEY = process.env.RESEND_API_KEY;
  if (!KEY) return;
  const to = process.env.NOTIFY_EMAIL || 'info@revivefw.com';
  const from = process.env.NOTIFY_FROM || 'REVIVE Website <noreply@revivefw.com>';
  const label = type === 'contact' ? 'Contact Message' : type === 'giveaway' ? 'Giveaway Entry' : 'Founders Waitlist';
  const name = `${row.first_name} ${row.last_name}`.trim();
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const fields = [
    ['Type', label], ['Name', name], ['Email', row.email], ['Phone', row.phone || '—'],
    ['Tier', row.tier || '—'], ['Instagram', row.instagram || '—'], ['Message', row.goal || '—'], ['Source', row.source || '—'],
  ];
  const text = fields.map(([k, v]) => `${k}: ${v}`).join('\n');
  const html = `<div style="font-family:system-ui,Segoe UI,sans-serif;max-width:560px">
    <h2 style="margin:0 0 2px">New ${esc(label)}</h2>
    <p style="color:#888;margin:0 0 16px;font-size:13px">via revivefw.com</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px">
      ${fields.map(([k, v]) => `<tr><td style="padding:6px 14px 6px 0;color:#999;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:6px 0">${esc(v)}</td></tr>`).join('')}
    </table></div>`;
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], reply_to: row.email, subject: `New ${label} — ${name || row.email}`, text, html }),
    });
    if (!resp.ok) console.error('resend send failed', resp.status, await resp.text());
  } catch (e) { console.error('resend error', e); }
}

// Meta Conversions API "Lead" — hashed PII + request signals. event_id matches the
// browser Pixel's Lead (passed as metaEventId) so Meta deduplicates the pair.
async function sendMetaLead(row, req, eventId) {
  const event = {
    event_name: 'Lead',
    event_time: Math.floor(Date.now() / 1000),
    action_source: 'website',
    event_source_url: req.headers['referer'] ? String(req.headers['referer']).slice(0, 1000) : undefined,
    event_id: eventId ? String(eventId).slice(0, 100) : undefined,
    user_data: buildUserData(req, { email: row.email, phone: row.phone, firstName: row.first_name, lastName: row.last_name }),
    custom_data: { content_name: row.type === 'contact' ? 'Contact Form' : 'Founders Lead', lead_type: row.type },
  };
  await sendCapiEvents([event]);
}

async function sendToSheet(row) {
  const url = process.env.GOOGLE_SHEET_WEBHOOK_URL;
  if (!url) return;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        created_at: new Date().toISOString(),
        type: row.type, first_name: row.first_name, last_name: row.last_name, email: row.email,
        phone: row.phone || '', tier: row.tier || '', instagram: row.instagram || '', message: row.goal || '', source: row.source || '',
      }),
    });
    if (!resp.ok) console.error('sheet webhook failed', resp.status);
  } catch (e) { console.error('sheet error', e); }
}
