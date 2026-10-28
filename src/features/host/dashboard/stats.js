import { $, $$, countTo } from '../../../lib/ui.js';
import { state } from '../ctx.js';

export const stats=()=>{const {ev,res,inv}=state;const yes=res.filter(r=>r.attending),no=res.filter(r=>!r.attending);
  const heads=yes.reduce((a,r)=>a+r.party,0);
  const adults=yes.reduce((a,r)=>a+(r.adults!=null?r.adults:r.party),0);
  const kids=yes.reduce((a,r)=>a+(r.kids||0),0);
  const answered=new Set(res.map(r=>r.invitee_id).filter(Boolean));
  const awaitingNames=inv.filter(i=>!answered.has(i.id));
  const arrived=yes.filter(r=>r.checked_in).reduce((a,r)=>a+r.party,0);
  return{yes,no,heads,adults,kids,awaitingNames,awaiting:Math.max(0,ev.invited-res.length),arrived}};
export const stat=(l,v,s)=>`<div class="stat"><small>${l}</small><b data-n="${v}">0</b>${s?`<em>${s}</em>`:''}</div>`;
export const animate=p=>$$('[data-n]',p).forEach(e=>countTo(e,+e.dataset.n));
