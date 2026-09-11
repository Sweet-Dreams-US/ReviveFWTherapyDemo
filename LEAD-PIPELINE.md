# Meta free-pass leads

Source: Google Sheet `1YTkBiJP3SNYz_GE6CL-5mZ9q9emZmiJbzHLGrrg4p_U`, `Sheet1` (gid `0`).
The current sheet permits link-based reads. The server reads its CSV export; it does not change the sheet, its sharing, or the Meta form integration.
If the sheet is made private, replace the reader with authenticated Google Sheets access. Do not make a private sheet public to repair a failed sync.

## Current scope

- `/api/meta-leads-sync` runs every five minutes on Vercel production. GET requires `CRON_SECRET`; POST requires the existing admin password.
- `CRON_SECRET` must match the `meta_sync_secret` entry in Supabase `app_secrets`. Neither is exposed to the browser.
- `/admin#freepasses` lists imported leads and provides Sync now, source metadata, activation, joined, pause, do-not-contact, externally-sent confirmation, feedback, and notes.
- The Meta `id` is the import identity, stored as text. Repeated imports preserve staff-controlled fields. Deleting a source row does not delete its lead or history.
- Import does not start a pass. Front-desk activation stores a timestamp. Pass expiry is seven days after activation. Display times use America/Indiana/Indianapolis.
- Staff writes use a version number to reject conflicting edits. Each successful edit is recorded in `revive_private.meta_lead_events`.
- An import lease prevents overlapping syncs. Interrupted jobs can resume after two minutes; successful source rows are safe to reimport. Invalid source row numbers appear in admin without logging contact information.
- CSV is limited to 4 MB. Storage imports run in batches of 100. Search/filter/pagination operate in the database, not just the displayed page.

## Email automation is not enabled

The proposal is a planning input. This release does not send confirmations, marketing emails, Meta Lead events, or any other customer messages. Resend and the website's existing inquiry forms are unchanged. Per-lead pause flags prepare for the future workflow; clearing one does not override the global email pause.

The admin shows a proposed schedule relative to activation: Day 1 experience, Day 3 feedback, Day 5 membership options (proposal allows Day 5–6), Day 7 trial ending, Day 10 extension, Day 13 commitment offer. These are planning dates, not queued jobs.

Before implementing the Resend sequence, settle the templates, consent/unsubscribe handling, sender, Day 7 bonus, extension eligibility, and six-month rate/terms. The proposal's classes wording conflicts with the site's current verified facts and must not be used without confirmation. Marking a confirmation as sent records an external action; it does not send email.

## Verification

`node --test tests/meta-leads.test.js` checks CSV parsing, large provider IDs, duplicate/invalid rows and unauthorized endpoint requests.
`tests/meta-leads.sql` checks real database behavior inside a rolled-back transaction with synthetic records.
Use the authenticated Sync now action to check connectivity without generating a lead or emailing anybody.

The `revive_private` schema must not be exposed through PostgREST. Privileged implementations live there with explicit token checks; exposed RPC wrappers run as invoker. Existing website anon-insert permissions cannot create Meta leads or set trial state.
