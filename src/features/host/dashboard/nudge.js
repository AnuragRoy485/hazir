import { $ } from '../../../lib/ui.js?v=20261101-3';
import { fmtDate, guestLink } from '../../../lib/format.js?v=20261101-3';
import { state } from '../ctx.js?v=20261101-3';

export function nudgeText(i){return `Hi ${i.name.split(' ')[0]}, a gentle reminder to RSVP for ${state.ev.title} on ${fmtDate(state.ev.event_date)}. It takes ten seconds: ${guestLink(state.ev,i.token)}`}
export function nudge(i){window.open('https://wa.me/?text='+encodeURIComponent(nudgeText(i)),'_blank','noopener')}
