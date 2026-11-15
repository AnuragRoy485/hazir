// Hazir guest page: sees only event title, date and deadline; answers via a locked server function.
// The page speaks English, Hindi and Bengali (guest's choice, remembered on the device).
import { rpc } from '../lib/db.js?v=20261101-5';
import { $, $$, initEffects, copy, confirmBox } from '../lib/ui.js?v=20261101-5';
import { esc, fmtTime, fmtDate, fmtDeadline, MEALS, zonedToIso, toTimeInput } from '../lib/format.js?v=20261101-5';
import { parsePhone, ccOptions, DEF_ISO, bindPhone } from '../lib/countries.js?v=20261101-5';

const root=$('#root'),q=new URLSearchParams(location.search),eid=q.get('e'),tok=q.get('t')||'';let edit=q.get('r')||'';
initEffects();

// ---------- languages
const LOCALES={en:'en-IN',hi:'hi-IN',bn:'bn-IN'};
const STR={
en:{notFoundH:'Invitation not found.',notFoundP:'This link is incomplete. Ask your host for a fresh one.',notFoundP2:'This event may have been removed. Ask your host for a fresh link.',errH:'Something went wrong.',errP:'Please check your connection and try again.',linkBadH:'Link not recognised.',linkBadP:'This RSVP link is not valid. Ask your host for a fresh invite.',hostedBy:'hosted by',closedH:"That's a wrap on RSVPs.",closedP:'This event is no longer taking responses here. If your plans change, please contact your host directly.',hello:'Hello,',already:'You have already answered. Sending again updates your answer.',answerBy:'Please answer by',yes:'Yes, I will be there',no:'Sorry, I cannot',yourName:'Your name',phone:'Phone',email:'Email',phonePh:'Phone number',ccAria:'Country code',yourMeal:'Your meal',meal:'Meal',adults:'Adults',kids:'Kids',adult:'Adult',kid:'Kid',guestN:n=>'Guest '+n+' name',arrival:'When will you arrive?',note:'Note for the host (optional)',notePh:'Allergies, a song request...',send:'Send my answer',update:'Update my answer',sending:'Sending...',errName:'Please enter your name.',errPhone:'Please enter your phone number.',errCc:'Pick the country code for your phone number.',errPhoneBad:'That phone number does not look right for the selected country.',errEmail:'Please enter your email address.',errEmailBad:'That email address does not look right.',errClosed:'RSVPs for this event just closed. Please contact your host directly.',seeYou:'See you there.',thanksNo:'Thank you for letting us know.',downFor:(p,a,k)=>`We have you down for ${p} ${p>1?'people':'person'}${k?` (${a} ${a>1?'Adults':'Adult'}, ${k} ${k>1?'Kids':'Kid'})`:''}`,around:t=>' around '+t+'.',told:'Your host has been told.',saveLine:'Plans change. Keep your RSVP handy.',saveHint:'Save this link to update your answer anytime.',copyLink:'Copy my RSVP link',linkCopied:'Link copied',change:'Change my answer',addCal:'Add it to your calendar:',gcal:'Google Calendar',ics:'Apple / Outlook (.ics)',registry:'View the gift registry',fnsQ:'Which functions will you attend?',fnYes:'Going',fnNo:'Not going',delAnswer:'Delete my answer',delTitle:'Delete your answer?',delBody:'Your RSVP will be removed and your host will no longer see it. You can answer again anytime from the same invite link.',delOk:'Delete answer',cancel:'Cancel',deletedH:'Your answer is deleted.',deletedP:'Your host has been updated. You can send a fresh answer anytime from the same invite link.',again:'Send a new answer'},
hi:{notFoundH:'निमंत्रण नहीं मिला.',notFoundP:'यह लिंक अधूरा है. अपने मेज़बान से नया लिंक मांगें.',notFoundP2:'यह इवेंट हटाया जा चुका हो सकता है. मेज़बान से नया लिंक मांगें.',errH:'कुछ गड़बड़ हो गई.',errP:'कृपया अपना इंटरनेट कनेक्शन जांचें और फिर कोशिश करें.',linkBadH:'लिंक मान्य नहीं है.',linkBadP:'यह RSVP लिंक मान्य नहीं है. मेज़बान से नया निमंत्रण मांगें.',hostedBy:'मेज़बान',closedH:'RSVP का समय पूरा हुआ.',closedP:'यह इवेंट अब यहां जवाब नहीं ले रहा. अगर आपकी योजना बदली हो, तो कृपया मेज़बान से सीधे संपर्क करें.',hello:'नमस्ते,',already:'आप पहले जवाब दे चुके हैं. फिर से भेजने पर आपका जवाब अपडेट हो जाएगा.',answerBy:'कृपया इस समय तक जवाब दें:',yes:'हां, मैं आऊंगा / आऊंगी',no:'माफ़ कीजिए, नहीं आ पाऊंगा / पाऊंगी',yourName:'आपका नाम',phone:'फ़ोन',email:'ईमेल',phonePh:'फ़ोन नंबर',ccAria:'देश कोड',yourMeal:'आपका भोजन',meal:'भोजन',adults:'बड़े',kids:'बच्चे',adult:'बड़ा',kid:'बच्चा',guestN:n=>'मेहमान '+n+' का नाम',arrival:'आप कब पहुंचेंगे?',note:'मेज़बान के लिए संदेश (वैकल्पिक)',notePh:'एलर्गी, कोई गाना...',send:'मेरा जवाब भेजें',update:'मेरा जवाब अपडेट करें',sending:'भेजा जा रहा है...',errName:'कृपया अपना नाम लिखें.',errPhone:'कृपया अपना फ़ोन नंबर लिखें.',errCc:'अपने फ़ोन का देश कोड चुनें.',errPhoneBad:'चुने गए देश के लिए यह फ़ोन नंबर सही नहीं लग रहा.',errEmail:'कृपया अपना ईमेल लिखें.',errEmailBad:'यह ईमेल पता सही नहीं लग रहा.',errClosed:'इस इवेंट के RSVP अभी-अभी बंद हुए हैं. कृपया मेज़बान से सीधे संपर्क करें.',seeYou:'मिलते हैं वहां.',thanksNo:'बताने के लिए धन्यवाद.',downFor:(p,a,k)=>`हमने आपको ${p} ${p>1?'लोगों':'व्यक्ति'} के लिए लिख लिया है${k?` (${a} बड़े, ${k} बच्चे)`:''}`,around:t=>' लगभग '+t+' पर.',told:'मेज़बान को सूचित कर दिया गया है.',saveLine:'योजना बदल सकती है. अपना RSVP संभालकर रखें.',saveHint:'अपना जवाब कभी भी बदलने के लिए यह लिंक सेव करें.',copyLink:'मेरा RSVP लिंक कॉपी करें',linkCopied:'लिंक कॉपी हुआ',change:'मेरा जवाब बदलें',addCal:'अपने कैलेंडर में जोड़ें:',gcal:'Google कैलेंडर',ics:'Apple / Outlook (.ics)',registry:'गिफ़्ट रजिस्ट्री देखें',fnsQ:'आप कौन-कौन से फंक्शन में आएंगे?',fnYes:'आऊंगा',fnNo:'नहीं',delAnswer:'मेरा जवाब हटाएं',delTitle:'अपना जवाब हटाएं?',delBody:'आपका RSVP हटा दिया जाएगा और मेज़बान इसे नहीं देख पाएगा. आप उसी निमंत्रण लिंक से कभी भी फिर से जवाब दे सकते हैं.',delOk:'जवाब हटाएं',cancel:'रद्द करें',deletedH:'आपका जवाब हटा दिया गया.',deletedP:'मेज़बान को सूचित कर दिया गया है. आप उसी निमंत्रण लिंक से कभी भी नया जवाब भेज सकते हैं.',again:'नया जवाब भेजें'},
bn:{notFoundH:'আমন্ত্রণ পাওয়া যায়নি.',notFoundP:'এই লিংকটি অসম্পূর্ণ. আপনার হোস্টের কাছে নতুন লিংক চান.',notFoundP2:'এই অনুষ্ঠানটি মুছে ফেলা হতে পারে. হোস্টের কাছে নতুন লিংক চান.',errH:'কিছু একটা ভুল হয়েছে.',errP:'আপনার ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন.',linkBadH:'লিংকটি চেনা যাচ্ছে না.',linkBadP:'এই RSVP লিংকটি বৈধ নয়. হোস্টের কাছে নতুন আমন্ত্রণ চান.',hostedBy:'হোস্ট',closedH:'RSVP-এর সময় শেষ.',closedP:'এই অনুষ্ঠানে এখন আর এখানে উত্তর নেওয়া হচ্ছে না. আপনার পরিকল্পনা বদলালে সরাসরি হোস্টের সঙ্গে যোগাযোগ করুন.',hello:'নমস্কার,',already:'আপনি ইতিমধ্যে উত্তর দিয়েছেন. আবার পাঠালে আপনার উত্তর আপডেট হবে.',answerBy:'অনুগ্রহ করে এই সময়ের মধ্যে উত্তর দিন:',yes:'হ্যাঁ, আমি আসব',no:'দুঃখিত, আসতে পারব না',yourName:'আপনার নাম',phone:'ফোন',email:'ইমেল',phonePh:'ফোন নম্বর',ccAria:'দেশের কোড',yourMeal:'আপনার খাবার',meal:'খাবার',adults:'বড়রা',kids:'বাচ্চারা',adult:'বড়',kid:'বাচ্চা',guestN:n=>'অতিথি '+n+'-এর নাম',arrival:'আপনি কখন পৌঁছাবেন?',note:'হোস্টের জন্য বার্তা (ঐচ্ছিক)',notePh:'অ্যালার্জি, গানের অনুরোধ...',send:'আমার উত্তর পাঠান',update:'আমার উত্তর আপডেট করুন',sending:'পাঠানো হচ্ছে...',errName:'অনুগ্রহ করে আপনার নাম লিখুন.',errPhone:'অনুগ্রহ করে আপনার ফোন নম্বর লিখুন.',errCc:'আপনার ফোনের দেশের কোড বেছে নিন.',errPhoneBad:'নির্বাচিত দেশের জন্য এই ফোন নম্বরটি ঠিক মনে হচ্ছে না.',errEmail:'অনুগ্রহ করে আপনার ইমেল লিখুন.',errEmailBad:'এই ইমেল ঠিকানাটি ঠিক মনে হচ্ছে না.',errClosed:'এই অনুষ্ঠানের RSVP এইমাত্র বন্ধ হয়েছে. অনুগ্রহ করে সরাসরি হোস্টের সঙ্গে যোগাযোগ করুন.',seeYou:'সেখানে দেখা হচ্ছে.',thanksNo:'জানানোর জন্য ধন্যবাদ.',downFor:(p,a,k)=>`আমরা আপনাকে ${p} ${p>1?'জন':'জন'} হিসেবে লিখে নিয়েছি${k?` (${a} বড়, ${k} বাচ্চা)`:''}`,around:t=>' প্রায় '+t+'-এ.',told:'হোস্টকে জানিয়ে দেওয়া হয়েছে.',saveLine:'পরিকল্পনা বদলাতে পারে. আপনার RSVP কাছে রাখুন.',saveHint:'যেকোনো সময় উত্তর বদলাতে এই লিংকটি সংরক্ষণ করুন.',copyLink:'আমার RSVP লিংক কপি করুন',linkCopied:'লিংক কপি হয়েছে',change:'আমার উত্তর বদলান',addCal:'আপনার ক্যালেন্ডারে যোগ করুন:',gcal:'Google ক্যালেন্ডার',ics:'Apple / Outlook (.ics)',registry:'গিফট রেজিস্ট্রি দেখুন',fnsQ:'আপনি কোন কোন অনুষ্ঠানে আসবেন?',fnYes:'আসব',fnNo:'না',delAnswer:'আমার উত্তর মুছে দিন',delTitle:'আপনার উত্তর মুছবেন?',delBody:'আপনার RSVP মুছে যাবে এবং হোস্ট আর তা দেখতে পাবেন না. একই আমন্ত্রণ লিংক থেকে যেকোনো সময় আবার উত্তর দিতে পারেন.',delOk:'উত্তর মুছুন',cancel:'বাতিল',deletedH:'আপনার উত্তর মুছে গেছে.',deletedP:'হোস্টকে জানিয়ে দেওয়া হয়েছে. একই আমন্ত্রণ লিংক থেকে যেকোনো সময় নতুন উত্তর পাঠাতে পারেন.',again:'নতুন উত্তর পাঠান'}
};
let lang='en';try{lang=localStorage.getItem('hazir:lang')||(navigator.language||'en').slice(0,2)}catch{}
if(!STR[lang])lang='en';
const T=()=>STR[lang],loc=()=>LOCALES[lang];
const langSw=()=>`<div class="langsw" role="group" aria-label="Language">${[['en','English'],['hi','हिन्दी'],['bn','বাংলা']].map(([c,n])=>`<button type="button" class="lng${lang===c?' on':''}" data-l="${c}">${n}</button>`).join('')}</div>`;
const bindLang=redraw=>$$('.lng').forEach(b=>b.onclick=()=>{lang=b.dataset.l;try{localStorage.setItem('hazir:lang',lang)}catch{};redraw()});

let ev=null;
const tz=()=>ev.tz||'Asia/Kolkata';
const startIso=()=>zonedToIso(ev.date,toTimeInput(ev.time??1140),tz());
const whenL=()=>new Date(startIso()).toLocaleString(loc(),{timeZone:tz(),weekday:'short',day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
const tL=m=>new Date(zonedToIso(ev.date||'2026-01-01',toTimeInput(m),tz())).toLocaleTimeString(loc(),{timeZone:tz(),hour:'numeric',minute:'2-digit'});
const dL=d=>d?new Date(d+'T00:00:00').toLocaleDateString(loc(),{weekday:'short',day:'numeric',month:'short',year:'numeric'}):'';
const dlL=(iso,z)=>new Date(iso).toLocaleString(loc(),{timeZone:z,weekday:'short',day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});

// ---------- add to calendar
const icsUTC=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
const icsEsc=s=>String(s).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n');
const calStart=()=>new Date(startIso());
const calEnd=()=>ev.end_at?new Date(ev.end_at):new Date(calStart().getTime()+2*3600e3);
const gcalUrl=()=>'https://calendar.google.com/calendar/render?action=TEMPLATE&text='+encodeURIComponent(ev.title)+'&dates='+icsUTC(calStart())+'/'+icsUTC(calEnd())+'&details='+encodeURIComponent((ev.host?'Hosted by '+ev.host+'. ':'')+'RSVP: '+location.origin+'/rsvp?e='+ev.id)+(ev.venue?'&location='+encodeURIComponent(ev.venue):'');
const icsText=()=>['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Hazir//RSVP//EN','BEGIN:VEVENT','UID:'+ev.id+'@hazir.live','DTSTAMP:'+icsUTC(new Date()),'DTSTART:'+icsUTC(calStart()),'DTEND:'+icsUTC(calEnd()),'SUMMARY:'+icsEsc(ev.title),ev.venue?'LOCATION:'+icsEsc(ev.venue):'','DESCRIPTION:'+icsEsc('RSVP: '+location.origin+'/rsvp?e='+ev.id),'END:VEVENT','END:VCALENDAR'].filter(Boolean).join('\r\n');
const dlIcs=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([icsText()],{type:'text/calendar'}));a.download=(ev.title||'event').replace(/\W+/g,'-').toLowerCase()+'.ics';a.click()};

const head=()=>`${ev.banner?`<img class="banner" src="${esc(ev.banner)}" alt="${esc(ev.title)}">`:''}<p class="eyebrow">${esc(ev.occasion)}</p><h1 class="gh">${esc(ev.title)}</h1><p class="lead">${whenL()}${ev.host?' &middot; '+T().hostedBy+' '+esc(ev.host):''}</p>${ev.venue?`<p class="muted">${esc(ev.venue)}</p>`:''}${ev.message?`<p class="gmsg">${esc(ev.message)}</p>`:''}${ev.registry_url?`<p style="margin-top:10px"><a class="btn btn-ghost btn-sm" href="${esc(ev.registry_url)}" target="_blank" rel="noopener">${T().registry}</a></p>`:''}`;

(async()=>{
  if(!eid)return root.innerHTML=`<div class="card reveal in center"><h2>${T().notFoundH}</h2><p class="muted">${T().notFoundP}</p></div>`;
  try{ev=await rpc('get_invite',{p_event:eid,p_token:tok||null,p_edit:edit||null})}catch(e){return root.innerHTML=`<div class="card reveal in center"><h2>${T().errH}</h2><p class="muted">${T().errP}</p></div>`}
  if(!ev)return root.innerHTML=`<div class="card reveal in center"><h2>${T().notFoundH}</h2><p class="muted">${T().notFoundP2}</p></div>`;
  if(edit&&!ev.answered)return root.innerHTML=`<div class="card reveal in center"><h2>${T().linkBadH}</h2><p class="muted">${T().linkBadP}</p></div>`;
  document.title=ev.title+' - RSVP';
  const fns=(ev.functions||[]).filter(f=>f&&f.name);
  let att=ev.my_attending!=null?!!ev.my_attending:true,
      adults=ev.my_adults||ev.my_party||1,
      kids=ev.my_kids||0,
      arrival=ev.my_arrival!=null?ev.my_arrival:ev.time,
      comps=(ev.my_comp||[]).map(c=>({n:c.n||'',m:c.m||'Veg'})),
      vals={n:'',ph:'',em:'',nt:ev.my_note||'',m:ev.my_meal||'Veg'},
      fnAns={};fns.forEach(f=>fnAns[f.name]=!(ev.my_functions&&ev.my_functions[f.name]===false));
  const party=()=>adults+kids;
  const grab=()=>{const g=(id)=>$(id)?$(id).value:'';if($('#n'))vals.n=g('#n');if($('#ph'))vals.ph=g('#ph');if($('#em'))vals.em=g('#em');if($('#nt'))vals.nt=g('#nt');if($('#m'))vals.m=g('#m')};
  const draw=()=>{
    if(ev.closed){root.innerHTML=`<div class="card reveal in center">${langSw()}${head()}<h2 class="closedline">${T().closedH}</h2><p class="muted">${T().closedP}</p></div>`;bindLang(draw);return}
    root.innerHTML=`<div class="card reveal in">${langSw()}${head()}${ev.invitee_name?`<p class="hello">${T().hello} <b>${esc(ev.invitee_name)}</b>.${ev.answered?' '+T().already:''}</p>`:''}
    ${ev.deadline_at?`<p class="fine">${T().answerBy} ${dlL(ev.deadline_at,ev.tz)}.</p>`:ev.deadline?`<p class="fine">${T().answerBy} ${dL(ev.deadline)}.</p>`:''}
    <form id="f" novalidate>
      <div class="yn"><button type="button" class="yb ${att?'on':''}" data-a="1">${T().yes}</button><button type="button" class="yb ${!att?'on':''}" data-a="0">${T().no}</button></div>
      ${ev.invitee_name?'':`<label class="field">${T().yourName}<input id="n" maxlength="40" autocomplete="name" value="${esc(vals.n)}" required></label>`}
      <label class="field">${T().phone}<span class="ph"><select id="pc" class="ccode" aria-label="${T().ccAria}">${ccOptions(DEF_ISO)}</select><input id="ph" type="tel" maxlength="20" autocomplete="tel-national" placeholder="${T().phonePh}" value="${esc(vals.ph)}" required></span></label>
      <label class="field">${T().email}<input id="em" type="email" maxlength="80" autocomplete="email" placeholder="you@example.com" value="${esc(vals.em)}" required></label>
      <div id="more" ${att?'':'hidden'}>
        ${ev.ask_meal!==false?`<label class="field">${T().yourMeal}<select id="m">${MEALS.map(x=>`<option${x===vals.m?' selected':''}>${x}</option>`).join('')}</select></label>`:''}
        <div class="two">
          <label class="field">${T().adults}<div class="stepper"><button type="button" id="ami" aria-label="Fewer adults">-</button><b id="ac">${adults}</b><button type="button" id="apl" aria-label="More adults">+</button></div></label>
          <label class="field">${T().kids}<div class="stepper"><button type="button" id="kmi" aria-label="Fewer kids">-</button><b id="kc">${kids}</b><button type="button" id="kpl" aria-label="More kids">+</button></div></label>
        </div>
        <div id="cs"></div>
        ${fns.length?`<div class="fns"><p class="flabel">${T().fnsQ}</p>${fns.map((f,i)=>`<div class="fnrow"><span class="fnname">${esc(f.name)}${f.date?` <small>${dL(f.date)}</small>`:''}</span><span class="fnt"><button type="button" class="fnb ${fnAns[f.name]!==false?'on':''}" data-fi="${i}" data-v="1">${T().fnYes}</button><button type="button" class="fnb ${fnAns[f.name]===false?'on':''}" data-fi="${i}" data-v="0">${T().fnNo}</button></span></div>`).join('')}</div>`:''}
        ${ev.ask_arrival!==false?`<label class="field">${T().arrival} <b id="tv" class="tvl">${tL(arrival)}</b><input id="tr" type="range" min="0" max="1425" step="15" value="${arrival}" class="range" aria-label="${T().arrival}"></label>`:''}
      </div>
      ${ev.ask_note!==false?`<label class="field">${T().note}<input id="nt" maxlength="120" placeholder="${T().notePh}" value="${esc(vals.nt)}"></label>`:''}
      <div class="msg" id="msg" hidden></div>
      <button class="btn full" id="sb">${ev.answered?T().update:T().send}</button>
      ${edit&&ev.answered?`<button class="btn btn-ghost full" type="button" id="dl">${T().delAnswer}</button>`:''}
    </form></div>`;
    bindLang(()=>{grab();draw()});
    $$('.yb').forEach(b=>b.onclick=()=>{att=b.dataset.a==='1';$$('.yb').forEach(x=>x.classList.toggle('on',x===b));$('#more').hidden=!att});
    $$('.fnb').forEach(b=>b.onclick=()=>{const nm=fns[+b.dataset.fi].name;fnAns[nm]=b.dataset.v==='1';$$(`[data-fi="${b.dataset.fi}"]`).forEach(x=>x.classList.toggle('on',x===b))});
    bindPhone($('#ph'),$('#pc'));
    const cs=()=>{comps.length=party()-1;$('#cs').innerHTML=Array.from({length:party()-1},(_,i)=>{comps[i]=comps[i]||{n:'',m:'Veg'};const kid=i>=adults-1;return `<div class="comp"><label class="field">${T().guestN(i+2)} <span class="ctag">${kid?T().kid:T().adult}</span><input data-ci="${i}" maxlength="40" value="${esc(comps[i].n)}"></label>${ev.ask_meal!==false?`<label class="field">${T().meal}<select data-cm="${i}">${MEALS.map(x=>`<option${x===comps[i].m?' selected':''}>${x}</option>`).join('')}</select></label>`:''}</div>`}).join('');
      $$('[data-ci]').forEach(i=>i.oninput=()=>comps[i.dataset.ci].n=i.value);$$('[data-cm]').forEach(i=>i.onchange=()=>comps[i.dataset.cm].m=i.value)};
    cs();
    const fix=()=>{if(kids>ev.max-adults)kids=Math.max(0,ev.max-adults);$('#ac').textContent=adults;$('#kc').textContent=kids;cs()};
    $('#ami').onclick=()=>{if(adults>1){adults--;fix()}};
    $('#apl').onclick=()=>{if(party()<ev.max){adults++;fix()}};
    $('#kmi').onclick=()=>{if(kids>0){kids--;fix()}};
    $('#kpl').onclick=()=>{if(party()<ev.max){kids++;fix()}};
    const tr=$('#tr');if(tr)tr.oninput=e=>{arrival=+e.target.value;$('#tv').textContent=tL(arrival)};
    const dl=$('#dl');if(dl)dl.onclick=async()=>{if(!await confirmBox({title:T().delTitle,body:T().delBody,ok:T().delOk,word:'',danger:true}))return;
      try{await rpc('delete_my_rsvp',{p_event:eid,p_edit:edit});edit='';history.replaceState(null,'',`?e=${eid}`);ev.answered=false;ev.my_attending=null;ev.my_comp=[];ev.my_note='';att=true;adults=1;kids=0;comps=[];vals={n:'',ph:'',em:'',nt:'',m:'Veg'};
        root.innerHTML=`<div class="card reveal in center">${langSw()}<div class="tick">&#10003;</div><h2>${T().deletedH}</h2><p class="muted">${T().deletedP}</p><button class="btn full" id="ag">${T().again}</button></div>`;
        bindLang(()=>{$('#ag')?($('#ag').onclick=draw):draw()});$('#ag').onclick=draw}
      catch(err){const m=$('#msg');m.hidden=false;m.textContent=err.message}};
    $('#f').onsubmit=async e=>{e.preventDefault();const m=$('#msg'),b=$('#sb');m.hidden=true;
      const name=ev.invitee_name||($('#n')&&$('#n').value.trim());if(!name){m.hidden=false;m.textContent=T().errName;return}
      let phone=null,email=null;const phRaw=$('#ph')?$('#ph').value.trim():'';
      if(!phRaw){m.hidden=false;m.textContent=T().errPhone;return}
      {const iso=$('#pc')?$('#pc').value:'';if(!iso){m.hidden=false;m.textContent=T().errCc;return}const pp=parsePhone(phRaw,iso);if(!pp){m.hidden=false;m.textContent=T().errPhoneBad;return}phone=pp.number}
      const emRaw=$('#em')?$('#em').value.trim():'';
      if(!emRaw){m.hidden=false;m.textContent=T().errEmail;return}
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emRaw)){m.hidden=false;m.textContent=T().errEmailBad;return}email=emRaw
      b.disabled=true;b.textContent=T().sending;
      try{const nt=$('#nt');const note=nt?(nt.value.trim()||null):null;const r=await rpc('submit_rsvp',{p_event:eid,p_token:tok||null,p_name:name,p_attending:att,p_grp:null,p_meal:att&&ev.ask_meal!==false?$('#m').value:null,p_party:att?party():0,p_arrival:att&&ev.ask_arrival!==false?arrival:null,p_comp:att?comps.map((c,i)=>({n:(c.n||'Guest').slice(0,40),m:ev.ask_meal!==false?c.m:null,k:i<adults-1?'a':'k'})):[],p_note:note,p_phone:phone,p_email:email,p_adults:att?adults:0,p_kids:att?kids:0,p_edit:edit||null,p_functions:att&&fns.length?fnAns:null});
        const keep=tok?`${location.origin}/rsvp?e=${eid}&t=${tok}`:`${location.origin}/rsvp?e=${eid}&r=${r.edit}`;
        root.innerHTML=`<div class="card reveal in center rsvpdone">${langSw()}<div class="tick">&#10003;</div><h2>${att?T().seeYou:T().thanksNo}</h2><p class="muted">${att?T().downFor(party(),adults,kids)+(ev.ask_arrival!==false?T().around(tL(arrival)):'.'):T().told}</p>
        <p class="addcal">${T().addCal}</p>
        <div class="calrow"><a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="${gcalUrl()}">${T().gcal}</a><button class="btn btn-ghost btn-sm" id="ics">${T().ics}</button></div>
        <div class="savebox"><p class="saveline"><b>${T().saveLine}</b><br>${T().saveHint}</p>
        <div class="linkbox"><input readonly value="${keep}"><button class="btn btn-sm" id="cp">${T().copyLink}</button></div></div>
        <button class="btn btn-ghost" id="ch">${T().change}</button></div>`;
        bindLang(draw);
        if(att&&ev.ask_meal!==false)ev.my_meal=$('#m').value;ev.my_attending=att;ev.my_adults=adults;ev.my_kids=kids;ev.my_arrival=arrival;ev.my_comp=comps.map((c,i)=>({n:c.n,m:c.m,k:i<adults-1?'a':'k'}));ev.my_note=note;ev.answered=true;ev.my_functions=fnAns;
        if(r.edit){edit=r.edit;if(!tok)history.replaceState(null,'',`?e=${eid}&r=${r.edit}`)}
        $('#ics').onclick=dlIcs;
        $('#cp').onclick=()=>copy(keep,T().linkCopied);
        $('#ch').onclick=draw}
      catch(err){m.hidden=false;m.textContent=/closed/i.test(err.message)?T().errClosed:err.message;b.disabled=false;b.textContent=ev.answered?T().update:T().send}};
  };
  draw();
})();
