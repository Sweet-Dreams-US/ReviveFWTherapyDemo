// GET /api/jobs — public. Returns the list of OPEN jobs (via SECURITY DEFINER RPC).
module.exports = async (req, res) => {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) { res.status(500).json({ error: 'Server not configured' }); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/revive_list_jobs`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!r.ok) { console.error('list jobs failed', r.status, await r.text()); res.status(502).json({ error: 'Could not load jobs' }); return; }
    const jobs = await r.json();
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ok: true, jobs: Array.isArray(jobs) ? jobs : [] });
  } catch (e) { console.error('jobs error', e); res.status(500).json({ error: 'Unexpected error' }); }
};
