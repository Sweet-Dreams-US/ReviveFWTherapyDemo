/* ==========================================================================
 * REVIVE blog — static site generator (zero dependencies)
 *
 * Reads blog-content/posts/**.md + blog-content/CONTENT-CALENDAR.md and emits:
 *   - /blog.html                (index / master table of contents)
 *   - /blog/<slug>.html         (one page per PUBLISHED post, sticky scroll-spy TOC)
 *   - rewrites the blog block of /sitemap.xml
 *
 * Scheduling: the calendar assigns each post a Mon/Wed/Fri date. A post is
 * "published" when its date <= the effective date (America/New_York today,
 * or --date=YYYY-MM-DD, or everything with --all). Future posts are NOT written
 * to disk, so unreleased content never ships.
 *
 * Usage:
 *   node scripts/build-blog.js                 # publish up to today (Eastern)
 *   node scripts/build-blog.js --date=2026-09-15
 *   node scripts/build-blog.js --all           # every post (local preview only)
 *   node scripts/build-blog.js --start=today   # remap the calendar so post #1 = today, MWF onward
 * ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

// ---- release schedule (owner decision, Aug 1 2026): seed a month, then drip ----
// The first SEED posts (calendar order) go live on LAUNCH; every post after that
// drips Mon/Wed/Fri starting DRIP_START. Baked in here so the daily automation
// reproduces the exact same dates with no arguments.
const SCHEDULE = { LAUNCH: '2026-08-01', SEED: 12, DRIP_START: '2026-08-03' };

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'blog-content');
const POSTS_DIR = path.join(SRC, 'posts');
const CAL = path.join(SRC, 'CONTENT-CALENDAR.md');
const OUT_DIR = path.join(ROOT, 'blog');
const SITE = 'https://revivefw.com';

// ---- args ----
const args = process.argv.slice(2);
const ALL = args.includes('--all');
const dateArg = (args.find(a => a.startsWith('--date=')) || '').split('=')[1];
const startArg = (args.find(a => a.startsWith('--start=')) || '').split('=')[1];

function easternToday() {
  // YYYY-MM-DD in America/New_York regardless of where the build runs
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const g = t => parts.find(p => p.type === t).value;
  return `${g('year')}-${g('month')}-${g('day')}`;
}
const TODAY = dateArg || easternToday();

// ==========================================================================
// helpers
// ==========================================================================
function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function attr(s) { return esc(s).replace(/"/g, '&quot;'); }
function slugId(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}
function addDaysMWF(startISO, index) {
  // index 0 -> start; steps advance Mon,Wed,Fri (skip weekends), 3 per week
  const d = new Date(startISO + 'T12:00:00Z');
  let placed = 0;
  // normalize start to a Monday
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  const weekday = [1, 3, 5]; // Mon Wed Fri
  const week = Math.floor(index / 3);
  const slot = index % 3;
  d.setUTCDate(d.getUTCDate() + week * 7 + (weekday[slot] - 1));
  return d.toISOString().slice(0, 10);
}
function prettyDate(iso) {
  const [y, m, dd] = iso.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[m - 1]} ${dd}, ${y}`;
}

// ==========================================================================
// front-matter
// ==========================================================================
function parseFrontMatter(raw) {
  if (!raw.startsWith('---')) return { data: {}, body: raw };
  const end = raw.indexOf('\n---', 3);
  const fm = raw.slice(3, end).trim();
  const body = raw.slice(end + 4).replace(/^\s*\n/, '');
  const data = {};
  for (const line of fm.split('\n')) {
    const m = line.match(/^([a-z_]+):\s*(.*)$/);
    if (!m) continue;
    let [, k, v] = m;
    v = v.trim();
    if (v.startsWith('[')) {
      try { data[k] = JSON.parse(v.replace(/'/g, '"')); }
      catch { data[k] = v.replace(/^\[|\]$/g, '').split(',').map(s => s.trim().replace(/^["']|["']$/g, '')); }
    } else {
      data[k] = v.replace(/^["']|["']$/g, '');
    }
  }
  return { data, body };
}

// ==========================================================================
// inline markdown -> HTML  (**bold**, *italic*, `code`, [text](url))
// url https://revivefw.com/x is rewritten to root-relative /x
// ==========================================================================
function inline(text) {
  let s = esc(text.trim());
  // links first (before * handling); text/url captured from escaped string
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
    let href = url.trim();
    let external = /^https?:\/\//.test(href) && !href.includes('revivefw.com');
    href = href.replace(/^https?:\/\/revivefw\.com/, '') || '/';
    const rel = external ? ' target="_blank" rel="noopener"' : '';
    return `<a href="${attr(href)}"${rel}>${label}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  return s;
}

// ==========================================================================
// block markdown -> HTML for a chunk of lines
// ==========================================================================
function renderBlocks(lines) {
  const out = [];
  let i = 0;
  const n = lines.length;
  let para = [];
  const flush = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };

  while (i < n) {
    const line = lines[i];
    const t = line.trim();
    if (t === '') { flush(); i++; continue; }

    if (/^### /.test(t)) { flush(); out.push(`<h3>${inline(t.slice(4))}</h3>`); i++; continue; }

    if (/^- /.test(t)) {
      flush(); const items = [];
      while (i < n && /^- /.test(lines[i].trim())) { items.push(`<li>${inline(lines[i].trim().slice(2))}</li>`); i++; }
      out.push(`<ul>${items.join('')}</ul>`); continue;
    }
    if (/^\d+\. /.test(t)) {
      flush(); const items = [];
      while (i < n && /^\d+\. /.test(lines[i].trim())) { items.push(`<li>${inline(lines[i].trim().replace(/^\d+\.\s/, ''))}</li>`); i++; }
      out.push(`<ol>${items.join('')}</ol>`); continue;
    }
    if (/^\|/.test(t)) {
      flush(); const rows = [];
      while (i < n && /^\|/.test(lines[i].trim())) { rows.push(lines[i].trim()); i++; }
      const cells = r => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const isSep = r => /^\|?[\s:|-]+\|?$/.test(r) && r.includes('-');
      let html = '<div class="tbl-wrap"><table>';
      rows.forEach((r, idx) => {
        if (isSep(r)) return;
        const tag = idx === 0 ? 'th' : 'td';
        html += '<tr>' + cells(r).map(c => `<${tag}>${inline(c)}</${tag}>`).join('') + '</tr>';
      });
      html += '</table></div>';
      out.push(html); continue;
    }
    para.push(t); i++;
  }
  flush();
  return out.join('\n');
}

// ==========================================================================
// split a post body into intro + H2 sections
// ==========================================================================
function sectionize(body) {
  const lines = body.split('\n');
  const intro = [];
  const sections = [];
  let cur = null;
  for (const line of lines) {
    const m = line.match(/^## (.+)$/);
    if (m) { if (cur) sections.push(cur); cur = { title: m[1].trim(), id: slugId(m[1].trim()), lines: [] }; }
    else (cur ? cur.lines : intro).push(line);
  }
  if (cur) sections.push(cur);
  return { intro, sections };
}

// ==========================================================================
// load + model all posts
// ==========================================================================
function parseCalendar() {
  const raw = fs.readFileSync(CAL, 'utf8');
  const map = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^\|\s*(\d+)\s*\|\s*(\d{4}-\d{2}-\d{2})\s*\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*`?([^|`]+?)`?\s*\|\s*`?([^|`]+?)`?\s*\|/);
    if (!m) continue;
    const [, num, date, wk, category, title, link, file] = m;
    map[file.trim()] = { num: +num, date, week: +wk, category: category.trim(), title: title.trim(), link: link.trim() };
  }
  return map;
}

function loadPosts() {
  const cal = parseCalendar();
  const files = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.md')) files.push(p);
    }
  })(POSTS_DIR);

  const posts = files.map(fp => {
    const rel = 'posts/' + path.relative(POSTS_DIR, fp).replace(/\\/g, '/');
    const { data, body } = parseFrontMatter(fs.readFileSync(fp, 'utf8'));
    const c = cal[rel];
    if (!c) { console.warn('!! no calendar entry for', rel); }
    const { intro, sections } = sectionize(body);
    return {
      rel, data, intro, sections,
      slug: data.slug,
      title: data.title,
      num: c ? c.num : 9999,
      date: c ? c.date : null,
      week: c ? c.week : null,
      category: (c && c.category) || data.category,
      linkTarget: c ? c.link : null,
    };
  });

  // ordering / effective dates
  posts.sort((a, b) => a.num - b.num);
  // Standalone timely posts (not in the curriculum calendar) carry their own
  // `publish_date` in front-matter and publish on that date — they do NOT consume
  // a Mon/Wed/Fri drip slot. Everything else follows the seed-then-drip schedule.
  const isStandalone = (p) => p.num === 9999 && p.data.publish_date;
  let ci = 0;
  if (startArg) {
    const start = startArg === 'today' ? TODAY : startArg;
    posts.forEach((p) => { if (isStandalone(p)) p.date = p.data.publish_date; else { p.date = addDaysMWF(start, ci); ci++; } });
  } else {
    posts.forEach((p) => {
      if (isStandalone(p)) { p.date = p.data.publish_date; return; }
      p.date = ci < SCHEDULE.SEED ? SCHEDULE.LAUNCH : addDaysMWF(SCHEDULE.DRIP_START, ci - SCHEDULE.SEED);
      ci++;
    });
  }
  return posts;
}

// ==========================================================================
// shared HTML fragments
// ==========================================================================
function head(o) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${attr(o.title)}</title>
<meta name="description" content="${attr(o.desc)}" />
<link rel="canonical" href="${o.canonical}" />
<meta property="og:site_name" content="REVIVE Fitness &amp; Recovery" />
<meta property="og:type" content="${o.ogType || 'website'}" />
<meta property="og:url" content="${o.canonical}" />
<meta property="og:title" content="${attr(o.ogTitle || o.title)}" />
<meta property="og:description" content="${attr(o.desc)}" />
<meta property="og:image" content="${SITE}/assets/og-image.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${attr(o.ogTitle || o.title)}" />
<meta name="twitter:description" content="${attr(o.desc)}" />
<meta name="twitter:image" content="${SITE}/assets/og-image.png" />
<meta name="theme-color" content="#0B0807" />
${o.jsonld ? `<script type="application/ld+json">\n${o.jsonld}\n</script>\n` : ''}<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Montserrat:wght@600;700&family=Cormorant+Garamond:ital,wght@1,400;1,500&family=Manrope:wght@200;300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="${o.depth}styles/globals.css" />
<link rel="stylesheet" href="${o.depth}styles/blog.css" />
<link rel="icon" href="/favicon.ico" sizes="32x32" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
</head>
<body>`;
}

function nav(depth) {
  return `
<nav class="nav" id="nav">
  <a href="/" class="nav-brand">REVIVE</a>
  <div class="nav-links" id="navLinks">
    <a href="/" class="nav-link">Home</a>
    <a href="/pricing" class="nav-link">Membership</a>
    <a href="/why-revive" class="nav-link">Why Revive?</a>
    <a href="/grand-opening" class="nav-link">Grand Opening</a>
    <a href="/run-club" class="nav-link">Run Club</a>
    <a href="/careers" class="nav-link">Careers</a>
  </div>
  <a href="/join" class="nav-cta">Join Waitlist <span aria-hidden="true">&rarr;</span></a>
  <button class="nav-toggle" id="navToggle" aria-label="Toggle menu"><span></span><span></span><span></span></button>
</nav>`;
}

function footer() {
  return `
<footer class="footer">
  <div class="wrap">
    <div class="footer-brand">REVIVE<span class="text-fire">.</span></div>
    <div class="footer-grid mt-8">
      <div class="footer-col"><h4>Visit</h4><p class="text-soft" style="line-height:1.6;">3233 St Joe Center Rd<br />Fort Wayne, IN 46835</p></div>
      <div class="footer-col"><h4>Explore</h4><ul><li><a href="/why-revive">Why Revive?</a></li><li><a href="/pricing">Membership</a></li><li><a href="/grand-opening">Grand Opening</a></li><li><a href="/run-club">Run Club</a></li><li><a href="/blog">Blog</a></li><li><a href="/careers">Careers</a></li></ul></div>
      <div class="footer-col"><h4>Join</h4><ul><li><a href="/join">Founders Waitlist</a></li><li><a href="https://apps.apple.com/us/app/revive-fitness-and-recovery/id6768313510" target="_blank" rel="noopener">Member App</a></li></ul></div>
      <div class="footer-col"><h4>Follow</h4><ul><li><a href="https://instagram.com/revivefitnessfw" target="_blank" rel="noopener">Instagram</a></li><li><a href="mailto:info@revivefw.com">info@revivefw.com</a></li></ul></div>
    </div>
    <div class="footer-bottom"><span>&copy; <span data-year>2026</span> <span class="brand">Revive</span> Fitness &amp; Recovery</span><span>Site by <a href="https://sweetdreamsmusic.com" target="_blank" rel="noopener" class="credit">Sweet Dreams US</a></span></div>
  </div>
</footer>
<script src="/scripts/main.js" defer></script>
<script src="/scripts/blog.js" defer></script>
<!-- Vercel Web Analytics -->
<script>window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments);};</script>
<script defer src="/_vercel/insights/script.js"></script>
</body>
</html>`;
}

// ==========================================================================
// render one post page
// ==========================================================================
function renderPost(post, prev, next) {
  const d = post.data;
  const introHtml = renderBlocks(post.intro);
  const tocItems = [];
  let sectionsHtml = '';
  for (const sec of post.sections) {
    const inner = renderBlocks(sec.lines);
    const isTip = /^the revive tip/i.test(sec.title);
    const isNext = /^what to read next/i.test(sec.title);
    tocItems.push({ id: sec.id, title: sec.title, kind: isTip ? 'tip' : isNext ? 'next' : 'normal' });
    if (isTip) {
      sectionsHtml += `\n<aside class="revive-tip" id="${sec.id}"><div class="revive-tip-label mono">Revive Tip</div><h2 class="revive-tip-h">${esc(sec.title)}</h2>${inner}</aside>`;
    } else if (isNext) {
      sectionsHtml += `\n<section class="read-next" id="${sec.id}"><h2>${esc(sec.title)}</h2>${inner}${next ? `<a class="read-next-link" href="/blog/${next.slug}">${esc(next.title)} <span aria-hidden="true">&rarr;</span></a>` : ''}</section>`;
    } else {
      sectionsHtml += `\n<section id="${sec.id}"><h2>${esc(sec.title)}</h2>${inner}</section>`;
    }
  }

  const toc = tocItems.map(t =>
    `<li class="toc-${t.kind}"><a href="#${t.id}" data-toc="${t.id}">${esc(t.title)}</a></li>`).join('\n        ');

  const canonical = `${SITE}/blog/${post.slug}`;
  const kw = [d.primary_keyword].concat(d.secondary_keywords || []).filter(Boolean).join(', ');
  const jsonld = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: d.title,
    description: d.meta_description,
    datePublished: post.date,
    dateModified: post.date,
    author: { '@type': 'Organization', name: 'REVIVE Fitness & Recovery' },
    publisher: { '@type': 'Organization', name: 'REVIVE Fitness & Recovery', logo: { '@type': 'ImageObject', url: `${SITE}/assets/og-image.png` } },
    mainEntityOfPage: canonical,
    image: `${SITE}/assets/og-image.png`,
    articleSection: post.category,
    keywords: kw,
    wordCount: d.word_count,
  }, null, 2);

  const prevNext = `<nav class="post-pager">
      ${prev ? `<a class="pager-prev" href="/blog/${prev.slug}"><span class="mono">&larr; Previous</span><span>${esc(prev.title)}</span></a>` : '<span></span>'}
      ${next ? `<a class="pager-next" href="/blog/${next.slug}"><span class="mono">Next &rarr;</span><span>${esc(next.title)}</span></a>` : '<span></span>'}
    </nav>`;

  return head({
    title: `${d.title} | REVIVE Fort Wayne`,
    desc: d.meta_description,
    canonical, ogType: 'article', depth: '/', jsonld,
  }) + nav(1) + `
<main class="blog-post">
  <div class="wrap">
    <nav class="crumbs mono"><a href="/">Home</a> <span>/</span> <a href="/blog">Blog</a> <span>/</span> <span class="text-dim">${esc(post.category)}</span></nav>
    <div class="post-layout">
      <article class="post-body">
        <header class="post-head">
          <div class="post-eyebrow mono"><span class="text-fire">${esc(post.category)}</span> &nbsp;/&nbsp; ${esc(d.reading_time || '')} read${post.date ? ` &nbsp;/&nbsp; ${prettyDate(post.date)}` : ''}</div>
          <h1 class="post-title">${esc(d.title)}</h1>
          ${d.course ? `<p class="post-course mono text-dim">${esc(d.course)}</p>` : ''}
        </header>
        <div class="post-intro">${introHtml}</div>
        ${sectionsHtml}
        ${prevNext}
      </article>
      <aside class="post-toc-wrap">
        <div class="post-toc" id="postToc">
          <button class="toc-toggle mono" id="tocToggle" aria-expanded="false">On this page <span aria-hidden="true">&uarr;</span></button>
          <nav class="toc-nav" aria-label="On this page">
            <div class="toc-title mono">On this page</div>
            <ul>
        ${toc}
            </ul>
            <a class="toc-cta btn btn-primary btn-arrow" href="${post.linkTarget || '/join'}">Visit Revive</a>
          </nav>
        </div>
      </aside>
    </div>
  </div>
</main>` + footer();
}

// ==========================================================================
// render index (master table of contents)
// ==========================================================================
function renderIndex(published) {
  const byCat = {};
  for (const p of published) { (byCat[p.category] = byCat[p.category] || []).push(p); }
  const catOrder = ['News', 'Training', 'Recovery', 'Nutrition', 'Mindset', 'Health Basics'];
  const cats = Object.keys(byCat).sort((a, b) => {
    const ia = catOrder.indexOf(a), ib = catOrder.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  const latest = published.slice().sort((a, b) => {
    const d = (b.date || '').localeCompare(a.date || '');
    if (d) return d;
    return (a.category === 'News' ? 0 : 1) - (b.category === 'News' ? 0 : 1); // timely posts lead ties
  }).slice(0, 3);
  const latestHtml = latest.map(p => `
        <a class="feat-card" href="/blog/${p.slug}">
          <div class="feat-cat mono text-fire">${esc(p.category)}</div>
          <h3 class="feat-title">${esc(p.title)}</h3>
          <p class="feat-desc text-soft">${esc(p.data.meta_description)}</p>
          <div class="feat-meta mono text-dim">${esc(p.data.reading_time || '')} read${p.date ? ` &middot; ${prettyDate(p.date)}` : ''}</div>
        </a>`).join('');

  const catNav = cats.map(c => `<a href="#${slugId(c)}" class="cat-chip mono">${esc(c)} <span class="text-dim">${byCat[c].length}</span></a>`).join('\n      ');

  const sections = cats.map(c => {
    const items = byCat[c].slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(p => `
          <li class="idx-row">
            <a href="/blog/${p.slug}" class="idx-link">
              <span class="idx-title">${esc(p.title)}</span>
              <span class="idx-desc text-soft">${esc(p.data.meta_description)}</span>
            </a>
            <span class="idx-meta mono text-dim">${esc(p.data.reading_time || '')}</span>
          </li>`).join('');
    return `
      <section class="idx-cat" id="${slugId(c)}">
        <div class="idx-cat-head">
          <h2 class="idx-cat-title">${esc(c)}</h2>
          <span class="mono text-dim">${byCat[c].length} article${byCat[c].length === 1 ? '' : 's'}</span>
        </div>
        <ul class="idx-list">${items}</ul>
      </section>`;
  }).join('');

  const count = published.length;
  const jsonld = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Blog',
    name: 'The Revive Journal',
    description: 'Training, recovery, nutrition and health basics from REVIVE Fitness & Recovery in Fort Wayne, Indiana.',
    url: `${SITE}/blog`, publisher: { '@type': 'Organization', name: 'REVIVE Fitness & Recovery' },
  }, null, 2);

  const empty = count === 0;

  return head({
    title: 'The Revive Journal — Training, Recovery & Health | REVIVE Fort Wayne',
    desc: 'Plain-English guides to training, recovery, nutrition and how your body actually works — from the coaches at REVIVE Fitness & Recovery in Fort Wayne, Indiana.',
    canonical: `${SITE}/blog`, depth: '/', jsonld,
  }) + nav(1) + `
<section class="page-header blog-hero">
  <div class="wrap">
    <div class="grid-12">
      <div style="grid-column: 1 / span 7;" data-reveal>
        <span class="eyebrow">The Revive Journal</span>
        <h1 class="display fade-up" style="font-size: clamp(3rem, 8vw, 7rem); margin-top: 1.5rem; line-height:0.9;">
          Train smart.<br /><span class="editorial text-cream">Recover smarter.</span>
        </h1>
      </div>
      <div style="grid-column: 9 / -1; align-self:end;" data-reveal data-delay="2">
        <p class="lead">Plain-English guides to how your body actually works — training, recovery, nutrition, and the science underneath it. Written by the coaches at <span class="brand">Revive</span>. Three new articles a week.</p>
      </div>
    </div>
  </div>
</section>` + (empty ? `
<section class="section"><div class="wrap center">
  <p class="lead text-soft">The first articles drop soon. <a href="/join" class="text-fire">Join the waitlist</a> and we'll tell you when.</p>
</div></section>` : `
<section class="section section-tight">
  <div class="wrap">
    <div class="mono text-dim" style="margin-bottom: var(--s-4);">Latest</div>
    <div class="feat-grid">${latestHtml}</div>
  </div>
</section>

<section class="section" style="background: var(--bg-1); border-block: 1px solid var(--border);">
  <div class="wrap">
    <div class="idx-topnav" data-reveal>
      <h2 class="h-2">Browse everything</h2>
      <div class="cat-chips">
      ${catNav}
      </div>
    </div>
    ${sections}
  </div>
</section>`) + footer();
}

// ==========================================================================
// sitemap
// ==========================================================================
function updateSitemap(published) {
  const file = path.join(ROOT, 'sitemap.xml');
  let xml = fs.readFileSync(file, 'utf8');
  const block = ['  <!-- BLOG:START -->',
    `  <url><loc>${SITE}/blog</loc><lastmod>${TODAY}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`,
  ].concat(published.map(p =>
    `  <url><loc>${SITE}/blog/${p.slug}</loc><lastmod>${p.date || TODAY}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>`))
    .concat(['  <!-- BLOG:END -->']).join('\n');
  if (xml.includes('<!-- BLOG:START -->')) {
    xml = xml.replace(/\s*<!-- BLOG:START -->[\s\S]*?<!-- BLOG:END -->/, '\n' + block);
  } else {
    xml = xml.replace('</urlset>', block + '\n</urlset>');
  }
  fs.writeFileSync(file, xml);
}

// ==========================================================================
// main
// ==========================================================================
function main() {
  const posts = loadPosts();
  const published = ALL ? posts : posts.filter(p => p.date && p.date <= TODAY);

  // clean out stale generated pages
  if (fs.existsSync(OUT_DIR)) for (const f of fs.readdirSync(OUT_DIR)) if (f.endsWith('.html')) fs.unlinkSync(path.join(OUT_DIR, f));
  fs.mkdirSync(OUT_DIR, { recursive: true });

  published.forEach((p, i) => {
    const prev = published[i - 1] || null;
    const next = published[i + 1] || null;
    fs.writeFileSync(path.join(OUT_DIR, `${p.slug}.html`), renderPost(p, prev, next));
  });

  fs.writeFileSync(path.join(ROOT, 'blog.html'), renderIndex(published));
  updateSitemap(published);

  console.log(`effective date: ${TODAY}${ALL ? ' (--all)' : ''}${startArg ? ` (start=${startArg})` : ''}`);
  console.log(`posts total: ${posts.length} | published: ${published.length} | pages written: ${published.length + 1}`);
  if (published.length) {
    console.log(`first: ${published[0].date} ${published[0].slug}`);
    console.log(`last:  ${published[published.length - 1].date} ${published[published.length - 1].slug}`);
  }
}
main();
