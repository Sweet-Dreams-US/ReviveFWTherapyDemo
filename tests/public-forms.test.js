const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

test('public pages only allow job applications and the deferred pass claim', () => {
  const files = fs.readdirSync(root).filter(f => f.endsWith('.html') && f !== 'admin.html')
    .concat(fs.readdirSync(path.join(root, 'blog')).filter(f => f.endsWith('.html')).map(f => 'blog/' + f));
  for (const file of files) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    assert.doesNotMatch(html, /join\s+(?:the\s+)?waitlist|joinForm|\/api\/inquiry|>Newsletter</i, file);
    if (!['careers.html', 'free-pass.html'].includes(file)) assert.doesNotMatch(html, /<form\b/i, file);
  }
  assert.match(fs.readFileSync(path.join(root, 'careers.html'), 'utf8'), /id="applyForm"/);
  assert.match(fs.readFileSync(path.join(root, 'free-pass.html'), 'utf8'), /id="redeem"/);
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'scripts/build-blog.js'), 'utf8'), /join\s+(?:the\s+)?waitlist/i);
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
