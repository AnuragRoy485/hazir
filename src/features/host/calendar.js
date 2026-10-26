// Month calendar of the host's events. Days with events carry a marker; hover, keyboard focus or tap shows details.
import { $, $$ } from '../../lib/ui.js';
import { esc, fmtDate, fmtTime, isClosed } from '../../lib/format.js';
import { R } from './ctx.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const cal = { y: new Date().getFullYear(), m: new Date().getMonth(), sel: '' };

export function calendar(box, events, by) {
  const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const today = iso(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  const draw = () => {
    const first = new Date(cal.y, cal.m, 1), lead = (first.getDay() + 6) % 7, dim = new Date(cal.y, cal.m + 1, 0).getDate();
    const on = {}; events.forEach(e => (on[e.event_date] = on[e.event_date] || []).push(e));
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push('<div class="cd off"></div>');
    for (let d = 1; d <= dim; d++) {
      const k = iso(cal.y, cal.m, d), list = on[k] || [], col = (lead + d - 1) % 7;
      const tip = list.length ? `<div class="ctip ${col > 3 ? 'r' : 'l'}" role="tooltip">${list.map(e => { const s = by[e.id] || { h: 0, n: 0 }; return `<div class="ti"><b>${esc(e.title)}</b><span>${esc(e.occasion)} &middot; ${fmtTime(e.default_time)}${e.venue ? ' &middot; ' + esc(e.venue) : ''}</span><span>${s.h} coming &middot; ${s.n} of ${e.invited} answered${isClosed(e) ? ' &middot; RSVPs closed' : ''}</span></div>`; }).join('')}</div>` : '';
      cells.push(`<div class="cd${k === today ? ' today' : ''}${list.length ? ' has' : ''}${cal.sel === k ? ' sel' : ''}"><button class="cb" data-k="${k}" aria-label="${fmtDate(k)}${list.length ? ', ' + list.length + ' event' + (list.length > 1 ? 's' : '') : ''}"><span>${d}</span>${list.length ? `<i>${list.length > 1 ? list.length : ''}</i>` : ''}</button>${tip}</div>`);
    }
    box.innerHTML = `<div class="card calc reveal in"><div class="chead"><button class="mini" id="cp" aria-label="Previous month">&larr;</button><h3>${MONTHS[cal.m]} ${cal.y}</h3><button class="mini" id="cn" aria-label="Next month">&rarr;</button><button class="mini" id="ct">Today</button></div>
      <div class="cgrid cdow">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(x => `<small>${x}</small>`).join('')}</div><div class="cgrid">${cells.join('')}</div>
      <div class="cday" id="cday"></div></div>`;
    const day = k => { const l = on[k] || []; $('#cday').innerHTML = l.length ? `<h4>${fmtDate(k)}</h4>` + l.map(e => `<button class="crow" data-id="${e.id}"><b>${esc(e.title)}</b><span>${esc(e.occasion)} &middot; ${(by[e.id] || { h: 0 }).h} coming</span></button>`).join('') : (k ? `<p class="fine">Nothing planned on ${fmtDate(k)}.</p>` : `<p class="fine">Tap a marked day to see its events.</p>`); $$('.crow', box).forEach(b => b.onclick = () => R.openEvent(b.dataset.id)); };
    day(cal.sel);
    $$('.cb', box).forEach(b => b.onclick = () => { cal.sel = b.dataset.k; $$('.cd.sel', box).forEach(x => x.classList.remove('sel')); b.parentElement.classList.add('sel'); day(cal.sel); });
    const step = n => { cal.m += n; if (cal.m < 0) { cal.m = 11; cal.y--; } if (cal.m > 11) { cal.m = 0; cal.y++; } cal.sel = ''; draw(); };
    $('#cp').onclick = () => step(-1); $('#cn').onclick = () => step(1);
    $('#ct').onclick = () => { const n = new Date(); cal.y = n.getFullYear(); cal.m = n.getMonth(); cal.sel = ''; draw(); };
  };
  draw();
}
