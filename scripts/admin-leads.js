(function () {
  'use strict';
  var password = '', leads = [], requestId = 0, offset = 0, timer;
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function when(value) { return value ? new Date(value).toLocaleString('en-US', { timeZone: 'America/Indiana/Indianapolis', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' ET' : 'Not yet'; }
  function state(lead) {
    if (lead.is_member) return 'Joined';
    if (!lead.activated_at) return 'Not activated';
    return Date.now() >= Date.parse(lead.activated_at) + 7 * 86400000 ? 'Trial ended' : 'Active pass';
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
      $('leadStats').textContent = '';
      [['Total leads', data.stats.total], ['Not activated', data.stats.unactivated], ['Active passes', data.stats.active], ['Joined', data.stats.joined]].forEach(function (pair) {
        var box = el('div', 'kpi'); box.append(el('div', 'mono text-dim', pair[0]), el('div', 'kpi-value display', pair[1])); $('leadStats').appendChild(box);
      });
      var sync = data.sync || {};
      $('leadSyncStatus').textContent = 'Last successful sync: ' + when(sync.last_success_at) +
        (sync.last_error ? ' · ' + sync.last_error : '') +
        (sync.summary && sync.summary.invalidRows && sync.summary.invalidRows.length ? ' · Check incomplete sheet rows: ' + sync.summary.invalidRows.join(', ') : '') +
        (sync.last_success_at && Date.now() - Date.parse(sync.last_success_at) > 15 * 60000 ? ' · Sync is overdue. Use Sync now and check the connection.' : '');
      render();
    } catch (error) { if (id === requestId) $('leadError').textContent = error.message; }
  }
  async function update(lead, action, value, extra) {
    return api('/api/meta-leads', Object.assign({ action: action, id: lead.id, version: lead.version, value: value }, extra));
  }
  function render() {
    var opened = new Set(Array.from($('leadList').querySelectorAll('details[open]')).map(function (n) { return n.dataset.id; }));
    $('leadList').textContent = '';
    if (!leads.length) $('leadList').appendChild(el('p', 'text-soft', 'No leads match this view. Website claims appear immediately; Meta submissions appear after sheet sync.'));
    leads.forEach(function (lead) {
      var card = el('details', 'lead-card'); card.dataset.id = lead.id; card.open = opened.has(lead.id);
      var summary = el('summary'); var identity = el('div'); identity.append(el('strong', '', lead.full_name), el('div', 'lead-contact', lead.email + (lead.phone ? ' · ' + lead.phone : '')));
      summary.append(identity, el('span', 'lead-badge', state(lead))); card.append(summary);
      card.append(el('p', 'lead-source', 'Submitted: ' + when(lead.lead_created_at) + ' · Activated: ' + when(lead.activated_at) + (lead.activated_at ? ' · Pass ends: ' + when(Date.parse(lead.activated_at) + 7 * 86400000) : '')));
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
      card.append(el('p', 'mono text-dim mt-6', 'Planned follow-up · email setup pending'));
      var plan = el('ul', 'lead-plan');
      [[2, 'First visit follow-up · 2 hours after redemption'], [120, 'Day 5 · Membership options (Day 5–6)'], [168, 'Day 7 · Trial ending · bonus to be decided'], [240, 'Day 10 · Additional trial · offer to be decided'], [312, 'Day 13 · Commitment offer · rate to be decided']].forEach(function (step) {
        var row = el('li'); row.append(el('span', '', step[1]), el('span', '', lead.is_member || lead.do_not_contact ? 'Suppressed' : lead.activated_at ? when(Date.parse(lead.activated_at) + step[0] * 3600000) + ' · Paused' : 'Waiting for activation'));
        plan.append(row);
      }); card.append(plan);
      card.append(el('p', 'lead-source', 'Campaign: ' + (lead.meta.campaign_name || '—') + ' · Ad: ' + (lead.meta.ad_name || '—') + ' · Platform: ' + (lead.meta.platform || '—') + '\nFitness routine: ' + (lead.fitness_routine || '—') + '\nSource lead ID: ' + lead.meta_lead_id));
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
