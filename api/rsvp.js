// Guest invite page with per-event social preview tags. WhatsApp, Facebook and other
// link-preview crawlers do not run JavaScript, so Open Graph tags are rendered here on
// the server. The page body is the same rsvp.html as before, served unchanged.
import { readFileSync } from 'node:fs';

const API = 'https://etzbrtiunqfjyjczsjhe.supabase.co';
const KEY = 'sb_publishable_CNjSxz8seM6yOgyjzkIZWQ_0DaTgOEW'; // public by design; the locked function decides what it returns

let cache = null;
async function page(req) {
  if (cache) return cache;
  try { cache = readFileSync(new URL('../rsvp.html', import.meta.url), 'utf8'); }
  catch { const r = await fetch('https://' + req.headers.host + '/rsvp.html'); cache = await r.text(); }
  return cache;
}
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = d => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || ''); return m ? `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}` : ''; };

export default async function handler(req, res) {
  const html = await page(req);
  const send = body => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    res.status(200).send(body);
  };
  try {
    const q = new URL(req.url, 'https://hazir.local').searchParams;
    const e = q.get('e') || '', t = q.get('t') || '';
    let ev = null;
    if (/^[0-9a-f]{6,20}$/.test(e)) {
      const r = await fetch(API + '/rest/v1/rpc/get_invite', {
        method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_event: e, p_token: t || null }),
      });
      if (r.ok) ev = await r.json();
    }
    if (!ev) return send(html);
    const desc = [fmtDate(ev.date), ev.host && 'Hosted by ' + ev.host, ev.venue, 'RSVP on Hazir'].filter(Boolean).join(' · ');
    const tags = [
      '<meta property="og:type" content="website">',
      '<meta property="og:site_name" content="Hazir">',
      `<meta property="og:title" content="${esc(ev.title)}">`,
      `<meta property="og:description" content="${esc(desc)}">`,
      ev.banner_og ? `<meta property="og:image" content="${esc(ev.banner_og)}">` : '',
      ev.banner_og ? '<meta property="og:image:width" content="1200">' : '',
      ev.banner_og ? '<meta property="og:image:height" content="630">' : '',
      `<meta name="twitter:card" content="${ev.banner_og ? 'summary_large_image' : 'summary'}">`,
      `<meta name="twitter:title" content="${esc(ev.title)}">`,
      `<meta name="twitter:description" content="${esc(desc)}">`,
      ev.banner_og ? `<meta name="twitter:image" content="${esc(ev.banner_og)}">` : '',
    ].filter(Boolean).join('\n');
    return send(html.replace('</head>', tags + '\n</head>'));
  } catch {
    return send(html);
  }
}
