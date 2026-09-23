const { passEmail } = require('./_pass-email');
const MEMBERSHIPS = 'https://revivefw.com/pricing';
const REDEEM = 'https://revivefw.com/free-pass#redeem';
// Month to month prices published on pricing.html. The Day 13 rate must beat these.
const STANDARD_RATES = { essential: 89, plus: 139, elite: 169 };
const TIERS = [['essential', 'Essential'], ['plus', 'Plus'], ['elite', 'Elite']];

const money = n => '$' + (Number.isInteger(n) ? String(n) : n.toFixed(2));

// Same responsive frame and brand header as every other pass email.
function frame(heading, preheader) {
  const base = passEmail('guest@example.com');
  const header = base.html.slice(0, base.html.indexOf('<tr><td style="padding:34px'))
    .replace('<title>Your REVIVE Pass</title>', '<title>' + heading + '</title>')
    .replace('Claiming does not start or reset your seven days. Show your confirmation at check in.', preheader);
  const footer = base.html.slice(base.html.indexOf('<tr><td style="background:#0b0807;padding:25px'))
    .replace('You received this confirmation because a free pass was claimed using this email. If that wasn’t you, ignore it or contact us. This email does not start a trial or enroll you in a membership.', 'You received this email as part of your REVIVE free pass experience. Your pass does not automatically become a paid membership.');
  return { from: base.from, reply_to: base.reply_to, header, footer };
}

const hero = (eyebrow, line1, line2, intro) => `
<tr><td style="padding:34px 32px 26px;"><p style="margin:0 0 14px;color:#a42a16;font-size:11px;font-weight:bold;letter-spacing:2px;">${eyebrow}</p>
<h1 style="font-size:38px;line-height:1.12;letter-spacing:-1px;margin:0;color:#17120f;">${line1}<br><span style="color:#b62b16;">${line2}</span></h1>
<p style="font-size:17px;line-height:1.7;margin:22px 0 0;">${intro}</p></td></tr>`;
const button = (href, label) => `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#bd2e18" style="background:#bd2e18;"><a href="${href}" style="display:inline-block;padding:18px 26px;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;letter-spacing:1px;">${label} &rarr;</a></td></tr></table>`;
const signoff = `<p style="font-size:16px;line-height:1.7;margin:24px 0 0;">See you at REVIVE,<br><strong>The REVIVE Team</strong></p></td></tr>
<tr><td style="padding:24px 32px;border-top:1px solid #d4c9ba;"><p style="font-size:13px;line-height:1.7;color:#605448;margin:0;">3233 St Joe Center Rd<br>Fort Wayne, IN 46835<br><a href="tel:+12604177668" style="color:#211a15;">(260) 417 7668</a></p></td></tr>
`;
const TEXT_FOOTER = 'See you at REVIVE,\nThe REVIVE Team\n\n3233 St Joe Center Rd, Fort Wayne, IN 46835\n(260) 417 7668\nPrivacy: https://revivefw.com/privacy';

// Day 10: the proposal's hesitant prospect step. More experience, not a discount.
function day10Email(email) {
  const f = frame('Take three more days.', 'Not ready to decide? Come back for three more free days.');
  const intro = 'Your free pass has ended, and that is okay. Choosing a gym is a real decision. Instead of rushing it, come back for three more free days to train, recover, and see how REVIVE fits your week.';
  const steps = ['Your three days start when you check in at the front desk, just like your first pass.', 'Show this email when you arrive. No card required and no automatic membership.'];
  return { from: f.from, reply_to: f.reply_to, to: [email],
    subject: 'Three more free days at REVIVE, on us',
    text: `REVIVE FITNESS & RECOVERY\n\nNot ready yet? Take three more days.\n\n${intro}\n\nYOUR THREE EXTRA DAYS\n${steps.join('\n')}\n\nPlan your visit: ${REDEEM}\nHours: Monday through Friday 5am to 11pm; Saturday and Sunday 8am to 8pm.\n\n${TEXT_FOOTER}`,
    html: f.header + hero('THREE MORE DAYS', 'Not ready yet?', 'Take three more days.', intro) + `
<tr><td style="padding:0 32px 26px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:#0b0807;border-left:4px solid #ff3819;padding:24px;color:#f5f0e7;">
<h2 style="font-size:24px;line-height:1.3;margin:0 0 16px;">Your three extra days.</h2>
${steps.map(s => `<p style="font-size:16px;line-height:1.7;color:#d6cbbf;margin:0 0 10px;">${s}</p>`).join('')}
</td></tr></table></td></tr>
<tr><td style="padding:0 32px 30px;">${button(REDEEM, 'PLAN YOUR VISIT')}
<p style="font-size:15px;line-height:1.8;margin:24px 0 0;">Monday through Friday &nbsp; 5am to 11pm<br>Saturday and Sunday &nbsp; 8am to 8pm</p>
` + signoff + f.footer };
}

// Throws a staff readable message; returns whole cents so the email never shows 79.999.
function validateSixMonthRates(input) {
  const out = {};
  for (const [key, label] of TIERS) {
    const n = Number(input && input[key]);
    if (!Number.isFinite(n) || n <= 0) throw new Error(`Enter a ${label} rate.`);
    // 79.99 * 100 is 7998.999…, so compare with a tolerance rather than exactly.
    if (Math.abs(Math.round(n * 100) - n * 100) > 1e-6) throw new Error(`${label} rate can have at most two decimal places.`);
    if (n >= STANDARD_RATES[key]) throw new Error(`${label} preferred rate must be below the standard ${money(STANDARD_RATES[key])} per month.`);
    out[key] = Math.round(n * 100) / 100;
  }
  return out;
}

// Day 13: the proposal's commitment offer, reserved for guests who already came back.
function day13Email(email, offer) {
  const rates = validateSixMonthRates(offer);
  const f = frame('Lock in a better rate.', 'Commit to six months and train at a preferred monthly rate.');
  const intro = 'You have spent real time at REVIVE. If you are ready to make it part of your routine, commit to six months and train at a preferred monthly rate.';
  const terms = 'Enroll at the front desk and show this email to receive the preferred rate with a six month commitment. Ask our team for the full membership terms before you enroll.';
  const flexible = 'Prefer flexibility? Our standard memberships stay month to month with no contract.';
  const rows = TIERS.map(([key, label]) => ({ label, rate: money(rates[key]), normal: money(STANDARD_RATES[key]) }));
  return { from: f.from, reply_to: f.reply_to, to: [email],
    subject: 'Your preferred six month rate at REVIVE',
    text: `REVIVE FITNESS & RECOVERY\n\nReady to commit? Lock in a better rate.\n\n${intro}\n\nSIX MONTH PREFERRED RATES\n${rows.map(r => `${r.label}: ${r.rate} per month (normally ${r.normal} month to month)`).join('\n')}\n\n${terms}\n\n${flexible}\n\nView memberships: ${MEMBERSHIPS}\n\n${TEXT_FOOTER}`,
    html: f.header + hero('A PREFERRED RATE', 'Ready to commit?', 'Lock in a better rate.', intro) + `
<tr><td style="padding:0 32px 26px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:#0b0807;border-left:4px solid #ff3819;padding:24px;color:#f5f0e7;">
<h2 style="font-size:24px;line-height:1.3;margin:0 0 22px;">Six month preferred rates.</h2>
${rows.map((r, i) => `<p style="font-size:17px;margin:0 0 6px;font-weight:bold;">${r.label} &nbsp;<span style="color:#ff3819;">${r.rate}</span> per month</p><p style="font-size:15px;line-height:1.7;color:#d6cbbf;margin:0${i < rows.length - 1 ? ' 0 20px' : ''};">Normally ${r.normal} month to month.</p>`).join('\n')}
</td></tr></table></td></tr>
<tr><td style="padding:0 32px 26px;"><p style="font-size:15px;line-height:1.7;margin:0;">${terms}</p></td></tr>
<tr><td style="padding:0 32px 30px;">${button(MEMBERSHIPS, 'VIEW MEMBERSHIPS')}
<p style="font-size:15px;line-height:1.7;margin:24px 0 0;">${flexible}</p>
` + signoff + f.footer };
}

module.exports = { day10Email, day13Email, validateSixMonthRates, STANDARD_RATES };
