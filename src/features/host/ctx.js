// Shared host-app context: DOM roots, the single state object, and a tiny router registry
// (each view registers itself on R so views can navigate without circular imports).
import { $ } from '../../lib/ui.js';

export const root = $('#root');
export const navr = $('#navr');
export const R = {};
export const state = { events: [], ev: null, inv: [], res: [], q: '', f: 'all', tab: 'overview', timer: null };

export const view = html => { root.innerHTML = html; scrollTo(0, 0); };
export const busy = (btn, on, text) => {
  if (on) { btn.dataset.t = btn.textContent; btn.disabled = true; btn.textContent = text || 'Please wait...'; }
  else { btn.disabled = false; btn.textContent = btn.dataset.t || btn.textContent; }
};
export const niceErr = e => {
  const m = e.message || 'Something went wrong';
  if (/invalid login/i.test(m)) return 'That email and password do not match.';
  if (/already registered|already been registered/i.test(m)) return 'An account with this email already exists. Try logging in.';
  if (/rate limit|too many/i.test(m) || e.status === 429) return 'Too many attempts. Wait a few minutes and try again.';
  return m;
};
