// Super-admin page: read-only overview of users, events and the admin audit log.
// Every read goes through server-enforced RPCs that check the admin role; the
// server also writes an audit row for each call. No data is rendered for
// non-admins - the functions themselves reject the call.
import { auth } from '../lib/auth.js';
import { rpc } from '../lib/db.js';
import { $, initEffects } from '../lib/ui.js';
import { esc, fmtDate } from '../lib/format.js';

const root = $('#root'), navr = $('#navr');

function nav(name) {
  navr.innerHTML = `<span class="who">${esc(name)}</span><a class="btn btn-ghost btn-sm" href="app.html">My events</a><button class="btn btn-ghost btn-sm" id="so">Log out</button>`;
  $('#so').onclick = async () => { await auth.signOut(); location.href = 'app.html'; };
}
const shell = html => { root.innerHTML = `<section class="evpage">${html}</section>`; };
const ts = v => v ? new Date(v).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '-';

async function boot() {
  const user = auth.user() || await auth.loadUser();
  if (!user) { location.href = 'app.html'; return; }
  nav((user.user_metadata && user.user_metadata.name) || user.email || '');
  let adm = false;
  try { adm = await rpc('is_admin'); } catch { adm = false; }
  if (adm !== true) {
    shell('<h2>Not authorized.</h2><p class="muted">This area is for the site owner. Your account does not have admin access.</p>');
    return;
  }
  shell('<div class="skel"></div>');
  let ov, audit;
  try {
    [ov, audit] = await Promise.all([rpc('admin_overview'), rpc('admin_audit')]);
  } catch (e) {
    shell(`<h2>Admin</h2><p class="muted">Could not load the admin overview: ${esc(e.message || 'unknown error')}</p>`);
    return;
  }
  const t = ov.totals || {};
  shell(`
    <p class="eyebrow">Super-admin</p><h2>Site overview</h2>
    <div class="statgrid">
      <div class="stat"><b>${t.users ?? 0}</b><span>Users</span></div>
      <div class="stat"><b>${t.events ?? 0}</b><span>Events</span></div>
      <div class="stat"><b>${t.guests ?? 0}</b><span>Named guests</span></div>
      <div class="stat"><b>${t.answers ?? 0}</b><span>Answers</span></div>
      <div class="stat"><b>${t.banners ?? 0}</b><span>Banners</span></div>
    </div>
    <div class="card reveal in"><h4>Users</h4>
      <table class="tbl"><thead><tr><th>Email</th><th>Events</th><th>Joined</th><th>Last sign-in</th></tr></thead>
      <tbody>${(ov.users || []).map(u => `<tr><td>${esc(u.email || '')}</td><td>${u.events}</td><td>${ts(u.created_at)}</td><td>${ts(u.last_sign_in_at)}</td></tr>`).join('')}</tbody></table></div>
    <div class="card reveal in"><h4>Events</h4>
      <table class="tbl"><thead><tr><th>Event</th><th>Host</th><th>Date</th><th>Guests</th><th>Answers</th><th>Coming</th><th>Banner</th></tr></thead>
      <tbody>${(ov.events || []).map(e => `<tr><td>${esc(e.title)}</td><td>${esc(e.host_email || e.host_name || '')}</td><td>${fmtDate(e.event_date)}</td><td>${e.guests}</td><td>${e.answers}</td><td>${e.coming}</td><td>${e.has_banner ? 'Yes' : '-'}</td></tr>`).join('')}</tbody></table></div>
    <div class="card reveal in"><h4>Admin activity</h4>
      <p class="muted">Every admin lookup is recorded here automatically.</p>
      <table class="tbl"><thead><tr><th>When</th><th>Action</th><th>Actor</th></tr></thead>
      <tbody>${(audit || []).map(l => `<tr><td>${ts(l.created_at)}</td><td>${esc(l.action)}</td><td class="muted">${esc(String(l.actor).slice(0, 8))}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">No activity yet.</td></tr>'}</tbody></table></div>`);
}

initEffects();
boot();
