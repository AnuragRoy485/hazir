// Super-admin page: overview plus confirmation-gated CRUD over users and events.
// Every read and mutation goes through server-enforced RPCs that check the admin
// role and write an audit row. No client-side role checks are trusted. Deletions
// require typing a confirmation word; passwords are never shown or editable.
import { auth } from '../lib/auth.js';
import { rpc } from '../lib/db.js';
import { $, $$, initEffects, confirmBox, toast } from '../lib/ui.js';
import { esc, fmtDate, fmtTime, OCCASIONS, TZS, zonedToIso, isoToZoned, guestLink } from '../lib/format.js';

const root = $('#root'), navr = $('#navr');

function nav(name) {
  navr.innerHTML = `<span class="who">${esc(name)}</span><a class="btn btn-ghost btn-sm" href="app.html">My events</a><button class="btn btn-ghost btn-sm" id="so">Log out</button>`;
  $('#so').onclick = async () => { await auth.signOut(); location.href = 'app.html'; };
}
const shell = html => { root.innerHTML = `<section class="evpage">${html}</section>`; };
const ts = v => v ? new Date(v).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '-';

const LABELS = { admin_overview: 'Viewed the overview', admin_update_user: 'Edited a host', admin_delete_user: 'Deleted a host', admin_update_event: 'Edited an event', admin_delete_event: 'Deleted an event', admin_view_event: 'Viewed RSVP details', admin_delete_users: 'Deleted hosts in bulk', admin_delete_events: 'Deleted events in bulk' };
function describe(l) {
  const d = l.detail || {};
  switch (l.action) {
    case 'admin_update_user': return `Renamed ${d.user || 'a host'} to "${d.name || ''}"`;
    case 'admin_delete_user': return `Deleted ${d.user || 'a host'} and all their data`;
    case 'admin_update_event': return `Edited the event "${d.title || ''}"`;
    case 'admin_delete_event': return `Deleted the event "${d.title || ''}"`;
    case 'admin_view_event': return `Viewed RSVP details for "${d.title || ''}"`;
    case 'admin_delete_users': return `Deleted ${d.count || 0} host${d.count === 1 ? '' : 's'}: ${(d.users || []).join(', ')}`;
    case 'admin_delete_events': return `Deleted ${d.count || 0} event${d.count === 1 ? '' : 's'}: ${(d.events || []).map(t => '"' + t + '"').join(', ')}`;
    default: return LABELS[l.action] || l.action.replace(/_/g, ' ');
  }
}

function editDialog(title, fields) {
  return new Promise(res => {
    const w = document.createElement('div'); w.className = 'modal-wrap';
    w.innerHTML = `<div class="dlg-bg"></div><div class="dlg" role="dialog" aria-modal="true"><h3>${esc(title)}</h3>
      ${fields.map(f => `<label class="field">${esc(f.label)}<input id="ef-${f.key}" maxlength="${f.max || 80}" value="${esc(f.value || '')}" ${f.type ? `type="${f.type}"` : ''}></label>`).join('')}
      <div class="row end"><button class="btn btn-ghost btn-sm" id="ec">Cancel</button><button class="btn btn-sm" id="eo">Save</button></div></div>`;
    document.body.appendChild(w); document.body.classList.add('noscroll');
    requestAnimationFrame(() => w.classList.add('in'));
    const done = v => { w.classList.remove('in'); document.body.classList.remove('noscroll'); setTimeout(() => w.remove(), 250); res(v); };
    w.querySelector('#ec').onclick = () => done(null);
    w.querySelector('#eo').onclick = () => { const out = {}; fields.forEach(f => out[f.key] = w.querySelector('#ef-' + f.key).value); done(out); };
    w.querySelector('input').focus();
  });
}

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
  await paint();
}

async function paint() {
  shell('<div class="skel"></div>');
  let ov, audit;
  try {
    [ov, audit] = await Promise.all([rpc('admin_overview'), rpc('admin_audit')]);
  } catch (e) {
    shell(`<h2>Admin</h2><p class="muted">Could not load the admin overview: ${esc(e.message || 'unknown error')}</p>`);
    return;
  }
  const t = ov.totals || {};
  const users = ov.users || [];
  const hosts = users.filter(u => !u.is_test), tests = users.filter(u => u.is_test);
  shell(`
    <p class="eyebrow">Super-admin</p><h2>Site overview</h2>
    <div class="statgrid">
      <div class="stat"><b>${t.users ?? 0}</b><span>Users</span></div>
      <div class="stat"><b>${t.events ?? 0}</b><span>Events</span></div>
      <div class="stat"><b>${t.guests ?? 0}</b><span>Named guests</span></div>
      <div class="stat"><b>${t.answers ?? 0}</b><span>Answers</span></div>
      <div class="stat"><b>${t.banners ?? 0}</b><span>Banners</span></div>
    </div>
    <div class="card reveal in"><h4>Hosts</h4>
      <p class="muted">${hosts.length} real host${hosts.length === 1 ? '' : 's'}${tests.length ? ` · ${tests.length} test account${tests.length === 1 ? '' : 's'} from automated checks listed below` : ''}.</p>
      <div class="row"><input class="srch" id="sh" placeholder="Search hosts" autocomplete="off"><button class="btn btn-ghost btn-sm bulkbar" id="bdh" hidden>Delete selected</button></div>
      <div class="tblwrap"><table class="tbl"><thead><tr><th><input type="checkbox" id="sah" aria-label="Select all hosts"></th><th>Name</th><th>Email</th><th>Events</th><th>Joined</th><th>Last sign-in</th><th></th></tr></thead>
      <tbody id="tbh">${hosts.map(u => `<tr><td><input type="checkbox" data-su="${u.id}" data-m="${esc(u.email || '')}"></td><td>${esc(u.name || 'Not set')}</td><td>${esc(u.email || '')}</td><td>${u.events}</td><td>${ts(u.created_at)}</td><td>${ts(u.last_sign_in_at)}</td>
        <td class="row"><button class="mini" data-vu="${u.id}">View</button><button class="mini" data-eu="${u.id}" data-n="${esc(u.name || '')}">Edit</button><button class="mini" data-du="${u.id}" data-m="${esc(u.email || '')}">Delete</button></td></tr>`).join('') || '<tr><td colspan="7" class="muted">No hosts yet.</td></tr>'}</tbody></table></div></div>
    ${tests.length ? `<div class="card reveal in testcard"><h4>Test accounts</h4>
      <p class="muted">Created by automated checks during development. Kept for the record; removal needs your approval.</p>
      <div class="row"><input class="srch" id="st" placeholder="Search test accounts" autocomplete="off"><button class="btn btn-ghost btn-sm bulkbar" id="bdt" hidden>Delete selected</button></div>
      <div class="tblwrap"><table class="tbl"><thead><tr><th><input type="checkbox" id="sat" aria-label="Select all test accounts"></th><th>Email</th><th>Events</th><th>Created</th><th></th></tr></thead>
      <tbody id="tbt">${tests.map(u => `<tr><td><input type="checkbox" data-su="${u.id}" data-m="${esc(u.email || '')}"></td><td>${esc(u.email || '')}</td><td>${u.events}</td><td>${ts(u.created_at)}</td>
        <td class="row"><button class="mini" data-du="${u.id}" data-m="${esc(u.email || '')}">Delete</button></td></tr>`).join('')}</tbody></table></div></div>` : ''}
    <div class="card reveal in"><h4>Events</h4>
      <div class="row"><input class="srch" id="se" placeholder="Search events or hosts" autocomplete="off"><select class="srch sel" id="fev"><option value="all">All dates</option><option value="up">Upcoming</option><option value="past">Past</option></select><button class="btn btn-ghost btn-sm bulkbar" id="bde" hidden>Delete selected</button></div>
      <div class="tblwrap"><table class="tbl"><thead><tr><th><input type="checkbox" id="sae" aria-label="Select all events"></th><th>Event</th><th>Host</th><th>Date</th><th>Guests</th><th>Answers</th><th>Coming</th><th>Banner</th><th></th></tr></thead>
      <tbody id="tbe">${(ov.events || []).map(e => `<tr data-d="${e.event_date}"><td><input type="checkbox" data-se="${e.id}" data-m="${esc(e.title)}"></td><td>${esc(e.title)}</td><td>${esc(e.host_email || e.host_name || '')}</td><td>${fmtDate(e.event_date)}</td><td>${e.guests}</td><td>${e.answers}</td><td>${e.coming}</td><td>${e.has_banner ? 'Yes' : '-'}</td>
        <td class="row"><button class="mini" data-ve="${e.id}">View</button><button class="mini" data-ee="${e.id}">Edit</button><button class="mini" data-de="${e.id}" data-t="${esc(e.title)}">Delete</button></td></tr>`).join('')}</tbody></table></div></div>
    <div class="card reveal in"><h4>Admin activity</h4>
      <p class="muted">Every admin lookup and change is recorded here automatically.</p>
      <div class="row"><input class="srch" id="sa" placeholder="Search activity" autocomplete="off"><select class="srch sel" id="fa"><option value="all">All actions</option><option value="view">Views</option><option value="edit">Edits</option><option value="del">Deletions</option></select></div>
      <div class="tblwrap"><table class="tbl"><thead><tr><th>When</th><th>What happened</th><th>By</th></tr></thead>
      <tbody id="tba">${(audit || []).map(l => `<tr><td>${ts(l.created_at)}</td><td>${esc(describe(l))}</td><td class="muted">${esc(l.actor_email || 'Deleted account')}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">No activity yet.</td></tr>'}</tbody></table></div></div>`);
  wire(ov);
}

function detailCard(html) {
  const old = $('#adetail'); if (old) old.remove();
  const d = document.createElement('div'); d.id = 'adetail'; d.className = 'card reveal in';
  d.innerHTML = html + '<div class="row"><button class="btn btn-ghost btn-sm" id="adclose">Close</button></div>';
  const anchor = $('#root .evpage'); anchor.insertBefore(d, anchor.children[2] || null);
  d.scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('#adclose').onclick = () => d.remove();
}

function wire(ov) {
  $$('[data-vu]').forEach(b => b.onclick = () => {
    const u = (ov.users || []).find(x => x.id === b.dataset.vu); if (!u) return;
    const evs = (ov.events || []).filter(e => (e.host_email || '') === (u.email || ''));
    detailCard(`<h4>Host profile</h4>
      <p><b>${esc(u.name || 'Not set')}</b><br><span class="muted">${esc(u.email || '')}</span></p>
      <p class="muted">Joined ${ts(u.created_at)} · Last sign-in ${ts(u.last_sign_in_at)} · ${u.events} event${u.events === 1 ? '' : 's'}</p>
      ${evs.length ? `<div class="tblwrap"><table class="tbl"><thead><tr><th>Event</th><th>Date</th><th>Guests</th><th>Answers</th><th>Coming</th><th></th></tr></thead>
      <tbody>${evs.map(e => `<tr><td>${esc(e.title)}</td><td>${fmtDate(e.event_date)}</td><td>${e.guests}</td><td>${e.answers}</td><td>${e.coming}</td>
        <td><button class="mini" data-ve="${e.id}">View</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">No events.</p>'}`);
    wireEventViews();
  });
  const again = async (msg) => { if (msg) toast(msg); await paint(); };
  $$('[data-eu]').forEach(b => b.onclick = async () => {
    const out = await editDialog('Edit host name', [{ key: 'name', label: 'Display name', value: b.dataset.n, max: 40 }]);
    if (!out) return;
    try { await rpc('admin_update_user', { p_user_id: b.dataset.eu, p_name: out.name }); again('Host updated'); }
    catch (e) { toast(e.message || 'Update failed', 1); }
  });
  $$('[data-du]').forEach(b => b.onclick = async () => {
    const okd = await confirmBox({ title: 'Delete this host?', body: `"${b.dataset.m}" and all their events, guests and answers will be removed permanently. This cannot be undone.`, ok: 'Delete host', word: 'delete', danger: true });
    if (!okd) return;
    try { await rpc('admin_delete_user', { p_user_id: b.dataset.du }); again('Host deleted'); }
    catch (e) { toast(e.message || 'Delete failed', 1); }
  });
  wireEventViews();
  $$('[data-ee]').forEach(b => b.onclick = () => editEventFull(ov, b.dataset.ee, again));
  wireFilters();
  $$('[data-de]').forEach(b => b.onclick = async () => {
    const okd = await confirmBox({ title: 'Delete this event?', body: `"${b.dataset.t}", all its guests and all answers will be removed permanently. This cannot be undone.`, ok: 'Delete event', word: 'delete', danger: true });
    if (!okd) return;
    try { await rpc('admin_delete_event', { p_event_id: b.dataset.de }); again('Event deleted'); }
    catch (e) { toast(e.message || 'Delete failed', 1); }
  });
}

function editEventFull(ov, id, again) {
  const ev = (ov.events || []).find(x => x.id === id); if (!ev) return;
  const dz = ev.deadline_at ? isoToZoned(ev.deadline_at, ev.tz || 'Asia/Kolkata') : { date: '', time: '' };
  const hm = v => `${String(Math.floor((v ?? 1140) / 60)).padStart(2, '0')}:${String((v ?? 1140) % 60).padStart(2, '0')}`;
  const w = document.createElement('div'); w.className = 'modal-wrap';
  w.innerHTML = `<div class="dlg-bg"></div><div class="dlg dlg-wide" role="dialog" aria-modal="true"><h3>Edit event</h3>
    <label class="field">Event name<input id="ef-title" maxlength="80" value="${esc(ev.title)}"></label>
    <div class="two"><label class="field">Occasion<select id="ef-occasion">${OCCASIONS.map(x => `<option${x === ev.occasion ? ' selected' : ''}>${x}</option>`).join('')}</select></label>
    <label class="field">Date<input id="ef-date" type="date" value="${ev.event_date || ''}"></label></div>
    <div class="two"><label class="field">Hosted by<input id="ef-host" maxlength="40" value="${esc(ev.host_name || '')}"></label>
    <label class="field">Guests invited<input id="ef-invited" type="number" min="1" max="5000" value="${ev.invited ?? 100}"></label></div>
    <div class="two"><label class="field">Hosted at (optional)<input id="ef-venue" maxlength="120" value="${esc(ev.venue || '')}"></label>
    <label class="field">Plus-ones up to<select id="ef-maxp">${[1,2,3,4,6,8,10].map(x => `<option${x === ev.max_party ? ' selected' : ''}>${x}</option>`).join('')}</select></label></div>
    <div class="two"><label class="field">RSVP closes on (optional)<input id="ef-dld" type="date" value="${dz.date}"></label>
    <label class="field">At what time<input id="ef-dlt" type="time" value="${dz.time}"></label></div>
    <label class="field">Timezone for the deadline<select id="ef-tz">${TZS.map(x => `<option${x === ev.tz ? ' selected' : ''}>${x}</option>`).join('')}</select></label>
    <label class="field">Message to guests (optional)<textarea id="ef-msg" rows="3" maxlength="300">${esc(ev.message || '')}</textarea></label>
    <div class="two"><label class="field">Usual arrival time<input id="ef-time" type="time" value="${hm(ev.default_time)}"></label>
    <label class="field">RSVPs<select id="ef-closed"><option value="open"${!ev.rsvp_closed ? ' selected' : ''}>Open</option><option value="closed"${ev.rsvp_closed ? ' selected' : ''}>Closed</option></select></label></div>
    <div class="row end"><button class="btn btn-ghost btn-sm" id="ec">Cancel</button><button class="btn btn-sm" id="eo">Save</button></div></div>`;
  document.body.appendChild(w); document.body.classList.add('noscroll');
  requestAnimationFrame(() => w.classList.add('in'));
  const done = () => { w.classList.remove('in'); document.body.classList.remove('noscroll'); setTimeout(() => w.remove(), 250); };
  w.querySelector('#ec').onclick = done;
  w.querySelector('#eo').onclick = async () => {
    const v = id2 => w.querySelector('#' + id2).value;
    const patch = {
      title: v('ef-title'), occasion: v('ef-occasion'), event_date: v('ef-date'), host_name: v('ef-host'),
      invited: parseInt(v('ef-invited') || '100', 10), venue: v('ef-venue'), max_party: parseInt(v('ef-maxp'), 10),
      message: v('ef-msg'), default_time: (() => { const [h, m] = v('ef-time').split(':').map(Number); return (h || 0) * 60 + (m || 0); })(),
      deadline_at: v('ef-dld') ? zonedToIso(v('ef-dld'), v('ef-dlt') || '23:59', v('ef-tz')) : '',
      tz: v('ef-tz'), rsvp_closed: v('ef-closed') === 'closed'
    };
    try { await rpc('admin_update_event', { p_event_id: id, p_patch: patch }); done(); again('Event updated'); }
    catch (e) { toast(e.message || 'Update failed', 1); }
  };
}

function wireEventViews() {
  $$('[data-ve]').forEach(b => b.onclick = async () => {
    b.disabled = true;
    let det;
    try { det = await rpc('admin_event_detail', { p_event_id: b.dataset.ve }); }
    catch (e) { toast(e.message || 'Could not load event', 1); b.disabled = false; return; }
    b.disabled = false;
    const ev = det.event || {}, res = det.responses || [], inv = det.invitees || [];
    const answered = new Set(res.map(r => (r.name || '').toLowerCase()));
    const awaiting = inv.filter(i => !answered.has((i.name || '').toLowerCase()));
    detailCard(`<h4>${esc(ev.title || 'Event')}</h4>
      <p class="muted">${esc(ev.occasion || '')} · ${fmtDate(ev.event_date)} · Host: ${esc(ev.host_email || ev.host_name || '')} · ${res.length} answer${res.length === 1 ? '' : 's'}, ${awaiting.length} awaiting</p>
      <div class="linkbox" style="margin-bottom:14px"><input readonly value="${guestLink({ id: ev.id })}"><button class="btn btn-sm" id="adcopy">Copy</button></div>
      ${res.length ? `<div class="tblwrap"><table class="tbl"><thead><tr><th>Name</th><th>Status</th><th>Adults</th><th>Kids</th><th>Group</th><th>Meal</th><th>Arrival</th><th>Note</th></tr></thead>
      <tbody>${res.map(r => `<tr><td>${esc(r.name || '')}</td><td>${r.attending ? 'Coming' : 'Declined'}</td><td>${r.attending ? (r.adults ?? r.party ?? '') : ''}</td><td>${r.attending ? (r.kids || 0) : ''}</td><td>${esc(r.grp || '')}</td><td>${esc(r.meal || '')}</td><td>${r.attending && r.arrival != null ? fmtTime(r.arrival) : ''}</td><td>${esc(r.note || '')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">No answers yet.</p>'}
      ${awaiting.length ? `<p class="muted">Awaiting: ${awaiting.map(i => esc(i.name)).join(', ')}</p>` : ''}`);
    const cp = $('#adcopy'); if (cp) cp.onclick = () => { navigator.clipboard.writeText(guestLink({ id: ev.id })).then(() => toast('Link copied')); };
  });
}

function wireFilters() {
  const today = new Date().toISOString().slice(0, 10);
  const rows = id => [...document.querySelectorAll('#' + id + ' tr')];
  const textFilter = (inputId, bodyId) => {
    const el = document.getElementById(inputId); if (!el) return;
    el.oninput = () => { const q = el.value.trim().toLowerCase(); rows(bodyId).forEach(r => r.style.display = r.innerText.toLowerCase().includes(q) ? '' : 'none'); };
  };
  textFilter('sh', 'tbh'); textFilter('st', 'tbt'); textFilter('sa', 'tba');
  const se = $('#se'), fev = $('#fev');
  const evFilter = () => {
    const q = (se.value || '').trim().toLowerCase(), f = fev.value;
    rows('tbe').forEach(r => {
      const okq = r.innerText.toLowerCase().includes(q);
      const d = r.dataset.d || '';
      const okf = f === 'all' || (f === 'up' ? d >= today : d < today);
      r.style.display = okq && okf ? '' : 'none';
    });
  };
  if (se) { se.oninput = evFilter; fev.onchange = evFilter; }
  const fa = $('#fa');
  if (fa) fa.onchange = () => {
    const f = fa.value, q = ($('#sa').value || '').trim().toLowerCase();
    rows('tba').forEach(r => {
      const t = r.innerText.toLowerCase();
      const okf = f === 'all' || (f === 'view' ? t.includes('view') : f === 'edit' ? (t.includes('renamed') || t.includes('edited')) : t.includes('delet'));
      r.style.display = t.includes(q) && okf ? '' : 'none';
    });
  };
  // selection + bulk delete
  const selState = { u: new Set(), e: new Set() };
  const refreshBar = () => {
    const nu = selState.u.size, ne = selState.e.size;
    [['#bdh', selState.u], ['#bdt', selState.u], ['#bde', selState.e]].forEach(([id]) => { const b = $(id); if (b) b.hidden = true; });
    if ($('#bdh')) $('#bdh').hidden = !nu; if ($('#bdt')) $('#bdt').hidden = !nu; if ($('#bde')) $('#bde').hidden = !ne;
    if ($('#bdh') && nu) $('#bdh').textContent = `Delete ${nu} selected`;
    if ($('#bdt') && nu) $('#bdt').textContent = `Delete ${nu} selected`;
    if ($('#bde') && ne) $('#bde').textContent = `Delete ${ne} selected`;
  };
  $$('[data-su]').forEach(c => c.onchange = () => { c.checked ? selState.u.add(c.dataset.su) : selState.u.delete(c.dataset.su); refreshBar(); });
  $$('[data-se]').forEach(c => c.onchange = () => { c.checked ? selState.e.add(c.dataset.se) : selState.e.delete(c.dataset.se); refreshBar(); });
  const all = (id, sel, set) => { const a = $(id); if (a) a.onchange = () => { $$(sel).forEach(c => { c.checked = a.checked; a.checked ? set.add(c.dataset.su || c.dataset.se) : set.delete(c.dataset.su || c.dataset.se); }); refreshBar(); }; };
  all('#sah', '#tbh [data-su]', selState.u); all('#sat', '#tbt [data-su]', selState.u); all('#sae', '#tbe [data-se]', selState.e);
  const bulk = async (kind) => {
    const set = kind === 'u' ? selState.u : selState.e;
    const ids = [...set]; if (!ids.length) return;
    const names = ids.map(id => { const c = document.querySelector(`[data-s${kind}="${id}"]`); return c ? c.dataset.m : id; });
    const what = kind === 'u' ? 'host account' : 'event';
    const okd = await confirmBox({
      title: `Delete ${ids.length} ${what}${ids.length === 1 ? '' : 's'}?`,
      body: `${names.slice(0, 6).map(n => '"' + n + '"').join(', ')}${ids.length > 6 ? ' and ' + (ids.length - 6) + ' more' : ''} - ${kind === 'u' ? 'with all their events, guests and answers' : 'with all guests and answers'} - will be removed permanently. This cannot be undone.`,
      ok: `Delete ${ids.length}`, word: 'delete', danger: true });
    if (!okd) return;
    try {
      const r = await rpc(kind === 'u' ? 'admin_delete_users' : 'admin_delete_events', kind === 'u' ? { p_user_ids: ids } : { p_event_ids: ids });
      toast(`Deleted ${r.deleted}${r.skipped ? ', skipped ' + r.skipped : ''}`);
      await paint();
    } catch (e) { toast(e.message || 'Delete failed', 1); }
  };
  if ($('#bdh')) $('#bdh').onclick = () => bulk('u');
  if ($('#bdt')) $('#bdt').onclick = () => bulk('u');
  if ($('#bde')) $('#bde').onclick = () => bulk('e');
}

initEffects();
boot();
