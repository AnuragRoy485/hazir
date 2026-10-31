import { $, $$ } from '../../../../lib/ui.js?v=20261101-2';
import { esc, fmtTime } from '../../../../lib/format.js?v=20261101-2';
import { stats } from '../stats.js?v=20261101-2';
import { stat } from '../stats.js?v=20261101-2';
import { animate } from '../stats.js?v=20261101-2';
import { toggleIn } from './guests.js?v=20261101-2';

export function day(p){
  const s=stats(),total=s.heads,pct=total?Math.round(s.arrived/total*100):0,yes=s.yes.slice().sort((a,b)=>(a.arrival||0)-(b.arrival||0));
  p.innerHTML=`<div class="stats5 s3">${stat('Arrived',s.arrived,'people')}${stat('Expected',total,'people')}${stat('Still to come',Math.max(0,total-s.arrived))}</div>
   <div class="card"><div class="phead"><span>Checked in</span><b>${pct}%</b></div><div class="bar big"><i style="width:${pct}%"></i></div></div>
   <div class="card tablecard"><h4 class="pad">Door list, by arrival time</h4>${yes.length?yes.map(r=>`<div class="door ${r.checked_in?'done':''}"><span><b>${esc(r.name)}</b><small>${r.party} ${r.party>1?'people':'person'}${r.kids?` (${r.kids} kid${r.kids>1?'s':''})`:''} &middot; ${esc(r.meal||'')}</small></span><em>${fmtTime(r.arrival)}</em><button class="mini" data-ci="${r.id}">${r.checked_in?'Checked in':'Check in'}</button></div>`).join(''):'<p class="muted pad">Confirmed guests appear here.</p>'}</div>`;
  $$('[data-ci]',p).forEach(b=>b.onclick=()=>toggleIn(b.dataset.ci));animate(p)}

