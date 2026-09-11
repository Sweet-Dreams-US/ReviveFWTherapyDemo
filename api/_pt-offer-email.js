const { passEmail } = require('./_pass-email');
const { deadline } = require('../scripts/pass-schedule');
const MEMBERSHIPS = 'https://revivefw.com/pricing';

function ptOfferEmail(email, activatedAt, finalDay) {
  const end = deadline(activatedAt);
  const base = passEmail(email);
  const subject = finalDay ? 'Last day to join with your free PT session | REVIVE' : 'Your next step includes a free PT session | REVIVE';
  const intro = finalDay
    ? 'Your free pass ends at closing today. Join before it ends and take your next step with a free personal training session with Kings Nutrition.'
    : 'You have had time to experience REVIVE. Now take your next step with personal guidance. Join before your free pass ends and get a free personal training session with Kings Nutrition.';
  const heading = finalDay ? 'Your pass ends today.' : 'Make your next step count.';
  const header = base.html.slice(0, base.html.indexOf('<tr><td style="padding:34px'))
    .replace('<title>Your REVIVE Pass</title>', '<title>' + heading + '</title>')
    .replace('Your pass is ready. Your seven days start at front desk check in, not today.', 'Join before your pass ends. Get 1 free PT session, or 2 with Elite.');
  const footer = base.html.slice(base.html.indexOf('<tr><td style="background:#0b0807;padding:25px'))
    .replace('You received this confirmation because a free pass was claimed using this email. If that wasn’t you, ignore it or contact us. This email does not start a trial or enroll you in a membership.', 'You received this email as part of your REVIVE free pass experience. Your pass does not automatically become a paid membership.');
  const terms = 'Complete your membership enrollment at the front desk before your pass ends to qualify. Simply booking a visit does not reserve the bonus. Your PT session can take place afterward. Our team will help coordinate it with Kings Nutrition.';
  return { ...base, subject,
    text: `REVIVE FITNESS & RECOVERY\n\n${heading}\n\n${intro}\n\nYOUR JOINING BONUS\nEssential or Plus: 1 free PT session with Kings Nutrition.\nElite: 2 free PT sessions with Kings Nutrition in total.\n\nYour pass and joining bonus end: ${end}.\n\n${terms}\n\nView memberships: ${MEMBERSHIPS}\n\nShow this email at the front desk when you join. Membership pricing stays the same. The joining bonus ends with your pass.\n\nSee you at REVIVE,\nThe REVIVE Team\n\n3233 St Joe Center Rd, Fort Wayne, IN 46835\n(260) 417 7668\nPrivacy: https://revivefw.com/privacy`,
    html: header + `
<tr><td style="padding:34px 32px 26px;"><p style="margin:0 0 14px;color:#a42a16;font-size:11px;font-weight:bold;letter-spacing:2px;">${finalDay ? 'YOUR FINAL DAY' : 'YOUR NEXT STEP'}</p>
<h1 style="font-size:38px;line-height:1.12;letter-spacing:-1px;margin:0;color:#17120f;">${finalDay ? 'Your pass<br><span style="color:#b62b16;">ends today.</span>' : 'Make your<br><span style="color:#b62b16;">next step count.</span>'}</h1>
<p style="font-size:17px;line-height:1.7;margin:22px 0 0;">${intro}</p></td></tr>
<tr><td style="padding:0 32px 26px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:#0b0807;border-left:4px solid #ff3819;padding:24px;color:#f5f0e7;">
<h2 style="font-size:24px;line-height:1.3;margin:0 0 22px;">Your joining bonus.</h2>
<p style="font-size:17px;margin:0 0 6px;font-weight:bold;">Essential or Plus</p><p style="font-size:16px;line-height:1.7;color:#d6cbbf;margin:0 0 22px;">1 free PT session with Kings Nutrition.</p>
<p style="font-size:17px;margin:0 0 6px;font-weight:bold;">Elite</p><p style="font-size:16px;line-height:1.7;color:#d6cbbf;margin:0;">2 free PT sessions with Kings Nutrition in total.</p>
</td></tr></table></td></tr>
<tr><td style="padding:0 32px 26px;"><p style="font-size:16px;line-height:1.7;margin:0;"><strong>Your pass and joining bonus end:</strong><br>${end}.</p>
<p style="font-size:15px;line-height:1.7;margin:18px 0 0;">${terms}</p></td></tr>
<tr><td style="padding:0 32px 30px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#bd2e18" style="background:#bd2e18;"><a href="${MEMBERSHIPS}" style="display:inline-block;padding:18px 26px;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;letter-spacing:1px;">VIEW MEMBERSHIPS &rarr;</a></td></tr></table>
<p style="font-size:15px;line-height:1.7;margin:24px 0 0;">Show this email at the front desk when you join. Membership pricing stays the same. The joining bonus ends with your pass.</p>
<p style="font-size:16px;line-height:1.7;margin:24px 0 0;">See you at REVIVE,<br><strong>The REVIVE Team</strong></p></td></tr>
<tr><td style="padding:24px 32px;border-top:1px solid #d4c9ba;"><p style="font-size:13px;line-height:1.7;color:#605448;margin:0;">3233 St Joe Center Rd<br>Fort Wayne, IN 46835<br><a href="tel:+12604177668" style="color:#211a15;">(260) 417 7668</a></p></td></tr>
` + footer };
}
module.exports = { ptOfferEmail };
