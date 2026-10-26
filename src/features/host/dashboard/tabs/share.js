import { db } from '../../../../lib/db.js';
import { $, $$, copy, toast } from '../../../../lib/ui.js';
import { esc, fmtDate, guestLink } from '../../../../lib/format.js';
import { state, niceErr } from '../../ctx.js';
import { stats } from '../stats.js';
import { nudge } from '../nudge.js';
import { R } from '../../ctx.js';

export function share(p){
  const {ev}=state,s=stats(),link=guestLink(ev);
  p.innerHTML=`<div class="card reveal in"><h4>Open invite link</h4><p class="muted">Anyone with this link can answer. They see only the event name, date and deadline. Never other guests.</p>
    <div class="linkbox"><input readonly value="${link}"><button class="btn btn-sm" id="cl">Copy</button></div>
    <div class="row"><a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="${link}">Preview guest page</a><a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent('You are invited to '+ev.title+' on '+fmtDate(ev.event_date)+'. Please RSVP: '+link)}">Share on WhatsApp</a></div></div>
   <div class="card reveal in"><h4>Personal links</h4><p class="muted">Each named guest gets their own link, so you know exactly who answered and they cannot answer as someone else.</p>
    ${state.inv.length?`<div class="plist">${state.inv.map(i=>`<div class="prow"><span>${esc(i.name)}</span><span class="row"><button class="mini" data-c="${i.id}">Copy link</button><button class="mini" data-w="${i.id}">WhatsApp</button></span></div>`).join('')}</div><div class="row" style="margin-top:14px"><button class="btn btn-ghost btn-sm" id="callw">Copy reminder for ${s.awaitingNames.length} awaiting</button></div>`:'<p class="muted">No named guests yet. Add names in the Guests tab.</p>'}</div>
   <div class="card danger reveal in"><h4>Delete event</h4><p class="muted">Removes the event, all guests and all answers permanently.</p><button class="btn btn-ghost btn-sm" id="del">Delete event</button></div>`;
  $('#cl').onclick=()=>copy(link,'Link copied');
  $$('[data-c]',p).forEach(b=>b.onclick=()=>copy(guestLink(ev,state.inv.find(i=>i.id===b.dataset.c).token),'Personal link copied'));
  $$('[data-w]',p).forEach(b=>b.onclick=()=>nudge(state.inv.find(i=>i.id===b.dataset.w)));
  const ca=$('#callw');if(ca)ca.onclick=()=>copy(s.awaitingNames.map(nudgeText).join('\n\n'),'Reminders copied');
  $('#del').onclick=async()=>{if(!confirm('Delete "'+ev.title+'" and all its answers? This cannot be undone.'))return;try{await db('events?id=eq.'+ev.id,{method:'DELETE',prefer:'return=minimal'});toast('Event deleted');R.listView()}catch(e){toast(niceErr(e),1)}}}
