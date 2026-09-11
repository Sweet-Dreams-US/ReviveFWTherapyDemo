const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCsv, mapLeads } = require('../api/_lead-sync');
const headers = 'id,created_time,email,full_name,phone_number,platform';

test('CSV preserves quoted names, newlines, escaped quotes and large IDs', () => {
  const csv = headers + '\r\n1234567890123456789,2026-09-11T13:00:00+0000,jane@example.com,"Doe, Jane",,fb\r\n';
  const result = mapLeads(csv);
  assert.equal(result.leads[0].meta_lead_id, '1234567890123456789');
  assert.equal(result.leads[0].full_name, 'Doe, Jane');
  assert.equal(result.leads[0].phone, '');
  assert.equal(result.leads[0].lead_created_at, '2026-09-11T13:00:00.000Z');
  assert.deepEqual(parseCsv('"a\nb","say ""hello"""\r\n'), [['a\nb', 'say "hello"']]);
});
test('empty source is healthy, source/header errors are explicit', () => {
  assert.deepEqual(mapLeads(headers).leads, []);
  assert.throws(() => mapLeads('<html>Sign in</html>'), /headers/);
  assert.throws(() => parseCsv('"unfinished'), /Incomplete/);
  assert.throws(() => mapLeads(headers + ',email'), /headers/);
});
test('deduplicates provider IDs and reports incomplete rows without dropping valid leads', () => {
  const row = '123,2026-09-11T13:00:00Z,JANE@EXAMPLE.COM,Jane Doe,+12605550000,fb';
  const result = mapLeads(headers + '\n' + row + '\n' + row + '\n124,,bad,Incomplete,,ig\n');
  assert.equal(result.leads.length, 1); assert.equal(result.duplicates, 1);
  assert.deepEqual(result.invalidRows, [4]); assert.equal(result.leads[0].email, 'jane@example.com');
  assert.equal(result.rowCount, 3);
});
test('sync endpoint rejects unauthorized calls before fetching sheet or storage', async () => {
  const handler = require('../api/meta-leads-sync');
  const original = global.fetch, secret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'test-secret-with-at-least-32-characters';
  global.fetch = () => { throw new Error('must not fetch'); };
  const res = { setHeader() {}, status(n) { this.code=n; return this; }, json(v) { this.body=v; return this; } };
  try {
    await handler({ method:'GET', headers:{} }, res); assert.equal(res.code,401);
    await handler({ method:'POST', headers:{}, body:{} }, res); assert.equal(res.code,401);
    await handler({ method:'DELETE', headers:{} }, res); assert.equal(res.code,405);
  } finally { global.fetch=original; if(secret===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=secret; }
});
