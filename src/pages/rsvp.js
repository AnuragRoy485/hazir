// Hazir guest page: sees only event title, date and deadline; answers via a locked server function. */
import { rpc } from '../lib/db.js';
import { $, $$, initEffects, copy } from '../lib/ui.js';
import { esc, fmtTime, fmtDate, fmtDeadline, MEALS, GROUPS } from '../lib/format.js';

const root=$('#root'),q=new URLSearchParams(location.search),eid=q.get('e'),tok=q.get('t')||'';let edit=q.get('r')||'';
initEffects();
const msgCard=(h,p)=>root.innerHTML=`<div class="card reveal in center"><h2>${h}</h2><p class="muted">${p}</p></div>`;
(async()=>{
  if(!eid)return msgCard('Invitation not found.','This link is incomplete. Ask your host for a fresh one.');
  let ev;try{ev=await rpc('get_invite',{p_event:eid,p_token:tok||null,p_edit:edit||null})}catch(e){return msgCard('Something went wrong.','Please check your connection and try again.')}
  if(!ev)return msgCard('Invitation not found.','This event may have been removed. Ask your host for a fresh link.');
  if(edit&&!ev.answered)return msgCard('Link not recognised.','This RSVP link is not valid. Ask your host for a fresh invite.');
  document.title=ev.title+' - RSVP';
  const head=`${ev.banner?`<img class="banner" src="${esc(ev.banner)}" alt="">`:''}<p class="eyebrow">${esc(ev.occasion)}</p><h1 class="gh">${esc(ev.title)}</h1><p class="lead">${fmtDate(ev.date)}${ev.host?' &middot; hosted by '+esc(ev.host):''}</p>${ev.venue?`<p class="muted">${esc(ev.venue)}</p>`:''}${ev.message?`<p class="gmsg">${esc(ev.message)}</p>`:''}`;
  if(ev.closed)return root.innerHTML=`<div class="card reveal in">${head}<div class="msg">RSVPs for this event are closed. Please contact your host directly.</div></div>`;
  let att=ev.my_attending!=null?!!ev.my_attending:true,
      adults=ev.my_adults||ev.my_party||1,
      kids=ev.my_kids||0,
      arrival=ev.my_arrival!=null?ev.my_arrival:ev.time,
      comps=(ev.my_comp||[]).map(c=>({n:c.n||'',m:c.m||'Veg'}));
  const party=()=>adults+kids;
  const draw=()=>{
    root.innerHTML=`<div class="card reveal in">${head}${ev.invitee_name?`<p class="hello">Hello, <b>${esc(ev.invitee_name)}</b>.${ev.answered?' You have already answered. Sending again updates your answer.':''}</p>`:''}
    ${ev.deadline_at?`<p class="fine">Please answer by ${fmtDeadline(ev.deadline_at,ev.tz)}.</p>`:ev.deadline?`<p class="fine">Please answer by ${fmtDate(ev.deadline)}.</p>`:''}
    <form id="f" novalidate>
      <div class="yn"><button type="button" class="yb ${att?'on':''}" data-a="1">Yes, I will be there</button><button type="button" class="yb ${!att?'on':''}" data-a="0">Sorry, I cannot</button></div>
      ${ev.invitee_name?'':'<label class="field">Your name<input id="n" maxlength="40" autocomplete="name" required></label>'}
      <div id="more" ${att?'':'hidden'}>
        <div class="two"><label class="field">You are<select id="g">${GROUPS.map(x=>`<option${x===ev.my_grp?' selected':''}>${x}</option>`).join('')}</select></label><label class="field">Your meal<select id="m">${MEALS.map(x=>`<option${x===ev.my_meal?' selected':''}>${x}</option>`).join('')}</select></label></div>
        <div class="two">
          <label class="field">Adults<div class="stepper"><button type="button" id="ami">-</button><b id="ac">${adults}</b><button type="button" id="apl">+</button></div></label>
          <label class="field">Kids<div class="stepper"><button type="button" id="kmi">-</button><b id="kc">${kids}</b><button type="button" id="kpl">+</button></div></label>
        </div>
        <div id="cs"></div>
        <label class="field">When will you arrive? <b id="tv" class="tvl">${fmtTime(arrival)}</b><input id="tr" type="range" min="0" max="1425" step="15" value="${arrival}" class="range"></label>
      </div>
      <label class="field">Note for the host (optional)<input id="nt" maxlength="120" placeholder="Allergies, a song request..." value="${esc(ev.my_note||'')}"></label>
      <div class="msg" id="msg" hidden></div>
      <button class="btn full" id="sb">${ev.answered?'Update my answer':'Send my answer'}</button>
    </form></div>`;
    $$('.yb').forEach(b=>b.onclick=()=>{att=b.dataset.a==='1';$$('.yb').forEach(x=>x.classList.toggle('on',x===b));$('#more').hidden=!att});
    const cs=()=>{comps.length=party()-1;$('#cs').innerHTML=Array.from({length:party()-1},(_,i)=>{comps[i]=comps[i]||{n:'',m:'Veg'};const kid=i>=adults-1;return `<div class="comp"><label class="field">Guest ${i+2} name <span class="ctag">${kid?'kid':'adult'}</span><input data-ci="${i}" maxlength="40" value="${esc(comps[i].n)}"></label><label class="field">Meal<select data-cm="${i}">${MEALS.map(x=>`<option${x===comps[i].m?' selected':''}>${x}</option>`).join('')}</select></label></div>`}).join('');
      $$('[data-ci]').forEach(i=>i.oninput=()=>comps[i.dataset.ci].n=i.value);$$('[data-cm]').forEach(i=>i.onchange=()=>comps[i.dataset.cm].m=i.value)};
    cs();
    const fix=()=>{if(kids>ev.max-adults)kids=Math.max(0,ev.max-adults);$('#ac').textContent=adults;$('#kc').textContent=kids;cs()};
    $('#ami').onclick=()=>{if(adults>1){adults--;fix()}};
    $('#apl').onclick=()=>{if(party()<ev.max){adults++;fix()}};
    $('#kmi').onclick=()=>{if(kids>0){kids--;fix()}};
    $('#kpl').onclick=()=>{if(party()<ev.max){kids++;fix()}};
    $('#tr').oninput=e=>{arrival=+e.target.value;$('#tv').textContent=fmtTime(arrival)};
    $('#f').onsubmit=async e=>{e.preventDefault();const m=$('#msg'),b=$('#sb');m.hidden=true;
      const name=ev.invitee_name||($('#n')&&$('#n').value.trim());if(!name){m.hidden=false;m.textContent='Please enter your name.';return}
      b.disabled=true;b.textContent='Sending...';
      try{const note=$('#nt').value.trim()||null;const r=await rpc('submit_rsvp',{p_event:eid,p_token:tok||null,p_name:name,p_attending:att,p_grp:att?$('#g').value:null,p_meal:att?$('#m').value:null,p_party:att?party():0,p_arrival:att?arrival:null,p_comp:att?comps.map((c,i)=>({n:(c.n||'Guest').slice(0,40),m:c.m,k:i<adults-1?'a':'k'})):[],p_note:note,p_adults:att?adults:0,p_kids:att?kids:0,p_edit:edit||null});
        const keep=tok?`${location.origin}/rsvp?e=${eid}&t=${tok}`:`${location.origin}/rsvp?e=${eid}&r=${r.edit}`;
        root.innerHTML=`<div class="card reveal in center done"><div class="tick">&#10003;</div><h2>${att?'See you there.':'Thank you for letting us know.'}</h2><p class="muted">${att?`We have you down for ${party()} ${party()>1?'people':'person'}${kids?` (${adults} ${adults>1?'adults':'adult'}, ${kids} ${kids>1?'kids':'kid'})`:''} around ${fmtTime(arrival)}.`:'Your host has been told.'}</p>
        <div class="savebox"><p class="saveline"><b>Plans change. Keep your RSVP handy.</b><br>Save this link to update your answer anytime.</p>
        <div class="linkbox"><input readonly value="${keep}"><button class="btn btn-sm" id="cp">Copy my RSVP link</button></div></div>
        <button class="btn btn-ghost" id="ch">Change my answer</button></div>`;
        if(att){ev.my_grp=$('#g').value;ev.my_meal=$('#m').value}ev.my_attending=att;ev.my_adults=adults;ev.my_kids=kids;ev.my_arrival=arrival;ev.my_comp=comps.map((c,i)=>({n:c.n,m:c.m,k:i<adults-1?'a':'k'}));ev.my_note=note;ev.answered=true;
        if(r.edit){edit=r.edit;if(!tok)history.replaceState(null,'',`?e=${eid}&r=${r.edit}`)}
        $('#cp').onclick=()=>copy(keep,'Link copied');
        $('#ch').onclick=draw}
      catch(err){m.hidden=false;m.textContent=/closed/i.test(err.message)?'RSVPs just closed for this event.':err.message;b.disabled=false;b.textContent='Send my answer'}};
  };
  draw();
})();
