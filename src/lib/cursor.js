// Homepage-style cursor ring on every page. Mouse only - hidden on touch devices
// by the existing @media (hover:none) rule in site.css. The OS cursor stays visible.
const cur = document.createElement('div');
cur.className = 'cursor';
cur.setAttribute('aria-hidden', 'true');
document.body.appendChild(cur);
cur.style.willChange = 'transform';
addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; cur.style.transform = `translate3d(${e.clientX - 17}px, ${e.clientY - 17}px, 0)`; });
document.addEventListener('pointerover', e => { cur.classList.toggle('big', !!e.target.closest('a,button,.chip,.tile,.clock,input,select,textarea,[role=button]')); });
