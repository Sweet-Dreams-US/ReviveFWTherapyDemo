# Revive Fitness & Recovery — Website Proposal

**Prepared by:** Sweet Dreams Studios · Fort Wayne, IN
**Prepared for:** John M., Founder — Revive Fitness & Recovery
**Date:** April 2026

---

## The 30-Second Version

You came to us for a website. After looking at how you've set up Revive, we think the website conversation is actually a business conversation. Here's why:

> **Mindbody's marketplace takes 20% of every first-time customer who comes through their consumer app.** That's $26 on every $130 first-month membership. Across your 200 founders alone, that's potentially **$5,200 you don't have to give Mindbody** — if customers sign up on `revivefw.com` instead of Mindbody's marketplace.

So we're proposing two paths. **Foundation** is the marketing site you originally asked for. **Native** is a full custom-branded experience that uses Mindbody as a database underneath — every booking, every membership, every recovery slot lives in your Mindbody account, but customers never leave your site to interact with it. The 20% disappears. The brand experience stays clean. The data stays yours.

---

## The Two Problems This Proposal Solves

### Problem 1 — Customer acquisition is taxed
Every founder who finds Revive on the Mindbody consumer marketplace and signs up there pays **you 80%, Mindbody 20%**. The website you build is the only place that fee disappears.

### Problem 2 — Brand experience cracks at the handoff
With a standard Mindbody setup, members research Revive on `revivefw.com`, then click "Book Now" and get bounced to a Mindbody-hosted page that looks like every other gym's. That's the moment Revive becomes "another gym in Mindbody's app." Premium brands — Equinox, Othership, Continuum Club — never let that happen. Their members never see the back-end vendor.

We can fix both at once.

---

## TIER 1 — FOUNDATION

> *The informational site. Marketing-driven. Lead capture. No live integration.*
> **For:** Operators who want a beautiful brand presence and let Mindbody handle everything else.

### What's Included

**Brand & marketing site (already built and live in demo form):**
- Landing page with hero, mission, three pillars
- Founder story / About page
- Experience page — train / recover / belong breakdown with day timeline
- Pricing page — three tiers, comparison table, FAQ, founders/standard toggle
- Founders Waitlist page with form
- Active campaign page (currently the Wallen giveaway — repeatable for any future contest)
- 404 + general error states
- Member Portal "stub" (links out to Mindbody-hosted login)

**Brand system:**
- Custom design system (typography, color palette, motion language)
- Magazine-style editorial aesthetic that signals premium positioning
- Film-grain overlay, scroll reveals, marquees, animated counters, live countdown
- Mobile-responsive across every breakpoint
- Lighthouse 95+ performance

**Marketing infrastructure:**
- Founders waitlist form → email database
- Giveaway entry form → email database
- Email contact form → routed to John's inbox
- Basic Google Analytics 4 + Meta Pixel install
- SEO meta tags + Open Graph for clean social shares
- Sitemap.xml + robots.txt

**Hosting & deploy:**
- GitHub Pages (free) or Vercel (free tier) for hosting
- Custom domain configuration (`revivefw.com`)
- SSL certificate
- Quarterly content updates (up to 4hr/quarter included)

### What This Tier Does NOT Include
- Live class schedules (members go to Mindbody to see them)
- Class or appointment booking on the site (booking happens on Mindbody)
- Membership purchase on the site (handled by Mindbody)
- Real member portal (a stub link to Mindbody's portal only)
- Custom admin / operator dashboard (John uses Mindbody's admin)
- Webhook automation / real-time data
- Mindbody's 20% marketplace cut still applies to first-time customers found via Mindbody

### Investment

| Item | Investment |
|---|---|
| **One-time build** | $4,800 |
| **Monthly hosting + maintenance** | $200 / mo |
| **Quarterly content update (included)** | $0 |
| **Additional content updates** | $125 / hr |

**First-year total: $4,800 + $2,400 = $7,200**

### Timeline
- **Week 1–2:** Final brand polish, copy refinement, image curation
- **Week 3:** Launch on `revivefw.com` with redirects from current site
- **Ongoing:** Quarterly content refreshes, performance tuning

---

## TIER 2 — NATIVE  *(Recommended)*

> *Mindbody under the hood. Custom UX on top. Members never see the seam.*
> **For:** Operators who treat their website as their primary customer-acquisition asset and want operational data they can actually use.

Everything in Foundation, plus the items below.

### Member-Facing Capabilities

**Live class browsing & booking**
- Real class schedule pulled from Mindbody, updated automatically
- Filter by instructor, class type, time of day, intensity
- One-click booking with auto-fill from member profile
- Waitlist join + automatic promotion if spot opens
- Cancel / reschedule from the site
- "Book + add to calendar" (Google / Apple / Outlook)

**Recovery appointment booking**
- Real-time availability for cold plunge, sauna, infrared, red light, compression, private suite
- Sequenced booking ("Lift → Sauna → Plunge → Light" as a single flow)
- Recurring booking ("every Tuesday at 6 AM forever")
- 24/72hr booking windows enforced by tier (matches your Plus / Elite structure)

**Branded membership signup with payment**
- Full Stripe-style checkout on `revivefw.com` (not bounced to Mindbody)
- Real `addClient` + `purchaseContract` calls to Mindbody under the hood
- E-signature liability waiver inline (PDF stored in Mindbody)
- ID upload + photo capture
- Apple Pay / Google Pay support
- **This is the page that bypasses Mindbody's 20% marketplace fee**

**Member Portal**
- Branded login (OAuth via Mindbody's identity service)
- Dashboard: upcoming bookings, recent visits, account balance, current tier
- Visit streaks + monthly visit counter (gamification)
- Purchase history, downloadable receipts
- Stored payment methods (PCI-safe via Mindbody's payment vault)
- Update profile, photo, preferences
- Resend membership card / digital QR check-in

**Engagement features**
- Class series sign-up (6-week strength cycle, Hyrox prep cohort, etc.)
- Run club RSVP with attendee list visible
- Member events RSVP (capped attendance)
- Guest pass redemption flow
- Refer-a-friend with reward tracking
- Push notifications via PWA install
- SMS booking reminders + no-show follow-ups

**Commerce expansion**
- Drop-in class purchase (no membership required) with upsell to membership
- Gift card purchase + redemption
- Retail product purchase (apparel, supplements, recovery gear)
- Bundle / package purchase

### Operator-Facing — The Custom Admin Dashboard

This is what replaces the demo `admin.html` with real data. John logs in at `revivefw.com/ops` and sees:

**Real-time KPI dashboard**
- MRR, ARR, total members, churn rate, LTV
- Founders 200 progress bar (live)
- Today on the floor: bookings, no-shows, fills
- This week vs last week trend lines
- Revenue by source (organic site, Instagram, referral, walk-in)

**Member management**
- Full CRUD: add, edit, deactivate, merge duplicates
- Search + filter by tier, sign-up source, last visit, payment status
- Tag system (high-value, at-risk, run club regular, etc.)
- Notes log per member (visible to staff)
- Two-way sync with Mindbody — edit either side, both update

**Class & appointment management**
- Visual schedule builder (drag-drop on calendar)
- Recurring class series setup
- Capacity heatmaps (when are classes filling vs empty?)
- Instructor assignment + sub coverage workflow
- One-click cancel-class + auto-notify roster

**Pricing & contract management**
- Adjust tier pricing from the dashboard (pushes to Mindbody)
- Run promo codes (Sweet Dreams referral, opening week, etc.)
- Limited-time pricing (founders rate auto-closes when 200 hit)
- Gift card sales tracking
- Refund / credit issuance with audit log

**Analytics & business intelligence**
- Conversion funnel: visitor → waitlist → trial → paid → retained
- Cohort retention chart (founders signed up in March vs April vs May)
- Lead source attribution (which IG post → which signup)
- Class profitability per instructor
- Recovery service utilization per slot
- Time-of-day demand heatmap (capacity planning data)
- Geographic heatmap of member zip codes (where to put location #2)
- LTV vs CAC by acquisition channel
- Custom report builder + scheduled CSV exports

**Marketing & lifecycle automation**
- Welcome sequence (signup → first visit → first 30 days → review prompt)
- Win-back sequence (no visit in 14 / 30 / 60 days)
- Birthday + membership anniversary
- Class capacity alerts ("Hyrox Prep Tuesday 6PM is 90% full, push to your story")
- Auto-pull Google reviews → display on site
- Instagram feed live on the site

**Operations**
- Staff scheduling
- Payroll calculations (class pay, commissions, hourly)
- Inventory (retail, towels, supplements)
- Document storage (waivers, IDs, vendor contracts)
- Audit log of every change (who edited what, when)
- Slack / email notifications on key events ("New founder!", "Refund issued", "Class hit capacity")

### Technical Foundation

- **Frontend:** The current site, expanded with member-only routes
- **Backend:** Vercel serverless functions (free tier covers ~100K req/mo)
- **Source of truth:** Mindbody (your existing data stays where it is)
- **Real-time updates:** Mindbody webhooks → live admin dashboard
- **Payment processing:** Mindbody's existing processor (no new merchant account)
- **Auth:** Mindbody's OAuth identity service (members keep their existing logins)
- **Reliability:** Nightly reconciliation pull in case any webhook is missed
- **Observability:** Sentry error tracking + uptime monitoring (we're alerted before you are)

### What This Tier Does NOT Include
- Branded mobile app (covered in Tier 3)
- Multi-location / franchise tooling (covered in Tier 3)
- Custom hardware integration (RFID readers, biometric kiosks)

### Investment

| Item | Investment |
|---|---|
| **One-time build** | $18,500 |
| **Monthly platform fee** | $750 / mo |
| Mindbody API (paid to Mindbody, not us) | $11 / mo |
| Vercel hosting | $0 (free tier sufficient) |
| **Total monthly cost to Revive** | $761 / mo |

**First-year total: $18,500 + $9,132 = $27,632**

### What's Bundled Into the $750/mo

- Hosting + serverless infrastructure
- Mindbody integration maintenance (API version upgrades, webhook reliability)
- Up to 8 hours of feature/content work per month (beyond that, $125/hr)
- 24-hour response SLA on bug reports
- Monthly performance + analytics review call
- Quarterly strategy session (Sweet Dreams ops review)
- Security patches + dependency updates
- Backup + disaster recovery

### ROI — The Numbers John Cares About

**Mindbody marketplace fee savings:**
| Scenario | Math | Annual Savings |
|---|---|---|
| Conservative (10 new members/mo via direct site) | 10 × $130 × 20% × 12 | **$3,120/yr** |
| Realistic (20 new members/mo via direct site) | 20 × $130 × 20% × 12 | **$6,240/yr** |
| Optimistic (35 new members/mo at full capacity) | 35 × $130 × 20% × 12 | **$10,920/yr** |

**Operational gains (harder to price, real all the same):**
- 5 hr/week saved on admin tasks Mindbody can't automate (member tags, custom reports, marketing) = **~260hr/yr ≈ $13,000 in owner time**
- Reduced no-shows from automated SMS reminders (industry: 20–40% reduction) = **3–8% revenue lift**
- Higher retention from gamification (visit streaks, anniversary touchpoints) — even 1% lift on 200 members at $130/mo = **$3,120/yr**

**Tier 2 break-even point:** ~14 months on marketplace fee savings alone, before any retention or operational gains.

---

## TIER 3 — APEX  *(Optional Upsell)*

> *Built for the operator who's planning location #2 before location #1 has opened.*

Everything in Native, plus:

**Branded mobile app (PWA → optionally native)**
- Installable from `revivefw.com` (no App Store approval needed)
- Push notifications
- Offline class schedule
- QR check-in at the door
- Apple Watch widget (today's bookings)
- Optional native iOS / Android wrappers if desired ($5K each)

**Multi-location architecture**
- Site-aware design (location selector at top)
- Per-location pricing, schedules, staff
- Cross-location member access tracking
- Franchise-ready data model

**Advanced automation**
- AI-powered churn prediction (flag members likely to cancel before they do)
- Dynamic pricing experiments (founders pricing test groups)
- Lookalike audience generation for ad spend
- Class demand forecasting (stop overbooking 6 AM, expand 5 PM)
- Smart waitlist promotion (not just first-come, but member-tier-weighted)

**Brand integrations**
- Whoop / Oura / Apple Health webhook intake (members opt-in to share workout data)
- Strava / Garmin auto-post when leaving the gym
- Spotify / Apple Music workout playlist sharing

**White-label readiness**
- Codebase architected so future Sweet Dreams clients can adopt the same stack
- Revenue-share opportunity (Sweet Dreams licenses to other gyms, Revive gets a cut)

### Investment

| Item | Investment |
|---|---|
| **Add-on build (on top of Tier 2)** | $11,000 |
| **Monthly platform increase** | +$300 / mo (so $1,050 / mo total) |

---

## Comparison Table

| | **Foundation** | **Native** *(Recommended)* | **Apex** |
|---|---|---|---|
| Marketing site | ✓ | ✓ | ✓ |
| Founders waitlist + giveaway forms | ✓ | ✓ | ✓ |
| Live class schedule on site | — | ✓ | ✓ |
| Class / recovery booking on site | — | ✓ | ✓ |
| Membership signup + payment on site | — | ✓ | ✓ |
| **Bypasses Mindbody's 20% marketplace cut** | **—** | **✓** | **✓** |
| Branded member portal | — | ✓ | ✓ |
| Real custom admin dashboard | — | ✓ | ✓ |
| Real-time webhook automation | — | ✓ | ✓ |
| Marketing automation (welcome, win-back, birthdays) | — | ✓ | ✓ |
| BI dashboards (cohort, LTV, attribution) | — | ✓ | ✓ |
| Branded mobile app (PWA) | — | — | ✓ |
| Multi-location architecture | — | — | ✓ |
| AI churn prediction + demand forecasting | — | — | ✓ |
| Wearable / Strava integration | — | — | ✓ |
| **Build investment** | $4,800 | $18,500 | $29,500 |
| **Monthly investment** | $200 | $750 | $1,050 |
| **Year-1 total** | $7,200 | $27,500 | $42,100 |

---

## What Mindbody Still Does (We're Not Replacing It)

Important context — this proposal **does not** kick Mindbody out. They remain:

- The **system of record** for all member, class, and transaction data
- The **payment processor** (no new merchant account, no PCI burden on us)
- The **tax + compliance backbone** (their reporting handles this)
- The **insurance backbone** (waivers, liability documents stored there)
- The **accounting integrations** (QuickBooks, Xero) — keep working untouched

What we change is **the customer experience layer** and **the operator dashboard**. The plumbing stays Mindbody. You can revoke our developer access from your Mindbody admin at any time and still have your business running on Mindbody. We're additive, not a replacement.

---

## Build Timeline — Tier 2

**Week 1: Discovery & sandbox setup**
- Activate Mindbody developer account against Revive's site
- Map every membership tier, class type, recovery service, and pricing option from your Mindbody to our system
- Confirm webhook subscriptions

**Week 2–3: Read-layer integration**
- Live class schedule on `experience.html`
- Live pricing on `pricing.html`
- Foundation site relaunches with real data

**Week 4–5: Member auth + booking**
- OAuth login flow
- Class booking flow
- Recovery appointment booking
- Member dashboard MVP

**Week 6–7: Branded checkout + signup**
- Full membership purchase flow on the site
- Liability waiver e-sign
- The page that bypasses Mindbody's 20%

**Week 8–9: Operator dashboard**
- Real-time KPIs
- Member management UI
- Webhook receivers + reliability layer

**Week 10: Marketing automation**
- Welcome sequence
- Win-back sequence
- SMS reminders

**Week 11–12: Polish, QA, launch**
- Penetration test on auth + payment flows
- Load test
- Soft launch to founders only
- Public launch

---

## Why Sweet Dreams

- **Local — Fort Wayne based.** We can sit in the gym with you when there's a feature question.
- **Brand-first.** We treat your brand the way you'd treat your training program. The site sells the way the gym should sell.
- **Mindbody-fluent.** We've researched the API end-to-end. We won't pretend something is hard that isn't, and we won't oversell something that is.
- **Reasonable.** No 24-month contracts. Month-to-month after the build. If we stop earning the retainer, you stop paying it.

---

## Investment Summary

| Tier | Build | Monthly | Year-1 Total | Best for |
|---|---|---|---|---|
| **Foundation** | $4,800 | $200/mo | $7,200 | Brand presence + lead capture |
| **Native** *(Rec.)* | $18,500 | $750/mo | $27,632 | Owning the customer experience + ops |
| **Apex** | $29,500 | $1,050/mo | $42,100 | Multi-location ambition + scale |

**All tiers include:**
- Custom domain setup
- SSL
- Brand-aligned design (no templates)
- Source code ownership (you can fire us — codebase is yours)
- Mobile-responsive across all devices
- Performance + accessibility baseline (Lighthouse 95+ / WCAG AA)

**Payment terms:**
- 50% at project start
- 25% at midpoint review
- 25% at launch
- Monthly retainer begins month after launch

**Cancellation:**
- 30-day notice on monthly retainer
- Build deposit non-refundable once dev work begins
- Codebase + data export available at any time

---

## Recommended Path

We recommend **Tier 2 (Native)**, for three reasons:

1. **The math:** the tier pays for itself in ~14 months on Mindbody marketplace savings alone, then becomes net-positive for the next decade
2. **The brand:** the moment members see Revive's branded checkout instead of a Mindbody-hosted page is the moment Revive feels different from every other gym
3. **The data:** Mindbody's reporting is fine for taxes. It's not what you need to grow. The custom dashboard tells you which Instagram post drove your highest-LTV cohort — Mindbody can't do that

Foundation is honest, well-built, and a fine option if you're confident your customer acquisition won't go through Mindbody's marketplace anyway. Apex is for when location #2 is on the table.

---

## Next Steps

1. **Decision call** — 30 min, this week. We answer whatever's left.
2. **If Tier 1:** signed agreement → 3-week sprint → launch
3. **If Tier 2:** signed agreement → John generates Mindbody activation code for our developer account → 12-week sprint → launch
4. **If Tier 3:** Tier 2 + parallel app track

---

**Questions / next steps:**
Cole Marcuccilli · cole@marcuccilli.com · Sweet Dreams Studios

*Proposal valid for 30 days. Revivable by request.*
