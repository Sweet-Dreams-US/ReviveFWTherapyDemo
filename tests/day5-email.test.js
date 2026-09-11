const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { day5Email } = require('../api/_day5-email');
test('Day 5 uses the membership page, no reply request or invented offer', () => {
  const email = day5Email('cole@sweetdreams.us');
  assert.deepEqual(email.to, ['cole@sweetdreams.us']);
  assert.match(email.html, /href="https:\/\/revivefw.com\/pricing"/);
  assert.match(email.html, /Essential/); assert.match(email.html, /Plus/); assert.match(email.html, /Elite/);
  assert.doesNotMatch(email.html, /Just reply|discount|Your seven days have not started/i);
  assert.doesNotMatch(fs.readFileSync(require.resolve('../pass-feedback.html'), 'utf8'), /wantsHelp|help me plan my next visit/);
  assert.doesNotMatch(fs.readFileSync(require.resolve('../scripts/pass-feedback.js'), 'utf8'), /getElementById\('wantsHelp'\)/);
});
test('Day 5 test sends once, records notes, preserves feedback and does not activate automation', async () => {
  const oldFetch = global.fetch, oldEnv = { ...process.env };
  Object.assign(process.env, { SUPABASE_URL: 'https://db.test', SUPABASE_ANON_KEY: 'test', RESEND_API_KEY: 'test' });
  const lead = { id: 'test-id', email: 'cole@sweetdreams.us', activated_at: '2026-09-11T20:09:05Z', is_member: false, do_not_contact: false, notes: 'Keep notes', feedback: 'Keep feedback', version: 7, automation_paused: true };
  let sends = 0;
  global.fetch = async (url, options) => {
    let data; const body = JSON.parse(options.body);
    if (url.endsWith('revive_check_admin')) data = true;
    else if (url.endsWith('revive_meta_list')) data = { leads: [lead] };
    else if (url === 'https://api.resend.com/emails') { sends++; assert.equal(options.headers['Idempotency-Key'], 'day5-preview-v1-test-id'); assert.equal(body.subject, 'Keep your momentum going | REVIVE'); data = { id: 'provider-day5-test' }; }
    else if (url.endsWith('revive_meta_update')) { assert.equal(body.p_action, 'notes'); assert.equal(body.p_feedback, 'Keep feedback'); assert.match(body.p_notes, /^Keep notes/); assert.match(body.p_notes, /\[Day 5 preview v1 sent\]/); lead.notes = body.p_notes; data = lead; }
    else throw new Error('Unexpected request');
    return { ok: true, json: async () => data };
  };
  const call = async () => {
    const res = { setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
    await require('../api/meta-leads')({ method: 'POST', body: { action: 'send_day5_preview', password: 'test', id: lead.id, email: lead.email } }, res); return res;
  };
  try {
    lead.do_not_contact = true; assert.equal((await call()).code, 400);
    lead.do_not_contact = false; lead.is_member = true; assert.equal((await call()).code, 400);
    lead.is_member = false; assert.equal(sends, 0);
    const result = await call(); assert.equal(result.code, 200); assert.equal(result.body.recorded, true);
    assert.equal((await call()).body.already_sent, true); assert.equal(sends, 1);
    assert.equal(lead.automation_paused, true); assert.equal(lead.activated_at, '2026-09-11T20:09:05Z');
  } finally { global.fetch = oldFetch; for (const key of Object.keys(process.env)) if (!(key in oldEnv)) delete process.env[key]; Object.assign(process.env, oldEnv); }
});
