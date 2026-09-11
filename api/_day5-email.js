const { passEmail } = require('./_pass-email');
const MEMBERSHIPS = 'https://revivefw.com/pricing';

function day5Email(email) {
  const base = passEmail(email);
  const header = base.html.slice(0, base.html.indexOf('<tr><td style="padding:34px'))
    .replace('<title>Your REVIVE Pass</title>', '<title>Keep your momentum going</title>')
    .replace('Your pass is ready. Your seven days start at front desk check in, not today.', 'Find the REVIVE membership that fits your routine.');
  const footer = base.html.slice(base.html.indexOf('<tr><td style="background:#0b0807;padding:25px'))
    .replace('You received this confirmation because a free pass was claimed using this email. If that wasn’t you, ignore it or contact us. This email does not start a trial or enroll you in a membership.', 'You received this email as part of your REVIVE free pass experience. Your pass does not automatically become a paid membership.');
  return {
    ...base,
    subject: 'Keep your momentum going | REVIVE',
    text: `REVIVE FITNESS & RECOVERY\n\nKeep your momentum going.\n\nYou are a few days into your REVIVE pass. If you are enjoying the space, now is a great time to explore what comes next.\n\nFind your fit.\nEssential: Your home for strength, cardio, and the performance turf.\nPlus: Training and recovery together, with 6 recovery sessions each month.\nElite: Training with unlimited recovery sessions and priority booking.\n\nCompare memberships: ${MEMBERSHIPS}\n\nKeep enjoying your pass. There is no automatic enrollment and no pressure to decide today. When you are ready, ask the front desk about joining.\n\nSee you on the floor,\nThe REVIVE Team\n\n3233 St Joe Center Rd, Fort Wayne, IN 46835\n(260) 417 7668\nPrivacy: https://revivefw.com/privacy`,
    html: header + `
<tr><td style="padding:34px 32px 26px;"><p style="margin:0 0 14px;color:#a42a16;font-size:11px;font-weight:bold;letter-spacing:2px;">MAKE IT YOUR ROUTINE</p>
<h1 style="font-size:38px;line-height:1.12;letter-spacing:-1px;margin:0;color:#17120f;">Keep your<br><span style="color:#b62b16;">momentum going.</span></h1>
<p style="font-size:17px;line-height:1.7;margin:22px 0 0;">You are a few days into your REVIVE pass. If you are enjoying the space, now is a great time to explore what comes next.</p></td></tr>
<tr><td style="padding:0 32px 26px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:#0b0807;border-left:4px solid #ff3819;padding:24px;color:#f5f0e7;">
<h2 style="font-size:24px;line-height:1.3;margin:0 0 22px;">Find your fit.</h2>
<p style="font-size:17px;margin:0 0 6px;font-weight:bold;">Essential</p><p style="font-size:15px;line-height:1.7;color:#d6cbbf;margin:0 0 22px;">Your home for strength, cardio, and the performance turf.</p>
<p style="font-size:17px;margin:0 0 6px;font-weight:bold;">Plus</p><p style="font-size:15px;line-height:1.7;color:#d6cbbf;margin:0 0 22px;">Training and recovery together, with 6 recovery sessions each month.</p>
<p style="font-size:17px;margin:0 0 6px;font-weight:bold;">Elite</p><p style="font-size:15px;line-height:1.7;color:#d6cbbf;margin:0;">Training with unlimited recovery sessions and priority booking.</p>
</td></tr></table></td></tr>
<tr><td style="padding:0 32px 30px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#bd2e18" style="background:#bd2e18;"><a href="${MEMBERSHIPS}" style="display:inline-block;padding:18px 26px;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;letter-spacing:1px;">EXPLORE MEMBERSHIPS &rarr;</a></td></tr></table>
<p style="font-size:16px;line-height:1.7;margin:24px 0 0;">Keep enjoying your pass. There is no automatic enrollment and no pressure to decide today. When you are ready, ask the front desk about joining.</p>
<p style="font-size:16px;line-height:1.7;margin:24px 0 0;">See you on the floor,<br><strong>The REVIVE Team</strong></p></td></tr>
<tr><td style="padding:24px 32px;border-top:1px solid #d4c9ba;"><p style="font-size:13px;line-height:1.7;color:#605448;margin:0;">3233 St Joe Center Rd<br>Fort Wayne, IN 46835<br><a href="tel:+12604177668" style="color:#211a15;">(260) 417 7668</a></p></td></tr>
` + footer
  };
}
module.exports = { day5Email };
