const { passEmail } = require('./_pass-email');
const { deadline } = require('../scripts/pass-schedule');
const MEMBERSHIPS = 'https://revivefw.com/pricing';

// One approved offer, three moments. Day 13 reopens the same Kings Nutrition
// bonus for guests who did not join, until closing that day.
const COPY = {
  day5: {
    subject: 'Your next step includes a free PT session | REVIVE',
    intro: 'You have had time to experience REVIVE. Now take your next step with personal guidance. Join before your free pass ends and get a free personal training session with Kings Nutrition.',
    heading: 'Make your next step count.', eyebrow: 'YOUR NEXT STEP',
    h1: 'Make your<br><span style="color:#b62b16;">next step count.</span>',
    preheader: 'Join before your pass ends. Get 1 free PT session, or 2 with Elite.',
    endLabel: 'Your pass and joining bonus end', until: 'before your pass ends',
    closing: 'The joining bonus ends with your pass.', end: 'expiresAt',
  },
  day7: {
    subject: 'Last day to join with your free PT session | REVIVE',
    intro: 'Your free pass ends at closing today. Join before it ends and take your next step with a free personal training session with Kings Nutrition.',
    heading: 'Your pass ends today.', eyebrow: 'YOUR FINAL DAY',
    h1: 'Your pass<br><span style="color:#b62b16;">ends today.</span>',
    preheader: 'Join before your pass ends. Get 1 free PT session, or 2 with Elite.',
    endLabel: 'Your pass and joining bonus end', until: 'before your pass ends',
    closing: 'The joining bonus ends with your pass.', end: 'expiresAt',
  },
  day13: {
    subject: 'One more chance at your free PT session | REVIVE',
    intro: 'Your free pass has ended, but we would still love to have you. For today only, join REVIVE and get the same bonus from your pass: a free personal training session with Kings Nutrition.',
    heading: 'Your PT bonus is back today.', eyebrow: 'ONE MORE CHANCE',
    h1: 'Still deciding?<br><span style="color:#b62b16;">Your PT bonus is back today.</span>',
    preheader: 'Join today and get 1 free PT session, or 2 with Elite.',
    endLabel: 'This offer ends', until: 'before this offer ends',
    closing: 'This bonus ends at closing today.', end: 'day13Close',
  },
};

function ptBonusEmail(email, activatedAt, variant) {
  const c = COPY[variant];
  if (!c) throw new Error('Unknown PT offer');
  const end = deadline(activatedAt, c.end);
  const base = passEmail(email);
  const header = base.html.slice(0, base.html.indexOf('<tr><td style="padding:34px'))
    .replace('<title>Your REVIVE Pass</title>', '<title>' + c.heading + '</title>')
    .replace('Claiming does not start or reset your seven days. Show your confirmation at check in.', c.preheader);
  const footer = base.html.slice(base.html.indexOf('<tr><td style="background:#0b0807;padding:25px'))
    .replace('You received this confirmation because a free pass was claimed using this email. If that wasn’t you, ignore it or contact us. This email does not start a trial or enroll you in a membership.', 'You received this email as part of your REVIVE free pass experience. Your pass does not automatically become a paid membership.');
  const terms = `Complete your membership enrollment at the front desk ${c.until} to qualify. Simply booking a visit does not reserve the bonus. Your PT session can take place afterward. Our team will help coordinate it with Kings Nutrition.`;
  const closing = `Show this email at the front desk when you join. Membership pricing stays the same. ${c.closing}`;
  return { ...base, subject: c.subject,
    text: `REVIVE FITNESS & RECOVERY\n\n${c.heading}\n\n${c.intro}\n\nYOUR JOINING BONUS\nEssential or Plus: 1 free PT session with Kings Nutrition.\nElite: 2 free PT sessions with Kings Nutrition in total.\n\n${c.endLabel}: ${end}.\n\n${terms}\n\nView memberships: ${MEMBERSHIPS}\n\n${closing}\n\nSee you at REVIVE,\nThe REVIVE Team\n\n3233 St Joe Center Rd, Fort Wayne, IN 46835\n(260) 417 7668\nPrivacy: https://revivefw.com/privacy`,
    html: header + `
<tr><td style="padding:34px 32px 26px;"><p style="margin:0 0 14px;color:#a42a16;font-size:11px;font-weight:bold;letter-spacing:2px;">${c.eyebrow}</p>
<h1 style="font-size:38px;line-height:1.12;letter-spacing:-1px;margin:0;color:#17120f;">${c.h1}</h1>
<p style="font-size:17px;line-height:1.7;margin:22px 0 0;">${c.intro}</p></td></tr>
<tr><td style="padding:0 32px 26px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:#0b0807;border-left:4px solid #ff3819;padding:24px;color:#f5f0e7;">
<h2 style="font-size:24px;line-height:1.3;margin:0 0 22px;">Your joining bonus.</h2>
<p style="font-size:17px;margin:0 0 6px;font-weight:bold;">Essential or Plus</p><p style="font-size:16px;line-height:1.7;color:#d6cbbf;margin:0 0 22px;">1 free PT session with Kings Nutrition.</p>
<p style="font-size:17px;margin:0 0 6px;font-weight:bold;">Elite</p><p style="font-size:16px;line-height:1.7;color:#d6cbbf;margin:0;">2 free PT sessions with Kings Nutrition in total.</p>
</td></tr></table></td></tr>
<tr><td style="padding:0 32px 26px;"><p style="font-size:16px;line-height:1.7;margin:0;"><strong>${c.endLabel}:</strong><br>${end}.</p>
<p style="font-size:15px;line-height:1.7;margin:18px 0 0;">${terms}</p></td></tr>
<tr><td style="padding:0 32px 30px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#bd2e18" style="background:#bd2e18;"><a href="${MEMBERSHIPS}" style="display:inline-block;padding:18px 26px;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;letter-spacing:1px;">VIEW MEMBERSHIPS &rarr;</a></td></tr></table>
<p style="font-size:15px;line-height:1.7;margin:24px 0 0;">${closing}</p>
<p style="font-size:16px;line-height:1.7;margin:24px 0 0;">See you at REVIVE,<br><strong>The REVIVE Team</strong></p></td></tr>
<tr><td style="padding:24px 32px;border-top:1px solid #d4c9ba;"><p style="font-size:13px;line-height:1.7;color:#605448;margin:0;">3233 St Joe Center Rd<br>Fort Wayne, IN 46835<br><a href="tel:+12604177668" style="color:#211a15;">(260) 417 7668</a></p></td></tr>
` + footer };
}
const ptOfferEmail = (email, activatedAt, finalDay) => ptBonusEmail(email, activatedAt, finalDay ? 'day7' : 'day5');
module.exports = { ptOfferEmail, ptBonusEmail };
