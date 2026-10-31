// Host app entry: restores the session, then shows the login screen or the events list.
import { auth } from '../lib/auth.js?v=20261101-5';
import { rpc } from '../lib/db.js?v=20261101-5';
import { $, initEffects } from '../lib/ui.js?v=20261101-5';
import { esc } from '../lib/format.js?v=20261101-5';
import { navr, state, R } from '../features/host/ctx.js?v=20261101-5';
import '../features/host/authView.js?v=20261101-5';
import '../features/host/eventsView.js?v=20261101-5';
import '../features/host/eventForm.js?v=20261101-5';
import '../features/host/dashboard/index.js?v=20261101-5';

async function renderNav() {
  const u = auth.user(), name = (u && u.user_metadata && u.user_metadata.name) || (u && u.email) || '';
  let adm = false;
  try { adm = await rpc('is_admin'); } catch { /* not admin or offline */ }
  navr.innerHTML = `<span class="who">${esc(name)}</span>${adm === true ? '<a class="btn btn-ghost btn-sm" href="/admin">Admin</a>' : ''}<button class="btn btn-ghost btn-sm" id="so">Log out</button>`;
  $('#so').onclick = async () => {
    clearInterval(state.timer);
    await auth.signOut();
    Object.assign(state, { events: [], ev: null, inv: [], res: [], q: '', f: 'all', tab: 'overview' });
    R.authView('login');
  };
}
R.boot = async function boot() {
  const user = auth.user() || await auth.loadUser();
  if (!user) return R.authView(location.hash === '#signup' ? 'signup' : 'login');
  renderNav();
  R.listView();
};

initEffects();
R.boot();
