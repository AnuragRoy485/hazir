export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

let toastTimer;
export function toast(message, bad) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = message; t.className = 'show' + (bad ? ' bad' : '');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.className = ''; }, 3600);
}
export async function copy(text, message) {
  try { await navigator.clipboard.writeText(text); }
  catch { const a = document.createElement('textarea'); a.value = text; document.body.appendChild(a); a.select(); document.execCommand('copy'); a.remove(); }
  toast(message || 'Copied');
}
/** Animates a number from its last shown value to a new one. */
export function countTo(el, to, dur = 700) {
  const from = +el.dataset.v || 0; el.dataset.v = to;
  if (from === to) { el.textContent = to; return; }
  const t0 = performance.now();
  (function step(t) {
    const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(from + (to - from) * e);
    if (p < 1) requestAnimationFrame(step);
  })(t0);
}
/** Scroll reveals, progress bar, hiding nav and button ripples. Also picks up content added later. */
export function initEffects() {
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12 });
  const scan = () => $$('.reveal:not(.in)').forEach(x => io.observe(x));
  scan(); new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  let last = 0; const bar = $('#progress'), nav = $('#nav');
  addEventListener('scroll', () => {
    const y = scrollY, h = document.documentElement.scrollHeight - innerHeight;
    if (bar) bar.style.width = (h > 0 ? y / h * 100 : 0) + '%';
    if (nav) { nav.classList.toggle('scrolled', y > 10); nav.classList.toggle('hide', y > last && y > 400); }
    last = y;
  }, { passive: true });
  document.addEventListener('pointerdown', e => {
    const b = e.target.closest('.btn,.chip,.tab'); if (!b) return;
    const r = b.getBoundingClientRect(), s = document.createElement('i');
    s.className = 'ripple'; s.style.left = (e.clientX - r.left) + 'px'; s.style.top = (e.clientY - r.top) + 'px';
    b.appendChild(s); setTimeout(() => s.remove(), 650);
  });
}

/** Theme-matched confirmation dialog. Resolves true or false. Pass `word` to require typing it to enable the button. */
export function confirmBox({ title, body, ok = 'Confirm', word = '', danger = false }) {
  return new Promise(res => {
    const prev = document.activeElement;
    const w = document.createElement('div'); w.className = 'modal-wrap';
    w.innerHTML = `<div class="dlg-bg"></div><div class="dlg${danger ? ' danger' : ''}" role="alertdialog" aria-modal="true" aria-labelledby="mt" aria-describedby="mb"><h3 id="mt"></h3><p class="muted" id="mb"></p>
      ${word ? `<label class="field">Type <b class="kw"></b> to confirm<input id="mw" autocomplete="off" autocapitalize="off" spellcheck="false"></label>` : ''}
      <div class="row end"><button class="btn btn-ghost btn-sm" id="mc">Cancel</button><button class="btn btn-sm" id="mo"></button></div></div>`;
    w.querySelector('#mt').textContent = title; w.querySelector('#mb').textContent = body; w.querySelector('#mo').textContent = ok;
    const kw = w.querySelector('.kw'); if (kw) kw.textContent = word;
    document.body.appendChild(w); document.body.classList.add('noscroll');
    const okb = w.querySelector('#mo'), inp = w.querySelector('#mw');
    if (word) okb.disabled = true;
    requestAnimationFrame(() => w.classList.add('in')); (inp || okb).focus();
    const done = v => { w.classList.remove('in'); document.body.classList.remove('noscroll'); removeEventListener('keydown', key, true); setTimeout(() => w.remove(), 250); if (prev && prev.focus) prev.focus(); res(v); };
    const key = e => {
      if (e.key === 'Escape') { e.preventDefault(); done(false); }
      else if (e.key === 'Enter' && !okb.disabled && document.activeElement !== w.querySelector('#mc')) { e.preventDefault(); done(true); }
      else if (e.key === 'Tab') { const f = [...w.querySelectorAll('input,button:not(:disabled)')]; const i = f.indexOf(document.activeElement); e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus(); }
    };
    addEventListener('keydown', key, true);
    if (inp) inp.oninput = () => { okb.disabled = inp.value.trim().toLowerCase() !== word.toLowerCase(); };
    okb.onclick = () => done(true); w.querySelector('#mc').onclick = () => done(false); w.querySelector('.dlg-bg').onclick = () => done(false);
  });
}
