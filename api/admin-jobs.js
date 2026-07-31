// POST /api/admin-jobs — password-gated jobs CRUD for the operator console.
// body.action: 'list' | 'save' | 'delete'. Password validated inside the RPC
// (revive_check_admin against app_secrets). No service-role key.
module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) { res.status(500).json({ error: 'Server not configured' }); return; }
  const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' };

  try {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
    body = body || {};
    const password = String(body.password || '');
    if (!password) { res.status(401).json({ error: 'Password required' }); return; }
    const action = body.action;

    async function rpc(fn, payload) {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(payload) });
      const text = await r.text();
      if (r.status === 401 || r.status === 403 || (!r.ok && text.toLowerCase().includes('unauthorized'))) { return { unauthorized: true }; }
      if (!r.ok) { console.error(fn + ' failed', r.status, text); return { error: text }; }
      let data = null; try { data = JSON.parse(text); } catch (_) {}
      return { data };
    }

    if (action === 'list') {
      const out = await rpc('revive_admin_list_jobs', { p_token: password });
      if (out.unauthorized) { res.status(401).json({ error: 'Invalid password' }); return; }
      if (out.error != null) { res.status(502).json({ error: 'Could not load jobs' }); return; }
      res.status(200).json({ ok: true, jobs: out.data || [] });
      return;
    }

    if (action === 'save') {
      const job = body.job || {};
      const out = await rpc('revive_upsert_job', { p_token: password, p_job: job });
      if (out.unauthorized) { res.status(401).json({ error: 'Invalid password' }); return; }
      if (out.error != null) { res.status(502).json({ error: 'Could not save job' }); return; }
      res.status(200).json({ ok: true, job: out.data });
      return;
    }

    if (action === 'delete') {
      const id = String(body.id || '');
      if (!id) { res.status(400).json({ error: 'Job id required' }); return; }
      const out = await rpc('revive_delete_job', { p_token: password, p_id: id });
      if (out.unauthorized) { res.status(401).json({ error: 'Invalid password' }); return; }
      if (out.error != null) { res.status(502).json({ error: 'Could not delete job' }); return; }
      res.status(200).json({ ok: true });
      return;
    }

    res.status(400).json({ error: 'Unknown action' });
  } catch (e) { console.error('admin-jobs error', e); res.status(500).json({ error: 'Unexpected error' }); }
};
