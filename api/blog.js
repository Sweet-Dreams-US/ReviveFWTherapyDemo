// Blog routes, rendered at request time from content/blog (see api/_blog.js).
// vercel.json rewrites send these here:
//   /blog                  -> index of released posts
//   /blog/<slug>           -> one post (404 until its release_on date, Fort Wayne time)
//   /blog/rss.xml          -> feed of released posts
//   /sitemap.xml           -> site pages plus released posts
//   /api/blog/status       -> { hasBlog }, read by the nav to show the Blog link
// The edge caches each answer for an hour, so releases need no deploy.
const blog = require('./_blog');

const HOUR = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=300';
const SHORT = 'public, max-age=0, s-maxage=300';

function route(req) {
  let pathname = '';
  let query = {};
  try {
    const u = new URL(req.url, 'http://local');
    pathname = u.pathname.replace(/\/+$/, '') || '/';
    u.searchParams.forEach((v, k) => { query[k] = v; });
  } catch (_) { /* fall through */ }
  if (req.query && typeof req.query === 'object') query = { ...query, ...req.query };

  if (pathname === '/sitemap.xml') return { view: 'sitemap' };
  if (pathname === '/blog/rss.xml') return { view: 'rss' };
  if (pathname === '/api/blog/status') return { view: 'status' };
  if (pathname === '/blog') return { view: 'index' };
  const m = pathname.match(/^\/blog\/([^/]+)$/);
  if (m) {
    let slug = m[1];
    try { slug = decodeURIComponent(slug); } catch (_) { /* keep the raw segment; it will not match a post */ }
    return { view: 'post', slug };
  }
  return { view: String(query.view || 'index'), slug: String(query.slug || '') };
}

function send(res, status, type, cache, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', cache);
  res.end(body);
}

module.exports = (req, res) => {
  try {
    const { view, slug } = route(req);
    const posts = blog.getReleasedPosts(); // gate: release_on <= today in Fort Wayne

    if (view === 'status') {
      return send(res, 200, 'application/json; charset=utf-8', 'public, max-age=60, s-maxage=3600, stale-while-revalidate=300',
        JSON.stringify({ hasBlog: posts.length > 0, count: posts.length }));
    }
    if (view === 'sitemap') {
      return send(res, 200, 'application/xml; charset=utf-8', HOUR, blog.renderSitemap(posts));
    }
    if (view === 'rss') {
      return send(res, 200, 'application/rss+xml; charset=utf-8', HOUR, blog.renderRss(posts));
    }
    if (view === 'post') {
      const post = posts.find((p) => p.slug === slug);
      if (!post) return send(res, 404, 'text/html; charset=utf-8', SHORT, blog.renderNotFound(posts.length > 0));
      return send(res, 200, 'text/html; charset=utf-8', HOUR, blog.renderPost(post, posts));
    }
    return send(res, 200, 'text/html; charset=utf-8', HOUR, blog.renderIndex(posts));
  } catch (err) {
    console.error('[blog] render failed', err && err.stack ? err.stack : err);
    return send(res, 500, 'text/plain; charset=utf-8', 'no-store', 'The blog is not available right now.');
  }
};
