// Hazir guest page: sees only event title, date and deadline; answers via a locked server function. */
import { rpc } from '../lib/db.js';
import { $, $$, initEffects } from '../lib/ui.js';
import { esc, fmtTime, fmtDate, MEALS, GROUPS } from '../lib/format.js';

const root=$('#root'),q=new URLSearchParams(location.search),eid=q.get('e'),tok=q.get('t')||'';
initEffects();
const msgCard=(h,p)=>root.innerHTML=`<div class="card reveal in center"><h2>${h}</h2><p class="muted">${p}</p></div>`;
(async()=>{
  if(!eid)return msgCard('Invitation not found.','This link is incomplete. Ask your host for a fresh one.');
  let ev;try{ev=await rpc('get_invite',{p_event:eid,p_token:tok||null})}catch(e){return msgCard('Something went wrong.','Please check your connection and try again.')}
  if(!ev)return msgCard('Invitation not found.','This event may have been removed. Ask your host for a fresh link.');
  document.title=ev.title+' - RSVP';
  const head=`<p class="eyebrow">${esc(ev.occasion)}</p><h1 class="gh">${esc(ev.title)}</h1><p class="lead">${fmtDate(ev.date)}${ev.host?' &middot; hosted by '+esc(ev.host):''}</p>`;
  if(ev.closed)return root.innerHTML=`<div class="card reveal in">${head}<div class="msg">RSVPs for this event are closed. Please contact your host directly.</div></div>`;
  let att=true,party=1,arrival=ev.time,comps=[];
  const draw=()=>{
    root.innerHTML=`<div class="card reveal in">${head}${ev.invitee_name?`<p class="hello">Hello, <b>${esc(ev.invitee_name)}</b>.${ev.answered?' You have already answered. Sending again updates your answer.':''}</p>`:''}
    ${ev.deadline?`<p class="fine">Please answer by ${fmtDate(ev.deadline)}.</p>`:''}
    <form id="f" novalidate>
      <div class="yn"><button type="button" class="yb ${att?'on':''}" data-a="1">Yes, I will be there</button><button type="button" class="yb ${!att?'on':''}" data-a="0">Sorry, I cannot</button></div>
      ${ev.invitee_name?'':'<label class="field">Your name<input id="n" maxlength="40" autocomplete="name" required></label>'}
      <div id="more" ${att?'':'hidden'}>
        <div class="two"><label class="field">You are<select id="g">${GROUPS.map(x=>`<option>${x}</option>`).join('')}</select></label><label class="field">Your meal<select id="m">${MEALS.map(x=>`<option>${x}</option>`).join('')}</select></label></div>
        <label class="field">How many people in total?<div class="stepper"><button type="button" id="mi">-</button><b id="pc">${party}</b><button type="button" id="pl">+</button></div></label>
        <div id="cs"></div>
        <label class="field">When will you arrive? <b id="tv" class="tvl">${fmtTime(arrival)}</b><input id="tr" type="range" min="0" max="1425" step="15" value="${arrival}" class="range"></label>
      </div>
      <label class="field">Note for the host (optional)<input id="nt" maxlength="120" placeholder="Allergies, a song request..."></label>
      <div class="msg" id="msg" hidden></div>
      <button class="btn full" id="sb">Send my answer</button>
    </form></div>`;
    $$('.yb').forEach(b=>b.onclick=()=>{att=b.dataset.a==='1';$$('.yb').forEach(x=>x.classList.toggle('on',x===b));$('#more').hidden=!att});
    const cs=()=>{comps.length=party-1;$('#cs').innerHTML=Array.from({length:party-1},(_,i)=>{comps[i]=comps[i]||{n:'',m:'Veg'};return `<div class="comp"><label class="field">Guest ${i+2} name<input data-ci="${i}" maxlength="40" value="${esc(comps[i].n)}"></label><label class="field">Meal<select data-cm="${i}">${MEALS.map(x=>`<option${x===comps[i].m?' selected':''}>${x}</option>`).join('')}</select></label></div>`}).join('');
      $$('[data-ci]').forEach(i=>i.oninput=()=>comps[i.dataset.ci].n=i.value);$$('[data-cm]').forEach(i=>i.onchange=()=>comps[i.dataset.cm].m=i.value)};
    cs();
    $('#mi').onclick=()=>{if(party>1){party--;$('#pc').textContent=party;cs()}};
    $('#pl').onclick=()=>{if(party<ev.max){party++;$('#pc').textContent=party;cs()}};
    $('#tr').oninput=e=>{arrival=+e.target.value;$('#tv').textContent=fmtTime(arrival)};
    $('#f').onsubmit=async e=>{e.preventDefault();const m=$('#msg'),b=$('#sb');m.hidden=true;
      const name=ev.invitee_name||($('#n')&&$('#n').value.trim());if(!name){m.hidden=false;m.textContent='Please enter your name.';return}
      b.disabled=true;b.textContent='Sending...';
      try{await rpc('submit_rsvp',{p_event:eid,p_token:tok||null,p_name:name,p_attending:att,p_grp:att?$('#g').value:null,p_meal:att?$('#m').value:null,p_party:att?party:0,p_arrival:att?arrival:null,p_comp:att?comps.map(c=>({n:(c.n||'Guest').slice(0,40),m:c.m})):[],p_note:$('#nt').value.trim()||null});
        root.innerHTML=`<div class="card reveal in center done"><div class="tick">&#10003;</div><h2>${att?'See you there.':'Thank you for letting us know.'}</h2><p class="muted">${att?`We have you down for ${party} ${party>1?'people':'person'} around ${fmtTime(arrival)}.`:'Your host has been told.'}</p><button class="btn btn-ghost" id="ch">Change my answer</button></div>`;
        $('#ch').onclick=draw}
      catch(err){m.hidden=false;m.textContent=/closed/i.test(err.message)?'RSVPs just closed for this event.':err.message;b.disabled=false;b.textContent='Send my answer'}};
  };
  draw();
})();
