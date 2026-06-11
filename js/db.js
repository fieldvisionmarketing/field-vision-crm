// Field Vision CRM V2 â Database Layer (Supabase REST API)
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
};

// Network resilience: a stalled Supabase request (held open by the network
// layer) would otherwise hang forever and wedge the table on "Loading...".
// Abort after a timeout and retry transient failures with backoff so the
// request self-heals instead of hanging.
const REQUEST_TIMEOUT_MS = 12000; // abort a request that hasn't responded in 12s
const MAX_ATTEMPTS = 3;           // total tries before giving up

async function request(path, options = {}, attempt = 1) {
  const url = `${SUPABASE_URL}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const resp = await fetch(url, { headers, signal: controller.signal, ...options });
    clearTimeout(timer);
    if (!resp.ok) {
      const text = await resp.text();
      // Retry transient server errors (5xx); surface client errors (4xx) immediately.
      if (resp.status >= 500 && attempt < MAX_ATTEMPTS) {
        await new Promise(r => setTimeout(r, 500 * 2 ** (attempt - 1)));
        return request(path, options, attempt + 1);
      }
      throw new Error(`DB error ${resp.status}: ${text}`);
    }
    const text = await resp.text();
    return text ? JSON.parse(text) : null;
  } catch (err) {
    clearTimeout(timer);
    // Retry timeouts (AbortError) and network failures (TypeError from fetch).
    const retriable = err.name === 'AbortError' || err instanceof TypeError;
    if (retriable && attempt < MAX_ATTEMPTS) {
      await new Promise(r => setTimeout(r, 500 * 2 ** (attempt - 1)));
      return request(path, options, attempt + 1);
    }
    if (err.name === 'AbortError') {
      throw new Error(`DB request timed out after ${REQUEST_TIMEOUT_MS}ms and ${MAX_ATTEMPTS} attempts: ${path}`);
    }
    throw err;
  }
}

// ââ Contacts ââ

export async function fetchContacts(tab, includeHidden = false) {
  let path = `/contacts?tab=eq.${tab}&order=sort_order.asc`;
  if (!includeHidden) {
    path += '&hidden=eq.false';
  }
  return request(path);
}

export async function updateContact(id, updates) {
  updates.updated_at = new Date().toISOString();
  return request(`/contacts?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function createContact(data) {
  return request('/contacts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteContact(id) {
  return request(`/contacts?id=eq.${id}`, { method: 'DELETE' });
}

export async function getMaxSortOrder(tab) {
  const rows = await request(`/contacts?tab=eq.${tab}&select=sort_order&order=sort_order.desc&limit=1`);
  return rows && rows.length > 0 ? rows[0].sort_order : 0;
}

// ââ Tab Notes ââ

export async function fetchTabNote(tab) {
  const rows = await request(`/tab_notes?tab=eq.${tab}&limit=1`);
  return rows && rows.length > 0 ? rows[0] : null;
}

export async function upsertTabNote(tab, content) {
  // Try update first
  const existing = await fetchTabNote(tab);
  if (existing) {
    return request(`/tab_notes?id=eq.${existing.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ content, updated_at: new Date().toISOString() }),
    });
  }
  return request('/tab_notes', {
    method: 'POST',
    body: JSON.stringify({ tab, content }),
  });
}

// ââ User Preferences ââ

export async function fetchPreference(key) {
  const rows = await request(`/user_preferences?key=eq.${key}&limit=1`);
  return rows && rows.length > 0 ? JSON.parse(rows[0].value) : null;
}

export async function upsertPreference(key, value) {
  const existing = await request(`/user_preferences?key=eq.${key}&limit=1`);
  const body = { key, value: JSON.stringify(value) };
  if (existing && existing.length > 0) {
    return request(`/user_preferences?id=eq.${existing[0].id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }
  return request('/user_preferences', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
