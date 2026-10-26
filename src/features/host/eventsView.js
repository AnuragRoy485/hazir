import { auth } from '../../lib/auth.js';
import { db } from '../../lib/db.js';
import { $, $$ } from '../../lib/ui.js';
import { esc, fmtDate } from '../../lib/format.js';
import { state, view, niceErr } from './ctx.js';
import { R } from './ctx.js';

export async function listView(){
  clearInterval(state.timer);state.ev=null;
  view('<div class="skel"></div>');
  try{
    const [evs,res]=await Promise.all([db('events?select=*&order=event_date.asc'),db('responses?select=event_id,attending,party')]);
    state.events=evs;
    const by={};res.forEach(r=>{const o=by[r.event_id]||(by[r.event_id]={n:0,h:0});o.n++;if(r.attending)o.h+=r.party});
    const u=auth.user(),first=((u.user_metadata&&u.user_metadata.name)||'').split(' ')[0];
    const today=new Date().toISOString().slice(0,10);
    view(`<section class="dash reveal in"><div class="dhead"><div><p class="eyebrow">Your events</p><h2>${first?'Hello, '+esc(first)+'.':'Hello.'}</h2></div><button class="btn magnetic" id="newEv">New event</button></div>
      ${evs.length?`<div class="evgrid">${evs.map((e,i)=>{const s=by[e.id]||{n:0,h:0},p=Math.min(100,Math.round(s.n/e.invited*100));return `<article class="card evcard reveal" style="--d:${i*.06}s" data-id="${e.id}" tabindex="0">
        <div class="tiny">${esc(e.occasion)}${e.event_date<today?' &middot; past':''}</div><h3>${esc(e.title)}</h3><p class="muted">${fmtDate(e.event_date)}</p>
        <div class="bar"><i style="width:${p}%"></i></div><div class="evstat"><span><b>${s.h}</b> coming</span><span><b>${s.n}</b> of ${e.invited} answered</span></div></article>`}).join('')}</div>`
      :`<div class="card empty reveal in"><h3>No events yet.</h3><p class="muted">Create your first event and share the link. Answers show up here the moment guests send them.</p><button class="btn" id="newEv2">Create your first event</button></div>`}
    </section>`);
    $$('.evcard').forEach(c=>{c.onclick=()=>R.openEvent(c.dataset.id);c.onkeydown=e=>{if(e.key==='Enter')R.openEvent(c.dataset.id)}});
    const ne=$('#newEv'),ne2=$('#newEv2');ne.onclick=()=>R.eventForm();if(ne2)ne2.onclick=()=>R.eventForm();
  }catch(e){view(`<div class="card empty"><h3>Could not load events.</h3><p class="muted">${esc(niceErr(e))}</p><button class="btn" onclick="location.reload()">Try again</button></div>`)}
}


R.listView = listView;
