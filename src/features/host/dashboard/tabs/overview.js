import { $, copy } from '../../../../lib/ui.js';
import { esc, fmtDate, fmtTime, fmtDeadline, isClosed } from '../../../../lib/format.js';
import { state } from '../../ctx.js';
import { stats } from '../stats.js';
import { stat } from '../stats.js';
import { animate } from '../stats.js';

export function overview(p){
  const {ev,res}=state,s=stats(),answered=res.length,pct=Math.min(100,Math.round(answered/ev.invited*100));
  const days=Math.ceil((new Date(ev.event_date+'T00:00:00')-new Date(new Date().toDateString()))/864e5);
  const meal={};s.yes.forEach(r=>{if(r.meal)meal[r.meal]=(meal[r.meal]||0)+1;(r.companions||[]).forEach(c=>{if(c.m)meal[c.m]=(meal[c.m]||0)+1})});
  const hours={};s.yes.forEach(r=>{if(r.arrival!=null){const h=Math.floor(r.arrival/60);hours[h]=(hours[h]||0)+r.party}});
  const grp={};s.yes.forEach(r=>{const g=r.grp||'Other';grp[g]=(grp[g]||0)+r.party});
  const hk=Object.keys(hours).map(Number).sort((a,b)=>a-b),hmax=Math.max(1,...Object.values(hours));
  const mmax=Math.max(1,...Object.values(meal)),gmax=Math.max(1,...Object.values(grp));
  p.innerHTML=`<div class="stats5">${stat('Coming',s.heads,s.kids?`${s.adults} adults + ${s.kids} kids`:'people incl. plus-ones')}${stat('Declined',s.no.length)}${stat('Awaiting',s.awaiting,s.awaitingNames.length?s.awaitingNames.length+' named':'')}${stat('Plates',s.heads,'to prepare')}${stat('Invited',ev.invited,days>0?days+' day'+(days>1?'s':'')+' to go':days===0?'today':'past')}</div>
   <div class="card prog reveal in"><div class="phead"><span>${answered} of ${ev.invited} answered</span><b>${pct}%</b></div><div class="bar big"><i style="width:${pct}%"></i></div>
   <p class="fine">${ev.rsvp_closed?'RSVPs are closed by you.':ev.deadline_at?'RSVPs close '+fmtDeadline(ev.deadline_at,ev.tz)+(isClosed(ev)?' (closed)':''):ev.deadline?'RSVP deadline '+fmtDate(ev.deadline)+(isClosed(ev)?' (closed)':''):'No RSVP deadline set.'}</p>
   <div class="row" style="margin-top:12px"><button class="btn btn-ghost btn-sm" id="sum">Copy caterer summary</button></div></div>
   <div class="grid3">
    <div class="card reveal in"><h4>Arrivals by hour</h4>${hk.length?`<div class="cols">${hk.map(h=>`<div class="col"><i style="height:${Math.round(hours[h]/hmax*100)}%"></i><b>${hours[h]}</b><span>${fmtTime(h*60).replace(':00','')}</span></div>`).join('')}</div>`:'<p class="muted">Arrival times appear as guests answer.</p>'}</div>
    <div class="card reveal in"><h4>Meals</h4>${Object.keys(meal).length?Object.entries(meal).map(([k,v])=>`<div class="hb"><span>${esc(k)}</span><div class="bar"><i style="width:${v/mmax*100}%"></i></div><b>${v}</b></div>`).join(''):'<p class="muted">No meal choices yet.</p>'}</div>
    <div class="card reveal in"><h4>Groups</h4>${Object.keys(grp).length?Object.entries(grp).map(([k,v])=>`<div class="hb"><span>${esc(k)}</span><div class="bar"><i style="width:${v/gmax*100}%"></i></div><b>${v}</b></div>`).join(''):'<p class="muted">No groups yet.</p>'}</div>
   </div>
   <div class="card reveal in"><h4>Latest answers</h4>${res.slice(0,6).map(r=>`<div class="act"><span class="dot ${r.attending?'on':''}"></span><span>${esc(r.name)} ${r.attending?'is coming'+(r.party>1?' with '+(r.party-1)+' more':''):'cannot make it'}</span><em>${new Date(r.created_at).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'})}</em></div>`).join('')||'<p class="muted">Nothing yet. Share your invite link to start collecting answers.</p>'}</div>`;
  $('#sum').onclick=()=>copy(`${ev.title} - ${fmtDate(ev.event_date)}${ev.venue?' at '+ev.venue:''}\nComing: ${s.heads} people (${s.yes.length} replies)\nDeclined: ${s.no.length}\nStill awaiting: ${s.awaiting}\nMeals: ${Object.entries(meal).map(([k,v])=>k+' '+v).join(', ')||'none yet'}\nGroups: ${Object.entries(grp).map(([k,v])=>k+' '+v).join(', ')||'none yet'}`,'Summary copied');
  animate(p)}
