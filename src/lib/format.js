export const MEALS = ['Veg', 'Non-veg', 'Jain', 'Vegan', 'Kids'];
export const GROUPS = ['Family', 'Friends', 'Colleagues', 'Other'];
export const OCCASIONS = ['Wedding', 'Birthday', 'Puja', 'Baby shower', 'Dinner', 'Corporate', 'Other'];

export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** Minutes since midnight to "6:30 PM". */
export const fmtTime = m => {
  if (m == null) return '-';
  const h = Math.floor(m / 60), mm = m % 60;
  return ((h + 11) % 12 + 1) + ':' + String(mm).padStart(2, '0') + ' ' + (h >= 12 ? 'PM' : 'AM');
};
export const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '';
export const toTimeInput = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
export const guestLink = (event, token) => `${location.origin}/rsvp.html?e=${event.id}${token ? '&t=' + token : ''}`;

export const TZS = ['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Australia/Sydney', 'UTC'];
export const browserTz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'; } catch { return 'Asia/Kolkata'; } };
const parts = (ms, tz) => Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(ms)).map(p => [p.type, p.value]));
/** Wall-clock date "YYYY-MM-DD" and time "HH:MM" in a timezone to a UTC ISO string. */
export function zonedToIso(date, time, tz) {
  const [y, m, d] = date.split('-').map(Number), [hh, mm] = time.split(':').map(Number);
  const want = Date.UTC(y, m - 1, d, hh, mm);
  let guess = want;
  for (let i = 0; i < 3; i++) { const p = parts(guess, tz); guess += want - Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute); }
  return new Date(guess).toISOString();
}
/** UTC ISO string to { date, time } as seen in a timezone. */
export function isoToZoned(iso, tz) { const p = parts(Date.parse(iso), tz); return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` }; }
/** "Sat, 31 Oct 2026, 6:00 PM IST" */
export const fmtDeadline = (iso, tz) => new Date(iso).toLocaleString('en-IN', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
export const isClosed = ev => !!ev.rsvp_closed || (ev.deadline_at ? Date.parse(ev.deadline_at) <= Date.now() : !!ev.deadline && ev.deadline < new Date().toISOString().slice(0, 10));
