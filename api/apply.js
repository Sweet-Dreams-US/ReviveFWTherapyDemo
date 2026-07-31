// POST /api/apply — public job-application endpoint.
// 1) Cloudflare Turnstile bot check (enforced when TURNSTILE_SECRET_KEY is set; fail-open on outage).
// 2) Stores the application in Supabase via a SECURITY DEFINER RPC (validates the job is open).
// 3) Best-effort: emails info@revivefw.com (Resend) + fires a Meta CAPI "Lead" — never block the response.
const { buildUserData, sendCapiEvents } = require('./_meta.js');

// Optional application fields we accept (mirrors /scripts/job-fields.js). Anything else is ignored.
const FIELD_KEYS = ['phone', 'resume_url', 'linkedin', 'portfolio', 'years_experience', 'certifications', 'availability', 'start_date', 'desired_pay', 'referral', 'cover_letter'];

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

    const jobId = String(body.jobId || body.job_id || '').trim();
    if (!/^[0-9a-f-]{36}$/i.test(jobId)) { res.status(400).json({ error: 'Invalid or missing job' }); return; }

    const firstName = String(body.firstName || body.first_name || '').trim().slice(0, 120);
    const lastName = String(body.lastName || body.last_name || '').trim().slice(0, 120);
    const email = String(body.email || '').trim().toLowerCase();
    if (!firstName) { res.status(400).json({ error: 'Your name is required' }); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { res.status(400).json({ error: 'A valid email is required' }); return; }
    const phone = body.phone ? String(body.phone).trim().slice(0, 40) : null;

    // --- Cloudflare Turnstile ---
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
      } catch (e) { console.error('turnstile verify error (allowing through)', e); }
    }

    // --- Collect the job-specific fields the applicant filled in ---
    const data = {};
    FIELD_KEYS.forEach((k) => { const v = body[k]; if (v != null && String(v).trim() !== '') data[k] = String(v).slice(0, 5000); });

    // --- Store via SECURITY DEFINER RPC (rejects closed/unknown jobs) ---
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/revive_submit_application`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_job_id: jobId, p_first: firstName, p_last: lastName, p_email: email, p_phone: phone,
        p_data: data, p_source: String(body.source || req.headers['referer'] || '').slice(0, 300) || null,
      }),
    });
    const text = await r.text();
    if (!r.ok) {
      if (text.toLowerCase().includes('job not open')) { res.status(400).json({ error: 'Sorry — this role is no longer accepting applications.' }); return; }
      console.error('application insert failed', r.status, text);
      res.status(502).json({ error: 'Could not submit your application. Please try again.' });
      return;
    }

    const row = { firstName, lastName, email, phone, jobTitle: String(body.jobTitle || '').slice(0, 200), data };
    await Promise.allSettled([notifyEmail(row, req), sendMetaLead(row, req, body.metaEventId)]);

    res.status(200).json({ ok: true });
  } catch (e) { console.error('apply error', e); res.status(500).json({ error: 'Unexpected error. Please try again.' }); }
};

async function notifyEmail(row, req) {
  const KEY = process.env.RESEND_API_KEY;
  if (!KEY) return;
  const to = process.env.NOTIFY_EMAIL || 'info@revivefw.com';
  const from = process.env.NOTIFY_FROM || 'REVIVE Website <noreply@revivefw.com>';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const name = `${row.firstName} ${row.lastName}`.trim();
  const rows = [['Applicant', name], ['Email', row.email], ['Phone', row.phone || '—'], ['Role', row.jobTitle || '—']];
  Object.keys(row.data || {}).forEach((k) => rows.push([k.replace(/_/g, ' '), row.data[k]]));
  const html = `<div style="font-family:system-ui,Segoe UI,sans-serif;max-width:600px">
    <h2 style="margin:0 0 2px">New Job Application${row.jobTitle ? ' — ' + esc(row.jobTitle) : ''}</h2>
    <p style="color:#888;margin:0 0 16px;font-size:13px">via revivefw.com/careers</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px">
      ${rows.map(([k, v]) => `<tr><td style="padding:6px 14px 6px 0;color:#999;vertical-align:top;white-space:nowrap;text-transform:capitalize">${esc(k)}</td><td style="padding:6px 0">${esc(v)}</td></tr>`).join('')}
    </table></div>`;
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], reply_to: row.email, subject: `New Application — ${row.jobTitle || 'Careers'} — ${name || row.email}`, html }),
    });
    if (!resp.ok) console.error('resend apply notify failed', resp.status, await resp.text());
  } catch (e) { console.error('resend apply error', e); }
}

async function sendMetaLead(row, req, eventId) {
  const event = {
    event_name: 'Lead',
    event_time: Math.floor(Date.now() / 1000),
    action_source: 'website',
    event_source_url: req.headers['referer'] ? String(req.headers['referer']).slice(0, 1000) : undefined,
    event_id: eventId ? String(eventId).slice(0, 100) : undefined,
    user_data: buildUserData(req, { email: row.email, phone: row.phone, firstName: row.firstName, lastName: row.lastName }),
    custom_data: { content_name: 'Job Application', lead_type: 'careers', job_title: row.jobTitle || undefined },
  };
  await sendCapiEvents([event]);
}
