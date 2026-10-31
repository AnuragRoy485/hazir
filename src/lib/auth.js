import { request } from './http.js?v=20261101-3';
import { getSession, saveSession, toSession, getToken } from './session.js?v=20261101-3';

export const auth = {
  user: () => getSession() && getSession().user,
  /** Creates a host account. Resolves { session: true } when the project signs the user straight in. */
  async signUp(email, password, name) {
    const d = await request('/auth/v1/signup', { method: 'POST', body: { email, password, data: { name } } });
    if (d && d.access_token) { saveSession(toSession(d)); return { session: true }; }
    return { session: false };
  },
  async signIn(email, password) {
    saveSession(toSession(await request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } })));
  },
  async signOut() {
    const s = getSession();
    try { if (s) await request('/auth/v1/logout', { method: 'POST', token: s.access_token }); } catch { /* already expired */ }
    saveSession(null);
  },
  async loadUser() {
    const token = await getToken();
    if (!token) return null;
    try {
      const user = await request('/auth/v1/user', { token });
      const s = getSession(); s.user = user; saveSession(s);
      return user;
    } catch { saveSession(null); return null; }
  },
};
