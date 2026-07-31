// POST /api/send-campaign — password-gated bulk email sender (operator console only).
//
// Sends the "Founding 100 is live" campaign to the founders list. Auth reuses the
// same SECURITY DEFINER RPC as /api/inquiries (revive_list_inquiries) — a valid
// password both authorizes the request AND returns the recipient list in one call.
// No service-role key is used.
//
// Modes (body.mode):
//   'preview' — no send. Returns recipient count, a sample, and the rendered HTML.
//   'test'    — sends ONE email to body.testEmail.
//   'send'    — sends to every recipient via Resend's batch API (chunks of 100).
//
// Every send is multipart (html + plaintext) and carries a List-Unsubscribe header
// for deliverability. Store badges in the EMAIL are self-hosted PNGs (email clients
// strip SVG); the website keeps the SVGs.
//
// Copy lives in CONTENT below (produced by the copy-workshop workflow). {first} is
// replaced per recipient; unmatched recipients gracefully become "there".

const CONTENT = {
  "eyebrow": "FOUNDING 100 · OPEN NOW",
  "headlineTop": "Only 100 will",
  "headlineAccent": "lock this rate for life.",
  "subject": "It's live — thank you for being early",
  "preheader": "The Founding 100 is live — here's how to claim your founder spot.",
  "fromName": "REVIVE Fitness & Recovery",
  "replyTo": "info@revivefw.com",
  "greeting": "Good Afternoon!",
  "bodyParagraphs": [
    "You're one of the people who believed in REVIVE before the doors even opened — so you're hearing this first: the <strong>Founding 100 is live</strong>.",
    "Here's the deal. The first hundred members lock in founder pricing <em>for life</em> — the lowest rate REVIVE will ever offer. It's a real cap of 100, not a countdown clock. When those spots are claimed, the founder rate is gone for good.",
    "Founders save <strong>$10 to $30 a month</strong>, every month, on the same 12,000 sq ft of serious strength equipment, a true 36–40°F cold plunge, sauna, and red light. <em>The rate is what changes. The place doesn't.</em>",
    "Open the REVIVE app, pick the tier that fits how you train, and you're in. We open August 1 — and we'd love your name on the founders wall when we do."
  ],
  "perksLabel": "WHAT A FOUNDER SPOT LOCKS IN",
  "perks": [
    "Founder pricing locked for life",
    "Your name on the founders wall — permanent",
    "First in line for opening week, Aug 1",
    "Founder-only quarterly events",
    "One of only 100 — then the list closes"
  ],
  "ctaLine": "Download the REVIVE app to claim your spot — or see the full breakdown at revivefw.com/100.",
  "signoff": "See you on the floor,<br>REVIVE Fitness &amp; Recovery",
  "footerNote": "You're receiving this because you joined the REVIVE founders list. Not interested? Unsubscribe.",
  "pricingSnapshot": [
    {
      "tier": "Recovery Only",
      "price": "$99/mo",
      "note": "locked for life"
    },
    {
      "tier": "Basic",
      "price": "$79/mo",
      "note": "vs $89 standard"
    },
    {
      "tier": "Plus",
      "price": "$109/mo",
      "note": "vs $139 standard"
    },
    {
      "tier": "Elite",
      "price": "$139/mo",
      "note": "vs $169 standard"
    }
  ],
  "plaintext": "Good Afternoon!\n\nYou're one of the people who believed in REVIVE before the doors even opened — so you're hearing this first: the Founding 100 is live.\n\nHere's the deal. The first hundred members lock in founder pricing for life — the lowest rate REVIVE will ever offer. It's a real cap of 100, not a countdown clock. When those spots are claimed, the founder rate is gone for good.\n\nFounders save $10 to $30 a month, every month, on the same 12,000 sq ft of serious strength equipment, a true 36-40F cold plunge, sauna, and red light. The rate is what changes. The place doesn't.\n\nHOW TO CLAIM YOUR SPOT\n1. Download the Revive Fitness & Recovery app.\n2. Sign up in the app.\n3. Select the BUY tab at the bottom.\n4. Select your membership.\n5. Sign & complete checkout.\n\nApp Store: https://apps.apple.com/us/app/revive-fitness-and-recovery/id6768313510\nGoogle Play: https://play.google.com/store/apps/details?id=com.fitnessmobileapps.revivefitnessandrecovery45023\nFull breakdown: https://revivefw.com/100\n\nFOUNDER PRICING (locked for life)\n- Recovery Only: $99/mo\n- Basic: $79/mo (vs $89 standard)\n- Plus: $109/mo (vs $139 standard)\n- Elite: $139/mo (vs $169 standard)\n\nWHAT A FOUNDER SPOT LOCKS IN\n- Founder pricing locked for life\n- Your name on the founders wall — permanent\n- First in line for opening week, Aug 1\n- Founder-only quarterly events\n- One of only 100 — then the list closes\n\nWe open August 1. See you on the floor,\nREVIVE Fitness & Recovery\n3233 St Joe Center Rd, Fort Wayne, IN\n\nYou're receiving this because you joined the REVIVE founders list. Not interested? Unsubscribe: {unsubscribe_url}",
  "howToLabel": "HOW TO CLAIM YOUR SPOT",
  "howToSteps": [
    "Download the Revive Fitness &amp; Recovery app.",
    "Sign up in the app.",
    "Select the BUY tab at the bottom.",
    "Select your membership.",
    "Sign &amp; complete checkout."
  ]
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) { res.status(500).json({ error: 'Server not configured (Supabase)' }); return; }

  try {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
    body = body || {};

    const password = String(body.password || '');
    if (!password) { res.status(401).json({ error: 'Password required' }); return; }

    const mode = ['preview', 'test', 'send'].includes(body.mode) ? body.mode : 'preview';
    const audience = ['waitlist', 'giveaway', 'all'].includes(body.audience) ? body.audience : 'waitlist';

    // --- Auth + fetch recipients (single call, password validated inside the RPC) ---
    const rpc = await fetch(`${SUPABASE_URL}/rest/v1/rpc/revive_list_inquiries`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: password }),
    });
    const rpcText = await rpc.text();
    if (rpc.status === 401 || rpc.status === 403 || (!rpc.ok && rpcText.toLowerCase().includes('unauthorized'))) {
      res.status(401).json({ error: 'Invalid password' }); return;
    }
    if (!rpc.ok) { console.error('rpc list failed', rpc.status, rpcText); res.status(502).json({ error: 'Could not load recipients' }); return; }

    let inquiries = [];
    try { inquiries = JSON.parse(rpcText) || []; } catch (_) { inquiries = []; }

    // --- Build the recipient set: filter by audience, valid email, dedupe by email ---
    const isEmail = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
    const seen = new Set();
    const recipients = [];
    for (const row of inquiries) {
      if (audience !== 'all' && row.type !== audience) continue;
      const email = String(row.email || '').trim().toLowerCase();
      if (!isEmail(email) || seen.has(email)) continue;
      seen.add(email);
      recipients.push({ email, firstName: firstNameOf(row) });
    }

    // --- Campaign config ---
    const base = 'https://' + String(req.headers['x-forwarded-host'] || req.headers.host || 'revivefw.com').replace(/^https?:\/\//, '');
    const from = process.env.CAMPAIGN_FROM || `${CONTENT.fromName} <info@revivefw.com>`;
    const replyTo = process.env.CAMPAIGN_REPLY_TO || CONTENT.replyTo || 'info@revivefw.com';
    const subject = (String(body.subject || '').trim() || CONTENT.subject).slice(0, 200);
    const headers = { 'List-Unsubscribe': '<mailto:info@revivefw.com?subject=Unsubscribe>' };

    // --- PREVIEW: no send. Return count + sample + rendered HTML for the first recipient. ---
    if (mode === 'preview') {
      const sampleName = recipients.length ? recipients[0].firstName : 'there';
      res.status(200).json({
        ok: true, mode, audience, count: recipients.length,
        sample: recipients.slice(0, 12).map((r) => ({ email: r.email, firstName: r.firstName })),
        subject, from,
        html: renderEmail({ firstName: sampleName, base }),
      });
      return;
    }

    if (!RESEND_API_KEY) { res.status(500).json({ error: 'Email not configured (RESEND_API_KEY missing)' }); return; }

    // --- TEST: send exactly one email to the operator-supplied address. ---
    if (mode === 'test') {
      const testEmail = String(body.testEmail || '').trim().toLowerCase();
      if (!isEmail(testEmail)) { res.status(400).json({ error: 'A valid test email is required' }); return; }
      const testName = firstNameOf({ first_name: body.testFirstName });
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from, to: [testEmail], reply_to: replyTo, subject, headers,
          html: renderEmail({ firstName: testName, base }),
          text: renderText({ firstName: testName }),
        }),
      });
      const t = await resp.text();
      if (!resp.ok) { console.error('resend test failed', resp.status, t); res.status(502).json({ error: 'Test send failed: ' + t.slice(0, 300) }); return; }
      res.status(200).json({ ok: true, mode, sent: 1, to: testEmail });
      return;
    }

    // --- SEND: batch to everyone. Resend /emails/batch accepts up to 100 per call. ---
    if (!recipients.length) { res.status(400).json({ error: 'No valid recipients to send to' }); return; }

    let sent = 0;
    const errors = [];
    const chunks = chunk(recipients, 100);
    for (let ci = 0; ci < chunks.length; ci++) {
      const group = chunks[ci];
      const payload = group.map((r) => ({
        from, to: [r.email], reply_to: replyTo, subject, headers,
        html: renderEmail({ firstName: r.firstName, base }),
        text: renderText({ firstName: r.firstName }),
      }));
      try {
        const resp = await fetch('https://api.resend.com/emails/batch', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const t = await resp.text();
        if (!resp.ok) { errors.push(`batch ${ci + 1}: ${resp.status} ${t.slice(0, 200)}`); }
        else {
          let data = {}; try { data = JSON.parse(t); } catch (_) {}
          sent += Array.isArray(data.data) ? data.data.length : group.length;
        }
      } catch (e) {
        errors.push(`batch ${ci + 1}: ${String(e && e.message || e)}`);
      }
      if (ci < chunks.length - 1) { await sleep(600); } // pace under Resend's rate limit
    }

    res.status(200).json({ ok: errors.length === 0, mode, total: recipients.length, sent, failed: recipients.length - sent, errors });
  } catch (e) {
    console.error('send-campaign error', e);
    res.status(500).json({ error: 'Unexpected error. Please try again.' });
  }
};

// --- helpers ---------------------------------------------------------------

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function chunk(arr, n) { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; }

// Derive a friendly first name. Quick email-only signups may store the email
// local-part as first_name; trim at the first separator and capitalize. Falls
// back to "there" when nothing usable — never guesses a name from an email.
function firstNameOf(row) {
  let raw = String((row && row.first_name) || '').trim();
  if (!raw) return 'there';
  const token = raw.split(/[.\s_@-]+/)[0];
  if (!token || !/^[A-Za-z]/.test(token)) return 'there';
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function personalize(t, name) { return String(t == null ? '' : t).split('{first}').join(name); }

// Branded, email-client-safe HTML (table layout, inline styles, dark theme).
function renderEmail({ firstName, base }) {
  const APPLE_URL = 'https://apps.apple.com/us/app/revive-fitness-and-recovery/id6768313510';
  const GPLAY_URL = 'https://play.google.com/store/apps/details?id=com.fitnessmobileapps.revivefitnessandrecovery45023';
  const APPLE_BADGE = `${base}/assets/badge-appstore-email.png`;
  const GPLAY_BADGE = `${base}/assets/badge-googleplay-email.png`;
  const C = CONTENT;
  const name = esc(firstName || 'there');

  const paras = C.bodyParagraphs.map((p) => `<p style="margin:0 0 16px 0;">${personalize(p, name)}</p>`).join('\n        ');
  const perks = C.perks.map((pk) => `<tr><td style="padding:5px 0;"><span style="color:#e6b33d;">—</span>&nbsp; ${pk}</td></tr>`).join('\n              ');
  const ctaHtml = personalize(C.ctaLine, name).replace('revivefw.com/100', `<a href="${base}/100" target="_blank" style="color:#e6b33d;text-decoration:underline;">revivefw.com/100</a>`);
  const steps = (C.howToSteps && C.howToSteps.length) ? `
      <tr><td style="padding:26px 40px 0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #262220;">
          <tr><td style="padding:22px 0 0 0;font-family:Arial,Helvetica,sans-serif;">
            <div style="font-size:11px;font-weight:700;letter-spacing:2px;color:#ff5a3c;">${esc(C.howToLabel || 'HOW TO CLAIM YOUR SPOT')}</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;font-size:15px;line-height:1.5;color:#c9c0b8;">
              ${C.howToSteps.map((s, i) => `<tr><td width="26" valign="top" style="padding:5px 0;color:#e6b33d;font-weight:700;">${i + 1}.</td><td style="padding:5px 0;">${s}</td></tr>`).join('\n              ')}
            </table>
          </td></tr>
        </table>
      </td></tr>` : '';
  const pricing = (C.pricingSnapshot && C.pricingSnapshot.length) ? `
      <tr><td style="padding:26px 40px 0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #262220;">
          <tr><td style="padding:20px 0 0 0;font-family:Arial,Helvetica,sans-serif;">
            <div style="font-size:11px;font-weight:700;letter-spacing:2px;color:#ff5a3c;">FOUNDER PRICING · LOCKED FOR LIFE</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;font-size:15px;color:#c9c0b8;">
              ${C.pricingSnapshot.map((t) => `<tr><td style="padding:6px 0;color:#f4efe6;">${esc(t.tier)}</td><td align="right" style="padding:6px 0;"><span style="color:#e6b33d;font-weight:700;">${esc(t.price)}</span>${t.note ? ` <span style="color:#6f665f;font-size:12px;">${esc(t.note)}</span>` : ''}</td></tr>`).join('\n              ')}
            </table>
          </td></tr>
        </table>
      </td></tr>` : '';
  const footerHtml = esc(C.footerNote).replace('Unsubscribe', '<a href="mailto:info@revivefw.com?subject=Unsubscribe" style="color:#6f665f;text-decoration:underline;">Unsubscribe</a>');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${esc(C.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#0b0807;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#0b0807;">${esc(personalize(C.preheader, name))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0b0807;">
  <tr><td align="center" style="padding:28px 14px 40px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background:#121110;border:1px solid #262220;border-radius:16px;overflow:hidden;">

      <!-- Header -->
      <tr><td style="padding:34px 40px 0 40px;">
        <div style="font-family:Arial,Helvetica,sans-serif;font-weight:800;font-size:30px;letter-spacing:6px;color:#f4efe6;line-height:1;">REVIVE<span style="color:#e6b33d;">.</span></div>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:4px;color:#8a807a;margin-top:8px;">FITNESS &amp; RECOVERY &nbsp;·&nbsp; FORT WAYNE</div>
      </td></tr>

      <!-- Eyebrow -->
      <tr><td style="padding:26px 40px 0 40px;">
        <span style="display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:3px;color:#ff5a3c;border:1px solid rgba(255,90,60,0.4);border-radius:100px;padding:6px 12px;">● ${esc(C.eyebrow)}</span>
      </td></tr>

      <!-- Headline -->
      <tr><td style="padding:16px 40px 0 40px;">
        <h1 style="margin:0;font-family:'Arial Black',Arial,Helvetica,sans-serif;font-weight:800;font-size:40px;line-height:1.06;color:#f4efe6;">${esc(C.headlineTop)}<br><span style="color:#e6b33d;">${esc(C.headlineAccent)}</span></h1>
      </td></tr>

      <!-- Body copy -->
      <tr><td style="padding:22px 40px 0 40px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.65;color:#c9c0b8;">
        <p style="margin:0 0 16px 0;">${personalize(C.greeting, name)}</p>
        ${paras}
        <p style="margin:18px 0 0 0;color:#c9c0b8;">${C.signoff}</p>
      </td></tr>

      <!-- App badges (PNG for email compatibility) -->
      <tr><td align="center" style="padding:28px 40px 4px 40px;">
        <a href="${APPLE_URL}" target="_blank" style="text-decoration:none;display:inline-block;margin:0 5px 10px 5px;"><img src="${APPLE_BADGE}" width="162" height="48" alt="Download on the App Store" style="display:inline-block;width:162px;height:48px;border:0;outline:none;"></a>
        <a href="${GPLAY_URL}" target="_blank" style="text-decoration:none;display:inline-block;margin:0 5px 10px 5px;"><img src="${GPLAY_BADGE}" width="162" height="48" alt="Get it on Google Play" style="display:inline-block;width:162px;height:48px;border:0;outline:none;"></a>
      </td></tr>

      <!-- CTA caption -->
      <tr><td align="center" style="padding:2px 40px 6px 40px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#8a807a;">
        ${ctaHtml}
      </td></tr>
${steps}
${pricing}
      <!-- Perks -->
      <tr><td style="padding:26px 40px 0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #262220;">
          <tr><td style="padding:22px 0 0 0;font-family:Arial,Helvetica,sans-serif;">
            <div style="font-size:11px;font-weight:700;letter-spacing:2px;color:#ff5a3c;">${esc(C.perksLabel)}</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;font-size:15px;line-height:1.5;color:#c9c0b8;">
              ${perks}
            </table>
          </td></tr>
        </table>
      </td></tr>

      <!-- Footer -->
      <tr><td style="padding:30px 40px 34px 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #262220;">
          <tr><td style="padding:20px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#6f665f;">
            <strong style="color:#8a807a;">REVIVE Fitness &amp; Recovery</strong><br>
            3233 St Joe Center Rd, Fort Wayne, IN 46835 &nbsp;·&nbsp; Doors open 08.01.2026<br>
            <a href="mailto:info@revivefw.com" style="color:#8a807a;text-decoration:underline;">info@revivefw.com</a> &nbsp;·&nbsp; <a href="https://instagram.com/revivefitnessfw" target="_blank" style="color:#8a807a;text-decoration:underline;">@revivefitnessfw</a>
            <p style="margin:14px 0 0 0;color:#544c46;">${footerHtml}</p>
          </td></tr>
        </table>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// Plaintext alternative (multipart) — better deliverability + works with images off.
function renderText({ firstName }) {
  const name = firstName || 'there';
  let t = personalize(CONTENT.plaintext, name);
  t = t.split('{unsubscribe_url}').join('reply to this email with "unsubscribe", or email info@revivefw.com');
  return t;
}

// Exposed for local preview/testing (unused by the Vercel handler).
module.exports.renderEmail = renderEmail;
module.exports.renderText = renderText;
module.exports.firstNameOf = firstNameOf;
