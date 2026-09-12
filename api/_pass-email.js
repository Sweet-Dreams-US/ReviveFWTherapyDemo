const { rpc } = require('./_lead-sync');
const REDEEM = 'https://revivefw.com/free-pass#redeem';
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function passEmail(email) {
  const safeEmail = esc(email);
  const message = {
    from: process.env.NOTIFY_FROM || 'REVIVE Fitness & Recovery <noreply@revivefw.com>',
    to: [email], reply_to: 'info@revivefw.com',
    subject: 'Your FREE 7 Day Gym & Recovery Pass | REVIVE',
    text: `REVIVE FITNESS & RECOVERY\n\nYour free 7 day pass is ready.\nFREE Gym & Recovery for 7 Days\n\nYour seven days have NOT started. They begin only when the front desk checks you in.\n\n1. Bring this email or your form confirmation.\n2. Visit REVIVE at 3233 St Joe Center Rd, Fort Wayne, IN 46835. Share your claim email: ${email}\n3. The front desk activates your pass. Train that same visit and enjoy seven consecutive days.\n\nHow to redeem: ${REDEEM}\nHours: Monday through Friday 5am to 11pm; Saturday and Sunday 8am to 8pm.\nNo card required. No automatic membership. No obligation to join.\n\nQuestions? Reply to info@revivefw.com or call (260) 417 7668.\nYou received this confirmation because a free pass was claimed using this email. If that wasn’t you, ignore it or contact us.\nPrivacy: https://revivefw.com/privacy`,
    html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your REVIVE Pass</title></head>
<body style="margin:0;padding:0;background:#e6e0d6;color:#211a15;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Claiming does not start or reset your seven days. Show your confirmation at check in.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e6e0d6;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#f5f0e7;">
<tr><td style="background:#0b0807;padding:28px 32px;border-bottom:4px solid #ff3819;"><a href="https://revivefw.com" style="font-size:28px;letter-spacing:4px;font-weight:900;color:#f5f0e7;text-decoration:none;">REVIVE<span style="color:#ff3819;">.</span></a><p style="font-size:10px;letter-spacing:2px;color:#c9bdb0;margin:9px 0 0;">FITNESS &amp; RECOVERY · FORT WAYNE</p></td></tr>
<tr><td style="padding:34px 32px 26px;"><p style="margin:0 0 14px;color:#a42a16;font-size:11px;font-weight:bold;letter-spacing:2px;">YOUR FREE PASS IS READY</p>
<h1 style="font-family:Arial,Helvetica,sans-serif;font-size:38px;line-height:1.08;letter-spacing:-1px;margin:0;color:#17120f;">FREE Gym &amp; Recovery<br><span style="color:#b62b16;">for 7 Days.</span></h1>
<p style="font-size:16px;line-height:1.65;margin:20px 0 0;">The training floor, performance turf, and recovery tools. Your first week at REVIVE is on us.</p></td></tr>
<tr><td style="padding:0 32px 26px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:#0b0807;border-left:4px solid #ff3819;padding:22px;color:#f5f0e7;">
<p style="margin:0 0 8px;font-size:21px;font-weight:bold;line-height:1.3;">Your seven days have not started.</p><p style="margin:0;color:#d6cbbf;font-size:15px;line-height:1.6;">They begin only when you visit REVIVE and the front desk activates your pass.</p></td></tr></table></td></tr>
<tr><td style="padding:0 32px 26px;"><h2 style="font-size:23px;margin:0 0 20px;">Redeeming is simple.</h2>
<p style="font-size:16px;line-height:1.65;margin:0 0 17px;"><strong style="color:#a42a16;">01 &nbsp; Bring this email.</strong><br>Show it on your phone, or bring your form confirmation.</p>
<p style="font-size:16px;line-height:1.65;margin:0 0 17px;"><strong style="color:#a42a16;">02 &nbsp; Check in at the front desk.</strong><br>3233 St Joe Center Rd, Fort Wayne, IN 46835.<br>Your claim email: <strong style="overflow-wrap:anywhere;">${safeEmail}</strong></p>
<p style="font-size:16px;line-height:1.65;margin:0;"><strong style="color:#a42a16;">03 &nbsp; Start your seven days.</strong><br>Staff activates your pass when you arrive. You can train that same visit.</p></td></tr>
<tr><td align="center" style="padding:0 32px 30px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#bd2e18" style="background:#bd2e18;"><a href="${REDEEM}" style="display:inline-block;padding:18px 28px;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;letter-spacing:1px;">HOW TO REDEEM YOUR PASS &rarr;</a></td></tr></table><p style="font-size:13px;line-height:1.6;margin:16px 0 0;color:#605448;">No card required · No automatic membership<br>No appointment · No obligation to join</p></td></tr>
<tr><td style="padding:26px 32px;border-top:1px solid #d4c9ba;"><p style="margin:0 0 8px;font-size:12px;font-weight:bold;letter-spacing:1px;">COME WHEN IT WORKS FOR YOU</p><p style="font-size:15px;line-height:1.8;margin:0;">Monday through Friday &nbsp; 5am to 11pm<br>Saturday and Sunday &nbsp; 8am to 8pm</p><p style="font-size:14px;line-height:1.6;margin:16px 0 0;">Questions? Reply to this email or call <a href="tel:+12604177668" style="color:#211a15;">(260) 417 7668</a>.</p></td></tr>
<tr><td style="background:#0b0807;padding:25px 32px;"><p style="font-size:12px;letter-spacing:2px;font-weight:bold;color:#f5f0e7;margin:0 0 12px;">TRAIN. RECOVER. REPEAT.</p><p style="font-size:11px;line-height:1.7;color:#c9bdb0;margin:0;">You received this confirmation because a free pass was claimed using this email. If that wasn’t you, ignore it or contact us. This email does not start a trial or enroll you in a membership.</p><p style="font-size:11px;margin:14px 0 0;"><a href="https://revivefw.com/privacy" style="color:#f5f0e7;">Privacy Policy</a> &nbsp;·&nbsp; <a href="https://revivefw.com" style="color:#f5f0e7;">revivefw.com</a></p></td></tr>
</table></td></tr></table></body></html>`
  };
  // A Meta import can arrive after front desk redemption. This confirmation
  // explains the rule without falsely telling an active guest their pass is new.
  message.text = message.text.replace('Your seven days have NOT started.', 'Claiming does not start or reset your seven days.');
  message.html = message.html.replace('Your seven days have not started.', 'Claiming does not start or reset your seven days.');
  return message;
}

async function claimAndEmail({ name, email, phone = '' }) {
  const token = process.env.CRON_SECRET;
  const saved = await rpc('revive_claim_website_pass', { p_token: token, p_name: name, p_email: email, p_phone: phone });
  if (saved !== true) throw new Error('Claim not saved');
  return sendConfirmation(email);
}

async function sendConfirmation(email) {
  const token = process.env.CRON_SECRET;
  if (!process.env.RESEND_API_KEY) return { ok: true, email_status: 'not_sent' };
  let prepared;
  try {
    prepared = await rpc('revive_prepare_pass_email', { p_token: token, p_email: email, p_payload: passEmail(email) });
    if (prepared.status !== 'ready') return { ok: true, email_status: prepared.status };
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `pass-confirmation-${prepared.lead_id}` },
      body: JSON.stringify(prepared.payload), signal: AbortSignal.timeout(15000)
    });
    const sent = await response.json();
    if (!response.ok || !sent.id) throw new Error('Email not accepted');
    await rpc('revive_finish_pass_email', { p_token: token, p_id: prepared.lead_id, p_provider_id: sent.id });
    return { ok: true, email_status: 'sent' };
  } catch (_) {
    if (prepared && prepared.lead_id) await rpc('revive_finish_pass_email', { p_token: token, p_id: prepared.lead_id, p_provider_id: null }).catch(() => {});
    return { ok: true, email_status: 'needs_review' };
  }
}
async function sendPendingConfirmations() {
  if (!process.env.RESEND_API_KEY) return { configured: false, sent: 0, failed: 0 };
  const emails = await rpc('revive_pending_confirmations', { p_token: process.env.CRON_SECRET });
  let sent = 0, failed = 0;
  const started = Date.now();
  for (const email of emails) {
    if (Date.now() - started > 25000) break;
    const result = await sendConfirmation(email);
    if (result.email_status === 'sent') sent++;
    else if (result.email_status === 'needs_review') failed++;
  }
  return { configured: true, sent, failed };
}
module.exports = { passEmail, claimAndEmail, sendConfirmation, sendPendingConfirmations };
