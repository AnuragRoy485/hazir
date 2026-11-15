// Read-only live summary for caterers and planners. The link key only ever
// returns counts - never a guest name, phone, email or note (see get_event_summary).
import { rpc } from '../lib/db.js?v=20261101-5';
import { $, initEffects } from '../lib/ui.js?v=20261101-5';
import { esc, fmtTime, zonedToIso, toTimeInput } from '../lib/format.js?v=20261101-5';

const root=$('#root'),q=new URLSearchParams(location.search),eid=q.get('e')||'',key=q.get('k')||'';
initEffects();
const fmt=m=>m==null?'-':fmtTime(m);
const when=s=>{try{return new Date(zonedToIso(s.date,toTimeInput(s.time??1140),s.tz||'Asia/Kolkata')).toLocaleString('en-IN',{timeZone:s.tz||'Asia/Kolkata',weekday:'short',day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'})}catch{return s.date||''}};
const bars=o=>{const ks=Object.keys(o||{}).filter(k=>o[k]>0);const mx=Math.max(1,...ks.map(k=>o[k]));return ks.length?ks.map(k=>`<div class="hb"><span>${esc(k)}</span><div class="bar"><i style="width:${o[k]/mx*100}%"></i></div><b>${o[k]}</b></div>`).join(''):'<p class="muted">No choices yet.</p>'};
const hist=o=>{const hs=Object.keys(o||{}).map(Number).sort((a,b)=>a-b);const mx=Math.max(1,...hs.map(h=>o[h]));return hs.length?`<div class="cols">${hs.map(h=>`<div class="col"><i style="height:${Math.round(o[h]/mx*100)}%"></i><b>${o[h]}</b><span>${fmt(h*60).replace(':00','')}</span></div>`).join('')}</div>`:'<p class="muted">Arrival times appear as guests answer.</p>'};
async function paint(){
  let s=null;try{s=await rpc('get_event_summary',{p_event:eid,p_key:key})}catch(e){}
  if(!s){root.innerHTML=`<div class="card reveal in center"><h2>Link not recognised.</h2><p class="muted">This summary link is not valid. Ask the host for a fresh one.</p></div>`;return}
  document.title=s.title+' - Live summary';
  const fns=s.functions||[];
  root.innerHTML=`<div class="card reveal in"><p class="tiny">LIVE SUMMARY <i class="live"></i></p><h2 class="gh">${esc(s.title)}</h2>
   <p class="lead">${when(s)}${s.host?' &middot; hosted by '+esc(s.host):''}</p>${s.venue?`<p class="muted">${esc(s.venue)}</p>`:''}
   <p class="fine">Read-only view for caterers and planners. It updates itself - no names or contact details are ever shown here.</p></div>
  <div class="stats5">
    <div class="stat"><small>Coming</small><b>${s.heads}</b><em>people incl. plus-ones</em></div>
    <div class="stat"><small>Plates</small><b>${s.heads}</b><em>to prepare${s.kids?` (${s.adults} adults + ${s.kids} kids)`:''}</em></div>
    <div class="stat"><small>Answers</small><b>${s.answered}</b><em>of ${s.invited} invited</em></div>
    <div class="stat"><small>Declined</small><b>${s.declined}</b></div>
    <div class="stat"><small>Awaiting</small><b>${Math.max(0,s.invited-s.answered)}</b></div>
  </div>
  ${fns.length?`<div class="card reveal in"><h4>By function</h4>${fns.map(f=>`<div class="fnblock"><p class="fnhead"><b>${esc(f.name)}</b>${f.date?' &middot; '+esc(f.date):''} &middot; ${f.heads} ${f.heads===1?'person':'people'}</p>${bars(f.meals)}</div>`).join('')}</div>`:''}
  <div class="card reveal in"><h4>Meals to prepare</h4>${bars(s.meals)}</div>
  <div class="card reveal in"><h4>Arrivals by hour</h4>${hist(s.arrivals)}</div>
  <p class="fine" style="text-align:center">Updates automatically every 30 seconds.</p>`;
}
paint();setInterval(()=>{if(!document.hidden)paint()},30000);
