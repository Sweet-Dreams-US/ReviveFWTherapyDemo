# Meta free-pass leads

Source: Google Sheet `1YTkBiJP3SNYz_GE6CL-5mZ9q9emZmiJbzHLGrrg4p_U`, `Sheet1` (gid `0`).
The current sheet permits link-based reads. The server reads its CSV export; it does not change the sheet, its sharing, or the Meta form integration.
If the sheet is made private, replace the reader with authenticated Google Sheets access. Do not make a private sheet public to repair a failed sync.

## Current scope

- `/api/meta-leads-sync` runs every five minutes on Vercel production. GET requires `CRON_SECRET`; POST requires the existing admin password.
- `CRON_SECRET` must match the `meta_sync_secret` entry in Supabase `app_secrets`. Neither is exposed to the browser.
- `/admin#freepasses` lists imported leads and provides Sync now, source metadata, activation, joined, pause, do-not-contact, externally-sent confirmation, feedback, and notes.
- The Meta `id` is the import identity, stored as text. Repeated imports preserve staff-controlled fields. Deleting a source row does not delete its lead or history.
- Import does not start a pass. Front-desk activation stores a timestamp. Redemption date is Day 1 in America/Indiana/Indianapolis. Pass expiry is closing on calendar Day 7: 11 PM on weekdays, 8 PM on weekends. This uses normal published hours; holiday overrides must be resolved before enabling timed sending.
- Staff writes use a version number to reject conflicting edits. Each successful edit is recorded in `revive_private.meta_lead_events`.
- An import lease prevents overlapping syncs. Interrupted jobs can resume after two minutes; successful source rows are safe to reimport. Invalid source row numbers appear in admin without logging contact information.
- CSV is limited to 4 MB. Storage imports run in batches of 100. Search/filter/pagination operate in the database, not just the displayed page.

## Initial website pass email; timed follow-ups paused

The public `/free-pass#claim` form accepts full name, email, optional phone, and a server-validated Turnstile token (hostname and action checked; fail closed). Website claims go directly to Free-Pass Leads, not the link-viewable Google Sheet. One website claim per normalized email is retained; repeat submissions cannot change saved identity or restart activation. The retired `/api/inquiry` remains closed.

The initial transactional pass email is sent via Resend after storage. An outbox freezes the payload and uses a per-lead idempotency key, a send lease, and a sent flag. Uncertain sends can only retry within 23 hours (Resend deduplicates for 24 hours); older uncertain sends require review rather than risking a duplicate. No scheduled retries are active. A successful API send records provider acceptance, timestamp, and message ID, not inbox delivery. Opens/clicks/delivery webhooks are not yet connected to admin.

Authenticated staff may explicitly create a claim using `/api/meta-leads` action `create_claim` with the existing password, fullName, email, and optional phone. This uses the same claim-and-email helper. Meta Sheet import still does not send an email. Existing job application notifications are unchanged. No marketing emails, timed trial emails, or Meta Lead events are enabled by this release. Per-lead pause flags prepare for the future follow-ups; clearing one does not enable those jobs.

The admin shows a proposed schedule relative to activation: one first visit email two hours after redemption, Day 5 PT offer at 9 AM Eastern, Day 7 final day reminder at 9 AM Eastern, Day 10 extension, Day 13 commitment offer. The separate Day 3 feedback email was removed at the owner's request. These are planning dates, not queued jobs. Automatic timed sending remains paused during step by step testing.

Approved joining offer: complete membership enrollment before Day 7 closing to receive one free personal training session with Kings Nutrition on Essential or Plus, or two sessions total on Elite. Joining early qualifies for the same bonus. The Elite total is two, not three, including any existing Elite PT benefit. No additional written plan, coaching check in, price discount, or invented dollar value is promised. PT sessions can occur afterward; the front desk coordinates fulfillment. Booking a visit alone does not qualify. Tier selection and PT redemption tracking still need implementation before an automated fulfillment workflow is enabled.

Day 5 and Day 7 templates share the same offer and personal deadline. Manual preview actions are send_day5_preview (v2) and send_day7_preview (v1), authenticated and deduplicated separately. Do not send tests without explicit user approval. The first Day 5 v1 preview remains in historical notes. No new cron or scheduler is created by these templates.

All authored email copy and subjects must avoid dashes, including hyphens, en dashes, and em dashes. Use sentences, commas, colons, or words such as "to" and "through". Preserve functional URLs, email addresses, HTML/CSS syntax, and user submitted data unchanged. This rule covers the pass email, the first visit email, and future templates.

The authenticated `send_experience_preview` action on `/api/meta-leads` sends the first visit template to the exact existing lead selected by ID and email. It does not redeem the pass or enable automation. A stable Resend idempotency key protects immediate retries, and a staff note records the test and provider ID without altering trial state. Its private signed link opens the prefilled website feedback form. Guest responses are saved separately from staff notes. The optional help planning checkbox was removed at the owner's request; historical responses are retained.

The Resend sequence is live for every activated pass with unsubscribe handling in place; still settle holiday closing exceptions, PT fulfillment, extension eligibility, and six-month rate/terms. The proposal's classes wording conflicts with the site's current verified facts and must not be used without confirmation. Marking a confirmation as sent records an external action; it does not send email.

## Verification

`node --test tests/meta-leads.test.js` checks CSV parsing, large provider IDs, duplicate/invalid rows and unauthorized endpoint requests.
`tests/meta-leads.sql` checks real database behavior inside a rolled-back transaction with synthetic records.
Use the authenticated Sync now action to check connectivity without generating a lead or emailing anybody.

The `revive_private` schema must not be exposed through PostgREST. Privileged implementations live there with explicit token checks; exposed RPC wrappers run as invoker. Existing website anon-insert permissions cannot create Meta leads or set trial state.
