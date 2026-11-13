// REVIVE blog library. Posts are markdown files in content/blog (see BLOG-FORMAT).
// Nothing here is baked in at build time: api/blog.js reads the files on each
// request (the edge caches the answer for an hour), so a post appears on its
// release_on date, in Fort Wayne time, with no deploy.
'use strict';
const fs = require('fs');
const path = require('path');

const SITE = 'https://revivefw.com';
const BRAND = 'REVIVE Fitness & Recovery';
const TZ = 'America/Indiana/Indianapolis';
// The site has no /contact page or contact popup. Its real way in is /join.
const CONTACT_ROUTE = '/join';

// ---------------------------------------------------------------- files

function rootDir() {
  const candidates = [process.cwd(), path.join(__dirname, '..')];
  for (const c of candidates) {
    try { if (fs.statSync(path.join(c, 'content', 'blog')).isDirectory()) return c; } catch (_) { /* next */ }
  }
  return candidates[0];
}

// ---------------------------------------------------------------- dates

/** Today in Fort Wayne as YYYY-MM-DD, comparable as a string with release_on. */
function todayInFortWayne(now) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now || new Date());
}

function formatDate(iso) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(iso + 'T00:00:00Z'));
}

// ---------------------------------------------------------------- front matter

function unquote(v) {
  v = String(v).trim();
  if (v.length >= 2) {
    const a = v[0];
    const b = v[v.length - 1];
    if (a === '"' && b === '"') {
      try { return JSON.parse(v); } catch (_) { return v.slice(1, -1).replace(/\\"/g, '"'); }
    }
    if (a === "'" && b === "'") return v.slice(1, -1).replace(/''/g, "'");
  }
  return v;
}

// A small parser for the fixed shape in BLOG-FORMAT: scalars, plus one level of
// list of maps for `sources`. Not general YAML; the contract is ours on both ends.
function parseFrontmatter(raw) {
  const lines = raw.split('\n');
  const result = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
    if (!m) { i++; continue; }
    const key = m[1];
    const rest = m[2].trim();
    if (rest !== '' && rest !== '[]') { result[key] = unquote(rest); i++; continue; }
    const items = [];
    let j = i + 1;
    while (j < lines.length && /^\s*-\s/.test(lines[j])) {
      const item = {};
      const first = lines[j].match(/^\s*-\s*([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
      if (first) item[first[1]] = unquote(first[2]);
      j++;
      while (j < lines.length && /^\s{2,}[A-Za-z_]/.test(lines[j]) && !/^\s*-\s/.test(lines[j])) {
        const kv = lines[j].match(/^\s*([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
        if (kv) item[kv[1]] = unquote(kv[2]);
        j++;
      }
      items.push(item);
    }
    result[key] = items;
    i = items.length ? j : i + 1;
  }
  return result;
}

function parsePost(filename, raw) {
  raw = raw.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) { console.error(`[blog:parse-failed] ${filename}: no front matter`); return null; }
  const fm = parseFrontmatter(match[1]);
  const str = (k) => (typeof fm[k] === 'string' ? fm[k] : '');
  const title = str('title');
  const slug = str('slug');
  if (!title || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    console.error(`[blog:parse-failed] ${filename}: missing title or a valid slug`);
    return null;
  }
  const body = match[2].trim();
  const sources = Array.isArray(fm.sources)
    ? fm.sources.filter((s) => s && s.title && s.url).map((s) => ({ title: s.title, author: s.author || '', url: s.url }))
    : [];
  const words = body.split(/\s+/).filter(Boolean).length;
  return {
    post_id: str('post_id') || slug,
    seq: Number(str('seq')) || 0,
    title,
    slug,
    release_on: /^\d{4}-\d{2}-\d{2}$/.test(str('release_on')) ? str('release_on') : '',
    description: str('description'),
    reading_minutes: Number(str('reading_minutes')) || Math.max(1, Math.round(words / 200)),
    cover_image: str('cover_image'),
    sources,
    words,
    body,
  };
}

function readAllPosts() {
  const dir = path.join(rootDir(), 'content', 'blog');
  let files;
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.md') && !f.startsWith('.')); } catch (_) { return []; }
  const byId = new Map();
  for (const f of files) {
    let raw;
    try { raw = fs.readFileSync(path.join(dir, f), 'utf8'); } catch (_) { continue; }
    const p = parsePost(f, raw);
    if (!p) continue;
    const ex = byId.get(p.post_id);
    if (!ex || (!ex.release_on && p.release_on)) byId.set(p.post_id, p);
  }
  return [...byId.values()];
}

/** Posts whose release_on has arrived (Fort Wayne time), newest first. The only list the site ever shows. */
function getReleasedPosts(today) {
  today = today || todayInFortWayne();
  return readAllPosts()
    .filter((p) => p.release_on && p.release_on <= today)
    .sort((a, b) => (a.release_on === b.release_on ? b.seq - a.seq : a.release_on < b.release_on ? 1 : -1));
}

// ---------------------------------------------------------------- markdown

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function safeHref(url) {
  const u = String(url).trim();
  if (/^(https?:\/\/|mailto:|tel:|#|\/(?!\/))/i.test(u)) return u;
  if (/^[a-z0-9][^:]*$/i.test(u)) return u; // relative
  return '';
}

/** Local links stay relative; the site's own full URLs become relative; /contact goes to the real route. */
function normalizeHref(href) {
  let h = href.replace(/^https?:\/\/(www\.)?revivefw\.com(?=\/|$)/i, '') || '/';
  if (/^\/contact\/?(?=$|[?#])/i.test(h)) h = h.replace(/^\/contact\/?/i, CONTACT_ROUTE);
  return h;
}
const isExternal = (h) => /^https?:\/\//i.test(h);

function imgSrc(src) {
  src = src.trim();
  if (/^images\//.test(src)) return '/content/blog/' + src;
  return src;
}

/**
 * Inline markdown to HTML. In tip mode (ctx.links is an array) every link is
 * pulled out and returned as a button, never left as an inline text link.
 */
function inline(src, ctx) {
  const stash = [];
  const hold = (html) => { stash.push(html); return `\u0000${stash.length - 1}\u0000`; };
  let s = esc(src);

  s = s.replace(/`([^`]+)`/g, (_, c) => hold(`<code>${c}</code>`));

  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (m, alt, url) => {
    const u = imgSrc(url.replace(/&amp;/g, '&'));
    if (!safeHref(u)) return alt;
    return hold(`<img src="${esc(u)}" alt="${alt}" loading="lazy" />`);
  });

  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (m, label, url, offset, whole) => {
    const raw = url.replace(/&amp;/g, '&');
    if (!safeHref(raw)) return label;
    const href = normalizeHref(raw);
    if (ctx && ctx.links) {
      ctx.links.push({ href, label: label.replace(/\*\*|__|\*|_/g, '') });
      const tail = whole.slice(offset + m.length);
      return /^[\s.!?]*$/.test(tail) ? '' : label;
    }
    const ext = isExternal(href) ? ' target="_blank" rel="noopener"' : '';
    return hold(`<a href="${esc(href)}"${ext}>${emphasis(label)}</a>`);
  });

  s = emphasis(s);

  let guard = 0;
  while (/\u0000\d+\u0000/.test(s) && guard++ < 5) s = s.replace(/\u0000(\d+)\u0000/g, (_, n) => stash[+n]);
  return s;
}

function emphasis(s) {
  return s.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+?)__/g, '<strong>$1</strong>')
    .replace(/(^|[^\w*])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>')
    .replace(/(^|[^\w])_([^_\s][^_]*?)_(?!\w)/g, '$1<em>$2</em>');
}

const plainText = (md) => md.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '').trim();

function slugId(s, used) {
  let base = plainText(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'section';
  let id = base;
  let n = 2;
  while (used.has(id)) id = `${base}-${n++}`;
  used.add(id);
  return id;
}

const LIST_RE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const indentOf = (s) => s.replace(/\t/g, '    ').length;

function parseList(lines, start, ctx) {
  const m = lines[start].match(LIST_RE);
  const indent = indentOf(m[1]);
  const ordered = /\d/.test(m[2]);
  const items = [];
  let i = start;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) {
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j++;
      if (j < lines.length) {
        const mm = lines[j].match(LIST_RE);
        if (mm && ((indentOf(mm[1]) === indent && /\d/.test(mm[2]) === ordered) || indentOf(mm[1]) > indent)) { i = j; continue; }
      }
      break;
    }
    const mm = l.match(LIST_RE);
    if (mm) {
      const ind = indentOf(mm[1]);
      if (ind === indent && /\d/.test(mm[2]) === ordered) { items.push({ text: mm[3], kids: '' }); i++; continue; }
      if (ind > indent && items.length) {
        const sub = parseList(lines, i, ctx);
        items[items.length - 1].kids += sub.html;
        i = sub.next;
        continue;
      }
      break;
    }
    if (indentOf(l) > indent && items.length) { items[items.length - 1].text += ' ' + l.trim(); i++; continue; }
    break;
  }
  const tag = ordered ? 'ol' : 'ul';
  return { html: `<${tag}>${items.map((it) => `<li>${inline(it.text, ctx)}${it.kids}</li>`).join('')}</${tag}>`, next: i };
}

function tableCells(row) {
  return row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
}

const BLOCK_START = [
  /^\s*(```|~~~)/, /^:::\s*(tip|note)\b/i, /^#{1,6}\s+/, /^\s{0,3}>/, /^\s{0,3}([-*_])(\s*\1){2,}\s*$/,
  /^\s*[-*+]\s+/, /^\s*\d+[.)]\s+/, /^\s*\|/,
];

/**
 * Block markdown to HTML. `toc` (an array) collects the ## headings of the post;
 * pass null inside callouts. `ctx` carries the tip button collector.
 */
function renderBlocks(lines, toc, used, ctx) {
  const out = [];
  let i = 0;
  const n = lines.length;
  while (i < n) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    let m;

    if ((m = line.match(/^\s*(```|~~~)/))) {
      const fence = m[1];
      const code = [];
      i++;
      while (i < n && !lines[i].trim().startsWith(fence)) code.push(lines[i++]);
      i++;
      out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);
      continue;
    }

    if ((m = line.match(/^:::\s*(tip|note)\b[ \t]*(.*)$/i))) {
      const kind = m[1].toLowerCase();
      const title = m[2].trim();
      const inner = [];
      i++;
      while (i < n && !/^:::\s*$/.test(lines[i])) inner.push(lines[i++]);
      i++;
      const cctx = kind === 'tip' ? { links: [] } : null;
      const body = renderBlocks(inner, null, used, cctx);
      let buttons = '';
      if (cctx && cctx.links.length) {
        const seen = new Set();
        buttons = '<div class="callout-actions">' + cctx.links.filter((l) => {
          const k = l.href + '|' + l.label;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        }).map((l) => {
          const ext = isExternal(l.href) ? ' target="_blank" rel="noopener"' : '';
          return `<a class="btn btn-fire btn-arrow callout-btn" href="${esc(l.href)}"${ext}>${l.label}</a>`;
        }).join('') + '</div>';
      }
      out.push(`<aside class="callout callout-${kind}"><div class="callout-label mono">${kind === 'tip' ? 'Revive tip' : 'Good to know'}</div>${title ? `<p class="callout-title">${esc(title)}</p>` : ''}<div class="callout-body">${body}</div>${buttons}</aside>`);
      continue;
    }

    if ((m = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/))) {
      const level = m[1].length;
      const text = m[2];
      i++;
      if (!toc) { out.push(`<p class="callout-sub">${inline(text)}</p>`); continue; }
      const id = slugId(text, used);
      if (level === 2) toc.push({ id, title: plainText(text) });
      const tag = level <= 2 ? 'h2' : level === 3 ? 'h3' : 'h4';
      out.push(`<${tag} id="${id}">${inline(text)}</${tag}>`);
      continue;
    }

    if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) { out.push('<hr />'); i++; continue; }

    if (/^\s{0,3}>/.test(line)) {
      const q = [];
      while (i < n && /^\s{0,3}>/.test(lines[i])) q.push(lines[i++].replace(/^\s{0,3}>\s?/, ''));
      out.push(`<blockquote>${renderBlocks(q, null, used, ctx)}</blockquote>`);
      continue;
    }

    if (LIST_RE.test(line)) {
      const r = parseList(lines, i, ctx);
      out.push(r.html);
      i = r.next;
      continue;
    }

    if (/^\s*\|/.test(line) && i + 1 < n && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      const head = tableCells(line);
      i += 2;
      const rows = [];
      while (i < n && /^\s*\|/.test(lines[i])) rows.push(tableCells(lines[i++]));
      out.push('<div class="tbl-wrap"><table><thead><tr>' + head.map((c) => `<th>${inline(c, ctx)}</th>`).join('') + '</tr></thead><tbody>'
        + rows.map((r) => '<tr>' + r.map((c) => `<td>${inline(c, ctx)}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>');
      continue;
    }

    // paragraph: consecutive lines until a blank line or the start of another block
    const para = [line.trim()];
    i++;
    while (i < n && lines[i].trim() && !BLOCK_START.some((re) => re.test(lines[i]))) {
      para.push(lines[i].trim());
      i++;
    }
    const html = inline(para.join(' '), ctx).trim();
    if (html) out.push(`<p>${html}</p>`);
  }
  return out.join('\n');
}

/** Render a post body. Returns the HTML and the ## headings for the contents. */
function renderBody(md) {
  const toc = [];
  const html = renderBlocks(md.replace(/\r\n?/g, '\n').split('\n'), toc, new Set(), null);
  return { html, toc };
}

// ---------------------------------------------------------------- chrome (nav + footer)

const FALLBACK_NAV = `<nav class="nav" id="nav">
  <a href="/" class="nav-brand">REVIVE</a>
  <div class="nav-links" id="navLinks">
    <a href="/" class="nav-link">Home</a>
    <a href="/pricing" class="nav-link">Membership</a>
    <a href="/why-revive" class="nav-link">Why Revive?</a>
    <a href="/grand-opening" class="nav-link">Grand Opening</a>
    <a href="/run-club" class="nav-link">Run Club</a>
    <a href="/careers" class="nav-link">Careers</a>
  </div>
  <a href="/free-pass" class="nav-cta">Free 7-Day Pass <span aria-hidden="true">&rarr;</span></a>
  <button class="nav-toggle" id="navToggle" aria-label="Toggle menu"><span></span><span></span><span></span></button>
</nav>`;

const FALLBACK_FOOTER = `<footer class="footer">
  <div class="wrap">
    <div class="footer-brand">REVIVE<span class="text-fire">.</span></div>
    <p class="mono mt-4"><a href="/privacy">Privacy Policy</a></p>
    <div class="footer-grid mt-8">
      <div class="footer-col"><h4>Visit</h4><p class="text-soft" style="line-height:1.6;">3233 St Joe Center Rd<br />Fort Wayne, IN 46835</p></div>
      <div class="footer-col"><h4>Explore</h4><ul><li><a href="/why-revive">Why Revive?</a></li><li><a href="/pricing">Membership</a></li><li><a href="/grand-opening">Grand Opening</a></li><li><a href="/run-club">Run Club</a></li><li><a href="/careers">Careers</a></li></ul></div>
      <div class="footer-col"><h4>Join</h4><ul><li><a href="/join">Join Revive</a></li><li><a href="/free-pass">Free 7-Day Pass</a></li></ul></div>
      <div class="footer-col"><h4>Follow</h4><ul><li><a href="https://instagram.com/revivefitnessfw" target="_blank" rel="noopener">Instagram</a></li><li><a href="mailto:info@revivefw.com">info@revivefw.com</a></li></ul></div>
    </div>
    <div class="footer-bottom"><span>&copy; <span data-year>2026</span> <span class="brand">Revive</span> Fitness &amp; Recovery</span><span>Site by <a href="https://sweetdreamsmusic.com" target="_blank" rel="noopener" class="credit">Sweet Dreams US</a></span></div>
  </div>
</footer>`;

/** The site's own header and footer, read from the home page so the blog always matches them. */
function chrome(hasBlog, current) {
  let nav = '';
  let footer = '';
  try {
    const home = fs.readFileSync(path.join(rootDir(), 'index.html'), 'utf8');
    nav = (home.match(/<nav class="nav" id="nav">[\s\S]*?<\/nav>/) || [''])[0];
    footer = (home.match(/<footer class="footer">[\s\S]*?<\/footer>/) || [''])[0];
  } catch (_) { /* fall back below */ }
  if (!nav || !/id="navLinks"/.test(nav)) nav = FALLBACK_NAV;
  if (!footer || !/class="footer-grid/.test(footer)) footer = FALLBACK_FOOTER;

  nav = nav.replace(/\s+aria-current="page"/g, '').replace(/\s*<a href="\/blog"[^>]*>[\s\S]*?<\/a>/g, '');
  footer = footer.replace(/\s*<li><a href="\/blog">Blog<\/a><\/li>/g, '').replace(/\s*[–—]\s*/g, ' to ');

  if (hasBlog) {
    const cur = current ? ' aria-current="page"' : '';
    nav = nav.replace(/(\n?\s*)<a href="\/careers" class="nav-link"/, `$1<a href="/blog" class="nav-link"${cur}>Blog</a>$1<a href="/careers" class="nav-link"`);
    nav = nav.replace('class="nav-links"', 'class="nav-links has-blog"');
    footer = footer.replace(/(\n?\s*)<li><a href="\/careers">/, '$1<li><a href="/blog">Blog</a></li>$1<li><a href="/careers">');
  }
  return { nav, footer };
}

// ---------------------------------------------------------------- pages

const FONTS = 'https://fonts.googleapis.com/css2?family=Anton&family=Montserrat:wght@600;700&family=Cormorant+Garamond:ital,wght@1,400;1,500&family=Manrope:wght@200;300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap';

function jsonLd(obj) {
  return JSON.stringify(obj, null, 2).replace(/</g, '\\u003c');
}

function head(o) {
  const t = esc(o.title);
  const d = esc(o.description);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${t}</title>
<meta name="description" content="${d}" />
${o.noindex ? '<meta name="robots" content="noindex, follow" />\n' : `<link rel="canonical" href="${esc(o.canonical)}" />\n`}<meta property="og:site_name" content="REVIVE Fitness &amp; Recovery" />
<meta property="og:type" content="${o.ogType || 'website'}" />
<meta property="og:url" content="${esc(o.canonical)}" />
<meta property="og:title" content="${t}" />
<meta property="og:description" content="${d}" />
<meta property="og:image" content="${SITE}/assets/og-image.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${t}" />
<meta name="twitter:description" content="${d}" />
<meta name="twitter:image" content="${SITE}/assets/og-image.png" />
<meta name="theme-color" content="#0B0807" />
<link rel="alternate" type="application/rss+xml" title="REVIVE Blog" href="/blog/rss.xml" />
${o.jsonld ? `<script type="application/ld+json">\n${o.jsonld}\n</script>\n` : ''}<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="${FONTS}" rel="stylesheet" />
<link rel="stylesheet" href="/styles/globals.css" />
<link rel="stylesheet" href="/styles/blog.css" />
<link rel="icon" href="/favicon.ico" sizes="32x32" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<!-- Meta Pixel: base code + PageView; ID lives in the script -->
<script src="/scripts/meta-pixel.js"></script>
</head>
<body${o.bodyClass ? ` class="${o.bodyClass}"` : ''}>
`;
}

function tail(footer, extraScripts) {
  return `
${footer}
<script src="/scripts/main.js" defer></script>
${extraScripts || ''}<!-- Vercel Web Analytics -->
<script>window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments);};</script>
<script defer src="/_vercel/insights/script.js"></script>
</body>
</html>`;
}

function renderIndex(posts) {
  const { nav, footer } = chrome(posts.length > 0, true);
  const canonical = `${SITE}/blog`;
  const desc = 'Plain English articles on training, recovery and staying active, from REVIVE Fitness & Recovery in Fort Wayne, Indiana.';
  const ld = jsonLd({
    '@context': 'https://schema.org', '@type': 'Blog', name: 'The Revive Journal', description: desc, url: canonical,
    publisher: { '@type': 'Organization', name: BRAND, url: SITE },
    blogPost: posts.map((p) => ({ '@type': 'BlogPosting', headline: p.title, url: `${SITE}/blog/${p.slug}`, datePublished: p.release_on })),
  });
  const list = posts.map((p) => `
      <li><a class="post-card" href="/blog/${esc(p.slug)}">
        <div class="post-card-meta mono"><time datetime="${p.release_on}">${formatDate(p.release_on)}</time><span class="sep" aria-hidden="true">/</span><span>${p.reading_minutes} min read</span></div>
        <h2 class="post-card-title">${esc(p.title)}</h2>
        ${p.description ? `<p class="post-card-desc">${esc(p.description)}</p>` : ''}
        <span class="post-card-more mono">Read article <span aria-hidden="true">&rarr;</span></span>
      </a></li>`).join('');

  const body = posts.length ? `
<section class="section section-tight blog-list-section">
  <div class="wrap">
    <ol class="post-list">${list}
    </ol>
  </div>
</section>` : `
<section class="section blog-list-section">
  <div class="wrap">
    <div class="blog-empty">
      <p class="h-4">New articles are on the way.</p>
      <p class="lead mt-4">Check back soon, or take a look at how training and recovery work at <span class="brand">Revive</span>.</p>
      <div class="mt-6"><a href="/why-revive" class="btn btn-primary btn-arrow">See why Revive</a></div>
    </div>
  </div>
</section>`;

  return head({ title: 'Blog | REVIVE Fort Wayne', description: desc, canonical, jsonld: ld, bodyClass: 'blog-index' }) + nav + `
<header class="page-header blog-hero">
  <div class="wrap">
    <span class="eyebrow">The Revive Journal</span>
    <h1 class="display blog-hero-title">Train smart.<br /><span class="editorial text-cream">Recover smarter.</span></h1>
    <p class="lead blog-hero-lead">Plain English articles on training, recovery and staying active, from <span class="brand">Revive</span> Fitness &amp; Recovery in Fort Wayne.</p>
  </div>
</header>` + body + tail(footer);
}

function renderPost(post, all) {
  const { html, toc } = renderBody(post.body);
  const { nav, footer } = chrome(true, true);
  const canonical = `${SITE}/blog/${post.slug}`;
  const desc = post.description || `${post.title}, from REVIVE Fitness & Recovery in Fort Wayne.`;
  const cover = post.cover_image ? SITE + '/content/blog/' + post.cover_image.replace(/^\/+/, '') : `${SITE}/assets/og-image.png`;
  const ld = jsonLd({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: desc,
    datePublished: post.release_on,
    dateModified: post.release_on,
    author: { '@type': 'Organization', name: BRAND, url: SITE },
    publisher: { '@type': 'Organization', name: BRAND, logo: { '@type': 'ImageObject', url: `${SITE}/assets/og-image.png` } },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    image: cover,
    wordCount: post.words,
    inLanguage: 'en-US',
    ...(post.sources.length ? { citation: post.sources.map((s) => ({ '@type': 'CreativeWork', name: s.title, url: s.url, ...(s.author ? { author: { '@type': 'Organization', name: s.author } } : {}) })) } : {}),
  });

  const idx = all.findIndex((p) => p.slug === post.slug);
  const newer = idx > 0 ? all[idx - 1] : null;
  const older = idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null;
  const pager = (newer || older) ? `<nav class="post-pager" aria-label="More articles">
      ${older ? `<a class="pager-prev" href="/blog/${esc(older.slug)}"><span class="mono"><span aria-hidden="true">&larr;</span> Older</span><span class="pager-title">${esc(older.title)}</span></a>` : '<span></span>'}
      ${newer ? `<a class="pager-next" href="/blog/${esc(newer.slug)}"><span class="mono">Newer <span aria-hidden="true">&rarr;</span></span><span class="pager-title">${esc(newer.title)}</span></a>` : '<span></span>'}
    </nav>` : '';

  const sources = post.sources.length ? `
        <section class="post-sources" aria-labelledby="sourcesTitle">
          <h2 id="sourcesTitle" class="sources-title">Sources</h2>
          <ol>${post.sources.map((s) => {
    const safe = /^https?:\/\//i.test(s.url) ? s.url : '';
    return `<li>${safe ? `<a href="${esc(safe)}" target="_blank" rel="noopener">${esc(s.title)}</a>` : esc(s.title)}${s.author ? `<span class="src-author">${esc(s.author)}</span>` : ''}</li>`;
  }).join('')}</ol>
        </section>` : '';

  const tocList = toc.map((t) => `<li><a href="#${t.id}" data-toc="${t.id}">${esc(t.title)}</a></li>`).join('\n          ');
  const first = toc.length ? esc(toc[0].title) : 'Contents';
  const tocBlock = toc.length ? `
<aside class="toc" id="toc" aria-label="Contents">
  <div class="toc-progress" id="tocProgress" role="progressbar" aria-label="Reading progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="tocBar"></span></div>
  <button type="button" class="toc-toggle" id="tocToggle" aria-expanded="false" aria-controls="tocPanel">
    <span class="toc-now"><span class="toc-now-label mono">Now reading</span><span class="toc-current" id="tocCurrent">${first}</span></span>
    <span class="toc-pct mono" id="tocPctBar">0%</span>
    <svg class="toc-arrow" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false"><path d="M4 11.5 9 6.5l5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </button>
  <nav class="toc-panel" id="tocPanel" aria-label="On this page">
    <div class="toc-title mono"><span>On this page</span><span id="tocPct">0%</span></div>
    <ol>
          ${tocList}
    </ol>
  </nav>
</aside>` : '';

  return head({
    title: `${post.title} | REVIVE Fort Wayne`, description: desc, canonical, ogType: 'article', jsonld: ld, bodyClass: 'blog-post-page',
  }) + nav + `
<main class="blog-post">
  <div class="wrap">
    <nav class="crumbs mono" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><a href="/blog">Blog</a></nav>
    <article class="post-body" id="postBody">
      <header class="post-head">
        <div class="post-eyebrow mono"><span class="text-fire">The Revive Journal</span><span class="sep" aria-hidden="true">/</span><time datetime="${post.release_on}">${formatDate(post.release_on)}</time><span class="sep" aria-hidden="true">/</span><span>${post.reading_minutes} min read</span></div>
        <h1 class="post-title">${esc(post.title)}</h1>
      </header>${post.cover_image ? `
      <figure class="post-cover"><img src="/content/blog/${esc(post.cover_image.replace(/^\/+/, ''))}" alt="" loading="eager" /></figure>` : ''}
      <div class="post-content">
${html}
      </div>${sources}
      ${pager}
    </article>
  </div>
</main>${tocBlock}` + tail(footer, toc.length ? '<script src="/scripts/blog.js" defer></script>\n' : '');
}

function renderNotFound(hasBlog) {
  const { nav, footer } = chrome(hasBlog, false);
  return head({
    title: 'Article not found | REVIVE Fort Wayne',
    description: 'This article is not available.',
    canonical: `${SITE}/blog`, noindex: true, bodyClass: 'blog-index',
  }) + nav + `
<header class="page-header blog-hero">
  <div class="wrap">
    <span class="eyebrow">The Revive Journal</span>
    <h1 class="display blog-hero-title">That article<br /><span class="editorial text-cream">is not available.</span></h1>
    <p class="lead blog-hero-lead">It may not be published yet, or the link may be off by a letter.</p>
    <div class="mt-6 flex gap-4" style="flex-wrap:wrap;">
      ${hasBlog ? '<a href="/blog" class="btn btn-primary btn-arrow">All articles</a>' : ''}
      <a href="/" class="btn btn-arrow">Home</a>
    </div>
  </div>
</header>` + tail(footer);
}

// ---------------------------------------------------------------- sitemap + feed

const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// The site's existing pages, unchanged from the old static sitemap.xml.
const SITE_PAGES = [
  ['/privacy', '2026-09-11', 'yearly', '0.3'],
  ['/', '2026-08-01', 'weekly', '1.0'],
  ['/pricing', '2026-08-01', 'weekly', '0.9'],
  ['/join', '2026-08-01', 'weekly', '0.8'],
  ['/why-revive', '2026-08-01', 'monthly', '0.8'],
  ['/grand-opening', '2026-08-01', 'weekly', '0.8'],
  ['/run-club', '2026-08-01', 'weekly', '0.7'],
  ['/careers', '2026-08-01', 'weekly', '0.6'],
];

function renderSitemap(posts) {
  const url = (loc, lastmod, freq, pri) => `  <url>\n    <loc>${SITE}${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${freq}</changefreq>\n    <priority>${pri}</priority>\n  </url>`;
  const rows = SITE_PAGES.map((p) => url(p[0] === '/' ? '/' : p[0], p[1], p[2], p[3]));
  if (posts.length) {
    rows.push(url('/blog', posts[0].release_on, 'weekly', '0.7'));
    for (const p of posts) rows.push(url(`/blog/${p.slug}`, p.release_on, 'monthly', '0.6'));
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</urlset>\n`;
}

function renderRss(posts) {
  const items = posts.map((p) => `
    <item>
      <title>${xmlEsc(p.title)}</title>
      <link>${SITE}/blog/${p.slug}</link>
      <guid isPermaLink="true">${SITE}/blog/${p.slug}</guid>
      <pubDate>${new Date(`${p.release_on}T12:00:00Z`).toUTCString()}</pubDate>
      <description>${xmlEsc(p.description)}</description>
    </item>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>REVIVE Fitness &amp; Recovery Blog</title>
  <link>${SITE}/blog</link>
  <atom:link href="${SITE}/blog/rss.xml" rel="self" type="application/rss+xml" />
  <description>Plain English articles on training, recovery and staying active, from REVIVE Fitness &amp; Recovery in Fort Wayne, Indiana.</description>
  <language>en-us</language>${items}
</channel>
</rss>
`;
}

module.exports = {
  SITE, TZ, todayInFortWayne, getReleasedPosts, readAllPosts, parseFrontmatter, parsePost,
  renderBody, renderIndex, renderPost, renderNotFound, renderSitemap, renderRss, chrome,
};
