// Landing page for the emailed password-reset link. The link carries a one-time
// recovery token in the URL hash; this page exchanges it for a new password.
// The old password is never shown or needed, and tokens never leave the browser
// except to Supabase's own auth endpoint.
import { request } from '../lib/http.js';
import { saveSession, toSession } from '../lib/session.js';
import { $, initEffects, toast } from '../lib/ui.js';

const root = $('#root');

function shell(html) { root.innerHTML = `<section class="evpage" style="max-width:520px">${html}</section>`; }

function parseHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  return { token: h.get('access_token'), refresh: h.get('refresh_token'), type: h.get('type') };
}

async function boot() {
  const { token, refresh, type } = parseHash();
  if (!token || type !== 'recovery') {
    shell('<h2>Set a new password</h2><p class="muted">This page only works from the reset link in your email. The link may have expired - ask for a new one.</p>');
    return;
  }
  saveSession(toSession({ access_token: token, refresh_token: refresh || '', expires_in: 900, user: null }));
  history.replaceState(null, '', location.pathname); // drop the token from the address bar
  shell(`<h2>Set a new password</h2>
    <p class="muted">Choose a new password for your Hazir account.</p>
    <div class="card reveal in">
      <label class="field">New password<input id="p1" type="password" minlength="6" autocomplete="new-password"></label>
      <label class="field">Repeat new password<input id="p2" type="password" minlength="6" autocomplete="new-password"></label>
      <p class="msg" id="msg" hidden></p>
      <div class="row end"><button class="btn" id="save">Save password</button></div>
    </div>`);
  $('#save').onclick = async () => {
    const p1 = $('#p1').value, p2 = $('#p2').value, m = $('#msg');
    if (p1.length < 6) { m.hidden = false; m.textContent = 'The password needs at least 6 characters.'; return; }
    if (p1 !== p2) { m.hidden = false; m.textContent = 'The two passwords do not match.'; return; }
    const b = $('#save'); b.disabled = true; b.textContent = 'Saving...';
    try {
      await request('/auth/v1/user', { method: 'PUT', body: { password: p1 }, token });
      toast('Password updated');
      location.href = 'app.html';
    } catch (e) {
      m.hidden = false; m.textContent = e.message || 'Could not save the password. The link may have expired.';
      b.disabled = false; b.textContent = 'Save password';
    }
  };
}

initEffects();
boot();
