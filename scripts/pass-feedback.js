(function () {
  'use strict';
  var token = new URLSearchParams(location.hash.slice(1)).get('token');
  var form = document.getElementById('visitFeedbackForm'), status = document.getElementById('feedbackStatus');
  var error = document.getElementById('feedbackError'), button = document.getElementById('feedbackSubmit');
  async function request(values) {
    var response = await fetch('/api/pass-feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
      body: JSON.stringify(Object.assign({ token: token }, values)) });
    var data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Please try again shortly.');
    return data;
  }
  function thanks() {
    form.hidden = true; status.hidden = true;
    document.getElementById('feedbackThanks').hidden = false;
    document.getElementById('feedbackThanks').focus();
  }
  if (!token) { status.textContent = 'Please open the personal feedback button in your REVIVE email. This form needs your private link.'; return; }
  request({ action: 'load' }).then(function (data) {
    if (data.submitted) { thanks(); return; }
    document.getElementById('guestName').value = data.fullName;
    document.getElementById('guestEmail').value = data.email;
    status.hidden = true; form.hidden = false;
    // No analytics on this page. Load CAPTCHA only after a valid link is confirmed.
    var script = document.createElement('script'); script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'; script.async = true; document.head.append(script);
  }).catch(function (e) { status.textContent = e.message; });
  form.addEventListener('submit', async function (event) {
    event.preventDefault(); error.textContent = '';
    var fields = new FormData(form), areas = fields.getAll('areas');
    if (!areas.length) { error.textContent = 'Please choose what you tried.'; return; }
    button.disabled = true; button.textContent = 'SAVING…';
    try {
      await request({ action: 'submit', rating: Number(fields.get('rating')), areas: areas, comments: document.getElementById('visitComments').value,
        wantsHelp: false, turnstileToken: fields.get('cf-turnstile-response') || '' });
      thanks();
    } catch (e) { error.textContent = e.message; if (window.turnstile) window.turnstile.reset(); }
    finally { button.disabled = false; button.textContent = 'SHARE MY EXPERIENCE ↗'; }
  });
})();
