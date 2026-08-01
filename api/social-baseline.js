// POST /api/social-baseline — password-gated. Serves the static social-media
// baseline dataset (pulled Aug 1 2026, opening day) for the Reports dashboard.
// Split point: Jun 16 2026 6:57pm — first post under current management.
// Before: May 2–Jun 15 (45d, prior mgmt) · After: Jun 16–Jul 30 (46d).
// Primary source (headline + posts): Meta Business Suite post-level table
// (FB+IG combined) — per-platform sources are NOT summable with it.
const BASELINE = {
  meta: {
    pullDate: '2026-08-01',
    splitPoint: '2026-06-16T18:57:00 (PT)',
    beforeWindow: 'May 2 – Jun 15, 2026 · 45 days · prior management',
    afterWindow: 'Jun 16 – Jul 30, 2026 · 46 days · Sweet Dreams',
    primarySource: 'Meta Business Suite post-level table (Facebook + Instagram combined)',
    caveats: [
      'All numbers are pre-opening (doors opened Aug 1).',
      'Sources have different scopes — Meta combined, FB-only, IG-only, and TikTok numbers must never be mixed or summed.',
      'Reach is only comparable on feed posts (stories in the before window report no reach).',
      'Paid-spend data was not pulled — verify no ads ran before treating this as pure organic.',
      'Business Suite timestamps are Pacific Time (Fort Wayne is +3h).',
    ],
  },

  headline: {
    columns: ['Metric', 'Before (45d)', 'After (46d)', 'Change'],
    rows: [
      ['Content pieces published', '23', '29', '+26.1%'],
      ['Views', '6,198', '24,203', '+290.5%'],
      ['Interactions', '113', '583', '+415.9%'],
      ['Likes & reactions', '94', '437', '+364.9%'],
      ['Comments', '3', '8', '+166.7%'],
      ['Shares', '13', '114', '+776.9%'],
      ['Saves', '1', '9', '+800.0%'],
      ['Link clicks', '2', '12', '+500.0%'],
      ['Follows from content', '6', '89', '+1,383.3%'],
      ['Reels published', '1', '8', '+700.0%'],
    ],
  },

  perDay: {
    columns: ['Per day', 'Before', 'After', 'Change'],
    rows: [
      ['Views', '137.7', '526.2', '+282.0%'],
      ['Interactions', '2.51', '12.67', '+404.8%'],
      ['Shares', '0.29', '2.48', '+755.2%'],
      ['Follows', '0.13', '1.93', '+1,384.6%'],
      ['Pieces published', '0.51', '0.63', '+23.5%'],
    ],
  },

  whatChanged: {
    columns: ['Signal', 'Before', 'After'],
    rows: [
      ["Reels' share of all views", '26.9%', '82.0%'],
      ['Views per feed post', '975', '2,325'],
      ['Views per piece (all formats)', '270', '835'],
      ['Interactions per 100 views', '1.82', '2.41'],
      ['Shares per 1,000 views', '2.10', '4.71'],
      ['Follows per 1,000 views', '0.97', '3.68'],
      ['Feed-post reach (5 vs 9 posts)', '414', '5,191'],
      ['Reach per feed post', '82.8', '576.8'],
      ['FB link posts (share of FB views)', '54.0%', '0% — eliminated'],
    ],
  },

  topPosts: {
    after: [
      ['Jun 16', 'Reel', '4,715', '125', '35', '39', '"This is REVIVE… Fort Wayne’s first true wellness sanctuary"'],
      ['Jun 18', 'Reel', '3,538', '88', '21', '14', '"100 spots. Lifetime pricing. One chance."'],
      ['Jun 24', 'Reel', '2,958', '80', '19', '13', '"Every other gym in Fort Wayne stops at the workout. We didn’t."'],
      ['Jun 27', 'Reel', '2,250', '40', '3', '6', '"Founders Presale goes live July 1st"'],
      ['Jul 1', 'Reel', '2,242', '59', '13', '8', '"It’s live. The REVIVE Founders Presale is officially open."'],
    ],
    before: [
      ['Jun 2', 'Reel', '1,667', '22', '0', '1', '(untitled reel)'],
      ['Jun 1', 'Photo', '1,265', '14', '3', '4', '—'],
      ['Jun 5', 'Photo', '771', '16', '2', '0', '"Revive Fitness & Recovery is in Fort Wayne, IN."'],
      ['Jun 5', 'Photo', '760', '12', '1', '0', '"Revive Fitness & Recovery is in Fort Wayne, IN."'],
      ['Jun 5', 'Photo', '414', '8', '2', '0', '—'],
    ],
    columns: ['Date', 'Format', 'Views', 'Inter.', 'Shares', 'Follows', 'Content'],
  },

  platforms: {
    facebook: {
      title: 'Facebook (standalone)',
      rows: [
        ['Views', '−9.1% — deliberate: low-value link posts (54% of prior reach) were eliminated'],
        ['3-second views', '+1,728% (60 → 1,097)'],
        ['Interactions', '+98.6% (72 → 143)'],
        ['Net follows', '+225% (+4 → +13) · unfollows −80%'],
        ['Non-follower share of interactions', '9.7% → 32.9%'],
        ['Page visits', '−22.1% — discovery moved from Page (47%→16%) into Reels (1%→33%); check site referrals'],
      ],
    },
    instagram: {
      title: 'Instagram (native, 90d context)',
      rows: [
        ['Views', '28,332'],
        ['Accounts reached', '6,026'],
        ['Profile visits', '1,344'],
        ['External link taps', '259 → 19.3% tap-through from profile visits (best site-comparable number)'],
        ['Followers', '264'],
        ['Views mix', 'Reels 64.5% · Posts 18.0% · Stories 17.5%'],
      ],
    },
    tiktok: {
      title: 'TikTok (new channel — after only)',
      rows: [
        ['Video views (60d)', '1,700'],
        ['Followers (all time)', '7 — 0.4% conversion'],
        ['Verdict', 'Launched but not working yet: algorithm classifies content as national sports highlights (ESPN/House of Highlights affinity), not local fitness'],
        ['Brand search', 'Confused — "revival fitness recovery", "revive city fitness" queries; cross-check Search Console'],
      ],
    },
  },

  timing: {
    columns: ['Sub-period', 'Days', 'Views', 'Views/day', 'Reels', 'Follows'],
    rows: [
      ['Jun 16 – Jun 30', '15', '16,382', '1,092', '5', '75'],
      ['Jul 1 – Jul 30', '30', '7,821', '261', '3', '14'],
    ],
    note: '67.7% of after-period views landed BEFORE the Jul 1 presale went live. Reel cadence dropped 3.3x in July and follows fell 75 → 14 — the formula worked, it just stopped being applied. The Jul 27 drone Reel (1,839 views after three quiet weeks) proves the audience didn’t decay; publishing did.',
  },

  findings: [
    'Reels are the entire growth mechanism — 8 Reels drove 82% of all after-period views.',
    'Killing Facebook link posts was correct — FB interactions +98.6%, unfollows −80%.',
    'Quality per view improved, not just volume — follows per 1,000 views nearly 4x.',
    'Reel cadence is the single controllable lever — 5 Reels/15d → 75 follows; 3 Reels/30d → 14.',
    'Peak reach must land ON the offer — most attention arrived before there was anything to buy.',
    'Facebook now converts strangers — non-follower interactions went from a tenth to a third.',
    'FB page visits fell 22.1% — cross-check whether site referrals held (discovery moved into feed).',
    'TikTok is geo-mistargeted — views go to national sports scrollers, not Fort Wayne.',
    'Brand search is confused — misspelled/wrong-brand queries surfacing the account.',
    'Stories sustain, they don’t acquire — 20 stories ≈ 0 follows.',
  ],
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) { res.status(500).json({ error: 'Server not configured' }); return; }
  try {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
    body = body || {};
    const password = String(body.password || '');
    if (!password) { res.status(401).json({ error: 'Password required' }); return; }
    const auth = await fetch(`${SUPABASE_URL}/rest/v1/rpc/revive_check_admin`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: password }),
    });
    const authText = await auth.text();
    if (!auth.ok || authText.trim() !== 'true') { res.status(401).json({ error: 'Invalid password' }); return; }
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ok: true, baseline: BASELINE });
  } catch (e) {
    console.error('social-baseline error', e);
    res.status(500).json({ error: 'Unexpected error' });
  }
};
