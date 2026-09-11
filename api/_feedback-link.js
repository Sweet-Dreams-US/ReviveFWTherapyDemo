const { createHmac, timingSafeEqual } = require('node:crypto');
const lifetime = 30 * 86400000;
function signature(payload, secret) {
  if (!secret || secret.length < 32) throw new Error('Feedback signing is not configured');
  return createHmac('sha256', secret).update('revive:first-visit:v1:' + payload).digest('base64url');
}
function feedbackLink(lead, secret = process.env.CRON_SECRET, now = Date.now()) {
  const expires = Date.parse(lead.activated_at) + lifetime;
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(lead.id) || !Number.isSafeInteger(expires) || expires <= now) throw new Error('A recent activation is required');
  // Stable across delivery retries. Only an internal ID and expiry, never name or email.
  const payload = lead.id + '.' + expires;
  return 'https://revivefw.com/pass-feedback#token=' + payload + '.' + signature(payload, secret);
}
function verifyFeedbackToken(token, secret = process.env.CRON_SECRET, now = Date.now()) {
  if (typeof token !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\.\d{13}\.[A-Za-z0-9_-]{43}$/i.test(token)) return null;
  const [id, expiry, mac] = token.split('.');
  const expires = Number(expiry);
  if (expires <= now || expires > now + lifetime) return null;
  const expected = signature(id + '.' + expiry, secret);
  if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  return { id, activatedAt: new Date(expires - lifetime).toISOString() };
}
module.exports = { feedbackLink, verifyFeedbackToken };
