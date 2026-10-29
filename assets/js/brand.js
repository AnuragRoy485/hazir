/* Hazir brand language rotation. The "Hazir." wordmark (header + footer) and
   the footer tagline cycle continuously through English, Hindi and Bengali
   on every page. Transform/opacity only; no cycling under reduced motion. */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const WORDS = [
    { t: 'Hazir', l: 'en' },
    { t: 'हाज़िर', l: 'hi' },
    { t: 'হাজির', l: 'bn' },
  ];
  const TAGS = [
    { t: 'Know who is coming.', l: 'en' },
    { t: 'जानिए कौन आ रहा है।', l: 'hi' },
    { t: 'জেনে নিন কে আসছে।', l: 'bn' },
  ];
  const sets = [];

  function build(el, items, dot) {
    const wrap = document.createElement('span');
    wrap.className = 'rt';
    wrap.setAttribute('aria-hidden', 'true');
    items.forEach((it, i) => {
      const v = document.createElement('span');
      v.className = 'rt-v' + (i === 0 ? ' rt-in' : '');
      if (it.l !== 'en') { v.setAttribute('lang', it.l); v.classList.add('rt-nl'); }
      v.append(document.createTextNode(it.t));
      if (dot) { const d = document.createElement('span'); d.textContent = '.'; v.append(d); }
      wrap.append(v);
    });
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = items[0].t + (dot ? '.' : '');
    el.textContent = '';
    el.append(sr, wrap);
    sets.push([...wrap.children]);
  }

  document.querySelectorAll('.logo').forEach(el => {
    if (/^\s*Hazir/.test(el.textContent)) build(el, WORDS, true);
  });
  document.querySelectorAll('.foot > p').forEach(el => {
    if (el.textContent.trim() === 'Know who is coming.') build(el, TAGS, false);
  });

  if (reduce || !sets.length) return;
  const EVERY = 3400, DUR = 720, N = WORDS.length;
  let i = 0;
  setInterval(() => {
    if (document.hidden) return;
    const prev = i;
    i = (i + 1) % N;
    sets.forEach(vs => {
      const out = vs[prev], inn = vs[i];
      if (!out || !inn) return;
      out.classList.remove('rt-in');
      out.classList.add('rt-out');
      inn.classList.remove('rt-out');
      inn.classList.add('rt-in');
      setTimeout(() => {
        out.classList.add('rt-rs');       // cut transitions while resetting
        out.classList.remove('rt-out');
        requestAnimationFrame(() => requestAnimationFrame(() => out.classList.remove('rt-rs')));
      }, DUR);
    });
  }, EVERY);
})();
