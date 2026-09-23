(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.revivePassSchedule = api;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  var zone = 'America/Indiana/Indianapolis';
  function parts(date) {
    var out = {};
    new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date).forEach(function (p) { out[p.type] = p.value; });
    return out;
  }
  function atDay(activation, day, hour) {
    if (!activation || !Number.isFinite(Date.parse(activation))) return null;
    var p = parts(new Date(activation));
    var local = new Date(Date.UTC(+p.year, +p.month - 1, +p.day + day - 1));
    var closing = [0, 6].includes(local.getUTCDay()) ? 20 : 23;
    var target = local.getTime() + (hour == null ? closing : hour) * 3600000;
    var instant = target;
    // Resolve the local clock against the target day's actual DST offset.
    for (var i = 0; i < 3; i++) {
      var q = parts(new Date(instant));
      var represented = Date.UTC(+q.year, +q.month - 1, +q.day, +q.hour, +q.minute);
      instant += target - represented;
    }
    return new Date(instant).toISOString();
  }
  function schedule(activation) {
    return { day5: atDay(activation, 5, 9), day7: atDay(activation, 7, 9), day10: atDay(activation, 10, 9), day13: atDay(activation, 13, 9), expiresAt: atDay(activation, 7), day13Close: atDay(activation, 13) };
  }
  // Defaults to the pass closing; Day 13 passes 'day13Close' for its reopened bonus.
  function deadline(activation, which) {
    var end = schedule(activation)[which || 'expiresAt'];
    if (!end) throw new Error('An activation date is required');
    return new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(end)) + ' Eastern';
  }
  return { schedule: schedule, deadline: deadline };
});
