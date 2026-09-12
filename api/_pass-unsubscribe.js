const { createHmac, timingSafeEqual } = require('node:crypto');
const validId = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
function sign(id, secret = process.env.CRON_SECRET) {
  if (!validId.test(id) || !secret || secret.length < 32) throw new Error('Unsubscribe signing unavailable');
  return createHmac('sha256', secret).update('revive:pass-unsubscribe:v1:' + id).digest('base64url');
}
function tokenFor(id, secret) { return id + '.' + sign(id, secret); }
function verify(token, secret) {
  if (typeof token !== 'string' || !/^[a-f0-9-]{36}\.[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const [id, mac] = token.split('.');
  if (!validId.test(id)) return null;
  try { return timingSafeEqual(Buffer.from(mac), Buffer.from(sign(id, secret))) ? id : null; } catch (_) { return null; }
}
function addUnsubscribe(message, id) {
  const token = tokenFor(id), human = 'https://revivefw.com/pass-unsubscribe#token=' + token;
  const oneClick = 'https://revivefw.com/api/pass-unsubscribe?token=' + token;
  return { ...message,
    headers: { ...(message.headers || {}), 'List-Unsubscribe': '<' + oneClick + '>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    text: message.text + '\n\nStop pass followup emails: ' + human,
    html: message.html.replace('>Privacy Policy</a>', '>Privacy Policy</a> &nbsp;·&nbsp; <a href="' + human + '" style="color:#f5f0e7;">Unsubscribe from pass emails</a>')
  };
}
module.exports = { tokenFor, verify, addUnsubscribe };
