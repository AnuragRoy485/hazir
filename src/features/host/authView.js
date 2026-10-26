import { auth } from '../../lib/auth.js';
import { $, $$ } from '../../lib/ui.js';
import { esc } from '../../lib/format.js';
import { view, busy, niceErr, navr } from './ctx.js';
import { R } from './ctx.js';

export function authView(mode,msg){
  navr.innerHTML='<a class="btn btn-ghost btn-sm" href="index.html">Home</a>';
  const t={login:['Welcome back.','Log in to your events.'],signup:['Start hosting.','Create your free host account.']}[mode];
  view(`<section class="authwrap"><div class="card authcard reveal in">
    <p class="eyebrow">${mode==='signup'?'Sign up':mode==='login'?'Log in':'Account'}</p><h2>${t[0]}</h2><p class="muted">${t[1]}</p>
    <div class="msg" id="msg" ${msg?'':'hidden'}>${esc(msg||'')}</div>
    <form id="af" novalidate>
      ${mode==='signup'?'<label class="field">Your name<input id="an" maxlength="40" autocomplete="name" placeholder="Riya Sharma"></label>':''}
      ${'<label class="field">Email<input id="ae" type="email" autocomplete="email" placeholder="you@example.com" required></label>'}
      ${`<label class="field">Password<input id="ap" type="password" autocomplete="${mode==='login'?'current-password':'new-password'}" minlength="8" placeholder="At least 8 characters" required></label>`}
      <button class="btn full" id="ab">${{login:'Log in',signup:'Create account'}[mode]}</button>
    </form>
    <p class="fine authlinks">${mode==='login'?'New here? <a href="#" data-m="signup" class="link2">Create an account</a>':mode==='signup'?'Already hosting? <a href="#" data-m="login" class="link2">Log in</a>':''}</p>
  </div></section>`);
  $$('[data-m]').forEach(a=>a.onclick=e=>{e.preventDefault();authView(a.dataset.m)});
  const show=(m,ok)=>{const x=$('#msg');x.hidden=false;x.className='msg'+(ok?' ok':'');x.textContent=m};
  $('#af').onsubmit=async e=>{e.preventDefault();const b=$('#ab');
    const em=$('#ae').value.trim(),pw=$('#ap').value;
    if(!/^\S+@\S+\.\S+$/.test(em))return show('Enter a valid email address.');
    if(pw.length<8)return show('Password needs at least 8 characters.');
    busy(b,1);
    try{
      if(mode==='login'){await auth.signIn(em,pw);await auth.loadUser();R.boot()}
      else if(mode==='signup'){const r=await auth.signUp(em,pw,$('#an').value.trim());
        if(r.session){await auth.loadUser();R.boot()}else{show('Account created. Please log in.',1);authView('login','Account created. Log in to continue.')}}
    }catch(err){show(niceErr(err))}finally{busy(b,0)}};
}


R.authView = authView;
