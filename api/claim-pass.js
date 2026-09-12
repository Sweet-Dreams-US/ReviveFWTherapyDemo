const { claimAndEmail } = require('./_pass-email');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const storageToken = process.env.CRON_SECRET;
  if (!secret || !storageToken) return res.status(503).json({ error: 'Online claims are temporarily unavailable. Please try again shortly.' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { return res.status(400).json({ error: 'Invalid request' }); } }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return res.status(400).json({ error: 'Invalid request' });
  if (body.company) return res.status(400).json({ error: 'Could not submit this form.' });
  const name = typeof body.fullName === 'string' ? body.fullName.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  if (!name || name.length > 240) return res.status(400).json({ error: 'Please enter your full name.' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) return res.status(400).json({ error: 'Please enter a valid email address.' });
  if (phone.length > 40) return res.status(400).json({ error: 'Please check your phone number.' });
  const token = body.turnstileToken;
  if (typeof token !== 'string' || !token || token.length > 2048) return res.status(400).json({ error: 'Please complete the security check and try again.' });
  try {
    const verification = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body: new URLSearchParams({ secret, response: token }), signal: AbortSignal.timeout(10000)
    });
    const result = await verification.json();
    if (!verification.ok || result.success !== true || result.action !== 'claim_pass' || !['revivefw.com', 'www.revivefw.com'].includes(result.hostname)) {
      return res.status(400).json({ error: 'Security check expired or failed. Please try again.' });
    }
  } catch (_) {
    // Fail closed: no unverified submission is saved if Turnstile is unavailable.
    return res.status(503).json({ error: 'Security check is temporarily unavailable. Please try again.' });
  }
  try {
    const saved = await claimAndEmail({ name, email, phone });
    if (body.marketingConsent === true) {
      try { await require('./_lead-sync').rpc('revive_pass_marketing_consent', { p_token: process.env.CRON_SECRET, p_email: email }); }
      catch (_) { console.error('Pass marketing consent was not recorded'); }
    }
    let tracking = {};
    // A measurement failure must never turn a saved claim into a form error.
    try { tracking = await require('./_pass-tracking').trackClaim(req, body, email, phone); }
    catch (_) { console.error('Pass conversion registration failed'); }
    return res.status(200).json({ ...saved, ...tracking });
  } catch (_) {
    return res.status(502).json({ error: 'We could not save your claim. Please try again. Your seven days have not started.' });
  }
};
