import { db } from '../../../lib/db.js';
import { $, $$, toast } from '../../../lib/ui.js';
import { esc, fmtDate } from '../../../lib/format.js';
import { state, view, niceErr } from '../ctx.js';
import { R } from '../ctx.js';
import { overview } from './tabs/overview.js';
import { guests } from './tabs/guests.js';
import { share } from './tabs/share.js';
import { day } from './tabs/day.js';

export async function load(id){
  const [ev,inv,res]=await Promise.all([db('events?select=*&id=eq.'+id),db('invitees?select=*&event_id=eq.'+id+'&order=name.asc'),db('responses?select=*&event_id=eq.'+id+'&order=created_at.desc')]);
  if(!ev.length)throw new Error('Event not found');
  state.ev=ev[0];state.inv=inv;state.res=res}
export async function openEvent(id,tab){
  clearInterval(state.timer);state.tab=tab||'overview';state.q='';state.f='all';
  view('<div class="skel"></div>');
  try{await load(id)}catch(e){toast(niceErr(e),1);return R.listView()}
  render();
  state.timer=setInterval(async()=>{if(document.hidden||!state.ev||$('#msg2')||document.activeElement&&/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))return;try{await load(id);paint()}catch(e){}},15000);
}
export function render(){
  const {ev}=state;
  view(`<section class="evpage"><button class="back" id="bk">&larr; All events</button>
    <div class="dhead"><div><p class="eyebrow">${esc(ev.occasion)} &middot; ${fmtDate(ev.event_date)}</p><h2>${esc(ev.title)}</h2></div>
    <div class="row"><button class="btn btn-ghost btn-sm" id="ed">Edit</button><button class="btn btn-sm" id="shr">Share invite</button></div></div>
    <div class="tabs" id="tabs">${[['overview','Overview'],['guests','Guests'],['share','Invites'],['day','Day of']].map(t=>`<button class="tab${state.tab===t[0]?' on':''}" data-t="${t[0]}">${t[1]}</button>`).join('')}</div>
    <div id="pane"></div></section>`);
  $('#bk').onclick=R.listView;$('#ed').onclick=()=>R.eventForm(ev);$('#shr').onclick=()=>{state.tab='share';render()};
  $$('.tab').forEach(b=>b.onclick=()=>{state.tab=b.dataset.t;$$('.tab').forEach(x=>x.classList.toggle('on',x===b));paint()});
  paint()}
export function paint(){const p=$('#pane');if(!p)return;({overview,guests,share,day}[state.tab])(p)}

R.openEvent = openEvent;
R.render = render;
R.paint = paint;
R.load = load;
