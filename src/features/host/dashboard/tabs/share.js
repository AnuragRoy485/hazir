import { db } from '../../../../lib/db.js';
import { $, $$, copy, toast, confirmBox } from '../../../../lib/ui.js';
import { esc, fmtDate, fmtTime, guestLink, isClosed, fmtDeadline } from '../../../../lib/format.js';
import { state, niceErr } from '../../ctx.js';
import { deleteBanner, uploadFallbackOg } from '../../../../lib/storage.js';
import { drawQr } from '../../../../lib/qr.js';
import { stats } from '../stats.js';
import { nudge } from '../nudge.js';
import { R } from '../../ctx.js';

export async function share(p){
  const {ev}=state,s=stats(),link=guestLink(ev);
  p.innerHTML=`<div class="card reveal in"><h4>Open invite link</h4><p class="muted">Anyone with this link can answer. They see only the event name, date and deadline. Never other guests.</p>
    <div class="linkbox"><input readonly value="${link}"><button class="btn btn-sm" id="cl">Copy</button></div>
    <div class="row"><a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="${link}">Preview guest page</a><a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent('You are invited to '+ev.title+' on '+fmtDate(ev.event_date)+'. Please RSVP: '+link)}">Share on WhatsApp</a></div></div>
   <div class="card reveal in"><h4>QR code</h4><p class="muted">Guests point their phone camera at it and your RSVP page opens. The Hazir name sits below the code, keeping the pattern clear.</p>
    <div class="qrbox"><canvas id="qr" width="640" height="780" role="img" aria-label="QR code that opens the invite link"></canvas></div>
    <div class="row"><button class="btn btn-ghost btn-sm" id="qdl">Download PNG</button></div></div>
   <div class="card reveal in"><h4>Personal links</h4><p class="muted">Each named guest gets their own link, so you know exactly who answered and they cannot answer as someone else.</p>
    ${state.inv.length?`<div class="plist">${state.inv.map(i=>`<div class="prow"><span>${esc(i.name)}</span><span class="row"><button class="mini" data-c="${i.id}">Copy link</button><button class="mini" data-w="${i.id}">WhatsApp</button></span></div>`).join('')}</div><div class="row" style="margin-top:14px"><button class="btn btn-ghost btn-sm" id="callw">Copy reminder for ${s.awaitingNames.length} awaiting</button></div>`:'<p class="muted">No named guests yet. Add names in the Guests tab.</p>'}</div>
   <div class="card reveal in"><h4>RSVP status</h4><p class="muted">${ev.rsvp_closed?'You closed RSVPs. Guests see a closed message.':isClosed(ev)?'The deadline has passed, so guests can no longer answer. Edit the event to extend it.':ev.deadline_at?'Open until '+fmtDeadline(ev.deadline_at,ev.tz)+'.':'Open with no deadline.'}</p>
    <div class="row"><button class="btn btn-ghost btn-sm" id="tg">${ev.rsvp_closed?'Reopen RSVPs':'Close RSVPs now'}</button><button class="btn btn-ghost btn-sm" id="dup">Duplicate event</button></div></div>
   <div class="card danger reveal in"><h4>Delete event</h4><p class="muted">Removes the event, all guests and all answers permanently.</p><button class="btn btn-ghost btn-sm" id="del">Delete event</button></div>`;
  $('#cl').onclick=()=>copy(link,'Link copied');
  const cv=$('#qr');if(cv){try{await drawQr(cv,link);cv.dataset.done='1'}catch(e){cv.closest('.qrbox').innerHTML='<p class="muted">The QR code could not be drawn here.</p>'}}
  const qdl=$('#qdl');if(qdl)qdl.onclick=()=>{const a=document.createElement('a');a.href=cv.toDataURL('image/png');a.download='hazir-invite-qr.png';a.click()};
  $$('[data-c]',p).forEach(b=>b.onclick=()=>copy(guestLink(ev,state.inv.find(i=>i.id===b.dataset.c).token),'Personal link copied'));
  $$('[data-w]',p).forEach(b=>b.onclick=()=>nudge(state.inv.find(i=>i.id===b.dataset.w)));
  const ca=$('#callw');if(ca)ca.onclick=()=>copy(s.awaitingNames.map(nudgeText).join('\n\n'),'Reminders copied');
  $('#tg').onclick=async()=>{try{await db('events?id=eq.'+ev.id,{method:'PATCH',body:{rsvp_closed:!ev.rsvp_closed}});await R.load(ev.id);R.render();toast(state.ev.rsvp_closed?'RSVPs closed':'RSVPs reopened')}catch(e){toast(niceErr(e),1)}};
  $('#dup').onclick=async()=>{try{const {id,owner,created_at,banner,banner_og,...c}=ev;const [n]=await db('events',{method:'POST',body:{...c,title:(ev.title+' (copy)').slice(0,80),rsvp_closed:false}});try{const og=await uploadFallbackOg(n.id,{title:n.title,when:fmtDate(n.event_date)+' \u00b7 '+fmtTime(n.default_time),host:n.host_name});await db('events?id=eq.'+n.id,{method:'PATCH',body:{banner_og:og.banner_og},prefer:'return=minimal'})}catch(_){/* branded preview card is best-effort */}toast('Duplicated. Guests are not copied.');R.openEvent(n.id)}catch(e){toast(niceErr(e),1)}};
  $('#del').onclick=async()=>{if(!await confirmBox({title:'Delete this event?',body:'"'+ev.title+'", all its guests and all answers will be removed permanently.',ok:'Delete event',word:'delete',danger:true}))return;try{if(ev.banner||ev.banner_og)await deleteBanner(ev.id,ev.banner,ev.banner_og);await db('events?id=eq.'+ev.id,{method:'DELETE',prefer:'return=minimal'});toast('Event deleted');R.listView()}catch(e){toast(niceErr(e),1)}}}
