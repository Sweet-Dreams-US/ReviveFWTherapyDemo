const test = require('node:test');
const assert = require('node:assert/strict');
const { schedule, deadline } = require('../scripts/pass-schedule');
const { day5Email } = require('../api/_day5-email');
const { day7Email } = require('../api/_day7-email');
test('calendar Day 5 and Day 7 are 9 AM Eastern, with weekday or weekend closing deadlines', () => {
  assert.deepEqual(schedule('2026-09-11T20:09:05Z'), { day5: '2026-09-15T13:00:00.000Z', day7: '2026-09-17T13:00:00.000Z', day10: '2026-09-20T13:00:00.000Z', day13: '2026-09-23T13:00:00.000Z', expiresAt: '2026-09-18T03:00:00.000Z' });
  // Day 13 crosses the November DST change and must stay at 9 AM local.
  assert.equal(schedule('2026-10-27T18:00:00Z').day13, '2026-11-08T14:00:00.000Z');
  assert.equal(schedule('2026-09-13T15:00:00Z').expiresAt, '2026-09-20T00:00:00.000Z');
  // UTC date is not the redemption date in Fort Wayne.
  assert.equal(schedule('2026-09-12T02:00:00Z').expiresAt, '2026-09-18T03:00:00.000Z');
  assert.equal(schedule('2026-03-03T19:00:00Z').day7, '2026-03-09T13:00:00.000Z');
  assert.equal(schedule('2026-10-27T18:00:00Z').day7, '2026-11-02T14:00:00.000Z');
  assert.equal(schedule(null).expiresAt, null); assert.equal(schedule('bad').day7, null);
  assert.match(deadline('2026-09-11T20:09:05Z'), /September 17, 2026 at 11:00 PM Eastern/);
});
test('both offer emails have the approved PT quantities and identical personal deadline', () => {
  for (const template of [day5Email, day7Email]) {
    const email = template('cole@sweetdreams.us', '2026-09-11T20:09:05Z');
    assert.match(email.text, /Essential or Plus: 1 free PT session with Kings Nutrition/);
    assert.match(email.text, /Elite: 2 free PT sessions with Kings Nutrition in total/);
    assert.match(email.text, /September 17, 2026 at 11:00 PM Eastern/);
    assert.match(email.text, /Complete your membership enrollment at the front desk/);
    assert.doesNotMatch(email.text, /four week|coach check|discount|3 free PT/i);
    assert.throws(() => template('test@example.com', null));
  }
  assert.match(day7Email('cole@sweetdreams.us', '2026-09-11T20:09:05Z').text, /ends at closing today/);
});
