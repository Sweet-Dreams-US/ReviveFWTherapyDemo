(function () {
  'use strict';
  var form = document.getElementById('claimPassForm');
  if (!form) return;
  var button = document.getElementById('claimSubmit'), error = document.getElementById('claimError');
  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (button.disabled || !form.reportValidity()) return;
    error.textContent = '';
    var data = new FormData(form), token = data.get('cf-turnstile-response');
    if (!token) { error.textContent = 'Please complete the security check. If it has not loaded, refresh and try again.'; return; }
    button.disabled = true; button.textContent = 'Claiming…';
    var name = String(data.get('fullName') || '').trim(), email = String(data.get('email') || '').trim().toLowerCase();
    try {
      var response = await fetch('/api/claim-pass', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: name, email: email, phone: data.get('phone') || '', company: data.get('company') || '', turnstileToken: token, marketingConsent: data.get('marketingConsent') === 'on', adMeasurement: !!(window.reviveMeta && typeof window.reviveMeta.allowed === 'function' && window.reviveMeta.allowed()) }),
        signal: AbortSignal.timeout(55000)
      });
      var result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Could not save your claim. Please try again.');
      if (result.meta_event_id && window.reviveMeta) {
        window.reviveMeta.track('Lead', { content_name: 'Free 7 Day Gym and Recovery Pass', content_category: 'Membership' }, result.meta_event_id);
      }
      document.getElementById('claimReceipt').textContent = name + '\n' + email + '\nFREE Gym & Recovery for 7 Days';
      document.getElementById('claimEmailStatus').textContent = result.email_status === 'sent'
        ? 'A pass email has been sent to this address. You can also use this confirmation at the front desk. Submitting again does not send another email or reset an existing pass.'
        : 'Your claim is saved. Keep this confirmation for the front desk; your email may be delayed.';
      form.hidden = true; document.getElementById('claimIntro').hidden = true;
      var success = document.getElementById('claimSuccess'); success.hidden = false; success.focus();
    } catch (err) {
      error.textContent = err.name === 'TimeoutError' ? 'This is taking longer than expected. Please try again; your seven days have not started.' : err.message;
      if (window.turnstile) { try { window.turnstile.reset(); } catch (_) {} }
      button.disabled = false; button.textContent = 'Claim My Free 7-Day Pass';
    }
  });
})();
