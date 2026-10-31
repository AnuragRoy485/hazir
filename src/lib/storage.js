import { API_URL, PUBLISHABLE_KEY } from './config.js?v=20261101-5';
import { getToken } from './session.js?v=20261101-5';

const BUCKET = 'banners';
export const BANNER_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const BANNER_MAX = 5 * 1024 * 1024;
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

async function put(path, blob, type) {
  const token = await getToken();
  const res = await fetch(`${API_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: { apikey: PUBLISHABLE_KEY, Authorization: 'Bearer ' + token, 'Content-Type': type, 'x-upsert': 'true' },
    body: blob,
  });
  if (!res.ok) {
    let msg = 'Image upload failed (' + res.status + ')';
    try { const j = await res.json(); msg = j.message || j.error || msg; } catch { /* keep generic message */ }
    throw new Error(msg);
  }
  return `${API_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

async function remove(path) {
  try {
    const token = await getToken();
    await fetch(`${API_URL}/storage/v1/object/${BUCKET}/${path}`, { method: 'DELETE', headers: { apikey: PUBLISHABLE_KEY, Authorization: 'Bearer ' + token } });
  } catch { /* best-effort cleanup */ }
}

/** Watermarked 1200x630 JPEG used as the link-preview image. The original upload is never altered. */
async function makePreview(file) {
  const img = await createImageBitmap(file);
  const W = 1200, H = 630, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const s = Math.max(W / img.width, H / img.height), w = img.width * s, h = img.height * s;
  x.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  const word = 'Hazir.';
  x.font = 'italic 700 44px Georgia, "Times New Roman", serif';
  x.save();
  x.shadowColor = 'rgba(0,0,0,.65)'; x.shadowBlur = 14; x.shadowOffsetY = 2;
  x.fillStyle = '#fff';
  x.fillText(word, W - 36 - x.measureText(word).width, H - 30);
  x.restore();
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.86));
  if (!blob) throw new Error('Could not prepare the preview image.');
  return blob;
}


/** Branded 1200x630 card drawn when the host has no banner of their own, so shared links
 * still get a Hazir preview with the event name, date and time. Everything sits inside
 * the central 630px square so chat apps that crop previews to a square thumbnail keep
 * the full title, date and host readable. */
async function makeDefaultCard({ title, when, host }) {
  const W = 1200, H = 630, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = '#f7f4ee'; x.fillRect(0, 0, W, H);
  x.strokeStyle = '#e3ddd2'; x.lineWidth = 3; x.strokeRect(30, 30, W - 60, H - 60);
  x.textAlign = 'center';
  const CX = W / 2, SAFE = 560;
  x.fillStyle = '#1c1a17';
  x.font = 'italic 700 46px Georgia, "Times New Roman", serif';
  x.fillText('Hazir.', CX, 112);
  const words = String(title || 'You are invited').split(/\s+/);
  const wrapFull = () => { const L = ['']; for (const w of words) { const i = L.length - 1; const t = L[i] ? L[i] + ' ' + w : w; if (x.measureText(t).width > SAFE && L[i]) L.push(w); else L[i] = t; } return L; };
  let size = 80, lines = [];
  for (; size >= 40; size -= 4) { x.font = `700 ${size}px Georgia, "Times New Roman", serif`; const L = wrapFull(); if (L.length <= 3 && L.every(l => x.measureText(l).width <= SAFE)) { lines = L; break; } }
  if (!lines.length) { x.font = '700 40px Georgia, "Times New Roman", serif'; const all = wrapFull(); lines = all.slice(0, 3); if (all.length > 3) lines[2] = lines[2] + ' …'; }
  const lh = size + 12;
  x.fillStyle = '#5c5648';
  let ws = 38; x.font = `400 ${ws}px Georgia, "Times New Roman", serif`;
  while (x.measureText(when).width > SAFE && ws > 26) { ws -= 2; x.font = `400 ${ws}px Georgia, "Times New Roman", serif`; }
  let hs = 32; const hostLine = host ? 'Hosted by ' + host : '';
  x.font = `400 ${hs}px Georgia, "Times New Roman", serif`;
  while (x.measureText(hostLine).width > SAFE && hs > 24) { hs -= 2; x.font = `400 ${hs}px Georgia, "Times New Roman", serif`; }
  const tagY = H - 56, hostY = tagY - hs - 18, whenY = hostY - ws - 14;
  const titleBottomMax = whenY - ws - 14;
  let y0 = Math.min(H / 2 - ((lines.length - 1) * lh) / 2 + 14, titleBottomMax - (lines.length - 1) * lh);
  x.fillStyle = '#1c1a17'; x.font = `700 ${size}px Georgia, "Times New Roman", serif`;
  lines.forEach((l, i) => x.fillText(l, CX, y0 + i * lh));
  x.fillStyle = '#5c5648'; x.font = `400 ${ws}px Georgia, "Times New Roman", serif`;
  if (when) x.fillText(when, CX, whenY);
  x.font = `400 ${hs}px Georgia, "Times New Roman", serif`;
  if (hostLine) x.fillText(hostLine, CX, hostY);
  x.font = 'italic 400 30px Georgia, "Times New Roman", serif';
  x.fillText('RSVP with one tap', CX, tagY);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.88));
  if (!blob) throw new Error('Could not prepare the preview image.');
  return blob;
}

/** Uploads only the branded preview card ({ banner_og }) for an event without a custom banner. */
export async function uploadFallbackOg(eventId, details) {
  const banner_og = await put(`${eventId}/og.jpg`, await makeDefaultCard(details), 'image/jpeg');
  return { banner_og };
}

/** Uploads the original banner plus its watermarked preview copy; returns { banner, banner_og } URLs. */
export async function uploadBanner(eventId, file) {
  const ext = EXT[file.type] || 'jpg';
  const banner = await put(`${eventId}/banner.${ext}`, file, file.type);
  const banner_og = await put(`${eventId}/og.jpg`, await makePreview(file), 'image/jpeg');
  return { banner, banner_og };
}

/** Best-effort cleanup of a replaced or removed banner's ORIGINAL file. Never deletes the
 * og.jpg preview: after a replace or remove, og.jpg was just rewritten and must stay.
 * Used after uploadBanner/uploadFallbackOg succeed. */
export async function cleanupOldBanner(eventId, oldBanner, newBanner) {
  const base = u => { const m = /\/banners\/[^/]+\/([^/?]+)/.exec(u || ''); return m ? m[1] : null; };
  const oldPath = base(oldBanner), newPath = base(newBanner);
  if (oldPath && oldPath !== newPath) await remove(`${eventId}/${oldPath}`);
}

/** Best-effort cleanup of a replaced or removed banner. Call before deleting the event row. */
export async function deleteBanner(eventId, banner, banner_og) {
  const m = /\.(\w+)(?:\?|$)/.exec(banner || '');
  if (m) await remove(`${eventId}/banner.${m[1]}`);
  if (banner_og) await remove(`${eventId}/og.jpg`);
}
