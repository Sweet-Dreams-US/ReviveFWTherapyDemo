/* ==========================================================================
   REVIVE blog post page: contents panel, reading progress and current section.
   Desktop shows a small panel in the bottom right corner. Mobile shows a bar
   fixed to the bottom with the current section and an arrow that opens the
   full contents. Tapping a section jumps to it and closes the contents.
   ========================================================================== */
(function () {
  'use strict';
  var toc = document.getElementById('toc');
  var article = document.getElementById('postBody');
  if (!toc || !article) return;

  var links = Array.prototype.slice.call(toc.querySelectorAll('a[data-toc]'));
  var targets = links
    .map(function (a) { return document.getElementById(a.getAttribute('data-toc')); })
    .filter(Boolean);
  if (!targets.length) return;

  var bar = document.getElementById('tocBar');
  var meter = document.getElementById('tocProgress');
  var pctA = document.getElementById('tocPct');
  var pctB = document.getElementById('tocPctBar');
  var current = document.getElementById('tocCurrent');
  var toggle = document.getElementById('tocToggle');

  var LINE = 150; // px from the top of the viewport: the heading that crossed it is the current section
  var activeId = null;
  var ticking = false;

  function setActive(id) {
    if (id === activeId) return;
    activeId = id;
    links.forEach(function (a) {
      var on = a.getAttribute('data-toc') === id;
      a.classList.toggle('is-active', on);
      if (on) {
        a.setAttribute('aria-current', 'true');
        if (current) current.textContent = a.textContent;
      } else {
        a.removeAttribute('aria-current');
      }
    });
  }

  function update() {
    ticking = false;
    var vh = window.innerHeight;

    var cur = targets[0].id;
    for (var i = 0; i < targets.length; i++) {
      if (targets[i].getBoundingClientRect().top <= LINE) cur = targets[i].id;
      else break;
    }
    setActive(cur);

    // Progress: 0 when the article's top reaches 40% of the screen, 1 when its end does.
    var rect = article.getBoundingClientRect();
    var p = Math.min(1, Math.max(0, (vh * 0.4 - rect.top) / Math.max(1, rect.height)));
    var pct = Math.round(p * 100);
    if (bar) bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    if (meter) meter.setAttribute('aria-valuenow', String(pct));
    if (pctA) pctA.textContent = pct + '%';
    if (pctB) pctB.textContent = pct + '%';

    // Once the article has been read through, the panel steps out of the way of the footer.
    var done = rect.bottom < vh * 0.4;
    toc.classList.toggle('is-hidden', done);
    if (done) closeToc();
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  }

  function closeToc() {
    if (!toc.classList.contains('open')) return;
    toc.classList.remove('open');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  }

  if (toggle) {
    toggle.addEventListener('click', function () {
      var open = toc.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  links.forEach(function (a) {
    a.addEventListener('click', function () {
      setActive(a.getAttribute('data-toc'));
      closeToc();
    });
  });

  document.addEventListener('click', function (e) {
    if (toc.classList.contains('open') && !toc.contains(e.target)) closeToc();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeToc();
  });

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () {
    if (window.innerWidth >= 1100) closeToc();
    onScroll();
  }, { passive: true });
  update();
})();
