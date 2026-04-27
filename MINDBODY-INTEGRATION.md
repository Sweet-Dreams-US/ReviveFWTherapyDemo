# Mindbody → Revive Website Integration Research

> Internal research doc for the Sweet Dreams × Revive partnership pitch.
> Built from Mindbody's Public API v6 docs, OAuth sample app, and developer support articles.
> **We are not building this yet** — this is feasibility + scoping for the conversation.

---

## TL;DR

Mindbody has a full **Public API v6** that exposes nearly everything Revive runs on it: classes, appointments (perfect for cold plunge / sauna), pricing options, contracts, memberships, client accounts, sales, and webhooks for real-time updates. **Yes, we can wire this site into his Mindbody.** It's not free, and it's not pure-frontend — it requires a small backend (a "BFF" — backend-for-frontend) to keep the API key safe. But the architecture is well-trodden.

**What this unlocks for Revive:**
- Live class schedule on the site (no manual updates)
- Members book classes & recovery sessions from the site
- Live membership signup with payment (no separate Mindbody page handoff)
- Real "Member Portal" where they see purchases, upcoming bookings, account balance
- Auto-synced admin dashboard (real KPIs, not the mock data we built today)
- Founders/waitlist signups flow into Mindbody as Client records automatically

---

## The Three Things That Make Mindbody Work

### 1. The auth model (this is the part people get wrong)

Mindbody uses **two layers of credentials**:

| Layer | What it is | Where it lives | Used for |
|---|---|---|---|
| **App credentials** | `Api-Key` header + `SiteId` (Revive's business ID) | **Server-side only** — never in browser | Identifies *your app* + which gym site |
| **User token** | OAuth 2.0 access token (`Authorization: Bearer …`) | Per-member session | Identifies *which member* is acting |

Two practical paths to get a user token:

- **Staff OAuth** (legacy, simpler): `POST /usertoken/issue` with username + password. Used for staff or app-level access.
- **Member OAuth 2.0** (modern, what Revive members use): redirect to `https://signin.mindbodyonline.com/connect/authorize` → member signs in → app receives an authorization code → exchange for `access_token` + `refresh_token`. This is the same pattern as "Sign in with Google."

Required scopes for member login:
```
email profile openid offline_access Mindbody.Api.Public.v6
```
(`offline_access` is what gives us the refresh token — without it, members re-login every hour.)

### 2. The base URL & headers

```
Base:  https://api.mindbodyonline.com/public/v6
Auth:  https://signin.mindbodyonline.com/connect/{authorize|token}

Required headers on every API call:
  Api-Key:        <your developer API key>
  SiteId:         <Revive's site ID, e.g. -99 for sandbox>
  Authorization:  Bearer <user token>   ← only when acting as a member
  Content-Type:   application/json
```

### 3. Why we need a backend (the GitHub Pages caveat)

**The `Api-Key` cannot live in browser JavaScript.** If we ship it in the static site, anyone can steal it and rack up calls on Revive's bill. So Mindbody integration on a static-hosted site means **adding a thin serverless layer**:

```
Browser  →  Vercel/Netlify Function  →  Mindbody API
            (holds Api-Key here)
```

Options if/when we go live:
- **Vercel Functions** (free tier covers ~100K req/mo) — what we'd recommend
- **Netlify Functions** (similar, free tier)
- **Cloudflare Workers** (cheapest at scale)
- **A real Node/Next backend** (overkill unless we go further)

This is why I chose static-only for the demo today — Mindbody work needs a backend, and the demo's job is just to sell the vision.

---

## Page-by-Page: What We'd Wire Up

### `experience.html` & `pricing.html` — Live class schedule + pricing
- `GET /class/classes?StartDateTime=…&EndDateTime=…` — class roster for the next 7 days
- `GET /class/classdescriptions` — the "what is this class" copy
- `GET /sale/services` (or `/sale/contracts`) — pricing options & memberships pulled live
- `GET /staff/staff` — instructor bios for class cards
- `GET /site/locations` — multi-location ready if Revive expands

### Class & recovery booking flow
- `GET /class/classes` (browse) → `POST /class/addclienttoclass` (book)
- For waitlists: `GET /class/waitlistentries`, `POST /class/removefromwaitlist`
- For cold plunge / sauna / red light (these are appointments, not classes):
  - `GET /appointment/bookableitems` — "what 30-min cold plunge slots are open Friday?"
  - `GET /appointment/availabledates` — which days have any availability
  - `POST /appointment/addappointment` — actually books it

### `join.html` & founders waitlist — Real signup
- `POST /client/addclient` — creates the Mindbody client record at signup
- `POST /sale/checkoutshoppingcart` — runs the card, creates the membership/contract
- `POST /sale/purchasecontract` — for the actual recurring membership (Base/Plus/Elite)
- Webhook `client.created` fires → can trigger our welcome email automation

### Member Portal (replaces or enhances `admin.html` member view)
- `GET /client/clients?ClientIDs=…` — profile
- `GET /client/clientpurchases` — purchase history
- `GET /client/activeclientmemberships` — what tier they're on
- `GET /client/clientvisits` — visit history (for streak gamification later)
- `GET /client/clientaccountbalances` — any outstanding balance
- `POST /client/sendpasswordresetemail` — "forgot password" flow

### `admin.html` — Real operator dashboard
- `GET /sale/sales` — revenue ranges
- `GET /class/classes` + `/class/classvisits` — class capacity utilization
- `GET /client/clients` — member list with filters
- `GET /enrollment/enrollments` — programs / cohorts / challenges
- Webhooks (push) populate the real-time activity feed

---

## Webhooks (push-based, free)

Mindbody POSTs to a URL we provide whenever something happens. **This is how we'd power the real-time admin dashboard** without polling.

Most relevant events:

| Event | What it means | Use it for |
|---|---|---|
| `client.created` | New member signed up | Welcome email, Slack ping, Sweet Dreams CRM sync |
| `client.updated` | Member edited their info | Re-sync to mailing list |
| `appointmentBooking.created` | Cold plunge booked | "John just booked a 6 AM plunge" feed |
| `appointmentBooking.cancelled` | Slot freed up | Notify waitlist, update availability cache |
| `classRosterBooking.created` | Class booking | Real-time class fill rates |
| `classRosterBookingStatus.updated` | Member signed in / no-showed | No-show tracking |
| `clientSale.created` | Purchase completed | Revenue dashboard |
| `clientMembershipAssignment.created` | New membership activated | "Founders 200" counter increments live |

**Reliability model to know about:**
- Mindbody retries failed deliveries every 15 min for 3 hours
- Events are **not** guaranteed once-only or in order → must be idempotent on our side
- Best practice: every night, do a full reconciliation pull via the API in case a webhook was missed

---

## Cost Model (this is the conversation Revive needs to have with Mindbody)

Per Mindbody's API FAQ:

| Tier | Cost | Notes |
|---|---|---|
| **Sandbox / dev** | Free, forever | Site ID -99 + others. Use this for the entire build. |
| **First 5,000 calls / billing cycle** | Free | Some developers stay in this tier indefinitely |
| **Live integration activation** | **$11 / location / month** | One charge per linked Revive location |
| **Daily call ceiling** | 1,000 / location / day included in the $11 | Plenty for a single-gym member portal |
| **Overage** | ~$0.0033 per extra call | Trivial for normal usage |
| **Per-booking fee (aggregator only)** | $1.20 per class, $2.40 per appointment | Only applies if Sweet Dreams sells Revive's classes through *our* marketplace. **Does NOT apply to Revive's own website.** |

**Realistic Revive cost:** $11/month if it's just their site. The booking fees only kick in if we built something like ClassPass on top.

**Authorization step:** To pull Revive's data, John has to send Sweet Dreams an "activation code" (or click an activation link) from his Mindbody admin. Once activated, our developer account can call against his site. He can revoke it at any time.

---

## Recommended Build Phases (if we win the work)

### Phase 1 — Read-only, no auth (1–2 days)
- Add Vercel Functions to the existing site
- `GET /class/classes` powers a real schedule on `experience.html`
- `GET /sale/services` powers a live-pricing card on `pricing.html`
- No member login needed yet
- **Outcome:** site stops being a demo and starts pulling real data

### Phase 2 — Member auth + bookings (3–5 days)
- Implement OAuth 2.0 flow with Mindbody Identity Service
- Add `/account` member portal
- Members can browse classes, book, cancel
- Recovery appointment booking (the differentiator vs his current Mindbody-hosted page)
- **Outcome:** members can do everything from revivefw.com — never see Mindbody branding

### Phase 3 — Full purchase flow (3–4 days)
- Founders signup form → real `addClient` + `purchaseContract`
- Stripe-style checkout UX, Mindbody payment processor under the hood
- **Outcome:** the "founders waitlist" form becomes actual revenue

### Phase 4 — Real admin + webhooks (2–3 days)
- Set up webhook receiver endpoints
- Replace the mock admin dashboard with live KPIs
- Slack/email automation (new founder → notification)
- **Outcome:** John's ops dashboard updates live; nightly reconciliation job for safety

**Total:** ~10–14 dev days for everything. Phase 1 alone is a noticeable upgrade.

---

## Risks & Gotchas

1. **API key in browser = breach.** Confirmed by docs. Always proxy through serverless.
2. **Rate limits.** 1,000 calls / location / day default. Cache `/class/classes` aggressively (CDN edge cache, 60s TTL).
3. **Webhook delivery is at-least-once and out-of-order.** Build idempotent handlers.
4. **The `GetClasses` endpoint hides classes flagged "hidden" if no auth header is present.** If Revive uses hidden classes for private events, we need to pass auth even for "public" pages.
5. **Sandbox site IDs differ from production.** Use `-99` for general testing. Switch to Revive's real site ID at launch.
6. **OAuth requires HTTPS callbacks.** Vercel/Netlify give us this for free.
7. **PCI compliance.** If we touch card data on our pages, we need PCI scope. Mindbody's hosted payment fields stay out of our scope and we should use them.

---

## What to ask John in the meeting

1. **What's his Mindbody Site ID?** (He can pull it from his admin under Account → API Credentials.)
2. **Has he ever been asked to send an activation code to a developer before?** Tells us how comfortable he is with the flow.
3. **What's currently being collected on his Mindbody side?** Class schedules, membership tiers, recovery as appointments — confirm the structure he set up.
4. **Does he want pricing on the website to drive Mindbody, or vice-versa?** Big strategic question — does the website source-of-truth pricing, or does Mindbody?
5. **Is there a Mindbody-hosted checkout he's been pointing people to?** (Almost certainly yes.) That's the URL we'd be replacing.
6. **Has he set up Mindbody's "Branded Web" or "Branded App"?** If yes, the website integration would either replace or sit alongside those products.

---

## Useful links

- **Developer Portal:** https://developers.mindbodyonline.com/
- **Public API v6 reference:** https://developers.mindbodyonline.com/PublicDocumentation/V6
- **Endpoints index:** https://developers.mindbodyonline.com/Resources/Endpoints
- **Webhooks docs:** https://developers.mindbodyonline.com/WebhooksDocumentation
- **OAuth sample app (official):** https://github.com/mindbody/PartnerOAuthWebApp
- **Pricing FAQ:** https://support.mindbodyonline.com/s/article/API-FAQ
- **Developer Tools landing:** https://www.mindbodyonline.com/business/developer-tools

---

*Doc maintained by Sweet Dreams Studios · Last updated 2026-04-19*
