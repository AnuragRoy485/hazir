import { toast } from '../../../lib/ui.js';
import { fmtTime, guestLink } from '../../../lib/format.js';
import { state } from '../ctx.js';
import { stats } from './stats.js';

export function csv(){const s=stats(),L=[['Name','Status','Party','Group','Meal','Companions','Arrival','Checked in','Note','Personal link']];
  state.res.forEach(r=>{const inv=state.inv.find(i=>i.id===r.invitee_id);L.push([r.name,r.attending?'Coming':'Declined',r.party,r.grp||'',r.meal||'',(r.companions||[]).map(c=>(c.n||'Guest')+' ('+(c.m||'')+')').join('; '),r.attending?fmtTime(r.arrival):'',r.checked_in?'Yes':'',r.note||'',inv?guestLink(state.ev,inv.token):''])});
  s.awaitingNames.forEach(i=>L.push([i.name,'Awaiting','','','','','','','',guestLink(state.ev,i.token)]));
  const safe=v=>{v=String(v);if(/^[=+\-@]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"'};
  const b=new Blob([L.map(r=>r.map(safe).join(',')).join('\n')],{type:'text/csv'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=state.ev.title.replace(/\W+/g,'-').toLowerCase()+'-guests.csv';a.click();toast('Exported')}
