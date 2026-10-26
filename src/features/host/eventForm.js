import { auth } from '../../lib/auth.js';
import { db } from '../../lib/db.js';
import { $, toast } from '../../lib/ui.js';
import { OCCASIONS, TZS, browserTz, zonedToIso, isoToZoned, esc } from '../../lib/format.js';
import { view, busy, niceErr } from './ctx.js';
import { R } from './ctx.js';

export function eventForm(ev){
  const e=ev||{title:'',occasion:'Wedding',event_date:'',host_name:((auth.user().user_metadata||{}).name)||'',invited:100,deadline:'',max_party:4,default_time:1140,tz:browserTz()};
  const dz=e.deadline_at?isoToZoned(e.deadline_at,e.tz):{date:'',time:'18:00'};const zs=[...new Set([e.tz,...TZS])];
  view(`<section class="formwrap"><button class="back" id="bk">&larr; Back</button><div class="card reveal in"><p class="eyebrow">${ev?'Edit event':'New event'}</p><h2>${ev?'Edit details.':'Tell us the occasion.'}</h2>
  <form id="ef" novalidate>
    <label class="field">Event name<input id="t" maxlength="80" required value="${esc(e.title)}" placeholder="Riya and Arjun's wedding"></label>
    <div class="two"><label class="field">Occasion<select id="o">${OCCASIONS.map(x=>`<option${x===e.occasion?' selected':''}>${x}</option>`).join('')}</select></label>
    <label class="field">Date<input id="d" type="date" required value="${e.event_date||''}"></label></div>
    <div class="two"><label class="field">Hosted by<input id="h" maxlength="40" value="${esc(e.host_name||'')}"></label>
    <label class="field">Guests you are inviting<input id="n" type="number" min="1" max="5000" required value="${e.invited}"></label></div>
    <div class="two"><label class="field">Hosted at (optional)<input id="vn" maxlength="120" value="${esc(e.venue||'')}" placeholder="Venue or address"></label><label class="field">Plus-ones up to<select id="mp">${[1,2,3,4,6,8,10].map(x=>`<option${x==e.max_party?' selected':''}>${x}</option>`).join('')}</select></label></div>
    <div class="two"><label class="field">RSVP closes on (optional)<input id="dl" type="date" value="${dz.date}"></label><label class="field">At what time<input id="dt" type="time" value="${dz.time}"></label></div>
    <label class="field">Timezone for the deadline<select id="tz">${zs.map(x=>`<option${x===e.tz?' selected':''}>${x}</option>`).join('')}</select></label>
    <p class="fine">Guests cannot answer after this exact moment. The server enforces it, not just the page.</p>
    <label class="field">Message to guests (optional)<textarea id="ms" rows="3" maxlength="300" placeholder="Dress code, parking, a note of welcome...">${esc(e.message||'')}</textarea></label>
    <label class="field">Usual arrival time<input id="tm" type="time" value="${String(Math.floor(e.default_time/60)).padStart(2,'0')}:${String(e.default_time%60).padStart(2,'0')}"></label>
    ${ev?'':'<label class="field">Guest names, one per line (optional)<textarea id="l" rows="5" placeholder="Aarav Mehta&#10;Diya Rao&#10;Kabir Sen"></textarea></label><p class="fine">With names, every guest gets their own personal link, and you can see exactly who has not answered yet.</p>'}
    <div class="msg" id="msg" hidden></div>
    <button class="btn full" id="sv">${ev?'Save changes':'Create event'}</button>
  </form></div></section>`);
  $('#bk').onclick=()=>ev?R.openEvent(ev.id):R.listView();
  $('#ef').onsubmit=async x=>{x.preventDefault();const b=$('#sv'),m=$('#msg');
    const [hh,mm]=($('#tm').value||'19:00').split(':').map(Number);
    const row={title:$('#t').value.trim(),occasion:$('#o').value,event_date:$('#d').value,host_name:$('#h').value.trim()||null,invited:+$('#n').value,deadline:$('#dl').value||null,deadline_at:$('#dl').value?zonedToIso($('#dl').value,$('#dt').value||'18:00',$('#tz').value):null,tz:$('#tz').value,venue:$('#vn').value.trim()||null,message:$('#ms').value.trim()||null,max_party:+$('#mp').value,default_time:hh*60+mm};
    const bad=!row.title?'Give the event a name.':!row.event_date?'Pick the date.':!(row.invited>=1)?'Enter how many guests you are inviting.':row.deadline&&row.deadline>row.event_date?'The RSVP deadline should be on or before the event date.':row.deadline_at&&!ev&&Date.parse(row.deadline_at)<=Date.now()?'That deadline has already passed. Pick a later time.':'';
    if(bad){m.hidden=false;m.textContent=bad;return}
    busy(b,1,'Saving...');
    try{
      if(ev){await db('events?id=eq.'+ev.id,{method:'PATCH',body:row});toast('Saved');R.openEvent(ev.id)}
      else{const [c]=await db('events',{method:'POST',body:row});
        const names=[...new Set(($('#l').value||'').split('\n').map(s=>s.trim()).filter(Boolean))].slice(0,1500);
        if(names.length)await db('invitees',{method:'POST',body:names.map(n=>({event_id:c.id,name:n.slice(0,40)}))});
        toast('Event created');R.openEvent(c.id,'share')}
    }catch(err){m.hidden=false;m.textContent=niceErr(err)}finally{busy(b,0)}};
}


R.eventForm = eventForm;
