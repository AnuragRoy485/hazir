import { API_URL, PUBLISHABLE_KEY } from './config.js';
import { getToken } from './session.js';

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

/** Uploads the original banner plus its watermarked preview copy; returns { banner, banner_og } URLs. */
export async function uploadBanner(eventId, file) {
  const ext = EXT[file.type] || 'jpg';
  const banner = await put(`${eventId}/banner.${ext}`, file, file.type);
  const banner_og = await put(`${eventId}/og.jpg`, await makePreview(file), 'image/jpeg');
  return { banner, banner_og };
}

/** Best-effort cleanup of a replaced or removed banner. Call before deleting the event row. */
export async function deleteBanner(eventId, banner, banner_og) {
  const m = /\.(\w+)(?:\?|$)/.exec(banner || '');
  if (m) await remove(`${eventId}/banner.${m[1]}`);
  if (banner_og) await remove(`${eventId}/og.jpg`);
}
