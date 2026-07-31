// POST /api/set-member — password-gated. Marks an email as member / non-member
// (drives the members vs newsletter email segmentation in the operator console).
module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) { res.status(500).json({ error: 'Server not configured' }); return; }
  try {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
    body = body || {};
    const password = String(body.password || '');
    if (!password) { res.status(401).json({ error: 'Password required' }); return; }
    const email = String(body.email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { res.status(400).json({ error: 'Valid email required' }); return; }

    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/revive_set_member`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: password, p_email: email, p_member: body.member === true }),
    });
    const text = await r.text();
    if (r.status === 401 || r.status === 403 || (!r.ok && text.toLowerCase().includes('unauthorized'))) { res.status(401).json({ error: 'Invalid password' }); return; }
    if (!r.ok) { console.error('set-member failed', r.status, text); res.status(502).json({ error: 'Could not update member status' }); return; }
    res.status(200).json({ ok: true });
  } catch (e) { console.error('set-member error', e); res.status(500).json({ error: 'Unexpected error' }); }
};
