// POST /api/upload — stores a single small document (resume / cover letter) in the
// public "applications" bucket and returns its URL. Called by the careers form.
// Documents only, 3MB cap (keeps the base64 body under Vercel's request limit).
// The anon key stays server-side; files get unguessable UUID paths.
const crypto = require('crypto');

const MIME_TO_EXT = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt',
};
const EXT_TO_MIME = { pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', txt: 'text/plain' };
const MAX_BYTES = 3 * 1024 * 1024;

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) { res.status(500).json({ error: 'Server not configured' }); return; }
  try {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
    body = body || {};

    const contentType = String(body.contentType || '').toLowerCase().split(';')[0].trim();
    let ext = MIME_TO_EXT[contentType];
    if (!ext) {
      const m = String(body.filename || '').toLowerCase().match(/\.([a-z0-9]+)$/);
      if (m && EXT_TO_MIME[m[1]]) ext = m[1];
    }
    if (!ext) { res.status(400).json({ error: 'Only PDF, Word (.doc/.docx), or text files are allowed.' }); return; }

    const buf = Buffer.from(String(body.dataBase64 || ''), 'base64');
    if (!buf.length) { res.status(400).json({ error: 'No file data received.' }); return; }
    if (buf.length > MAX_BYTES) { res.status(400).json({ error: 'File too large — max 3MB.' }); return; }

    const storeMime = MIME_TO_EXT[contentType] ? contentType : EXT_TO_MIME[ext];
    const path = crypto.randomUUID() + '.' + ext;
    const up = await fetch(`${SUPABASE_URL}/storage/v1/object/applications/${path}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': storeMime, 'x-upsert': 'false' },
      body: buf,
    });
    if (!up.ok) { console.error('storage upload failed', up.status, await up.text()); res.status(502).json({ error: 'Upload failed. Please try again.' }); return; }

    res.status(200).json({ ok: true, url: `${SUPABASE_URL}/storage/v1/object/public/applications/${path}` });
  } catch (e) { console.error('upload error', e); res.status(500).json({ error: 'Unexpected error uploading file.' }); }
};
