import { API_URL, PUBLISHABLE_KEY } from './config.js';

/** Small fetch wrapper: JSON in, JSON out, friendly errors with status and code attached. */
export async function request(path, { method = 'GET', body, token, headers = {} } = {}) {
  const h = { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json', ...headers };
  if (token) h.Authorization = 'Bearer ' + token;
  const res = await fetch(API_URL + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!res.ok) {
    const err = new Error((json && (json.msg || json.message || json.error_description || json.error)) || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = json && (json.error_code || json.code);
    throw err;
  }
  return json;
}
