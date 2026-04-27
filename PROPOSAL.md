# Revive Fitness & Recovery — Website Proposal

**Prepared by:** Sweet Dreams Studios · Fort Wayne, IN
**Prepared for:** John M., Founder — Revive Fitness & Recovery
**Date:** April 2026

---

## TL;DR

- Two builds: a marketing site, or a marketing site that *also* replaces your customer-facing Mindbody experience
- The expensive build pays for itself in ~14 months on Mindbody marketplace savings alone
- Mindbody stays your back-end either way — we don't replace it, we wrap it
- Hosting + maintenance priced separately so you only pay for what you use

---

## The Two Things This Solves

- **Mindbody takes 20% of first-time customers** acquired through their consumer marketplace — every signup on `revivefw.com` is a signup Mindbody can't tax
- **Brand experience cracks at the booking handoff** — current setup sends members from Revive to a generic Mindbody page; premium gyms (Equinox, Othership, Continuum) never let that happen

---

# TIER 1 — FOUNDATION  ·  $3,700

> *Marketing site. Lead capture. Mindbody handles bookings.*

## Pages

- Landing / home
- About / founder story
- Experience (training + recovery + community)
- Pricing (3 tiers + comparison + FAQ + founders/standard toggle)
- Founders waitlist signup
- Active campaign page (currently Wallen giveaway — reusable for any contest)
- Member portal stub (links to Mindbody-hosted login)
- 404 + error states

## Brand & Design

- Custom design system (typography, color, motion)
- Editorial / premium aesthetic
- Film-grain texture, scroll reveals, marquees, animated counters, live countdown
- Mobile-responsive every breakpoint
- Lighthouse 95+ performance
- WCAG AA accessibility

## Forms & Lead Capture

- Founders waitlist form
- Wallen giveaway entry form
- General contact form
- Newsletter signup
- Form submission notifications via email

## Marketing Stack

- Google Analytics 4 install
- Meta Pixel install
- SEO meta tags + Open Graph + Twitter Cards
- Sitemap.xml + robots.txt

## Hosting & Infra

- Custom domain setup (`revivefw.com`)
- SSL certificate
- CDN delivery

## What Foundation Does NOT Include

- ✗ Live class schedule on the site
- ✗ Class booking on the site
- ✗ Recovery appointment booking on the site
- ✗ Membership purchase on the site
- ✗ Branded member portal
- ✗ Custom admin dashboard
- ✗ Real-time data / webhook automation
- ✗ Marketing automation
- ✗ **Mindbody's 20% marketplace cut still applies**

---

# TIER 2 — NATIVE  ·  $6,500  *(Recommended)*

> *Mindbody under the hood. Custom UX on top. Members never see the seam.*

**Includes everything in Foundation, plus the entire list below.**

---

## A. LIVE MINDBODY DATA ON THE SITE

- Live class schedule (auto-pulled from Mindbody, never manual)
- Filter classes by instructor / type / time / intensity / location
- Live class capacity indicators ("3 spots left")
- Live recovery service availability (cold plunge / sauna / IR / red light / compression / private suite)
- Live pricing pulled from Mindbody (one source of truth)
- Instructor bios + photos pulled from Mindbody staff records
- Today-on-the-floor live activity widget on home page
- Class series / cohort progress displays
- Open class waitlist visible publicly (with count)

## B. CLASS BOOKING (ON YOUR SITE, NOT THEIRS)

- One-click booking with member profile auto-fill
- Waitlist join + automatic promotion when spot opens
- Cancel / reschedule from member dashboard
- Recurring class signup ("every Tuesday at 6 AM forever")
- Add-to-calendar — Google / Apple / Outlook
- Booking confirmation email + SMS
- Pre-class reminders (24 hr + 1 hr SMS)
- Post-class check-in prompt
- Walk-in booking flow
- "Book me + a friend" pairs flow

## C. RECOVERY APPOINTMENT BOOKING

- Real-time slot availability across all recovery services
- Sequenced booking ("Lift → Sauna 15 min → Plunge 3 min → Light 10 min" as one flow)
- Recurring weekly bookings ("every Sunday at noon, plunge")
- Tier-based booking windows (24-hr Plus / 72-hr Elite)
- Slot reminders via SMS
- Recovery protocol templates (founder-curated)
- Solo vs duo bookings for private suite
- Equipment readiness signals (sauna preheated, plunge temp)

## D. BRANDED MEMBERSHIP SIGNUP + PAYMENT

- Stripe-style branded checkout on `revivefw.com` (not bounced to Mindbody)
- Real `addClient` + `purchaseContract` calls under the hood
- Apple Pay + Google Pay support
- Inline e-signature liability waiver (PDF stored in Mindbody)
- ID upload + profile photo capture
- Tier selection with smart upsell ("90% of members at your activity level pick Plus")
- Founders pricing locked-in tag stored on member profile
- Promo code engine
- Group / family signup flow
- "Cancel anytime, no commitment" messaging
- **This is the page that bypasses Mindbody's 20% marketplace fee**

## E. BRANDED MEMBER PORTAL

- Branded login via Mindbody OAuth (members keep existing credentials)
- Dashboard — upcoming bookings / recent visits / account balance / current tier
- Visit streak counter + monthly visit total (gamification)
- Purchase history with downloadable receipts
- Stored payment methods (PCI-safe via Mindbody vault)
- Update profile / photo / preferences / notification settings
- Digital QR membership card for door check-in
- Preferred classes + instructors saved
- Cancel membership flow with retention offer
- Pause membership (medical leave / vacation hold)
- Upgrade tier flow (Base → Plus → Elite, prorated)
- Resend membership card / reset password

## F. MEMBER ENGAGEMENT & GAMIFICATION

- Visit streak tracking (daily / weekly / monthly)
- Member badges / levels (Bronze 10 visits, Silver 50, Gold 100, etc.)
- Personal records tracker (optional, member-entered)
- Workout history synced from Mindbody visit records
- Run club RSVP with attendee list visible
- Member events RSVP (capped attendance with waitlist)
- Refer-a-friend with reward tracking + leaderboard
- Class series cohort enrollment (6-week strength, Hyrox prep, etc.)
- Birthday + membership anniversary recognition
- Member-of-the-month feature
- Push notifications via PWA install

## G. COMMERCE EXPANSION

- Drop-in class purchase (no membership required, with upsell to membership)
- Gift card purchase + redemption
- Retail product sales (apparel, supplements, recovery gear)
- Bundle / package purchase
- Personal training session booking
- Event ticket sales (member nights, retreats)
- Recovery gear (Whoop straps, Theragun, etc.)
- Supplement subscriptions (autopay)

## H. ADMIN DASHBOARD — REAL-TIME KPIs

- MRR / ARR / total members
- Churn % + LTV / CAC
- Founders 200 progress (live, ticking)
- Today on the floor — bookings / no-shows / fills
- Trend lines — this week vs last week vs last month
- Revenue by source (organic / IG / referral / walk-in / paid ads)
- Tier mix breakdown (Base / Plus / Elite)
- New members this week
- Cancelled members this week
- Recovery utilization %
- Class fill rate %
- Average class size
- Peak-hour demand analysis

## I. ADMIN DASHBOARD — MEMBER MANAGEMENT

- Full CRUD — add / edit / deactivate / merge duplicates
- Two-way sync with Mindbody (edit either side, both update)
- Search + filter by tier / source / last visit / payment status / tag
- Tag system (high-value, at-risk, run club regular, founder, etc.)
- Notes log per member (visible to staff)
- Communication history (emails + SMS sent)
- Visit history per member
- Purchase history per member
- Outstanding balance per member
- Liability waiver status + viewer
- Profile photo + ID viewer
- Bulk actions — email, tag, export, message

## J. ADMIN DASHBOARD — CLASS & SCHEDULE MANAGEMENT

- Visual schedule builder (drag-drop on calendar)
- Recurring class series setup with end dates
- Capacity heatmaps (which classes fill, which empty)
- Class roster viewer with check-in toggle
- Manual booking add / remove
- Instructor assignment with availability conflicts flagged
- Sub coverage workflow (auto-notify available staff)
- One-click cancel-class with auto-roster SMS notify
- Class description editor
- Cohort builder for series enrollment
- Waitlist management with manual promotion

## K. ADMIN DASHBOARD — RECOVERY MANAGEMENT

- Master schedule across all recovery rooms
- Manual appointment booking
- Block-off times for maintenance / cleaning
- Equipment status (plunge temp, sauna ready, lamp life)
- Customer notes per appointment
- No-show tracking with auto-charge rules
- Daily ops checklists (water changes, towels, supplies)

## L. ADMIN DASHBOARD — PRICING & CONTRACTS

- Adjust tier pricing from dashboard (pushes to Mindbody)
- Promo code engine (one-time / recurring / cohort-specific)
- Time-limited pricing rules (founders auto-closes at 200)
- Contract template management
- Refund / credit issuance with audit log
- Gift card sales tracking
- Payment plan creation
- Outstanding balance management

## M. ADMIN DASHBOARD — SALES & FINANCIAL

- Daily / weekly / monthly sales reports
- Revenue by service type
- Revenue by membership tier
- Refunds + credits issued
- Outstanding balances dashboard
- Failed-payment recovery tracker (dunning)
- Tax-ready exports (CSV)
- Mindbody payment processor reconciliation

## N. ADMIN DASHBOARD — BUSINESS INTELLIGENCE

- Conversion funnel (visitor → waitlist → trial → paid → retained)
- Cohort retention chart (founders by signup month)
- Lead source attribution with UTM tracking
- Class profitability per instructor
- Recovery service utilization per slot per day
- Time-of-day demand heatmap (capacity planning)
- Geographic heatmap of member zip codes (where to put location #2)
- LTV vs CAC by acquisition channel
- Churn risk flagging (no visits in 14 / 30 / 60 days)
- Custom report builder
- Scheduled CSV exports (weekly to email)
- Date-range comparisons

## O. ADMIN DASHBOARD — MARKETING TOOLS

- Email campaign builder
- SMS campaign builder
- Audience segmentation (by tier / behavior / source)
- A/B testing for campaigns
- Drip sequence editor (visual, no-code)
- Auto-pulled Google reviews on site
- Live Instagram feed on site
- Social proof widgets (member count ticker, recent signups)
- Referral link generator with tracking
- Press kit / media kit page
- Job application page (when hiring)

## P. ADMIN DASHBOARD — OPERATIONS

- Staff scheduling
- Payroll calculations (class pay / commissions / hourly / bonus)
- Inventory tracking (retail / towels / supplements / cleaning supplies)
- Document storage (waivers / IDs / vendor contracts / leases)
- Audit log (who edited what, when)
- Slack + email notifications on key events
- Nightly Mindbody reconciliation (catches missed webhooks)
- Daily ops checklists
- Maintenance request tracker (broken equipment ticket queue)

## Q. AUTOMATED MARKETING SEQUENCES

- Welcome sequence (signup → 7d → 30d → 60d → review prompt)
- Win-back sequence (no visit at 14d / 30d / 60d / 90d)
- Birthday email + offer
- Membership anniversary recognition
- Class capacity alerts ("Hyrox Prep at 90%, push to story")
- New class launch announcements
- Member nights / events promo
- Referral program nudges
- Founders 200 milestone announcements ("197 / 200 — last 3 spots")
- Failed-payment recovery sequence
- Pre-cancellation save sequence

## R. WEBHOOK AUTOMATIONS (REAL-TIME)

- New member created → welcome email + Slack ping
- New booking → confirmation email + SMS reminder scheduled
- No-show registered → automatic follow-up
- Class cancelled → roster auto-notified
- Membership expired → renewal nudge sequence
- Recovery appointment booked → preparation tips email
- Founders 200 milestone hit → social post draft + alert
- Birthday today → discount code email
- Anniversary today → referral incentive
- New high-value purchase → ops Slack notification
- Equipment issue logged → maintenance ticket

## S. THIRD-PARTY INTEGRATIONS

- Google Reviews → live display on site
- Instagram feed → live on site
- Apple Calendar / Google Calendar / Outlook (member-side)
- Apple Pay + Google Pay (checkout)
- Twilio (SMS sending)
- SendGrid or Postmark (transactional email)
- Slack (admin notifications)
- Stripe (only if non-Mindbody payments needed for events / merch)
- Mindbody → QuickBooks / Xero (existing, untouched)
- Zapier webhooks (for John's custom downstream flows)
- Google My Business sync (hours, location)
- Google Maps + Apple Maps embeds for directions
- Strava (members can post workouts)
- Apple Health / Google Fit (opt-in workout sync)

## T. PWA / MOBILE-FIRST

- Installable from `revivefw.com` (no App Store needed)
- Push notifications
- Offline class schedule (last cached version)
- Mobile-optimized booking flow
- Camera access for ID + profile photo capture
- QR code scanner for door check-in
- Apple Wallet / Google Wallet pass (digital membership card)

## U. PERFORMANCE & SECURITY

- Lighthouse 95+ on every page
- WCAG AA accessibility compliance
- Sentry error tracking + alerts
- Uptime monitoring (we're alerted before John is)
- Rate-limited public endpoints
- Mindbody webhook signature verification
- HTTPS enforced site-wide
- Daily database snapshot
- Penetration test before launch
- Quarterly security audit

## V. TECHNICAL FOUNDATION

- Vercel serverless functions (free tier covers ~100K req/mo)
- Mindbody API as system of record (data stays where it is)
- Mindbody webhooks → real-time admin updates
- OAuth via Mindbody Identity Service
- CDN delivery for assets
- Image optimization
- Smart caching (60s TTL on class schedule, etc.)
- Nightly Mindbody reconciliation job
- Source code stored in your GitHub (you own it)

---

## Native Build Timeline (~12 weeks)

- Week 1 — discovery + Mindbody sandbox activation
- Week 2–3 — live class schedule + live pricing on site
- Week 4–5 — member auth + class/recovery booking
- Week 6–7 — branded membership checkout (the 20%-killer page)
- Week 8–9 — operator dashboard + webhook receivers
- Week 10 — marketing automation sequences
- Week 11 — QA + pen test + load test
- Week 12 — soft launch to founders → public launch

---

# SERVICE PLANS  *(chosen separately from build)*

## Plan A — Hosting Only · $30 / mo

- Custom domain + SSL
- Hosting infrastructure (Vercel + serverless functions)
- CDN delivery
- Daily backups
- Uptime monitoring
- Auto security patches
- *No included maintenance hours — additional work billed at $80/hr*

## Plan B — Hosting + Maintenance · $100 / mo

- Everything in Plan A, plus:
- **5 hours of maintenance work / month included**
- Content updates (copy edits, image swaps, new pages)
- Mindbody API version upgrades handled
- Webhook reliability monitoring
- Bug fixes (24-hr response SLA)
- Monthly performance + analytics review
- Quarterly strategy session
- *Additional hours beyond 5/mo billed at $80/hr*

## Extra Maintenance — $80 / hr

- Applies to either plan when work exceeds included hours
- Tracked transparently with monthly time-log
- Approved before work starts on any single task >2 hrs

---

## Year-1 Cost Scenarios

| Scenario | Build | Plan | Year-1 Total |
|---|---|---|---|
| Foundation + Hosting Only | $3,700 | $30 × 12 = $360 | **$4,060** |
| Foundation + Maintenance | $3,700 | $100 × 12 = $1,200 | **$4,900** |
| Native + Hosting Only | $6,500 | $30 × 12 = $360 | **$6,860** |
| **Native + Maintenance** *(recommended)* | $6,500 | $100 × 12 = $1,200 | **$7,700** |

---

## ROI On Native

| Scenario | Math | Annual Savings |
|---|---|---|
| Conservative — 10 new members/mo via direct site | 10 × $130 × 20% × 12 | **$3,120/yr** |
| Realistic — 20 new members/mo via direct site | 20 × $130 × 20% × 12 | **$6,240/yr** |
| Optimistic — 35 new members/mo at full capacity | 35 × $130 × 20% × 12 | **$10,920/yr** |

- **Realistic break-even: month 13** of the maintenance plan
- After year 2, the saved 20% covers the entire maintenance retainer with money left over
- **Operational gains not priced in:** owner time saved, no-show reduction, retention lift, attribution insight

---

## Foundation vs Native — Side By Side

| | **Foundation $3,700** | **Native $6,500** |
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
| BI + cohort + attribution dashboards | — | ✓ |
| PWA installable mobile app | — | ✓ |
| Third-party integrations (Google Reviews, IG, etc.) | — | ✓ |

---

## What Mindbody Still Does (Not Replaced)

- System of record for members, classes, transactions
- Payment processor (no new merchant account needed)
- Tax + compliance backbone
- Insurance + waivers
- Accounting integrations (QuickBooks / Xero) keep working untouched
- John can revoke our developer access anytime — Revive keeps running

---

## Bundled In Both Tiers

- Custom domain setup
- SSL certificate
- Brand-aligned design (no templates)
- **Source code ownership — codebase is yours, you can fire us anytime**
- Mobile-responsive across all devices
- Lighthouse 95+ performance baseline
- WCAG AA accessibility baseline
- 30-day post-launch bug warranty

---

## Payment Terms

- 50% at project start
- 25% at midpoint review
- 25% at launch
- Service plan begins month after launch
- 30-day notice on service plan cancellation
- Build deposit non-refundable once dev work begins
- Codebase + data export available at any time

---

## Why Sweet Dreams

- Local — Fort Wayne based
- Brand-first studio (the site sells the way the gym should sell)
- Mindbody-fluent (researched the API end-to-end before pitching)
- No long-term contracts on service plans — month-to-month after build

---

## Recommended Path

- **Native + Plan B** — pays for itself, owns the brand experience, gives John data Mindbody can't show
- **Foundation + Plan A** — only if customer acquisition genuinely won't go through Mindbody marketplace anyway

---

## Next Steps

- 30-min decision call this week
- If Foundation: signed agreement → 2-week sprint → launch
- If Native: signed agreement → John generates Mindbody activation code → 12-week sprint → launch

---

*Final feature scope locked in Week 1 discovery. Items added beyond this list during the build are billed at $80/hr with written approval.*

---

**Cole Marcuccilli** · cole@marcuccilli.com · Sweet Dreams Studios

*Proposal valid 30 days · Renewable on request*
