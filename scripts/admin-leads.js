(function () {
  'use strict';
  var password = '', leads = [], jobs = [], requestId = 0, offset = 0, timer, shownOffer;
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function when(value) { return value ? new Date(value).toLocaleString('en-US', { timeZone: 'America/Indiana/Indianapolis', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' ET' : 'Not yet'; }
  function state(lead) {
    if (lead.is_member) return 'Joined';
    if (!lead.activated_at) return 'Not activated';
    return Date.now() >= Date.parse(window.revivePassSchedule.schedule(lead.activated_at).expiresAt) ? 'Trial ended' : 'Active pass';
  }
  async function api(url, body) {
    var response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ password: password }, body)) });
    var data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Request failed.');
    return data;
  }
  async function load(more) {
    if (!password) return;
    var id = ++requestId;
    $('leadError').textContent = '';
    try {
      var nextOffset = more ? leads.length : 0;
      var data = await api('/api/meta-leads', { action: 'list', offset: nextOffset,
        query: $('leadSearch').value.trim(), filter: $('leadFilter').value });
      if (id !== requestId || !password) return;
      leads = more ? leads.concat(data.leads) : data.leads; offset = data.total;
      jobs = more ? jobs.concat((data.automation || {}).jobs || []) : (data.automation || {}).jobs || [];
      $('leadStats').textContent = '';
      [['Total leads', data.stats.total], ['Not activated', data.stats.unactivated], ['Active passes', data.stats.active], ['Joined', data.stats.joined]].forEach(function (pair) {
        var box = el('div', 'kpi'); box.append(el('div', 'mono text-dim', pair[0]), el('div', 'kpi-value display', pair[1])); $('leadStats').appendChild(box);
      });
      var sync = data.sync || {};
      $('leadSyncStatus').textContent = 'Last successful sync: ' + when(sync.last_success_at) +
        (sync.last_error ? ' · ' + sync.last_error : '') +
        (sync.summary && sync.summary.invalidRows && sync.summary.invalidRows.length ? ' · Check incomplete sheet rows: ' + sync.summary.invalidRows.join(', ') : '') +
        (sync.last_success_at && Date.now() - Date.parse(sync.last_success_at) > 15 * 60000 ? ' · Sync is overdue. Use Sync now and check the connection.' : '');
      var run = data.automation && data.automation.run;
      $('leadSyncStatus').textContent += '\nFollowup worker: ' + when(run && run.last_run_at) +
        (run && run.last_run_at && Date.now() - Date.parse(run.last_run_at) > 15 * 60000 ? ' · Worker is overdue. Check scheduled job logs.' : '') +
        (run && run.summary && run.summary.failed ? ' · Failed sends need review.' : '');
      renderOffer((data.automation || {}).offer || null);
      render();
    } catch (error) { if (id === requestId) $('leadError').textContent = error.message; }
  }
  async function update(lead, action, value, extra) {
    return api('/api/meta-leads', Object.assign({ action: action, id: lead.id, version: lead.version, value: value }, extra));
  }
  // Day 13 sends the six month preferred rate. It holds until all three rates are saved.
  var STANDARD = [['essential', 'Essential', 89], ['plus', 'Plus', 139], ['elite', 'Elite', 169]];
  function renderOffer(offer) {
    var key = JSON.stringify(offer);
    if (key === shownOffer) return; // Leave half typed rates alone on search refreshes.
    shownOffer = key;
    var box = $('leadOffer'); box.textContent = '';
    box.append(el('div', 'mono text-dim', 'Day 13 · Six month preferred rates'),
      el('p', offer ? 'lead-offer-status is-live' : 'lead-offer-status', offer
        ? 'Live. Day 13 emails offer these monthly rates for a six month commitment.'
        : 'Not set. Day 13 emails are held until all three rates are saved. A held guest still receives it if rates are saved within 72 hours of their Day 13.'));
    var form = el('form', 'lead-offer-form'), inputs = {};
    STANDARD.forEach(function (tier) {
      var label = el('label', '', tier[1] + ' · standard $' + tier[2]), input = el('input', 'input');
      input.type = 'number'; input.min = '0.01'; input.max = String(tier[2] - 0.01); input.step = '0.01'; input.required = true;
      input.inputMode = 'decimal'; input.placeholder = 'Below $' + tier[2];
      if (offer) input.value = offer[tier[0]];
      inputs[tier[0]] = input; label.append(input); form.append(label);
    });
    var actions = el('div', 'lead-offer-actions'), save = el('button', 'btn btn-arrow', offer ? 'Update rates' : 'Save rates and start Day 13');
    save.type = 'submit'; actions.append(save);
    if (offer) {
      var clear = el('button', 'btn', 'Hold Day 13'); clear.type = 'button'; actions.append(clear);
      clear.addEventListener('click', async function () {
        if (!window.confirm('Hold all Day 13 emails? Pending ones wait until rates are saved again.')) return;
        clear.disabled = true;
        try { await api('/api/meta-leads', { action: 'set_six_month_rates', clear: true }); await load(); }
        catch (error) { $('leadError').textContent = error.message; clear.disabled = false; }
      });
    }
    form.append(actions);
    form.addEventListener('submit', async function (event) {
      event.preventDefault(); save.disabled = true; $('leadError').textContent = '';
      var rates = {}; Object.keys(inputs).forEach(function (k) { rates[k] = inputs[k].value; });
      try { await api('/api/meta-leads', { action: 'set_six_month_rates', rates: rates }); await load(); }
      catch (error) { $('leadError').textContent = error.message; save.disabled = false; }
    });
    box.append(form);
  }
  function render() {
    var opened = new Set(Array.from($('leadList').querySelectorAll('details[open]')).map(function (n) { return n.dataset.id; }));
    $('leadList').textContent = '';
    if (!leads.length) $('leadList').appendChild(el('p', 'text-soft', 'No leads match this view. Website claims appear immediately; Meta submissions appear after sheet sync.'));
    leads.forEach(function (lead) {
      var card = el('details', 'lead-card'); card.dataset.id = lead.id; card.open = opened.has(lead.id);
      var summary = el('summary'); var identity = el('div'); identity.append(el('strong', '', lead.full_name), el('div', 'lead-contact', lead.email + (lead.phone ? ' · ' + lead.phone : '')));
      summary.append(identity, el('span', 'lead-badge', state(lead))); card.append(summary);
      var passSchedule = window.revivePassSchedule.schedule(lead.activated_at);
      card.append(el('p', 'lead-source', 'Submitted: ' + when(lead.lead_created_at) + ' · Activated: ' + when(lead.activated_at) + (lead.activated_at ? ' · Pass and joining bonus end: ' + when(passSchedule.expiresAt) : '')));
      var emailState = { not_sent: 'Not sent', sending: 'Sending', sent: 'Sent — accepted by Resend', needs_review: 'Needs review — check Resend before retrying' };
      card.append(el('p', 'lead-source', 'Pass email: ' + (emailState[lead.pass_email_status] || 'Not sent') + (lead.pass_email_sent_at ? ' · ' + when(lead.pass_email_sent_at) : '') + (lead.pass_email_id ? '\nResend message ID: ' + lead.pass_email_id : '') + '\nInbox delivery, opens, and clicks are not tracked in this panel yet.'));
      var controls = el('div', 'lead-controls');
      [['activate', 'Activate pass — guest has checked in', !!lead.activated_at], ['joined', 'Joined REVIVE', lead.is_member],
        ['paused', 'Pause follow-up for this lead', lead.automation_paused], ['do_not_contact', 'Do not contact', lead.do_not_contact],
        ['confirmation_recorded', 'Confirmation already sent outside this panel', !!lead.confirmation_recorded_at]].forEach(function (spec) {
        var label = el('label'), input = el('input'); input.type = 'checkbox'; input.checked = !!spec[2];
        label.append(input, document.createTextNode(spec[1])); controls.append(label);
        input.addEventListener('change', async function () {
          var next = input.checked;
          if (spec[0] === 'activate' && !next && !window.confirm('Clear this activation date? Only do this to correct an accidental check-in.')) { input.checked = true; return; }
          controls.querySelectorAll('input').forEach(function (c) { c.disabled = true; });
          try {
            var result = await update(lead, spec[0], next);
            Object.assign(lead, result.lead); await load();
          } catch (error) { input.checked = !next; $('leadError').textContent = error.message; controls.querySelectorAll('input').forEach(function (c) { c.disabled = false; }); }
        });
      });
      card.append(controls);
      card.append(el('p', 'lead-source', 'Lifecycle controls apply to every claim with this email. Day 5 and Day 7 offers send to every activated pass unless the guest joined, unsubscribed, or is marked do not contact.' + (lead.email_unsubscribed_at ? '\nGuest unsubscribed: ' + when(lead.email_unsubscribed_at) : '')));
      var guest = el('section', 'lead-guest-feedback');
      guest.append(el('strong', '', 'Guest first visit feedback'));
      if (lead.visit_feedback_at && lead.visit_feedback) {
        var response = lead.visit_feedback;
        guest.append(el('p', '', 'Received: ' + when(lead.visit_feedback_at) + '\nRating: ' + response.rating + ' / 5 · Tried: ' + (response.areas || []).join(', ')),
          el('p', '', response.comments || 'No written comments.'));
      } else { guest.append(el('p', '', 'No response submitted yet.')); }
      card.append(guest);
      var notes = el('div', 'lead-notes'), feedbackLabel = el('label', '', 'Feedback / interests'), noteLabel = el('label', '', 'Staff notes');
      var feedback = el('textarea', 'textarea'); feedback.value = lead.feedback || ''; feedback.maxLength = 2000;
      var note = el('textarea', 'textarea'); note.value = lead.notes || ''; note.maxLength = 4000;
      feedbackLabel.append(feedback); noteLabel.append(note); notes.append(feedbackLabel, noteLabel); card.append(notes);
      var save = el('button', 'btn btn-arrow mt-4', 'Save notes'); save.type = 'button';
      save.addEventListener('click', async function () {
        save.disabled = true;
        try { var result = await update(lead, 'notes', false, { notes: note.value, feedback: feedback.value }); Object.assign(lead, result.lead); save.textContent = 'Saved'; }
        catch (error) { $('leadError').textContent = error.message; }
        finally { save.disabled = false; }
      }); card.append(save);
      card.append(el('p', 'mono text-dim mt-6', 'Automatic followup · checked every 5 minutes'));
      var plan = el('ul', 'lead-plan');
      card.append(el('p', 'lead-source', 'Join by closing on Day 7: Essential or Plus receive 1 free Kings Nutrition PT session. Elite receives 2 total. Enrollment must be completed at the front desk. PT scheduling and fulfillment are handled by staff.'));
      [['experience',lead.activated_at && Date.parse(lead.activated_at) + 2 * 3600000, 'First visit experience · 2 hours after redemption'], ['day5',passSchedule.day5, 'Day 5 · Kings Nutrition PT offer · 9 AM ET'], ['day7',passSchedule.day7, 'Day 7 · Final day reminder · 9 AM ET'], ['day10',passSchedule.day10, 'Day 10 · Three more free days · 9 AM ET'], ['day13',passSchedule.day13, 'Day 13 · Six month preferred rate · 9 AM ET']].forEach(function (step) {
        var job = jobs.find(function (j) { return j.email === lead.email && j.stage === step[0]; });
        var status = job ? job.status + (job.blocked_reason ? ' · ' + job.blocked_reason : '') + (job.accepted_at ? ' · Accepted ' + when(job.accepted_at) : '') + (job.provider_id ? '\nResend ID: ' + job.provider_id : '')
          : !lead.activated_at ? 'Waiting for activation' : 'Schedule will refresh on the next worker run';
        var row = el('li'); row.append(el('span', '', step[2]), el('span', '', (job ? when(job.due_at) : lead.activated_at ? when(step[1]) : '') + ' · ' + status));
        plan.append(row);
      }); card.append(plan);
      card.append(el('p', 'lead-source', 'Day 10 offers three more free days that start at the next front desk check in. Day 13 offers the six month preferred rate. Each can catch up for 72 hours if missed. Emails stop after joining, unsubscribe, or do not contact. A message already being sent may still arrive.'));
      card.append(el('p', 'lead-source', 'Campaign: ' + (lead.meta.campaign_name || '—') + ' · Ad: ' + (lead.meta.ad_name || '—') + ' · Platform: ' + (lead.meta.platform || '—') + '\nFitness routine: ' + (lead.fitness_routine || '—') + '\nSource lead ID: ' + lead.meta_lead_id));
      if (lead.meta.ad_measurement) card.append(el('p', 'lead-source', 'Meta website conversion: ' + lead.meta.ad_measurement.status + '\nEvent ID: ' + lead.meta.ad_measurement.event_id + '\nSent means accepted by Meta, not attributed to an ad.'));
      $('leadList').append(card);
    });
    $('leadMore').hidden = leads.length >= offset;
  }
  $('leadSyncNow').addEventListener('click', async function () {
    var button = this; button.disabled = true; button.textContent = 'Syncing…'; $('leadError').textContent = '';
    try { var result = await api('/api/meta-leads-sync', {}); await load(); if (result.busy) $('leadError').textContent = 'A sync is already running. Refresh shortly.'; }
    catch (error) { $('leadError').textContent = error.message; }
    finally { button.disabled = false; button.textContent = 'Sync now'; }
  });
  $('leadSearch').addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { load(); }, 300); });
  $('leadFilter').addEventListener('change', function () { load(); });
  $('leadMore').addEventListener('click', function () { load(true); });
  window.reviveLeads = { init: function (pw) { password = pw; if (location.hash === '#freepasses') load(); }, load: load,
    clear: function () { password = ''; leads = []; ++requestId; $('leadList').textContent = ''; $('leadStats').textContent = ''; } };
})();
