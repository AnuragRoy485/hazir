// Super-admin page: overview plus confirmation-gated CRUD over users and events.
// Every read and mutation goes through server-enforced RPCs that check the admin
// role and write an audit row. No client-side role checks are trusted. Deletions
// require typing a confirmation word; passwords are never shown or editable.
import { auth } from '../lib/auth.js';
import { request } from '../lib/http.js';
import { rpc } from '../lib/db.js';
import { $, $$, initEffects, confirmBox, toast } from '../lib/ui.js';
import { esc, fmtDate, fmtTime, OCCASIONS, TZS, zonedToIso, isoToZoned, guestLink } from '../lib/format.js';
import { uploadBanner, uploadFallbackOg, cleanupOldBanner, BANNER_TYPES, BANNER_MAX } from '../lib/storage.js';

const root = $('#root'), navr = $('#navr');

function nav(name) {
  navr.innerHTML = `<span class="who">${esc(name)}</span><a class="btn btn-ghost btn-sm" href="app.html">My events</a><button class="btn btn-ghost btn-sm" id="so">Log out</button>`;
  $('#so').onclick = async () => { await auth.signOut(); location.href = 'app.html'; };
}
const shell = html => { root.innerHTML = `<section class="evpage">${html}</section>`; };
const ts = v => v ? new Date(v).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '-';

const LABELS = { admin_overview: 'Viewed the overview', admin_update_user: 'Edited a host', admin_delete_user: 'Deleted a host', admin_update_event: 'Edited an event', admin_delete_event: 'Deleted an event', admin_view_event: 'Viewed RSVP details', admin_delete_users: 'Deleted hosts in bulk', admin_delete_events: 'Deleted events in bulk', admin_update_response: 'Edited a guest answer', admin_delete_response: 'Deleted a guest answer', admin_add_invitee: 'Added a guest', admin_delete_invitee: 'Removed a guest', admin_add_response: 'Recorded a guest answer', admin_create_event: 'Created an event', admin_request_password_reset: 'Sent a password-reset email' };
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
    case 'admin_update_response': return `Edited ${d.guest || 'a guest'}'s answer for "${d.event || ''}"`;
    case 'admin_delete_response': return `Deleted ${d.guest || 'a guest'}'s answer for "${d.event || ''}"`;
    case 'admin_add_invitee': return `Added the guest "${d.guest || ''}" to "${d.event || ''}"`;
    case 'admin_delete_invitee': return `Removed the guest "${d.guest || ''}" from "${d.event || ''}"`;
    case 'admin_add_response': return `Recorded an answer for "${d.guest || ''}" for "${d.event || ''}"`;
    case 'admin_create_event': return `Created the event "${d.title || ''}" for ${d.host || 'a host'}`;
    case 'admin_request_password_reset': return `Sent a password-reset email to ${d.user || 'a host'}`;
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
      <div class="tblwrap"><table class="tbl cardsm"><thead><tr><th><input type="checkbox" id="sah" aria-label="Select all hosts"></th><th>Name</th><th>Email</th><th>Events</th><th>Joined</th><th>Last sign-in</th><th></th></tr></thead>
      <tbody id="tbh">${hosts.map(u => `<tr><td class="nolabel"><input type="checkbox" data-su="${u.id}" data-m="${esc(u.email || '')}"></td><td data-l="Name">${esc(u.name || 'Not set')}</td><td data-l="Email">${esc(u.email || '')}</td><td data-l="Events">${u.events}</td><td data-l="Joined">${ts(u.created_at)}</td><td data-l="Last sign-in">${ts(u.last_sign_in_at)}</td>
        <td class="row"><button class="mini" data-vu="${u.id}">View</button><button class="mini" data-eu="${u.id}" data-n="${esc(u.name || '')}">Edit</button><button class="mini" data-rp="${esc(u.email || '')}">Reset</button><button class="mini" data-du="${u.id}" data-m="${esc(u.email || '')}">Delete</button></td></tr>`).join('') || '<tr><td colspan="7" class="muted">No hosts yet.</td></tr>'}</tbody></table></div></div>
    ${tests.length ? `<div class="card reveal in testcard"><h4>Test accounts</h4>
      <p class="muted">Created by automated checks during development. Kept for the record; removal needs your approval.</p>
      <div class="row"><input class="srch" id="st" placeholder="Search test accounts" autocomplete="off"><button class="btn btn-ghost btn-sm bulkbar" id="bdt" hidden>Delete selected</button></div>
      <div class="tblwrap"><table class="tbl cardsm"><thead><tr><th><input type="checkbox" id="sat" aria-label="Select all test accounts"></th><th>Email</th><th>Events</th><th>Created</th><th></th></tr></thead>
      <tbody id="tbt">${tests.map(u => `<tr><td class="nolabel"><input type="checkbox" data-su="${u.id}" data-m="${esc(u.email || '')}"></td><td data-l="Email">${esc(u.email || '')}</td><td data-l="Events">${u.events}</td><td data-l="Created">${ts(u.created_at)}</td>
        <td class="row"><button class="mini" data-rp="${esc(u.email || '')}">Reset</button><button class="mini" data-du="${u.id}" data-m="${esc(u.email || '')}">Delete</button></td></tr>`).join('')}</tbody></table></div></div>` : ''}
    <div class="card reveal in"><h4>Events</h4>
      <div class="row"><button class="btn btn-ghost btn-sm" id="ne">New event for a host</button></div>
      <div class="row"><input class="srch" id="se" placeholder="Search events or hosts" autocomplete="off"><select class="srch sel" id="fev"><option value="all">All dates</option><option value="up">Upcoming</option><option value="past">Past</option></select><button class="btn btn-ghost btn-sm bulkbar" id="bde" hidden>Delete selected</button></div>
      <div class="tblwrap"><table class="tbl cardsm"><thead><tr><th><input type="checkbox" id="sae" aria-label="Select all events"></th><th>Event</th><th>Host</th><th>Date</th><th>Guests</th><th>Answers</th><th>Coming</th><th>Banner</th><th></th></tr></thead>
      <tbody id="tbe">${(ov.events || []).map(e => `<tr data-d="${e.event_date}"><td class="nolabel"><input type="checkbox" data-se="${e.id}" data-m="${esc(e.title)}"></td><td data-l="Event">${esc(e.title)}</td><td data-l="Host">${esc(e.host_email || e.host_name || '')}</td><td data-l="Date">${fmtDate(e.event_date)}</td><td data-l="Guests">${e.guests}</td><td data-l="Answers">${e.answers}</td><td data-l="Coming">${e.coming}</td><td data-l="Banner">${e.has_banner ? 'Yes' : '-'}</td>
        <td class="row"><button class="mini" data-ve="${e.id}">View</button><button class="mini" data-ee="${e.id}">Edit</button><button class="mini" data-de="${e.id}" data-t="${esc(e.title)}">Delete</button></td></tr>`).join('')}</tbody></table></div></div>
    <div class="card reveal in"><h4>Admin activity</h4>
      <p class="muted">Every admin lookup and change is recorded here automatically.</p>
      <div class="row"><input class="srch" id="sa" placeholder="Search activity" autocomplete="off"><select class="srch sel" id="fa"><option value="all">All actions</option><option value="view">Views</option><option value="edit">Edits</option><option value="del">Deletions</option></select></div>
      <div class="tblwrap"><table class="tbl cardsm"><thead><tr><th>When</th><th>What happened</th><th>By</th></tr></thead>
      <tbody id="tba">${(audit || []).map(l => `<tr><td data-l="When">${ts(l.created_at)}</td><td data-l="What happened">${esc(describe(l))}</td><td data-l="By" class="muted">${esc(l.actor_email || 'Deleted account')}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">No activity yet.</td></tr>'}</tbody></table></div></div>`);
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
      ${evs.length ? `<div class="tblwrap"><table class="tbl cardsm"><thead><tr><th>Event</th><th>Date</th><th>Guests</th><th>Answers</th><th>Coming</th><th></th></tr></thead>
      <tbody>${evs.map(e => `<tr><td data-l="Event">${esc(e.title)}</td><td data-l="Date">${fmtDate(e.event_date)}</td><td data-l="Guests">${e.guests}</td><td data-l="Answers">${e.answers}</td><td data-l="Coming">${e.coming}</td>
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
  $$('[data-rp]').forEach(b => b.onclick = async () => {
    const okd = await confirmBox({ title: 'Reset this password?', body: `"${b.dataset.rp}" will get an email with a link to choose a new password. Their current password stays hidden and keeps working until they finish the reset.`, ok: 'Email reset link' });
    if (!okd) return;
    try {
      await request('/auth/v1/recover', { method: 'POST', body: { email: b.dataset.rp } });
      await rpc('admin_request_password_reset', { p_email: b.dataset.rp });
      toast('Reset email sent');
    } catch (e) { toast(e.message || 'Could not send the reset email', 1); }
  });
  const ne = $('#ne');
  if (ne) ne.onclick = async () => {
    const out = await editDialog('New event for a host', [
      { key: 'email', label: "Host's account email", value: '', max: 120 },
      { key: 'title', label: 'Event name', value: '', max: 80 },
      { key: 'occasion', label: 'Occasion', value: 'Other', max: 40 },
      { key: 'date', label: 'Date (YYYY-MM-DD)', value: '', max: 10, type: 'date' },
      { key: 'host', label: 'Hosted by (optional)', value: '', max: 40 }]);
    if (!out) return;
    try {
      await rpc('admin_create_event', { p_host_email: out.email, p_title: out.title, p_occasion: out.occasion, p_event_date: out.date || null, p_host_name: out.host });
      again('Event created');
    } catch (e) { toast(e.message || 'Create failed', 1); }
  };
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
    <label class="field">Event banner (optional)
      <input id="ef-bn" type="file" accept="${BANNER_TYPES.join(',')}" hidden>
      <span class="bnbox" id="ef-bnbox" tabindex="0" role="button" aria-label="Event banner. Activate to choose an image; when one is set, change or remove it."><img id="ef-bnimg" alt="Event banner preview" ${ev.banner ? `src="${esc(ev.banner)}"` : ''} ${ev.banner ? '' : 'hidden'}><span class="bnph" id="ef-bnph" ${ev.banner ? 'hidden' : ''}>Choose an image</span><span class="bnact" id="ef-bnact" ${ev.banner ? '' : 'hidden'}><button type="button" class="mini" id="ef-bnchg">Change banner</button><button type="button" class="mini" id="ef-bnrem">Remove banner</button></span></span></label>
    <div class="row end"><button class="btn btn-ghost btn-sm" id="ec">Cancel</button><button class="btn btn-sm" id="eo">Save</button></div></div>`;
  document.body.appendChild(w); document.body.classList.add('noscroll');
  requestAnimationFrame(() => w.classList.add('in'));
  let bfile = null, rmPending = false;
  const bni = w.querySelector('#ef-bn'), bimg = w.querySelector('#ef-bnimg'), bph = w.querySelector('#ef-bnph'), bact = w.querySelector('#ef-bnact'), bbox = w.querySelector('#ef-bnbox'), brem = w.querySelector('#ef-bnrem');
  const syncBn = () => {
    const has = !!(bfile || (ev.banner && !rmPending));
    bimg.hidden = !has; bph.hidden = has; bact.hidden = !has;
    if (bfile) bimg.src = URL.createObjectURL(bfile);
    else if (!rmPending && ev.banner && bimg.getAttribute('src') !== ev.banner) bimg.src = ev.banner;
    brem.textContent = rmPending ? 'Undo remove' : 'Remove banner';
  };
  bbox.addEventListener('click', y => { if (y.target.closest('button')) return; const has = !!(bfile || (ev.banner && !rmPending)); if (has && matchMedia('(hover: none)').matches) { bbox.classList.toggle('on'); return; } bni.click(); });
  w.querySelector('#ef-bnchg').onclick = () => bni.click();
  brem.onclick = () => { if (bfile) { bfile = null; bni.value = ''; rmPending = false; } else if (ev.banner) { rmPending = !rmPending; } bbox.classList.remove('on'); syncBn(); };
  bni.onchange = () => {
    const f = bni.files[0]; if (!f) return;
    if (!BANNER_TYPES.includes(f.type)) { toast('The banner needs to be a PNG, JPG or WebP image.', 1); bni.value = ''; return; }
    if (f.size > BANNER_MAX) { toast('Banner images can be up to 5 MB.', 1); bni.value = ''; return; }
    bfile = f; rmPending = false; syncBn();
  };
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
    try {
      if (bfile) {
        const urls = await uploadBanner(id, bfile);
        patch.banner = urls.banner; patch.banner_og = urls.banner_og;
        if (ev.banner) cleanupOldBanner(ev.id, ev.banner, urls.banner);
      } else if (ev.banner && rmPending) {
        const og = await uploadFallbackOg(id, { title: patch.title, when: fmtDate(patch.event_date), host: patch.host_name });
        patch.banner = ''; patch.banner_og = og.banner_og;
        cleanupOldBanner(ev.id, ev.banner, null);
      }
    } catch (err) { toast('Banner failed: ' + (err.message || 'upload error'), 1); return; }
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
    const resRow = r => `<tr data-rid="${r.id}">
      <td data-l="Name">${esc(r.name || '')}</td><td data-l="Status">${r.attending ? 'Coming' : 'Declined'}</td>
      <td data-l="Adults">${r.attending ? (r.adults ?? r.party ?? '') : ''}</td><td data-l="Kids">${r.attending ? (r.kids || 0) : ''}</td>
      <td data-l="Group">${esc(r.grp || '')}</td><td data-l="Meal">${esc(r.meal || '')}</td>
      <td data-l="Arrival">${r.attending && r.arrival != null ? fmtTime(r.arrival) : ''}</td><td data-l="Note">${esc(r.note || '')}</td>
      <td><button class="mini" data-er="${r.id}">Edit</button> <button class="mini danger" data-dr="${r.id}">Delete</button></td></tr>`;
    const invRow = i => `<tr><td data-l="Name">${esc(i.name)}</td>
      <td><button class="mini" data-ci="${i.token}">Copy link</button> <button class="mini danger" data-di="${i.id}">Remove</button></td></tr>`;
    detailCard(`<h4>${esc(ev.title || 'Event')}</h4>
      <p class="muted">${esc(ev.occasion || '')} · ${fmtDate(ev.event_date)} · Host: ${esc(ev.host_email || ev.host_name || '')} · ${res.length} answer${res.length === 1 ? '' : 's'}, ${awaiting.length} awaiting</p>
      <div class="linkbox" style="margin-bottom:14px"><input readonly value="${guestLink({ id: ev.id })}"><button class="btn btn-sm" id="adcopy">Copy</button></div>
      ${res.length ? `<div class="tblwrap"><table class="tbl cardsm"><thead><tr><th>Name</th><th>Status</th><th>Adults</th><th>Kids</th><th>Group</th><th>Meal</th><th>Arrival</th><th>Note</th><th></th></tr></thead>
      <tbody>${res.map(resRow).join('')}</tbody></table></div>` : '<p class="muted">No answers yet.</p>'}
      <h4 style="margin-top:18px">Guest list</h4>
      ${inv.length ? `<div class="tblwrap"><table class="tbl cardsm"><thead><tr><th>Name</th><th></th></tr></thead><tbody>${inv.map(invRow).join('')}</tbody></table></div>` : '<p class="muted">No guests on the list yet.</p>'}
      <div class="row" style="margin-top:10px"><input id="adgn" maxlength="40" placeholder="New guest name" style="flex:1;min-width:160px"><button class="btn btn-sm" id="adga">Add guest</button><button class="btn btn-ghost btn-sm" id="adra">Record an answer</button></div>`);
    const cp = $('#adcopy'); if (cp) cp.onclick = () => { navigator.clipboard.writeText(guestLink({ id: ev.id })).then(() => toast('Link copied')); };
    const reload = () => { const vb = document.querySelector(`[data-ve="${ev.id}"]`); if (vb) vb.click(); };
    const resById = id => res.find(r => r.id === id);
    $$('#adetail [data-er]').forEach(b => b.onclick = async () => {
      const r = resById(b.dataset.er); if (!r) return;
      const out = await editDialog('Edit answer for ' + (r.name || 'guest'), [
        { key: 'name', label: 'Name', value: r.name || '', max: 40 },
        { key: 'attending', label: "Coming? type 'yes' or 'no'", value: r.attending ? 'yes' : 'no', max: 3 },
        { key: 'adults', label: 'Adults (0-10)', value: r.adults ?? r.party ?? 0, max: 2, type: 'number' },
        { key: 'kids', label: 'Kids (0-10)', value: r.kids ?? 0, max: 2, type: 'number' },
        { key: 'grp', label: 'Group', value: r.grp || '', max: 20 },
        { key: 'meal', label: 'Meal', value: r.meal || '', max: 20 },
        { key: 'arrival', label: 'Arrival (minutes after midnight, optional)', value: r.arrival == null ? '' : r.arrival, max: 4, type: 'number' },
        { key: 'note', label: 'Note', value: r.note || '', max: 120 }]);
      if (!out) return;
      const patch = { name: out.name, attending: /^y/i.test(out.attending.trim()), adults: parseInt(out.adults || '0', 10), kids: parseInt(out.kids || '0', 10), grp: out.grp, meal: out.meal, arrival: out.arrival === '' ? '' : parseInt(out.arrival, 10), note: out.note };
      try { await rpc('admin_update_response', { p_response_id: r.id, p_patch: patch }); toast('Answer updated'); reload(); }
      catch (e) { toast(e.message || 'Update failed', 1); }
    });
    $$('#adetail [data-dr]').forEach(b => b.onclick = async () => {
      const r = resById(b.dataset.dr); if (!r) return;
      const okd = await confirmBox({ title: 'Delete this answer?', body: `"${r.name || 'This guest'}"'s answer will be removed permanently. This cannot be undone.`, ok: 'Delete answer', word: 'delete', danger: true });
      if (!okd) return;
      try { await rpc('admin_delete_response', { p_response_id: r.id }); toast('Answer deleted'); reload(); }
      catch (e) { toast(e.message || 'Delete failed', 1); }
    });
    $$('#adetail [data-ci]').forEach(b => b.onclick = () => {
      navigator.clipboard.writeText(guestLink({ id: ev.id, token: b.dataset.ci })).then(() => toast('Personal link copied'));
    });
    $$('#adetail [data-di]').forEach(b => b.onclick = async () => {
      const i = inv.find(x => x.id === b.dataset.di); if (!i) return;
      const okd = await confirmBox({ title: 'Remove this guest?', body: `"${i.name}" will be removed from the guest list along with any answer they gave. This cannot be undone.`, ok: 'Remove guest', word: 'remove', danger: true });
      if (!okd) return;
      try { await rpc('admin_delete_invitee', { p_invitee_id: i.id }); toast('Guest removed'); reload(); }
      catch (e) { toast(e.message || 'Remove failed', 1); }
    });
    const ra = $('#adra');
    if (ra) ra.onclick = async () => {
      const out = await editDialog('Record an answer (walk-in or phone)', [
        { key: 'name', label: 'Name', value: '', max: 40 },
        { key: 'attending', label: "Coming? type 'yes' or 'no'", value: 'yes', max: 3 },
        { key: 'adults', label: 'Adults (0-10)', value: 1, max: 2, type: 'number' },
        { key: 'kids', label: 'Kids (0-10)', value: 0, max: 2, type: 'number' },
        { key: 'grp', label: 'Group', value: '', max: 20 },
        { key: 'meal', label: 'Meal', value: '', max: 20 },
        { key: 'note', label: 'Note', value: 'Added by admin', max: 120 }]);
      if (!out || !out.name.trim()) return;
      try {
        await rpc('admin_add_response', { p_event_id: ev.id, p_name: out.name, p_attending: /^y/i.test(out.attending.trim()),
          p_adults: parseInt(out.adults || '1', 10), p_kids: parseInt(out.kids || '0', 10), p_grp: out.grp, p_meal: out.meal, p_note: out.note });
        toast('Answer recorded'); reload();
      } catch (e) { toast(e.message || 'Could not record the answer', 1); }
    };
    const ga = $('#adga');
    if (ga) ga.onclick = async () => {
      const inp = $('#adgn'), name = (inp.value || '').trim();
      if (!name) { toast('Type a name first', 1); return; }
      try { await rpc('admin_add_invitee', { p_event_id: ev.id, p_name: name }); toast('Guest added'); reload(); }
      catch (e) { toast(e.message || 'Add failed', 1); }
    };
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
