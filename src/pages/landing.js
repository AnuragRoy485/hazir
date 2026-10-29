(()=>{
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
// ---------- split headline
$$('[data-split]').forEach(h=>{
  let i=0;
  const walk=n=>{[...n.childNodes].forEach(c=>{
    if(c.nodeType===3){const f=document.createDocumentFragment();c.textContent.split(/(\s+)/).forEach(t=>{if(!t.trim()){f.append(t);return}const w=document.createElement('span');w.className='w';const s=document.createElement('span');s.textContent=t;s.style.setProperty('--i',i++);w.append(s);f.append(w)});c.replaceWith(f)}
    else if(c.nodeName==='EM'){const w=document.createElement('span');w.className='w';const s=document.createElement('span');s.style.setProperty('--i',i++);s.innerHTML='<em>'+c.textContent+'</em>';w.append(s);c.replaceWith(w)}
  })};
  walk(h);setTimeout(()=>h.classList.add('in'),60);
});
// ---------- reveal + counters
const countUp=el=>{if(el.dataset.done)return;el.dataset.done=1;const to=+el.dataset.count;if(reduce){el.textContent=to;return}const t0=performance.now(),d=1400;const f=t=>{const p=Math.min(1,(t-t0)/d);el.textContent=Math.round(to*(1-Math.pow(1-p,3)));if(p<1)requestAnimationFrame(f)};requestAnimationFrame(f)};
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');e.target.querySelectorAll('[data-count]').forEach(countUp);if(e.target.dataset.count)countUp(e.target);io.unobserve(e.target)}}),{threshold:.15});
$$('.reveal').forEach(e=>io.observe(e));
$$('[data-count]').forEach(e=>io.observe(e));
// ---------- nav, progress, cursor, tilt, magnetic
let lastY=0;
addEventListener('scroll',()=>{const y=scrollY,h=document.documentElement.scrollHeight-innerHeight;$('#progress').style.width=(y/h*100)+'%';const n=$('#nav');n.classList.toggle('scrolled',y>10);n.classList.toggle('hide',y>lastY&&y>400);lastY=y},{passive:true});
const cur=$('#cursor');cur.style.willChange='transform';
addEventListener('pointermove',e=>{if(e.pointerType!=='mouse')return;cur.style.transform=`translate3d(${e.clientX-17}px,${e.clientY-17}px,0)`});
document.addEventListener('pointerover',e=>{cur.classList.toggle('big',!!e.target.closest('a,button,.chip,.tile,.clock'))});
const tilt=$('#heroPhone');
if(tilt&&!reduce)addEventListener('pointermove',e=>{if(e.pointerType!=='mouse')return;const x=(e.clientX/innerWidth-.5),y=(e.clientY/innerHeight-.5);tilt.style.transform=`rotateY(${x*14}deg) rotateX(${-y*10}deg)`});
$$('.magnetic').forEach(b=>{if(reduce)return;b.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse')return;const r=b.getBoundingClientRect();b.style.transform=`translate(${(e.clientX-r.left-r.width/2)*.18}px,${(e.clientY-r.top-r.height/2)*.28}px)`});b.addEventListener('pointerleave',()=>b.style.transform='')});
// ---------- hero dots
const dots=$('#heroDots');for(let i=0;i<30;i++)dots.append(document.createElement('i'));
let hc=0;const hd=[...dots.children];
setInterval(()=>{hc=hc>=30?0:hc+1;hd.forEach((d,i)=>d.classList.toggle('on',i<hc));const conf=Math.round(hc/30*249);$('#heroConfirmed').textContent=conf;$('#heroPending').textContent=400-conf},520);

// ---------- shared helpers
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const MEALS=['Veg','Non-veg','Jain','Vegan','Kids'],GROUPS=['Family','Friends','Colleagues','Other'];
const opt=(a,v)=>a.map(x=>`<option${x===v?' selected':''}>${x}</option>`).join('');
const svgTicks=g=>{for(let i=0;i<12;i++){const a=i*30*Math.PI/180,r1=i%3?82:76,r2=88;const l=document.createElementNS('http://www.w3.org/2000/svg','line');l.setAttribute('x1',100+r1*Math.sin(a));l.setAttribute('y1',100-r1*Math.cos(a));l.setAttribute('x2',100+r2*Math.sin(a));l.setAttribute('y2',100-r2*Math.cos(a));l.setAttribute('stroke','#000');l.setAttribute('stroke-width',i%3?1:2.5);g.append(l)}};
const fmt=m=>{let h=Math.floor(m/60)%24,mi=m%60;const ap=h>=12?'PM':'AM';h=h%12||12;return h+':'+String(mi).padStart(2,'0')+' '+ap};
const fdate=d=>new Date(d+'T00:00').toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'});
function makeClock(root,onChange,start){
  const svg=root.querySelector('svg.clock'),hH=svg.querySelector('.hh'),mH=svg.querySelector('.mh');svgTicks(svg.querySelector('.tk'));let m=start;
  const set=v=>{m=((v%1440)+1440)%1440;hH.style.transform=`rotate(${(m/60)%12*30}deg)`;mH.style.transform=`rotate(${(m%60)*6}deg)`;onChange(m)};
  let drag=false;const move=e=>{if(!drag)return;const r=svg.getBoundingClientRect();let a=(Math.atan2(e.clientX-(r.left+r.width/2),-(e.clientY-(r.top+r.height/2)))*180/Math.PI+360)%360;const nm=Math.round(a/6/15)*15%60,cur=m%60,hr=Math.floor(m/60);let h=hr;if(cur>45&&nm<15)h++;if(cur<15&&nm>45)h--;set(h*60+nm)};
  svg.addEventListener('pointerdown',e=>{drag=true;svg.setPointerCapture(e.pointerId);move(e)});svg.addEventListener('pointerup',()=>drag=false);svg.addEventListener('pointermove',move);
  root.querySelector('.tp').onclick=()=>set(m+15);root.querySelector('.tm').onclick=()=>set(m-15);
  return {set,get:()=>m};
}
const store=id=>{const k='hazir:r:'+id;return{get(){try{return JSON.parse(localStorage.getItem(k))||[]}catch{return[]}},set(a){try{localStorage.setItem(k,JSON.stringify(a))}catch{}},clear(){localStorage.removeItem(k)}}};
const headcount=r=>r.y?r.p:0;
// ---------- guest form
function guestForm(box,ev,st,o={}){
  const closed=ev.dead&&new Date(ev.dead+'T23:59:59')<new Date()&&!o.demo;
  const max=ev.max||6,inv=o.inv||'';
  box.innerHTML=`<div class="card guest"><p class="tiny">${esc(ev.o)} RSVP</p><h3>Will you attend?</h3><p class="muted">${esc(o.sub||'')}</p>
  ${ev.dead?`<p class="banner${closed?' warn':''}">${closed?'RSVPs closed on ':'Please answer by '}${fdate(ev.dead)}.</p>`:''}
  ${closed?'':`<div class="yn"><button class="vy" aria-pressed="false">Yes</button><button class="vn" aria-pressed="false">No</button></div>
  <div class="more"><label class="field">Your name<input class="vname" maxlength="40" value="${esc(inv)}" placeholder="Your name"></label>
  <label class="field">You are with<select class="vgrp">${opt(GROUPS)}</select></label>
  <div class="yes-only"><label class="field">Your meal<select class="vmeal">${opt(MEALS)}</select></label>
  <div class="field"><span>How many are coming, including you</span><div class="stepper"><button class="mi" type="button" aria-label="Fewer">-</button><b class="vp">1</b><button class="pl" type="button" aria-label="More">+</button></div></div>
  <div class="comps"></div>
  <div class="field"><span>Expected arrival</span><div class="clockwrap"><svg viewBox="0 0 200 200" class="clock" aria-label="Arrival time"><circle cx="100" cy="100" r="92" class="face"/><g class="tk"></g><line class="hand hh" x1="100" y1="100" x2="100" y2="55"/><line class="hand thin mh" x1="100" y1="100" x2="100" y2="30"/><circle cx="100" cy="100" r="5"/></svg><div class="time"><b class="vt">7:00 PM</b><div class="seg"><button class="tm" type="button">-15 min</button><button class="tp" type="button">+15 min</button></div></div></div></div></div>
  <label class="field">Note for the host (optional)<input class="vnote" maxlength="120" placeholder="Allergies, accessibility, a message"></label>
  <button class="btn full vs" type="button">Send my answer</button></div>`}
  <p class="done" hidden></p></div>`;
  if(closed)return;
  const q=s=>box.querySelector(s);let ch=null,p=1;const comp=[];
  const clk=makeClock(q('.guest'),m=>q('.vt').textContent=fmt(m),ev.time||19*60);
  const drawComp=()=>{q('.comps').innerHTML=p>1?Array.from({length:p-1},(_,i)=>`<div class="comp"><input data-i="${i}" class="cn" placeholder="Guest ${i+2} name" maxlength="40" value="${esc((comp[i]||{}).n||'')}"><select data-i="${i}" class="cm">${opt(MEALS,(comp[i]||{}).m||'Veg')}</select></div>`).join(''):'';q('.comps').querySelectorAll('.cn').forEach(x=>x.oninput=()=>{(comp[x.dataset.i]=comp[x.dataset.i]||{}).n=x.value});q('.comps').querySelectorAll('.cm').forEach(x=>x.onchange=()=>{(comp[x.dataset.i]=comp[x.dataset.i]||{}).m=x.value})};
  const pk=c=>{ch=c;q('.vy').setAttribute('aria-pressed',c==='y');q('.vn').setAttribute('aria-pressed',c==='n');q('.more').classList.add('open');q('.yes-only').style.display=c==='y'?'':'none';q('.done').hidden=true};
  q('.vy').onclick=()=>pk('y');q('.vn').onclick=()=>pk('n');
  q('.pl').onclick=()=>{p=Math.min(max,p+1);q('.vp').textContent=p;drawComp()};q('.mi').onclick=()=>{p=Math.max(1,p-1);q('.vp').textContent=p;drawComp()};
  q('.vs').onclick=()=>{if(!ch)return;const n=q('.vname').value.trim()||'Guest';const r={id:Date.now().toString(36)+Math.random().toString(36).slice(2,5),n,y:ch==='y',g:q('.vgrp').value,note:q('.vnote').value.trim(),ts:Date.now()};if(o.gid!=null)r.gid=o.gid;
    if(r.y){r.p=p;r.t=clk.get();r.m=q('.vmeal').value;r.c=Array.from({length:p-1},(_,i)=>({n:(comp[i]||{}).n||`${n}'s guest ${i+2}`,m:(comp[i]||{}).m||'Veg'}))}else{r.p=0;r.t=0;r.m='';r.c=[]}
    let a=st.get();if(r.gid!=null)a=a.filter(x=>x.gid!==r.gid);st.set([...a,r]);o.onSent&&o.onSent(r);const d=q('.done');d.hidden=false;d.textContent=r.y?`Thank you, ${n}. We will see ${r.p} of you at ${fmt(r.t)}.`:`Thank you, ${n}. Your answer is recorded.`};
}
// ---------- dashboard
function board(box,ev,st,o={}){
  const flt={q:'',s:'all',g:'all',m:'all'};
  box.innerHTML=`<div class="card board"><p class="tiny">${o.host?'HOST DASHBOARD':'LIVE DASHBOARD'} <i class="live"></i></p><h3>${esc(ev.n)}</h3>
  <div class="total"><small>TOTAL INVITED</small><b class="bt">${ev.t}</b></div><div class="bar"><i class="by"></i><i class="bn"></i></div>
  <ul class="legend"><li><span class="d d1"></span>Confirmed<b class="ly">0</b></li><li><span class="d d2"></span>Not attending<b class="ln">0</b></li><li><span class="d d3"></span>Awaiting response<b class="lw">0</b></li></ul>
  <div class="plates"><small>PLATES TO PREPARE</small><b class="pl">0</b></div>
  <p class="tiny">MEALS</p><div class="mix"></div>
  <p class="tiny" style="margin-top:16px">ARRIVALS BY HOUR</p><div class="hist"></div>
  <div class="tools"><input class="wide fq" placeholder="Search guests"><select class="fs"><option value="all">All answers</option><option value="y">Coming</option><option value="n">Not coming</option></select><select class="fg"><option value="all">All groups</option>${opt(GROUPS)}</select><select class="fm"><option value="all">All meals</option>${opt(MEALS)}</select></div>
  <ul class="list"></ul>
  <div class="actions"><button class="btn btn-ghost btn-sm ex">Download CSV</button>${o.walk?'<button class="btn btn-ghost btn-sm wk">Add walk-in</button>':''}${o.reset?'<button class="btn btn-ghost btn-sm rs">Reset demo</button>':''}</div>
  <div class="pw"></div></div>`;
  const q=s=>box.querySelector(s);
  const draw=()=>{
    const a=st.get(),yes=a.filter(r=>r.y),yc=yes.reduce((s,r)=>s+r.p,0),nc=a.length-yes.length,T=Math.max(ev.t,yc+nc),w=Math.max(0,ev.t-yc-nc);
    q('.ly').textContent=yc;q('.ln').textContent=nc;q('.lw').textContent=w;q('.pl').textContent=yc;q('.bt').textContent=ev.t;
    q('.by').style.width=yc/T*100+'%';q('.bn').style.width=nc/T*100+'%';
    const mc={};yes.forEach(r=>{mc[r.m]=(mc[r.m]||0)+1;(r.c||[]).forEach(c=>mc[c.m]=(mc[c.m]||0)+1)});
    q('.mix').innerHTML=Object.keys(mc).length?MEALS.filter(m=>mc[m]).map(m=>`<span>${m}<b>${mc[m]}</b></span>`).join(''):'<span class="note" style="border:0">Meals appear as guests answer</span>';
    const b={};yes.forEach(r=>{const h=Math.floor(r.t/60);b[h]=(b[h]||0)+r.p});const hs=Object.keys(b).map(Number).sort((x,y)=>x-y),mx=Math.max(1,...Object.values(b));
    q('.hist').innerHTML=hs.map(h=>`<i style="height:${b[h]/mx*100}%"><span>${fmt(h*60).replace(':00','')}</span></i>`).join('');
    const rows=a.filter(r=>(flt.s==='all'||(flt.s==='y')===r.y)&&(flt.g==='all'||r.g===flt.g)&&(flt.m==='all'||r.m===flt.m||(r.c||[]).some(c=>c.m===flt.m))&&(!flt.q||(r.n+' '+(r.c||[]).map(c=>c.n).join(' ')).toLowerCase().includes(flt.q))).slice().reverse();
    q('.list').innerHTML=rows.length?rows.slice(0,60).map(r=>`<li><div>${esc(r.n)}${r.y&&r.p>1?' +'+(r.p-1):''}<small>${esc(r.g||'')}${r.m?' · '+r.m:''}${r.note?' · "'+esc(r.note)+'"':''}</small></div><div style="text-align:right">${r.y?r.p+' at '+fmt(r.t):'Not coming'}${o.host?`<br><button class="rm" data-id="${r.id}" aria-label="Remove">×</button>`:''}</div></li>`).join(''):'<li class="note">No guests match.</li>';
    q('.list').querySelectorAll('.rm').forEach(x=>x.onclick=()=>{st.set(st.get().filter(r=>r.id!==x.dataset.id));draw()});
    if(ev.names&&ev.names.length){const done=new Set(a.map(r=>r.gid));const pend=ev.names.map((n,i)=>({n,i})).filter(x=>!done.has(x.i));
      const base=location.href.split('#')[0];q('.pw').innerHTML=pend.length?`<div class="pend"><p class="tiny">STILL TO ANSWER (${pend.length})${ev.dead?' · by '+fdate(ev.dead):''}</p><ul style="list-style:none">${pend.slice(0,40).map(x=>`<li><span>${esc(x.n)}</span><a href="#" class="cp" data-i="${x.i}">Copy reminder</a></li>`).join('')}</ul></div>`:'<p class="banner">Everyone has answered.</p>';
      q('.pw').querySelectorAll('.cp').forEach(x=>x.onclick=async e=>{e.preventDefault();const n=ev.names[x.dataset.i];const link=base+'#/g/'+o.code+'/'+x.dataset.i;const msg=`Hi ${n.split(' ')[0]}, please RSVP for ${ev.n}${ev.dead?' by '+fdate(ev.dead):''}: ${link}`;try{await navigator.clipboard.writeText(msg);x.textContent='Copied'}catch{prompt('Copy this message',msg)}setTimeout(()=>x.textContent='Copy reminder',1800)})}
  };
  q('.fq').oninput=e=>{flt.q=e.target.value.toLowerCase();draw()};q('.fs').onchange=e=>{flt.s=e.target.value;draw()};q('.fg').onchange=e=>{flt.g=e.target.value;draw()};q('.fm').onchange=e=>{flt.m=e.target.value;draw()};
  q('.ex').onclick=()=>{const a=st.get();const rows=[['Name','Answer','Group','Party size','Meal','Arrival','Companions','Note']];a.forEach(r=>rows.push([r.n,r.y?'Yes':'No',r.g||'',r.p,r.m||'',r.y?fmt(r.t):'',(r.c||[]).map(c=>c.n+' ('+c.m+')').join('; '),r.note||'']));const csv=rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');const l=document.createElement('a');l.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));l.download=(ev.n||'guests').replace(/\W+/g,'-')+'.csv';l.click()};
  if(o.reset)q('.rs').onclick=o.reset;
  if(o.walk)q('.wk').onclick=()=>{const n=prompt('Walk-in guest name');if(!n)return;const c=+prompt('How many people?','1')||1;const a=st.get();a.push({id:'w'+Date.now(),n,y:true,g:'Other',p:c,t:ev.time||19*60,m:'Veg',c:[],ts:Date.now()});st.set(a);draw()};
  draw();return{draw};
}
// ---------- demo section
const OCC={
 Wedding:{n:'Riya and Arjun, wedding',o:'Wedding',t:120,time:19*60,dead:'',max:4,sub:'Riya and Arjun invite you to celebrate.'},
 Birthday:{n:"Mira's 30th birthday",o:'Birthday',t:40,time:18*60+30,max:3,sub:'Come eat cake.'},
 Puja:{n:'Griha pravesh puja',o:'Puja',t:60,time:10*60,max:5,sub:'Join the family for puja and prasad.'},
 'Baby shower':{n:'Baby shower',o:'Baby shower',t:35,time:16*60,max:3,sub:'A small afternoon for a big arrival.'},
 Corporate:{n:'Annual offsite dinner',o:'Corporate',t:80,time:20*60,max:2,sub:'Dinner for the whole team.'}
};
const names=['Aarav','Diya','Kabir','Ananya','Vihaan','Ira','Reyansh','Meera','Arnav','Saanvi','Zoya','Rohan'];
function seed(ev){const out=[],yes=Math.round(ev.t*.45),no=Math.round(ev.t*.08);for(let i=0;i<yes+no;i++){const g=i<yes,p=g?(i%4===0?2:1):0;out.push({id:'s'+i,n:names[i%12]+' '+String.fromCharCode(65+i%26),y:g,g:GROUPS[i%4],p,t:g?ev.time+[-60,-30,0,0,15,30,30,45,60,90][i%10]:0,m:g?MEALS[(i%7===0)?2:(i%3===0)?1:0]:'',c:g&&p>1?[{n:'Guest',m:'Veg'}]:[],ts:0})}return out}
const chips=$('#occChips');let occ='Wedding';
Object.keys(OCC).forEach(o=>{const b=document.createElement('button');b.className='chip';b.textContent=o;b.onclick=()=>setOcc(o);chips.append(b)});
function setOcc(o){occ=o;$$('.chip').forEach(c=>c.classList.toggle('on',c.textContent===o));const ev=OCC[o],st=store('demo-'+o);if(!st.get().length)st.set(seed(ev));let bd;
  guestForm($('#demoGuest'),ev,st,{demo:1,sub:ev.sub,onSent:()=>{bd.draw();$('#demoBoard').scrollIntoView({behavior:'smooth',block:'nearest'})}});
  bd=board($('#demoBoard'),ev,st,{reset:()=>{st.clear();setOcc(o)}})}
setOcc('Wedding');

// ---------- scroll choreography: Nightfall-style act sequence (desktop fx), simple reveals elsewhere
const fx=!reduce;
if(fx)document.documentElement.classList.add('fx');
const pinOK=fx&&matchMedia('(min-width:900px)').matches;
const clamp01=v=>v<0?0:v>1?1:v,seg=(p,a,b)=>clamp01((p-a)/b),smooth=x=>{x=clamp01(x);return x*x*(3-2*x)};
// Act 3 (anticipation): the why headline wipes in from the right, like the reference's turn act.
const whyH2=$('.why h2.kl');
if(whyH2&&fx){whyH2.classList.remove('kl');whyH2.classList.add('wipe')}
// Kinetic masked-line headlines: each <br>-separated line rises out of its mask.
$$('.kl').forEach(h=>{
  const lines=[[]];
  [...h.childNodes].forEach(n=>{if(n.nodeName==='BR')lines.push([]);else lines[lines.length-1].push(n)});
  h.textContent='';let li=0;
  lines.forEach(ns=>{if(!ns.length)return;const l=document.createElement('span');l.className='kl-l';const inner=document.createElement('span');inner.className='kl-i';inner.style.setProperty('--i',li++);ns.forEach(n=>inner.append(n));l.append(inner);h.append(l)});
});
const klIO=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');klIO.unobserve(e.target)}}),{threshold:.3});
// Act 2 (recognition): the problem headline holds the frame while its lines assemble.
const pinWrap=$('.pinhead'),pinH2=pinWrap&&pinWrap.querySelector('.kl');
let pinLines=[],pinBrow=null;
if(pinWrap&&pinH2&&pinOK){pinH2.classList.add('kl-pin');pinLines=[...pinH2.querySelectorAll('.kl-i')];pinBrow=pinWrap.querySelector('.eyebrow')}
// Acts 1/4/5/6 (desktop fx): hero hold with drifting layers, drawn how-it-works path, sideways occasions rail, closing hold.
let heroAct=null,howAct=null,occAct=null,ctaAct=null;
let occRail=null,occTiles=[],howPath=null,howNodes=[],howSteps=[],ctaLines=[],ctaLead=null,ctaBtns=null,heroPlx=null;
const heroText=$('.hero-text');
const wrapAct=(sec,id)=>{const w=document.createElement('div');w.className='act-pin';w.id=id;const st=document.createElement('div');st.className='act-stage';sec.parentNode.insertBefore(w,sec);st.append(sec);w.append(st);return{w,st,sec}};
const NS='http://www.w3.org/2000/svg';
function measureHow(){
  if(!howAct||!howPath)return;
  const sb=howAct.st.getBoundingClientRect();
  const pts=howSteps.map(s=>{const n=s.querySelector('.n');if(!n)return null;const r=n.getBoundingClientRect();return{x:r.left-sb.left+Math.min(18,r.width/2),y:r.top-sb.top+r.height/2}}).filter(Boolean);
  if(pts.length<2)return;
  howPath.setAttribute('d','M '+pts.map(p=>p.x.toFixed(1)+' '+p.y.toFixed(1)).join(' L '));
  howNodes.forEach((c,i)=>{if(pts[i]){c.setAttribute('cx',pts[i].x.toFixed(1));c.setAttribute('cy',pts[i].y.toFixed(1))}});
}
if(pinOK){
  heroAct=wrapAct($('.hero'),'act-hero');
  heroPlx=heroAct.sec.querySelector('.plx-wrap');
  howAct=wrapAct($('.how'),'act-how');
  const svg=document.createElementNS(NS,'svg');svg.setAttribute('class','how-draw');svg.setAttribute('aria-hidden','true');
  howPath=document.createElementNS(NS,'path');howPath.setAttribute('pathLength','1');howPath.setAttribute('class','how-line');svg.append(howPath);
  howSteps=[...howAct.sec.querySelectorAll('.step')];
  howNodes=howSteps.map(()=>{const c=document.createElementNS(NS,'circle');c.setAttribute('r','5');c.setAttribute('class','how-node');svg.append(c);return c});
  howAct.st.append(svg);
  howSteps.forEach(s=>s.classList.remove('reveal'));
  occAct=wrapAct($('.occ'),'act-occ');
  const grid=occAct.sec.querySelector('.grid');
  occRail=document.createElement('div');occRail.className='occ-rail';
  const lead=document.createElement('div');lead.className='occ-lead';
  lead.append(occAct.sec.querySelector('.eyebrow'),occAct.sec.querySelector('h2'));
  occRail.append(lead);
  occTiles=[...grid.children];
  occTiles.forEach(t=>{t.classList.remove('reveal');occRail.append(t)});
  grid.replaceWith(occRail);
  ctaAct=wrapAct($('.cta-end'),'act-cta');
  const ctaH2=ctaAct.sec.querySelector('.kl');
  if(ctaH2){ctaH2.classList.add('kl-pin');ctaLines=[...ctaH2.querySelectorAll('.kl-i')]}
  ctaLead=ctaAct.sec.querySelector('.lead');ctaBtns=ctaAct.sec.querySelector('.cta');
  [ctaLead,ctaBtns].forEach(el=>el&&el.classList.remove('reveal'));
  requestAnimationFrame(()=>{measureHow();fxFrame()});
  addEventListener('load',()=>{measureHow();fxFrame()});
  addEventListener('resize',()=>{measureHow();fxFrame()});
}
$$('.kl').forEach(h=>{if(pinOK&&(h===pinH2||(ctaAct&&ctaAct.w.contains(h))))return;klIO.observe(h)});
$$('.wipe').forEach(h=>klIO.observe(h));
// Layered parallax on elements outside the pinned hero, scrubbed to scroll.
const plxEls=$$('[data-plx]').filter(el=>!(heroAct&&heroAct.w.contains(el))).map(el=>({el,r:parseFloat(el.dataset.plx)||0}));
const actP=a=>{const b=a.w.getBoundingClientRect();return clamp01(-b.top/(b.height-innerHeight))};
let fxTick=false;
function fxFrame(){
  fxTick=false;
  const vh=innerHeight;
  if(plxEls.length){
    const vc=vh/2,rects=plxEls.map(o=>o.el.getBoundingClientRect());
    rects.forEach((b,i)=>{if(b.bottom<-200||b.top>vh+200)return;plxEls[i].el.style.transform=`translate3d(0,${((b.top+b.height/2-vc)*plxEls[i].r).toFixed(1)}px,0)`});
  }
  if(heroText&&!heroAct)heroText.style.opacity=String(1-clamp01(scrollY/(vh*.8))*.9);
  if(heroAct){
    const p=actP(heroAct);
    heroText.style.transform=`translate3d(0,${(-p*48).toFixed(1)}px,0)`;
    heroText.style.opacity=(1-seg(p,.52,.4)*.96).toFixed(2);
    if(heroPlx)heroPlx.style.transform=`translate3d(0,${(-p*120).toFixed(1)}px,0)`;
  }
  if(pinLines.length&&pinWrap){
    const b=pinWrap.getBoundingClientRect();
    if(b.bottom>0&&b.top<vh){
      const p=clamp01(-b.top/(b.height-vh));
      pinLines.forEach((inner,i)=>{
        const start=.02+i*.28;
        const rise=seg(p,start,.16);
        const dim=i<pinLines.length-1?1-seg(p,start+.3,.14)*.62:1;
        inner.style.transform=`translate3d(0,${((1-rise)*114).toFixed(1)}%,0)`;
        inner.style.opacity=dim.toFixed(2);
      });
      if(pinBrow)pinBrow.style.opacity=seg(p,0,.05).toFixed(2);
    }
  }
  if(howAct&&howPath){
    const p=actP(howAct);
    howPath.style.strokeDashoffset=(1-seg(p,.06,.74)).toFixed(3);
    howNodes.forEach((c,i)=>{c.style.opacity=seg(p,.1+i*.185,.05).toFixed(2)});
    howSteps.forEach((s,i)=>{const r=seg(p,.05+i*.19,.13);s.style.opacity=r.toFixed(2);s.style.transform=`translate3d(0,${((1-r)*26).toFixed(1)}px,0)`});
  }
  if(occAct&&occRail){
    const p=actP(occAct);
    const travel=Math.max(0,occRail.scrollWidth-occAct.st.clientWidth+60);
    occRail.style.transform=`translate3d(${(-travel*smooth(p)).toFixed(1)}px,0,0)`;
    occTiles.forEach((t,i)=>{const s=seg(p,.04+i*.11,.15);t.style.opacity=(.5+.5*s).toFixed(2);t.style.transform=`translate3d(0,${((1-s)*18).toFixed(1)}px,0)`});
  }
  if(ctaAct){
    const p=actP(ctaAct);
    ctaLines.forEach((inner,i)=>{const rise=seg(p,.02+i*.2,.15);inner.style.transform=`translate3d(0,${((1-rise)*114).toFixed(1)}%,0)`});
    if(ctaLead){const r=seg(p,.34,.16);ctaLead.style.opacity=r.toFixed(2);ctaLead.style.transform=`translate3d(0,${((1-r)*20).toFixed(1)}px,0)`}
    if(ctaBtns){const r=seg(p,.52,.16);ctaBtns.style.opacity=r.toFixed(2);ctaBtns.style.transform=`translate3d(0,${((1-r)*20).toFixed(1)}px,0)`}
  }
}
if(fx){addEventListener('scroll',()=>{if(!fxTick){fxTick=true;requestAnimationFrame(fxFrame)}},{passive:true});fxFrame()}
})();
