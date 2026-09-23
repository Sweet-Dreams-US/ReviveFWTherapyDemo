const { rpc, requireAdmin } = require('./_lead-sync');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { return res.status(400).json({ error: 'Invalid JSON' }); } }
    body = body || {};
    await requireAdmin(body.password);
    if (body.action === 'tracking_health') return res.status(200).json(await require('./_meta').trackingHealth());
    if (body.action === 'email_status') {
      if (!/^[a-f0-9-]{36}$/i.test(body.emailId || '')) return res.status(400).json({ error: 'Email ID required' });
      if (!process.env.RESEND_API_KEY) return res.status(503).json({ error: 'Email is not configured' });
      const r = await fetch('https://api.resend.com/emails/' + body.emailId, { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` }, signal: AbortSignal.timeout(8000) });
      const sent = await r.json();
      if (!r.ok) return res.status(502).json({ error: 'Provider email status unavailable', provider_status: r.status });
      return res.status(200).json({ id: sent.id, last_event: sent.last_event, created_at: sent.created_at });
    }
    if (['send_pass_preview', 'send_experience_preview', 'send_day5_preview', 'send_day7_preview', 'feedback_link'].includes(body.action)) {
      const pass = body.action === 'send_pass_preview';
      const day5 = body.action === 'send_day5_preview';
      const day7 = body.action === 'send_day7_preview';
      const email = String(body.email || '').trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'A valid existing lead email is required' });
      const data = await rpc('revive_meta_list', { p_token: body.password, p_offset: 0, p_query: email, p_filter: 'all' });
      const lead = data.leads.find(l => l.email === email && l.id === body.id);
      if (!lead) return res.status(404).json({ error: 'Lead not found' });
      let feedbackUrl;
      if (!pass && !day5 && !day7) {
        try { feedbackUrl = require('./_feedback-link').feedbackLink(lead); }
        catch (_) { return res.status(400).json({ error: 'A pass activated within the last 30 days is required for this feedback link.' }); }
      } else if (!pass && (!lead.activated_at || lead.is_member)) {
        return res.status(400).json({ error: 'The offer preview requires an activated pass for a lead who has not joined.' });
      }
      if (body.action === 'feedback_link') return res.status(200).json({ url: feedbackUrl });
      if (lead.do_not_contact) return res.status(400).json({ error: 'This lead is marked do not contact' });
      const marker = pass ? '[Pass preview v1 sent]' : day5 ? '[Day 5 preview v2 sent]' : day7 ? '[Day 7 preview v1 sent]' : '[Experience preview v2 sent]';
      if ((lead.notes || '').includes(marker)) return res.status(200).json({ ok: true, already_sent: true });
      if ((lead.notes || '').length > 3700) return res.status(400).json({ error: 'Please shorten the staff notes before recording this test' });
      if (!process.env.RESEND_API_KEY) return res.status(503).json({ error: 'Email is not configured' });
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `${pass ? 'pass-preview-v1' : day5 ? 'day5-preview-v2' : day7 ? 'day7-preview-v1' : 'experience-preview-v2'}-${lead.id}` },
        body: JSON.stringify(pass ? require('./_pass-email').passEmail(lead.email) : day5 ? require('./_day5-email').day5Email(lead.email, lead.activated_at) : day7 ? require('./_day7-email').day7Email(lead.email, lead.activated_at) : require('./_experience-email').experienceEmail(lead.email, feedbackUrl)), signal: AbortSignal.timeout(15000)
      });
      const sent = await response.json();
      if (!response.ok || !sent.id) return res.status(502).json({ error: 'Email was not accepted. Check Resend before retrying.' });
      let recorded = true;
      try {
        await rpc('revive_meta_update', { p_token: body.password, p_id: lead.id, p_version: lead.version, p_action: 'notes', p_value: false,
          p_notes: (lead.notes ? lead.notes + '\n\n' : '') + marker + ' ' + new Date().toISOString() + '\nResend ID: ' + sent.id + '\nManual preview only. Redemption and automation state unchanged.', p_feedback: lead.feedback || '' });
      } catch (_) { recorded = false; }
      return res.status(200).json({ ok: true, email_status: 'sent', email_id: sent.id, recorded });
    }
    // Explicit staff-created claims use the same storage and initial email as the public form.
    if (body.action === 'create_claim') {
      const name = String(body.fullName || '').trim(), email = String(body.email || '').trim().toLowerCase();
      if (!name || name.length > 240 || email.length > 200 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Name and valid email required' });
      return res.status(200).json(await require('./_pass-email').claimAndEmail({ name, email, phone: String(body.phone || '').slice(0, 40) }));
    }
    if (!body.action || body.action === 'list') {
      const offset = Math.max(0, Number(body.offset) || 0);
      const data = await rpc('revive_meta_list', { p_token: body.password, p_offset: offset,
        p_query: String(body.query || '').slice(0, 200), p_filter: String(body.filter || 'all') });
      const automation = await rpc('revive_followup_state', { p_token: body.password, p_ids: data.leads.map(lead => lead.id) });
      return res.status(200).json({ ...data, automation });
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
