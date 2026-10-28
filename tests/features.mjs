// Feature walk-through against a deployed site or the local repo. Takes screenshots into SHOTS (default /tmp/hazir-shots).
//   BASE_URL=https://your-site node tests/features.mjs
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(fileURLToPath(import.meta.url), '..', '..'), SHOTS = process.env.SHOTS || '/tmp/hazir-shots';
await mkdir(SHOTS, { recursive: true });
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
let server, base = process.env.BASE_URL;
if (!base) { server = http.createServer(async (q, r) => { const u = q.url.split('?')[0]; try { const f = await readFile(join(root, u === '/' ? 'index.html' : u === '/rsvp' ? 'rsvp.html' : u)); r.writeHead(200, { 'content-type': T[u === '/' || u === '/rsvp' ? '.html' : extname(u)] }); r.end(f); } catch { r.writeHead(404); r.end(); } }).listen(0); base = 'http://localhost:' + server.address().port; }
const sl = ms => new Promise(r => setTimeout(r, ms));
const res = [];
const check = async (name, fn) => { try { const v = await fn(); const ok = v !== false; res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (typeof v === 'string' ? ' - ' + v : '')); } catch (e) { res.push(false); console.log('FAIL ' + name + ' - ' + e.message.slice(0, 120)); } };
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'], headless: 'new' });
const click = (p, sel) => p.$eval(sel, e => e.click());
const txt = (p, sel) => p.$eval(sel, e => e.innerText).catch(() => '');
let gRef = null; const p2v = () => gRef.$eval('.savebox input', e => e.value).catch(() => '');
const day = n => new Date(Date.now() + 864e5 * n).toISOString().slice(0, 10);
const email = `hazir-e2e-f${Date.now()}@example.com`, pw = 'Test-pass-12345';

for (const [w, h, tag] of [[1280, 850, 'desktop'], [390, 844, 'mobile']].filter(v => !process.env.ONLY || v[2] === process.env.ONLY)) {
  console.log(`\n== ${tag} ${w}px`);
  const ctx = await browser.createBrowserContext(), p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.setViewport({ width: w, height: h });
  await check('landing loads, story and CTAs present', async () => { await p.goto(base + '/', { waitUntil: 'networkidle0' }); await sl(1800); await p.screenshot({ path: `${SHOTS}/${tag}-landing.png` }); return /Why Hazir|Every Indian gathering/.test(await txt(p, 'body')) && !!(await p.$('a[href="app.html"]')) && !/uvichar|Supabase|Vercel/i.test(await txt(p, 'body')); });
  await check('landing has no horizontal scroll', async () => !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
  await check('sample demo: guest answers and sample dashboard updates', async () => { await p.$eval('#demo', e => e.scrollIntoView()); await sl(900); const before = await txt(p, '#demoBoard'); await p.$eval('#demoGuest input[type=text], #demoGuest input:not([type])', e => { e.focus(); }).catch(() => {}); const btn = await p.$('#demoGuest .btn'); if (!btn) return false; await p.$eval('#demoGuest .btn', e => e.click()); await sl(900); return (await txt(p, '#demoBoard')).length > 20; });
  await p.screenshot({ path: `${SHOTS}/${tag}-landing-demo.png` });
  await check('why section and closing CTA render', async () => { await p.$eval('#why', e => e.scrollIntoView()); await sl(1000); await p.screenshot({ path: `${SHOTS}/${tag}-why.png` }); return (await p.$$('.solves div')).length === 4; });

  await p.goto(base + '/app.html', { waitUntil: 'networkidle0' });
  await check('login rejects wrong credentials with a clear message', async () => { await p.type('#ae', 'nobody@example.com'); await p.type('#ap', 'wrong-password-1'); await click(p, '#ab'); await sl(1500); return /do not match/i.test(await txt(p, '#msg')); });
  await check('signup validates short password', async () => { await click(p, '[data-m="signup"]'); await p.waitForSelector('#an'); await p.type('#an', 'Test Host'); await p.type('#ae', email); await p.type('#ap', 'short'); await click(p, '#ab'); await sl(300); return /8 characters/i.test(await txt(p, '#msg')); });
  await check('signup with email and password lands on dashboard (no verification)', async () => { await p.$eval('#ae', e => { e.value = ''; }); await p.type('#ae', email); await p.$eval('#ap', e => { e.value = ''; }); await p.type('#ap', pw); await click(p, '#ab'); const ok2 = await p.waitForSelector('.dash', { timeout: 20000 }).then(() => true).catch(() => false); if (!ok2) return 'auth message: ' + await txt(p, '#msg'); await p.screenshot({ path: `${SHOTS}/${tag}-empty.png` }); return true; });
  await check('session survives reload, logout and login again work', async () => { await p.reload({ waitUntil: 'networkidle0' }); await p.waitForSelector('.dash'); await click(p, '#so'); await p.waitForSelector('#af'); await p.type('#ae', email); await p.type('#ap', pw); await click(p, '#ab'); await p.waitForSelector('.dash', { timeout: 15000 }); return true; });
  await check('create event validates required fields', async () => { await click(p, '#newEv2'); await p.waitForSelector('#ef'); await click(p, '#sv'); await sl(300); return /name/i.test(await txt(p, '#msg')); });
  await check('create event with deadline in the past rejected only if after date; valid event created', async () => { await p.type('#t', 'Feature Test Dinner'); await p.$eval('#d', (e, v) => { e.value = v; }, day(10)); await p.$eval('#dl', (e, v) => { e.value = v; }, day(12)); await click(p, '#sv'); await sl(400); const bad = /on or before/i.test(await txt(p, '#msg')); await p.$eval('#dl', (e, v) => { e.value = v; }, day(5)); await p.type('#l', 'Asha Rao\nVikram Sen\nMeera Iyer'); await click(p, '#sv'); await p.waitForSelector('.evpage', { timeout: 15000 }); return bad; });
  const link = await p.$eval('.linkbox input', e => e.value); const eid = new URL(link).searchParams.get('e');
  await check('invites tab: open link, 3 personal links, copy reminder control', async () => { await sl(700); await p.screenshot({ path: `${SHOTS}/${tag}-invites.png` }); return (await p.$$('[data-c]')).length === 3 && !!(await p.$('#callw')); });
  if (process.env.BASE_URL) await check('shared link has branded default preview before any banner', async () => { const h = await (await fetch(base + '/rsvp?e=' + eid)).text(); return /property="og:image" content="[^"]*og\.jpg"/.test(h) && /property="og:title" content="Feature Test Dinner/.test(h) && /og:description" content="[^"]*(AM|PM)/.test(h); });
  await check('QR code decodes to the invite link', async () => { await p.waitForSelector('#qr[data-done="1"]', { timeout: 15000 }); await p.addScriptTag({ path: join(root, 'tests/vendor/jsqr.js') }); const out = await p.evaluate(() => { const c = document.querySelector('#qr'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height); const r = window.jsQR(d.data, c.width, c.height); return r && r.data; }); await p.screenshot({ path: `${SHOTS}/${tag}-qr.png` }); return out === link ? true : 'decoded: ' + out; });
  await check('edit event saves changes', async () => { await click(p, '#ed'); await p.waitForSelector('#ef'); await p.$eval('#t', e => { e.value = ''; }); await p.type('#t', 'Feature Test Dinner (edited)'); await click(p, '#sv'); await p.waitForSelector('.evpage'); await sl(500); return /edited/.test(await txt(p, '.evpage h2')); });

  const g = await (await browser.createBrowserContext()).newPage(); gRef = g; await g.setViewport({ width: w, height: h });
  await check('event banner uploads, persists and shows on the guest page', async () => {
    await click(p, '#ed'); await p.waitForSelector('#ef');
    const inp = await p.$('#bn'); await inp.uploadFile(join(root, 'tests/assets/banner.png'));
    await sl(800); await p.screenshot({ path: `${SHOTS}/${tag}-banner-form.png` });
    await click(p, '#sv'); await p.waitForSelector('.evpage', { timeout: 30000 });
    await g.goto(`${base}/rsvp.html?e=${eid}`, { waitUntil: 'networkidle0' });
    const ok = await g.waitForSelector('img.banner', { timeout: 20000 }).then(() => true).catch(() => false);
    await g.screenshot({ path: `${SHOTS}/${tag}-guest-banner.png` });
    if (!process.env.BASE_URL) return ok ? true : 'img.banner missing on guest page';
    const h = await (await fetch(base + '/rsvp?e=' + eid)).text();
    if (!ok) return 'img.banner missing on guest page';
    return /property="og:image" content="[^"]*og\.jpg"/.test(h) && /property="og:title"/.test(h) ? true : 'og tags missing or wrong on /rsvp';
  });
  // guests answer: yes with companion, no, personal-token
  await check('guest yes with companion, meal, time and note', async () => { await g.goto(`${base}/rsvp.html?e=${eid}`, { waitUntil: 'networkidle0' }); await g.screenshot({ path: `${SHOTS}/${tag}-guest.png` }); await g.type('#n', 'Diya Rao'); await g.select('#g', 'Friends'); await g.select('#m', 'Jain'); await click(g, '#apl'); await click(g, '#kpl'); await g.type('[data-ci="0"]', 'Rohan Rao'); await g.select('[data-cm="0"]', 'Vegan'); await g.type('[data-ci="1"]', 'Mira Rao'); await g.select('[data-cm="1"]', 'Kids'); await g.$eval('#tr', e => { e.value = 1230; e.dispatchEvent(new Event('input', { bubbles: true })); }); await g.type('#nt', 'Window seat'); await click(g, '#sb'); await g.waitForSelector('.rsvpdone', { timeout: 15000 }); await g.screenshot({ path: `${SHOTS}/${tag}-guest-done.png` }); return true; });
  let editLink = '';
  await check('save-my-RSVP link shown and works for changing the answer later', async () => { editLink = await p2v(); if (!/\/rsvp\?e=[0-9a-f]+&r=[0-9a-f]+$/.test(editLink)) return false; const g2 = await (await browser.createBrowserContext()).newPage(); await g2.setViewport({ width: w, height: h }); await g2.goto(editLink, { waitUntil: 'networkidle0' }); const t = await txt(g2, '#root'); const okPrefill = /Diya Rao/.test(t) && /already answered/.test(t); await g2.screenshot({ path: `${SHOTS}/${tag}-editlink.png` }); await click(g2, '#kpl'); await click(g2, '#sb'); await g2.waitForSelector('.rsvpdone', { timeout: 15000 }); return okPrefill; });
  await check('guest decline works', async () => { await g.goto(`${base}/rsvp.html?e=${eid}`, { waitUntil: 'networkidle0' }); await click(g, '[data-a="0"]'); await g.type('#n', 'Karan Shah'); await click(g, '#sb'); await g.waitForSelector('.rsvpdone', { timeout: 15000 }); return /Thank you/.test(await txt(g, '.rsvpdone')); });
  await check('bad event link shows a friendly page', async () => { await g.goto(`${base}/rsvp.html?e=doesnotexist`, { waitUntil: 'networkidle0' }); return /not found/i.test(await txt(g, '#root')); });

  await check('dashboard overview shows correct numbers', async () => { await p.reload({ waitUntil: 'networkidle0' }); await p.waitForSelector('.evcard'); await click(p, '.evcard'); await p.waitForSelector('.stats5'); await click(p, '[data-t="overview"]'); await sl(1500); await p.screenshot({ path: `${SHOTS}/${tag}-overview.png` }); const v = await p.$$eval('.stats5 .stat b', e => e.map(x => x.textContent)); const sub = await txt(p, '.stats5'); return v[0] === '4' && v[1] === '1' && /2 adults \+ 2 kids/.test(sub) ? v.join(',') : false; });
  await check('guests tab: search, filters, check-in, walk-in, add names, export, remove', async () => {
    await click(p, '[data-t="guests"]'); await sl(700); await p.screenshot({ path: `${SHOTS}/${tag}-guests.png` });
    await p.type('#q', 'diya'); await sl(600); if (!/Diya Rao/.test(await txt(p, '#tb')) || /Karan/.test(await txt(p, '#tb'))) return 'search';
    await p.$eval('#q', e => { e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); });
    await click(p, '[data-f="wait"]'); await sl(500); const aw = await txt(p, '#tb'); if (!/Asha Rao/.test(aw) || /Diya/.test(aw)) return 'wait-filter';
    await click(p, '[data-f="all"]'); await click(p, '[data-ci]'); await sl(1200); await click(p, '[data-f="in"]'); await sl(500); if (!/Diya|Karan/.test(await txt(p, '#tb')) && !(await p.$('[data-ci]'))) return 'checkin-filter'; await click(p, '[data-f="all"]');
    await click(p, '#addg'); await p.waitForSelector('.mcard'); await p.type('#gl', 'Neha Gupta'); await click(p, '#gs'); await sl(3000); if (!/Neha Gupta/.test(await txt(p, '#tb'))) return 'add-names';
    await click(p, '#addg'); await p.waitForSelector('.mcard'); await click(p, '.mcard [data-k="w"]'); await p.type('#wn', 'Walk In Guest'); await click(p, '#gs'); await sl(3000); if (!/Walk In Guest/.test(await txt(p, '#tb'))) return 'walkin';
    const dl = await p.evaluate(() => new Promise(r => { const o = URL.createObjectURL; URL.createObjectURL = b => { b.text().then(t => r(t)); return o.call(URL, b); }; document.querySelector('#csv').click(); setTimeout(() => r(''), 3000); }));
    if (!/Diya Rao/.test(dl) || !/Asha Rao,"?Awaiting/.test(dl.replace(/"/g, '')) && !/Awaiting/.test(dl)) return 'csv-export';
    await p.$$eval('.trow', rows => rows.find(r => /Neha Gupta/.test(r.innerText)).querySelector('[data-ri]').click()); await p.waitForSelector('.dlg'); await click(p, '#mo'); await sl(1500); return !/Neha Gupta/.test(await txt(p, '#tb')) ? true : 'remove'; });
  await check('day-of tab: door list and check-in progress', async () => { await click(p, '[data-t="day"]'); await sl(1300); await p.screenshot({ path: `${SHOTS}/${tag}-dayof.png` }); const t = await txt(p, '#pane'); return /Diya Rao/.test(t) && /Arrived/i.test(t); });
  await check('no horizontal scroll in host app', async () => !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
  const todayIst = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const setDeadline = async (d, t) => { await click(p, '[data-t="overview"]'); await click(p, '#ed'); await p.waitForSelector('#ef'); await p.$eval('#d', e => { e.value = '2030-12-31'; }); await p.$eval('#tz', e => { e.value = 'Asia/Kolkata'; }); await p.$eval('#dl', (e, v) => { e.value = v; }, d); await p.$eval('#dt', (e, v) => { e.value = v; }, t); await click(p, '#sv'); await p.waitForSelector('.evpage'); await sl(500); };
  await check('exact-time deadline: earlier today (IST) closes guests, later today keeps open (server enforced)', async () => {
    await setDeadline(todayIst, '00:01'); await g.goto(`${base}/rsvp.html?e=${eid}`, { waitUntil: 'networkidle0' }); const closed = /closed/i.test(await txt(g, '#root'));
    await setDeadline(todayIst, '23:59'); await g.goto(`${base}/rsvp.html?e=${eid}`, { waitUntil: 'networkidle0' }); const open = !!(await g.$('#f')) && /IST|GMT\+5:30/.test(await txt(g, '.fine')); await g.screenshot({ path: `${SHOTS}/${tag}-guest-deadline.png` });
    return closed && open ? true : `closed=${closed} open=${open}`; });
  await check('venue and message to guests show on invite; edit form keeps deadline time', async () => {
    await click(p, '#ed'); await p.waitForSelector('#ef'); await p.$eval('#vn', e => { e.value = 'Rose Garden, Kolkata'; }); await p.$eval('#ms', e => { e.value = 'Dress code: pastel. Parking behind the hall.'; }); const keep = await p.$eval('#dt', e => e.value); await click(p, '#sv'); await p.waitForSelector('.evpage'); await sl(400);
    await g.goto(`${base}/rsvp.html?e=${eid}`, { waitUntil: 'networkidle0' }); const t = await txt(g, '#root'); return keep === '23:59' && /Rose Garden/.test(t) && /pastel/.test(t); });
  await check('close RSVPs now / reopen from the invites tab', async () => {
    await click(p, '[data-t="share"]'); await sl(500); await click(p, '#tg'); await sl(1200); await g.goto(`${base}/rsvp.html?e=${eid}`, { waitUntil: 'networkidle0' }); const c = /closed/i.test(await txt(g, '#root'));
    await click(p, '#tg'); await sl(1200); await g.goto(`${base}/rsvp.html?e=${eid}`, { waitUntil: 'networkidle0' }); return c && !!(await g.$('#f')); });
  await check('caterer summary control present on overview', async () => { await click(p, '[data-t="overview"]'); await sl(500); return !!(await p.$('#sum')); });
  await check('calendar: toggle, marked day, hover tooltip, tap panel, open event', async () => {
    await click(p, '#bk'); await p.waitForSelector('.vt'); await click(p, '[data-v="cal"]'); await sl(700);
    const ev = await p.evaluate(() => 0);
    // event date is 2030-12-31: jump forward to that month using next button
    for (let i = 0; i < 200 && !(await p.$('.cb[data-k="2030-12-31"]')); i++) { await click(p, '#cn'); }
    await sl(300); const has = await p.$eval('.cb[data-k="2030-12-31"]', e => e.parentElement.classList.contains('has'));
    await p.hover('.cb[data-k="2030-12-31"]'); await sl(500); const vis = await p.$eval('.cd.has .ctip', e => getComputedStyle(e).visibility === 'visible' && /Feature Test Dinner/.test(e.innerText));
    await p.screenshot({ path: `${SHOTS}/${tag}-calendar.png` });
    await click(p, '.cb[data-k="2030-12-31"]'); await sl(300); const panel = /Feature Test Dinner/.test(await txt(p, '#cday'));
    await click(p, '.crow'); await p.waitForSelector('.evpage', { timeout: 8000 }); return has && vis && panel ? true : `has=${has} tip=${vis} panel=${panel}`; });
  await check('duplicate event creates a separate copy without guests, then typed delete removes the copy', async () => {
    await click(p, '[data-t="share"]'); await sl(500); await click(p, '#dup'); await sl(2500); const t = await txt(p, '.evpage h2'); if (!/\(copy\)/.test(t)) return 'no copy: ' + t;
    await click(p, '[data-t="share"]'); await sl(500); await click(p, '#del'); await p.waitForSelector('.dlg'); const dis = await p.$eval('#mo', e => e.disabled);
    await p.type('#mw', 'delet'); const still = await p.$eval('#mo', e => e.disabled); await p.type('#mw', 'e'); const en = await p.$eval('#mo', e => !e.disabled);
    await p.screenshot({ path: `${SHOTS}/${tag}-delete-modal.png` }); await click(p, '#mo'); await p.waitForSelector('.dash', { timeout: 10000 }); await sl(800);
    const left = (await p.$$('.evcard')).length; return dis && still && en && left === 1 ? true : `dis=${dis} still=${still} en=${en} left=${left}`; });
  await check('Escape cancels the delete dialog and keeps the event', async () => { if (!await p.waitForSelector('.evcard', { timeout: 15000 }).then(() => 1).catch(() => 0)) return 'no evcard; body=' + (await txt(p, 'body')).slice(0, 260).replace(/\n/g, ' | '); await click(p, '.evcard'); await p.waitForSelector('.evpage'); await click(p, '[data-t="share"]'); await sl(400); await click(p, '#del'); await p.waitForSelector('.dlg'); await p.keyboard.press('Escape'); await sl(500); return !(await p.$('.dlg')) && !!(await p.$('.evpage')); });
  await check('delete event removes it', async () => { await click(p, '[data-t="share"]'); await sl(500); await click(p, '#del'); await p.waitForSelector('.dlg'); await p.type('#mw', 'DELETE'); await click(p, '#mo'); const gone = await p.waitForSelector('.dash', { timeout: 10000 }).then(() => 1).catch(() => 0); await sl(600); const tst = await p.evaluate(() => document.querySelector('#toast')?.innerText || ''); await g.goto(`${base}/rsvp.html?e=${eid}`, { waitUntil: 'networkidle0' }); const body = await txt(g, '#root'); return /not found/i.test(body) ? true : `dash=${gone} toast='${tst}' guest='${body.slice(0, 140).replace(/\n/g, ' | ')}'`; });
  await check(`no JavaScript errors (${tag})`, async () => errs.length === 0 ? true : errs.join('; '));
  await ctx.close();
}
await browser.close(); if (server) server.close();
console.log(`\n${res.filter(Boolean).length}/${res.length} checks passed`);
process.exit(res.every(Boolean) ? 0 : 1);
