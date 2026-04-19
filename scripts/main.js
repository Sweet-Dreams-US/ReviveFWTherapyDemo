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
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('open');
      links.classList.toggle('open');
    });
    links.addEventListener('click', (e) => {
      if (e.target.tagName === 'A') {
        toggle.classList.remove('open');
        links.classList.remove('open');
      }
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

  // ---------- Form interactions (demo only) ----------
  document.querySelectorAll('form[data-demo]').forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const wrap = form.closest('.form-wrap') || form;
      const data = Object.fromEntries(new FormData(form));
      console.log('[REVIVE Demo] Form submission:', data);

      const success = form.querySelector('.form-success');
      if (success) {
        success.classList.add('show');
        form.classList.add('submitted');
        return;
      }

      // Build success state with safe DOM methods
      while (wrap.firstChild) wrap.removeChild(wrap.firstChild);

      const successEl = document.createElement('div');
      successEl.className = 'form-success show';

      const eyebrow = document.createElement('span');
      eyebrow.className = 'mono text-fire';
      eyebrow.textContent = '— Submission Received —';
      successEl.appendChild(eyebrow);

      const heading = document.createElement('h3');
      heading.className = 'h-2 mt-4';
      heading.textContent = "You're in.";
      successEl.appendChild(heading);

      const lead = document.createElement('p');
      lead.className = 'lead mt-4';
      lead.textContent = "We'll be in touch shortly with next steps. Welcome to the Founding 200.";
      successEl.appendChild(lead);

      wrap.appendChild(successEl);
    });
  });

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

  // ---------- Pricing toggle (founders vs standard) ----------
  document.querySelectorAll('[data-price-toggle]').forEach(toggle => {
    const opts = toggle.querySelectorAll('button');
    opts.forEach(btn => {
      btn.addEventListener('click', () => {
        opts.forEach(b => b.classList.toggle('active', b === btn));
        const mode = btn.dataset.mode;
        document.querySelectorAll('[data-price]').forEach(el => {
          el.textContent = el.dataset[mode === 'founders' ? 'priceFounders' : 'priceStandard'];
        });
        document.querySelectorAll('[data-price-mode]').forEach(el => {
          el.textContent = mode === 'founders' ? 'Founding Member' : 'Standard';
        });
      });
    });
  });

  // ---------- Year stamp ----------
  document.querySelectorAll('[data-year]').forEach(el => {
    el.textContent = new Date().getFullYear();
  });

})();
