// GET  /api/settings — public. Returns the founders-presale + public-opening dates that drive the countdown.
// POST /api/settings — admin. Updates those dates (password validated in a SECURITY DEFINER function).
module.exports = async (req, res) => {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    res.status(500).json({ error: 'Server not configured' });
    return;
  }
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };

  try {
    if (req.method === 'GET') {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/settings?id=eq.1&select=founders_presale_date,public_opening_date,grand_opening_date`,
        { headers }
      );
      if (!r.ok) { res.status(502).json({ error: 'Could not load settings' }); return; }
      const rows = await r.json();
      const s = rows[0] || {};
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({
        foundersPresaleDate: s.founders_presale_date || null,
        publicOpeningDate: s.public_opening_date || null,
        grandOpeningDate: s.grand_opening_date || null,
      });
      return;
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
      body = body || {};
      const password = String(body.password || '');
      if (!password) { res.status(401).json({ error: 'Password required' }); return; }

      const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/revive_update_settings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          p_token: password,
          p_presale: body.foundersPresaleDate || null,
          p_opening: body.publicOpeningDate || null,
        }),
      });
      const text = await r.text();
      if (r.status === 401 || r.status === 403 || (!r.ok && text.includes('unauthorized'))) {
        res.status(401).json({ error: 'Invalid password' });
        return;
      }
      if (!r.ok) { console.error('update settings failed', r.status, text); res.status(502).json({ error: 'Could not save settings' }); return; }
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('settings error', e);
    res.status(500).json({ error: 'Unexpected error' });
  }
};
