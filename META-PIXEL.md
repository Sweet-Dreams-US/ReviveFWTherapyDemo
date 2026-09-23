# REVIVE advertising measurement

Updated September 12, 2026. Dataset: `ReviveFWwebsiteData`, pixel `1236948538486968`.

## Website events

Advertising measurement is off until a visitor chooses Allow. Decline and Global Privacy Control disable browser and server claim events. Guests can change this using Advertising privacy in the footer. Claims still work without advertising measurement. Localhost and Vercel preview domains do not emit events.

| Event | Trigger | Transport |
| --- | --- | --- |
| PageView | Consented public page load | Browser |
| ViewContent | Free pass, join, or pricing page | Browser |
| Contact / FindLocation | Phone or directions click on free pass page | Browser |
| Lead | New website pass claim successfully saved | Browser + Conversions API |

`/free-pass#redeem` is instructions, not a Lead conversion. Meta instant forms already record their own submission; visiting the redirect must not count it again. Careers, admin, and private visit feedback do not load the pixel. Job applicants are not sent to CAPI. Automatic pixel form matching/configuration is disabled.

## Deduplication and retries

The database assigns one `website-pass-<lead UUID>` ID. Browser `eventID` and server `event_id` are identical. Repeated claims within the short response recovery window reuse the ID. Old claims, activated leads, members, and do not contact leads are not new conversions. Staff-created claims and email previews never emit advertising events.

The private `pass_conversion_outbox` retains the original event timestamp and payload during retries. Leases prevent simultaneous sends. The existing five minute sync job retries transient failures independently of sheet availability. Retries stop after 12 attempts or 47 hours, before the deduplication window expires. Successful or terminal rows have matching payloads cleared. The admin lead card shows pending, sent (Meta API acceptance), or needs_review. Acceptance does not prove attribution, match quality, or improved ad performance.

The server sends hashed email and optional phone, valid `_fbp`/`_fbc`, request IP and browser agent. It never sends fitness routine, comments, ratings, job information, or payment claims. Event source URL is the clean fixed pass page. Browser URLs are stripped of arbitrary query/fragment values before loading Meta. Do not place private information in ad URLs or campaign labels.

## Environment and diagnostics

Production requires `META_PIXEL_ID`, `META_CAPI_TOKEN`, and the existing storage/cron configuration. Never put the token in browser code or logs. Optional `META_TEST_EVENT_CODE` routes server events to Meta Test Events and must not remain set for launch. Browser pixel ID and server ID must match.

Authenticated `/api/meta-leads` action `tracking_health` checks configuration and makes a read only dataset request. This is not an end to end event test. Use Events Manager Test Events to verify browser/server receipt and deduplication. No synthetic production Lead or Purchase is sent by automated tests.

## Launch limits

Website event instrumentation is not the same as Meta instant form to CRM conversion-lead optimization. The sheet importer retains Meta lead IDs and campaign metadata but does not report in-person redemption or membership conversion back to Meta. CRM event mapping and campaign dataset access must be verified in Events Manager before claiming this integration is complete.

The sheet is fetched every five minutes. A healthy empty sheet confirms reachability and headers, not the Meta to Sheets connector. Submit a test through the actual Meta form and verify arrival in both the sheet and admin.

Website claims send their initial pass confirmation immediately. The five minute Meta sync now sends missing confirmations, with email-wide deduplication across both claim channels. Resend acceptance is recorded, not inbox delivery. A failed request retries with its original frozen payload and idempotency key, within 23 hours and eight attempts.

The separate five minute `/api/pass-automation` worker sends the first visit experience message two hours after front desk activation. Its catch-up window ends 24 hours after activation. Day 5 and Day 7 offers are scheduled at 9 AM Eastern for every activated pass. Since September 21, 2026 the Meta lead form's agreement covers Meta claims and the website claim form discloses these emails, so no separate consent record is required; the earlier consent columns are kept for history only. Day 5 can recover until that day's midnight; Day 7 cannot send after the pass closing deadline. Day 10 and Day 13 follow the approved proposal (`REVIVE_Automated_7_Day_Pass_Proposal.xlsx`): Day 10 offers three more free days that start at the next front desk check in. It sends at 9 AM Eastern and can catch up for 72 hours, closing exactly when Day 13 opens. REVIVE is not offering the proposal's six month preferred rate, so Day 13 instead reopens the approved Kings Nutrition PT joining bonus for guests who have not joined, for that day only: it sends at 9 AM Eastern and never after closing on Day 13.

Jobs are deduplicated by email and stage, leased, and retried with frozen provider payloads. Staff lifecycle controls apply to all claims with the same email. Joining, do not contact, unsubscribe, or the send window ending suppresses followups. Staff pause holds pending offers. The first visit message is skipped when feedback has already been received. Already sent stages never restart. Clearing an activation is for correcting a mistake, not issuing another trial.

Every automated followup includes a signed unsubscribe link and one-click headers. GET never changes preferences; explicit POST stops followups across the email address without cancelling the pass. The preference page has no advertising pixel. Admin displays each job's schedule, hold reason, acceptance time and provider ID, plus worker heartbeat. Inbox delivery, bounces, opens and clicks are not yet ingested; delivery-level verification requires Resend dashboard access or a verified webhook integration. An email already in flight may still arrive after a stop.

## Verification

`node --test tests/*.test.js`, `node scripts/check-app-links.js`, and `git diff --check`.

SQL tests in `tests/*.sql` use transactions and rollback, never real Meta events or email sends. `tests/meta-conversions.sql` covers stable IDs, leasing, retries, stale-worker rejection, payload cleanup, old-claim suppression, and private access.
