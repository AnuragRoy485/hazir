import { db, rpc } from '../../../../lib/db.js';
import { auth } from '../../../../lib/auth.js';
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
   <div class="card reveal in"><h4>QR code</h4><p class="muted">Guests point their phone camera at it and your RSVP page opens. The event name, date, time and host sit around the code, keeping the pattern clear.</p>
    <div class="qrbox"><canvas id="qr" width="640" height="960" role="img" aria-label="QR code that opens the invite link"></canvas></div>
    <div class="row"><button class="btn btn-ghost btn-sm" id="qsh">Share QR image</button><button class="btn btn-ghost btn-sm" id="qdl">Download PNG</button></div>
    <p class="muted" id="qshnote" hidden>Your browser cannot send the image directly, so the caption was copied and the image downloaded - attach it in any app.</p></div>
   <div class="card reveal in"><h4>Personal links</h4><p class="muted">Each named guest gets their own link, so you know exactly who answered and they cannot answer as someone else.</p>
    ${state.inv.length?`<div class="plist">${state.inv.map(i=>`<div class="prow"><span>${esc(i.name)}</span><span class="row"><button class="mini" data-c="${i.id}">Copy link</button><button class="mini" data-w="${i.id}">WhatsApp</button></span></div>`).join('')}</div><div class="row" style="margin-top:14px"><button class="btn btn-ghost btn-sm" id="callw">Copy reminder for ${s.awaitingNames.length} awaiting</button></div>`:'<p class="muted">No named guests yet. Add names in the Guests tab.</p>'}</div>
   <div class="card reveal in"><h4>Co-hosts</h4><p class="muted">Co-hosts can edit and manage this event just like you: details, banner, guests, answers and exports. They never see your other events or your account. A co-host needs to create a Hazir account with the exact same email you add here - access starts when their account exists. You can remove a co-host at any time and their access ends immediately.</p>
    <div id="charea"><p class="muted">Loading co-hosts...</p></div></div>
   <div class="card reveal in"><h4>RSVP status</h4><p class="muted">${ev.rsvp_closed?'You closed RSVPs. Guests see a closed message.':isClosed(ev)?'The deadline has passed, so guests can no longer answer. Edit the event to extend it.':ev.deadline_at?'Open until '+fmtDeadline(ev.deadline_at,ev.tz)+'.':'Open with no deadline.'}</p>
    <div class="row"><button class="btn btn-ghost btn-sm" id="tg">${ev.rsvp_closed?'Reopen RSVPs':'Close RSVPs now'}</button><button class="btn btn-ghost btn-sm" id="dup">Duplicate event</button></div></div>
   <div class="card danger reveal in"><h4>Delete event</h4><p class="muted">Removes the event, all guests and all answers permanently.</p><button class="btn btn-ghost btn-sm" id="del">Delete event</button></div>`;
  $('#cl').onclick=()=>copy(link,'Link copied');
  const cv=$('#qr');if(cv){try{await drawQr(cv,link,{title:ev.title,date:fmtDate(ev.event_date),time:ev.default_time?fmtTime(ev.default_time):'',host:ev.host_name||''});cv.dataset.done='1'}catch(e){cv.closest('.qrbox').innerHTML='<p class="muted">The QR code could not be drawn here.</p>'}}
  const qdl=$('#qdl');if(qdl)qdl.onclick=()=>{const a=document.createElement('a');a.href=cv.toDataURL('image/png');a.download='hazir-invite-qr.png';a.click()};
  const qsh=$('#qsh');if(qsh)qsh.onclick=async()=>{
    if(!cv||!cv.dataset.done){toast('The QR code is not ready yet',1);return}
    const caption='You are invited to '+ev.title+' on '+fmtDate(ev.event_date)+'. Please RSVP: '+link;
    try{
      const blob=await new Promise(r=>cv.toBlob(r,'image/png'));
      const file=new File([blob],'hazir-invite-qr.png',{type:'image/png'});
      if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],text:caption});toast('Shared')}
      else if(navigator.share){await navigator.share({text:caption});toast('Invite text shared')}
      else{copy(caption,'Caption copied');qdl.click();$('#qshnote').hidden=false}
    }catch(e){if(e&&e.name!=='AbortError')toast(niceErr(e),1)}
  };
  $$('[data-c]',p).forEach(b=>b.onclick=()=>copy(guestLink(ev,state.inv.find(i=>i.id===b.dataset.c).token),'Personal link copied'));
  $$('[data-w]',p).forEach(b=>b.onclick=()=>nudge(state.inv.find(i=>i.id===b.dataset.w)));
  const ca=$('#callw');if(ca)ca.onclick=()=>copy(s.awaitingNames.map(nudgeText).join('\n\n'),'Reminders copied');
  $('#tg').onclick=async()=>{try{await db('events?id=eq.'+ev.id,{method:'PATCH',body:{rsvp_closed:!ev.rsvp_closed}});await R.load(ev.id);R.render();toast(state.ev.rsvp_closed?'RSVPs closed':'RSVPs reopened')}catch(e){toast(niceErr(e),1)}};
  $('#dup').onclick=async()=>{try{const {id,owner,created_at,banner,banner_og,...c}=ev;const [n]=await db('events',{method:'POST',body:{...c,title:(ev.title+' (copy)').slice(0,80),rsvp_closed:false}});try{const og=await uploadFallbackOg(n.id,{title:n.title,when:fmtDate(n.event_date)+' \u00b7 '+fmtTime(n.default_time),host:n.host_name});await db('events?id=eq.'+n.id,{method:'PATCH',body:{banner_og:og.banner_og},prefer:'return=minimal'})}catch(_){/* branded preview card is best-effort */}toast('Duplicated. Guests are not copied.');R.openEvent(n.id)}catch(e){toast(niceErr(e),1)}};
  (async()=>{const area=$('#charea');if(!area)return;
    const me=auth.user();const isOwner=me&&ev.owner===me.id;
    let list=[];try{list=await rpc('list_cohosts',{p_event_id:ev.id})}catch(e){area.innerHTML='<p class="muted">Co-hosts could not be loaded.</p>';return}
    const render=()=>{area.innerHTML=(isOwner?`<div class="row"><input id="chm" type="email" maxlength="120" placeholder="co-host@email.com" style="flex:1;min-width:180px" autocomplete="off"><button class="btn btn-sm" id="cha">Add co-host</button></div>`:'<p class="muted">This event is shared with you as a co-host.</p>')
      +(list.length?`<div class="plist">${list.map(c=>`<div class="prow"><span>${esc(c.email)}${c.account_exists?'':' <small class="muted">(no account yet)</small>'}</span>${isOwner?`<button class="mini x" data-chr="${esc(c.email)}" title="Remove">&times;</button>`:''}</div>`).join('')}</div>`:(isOwner?'<p class="muted" style="margin-top:10px">No co-hosts yet.</p>':''));
      const cha=$('#cha');if(cha)cha.onclick=async()=>{const inp=$('#chm');const em=(inp.value||'').trim();
        if(!em){toast('Type an email first',1);return}
        try{const r=await rpc('add_cohost',{p_event_id:ev.id,p_email:em});
          list=await rpc('list_cohosts',{p_event_id:ev.id});render();
          toast(r&&r.account_exists?'Co-host added':'Added. They will get access once they create an account with this email.')}catch(e){toast(niceErr(e),1)}};
      $$('[data-chr]',area).forEach(b=>b.onclick=async()=>{if(!await confirmBox({title:'Remove this co-host?',body:b.dataset.chr+' will immediately lose access to this event. The event and all its data stay with you.',ok:'Remove co-host',danger:true}))return;
        try{await rpc('remove_cohost',{p_event_id:ev.id,p_email:b.dataset.chr});list=await rpc('list_cohosts',{p_event_id:ev.id});render();toast('Co-host removed')}catch(e){toast(niceErr(e),1)}})};
    render()})();
  $('#del').onclick=async()=>{if(!await confirmBox({title:'Delete this event?',body:'"'+ev.title+'", all its guests and all answers will be removed permanently.',ok:'Delete event',word:'delete',danger:true}))return;try{if(ev.banner||ev.banner_og)await deleteBanner(ev.id,ev.banner,ev.banner_og);await db('events?id=eq.'+ev.id,{method:'DELETE',prefer:'return=minimal'});toast('Event deleted');R.listView()}catch(e){toast(niceErr(e),1)}}}
