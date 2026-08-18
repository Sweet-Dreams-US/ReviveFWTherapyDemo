/* ==========================================================================
 * REVIVE — app-link guard. Fails (exit 1) if any member-facing app link points
 * anywhere other than the REVIVE app. Run before every deploy and in CI so a
 * generic-Mindbody app link (or any wrong store link) can never ship again.
 *
 *   node scripts/check-app-links.js
 *
 * THE ONLY correct app links (single source of truth):
 * ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const APP = {
  appleId: '6768313510',
  appleUrl: 'https://apps.apple.com/us/app/revive-fitness-and-recovery/id6768313510',
  googlePkg: 'com.fitnessmobileapps.revivefitnessandrecovery45023',
  googleUrl: 'https://play.google.com/store/apps/details?id=com.fitnessmobileapps.revivefitnessandrecovery45023',
};

// Files that reach members: the public site, the blog generator, and email code.
// Internal research docs (MINDBODY-INTEGRATION.md, PROPOSAL.md) are NOT scanned —
// they legitimately discuss Mindbody and never render to a user.
function collect() {
  const out = [];
  for (const f of fs.readdirSync(ROOT)) {
    if (f.endsWith('.html')) out.push(path.join(ROOT, f));
  }
  const blog = path.join(ROOT, 'blog');
  if (fs.existsSync(blog)) for (const f of fs.readdirSync(blog)) if (f.endsWith('.html')) out.push(path.join(blog, f));
  for (const f of ['scripts/build-blog.js', 'api/send-campaign.js', 'api/inquiry.js']) {
    const p = path.join(ROOT, f);
    if (fs.existsSync(p)) out.push(p);
  }
  return out;
}

const violations = [];
for (const file of collect()) {
  const s = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file);

  // 1. Every Apple app link must be the Revive app id.
  for (const m of s.matchAll(/apps\.apple\.com\/[^\s"'()<>]*\/id(\d+)/g)) {
    if (m[1] !== APP.appleId) violations.push(`${rel}: Apple app link to id${m[1]} (expected id${APP.appleId})`);
  }
  // 2. Every Google Play app link must be the Revive package.
  for (const m of s.matchAll(/play\.google\.com\/store\/apps\/details\?id=([a-zA-Z0-9._]+)/g)) {
    if (m[1] !== APP.googlePkg) violations.push(`${rel}: Google Play link to ${m[1]} (expected ${APP.googlePkg})`);
  }
  // 3. Hard-forbidden: the generic Mindbody consumer app / launch links.
  for (const re of [
    /com\.mindbodyonline\.connect/i,   // generic "Mindbody" Android app
    /id\s*38900\d{4}/,                  // generic Mindbody iOS app id family
    /mindbody\.io\/launch/i,
    /explore\.mindbodyonline\.com/i,
  ]) {
    if (re.test(s)) violations.push(`${rel}: forbidden generic-Mindbody app/launch link matched ${re}`);
  }
}

if (violations.length) {
  console.error('APP-LINK CHECK FAILED — wrong app link(s) found:\n  ' + violations.join('\n  '));
  console.error('\nThe only correct links are:\n  Apple:  ' + APP.appleUrl + '\n  Google: ' + APP.googleUrl);
  process.exit(1);
}
console.log('app-link check OK — every app link points to the REVIVE app (Apple id' + APP.appleId + ' / Google ' + APP.googlePkg + ').');
