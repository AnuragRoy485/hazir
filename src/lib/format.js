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
