/* Consent-aware measurement. Saved pass claims alone fire Lead, with a server ID. */
(function (window, document) {
  'use strict';
  var PIXEL_ID = '1236948538486968';
  var path = window.location.pathname.replace(/\.html$/, '').replace(/\/+$/, '') || '/';
  var production = /^(www\.)?revivefw\.com$/.test(window.location.hostname);
  var privatePage = /^\/(admin|pass-feedback|careers)(\/|$)/.test(path);
  var eligible = production && !privatePage && path !== '/privacy';
  var gpc = window.navigator.globalPrivacyControl === true;
  var active = false, initialized = false;
  function choice() { var m = document.cookie.match(/(?:^|;\s*)revive_ads=(yes|no)(?:;|$)/); return m ? m[1] : null; }
  function permitted() { return eligible && !gpc && choice() === 'yes'; }
  function eraseCookie(name) {
    [null, window.location.hostname, '.revivefw.com'].forEach(function (domain) {
      document.cookie = name + '=; Max-Age=0; Path=/; SameSite=Lax; Secure' + (domain ? '; Domain=' + domain : '');
    });
  }
  function start() {
    if (!permitted()) return;
    active = true;
    if (initialized) { window.fbq('consent', 'grant'); return; }
    initialized = true;
    // Remove arbitrary contact parameters and private fragments before loading Meta.
    var url = new URL(window.location.href), safe = new URL(url.origin + url.pathname);
    ['fbclid','utm_source','utm_medium','utm_campaign','utm_content','utm_term','campaign_id','adset_id','ad_id'].forEach(function (key) {
      var value = url.searchParams.get(key);
      if (value && /^[A-Za-z0-9_.~{} -]{1,500}$/.test(value)) safe.searchParams.set(key, value);
    });
    if (['#redeem','#claim','#memberships'].indexOf(url.hash) !== -1) safe.hash = url.hash;
    if (safe.href !== url.href) window.history.replaceState(window.history.state, '', safe.href);
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
    document,'script','https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('consent', 'grant');
    window.fbq('set', 'autoConfig', false, PIXEL_ID);
    window.fbq('init', PIXEL_ID);
    window.fbq('track', 'PageView');
    var offers = { '/free-pass': 'Free 7 Day Pass', '/join': 'Membership Options', '/pricing': 'Membership Pricing' };
    if (offers[path]) api.track('ViewContent', { content_name: offers[path], content_category: 'Membership' });
  }
  var api = {
    configured: eligible, allowed: permitted,
    newEventId: function () { return window.crypto.randomUUID(); },
    track: function (name, params, eventId) {
      if (!active || !permitted() || typeof window.fbq !== 'function') return false;
      if (['ViewContent','Lead','Contact','FindLocation'].indexOf(name) === -1) return false;
      if (name === 'Lead' && !/^website-pass-[a-f0-9-]{36}$/.test(eventId || '')) return false;
      try { window.fbq('track', name, params || {}, eventId ? { eventID: eventId } : undefined); return true; }
      catch (_) { return false; }
    }
  };
  window.reviveMeta = api;
  if (!production || privatePage) return;
  if (gpc || choice() === 'no') { eraseCookie('_fbp'); eraseCookie('_fbc'); }
  start();
  function preferences() {
    var panel = document.getElementById('adPrivacyPanel'); if (panel) { panel.hidden = false; return; }
    panel = document.createElement('section'); panel.id = 'adPrivacyPanel'; panel.setAttribute('aria-label', 'Advertising privacy');
    panel.style.cssText = 'position:fixed;bottom:18px;left:18px;right:18px;max-width:520px;z-index:10000;background:#f5f0e7;color:#211a15;border:1px solid #b9aa98;padding:20px;box-shadow:0 8px 35px #0004;font:14px/1.5 Arial,sans-serif;';
    var text = document.createElement('p'); text.style.margin = '0 0 14px';
    text.textContent = gpc ? 'Your browser privacy signal is on. Meta advertising measurement is off. You can still claim and redeem your pass.' : 'Allow advertising measurement? Meta can receive visits and successful pass claims, including hashed email and optional phone for matching. Your choice does not affect your pass.';
    panel.appendChild(text);
    function button(label, value) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = label;
      b.style.cssText = 'padding:12px 16px;margin:0 8px 10px 0;min-height:44px;border:1px solid #211a15;background:#211a15;color:#fff;font:inherit;cursor:pointer;';
      b.addEventListener('click', function () {
        document.cookie = 'revive_ads=' + value + '; Path=/; Max-Age=15552000; SameSite=Lax; Secure';
        if (value === 'yes') start();
        else { active = false; if (window.fbq) window.fbq('consent', 'revoke'); eraseCookie('_fbp'); eraseCookie('_fbc'); }
        panel.hidden = true;
      }); panel.appendChild(b);
    }
    if (!gpc) button('Allow', 'yes'); button(gpc ? 'Got it' : 'Decline', 'no');
    var link = document.createElement('a'); link.href = '/privacy'; link.textContent = 'Privacy policy'; link.style.cssText = 'display:inline-block;color:#872613;text-decoration:underline;'; panel.appendChild(link);
    document.body.appendChild(panel);
  }
  function ready() {
    var link = document.createElement('button'); link.type = 'button'; link.textContent = 'Advertising privacy';
    link.style.cssText = 'display:block;margin:18px auto;padding:10px 16px;background:#f5f0e7;color:#211a15;border:1px solid #b9aa98;font:12px Arial,sans-serif;cursor:pointer;';
    link.addEventListener('click', preferences); (document.querySelector('footer') || document.body).appendChild(link);
    if (!choice() && !gpc) preferences();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
})(window, document);
