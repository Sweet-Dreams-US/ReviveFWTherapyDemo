# REVIVE advertising measurement

Updated September 11, 2026. Dataset: `ReviveFWwebsiteData`, pixel `1236948538486968`.

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

Automatic follow-up emails are still disabled. Website claims send the initial pass confirmation. Meta imports do not yet send that email. The approved experience, Day 5, and Day 7 templates are manual-preview capable only. Enabling promotional delivery needs a confirmed consent basis and unsubscribe handling; do not enable a backlog or undecided Day 10/13 offers.

## Verification

`node --test tests/*.test.js`, `node scripts/check-app-links.js`, and `git diff --check`.

SQL tests in `tests/*.sql` use transactions and rollback, never real Meta events or email sends. `tests/meta-conversions.sql` covers stable IDs, leasing, retries, stale-worker rejection, payload cleanup, old-claim suppression, and private access.
