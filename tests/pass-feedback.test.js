const test = require('node:test');
const assert = require('node:assert/strict');
const { feedbackLink, verifyFeedbackToken } = require('../api/_feedback-link');
const secret = 'test-secret-'.repeat(5);
const lead = { id: '00000000-0000-4000-8000-000000000001', activated_at: new Date(Date.now() - 10000).toISOString(), full_name: 'Test Person', email: 'test@example.com' };
const token = feedbackLink(lead, secret).split('#token=')[1];
test('private feedback links are signed, stable, expiring and contain no contact details', () => {
  assert.equal(feedbackLink(lead, secret), feedbackLink(lead, secret));
  assert.doesNotMatch(token, /test@example|Test Person/);
  assert.deepEqual(verifyFeedbackToken(token, secret), { id: lead.id, activatedAt: lead.activated_at });
  assert.equal(verifyFeedbackToken(token.replace(lead.id, '00000000-0000-4000-8000-000000000002'), secret), null);
  assert.equal(verifyFeedbackToken(token, secret + 'wrong'), null);
  assert.equal(verifyFeedbackToken(token, secret, Date.now() + 31 * 86400000), null);
  assert.equal(verifyFeedbackToken('malformed', secret), null);
  assert.throws(() => feedbackLink({ ...lead, activated_at: null }, secret));
});
test('feedback API validates private links, CAPTCHA and fields before writes, and trusts only signed identity', async () => {
  const oldFetch = global.fetch, oldEnv = { ...process.env };
  Object.assign(process.env, { CRON_SECRET: secret, TURNSTILE_SECRET_KEY: 'test', SUPABASE_URL: 'https://db.test', SUPABASE_ANON_KEY: 'test' });
  let writes = 0, reads = 0, captcha = true, action = 'pass_feedback';
  global.fetch = async (url, options) => {
    if (url.includes('siteverify')) return { ok: true, json: async () => ({ success: captcha, action, hostname: 'revivefw.com' }) };
    assert.ok(url.endsWith('revive_pass_feedback'));
    const body = JSON.parse(options.body);
    assert.equal(body.p_id, lead.id); assert.equal(body.p_activated_at, lead.activated_at);
    if (body.p_submit) writes++; else reads++;
    return { ok: true, json: async () => ({ fullName: lead.full_name, email: lead.email, submitted: body.p_submit }) };
  };
  const call = async (body, method = 'POST') => {
    const res = { setHeader() {}, status(n) { this.code = n; return this; }, json(data) { this.body = data; } };
    await require('../api/pass-feedback')({ method, body }, res); return res;
  };
  try {
    assert.equal((await call({ action: 'load', token: 'bad' })).code, 403);
    assert.equal((await call({ action: 'load', token }, 'GET')).code, 405);
    assert.equal(reads, 0);
    assert.equal((await call({ action: 'load', token })).body.email, lead.email);
    assert.equal(reads, 1); assert.equal(writes, 0);
    const submit = { action: 'submit', token, id: 'untrusted-id', email: 'attacker@example.com', rating: 5, areas: ['Gym'], comments: 'Great', wantsHelp: false, turnstileToken: 'test' };
    assert.equal((await call({ ...submit, rating: 9 })).code, 400);
    assert.equal((await call({ ...submit, areas: [] })).code, 400);
    assert.equal((await call({ ...submit, comments: 'x'.repeat(2001) })).code, 400);
    assert.equal((await call({ ...submit, turnstileToken: '' })).code, 400);
    captcha = false; assert.equal((await call(submit)).code, 400);
    captcha = true; action = 'claim_pass'; assert.equal((await call(submit)).code, 400);
    assert.equal(writes, 0);
    action = 'pass_feedback'; assert.equal((await call(submit)).body.submitted, true); assert.equal(writes, 1);
  } finally { global.fetch = oldFetch; for (const key of Object.keys(process.env)) if (!(key in oldEnv)) delete process.env[key]; Object.assign(process.env, oldEnv); }
});
