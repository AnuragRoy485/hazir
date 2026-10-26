// Host app entry: restores the session, then shows the login screen or the events list.
import { auth } from '../lib/auth.js';
import { $, initEffects } from '../lib/ui.js';
import { esc } from '../lib/format.js';
import { navr, state, R } from '../features/host/ctx.js';
import '../features/host/authView.js';
import '../features/host/eventsView.js';
import '../features/host/eventForm.js';
import '../features/host/dashboard/index.js';

function renderNav() {
  const u = auth.user(), name = (u && u.user_metadata && u.user_metadata.name) || (u && u.email) || '';
  navr.innerHTML = `<span class="who">${esc(name)}</span><button class="btn btn-ghost btn-sm" id="so">Log out</button>`;
  $('#so').onclick = async () => {
    clearInterval(state.timer);
    await auth.signOut();
    Object.assign(state, { events: [], ev: null, inv: [], res: [], q: '', f: 'all', tab: 'overview' });
    R.authView('login');
  };
}
R.boot = async function boot() {
  const user = auth.user() || await auth.loadUser();
  if (!user) return R.authView('login');
  renderNav();
  R.listView();
};

initEffects();
R.boot();
