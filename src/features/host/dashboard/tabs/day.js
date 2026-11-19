import { $, $$ } from '../../../../lib/ui.js?v=20261101-5';
import { esc, fmtTime } from '../../../../lib/format.js?v=20261101-5';
import { stats } from '../stats.js?v=20261101-5';
import { stat } from '../stats.js?v=20261101-5';
import { animate } from '../stats.js?v=20261101-5';
import { toggleIn } from './guests.js?v=20261101-5';

export function day(p){
  const s=stats(),total=s.heads,pct=total?Math.round(s.arrived/total*100):0,yes=s.yes.slice().sort((a,b)=>(a.arrival||0)-(b.arrival||0));
  p.innerHTML=`<div class="stats5 s3">${stat('Arrived',s.arrived,'people')}${stat('Expected',total,'people')}${stat('Still to come',Math.max(0,total-s.arrived))}</div>
   <div class="card"><div class="phead"><span>Checked in</span><b>${pct}%</b></div><div class="bar big"><i style="width:${pct}%"></i></div></div>
   <div class="card tablecard"><h4 class="pad">Door list, by arrival time</h4>${yes.length?'<div class="pad"><button class="btn btn-ghost btn-sm" id="prt">Print door list</button></div>':''}${yes.length?yes.map(r=>`<div class="door ${r.checked_in?'done':''}"><span><b>${esc(r.name)}</b><small>${r.party} ${r.party>1?'people':'person'}${r.kids?` (${r.kids} kid${r.kids>1?'s':''})`:''} &middot; ${esc(r.meal||'')}</small></span><em>${fmtTime(r.arrival)}</em><button class="mini" data-ci="${r.id}">${r.checked_in?'Checked in':'Check in'}</button></div>`).join(''):'<p class="muted pad">Confirmed guests appear here.</p>'}</div>`;
  const prt=$('#prt',p);if(prt)prt.onclick=()=>{const w=window.open('','_blank');if(!w)return;const rows=yes.map(r=>`<tr><td>${esc(r.name)}</td><td>${r.party}${r.kids?` (${r.kids} kid${r.kids>1?'s':''})`:''}</td><td>${esc(r.meal||'')}</td><td>${fmtTime(r.arrival)}</td><td class="b"></td></tr>`).join('');w.document.write(`<!doctype html><meta charset="utf-8"><title>Door list</title><style>body{font:14px Georgia,serif;margin:32px;color:#000}h1{font-size:22px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #000;padding:8px;text-align:left}.b{width:60px}</style><h1>Door list - ${yes.length} ${yes.length===1?"reply":"replies"}, ${total} ${total===1?"person":"people"}</h1><table><tr><th>Name</th><th>People</th><th>Meal</th><th>Arrival</th><th>In</th></tr>${rows}</table>`);w.document.close();w.focus();w.print()};
  $$('[data-ci]',p).forEach(b=>b.onclick=()=>toggleIn(b.dataset.ci));animate(p)}

