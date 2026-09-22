// ==========================================================================
// REVIVE — Site interactions
// ==========================================================================

(function() {
  'use strict';

  // ---------- Nav scroll state ----------
  const nav = document.getElementById('nav');
  const setNavState = () => {
    if (!nav) return;
    if (window.scrollY > 24) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
  };
  window.addEventListener('scroll', setNavState, { passive: true });
  setNavState();

  // ---------- Mobile nav toggle ----------
  const toggle = document.getElementById('navToggle');
  const links  = document.getElementById('navLinks');
  if (toggle && links) {
    const setMenu = (open) => {
      toggle.classList.toggle('open', open);
      links.classList.toggle('open', open);
      if (nav) nav.classList.toggle('menu-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      // The page stays visible behind the drawer, so hold it still while it is open.
      document.body.style.overflow = open ? 'hidden' : '';
    };
    const isOpen = () => links.classList.contains('open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', links.id);
    toggle.addEventListener('click', () => setMenu(!isOpen()));
    links.addEventListener('click', (e) => {
      if (e.target.tagName === 'A') setMenu(false);
    });
    // A tap on the dimmed page beside the drawer closes it. The pass button
    // sits at the foot of the drawer, so it counts as inside.
    const cta = nav ? nav.querySelector('.nav-cta') : null;
    document.addEventListener('click', (e) => {
      if (!isOpen()) return;
      const inside = links.contains(e.target) || toggle.contains(e.target) || (cta && cta.contains(e.target));
      if (!inside) setMenu(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen()) { setMenu(false); toggle.focus(); }
    });
    // Returning to the desktop row must not leave the page scroll locked.
    window.addEventListener('resize', () => {
      if (isOpen() && window.innerWidth > 800) setMenu(false);
    });
  }

  // ---------- Reveal on scroll ----------
  const revealEls = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && revealEls.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('in'));
  }

  // ---------- Animated counters ----------
  const counters = document.querySelectorAll('[data-counter]');
  if ('IntersectionObserver' in window && counters.length) {
    const ic = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = parseFloat(el.dataset.counter);
        const dur = parseInt(el.dataset.duration || '1600', 10);
        const suffix = el.dataset.suffix || '';
        const start = performance.now();
        const fmt = (n) => {
          if (target >= 1000) return Math.round(n).toLocaleString();
          if (Number.isInteger(target)) return Math.round(n).toString();
          return n.toFixed(1);
        };
        const tick = (now) => {
          const t = Math.min((now - start) / dur, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          el.textContent = fmt(target * eased) + suffix;
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        ic.unobserve(el);
      });
    }, { threshold: 0.4 });
    counters.forEach(c => ic.observe(c));
  }

  // ---------- Tilt on hover for cards (subtle) ----------
  const tiltCards = document.querySelectorAll('[data-tilt]');
  tiltCards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `perspective(1000px) rotateX(${-y * 4}deg) rotateY(${x * 4}deg) translateZ(0)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });

  // ---------- Tab system ----------
  document.querySelectorAll('[data-tabs]').forEach(group => {
    const tabs = group.querySelectorAll('[data-tab]');
    const panels = group.querySelectorAll('[data-panel]');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const id = tab.dataset.tab;
        tabs.forEach(t => t.classList.toggle('active', t === tab));
        panels.forEach(p => p.classList.toggle('active', p.dataset.panel === id));
      });
    });
  });

  // ---------- Year stamp ----------
  document.querySelectorAll('[data-year]').forEach(el => {
    el.textContent = new Date().getFullYear();
  });

  // ---------- Grand Opening countdown ----------
  // Ticks every [data-revive-countdown] toward the Grand Opening (Aug 15).
  // The date can be overridden from the operator console via /api/settings;
  // if that endpoint isn't reachable the built-in date still works.
  const cdRoots = document.querySelectorAll('[data-revive-countdown]');
  if (cdRoots.length) {
    let grandOpening = new Date('2026-08-15T00:00:00-04:00').getTime();
    const pad = (n) => String(n).padStart(2, '0');

    const renderAll = () => {
      const now = Date.now();
      let live = false;
      cdRoots.forEach(root => {
        const q = (s) => root.querySelector(s);
        let diff = grandOpening - now;
        if (diff <= 0) {
          root.classList.add('is-open');
          const label = q('[data-cd-label]');
          const sub = q('[data-cd-sub]');
          if (label) label.textContent = "We're Open";
          if (sub) sub.textContent = 'The doors are open — come see us.';
          return;
        }
        live = true;
        const d = Math.floor(diff / 86400000); diff -= d * 86400000;
        const h = Math.floor(diff / 3600000);  diff -= h * 3600000;
        const m = Math.floor(diff / 60000);    diff -= m * 60000;
        const s = Math.floor(diff / 1000);
        const set = (sel, v) => { const el = q(sel); if (el) el.textContent = pad(v); };
        set('[data-cd-days]', d); set('[data-cd-hours]', h);
        set('[data-cd-mins]', m); set('[data-cd-secs]', s);
      });
      return live;
    };

    fetch('/api/settings', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (j && j.grandOpeningDate) grandOpening = new Date(j.grandOpeningDate).getTime(); })
      .catch(() => {})
      .finally(renderAll);

    renderAll();
    const cdTimer = setInterval(() => { if (!renderAll()) clearInterval(cdTimer); }, 1000);
  }

})();
