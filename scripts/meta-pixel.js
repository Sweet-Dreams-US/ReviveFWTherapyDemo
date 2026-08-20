/* ==========================================================================
 * REVIVE — Meta Pixel (browser side)
 *
 * Loaded synchronously from the <head> of every public page, so PageView fires
 * on every load. The Pixel ID lives here and nowhere else — it is a public
 * identifier (it ships in the page source by design), NOT a secret. The CAPI
 * access token is the secret half and stays in Vercel env (META_CAPI_TOKEN).
 *
 * Events this file owns:
 *   PageView     — automatic, every page.
 *   ViewContent  — offer pages only (see OFFER_PAGES), so "saw the offer" is
 *                  separable from "saw any page".
 *
 * Lead is NOT fired here. It fires from the join form's success handler in
 * join.html, only after /api/inquiry returns 200 — see reviveMeta.track().
 *
 * Server-side deduplication: every event we fire gets an event_id. When the
 * same event is also sent from the server (api/inquiry.js -> api/_meta.js),
 * both sides send the SAME id and Meta counts it once. Never send a browser
 * event and a server event for one action without a shared id.
 * ========================================================================== */
(function (window, document) {
  'use strict';

  // ---- Config -------------------------------------------------------------
  // Events Manager dataset "ReviveFWwebsiteData".
  // Must match META_PIXEL_ID in the Vercel env, or browser and server events
  // land on different pixels and dedup silently fails.
  var PIXEL_ID = '1236948538486968';

  // Pathnames that also fire ViewContent, with the content_name Meta reports on.
  var OFFER_PAGES = {
    '/free-pass': 'Free 7-Day Pass — Landing Page',
    '/join': 'Join / Membership Enquiry',
    '/pricing': 'Membership Pricing'
  };

  var CONFIGURED = /^\d{6,}$/.test(PIXEL_ID);

  // ---- Public helper ------------------------------------------------------
  // reviveMeta.newEventId() -> id to send to the server as `metaEventId`
  // reviveMeta.track(name, params, eventId) -> browser-side standard event
  // Both are safe to call before/without a configured pixel: they no-op.
  var api = {
    configured: CONFIGURED,
    newEventId: function () {
      try {
        if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
      } catch (e) {}
      return 'ev-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
    },
    track: function (name, params, eventId) {
      if (!CONFIGURED || typeof window.fbq !== 'function') return false;
      try {
        window.fbq('track', name, params || {}, eventId ? { eventID: eventId } : undefined);
        return true;
      } catch (e) {
        return false;
      }
    }
  };
  window.reviveMeta = api;

  if (!CONFIGURED) {
    // Loud in the console, invisible to visitors. Keeps deploys safe before the
    // real ID lands instead of firing events at a bogus pixel.
    if (window.console && console.warn) {
      console.warn('[REVIVE] Meta Pixel not configured — set PIXEL_ID in /scripts/meta-pixel.js');
    }
    return;
  }

  // ---- Meta base code (standard snippet) ----------------------------------
  /* eslint-disable */
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
  n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
  document,'script','https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */

  window.fbq('init', PIXEL_ID);
  window.fbq('track', 'PageView');

  // ---- ViewContent on offer pages ----------------------------------------
  // Trailing slash and .html both normalize to the clean path Vercel serves.
  var path = window.location.pathname.replace(/\.html$/, '').replace(/\/+$/, '') || '/';
  if (Object.prototype.hasOwnProperty.call(OFFER_PAGES, path)) {
    api.track('ViewContent', {
      content_name: OFFER_PAGES[path],
      content_category: 'Membership'
    }, api.newEventId());
  }
})(window, document);
