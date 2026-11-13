const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

test('public pages only allow job applications, pass claims and private visit feedback', () => {
  const files = fs.readdirSync(root).filter(f => f.endsWith('.html') && f !== 'admin.html');
  for (const file of files) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    assert.doesNotMatch(html, /join\s+(?:the\s+)?waitlist|joinForm|\/api\/inquiry|>Newsletter</i, file);
    if (!['careers.html', 'free-pass.html', 'pass-feedback.html'].includes(file)) assert.doesNotMatch(html, /<form\b/i, file);
  }
  assert.match(fs.readFileSync(path.join(root, 'careers.html'), 'utf8'), /id="applyForm"/);
  assert.match(fs.readFileSync(path.join(root, 'free-pass.html'), 'utf8'), /id="redeem"/);
  assert.match(fs.readFileSync(path.join(root, 'free-pass.html'), 'utf8'), /id="claimPassForm"/);
  // The blog is rendered by api/_blog.js from content/blog; it must not carry a form or the retired waitlist copy.
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'api/_blog.js'), 'utf8'), /join\s+(?:the\s+)?waitlist|<form\b/i);
});

test('retired inquiry endpoint cannot store or send anything', async () => {
  const original = global.fetch;
  global.fetch = async () => { throw new Error('Retired endpoint attempted a network write'); };
  try {
    for (const method of ['POST', 'GET']) {
      const res = { setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
      await require('../api/inquiry')({ method, body: { type: 'waitlist', email: 'test@example.com' } }, res);
      assert.equal(res.code, 410);
      assert.match(res.body.error, /retired/);
    }
  } finally { global.fetch = original; }
});
