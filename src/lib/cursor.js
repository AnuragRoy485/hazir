// Homepage-style cursor ring on every page. Mouse only - hidden on touch devices
// by the existing @media (hover:none) rule in site.css. The OS cursor stays visible.
const cur = document.createElement('div');
cur.className = 'cursor';
cur.setAttribute('aria-hidden', 'true');
document.body.appendChild(cur);
addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; cur.style.transform = `translate(${e.clientX - 17}px, ${e.clientY - 17}px)`; });
document.addEventListener('pointerover', e => { cur.classList.toggle('big', !!e.target.closest('a,button,.chip,.tile,.clock,input,select,textarea,[role=button]')); });
