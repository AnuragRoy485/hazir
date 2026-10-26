// End-to-end check of the shared backend, run against a real browser and the real project:
//   node tests/e2e.mjs            (serves the repo on a local port, or set BASE_URL to test a deployment)
// Proves: host signup, event creation, guest RSVP from a separate session, live dashboard,
// and that another host and anonymous visitors cannot read someone else's guests.
// Needs: puppeteer-core and a Chrome binary (CHROME_PATH, default /usr/bin/google-chrome).
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const API = 'https://etzbrtiunqfjyjczsjhe.supabase.co';
const KEY = 'sb_publishable_CNjSxz8seM6yOgyjzkIZWQ_0DaTgOEW';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
let server, base = process.env.BASE_URL;
if (!base) {
  server = http.createServer(async (req, res) => {
    const p = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
    try { const f = await readFile(join(root, p === '/' ? 'index.html' : p)); res.writeHead(200, { 'content-type': types[extname(p)] || 'text/plain' }); res.end(f); }
    catch { res.writeHead(404); res.end('nf'); }
  }).listen(0);
  base = `http://localhost:${server.address().port}`;
}
const results = []; const ok = (name, pass, extra = '') => { results.push(pass); console.log((pass ? 'PASS ' : 'FAIL ') + name + (extra ? ' - ' + extra : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const stamp = Date.now();
const A = { email: `hazir-e2e-a-${stamp}@example.com`, pw: 'Test-pass-12345' }, B = { email: `hazir-e2e-b-${stamp}@example.com`, pw: 'Test-pass-12345' };

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'], headless: 'new' });
const newSession = async () => { const ctx = await browser.createBrowserContext(); const page = await ctx.newPage(); page.errors = []; page.on('pageerror', e => page.errors.push(e.message)); await page.setViewport({ width: 1280, height: 900 }); return { ctx, page }; };
const text = (page, sel) => page.$eval(sel, e => e.innerText).catch(() => '');
async function signUp(page, u, name) {
  await page.goto(base + '/app.html', { waitUntil: 'networkidle0' });
  await page.click('[data-m="signup"]'); await page.waitForSelector('#an');
  await page.type('#an', name); await page.type('#ae', u.email); await page.type('#ap', u.pw);
  await page.click('#ab'); await page.waitForSelector('.dash', { timeout: 15000 });
}

try {
  // Host A signs up and creates an event with two named guests
  const a = await newSession();
  await signUp(a.page, A, 'Host Alpha');
  ok('host A can sign up and reach the dashboard', true);
  await a.page.click('#newEv2').catch(() => a.page.click('#newEv'));
  await a.page.waitForSelector('#ef');
  await a.page.type('#t', 'E2E Wedding'); await a.page.$eval('#d', (e, v) => { e.value = v; }, new Date(Date.now() + 864e5 * 20).toISOString().slice(0, 10));
  await a.page.type('#l', 'Asha Rao\nVikram Sen');
  await a.page.click('#sv'); await a.page.waitForSelector('.evpage', { timeout: 15000 });
  const link = await a.page.$eval('.linkbox input', e => e.value);
  ok('event created with a shareable link', /rsvp\.html\?e=[0-9a-f]+$/.test(link), link.replace(/^https?:\/\/[^/]+/, ''));
  const eid = new URL(link).searchParams.get('e');
  const tokenLink = await a.page.$eval('[data-c]', () => null).catch(() => null);
  await a.page.click('[data-c]').catch(() => {});
  // Read the personal token for Asha via the host's own dashboard (RLS allows the owner)
  const hostToken = await a.page.evaluate(async (api, key, eid) => {
    const s = JSON.parse(localStorage.getItem('hazir-session'));
    const r = await fetch(`${api}/rest/v1/invitees?select=name,token&event_id=eq.${eid}&name=eq.Asha%20Rao`, { headers: { apikey: key, Authorization: 'Bearer ' + s.access_token } });
    return (await r.json())[0];
  }, API, KEY, eid);
  ok('owner can read own invitees', !!(hostToken && hostToken.token));

  // Guest in a separate, logged-out session answers through the personal link
  const g = await newSession();
  await g.page.goto(`${base}/rsvp.html?e=${eid}&t=${hostToken.token}`, { waitUntil: 'networkidle0' });
  ok('guest page shows event title and the guest greeting only', (await text(g.page, '.gh')).includes('E2E Wedding') && (await text(g.page, '.hello')).includes('Asha'));
  const pageText = await text(g.page, 'body');
  ok('guest page does not expose other guests or host controls', !/Vikram|Check in|Export/.test(pageText));
  await g.page.click('#pl'); await g.page.type('[data-ci="0"]', 'Meera Rao');
  await g.page.type('#nt', 'Window seat please'); await g.page.click('#sb');
  await g.page.waitForSelector('.done', { timeout: 15000 });
  ok('guest RSVP submitted from a separate session', true);

  // Host A sees it live (reload dashboard)
  await a.page.reload({ waitUntil: 'networkidle0' });
  await a.page.waitForSelector('.evcard'); await a.page.click('.evcard'); await a.page.waitForSelector('.stats5');
  await sleep(1200);
  const coming = await a.page.$eval('.stats5 .stat b', e => e.textContent);
  ok('host dashboard counts the guest and the plus-one', coming === '2', 'coming=' + coming);
  await a.page.click('[data-t="guests"]'); await sleep(500);
  const gt = await text(a.page, '#tb');
  ok('host sees the answer, note and companion by name', /Asha Rao/.test(gt) && /Window seat/.test(gt) && /Meera Rao/.test(gt) && /Vikram Sen/.test(gt));

  // Host B must not see host A's data
  const b = await newSession();
  await signUp(b.page, B, 'Host Beta');
  ok('host B starts with no events', (await b.page.$('.evcard')) === null);
  const probe = await b.page.evaluate(async (api, key, eid) => {
    const s = JSON.parse(localStorage.getItem('hazir-session')); const h = { apikey: key, Authorization: 'Bearer ' + s.access_token };
    const out = {};
    for (const t of ['events', 'invitees', 'responses']) out[t] = await (await fetch(`${api}/rest/v1/${t}?select=*&${t === 'events' ? 'id' : 'event_id'}=eq.${eid}`, { headers: h })).json();
    const w = await fetch(`${api}/rest/v1/responses?id=eq.00000000-0000-0000-0000-000000000000`, { method: 'DELETE', headers: h });
    const upd = await fetch(`${api}/rest/v1/events?id=eq.${eid}`, { method: 'PATCH', headers: { ...h, 'content-type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ title: 'hijacked' }) });
    out.patch = await upd.json();
    return out;
  }, API, KEY, eid);
  ok('host B cannot read host A events, guests or answers', ['events', 'invitees', 'responses'].every(t => Array.isArray(probe[t]) && probe[t].length === 0));
  ok('host B cannot modify host A event', Array.isArray(probe.patch) && probe.patch.length === 0);

  // Anonymous visitors cannot read tables directly
  const anon = await (await fetch(`${API}/rest/v1/responses?select=*`, { headers: { apikey: KEY } })).json();
  ok('anonymous API access to answers is denied', !Array.isArray(anon) || anon.length === 0, Array.isArray(anon) ? 'empty' : (anon.message || anon.code));
  const inv = await (await fetch(`${API}/rest/v1/rpc/get_invite`, { method: 'POST', headers: { apikey: KEY, 'content-type': 'application/json' }, body: JSON.stringify({ p_event: eid }) })).json();
  ok('public invite data has no guest names or answers', !JSON.stringify(inv).match(/Asha|Vikram|Meera|meal/i) && inv.title === 'E2E Wedding');
  const bad = await fetch(`${API}/rest/v1/rpc/submit_rsvp`, { method: 'POST', headers: { apikey: KEY, 'content-type': 'application/json' }, body: JSON.stringify({ p_event: eid, p_token: 'not-a-real-token', p_name: 'x', p_attending: true, p_grp: 'Other', p_meal: 'Veg', p_party: 1, p_arrival: 600, p_comp: [], p_note: null }) });
  ok('a forged personal token is rejected', bad.status >= 400);
  ok('no JavaScript errors in any session', [a, g, b].every(s => s.page.errors.length === 0), [a, g, b].flatMap(s => s.page.errors).join('; '));

  // Clean up the test event
  await a.page.evaluate(async (api, key, eid) => { const s = JSON.parse(localStorage.getItem('hazir-session')); await fetch(`${api}/rest/v1/events?id=eq.${eid}`, { method: 'DELETE', headers: { apikey: key, Authorization: 'Bearer ' + s.access_token } }); }, API, KEY, eid);
} catch (e) { ok('test run completed', false, e.message); }
await browser.close(); if (server) server.close();
console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
process.exit(results.every(Boolean) ? 0 : 1);
