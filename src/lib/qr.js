/** Loads the vendored qrcode-generator (MIT, Kazuhiko Arase) once, as a plain script. */
let ready = null;
export function loadQr() {
  if (!ready) ready = new Promise((res, rej) => {
    if (window.qrcode) return res(window.qrcode);
    const s = document.createElement('script');
    s.src = 'assets/vendor/qrcode.js';
    s.onload = () => window.qrcode ? res(window.qrcode) : rej(new Error('QR library failed to load'));
    s.onerror = () => rej(new Error('QR library failed to load'));
    document.head.appendChild(s);
  });
  return ready;
}

/** Draws the invite QR on a canvas: white card, dark modules, with the event name,
 * date/time and host around the code (never on top of it, so the pattern stays clear
 * and scannable). meta: { title, date, time, host } - missing pieces are simply left out. */
export async function drawQr(cv, link, meta = {}) {
  const qrcode = await loadQr();
  const q = qrcode(0, 'M');
  q.addData(link);
  q.make();
  const n = q.getModuleCount(), W = cv.width;
  const quiet0 = 4, cell0 = Math.floor((W - 80) / (n + quiet0 * 2));
  const x = cv.getContext('2d');
  const serif = 'Georgia, "Times New Roman", serif';
  const serifTitle = `700 34px ${serif}`, serifWhen = `400 24px ${serif}`, serifHost = `italic 400 26px ${serif}`;
  const fit = (t, font, maxW) => {
    x.font = font; t = String(t);
    if (x.measureText(t).width <= maxW) return t;
    while (t.length > 4 && x.measureText(t + '\u2026').width > maxW) t = t.slice(0, -1);
    return t.trim() + '\u2026';
  };
  // Wraps text over up to maxLines lines at the given font; only the overflow past
  // the last line is ellipsized, so full titles show instead of being cut off.
  const wrap = (t, font, maxW, maxLines) => {
    x.font = font;
    const words = String(t).split(/\s+/).filter(Boolean), lines = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (x.measureText(test).width <= maxW) cur = test;
      else { if (cur) lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    if (lines.length > maxLines) {
      const kept = lines.slice(0, maxLines);
      let last = kept[maxLines - 1];
      while (last.length > 4 && x.measureText(last.trim() + ' \u2026').width > maxW) last = last.slice(0, -1);
      kept[maxLines - 1] = last.trim() + ' \u2026';
      return kept;
    }
    return lines;
  };
  const titleLines = meta.title ? wrap(meta.title, serifTitle, W - 90, 3) : [];
  const hostLines = meta.host ? wrap('Hosted by ' + meta.host, serifHost, W - 90, 2) : [];
  const when0 = [meta.date, meta.time].filter(Boolean).join(' \u00b7 ');
  const headH = 44 + (titleLines.length ? titleLines.length * 42 + 6 : 0) + (when0 ? 38 : 0) + 8;
  const footH = (hostLines.length ? 44 + (hostLines.length - 1) * 34 : 0) + 48 + 36 + 30;
  const H = headH + cell0 * n + footH;
  cv.height = H;
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H);
  const quiet = quiet0, cell = cell0;
  const span = cell * n, off = Math.round((W - span) / 2);
  let top = 44;
  x.textAlign = 'center';
  if (titleLines.length) { x.fillStyle = '#1c1a17'; x.font = serifTitle; for (const ln of titleLines) { x.fillText(ln, W / 2, top + 18); top += 42; } top += 6; }
  if (when0) { x.fillStyle = '#8a857a'; x.fillText(fit(when0, serifWhen, W - 90), W / 2, top + 14); top += 38; }
  top += 8;
  x.fillStyle = '#1c1a17';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) x.fillRect(off + c * cell, top + r * cell, cell, cell);
  let below = top + span;
  if (hostLines.length) { x.fillStyle = '#1c1a17'; x.font = serifHost; hostLines.forEach((ln, i) => { below += i === 0 ? 44 : 34; x.fillText(ln, W / 2, below); }); }
  below += 48; x.fillStyle = '#1c1a17'; x.font = `italic 700 40px ${serif}`; x.fillText('Hazir.', W / 2, below);
  below += 36; x.font = `400 20px ${serif}`; x.fillStyle = '#8a857a'; x.fillText('Scan to RSVP', W / 2, below);
}
