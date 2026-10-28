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

/** Draws the invite QR on a canvas: white card, dark modules, "Hazir." caption below the
 * code (never on top of it, so the pattern stays clear). */
export async function drawQr(cv, link) {
  const qrcode = await loadQr();
  const q = qrcode(0, 'M');
  q.addData(link);
  q.make();
  const n = q.getModuleCount(), W = cv.width, H = cv.height;
  const x = cv.getContext('2d');
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H);
  const quiet = 4, cell = Math.floor(Math.min(W - 80, H - 170) / (n + quiet * 2));
  const span = cell * n, off = Math.round((W - span) / 2), top = 44;
  x.fillStyle = '#1c1a17';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) x.fillRect(off + c * cell, top + r * cell, cell, cell);
  x.textAlign = 'center';
  x.font = 'italic 700 46px Georgia, "Times New Roman", serif';
  x.fillText('Hazir.', W / 2, top + span + 70);
  x.font = '400 22px Georgia, "Times New Roman", serif';
  x.fillStyle = '#8a857a';
  x.fillText('Scan to RSVP', W / 2, top + span + 108);
}
