const { timingSafeEqual } = require('crypto');
const { requireAdmin, runSync } = require('./_lead-sync');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });
    const secret = process.env.CRON_SECRET;
    if (!secret) return res.status(503).json({ error: 'Lead sync is not configured.' });
    if (req.method === 'GET') {
      const actual = Buffer.from(String(req.headers.authorization || ''));
      const expected = Buffer.from(`Bearer ${secret}`);
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return res.status(401).json({ error: 'Unauthorized' });
    } else {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { return res.status(400).json({ error: 'Invalid JSON' }); } }
      await requireAdmin(body && body.password);
    }
    // Existing pending confirmations must recover even during a sheet outage.
    const [sync, tracking] = await Promise.all([
      runSync(secret).catch(() => ({ ok: false, error: 'Sheet sync failed' })),
      require('./_pass-tracking').flushConversions().catch(() => ({ error: 'Tracking retry failed' }))
    ]);
    const confirmations = await require('./_pass-email').sendPendingConfirmations();
    res.status(sync.ok ? 200 : 502).json({ ...sync, tracking, confirmations });
  } catch (error) {
    console.error('Meta lead sync failed', error.status || 502);
    res.status(error.status || 502).json({ error: error.status === 401 ? 'Unauthorized' : 'Could not sync leads. Check sheet access and try again.' });
  }
};
