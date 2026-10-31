// Themed dropdowns on every page. Each native <select> keeps holding the value
// (existing form code reads select.value and 'change' untouched) but is visually
// replaced by a Georgia listbox in the site theme: black highlight on the active
// option, matching the cursor hover. Keyboard: Enter/Space/arrows open and move,
// Enter picks, Esc closes, type-ahead jumps.
const seen = new WeakSet();
let openWrap = null;

function enhance(sel) {
  if (seen.has(sel) || sel.multiple || sel.size > 1) return;
  seen.add(sel);

  const wrap = document.createElement('div');
  wrap.className = 'dd';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'dd-btn';
  btn.setAttribute('aria-haspopup', 'listbox');
  btn.setAttribute('aria-expanded', 'false');
  let name = sel.getAttribute('aria-label') || '';
  const lab = sel.closest('label');
  if (!name && lab) {
    const c = lab.cloneNode(true);
    c.querySelectorAll('select,input,button,textarea,.dd').forEach(x => x.remove());
    name = c.textContent.trim();
  }
  btn.setAttribute('aria-label', name || sel.name || 'Choose');

  const val = document.createElement('span');
  val.className = 'dd-val';
  const arrow = document.createElement('span');
  arrow.className = 'dd-arrow';
  arrow.setAttribute('aria-hidden', 'true');
  btn.append(val, arrow);

  const list = document.createElement('ul');
  list.className = 'dd-list';
  list.setAttribute('role', 'listbox');
  list.hidden = true;

  sel.classList.add('dd-src');
  sel.setAttribute('aria-hidden', 'true');
  sel.tabIndex = -1;
  sel.after(wrap);
  wrap.append(btn, list);

  let cur = -1, lastSig = null, buf = '', bufT = 0;
  const items = () => [...list.children];
  const sig = () => [...sel.options].map(o => o.value + '|' + o.text).join('~');

  const sync = () => {
    const o = sel.options[sel.selectedIndex];
    val.textContent = o ? o.text : '';
    items().forEach((li, i) => li.setAttribute('aria-selected', String(i === sel.selectedIndex)));
  };

  const rebuild = () => {
    const s = sig();
    if (s === lastSig) return;
    lastSig = s;
    list.innerHTML = '';
    [...sel.options].forEach(o => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.textContent = o.text;
      if (o.disabled) li.setAttribute('aria-disabled', 'true');
      list.append(li);
    });
    sync();
  };

  const setCur = i => {
    const it = items();
    if (!it.length) return;
    const n = it.length;
    let j = ((i % n) + n) % n, guard = 0;
    while (it[j].getAttribute('aria-disabled') === 'true' && guard++ < n) j = (j + 1) % n;
    cur = j;
    it.forEach((li, k) => li.classList.toggle('cur', k === cur));
    it[cur].scrollIntoView({ block: 'nearest' });
  };

  const close = focus => {
    if (list.hidden) return;
    list.hidden = true;
    wrap.classList.remove('open', 'up');
    btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', onDoc, true);
    if (openWrap === wrap) openWrap = null;
    if (focus) btn.focus();
  };
  wrap._ddClose = close;

  const open = () => {
    if (!list.hidden) return;
    if (openWrap && openWrap !== wrap) openWrap._ddClose();
    rebuild();
    list.hidden = false;
    wrap.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    setCur(sel.selectedIndex >= 0 ? sel.selectedIndex : 0);
    const r = list.getBoundingClientRect();
    if (r.bottom > innerHeight - 8 && btn.getBoundingClientRect().top > r.height + 16) wrap.classList.add('up');
    document.addEventListener('pointerdown', onDoc, true);
    openWrap = wrap;
  };

  const pick = i => {
    const o = sel.options[i];
    if (!o || o.disabled) return;
    if (sel.selectedIndex !== i) {
      sel.selectedIndex = i;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
    sync();
    close(true);
  };

  const onDoc = e => { if (!wrap.contains(e.target)) close(false); };

  btn.addEventListener('click', () => (list.hidden ? open() : close(false)));
  list.addEventListener('pointermove', e => {
    const li = e.target.closest('li');
    if (li) { const i = items().indexOf(li); if (i >= 0 && i !== cur) setCur(i); }
  });
  list.addEventListener('click', e => {
    const li = e.target.closest('li');
    if (li) pick(items().indexOf(li));
  });

  wrap.addEventListener('keydown', e => {
    const k = e.key;
    if (list.hidden) {
      if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Enter' || k === ' ') { e.preventDefault(); open(); }
      return;
    }
    if (k === 'ArrowDown') { e.preventDefault(); setCur(cur + 1); }
    else if (k === 'ArrowUp') { e.preventDefault(); setCur(cur - 1); }
    else if (k === 'Home') { e.preventDefault(); setCur(0); }
    else if (k === 'End') { e.preventDefault(); setCur(items().length - 1); }
    else if (k === 'Enter' || k === ' ') { e.preventDefault(); pick(cur); }
    else if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
    else if (k === 'Tab') close(false);
    else if (k.length === 1 && /\S/.test(k)) {
      const now = Date.now();
      buf = now - bufT > 700 ? k : buf + k;
      bufT = now;
      const i = [...sel.options].findIndex(o => !o.disabled && o.text.trim().toLowerCase().startsWith(buf.toLowerCase()));
      if (i >= 0) setCur(i);
    }
  });

  sel.addEventListener('change', sync);
  rebuild();
}

const scan = root => {
  if (root.nodeType !== 1) return;
  if (root.matches && root.matches('select')) enhance(root);
  if (root.querySelectorAll) root.querySelectorAll('select').forEach(enhance);
};
scan(document.documentElement);
new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(scan)))
  .observe(document.body, { subtree: true, childList: true });
