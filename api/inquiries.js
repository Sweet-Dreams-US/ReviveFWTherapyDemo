// POST /api/inquiries — admin-only. Returns all inquiries.
// The submitted password is validated inside a SECURITY DEFINER Postgres function,
// so no readable RLS policy (and no service-role key) is ever exposed.
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    res.status(500).json({ error: 'Server not configured' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  body = body || {};
  const password = String(body.password || '');
  if (!password) { res.status(401).json({ error: 'Password required' }); return; }

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/revive_list_inquiries`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_token: password }),
    });

    const text = await r.text();
    if (r.status === 401 || r.status === 403 || (!r.ok && text.includes('unauthorized'))) {
      res.status(401).json({ error: 'Invalid password' });
      return;
    }
    if (!r.ok) {
      console.error('list inquiries failed', r.status, text);
      res.status(502).json({ error: 'Could not load inquiries' });
      return;
    }
    res.status(200).json({ ok: true, inquiries: JSON.parse(text) });
  } catch (e) {
    console.error('inquiries error', e);
    res.status(500).json({ error: 'Unexpected error' });
  }
};
