const { passEmail } = require('./_pass-email');

function experienceEmail(email, feedbackUrl) {
  if (typeof feedbackUrl !== 'string' || !/^https:\/\/revivefw\.com\/pass-feedback#token=[A-Za-z0-9_.-]+$/.test(feedbackUrl)) throw new Error('A personal feedback link is required');
  const base = passEmail(email);
  // Reuse the pass template's tested responsive frame and brand header.
  const header = base.html.slice(0, base.html.indexOf('<tr><td style="padding:34px'));
  const footer = base.html.slice(base.html.indexOf('<tr><td style="background:#0b0807;padding:25px'))
    .replace('You received this confirmation because a free pass was claimed using this email. If that wasn’t you, ignore it or contact us. This email does not start a trial or enroll you in a membership.', 'This is a check in about your first visit to REVIVE. Your personal feedback link is private and available for 30 days after your first visit. Please do not share it.');
  return {
    ...base,
    subject: 'How was your first visit to REVIVE?',
    text: 'REVIVE FITNESS & RECOVERY\n\nHow was your first visit?\n\nWe hope you enjoyed getting to know REVIVE. What did you try, and how did it feel?\n\nWhether you spent time on the gym floor, tried recovery, or explored a little of both, we would love to hear what stood out.\n\nWas anything confusing? Is there something you would like help trying next time?\n\nShare a quick rating and anything you would like us to know. Your name and email are already filled in. No email reply needed.\n\nTell us about your visit: ' + feedbackUrl + '\n\nYour link is private and available for 30 days after your first visit. Please do not share it.\n\nSee you again soon,\nThe REVIVE Team\n\n3233 St Joe Center Rd, Fort Wayne, IN 46835\nQuestions: info@revivefw.com | (260) 417 7668\nPrivacy: https://revivefw.com/privacy',
    html: header.replace('<title>Your REVIVE Pass</title>', '<title>How was your first visit?</title>')
      .replace('Your pass is ready. Your seven days start at front desk check in, not today.', 'Tell us what you tried and how it felt. Your personal feedback form is ready.') + `
<tr><td style="padding:34px 32px 26px;"><p style="margin:0 0 14px;color:#a42a16;font-size:11px;font-weight:bold;letter-spacing:2px;">YOUR FIRST VISIT</p>
<h1 style="font-size:38px;line-height:1.12;letter-spacing:-1px;margin:0;color:#17120f;">How did<br><span style="color:#b62b16;">it feel?</span></h1>
<p style="font-size:17px;line-height:1.7;margin:22px 0 0;">We hope you enjoyed getting to know REVIVE. What did you try, and how did it feel?</p>
<p style="font-size:16px;line-height:1.7;margin:18px 0 0;">Whether you spent time on the gym floor, tried recovery, or explored a little of both, we would love to hear what stood out.</p></td></tr>
<tr><td style="padding:0 32px 26px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:#0b0807;border-left:4px solid #ff3819;padding:24px;color:#f5f0e7;">
<h2 style="font-size:22px;line-height:1.3;margin:0 0 12px;">What can we help with?</h2><p style="font-size:16px;line-height:1.7;color:#d6cbbf;margin:0;">Was anything confusing? Is there something you would like help trying next time?</p></td></tr></table></td></tr>
<tr><td style="padding:0 32px 30px;"><p style="font-size:16px;line-height:1.7;margin:0 0 22px;">Share a quick rating and anything you would like us to know. Your name and email are already filled in. No email reply needed.</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#bd2e18" style="background:#bd2e18;"><a href="${feedbackUrl}" style="display:inline-block;padding:18px 26px;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;letter-spacing:1px;">TELL US ABOUT YOUR VISIT &rarr;</a></td></tr></table>
<p style="font-size:16px;line-height:1.7;margin:28px 0 0;">See you again soon,<br><strong>The REVIVE Team</strong></p></td></tr>
<tr><td style="padding:24px 32px;border-top:1px solid #d4c9ba;"><p style="font-size:13px;line-height:1.7;color:#605448;margin:0;">3233 St Joe Center Rd<br>Fort Wayne, IN 46835<br><a href="tel:+12604177668" style="color:#211a15;">(260) 417 7668</a></p></td></tr>
` + footer
  };
}

module.exports = { experienceEmail };
