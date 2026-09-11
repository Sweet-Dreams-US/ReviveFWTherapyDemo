const { rpc } = require('./_lead-sync');
const { buildUserData, getCookie, sendCapiEvents } = require('./_meta');

function allowed(req, body) {
  const headers = req.headers || {};
  return ['revivefw.com', 'www.revivefw.com'].includes(headers.host)
    && headers['sec-gpc'] !== '1' && body.adMeasurement === true
    && getCookie(req, 'revive_ads') === 'yes'
    && process.env.META_PIXEL_ID === '1236948538486968';
}

async function trackClaim(req, body, email, phone) {
  if (!allowed(req, body)) return {};
  // Only email and optional phone used for matching. No fitness answers, feedback,
  // names, arbitrary query strings, or member/payment claims go to Meta.
  const queued = await rpc('revive_queue_pass_conversion', {
    p_token: process.env.CRON_SECRET, p_email: email, p_user_data: buildUserData(req, { email, phone })
  });
  if (!queued.event_id) return {};
  await flushConversions(queued.event_id).catch(() => {});
  return { meta_event_id: queued.event_id };
}

async function flushConversions(eventId = null) {
  const token = process.env.CRON_SECRET;
  const rows = await rpc('revive_take_pass_conversions', { p_token: token, p_event_id: eventId });
  let sent = 0, failed = 0;
  // One Meta request for the leased batch; a retry always uses the original IDs.
  if (rows.length) {
    const result = await sendCapiEvents(rows.map(row => row.payload));
    for (const row of rows) {
      await rpc('revive_finish_pass_conversion', { p_token: token, p_event_id: row.event_id,
        p_attempt: row.attempts, p_ok: result.ok === true, p_error: result.skipped ? 'not_configured' : String(result.error_code || result.status || '') });
      if (result.ok) sent++; else failed++;
    }
  }
  return { sent, failed };
}
module.exports = { allowed, trackClaim, flushConversions };
