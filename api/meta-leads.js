const { rpc, requireAdmin } = require('./_lead-sync');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { return res.status(400).json({ error: 'Invalid JSON' }); } }
    body = body || {};
    await requireAdmin(body.password);
    if (!body.action || body.action === 'list') {
      const offset = Math.max(0, Number(body.offset) || 0);
      return res.status(200).json(await rpc('revive_meta_list', { p_token: body.password, p_offset: offset,
        p_query: String(body.query || '').slice(0, 200), p_filter: String(body.filter || 'all') }));
    }
    const flags = ['activate', 'joined', 'paused', 'do_not_contact', 'confirmation_recorded'];
    if (!flags.includes(body.action) && body.action !== 'notes') return res.status(400).json({ error: 'Unknown action' });
    if (!/^[a-f0-9-]{36}$/i.test(body.id || '') || !Number.isInteger(body.version)) return res.status(400).json({ error: 'Lead ID and version required' });
    if (flags.includes(body.action) && typeof body.value !== 'boolean') return res.status(400).json({ error: 'A checkbox value is required' });
    if (body.action === 'notes' && (typeof body.notes !== 'string' || typeof body.feedback !== 'string' || body.notes.length > 4000 || body.feedback.length > 2000)) {
      return res.status(400).json({ error: 'Notes or feedback are too long.' });
    }
    return res.status(200).json({ ok: true, lead: await rpc('revive_meta_update', {
      p_token: body.password, p_id: body.id, p_version: body.version, p_action: body.action,
      p_value: body.value === true, p_notes: body.notes || '', p_feedback: body.feedback || '',
    }) });
  } catch (error) {
    res.status(error.status || 502).json({ error: error.status === 401 ? 'Unauthorized' : error.status === 409
      ? 'This lead changed in another session. Refresh and try again.' : 'Could not save or load leads. Please try again.' });
  }
};
