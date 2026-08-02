/* ==========================================================================
   REVIVE blog — sticky table-of-contents scroll-spy + mobile toggle.
   Loads only on blog pages. Safe no-op on the index (no #postToc).
   ========================================================================== */
(function () {
  'use strict';
  var toc = document.getElementById('postToc');
  if (!toc) return;

  var links = Array.prototype.slice.call(toc.querySelectorAll('a[data-toc]'));
  if (!links.length) return;

  var targets = links
    .map(function (a) { return document.getElementById(a.getAttribute('data-toc')); })
    .filter(Boolean);

  var activeId = null;
  function setActive(id) {
    if (id === activeId) return;
    activeId = id;
    links.forEach(function (a) {
      a.classList.toggle('is-active', a.getAttribute('data-toc') === id);
    });
  }

  // Active section = the last one whose heading has crossed the reading line
  // (a band just below the fixed nav). That's the section you're reading now.
  var LINE = 140; // px from the top of the viewport
  function recompute() {
    var current = targets[0].id;
    for (var i = 0; i < targets.length; i++) {
      if (targets[i].getBoundingClientRect().top <= LINE) current = targets[i].id;
      else break;
    }
    setActive(current);
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () { recompute(); ticking = false; });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  recompute();

  // Mobile: collapsible "On this page"
  var toggle = document.getElementById('tocToggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var open = toc.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    links.forEach(function (a) {
      a.addEventListener('click', function () {
        if (window.innerWidth <= 900) {
          toc.classList.remove('open');
          toggle.setAttribute('aria-expanded', 'false');
        }
      });
    });
  }
})();
