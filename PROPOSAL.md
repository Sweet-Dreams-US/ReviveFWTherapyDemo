# Revive Fitness & Recovery — Website Proposal

**Prepared by:** Sweet Dreams Studios · Fort Wayne, IN
**Prepared for:** John M., Founder — Revive Fitness & Recovery
**Date:** April 2026

---

## TL;DR

- Two paths: a marketing site, or a marketing site that *also* replaces your customer-facing Mindbody experience
- The expensive option pays for itself in ~14 months on Mindbody marketplace savings alone
- Mindbody stays your back-end either way — we don't replace it, we wrap it

---

## The Two Things This Solves

- **Mindbody takes 20% of first-time customers** acquired through their consumer marketplace — every signup on `revivefw.com` instead is a signup Mindbody can't tax
- **Brand experience cracks at the booking handoff** — current setup sends members from Revive's brand to Mindbody's generic booking page; premium gyms (Equinox, Othership, Continuum) never let that happen

---

# TIER 1 — FOUNDATION

> *Marketing site. Lead capture. Mindbody handles bookings.*

## Pages Included

- Landing / home
- About / founder story
- Experience (training + recovery + community breakdown)
- Pricing (3 tiers + comparison table + FAQ)
- Founders waitlist signup
- Active campaign page (currently Wallen giveaway — reusable for any future contest)
- Member portal stub (links to Mindbody-hosted login)
- 404 + error states

## Brand & Design

- Custom design system (typography, color, motion)
- Editorial / premium aesthetic
- Film-grain texture, scroll reveals, marquees
- Animated counters + live countdown
- Mobile-responsive every breakpoint
- Lighthouse 95+ performance
- WCAG AA accessibility baseline

## Forms & Lead Capture

- Founders waitlist form → email database
- Wallen giveaway entry form → email database
- General contact form → email
- Newsletter signup
- Form submission notifications via email

## Marketing Stack

- Google Analytics 4 install
- Meta Pixel install
- SEO meta tags + Open Graph
- Sitemap.xml + robots.txt
- Social media link integration

## Hosting & Infra

- GitHub Pages or Vercel hosting (free)
- Custom domain setup (`revivefw.com`)
- SSL certificate
- CDN delivery

## Maintenance Included

- Quarterly content updates (4 hr / quarter included)
- Security patches
- Uptime monitoring
- Email/Slack alerts on form failures

## What Foundation Does NOT Include

- ✗ Live class schedule on the site
- ✗ Class booking on the site
- ✗ Recovery appointment booking on the site
- ✗ Membership purchase on the site
- ✗ Branded member portal
- ✗ Custom admin dashboard
- ✗ Real-time data / webhook automation
- ✗ Marketing automation (welcome, win-back, birthday)
- ✗ **Mindbody's 20% marketplace cut still applies**

## Foundation Investment

| Item | Amount |
|---|---|
| One-time build | **$2,100** |
| Monthly maintenance | **$99 / mo** |
| Year-1 total | **$3,288** |

## Foundation Timeline

- Week 1: copy refinement, image curation, brand polish
- Week 2: launch on `revivefw.com`
- Ongoing: quarterly content refreshes

---

# TIER 2 — NATIVE  *(Recommended)*

> *Mindbody under the hood. Custom UX on top. Members never see the seam.*

**Includes everything in Foundation, plus:**

## Live Mindbody Data On The Site

- Live class schedule pulled from Mindbody (auto-updates)
- Filter by instructor / class type / time of day / intensity
- Live pricing pulled from Mindbody (no manual updates ever)
- Live recovery service availability (cold plunge / sauna / red light / compression)
- Instructor bios pulled from Mindbody staff records
- Class capacity indicators ("3 spots left")

## Class Booking (On Your Site, Not Theirs)

- One-click booking with member profile auto-fill
- Waitlist join + automatic promotion
- Cancel / reschedule on the site
- Recurring class signup ("every Tuesday forever")
- Add-to-calendar (Google / Apple / Outlook)
- Booking confirmation email / SMS

## Recovery Appointment Booking

- Real-time slot availability
- Book cold plunge / sauna / infrared / red light / compression / private suite
- Sequenced booking ("Lift → Sauna → Plunge → Light" as one flow)
- Recurring weekly bookings
- 24-hr / 72-hr booking windows enforced by tier (Plus / Elite)
- Slot reminders via SMS

## Branded Membership Signup + Payment

- Stripe-style checkout on `revivefw.com` (not Mindbody)
- Real `addClient` + `purchaseContract` to Mindbody under the hood
- Apple Pay + Google Pay support
- Inline e-signature liability waiver (PDF stored in Mindbody)
- ID upload + photo capture
- **This is the page that bypasses Mindbody's 20% marketplace fee**

## Branded Member Portal

- Branded login via Mindbody OAuth
- Dashboard: upcoming bookings, recent visits, account balance, current tier
- Visit streaks + monthly counter (gamification)
- Purchase history with downloadable receipts
- Stored payment methods (PCI-safe via Mindbody vault)
- Update profile, photo, preferences
- Digital QR membership card for door check-in

## Engagement & Commerce

- Drop-in class purchase (no membership required)
- Gift card purchase + redemption
- Retail product purchase (apparel, supplements, gear)
- Bundle / package purchase
- Refer-a-friend with reward tracking
- Run club RSVP with attendee list
- Member events RSVP (capped attendance)
- Guest pass redemption flow
- Class series enrollment (6-week cohorts, Hyrox prep, etc.)
- Push notifications via PWA install

## Custom Admin Dashboard — Real-Time KPIs

- MRR / ARR / total members / churn / LTV
- Founders 200 progress (live)
- Today on the floor: bookings, no-shows, fills
- This week vs last week trend lines
- Revenue by source (organic / IG / referral / walk-in)
- Tier mix (Base / Plus / Elite breakdown)

## Custom Admin Dashboard — Member Management

- Full CRUD: add / edit / deactivate / merge duplicates
- Search + filter by tier / source / last visit / payment status
- Tag system (high-value, at-risk, run club regular, etc.)
- Notes log per member
- Two-way sync with Mindbody (edit either side, both update)

## Custom Admin Dashboard — Operations

- Visual class schedule builder (drag-drop)
- Recurring class series setup
- Capacity heatmaps (which classes fill / empty)
- Instructor assignment + sub coverage workflow
- One-click cancel-class with auto-roster notify
- Pricing & contract management (push to Mindbody)
- Promo code engine
- Time-limited pricing rules (founders auto-closes at 200)
- Refund / credit issuance with audit log

## Custom Admin Dashboard — Business Intelligence

- Conversion funnel (visitor → waitlist → trial → paid → retained)
- Cohort retention chart (March vs April vs May founders)
- Lead source attribution (which IG post → which signup)
- Class profitability per instructor
- Recovery service utilization per slot / per day
- Time-of-day demand heatmap
- Geographic heat map of member zip codes
- LTV vs CAC by acquisition channel
- Custom report builder
- Scheduled CSV exports

## Marketing Automation

- Welcome sequence (signup → first visit → 30 days → review prompt)
- Win-back sequence (no visit at 14 / 30 / 60 days)
- Birthday + membership anniversary emails
- Class capacity alerts ("Hyrox Prep at 90% — push to story")
- Auto-pull Google reviews onto site
- Live Instagram feed on site
- SMS booking reminders
- No-show follow-up automation
- Founders 200 milestone announcements

## Operations Tooling

- Staff scheduling
- Payroll calculations (class pay, commissions, hourly)
- Inventory tracking (retail, towels, supplements)
- Document storage (waivers, IDs, vendor contracts)
- Audit log (who edited what, when)
- Slack / email notifications on key events
- Nightly Mindbody reconciliation (catches missed webhooks)

## Technical Foundation

- Vercel serverless functions (free tier covers ~100K req/mo)
- Mindbody webhooks → real-time admin updates
- Mindbody as source of truth (data stays where it is)
- OAuth via Mindbody Identity Service (members keep existing logins)
- Sentry error tracking + uptime monitoring
- Daily database snapshot

## Maintenance Included

- 8 hr / month feature or content work (overage $125/hr)
- 24-hr response SLA on bug reports
- Mindbody API version upgrades handled
- Webhook reliability monitoring
- Monthly performance + analytics review call
- Quarterly strategy session
- Security patches + dependency updates

## Native Investment

| Item | Amount |
|---|---|
| One-time build | **$4,800** |
| Monthly retainer | **$299 / mo** |
| Mindbody API fee (paid to Mindbody) | $11 / mo |
| Vercel hosting | $0 (free tier) |
| **Total monthly to Revive** | **$310 / mo** |
| **Year-1 total** | **$8,520** |

## Native Timeline (12 weeks)

- Week 1: discovery + Mindbody sandbox activation
- Week 2–3: live class schedule + live pricing on site
- Week 4–5: member auth + class/recovery booking
- Week 6–7: branded membership checkout (the 20%-killer page)
- Week 8–9: operator dashboard + webhook receivers
- Week 10: marketing automation
- Week 11: QA, pen test, load test
- Week 12: soft launch to founders → public launch

---

## ROI On Tier 2

| Scenario | Math | Annual Savings |
|---|---|---|
| Conservative (10 new members/mo via direct site) | 10 × $130 × 20% × 12 | **$3,120/yr** |
| Realistic (20 new members/mo via direct site) | 20 × $130 × 20% × 12 | **$6,240/yr** |
| Optimistic (35 new members/mo at full capacity) | 35 × $130 × 20% × 12 | **$10,920/yr** |

- Build pays for itself in ~14 months on Mindbody savings alone (conservative)
- After year 2, the saved 20% covers most of the $299/mo retainer
- **Operational gains not priced in:** owner time saved, no-show reduction, retention lift, attribution insight

---

## Side-by-Side

| | **Foundation** | **Native** |
|---|---|---|
| Marketing site | ✓ | ✓ |
| Founders waitlist + giveaway forms | ✓ | ✓ |
| Live class schedule on site | — | ✓ |
| Class / recovery booking on site | — | ✓ |
| Membership signup + payment on site | — | ✓ |
| **Bypasses Mindbody 20% marketplace cut** | **—** | **✓** |
| Branded member portal | — | ✓ |
| Custom admin dashboard | — | ✓ |
| Real-time webhook automation | — | ✓ |
| Marketing automation | — | ✓ |
| BI / cohort / attribution dashboards | — | ✓ |
| **Build investment** | $2,100 | $4,800 |
| **Monthly investment** | $99 | $299 |
| **Year-1 total** | $3,288 | $8,520 |

---

## What Mindbody Still Does (Not Replaced)

- System of record for members, classes, transactions
- Payment processor (no new merchant account needed)
- Tax + compliance backbone
- Insurance + waivers
- Accounting integrations (QuickBooks / Xero) — keep working untouched
- John can revoke our developer access anytime — Revive keeps running

---

## What's Bundled Into Both Tiers

- Custom domain setup
- SSL certificate
- Brand-aligned design (no templates)
- **Source code ownership — codebase is yours, you can fire us anytime**
- Mobile-responsive across all devices
- Lighthouse 95+ performance
- WCAG AA accessibility baseline

---

## Payment Terms

- 50% at project start
- 25% at midpoint review
- 25% at launch
- Monthly retainer begins month after launch
- 30-day notice on monthly cancellation
- Build deposit non-refundable once dev work begins
- Codebase + data export available at any time

---

## Why Sweet Dreams

- Local — Fort Wayne based
- Brand-first studio (the site sells the way the gym should sell)
- Mindbody-fluent (researched the API end-to-end)
- No long-term contracts on retainer — month-to-month after build

---

## Recommended Path

- **Tier 2 (Native)** — pays for itself, owns the brand experience, gives John data Mindbody can't
- **Tier 1 (Foundation)** — only if Revive's customer acquisition genuinely won't go through Mindbody marketplace anyway

---

## Next Steps

- 30-min decision call this week
- If Tier 1: signed agreement → 2-week sprint → launch
- If Tier 2: signed agreement → John generates Mindbody activation code → 12-week sprint → launch

---

**Cole Marcuccilli** · cole@marcuccilli.com · Sweet Dreams Studios

*Proposal valid 30 days · Revivable on request*
