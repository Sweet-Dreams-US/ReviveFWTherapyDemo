// POST /api/send-campaign — password-gated (operator console).
//
// CLEARED Jul 31 2026: no campaign email is loaded and SENDING IS DISABLED.
// The endpoint still authenticates and returns live audience counts (members /
// newsletter / waitlist / everyone) so the admin page can show list sizes.
// When a new campaign is written, the full sender (template + Resend batch with
// preview/test rails) can be restored — see git history and REVIVE-AUDIT.md.
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

    const mode = ['preview', 'test', 'send'].includes(body.mode) ? body.mode : 'preview';
    const audience = ['waitlist', 'giveaway', 'all', 'members', 'nonmembers'].includes(body.audience) ? body.audience : 'members';

    // Auth + recipient list in one call (password validated inside the RPC).
    const rpc = await fetch(`${SUPABASE_URL}/rest/v1/rpc/revive_list_inquiries`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: password }),
    });
    const rpcText = await rpc.text();
    if (rpc.status === 401 || rpc.status === 403 || (!rpc.ok && rpcText.toLowerCase().includes('unauthorized'))) {
      res.status(401).json({ error: 'Invalid password' }); return;
    }
    if (!rpc.ok) { console.error('rpc list failed', rpc.status, rpcText); res.status(502).json({ error: 'Could not load recipients' }); return; }

    let inquiries = [];
    try { inquiries = JSON.parse(rpcText) || []; } catch (_) { inquiries = []; }

    const isEmail = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
    const seen = new Set();
    const recipients = [];
    for (const row of inquiries) {
      if (audience === 'members') { if (!row.is_member) continue; }
      else if (audience === 'nonmembers') { if (row.is_member) continue; }
      else if (audience !== 'all' && row.type !== audience) continue;
      const email = String(row.email || '').trim().toLowerCase();
      if (!isEmail(email) || seen.has(email)) continue;
      seen.add(email);
      recipients.push({ email });
    }

    if (mode === 'test' || mode === 'send') {
      res.status(400).json({ error: 'No campaign is loaded — email sending is turned off right now.' });
      return;
    }

    // preview: audience counts only, with a placeholder in place of an email
    res.status(200).json({
      ok: true,
      mode,
      audience,
      count: recipients.length,
      sample: recipients.slice(0, 12),
      subject: '',
      html: `<!doctype html><html><body style="margin:0;background:#F7F4EE;font-family:Arial,Helvetica,sans-serif;">
<div style="padding:60px 30px;text-align:center;color:#857A6A;">
  <div style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#AFA491;">No campaign loaded</div>
  <p style="max-width:400px;margin:16px auto 0;font-size:15px;line-height:1.6;">There's no email queued right now. Your audience lists stay ready — when it's time to send, a new campaign will be written and loaded here first.</p>
</div>
</body></html>`,
    });
  } catch (e) {
    console.error('send-campaign error', e);
    res.status(500).json({ error: 'Unexpected error. Please try again.' });
  }
};
