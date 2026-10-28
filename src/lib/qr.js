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
  const headH = 44 + (meta.title ? 46 : 0) + ((meta.date || meta.time) ? 38 : 0) + 8;
  const footH = (meta.host ? 44 : 0) + 48 + 36 + 30;
  const H = headH + cell0 * n + footH;
  cv.height = H;
  const x = cv.getContext('2d');
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H);
  const serif = 'Georgia, "Times New Roman", serif';
  const fit = (t, font, maxW) => {
    x.font = font; t = String(t);
    if (x.measureText(t).width <= maxW) return t;
    while (t.length > 4 && x.measureText(t + '\u2026').width > maxW) t = t.slice(0, -1);
    return t.trim() + '\u2026';
  };
  const quiet = quiet0, cell = cell0;
  const span = cell * n, off = Math.round((W - span) / 2);
  let top = 44;
  x.textAlign = 'center';
  if (meta.title) { x.fillStyle = '#1c1a17'; x.fillText(fit(meta.title, `700 34px ${serif}`, W - 90), W / 2, top + 18); top += 46; }
  const when = [meta.date, meta.time].filter(Boolean).join(' \u00b7 ');
  if (when) { x.fillStyle = '#8a857a'; x.fillText(fit(when, `400 24px ${serif}`, W - 90), W / 2, top + 14); top += 38; }
  top += 8;
  x.fillStyle = '#1c1a17';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) x.fillRect(off + c * cell, top + r * cell, cell, cell);
  let below = top + span;
  if (meta.host) { below += 44; x.fillStyle = '#1c1a17'; x.fillText(fit('Hosted by ' + meta.host, `italic 400 26px ${serif}`, W - 90), W / 2, below); }
  below += 48; x.fillStyle = '#1c1a17'; x.font = `italic 700 40px ${serif}`; x.fillText('Hazir.', W / 2, below);
  below += 36; x.font = `400 20px ${serif}`; x.fillStyle = '#8a857a'; x.fillText('Scan to RSVP', W / 2, below);
}
