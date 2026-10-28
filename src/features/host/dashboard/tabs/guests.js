import { csv } from '../csv.js';
import { addGuest } from '../addGuest.js';
import { db } from '../../../../lib/db.js';
import { $, $$, toast, confirmBox } from '../../../../lib/ui.js';
import { esc, fmtTime } from '../../../../lib/format.js';
import { state, niceErr } from '../../ctx.js';
import { stats } from '../stats.js';
import { nudge } from '../nudge.js';
import { R } from '../../ctx.js';

export function rows(){const {res,inv}=state,s=stats(),q=state.q.toLowerCase();
  let out=res.map(r=>({r,name:r.name,st:r.attending?'yes':'no'}));
  s.awaitingNames.forEach(i=>out.push({i,name:i.name,st:'wait'}));
  out=out.filter(x=>(state.f==='all'||x.st===state.f||(state.f==='in'&&x.r&&x.r.checked_in))&&(!q||x.name.toLowerCase().includes(q)||(x.r&&((x.r.meal||'').toLowerCase().includes(q)||(x.r.grp||'').toLowerCase().includes(q)))));
  return out.sort((a,b)=>a.name.localeCompare(b.name))}
export function guests(p){
  p.innerHTML=`<div class="tools"><input id="q" class="search" placeholder="Search name, meal or group" value="${esc(state.q)}">
    <div class="chips2">${[['all','All'],['yes','Coming'],['no','Declined'],['wait','Awaiting'],['in','Checked in']].map(f=>`<button class="chip${state.f===f[0]?' on':''}" data-f="${f[0]}">${f[1]}</button>`).join('')}</div>
    <div class="row"><button class="btn btn-ghost btn-sm" id="addg">Add guest</button><button class="btn btn-ghost btn-sm" id="csv">Export CSV</button></div></div>
    <div class="card tablecard"><div id="tb"></div></div>`;
  const tb=()=>{const R=rows();$('#tb').innerHTML=R.length?`<div class="trow thead"><span>Guest</span><span>Status</span><span>Party</span><span>Meal</span><span>Arrives</span><span></span></div>`+R.map((x,i)=>{const r=x.r;return `<div class="trow" style="--d:${Math.min(i,12)*.03}s"><span class="nm"><b>${esc(x.name)}</b>${r&&r.grp?`<small>${esc(r.grp)}</small>`:''}${r&&r.note?`<small class="nt">"${esc(r.note)}"</small>`:''}${r&&(r.companions||[]).length?`<small>With ${r.companions.map(c=>esc(c.n||'Guest')+(c.k==='k'?' (kid)':'')).join(', ')}</small>`:''}</span>
      <span><i class="pill ${x.st}">${x.st==='yes'?'Coming':x.st==='no'?'Declined':'Awaiting'}</i></span><span>${r&&r.attending?(r.kids?r.adults+'A + '+r.kids+'K':r.party):'-'}</span><span>${r&&r.attending?esc(r.meal||'-'):'-'}</span><span>${r&&r.attending?fmtTime(r.arrival):'-'}</span>
      <span class="acts">${r?(r.attending?`<button class="mini" data-ci="${r.id}">${r.checked_in?'Checked in':'Check in'}</button>`:'')+`<button class="mini x" data-rm="${r.id}" title="Remove">&times;</button>`:`<button class="mini" data-nudge="${x.i.id}">Nudge</button><button class="mini x" data-ri="${x.i.id}" title="Remove">&times;</button>`}</span></div>`}).join(''):'<p class="muted pad">No guests match.</p>';
    $$('[data-ci]').forEach(b=>b.onclick=()=>toggleIn(b.dataset.ci));
    $$('[data-rm]').forEach(b=>b.onclick=()=>del('responses',b.dataset.rm,'Remove this answer?'));
    $$('[data-ri]').forEach(b=>b.onclick=()=>del('invitees',b.dataset.ri,'Remove this guest and their link?'));
    $$('[data-nudge]').forEach(b=>b.onclick=()=>nudge(state.inv.find(i=>i.id===b.dataset.nudge)))};
  tb();
  $('#q').oninput=e=>{state.q=e.target.value;tb()};
  $$('.chips2 .chip').forEach(c=>c.onclick=()=>{state.f=c.dataset.f;$$('.chips2 .chip').forEach(x=>x.classList.toggle('on',x===c));tb()});
  $('#csv').onclick=csv;$('#addg').onclick=addGuest}
export async function toggleIn(id){const r=state.res.find(x=>x.id===id);try{await db('responses?id=eq.'+id,{method:'PATCH',body:{checked_in:!r.checked_in}});r.checked_in=!r.checked_in;R.paint()}catch(e){toast(niceErr(e),1)}}
export async function del(t,id,q){if(!await confirmBox({title:'Remove?',body:q,ok:'Remove',danger:true}))return;try{await db(t+'?id=eq.'+id,{method:'DELETE',prefer:'return=minimal'});await R.load(state.ev.id);R.paint();toast('Removed')}catch(e){toast(niceErr(e),1)}}
