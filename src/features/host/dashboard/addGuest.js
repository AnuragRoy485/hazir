import { db } from '../../../lib/db.js';
import { $, $$, toast } from '../../../lib/ui.js';
import { GROUPS, MEALS } from '../../../lib/format.js';
import { state, niceErr } from '../ctx.js';
import { R } from '../ctx.js';

export function addGuest(){
  const d=document.createElement('div');d.className='modal';d.innerHTML=`<div class="card mcard"><h3>Add guests</h3><p class="muted">Two ways: add names to invite (each gets a personal link), or record a walk-in or phone answer.</p>
    <div class="tabs"><button class="tab on" data-k="n">Add names</button><button class="tab" data-k="w">Walk-in / phone RSVP</button></div>
    <form id="gf"><div id="gn"><label class="field">Names, one per line<textarea id="gl" rows="5"></textarea></label></div>
    <div id="gw" hidden><label class="field">Name<input id="wn" maxlength="40"></label><div class="two"><label class="field">Group<select id="wg">${GROUPS.map(x=>`<option>${x}</option>`).join('')}</select></label><label class="field">Meal<select id="wm">${MEALS.map(x=>`<option>${x}</option>`).join('')}</select></label></div><div class="two"><label class="field">Party size<input id="wp" type="number" min="1" max="${state.ev.max_party}" value="1"></label><label class="field">Arrival<input id="wt" type="time" value="${String(Math.floor(state.ev.default_time/60)).padStart(2,'0')}:${String(state.ev.default_time%60).padStart(2,'0')}"></label></div></div>
    <div class="msg" id="msg2" hidden></div><div class="row"><button class="btn" id="gs">Add</button><button type="button" class="btn btn-ghost" id="gc">Cancel</button></div></form></div>`;
  document.body.appendChild(d);requestAnimationFrame(()=>d.classList.add('in'));let k='n';
  const close=()=>{d.classList.remove('in');setTimeout(()=>d.remove(),250)};
  $$('.tab',d).forEach(t=>t.onclick=()=>{k=t.dataset.k;$$('.tab',d).forEach(x=>x.classList.toggle('on',x===t));$('#gn',d).hidden=k!=='n';$('#gw',d).hidden=k!=='w'});
  $('#gc',d).onclick=close;d.onclick=e=>{if(e.target===d)close()};
  $('#gf',d).onsubmit=async e=>{e.preventDefault();const m=$('#msg2',d);m.hidden=true;
    try{if(k==='n'){const names=[...new Set($('#gl',d).value.split('\n').map(s=>s.trim()).filter(Boolean))];if(!names.length)throw new Error('Enter at least one name.');await db('invitees',{method:'POST',body:names.map(n=>({event_id:state.ev.id,name:n.slice(0,40)})),prefer:'return=minimal'})}
      else{const n=$('#wn',d).value.trim();if(!n)throw new Error('Enter a name.');const [h,mi]=$('#wt',d).value.split(':').map(Number);const p=Math.max(1,Math.min(state.ev.max_party,+$('#wp',d).value||1));
        await db('responses',{method:'POST',body:{event_id:state.ev.id,name:n,attending:true,grp:$('#wg',d).value,meal:$('#wm',d).value,party:p,arrival:h*60+mi,companions:[],note:'Added by host'},prefer:'return=minimal'})}
      await R.load(state.ev.id);close();R.paint();toast('Added')}catch(err){m.hidden=false;m.textContent=niceErr(err)}}}
