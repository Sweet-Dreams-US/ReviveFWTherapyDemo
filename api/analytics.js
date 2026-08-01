// POST /api/analytics — password-gated proxy for the Vercel Web Analytics Query API.
// Powers the operator Reports dashboard: visitors/pageviews over time, per-page
// breakdowns, and referrers. Queries are built SERVER-SIDE from structured params
// (no raw filter/by pass-through) so the public endpoint can't be abused.
//
// Env: ANALYTICS_API_TOKEN (Vercel access token — server-side only; VERCEL_ prefix is
// reserved by the platform, hence the ANALYTICS_ names), ANALYTICS_PROJECT_ID, ANALYTICS_TEAM_ID.
// Docs: https://vercel.com/docs/analytics/web-analytics-api
module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  const V_TOKEN = process.env.ANALYTICS_API_TOKEN;
  const V_PROJECT = process.env.ANALYTICS_PROJECT_ID;
  const V_TEAM = process.env.ANALYTICS_TEAM_ID;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) { res.status(500).json({ error: 'Server not configured' }); return; }
  if (!V_TOKEN || !V_PROJECT) { res.status(500).json({ error: 'Analytics not configured (ANALYTICS_API_TOKEN / ANALYTICS_PROJECT_ID missing)' }); return; }

  try {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
    body = body || {};

    // --- Admin password check (same gate as the rest of the console) ---
    const password = String(body.password || '');
    if (!password) { res.status(401).json({ error: 'Password required' }); return; }
    const auth = await fetch(`${SUPABASE_URL}/rest/v1/rpc/revive_check_admin`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: password }),
    });
    const authText = await auth.text();
    if (!auth.ok || authText.trim() !== 'true') { res.status(401).json({ error: 'Invalid password' }); return; }

    // --- Structured query params ---
    const RANGES = { day: 1, week: 7, month: 30 };
    const range = RANGES[body.range] ? body.range : 'week';
    const days = RANGES[range];
    const until = new Date();
    const since = new Date(until.getTime() - days * 86400000);
    const granularity = range === 'day' ? 'hour' : 'day';

    const MODES = { totals: 1, timeseries: 1, pages: 1, referrers: 1 };
    const mode = MODES[body.mode] ? body.mode : 'totals';

    // Optional page filter (exact path, sanitized) for drill-down
    let filter;
    const path = typeof body.path === 'string' ? body.path.trim() : '';
    if (path && /^\/[a-zA-Z0-9\-_/.]*$/.test(path) && path.length <= 200) {
      filter = `requestPath eq '${path}'`;
    }

    const base = 'https://api.vercel.com/v1/query/web-analytics/visits/';
    const params = new URLSearchParams({ projectId: V_PROJECT });
    if (V_TEAM) params.set('teamId', V_TEAM);
    params.set('since', since.toISOString());
    params.set('until', until.toISOString());
    if (filter) params.set('filter', filter);

    let url;
    if (mode === 'totals') {
      url = base + 'count?' + params.toString();
    } else {
      if (mode === 'timeseries') params.set('by', granularity);
      if (mode === 'pages') { params.set('by', 'requestPath'); params.set('limit', '100'); }
      if (mode === 'referrers') { params.set('by', 'referrerHostname'); params.set('limit', '100'); }
      url = base + 'aggregate?' + params.toString();
    }

    const r = await fetch(url, { headers: { Authorization: `Bearer ${V_TOKEN}` } });
    const text = await r.text();
    if (!r.ok) {
      console.error('vercel analytics failed', r.status, text.slice(0, 300));
      res.status(502).json({ error: 'Could not load analytics (' + r.status + ')' });
      return;
    }
    let data = {};
    try { data = JSON.parse(text); } catch (_) {}

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ok: true, mode, range, granularity, since: since.toISOString(), until: until.toISOString(), result: data });
  } catch (e) {
    console.error('analytics error', e);
    res.status(500).json({ error: 'Unexpected error' });
  }
};
