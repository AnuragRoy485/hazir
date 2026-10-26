import { $, $$ } from '../../../../lib/ui.js';
import { esc, fmtTime } from '../../../../lib/format.js';
import { stats } from '../stats.js';
import { stat } from '../stats.js';
import { animate } from '../stats.js';
import { toggleIn } from './guests.js';

export function day(p){
  const s=stats(),total=s.heads,pct=total?Math.round(s.arrived/total*100):0,yes=s.yes.slice().sort((a,b)=>(a.arrival||0)-(b.arrival||0));
  p.innerHTML=`<div class="stats5 s3">${stat('Arrived',s.arrived,'people')}${stat('Expected',total,'people')}${stat('Still to come',Math.max(0,total-s.arrived))}</div>
   <div class="card"><div class="phead"><span>Checked in</span><b>${pct}%</b></div><div class="bar big"><i style="width:${pct}%"></i></div></div>
   <div class="card tablecard"><h4 class="pad">Door list, by arrival time</h4>${yes.length?yes.map(r=>`<div class="door ${r.checked_in?'done':''}"><span><b>${esc(r.name)}</b><small>${r.party} ${r.party>1?'people':'person'} &middot; ${esc(r.meal||'')}</small></span><em>${fmtTime(r.arrival)}</em><button class="mini" data-ci="${r.id}">${r.checked_in?'Checked in':'Check in'}</button></div>`).join(''):'<p class="muted pad">Confirmed guests appear here.</p>'}</div>`;
  $$('[data-ci]',p).forEach(b=>b.onclick=()=>toggleIn(b.dataset.ci));animate(p)}

