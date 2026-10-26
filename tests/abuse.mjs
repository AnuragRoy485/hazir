// Abuse-limit check against the real backend. Creates one throwaway host (hazir-e2e-*) and one event.
//   node tests/abuse.mjs
import { API_URL, PUBLISHABLE_KEY } from '../src/lib/config.js';
const H = { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' };
const call = async (path, body, token, extra = {}) => { const r = await fetch(API_URL + path, { method: 'POST', headers: { ...H, ...(token ? { Authorization: 'Bearer ' + token } : {}), ...extra }, body: JSON.stringify(body) }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { ok: r.ok, j }; };
const rsvp = (e, t, n) => call('/rest/v1/rpc/submit_rsvp', { p_event: e, p_token: t, p_name: n, p_attending: true, p_grp: 'Friends', p_meal: 'Veg', p_party: 1, p_arrival: 1140, p_comp: [], p_note: null });
const email = `hazir-e2e-abuse${Date.now()}@example.com`;
const su = await call('/auth/v1/signup', { email, password: 'Test-pass-12345', data: { name: 'Abuse Test' } });
const tok = su.j.access_token;
const ev = await call('/rest/v1/events', { title: 'Abuse test', occasion: 'Dinner', event_date: '2030-01-01', invited: 50, max_party: 4, default_time: 1140 }, tok, { Prefer: 'return=representation' });
const eid = ev.j[0].id;
const inv = await call('/rest/v1/invitees', [{ event_id: eid, name: 'Named Guest' }], tok, { Prefer: 'return=representation' });
const ptoken = inv.j[0].token;
let pass = 0, fail = 0; const t = (n, ok, d = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? ' - ' + d : '')); };
const first = await rsvp(eid, null, 'Guest 1'); t('a normal guest answer is accepted', first.ok, JSON.stringify(first.j).slice(0, 120));
const named = []; for (let i = 0; i < 10; i++) named.push(await rsvp(eid, ptoken, 'Named Guest'));
t('personal link can change its answer a few times', named.slice(0, 7).every(x => x.ok));
t('personal link is slowed after repeated changes', named.slice(8).some(x => !x.ok && /many times/i.test(x.j.message || '')), (named[9].j.message || ''));
const anon = []; for (let i = 0; i < 30; i++) anon.push(await rsvp(eid, null, 'Bot ' + i));
const blocked = anon.filter(x => !x.ok && /Too many answers/i.test(x.j.message || '')).length;
t('one connection is stopped after about 30 answers in 10 minutes', blocked > 0, `${blocked} blocked of 30 more`);
const n = await call('/rest/v1/rpc/get_invite', { p_event: eid }); t('invite page data still loads while limited', n.ok && n.j.title === 'Abuse test');
const tbl = await fetch(API_URL + '/rest/v1/rsvp_hits?select=*', { headers: H }); t('limit table is not readable by anonymous users', !tbl.ok || (await tbl.json()).length === 0);
await call('/rest/v1/rpc/get_invite', { p_event: eid });
// cleanup own fixtures
await fetch(API_URL + '/rest/v1/events?id=eq.' + eid, { method: 'DELETE', headers: { ...H, Authorization: 'Bearer ' + tok } });
console.log(`${pass}/${pass + fail}`); process.exit(fail ? 1 : 0);
