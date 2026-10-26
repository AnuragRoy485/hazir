import { SESSION_KEY } from './config.js';
import { request } from './http.js';

let session = null;
try { session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { /* corrupt storage: start signed out */ }

export const getSession = () => session;
export function saveSession(s) {
  session = s;
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s)); else localStorage.removeItem(SESSION_KEY);
}
export const toSession = d => ({
  access_token: d.access_token,
  refresh_token: d.refresh_token,
  expires_at: Date.now() + (d.expires_in || 3600) * 1000 - 30000,
  user: d.user,
});

/** Returns a valid access token, refreshing it when it is about to expire. */
export async function getToken() {
  if (!session) return null;
  if (Date.now() > session.expires_at) {
    try {
      const d = await request('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refresh_token } });
      saveSession(toSession(d));
    } catch { saveSession(null); return null; }
  }
  return session.access_token;
}
