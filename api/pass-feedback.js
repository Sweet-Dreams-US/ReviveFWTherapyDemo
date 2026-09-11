const { rpc } = require('./_lead-sync');
const { verifyFeedbackToken } = require('./_feedback-link');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.CRON_SECRET || process.env.CRON_SECRET.length < 32) return res.status(503).json({ error: 'Feedback is temporarily unavailable.' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = null; } }
  if (!body || !['load', 'submit'].includes(body.action)) return res.status(400).json({ error: 'Invalid request.' });
  const link = verifyFeedbackToken(body.token);
  if (!link) return res.status(403).json({ error: 'This private link is invalid or expired. Please open the button in your REVIVE email.' });
  const submitting = body.action === 'submit';
  if (submitting) {
    if (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5 || !Array.isArray(body.areas) || body.areas.length < 1 || body.areas.length > 2 || new Set(body.areas).size !== body.areas.length || body.areas.some(a => !['Gym', 'Recovery'].includes(a)) || typeof body.comments !== 'string' || body.comments.length > 2000 || typeof body.wantsHelp !== 'boolean') return res.status(400).json({ error: 'Please choose a rating and what you tried. Comments can be up to 2000 characters.' });
    if (!process.env.TURNSTILE_SECRET_KEY) return res.status(503).json({ error: 'Security check is temporarily unavailable.' });
    if (typeof body.turnstileToken !== 'string' || !body.turnstileToken || body.turnstileToken.length > 2048) return res.status(400).json({ error: 'Please complete the security check.' });
    try {
      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST', body: new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY, response: body.turnstileToken }), signal: AbortSignal.timeout(10000)
      });
      const result = await response.json();
      if (!response.ok || !result.success || result.action !== 'pass_feedback' || !['revivefw.com', 'www.revivefw.com'].includes(result.hostname)) return res.status(400).json({ error: 'Security check expired or failed. Please try again.' });
    } catch (_) { return res.status(503).json({ error: 'Security check is temporarily unavailable. Please try again.' }); }
  }
  try {
    const data = await rpc('revive_pass_feedback', { p_token: process.env.CRON_SECRET, p_id: link.id, p_activated_at: link.activatedAt,
      p_submit: submitting, p_rating: submitting ? body.rating : null, p_areas: submitting ? body.areas : [],
      p_comments: submitting ? body.comments.trim() : '', p_wants_help: submitting ? body.wantsHelp : false });
    if (!data) return res.status(403).json({ error: 'This private link is no longer available. Please contact the REVIVE team.' });
    return res.status(200).json(data);
  } catch (_) { return res.status(502).json({ error: 'We could not load or save your feedback. Please try again.' }); }
};
