// Read-only Google Sheet import. The source sheet must remain readable to this
// server; a private-sheet service-account connection can replace this reader later.
const SHEET_ID = '1YTkBiJP3SNYz_GE6CL-5mZ9q9emZmiJbzHLGrrg4p_U';
const SHEET_GID = '0';

function parseCsv(text) {
  const rows = []; let row = [], value = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i++; }
      else if (quoted || value === '') quoted = !quoted;
      else throw new Error('Invalid CSV quoting');
    } else if (ch === ',' && !quoted) { row.push(value); value = ''; }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(value); rows.push(row); row = []; value = '';
    } else value += ch;
  }
  if (quoted) throw new Error('Incomplete CSV response');
  if (value || row.length) { row.push(value); rows.push(row); }
  return rows;
}

function mapLeads(csv) {
  const [headers, ...rows] = parseCsv(csv);
  const required = ['id', 'created_time', 'email', 'full_name', 'phone_number'];
  if (!headers || required.some(h => !headers.includes(h)) || new Set(headers).size !== headers.length) {
    throw new Error('Google Sheet headers changed or the sheet is no longer accessible.');
  }
  const leads = [], invalidRows = [], seen = new Set();
  let duplicates = 0;
  for (let index = 0; index < rows.length; index++) {
    if (rows[index].every(v => !v.trim())) continue;
    const data = Object.fromEntries(headers.map((h, i) => [h, String(rows[index][i] || '').trim()]));
    const email = data.email.toLowerCase();
    const created = new Date(data.created_time);
    if (!data.id || data.id.length > 100 || !data.full_name || data.full_name.length > 240 ||
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200 ||
      !data.created_time || !Number.isFinite(created.getTime()) || rows[index].length > headers.length) {
      invalidRows.push(index + 2); continue;
    }
    if (seen.has(data.id)) { duplicates++; continue; }
    seen.add(data.id);
    // Keep provider identifiers as strings, including IDs longer than JS's safe integer range.
    leads.push({ meta_lead_id: data.id, full_name: data.full_name, email,
      phone: data.phone_number.slice(0, 40), lead_created_at: created.toISOString(),
      fitness_routine: (data['how_consistent_are_you_with_your_health_and_fitness_routine?'] || '').slice(0, 2000),
      source_row: index + 2, meta: data });
  }
  return { leads, invalidRows, duplicates, rowCount: leads.length + invalidRows.length + duplicates };
}

async function rpc(name, args) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Lead storage is not configured.');
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args), signal: AbortSignal.timeout(15000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.message || 'Lead storage request failed.');
    error.status = /unauthorized/i.test(error.message) ? 401 : /changed|conflict/i.test(error.message) ? 409 : 502;
    throw error;
  }
  return result;
}

async function requireAdmin(password) {
  if (!password || typeof password !== 'string' || !(await rpc('revive_check_admin', { p_token: password }))) {
    const error = new Error('Unauthorized'); error.status = 401; throw error;
  }
}

async function runSync(token) {
  let acquired = false;
  try {
    acquired = await rpc('revive_meta_sync_lock', { p_token: token });
    if (!acquired) return { ok: true, busy: true };
    const response = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}&revive_sync=${Date.now()}`, {
      cache: 'no-store', signal: AbortSignal.timeout(20000),
    });
    if (!response.ok || (response.headers.get('content-type') || '').includes('text/html')) {
      throw new Error('Google Sheet could not be read. Check its sharing access and header row.');
    }
    const reader = response.body.getReader(); let size = 0; const chunks = [];
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > 4 * 1024 * 1024) { await reader.cancel(); throw new Error('Sheet exceeds the 4 MB import limit.'); }
      chunks.push(Buffer.from(value));
    }
    const { leads, invalidRows, duplicates, rowCount } = mapLeads(Buffer.concat(chunks).toString('utf8'));
    let imported = 0, updated = 0;
    for (let i = 0; i < leads.length; i += 100) {
      const result = await rpc('revive_meta_import', { p_token: token, p_rows: leads.slice(i, i + 100) });
      imported += result.imported; updated += result.updated;
    }
    const summary = { imported, updated, rows: rowCount, invalidRows, duplicates };
    await rpc('revive_meta_sync_finish', { p_token: token, p_summary: summary, p_error: null });
    return { ok: true, ...summary };
  } catch (error) {
    if (acquired) {
      await rpc('revive_meta_sync_finish', { p_token: token, p_summary: {},
        p_error: 'Sync failed. Check Google Sheet access, headers, and server logs.' }).catch(() => {});
    }
    throw error;
  }
}

module.exports = { SHEET_ID, SHEET_GID, parseCsv, mapLeads, rpc, requireAdmin, runSync };
