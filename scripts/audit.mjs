/**
 * OM INDUSTRIES ERP — logical-gap audit harness.
 *
 * Unlike scripts/e2e.mjs (happy path), every test here asserts the CORRECT
 * behaviour for a known logical gap. A FAIL means the bug is still present.
 * Each test is tagged [#n] to match the audit report findings.
 *
 * Run:  node scripts/audit.mjs        (needs dev server + .env; PORT defaults 3001)
 */
import jwt from 'jsonwebtoken';
import fs from 'fs';

const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split('\n').filter(l => l.includes('=')).map(l => {
  const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
}));
const SECRET = env.JWT_SECRET || 'om-industries-erp-secret-key-2024';
const BASE = `http://localhost:${process.env.PORT || 3001}/api`;

const mk = (u) => jwt.sign(u, SECRET, { expiresIn: '1h' });
const admin  = mk({ id: 1, name: 'Ravi Jariwala', phone: '0', role: 'admin', department: null });
const hanks  = mk({ id: 15, name: 'Ramesh', phone: '1', role: 'hanks_worker', department: 'hanks' });
const coning = mk({ id: 18, name: 'Mahesh', phone: '2', role: 'coning_worker', department: 'coning' });
const master = mk({ id: 99, name: 'Dyeing Master', phone: '9', role: 'dyeing_master', department: 'dyeing' });
const portal = jwt.sign({ clientId: 1, type: 'portal' }, SECRET, { expiresIn: '1h' });

const CLIENT = 10, QUALITY = 7, SHADE = 102;
const TODAY = new Date().toISOString().split('T')[0];
let pass = 0, fail = 0;
const check = (name, cond, extra = '') => { console.log(`${cond ? '✓' : '✗ FAIL'}  ${name}${extra ? ' — ' + extra : ''}`); cond ? pass++ : fail++; };

async function call(path, token, method = 'GET', body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await res.text();
  let json; try { json = JSON.parse(txt); } catch { json = txt; }
  return { status: res.status, json };
}
const greyTotal   = async () => { const r = await call('/warehouses', admin); return (r.json.grey  || []).reduce((s, x) => s + Number(x.remaining_kg), 0); };
const dyedTotal   = async () => { const r = await call('/warehouses', admin); return (r.json.dyed  || []).reduce((s, x) => s + Number(x.remaining_kg), 0); };
const packedTotal = async () => { const r = await call('/warehouses', admin); return (r.json.packed|| []).reduce((s, x) => s + Number(x.weight_kg), 0); };

// Build a fresh grey pool of `kg` and return the approved hanks id.
async function makeGrey(kg) {
  await call('/stock/inward', admin, 'POST', { client_id: CLIENT, quality_id: QUALITY, weight_kg: kg, challan_no: `AUD-${Date.now()}` });
  const hp = await call('/production/hanks', hanks, 'POST', { client_id: CLIENT, quality_id: QUALITY, weight_kg: kg, date: TODAY });
  await call(`/production/hanks/${hp.json.id}/approve`, admin, 'PUT', {});
  return hp.json.id;
}

(async () => {
  console.log('\n=== OM INDUSTRIES ERP — logical-gap audit ===');
  console.log('(a FAIL = the bug from the audit report is still present)\n');

  const me = await call('/warehouses', admin);
  if (me.status !== 200) { console.log('admin token rejected — is the dev server up on the right PORT?', JSON.stringify(me.json)); process.exit(1); }

  // ── [#1] Month filter must not crash for <31-day months (Apr=30, Feb=28) ──
  for (const [label, m] of [['Apr', 4], ['Feb', 2], ['Jun', 6]]) {
    const si = await call(`/stock/inward?month=${m}&year=2026`, admin);
    check(`[#1] stock/inward month=${label} returns 200 (not date-range 500)`, si.status === 200, `status ${si.status}`);
  }
  const hk = await call('/production/hanks?month=4&year=2026', admin);
  check('[#1] hanks month=Apr returns 200', hk.status === 200, `status ${hk.status}`);
  const cn = await call('/production/coning?month=4&year=2026', admin);
  check('[#1] coning month=Apr returns 200', cn.status === 200, `status ${cn.status}`);

  // ── [#2] Dyeing approval must be idempotent (no duplicate dyed_stock on re-approve) ──
  await makeGrey(50);
  const db = await call('/production/dyeing', admin, 'POST', { client_id: CLIENT, quality_id: QUALITY, shade_id: SHADE, input_kg: 50, date: TODAY });
  const did = db.json.id;
  await call(`/production/dyeing/${did}/approve`, admin, 'PUT', { output_kg: 48, chemicals: [] });
  const dyedAfter1 = await dyedTotal();
  const reApprove = await call(`/production/dyeing/${did}/approve`, admin, 'PUT', { output_kg: 48, chemicals: [] });
  const dyedAfter2 = await dyedTotal();
  check('[#2] re-approving a dyeing batch adds NO extra dyed_stock', Math.abs(dyedAfter2 - dyedAfter1) < 0.01, `Δdyed on 2nd approve=${(dyedAfter2 - dyedAfter1).toFixed(2)}`);
  check('[#2] 2nd dyeing approve is rejected (4xx "already approved")', reApprove.status >= 400, `status ${reApprove.status}`);

  // ── [#3] Rejecting an already-APPROVED hanks entry must reverse the grey it created ──
  const greyBefore = await greyTotal();
  const hid = await makeGrey(40);
  const greyAfterApprove = await greyTotal();
  check('[#3] sanity: approve added ~40 grey', Math.abs((greyAfterApprove - greyBefore) - 40) < 0.01, `Δ=${(greyAfterApprove - greyBefore).toFixed(2)}`);
  await call(`/production/hanks/${hid}/reject`, admin, 'PUT', {});
  const greyAfterReject = await greyTotal();
  check('[#3] rejecting the approved hanks rolls grey back', Math.abs(greyAfterReject - greyBefore) < 0.01, `grey ${greyBefore.toFixed(1)}→${greyAfterApprove.toFixed(1)}→${greyAfterReject.toFixed(1)}`);

  // ── [#4] Rejecting a dyeing batch must restore the grey it consumed at creation ──
  await makeGrey(30);
  const greyPre = await greyTotal();
  const db2 = await call('/production/dyeing', admin, 'POST', { client_id: CLIENT, quality_id: QUALITY, shade_id: SHADE, input_kg: 30, date: TODAY });
  const greyMid = await greyTotal();
  check('[#4] sanity: dyeing creation consumed ~30 grey', Math.abs((greyPre - greyMid) - 30) < 0.01, `Δ=${(greyPre - greyMid).toFixed(2)}`);
  await call(`/production/dyeing/${db2.json.id}/reject`, admin, 'PUT', {});
  const greyPost = await greyTotal();
  check('[#4] rejecting the dyeing batch restores consumed grey', Math.abs(greyPost - greyPre) < 0.01, `grey ${greyPre.toFixed(1)}→${greyMid.toFixed(1)}→${greyPost.toFixed(1)}`);

  // ── [#5] Partial dispatch must not wipe the whole ready_stock lot ──
  // Build packed stock via the full chain.
  await makeGrey(60);
  const dbp = await call('/production/dyeing', admin, 'POST', { client_id: CLIENT, quality_id: QUALITY, shade_id: SHADE, input_kg: 60, date: TODAY });
  await call(`/production/dyeing/${dbp.json.id}/approve`, admin, 'PUT', { output_kg: 60, chemicals: [] });
  const dlist = await call('/production/dyed-stock', coning);
  const dsId = (dlist.json || []).find(b => b.batch_no === dbp.json.batch_no)?.id;
  const cp = await call('/production/coning', coning, 'POST', { dyed_stock_id: dsId, cone_weight_kg: 1.5, cones_count: 40, date: TODAY }); // 60kg
  await call(`/production/coning/${cp.json.id}/approve`, admin, 'PUT', {});
  const ready = await call('/stock/ready?status=available', admin);
  const lot = (ready.json || []).find(r => Number(r.remaining_kg) >= 59 && Number(r.remaining_kg) <= 61);
  if (!lot) {
    check('[#5] could not stage a 60kg ready lot (skipped)', false, 'no matching lot');
  } else {
    await call('/dispatch', admin, 'POST', { client_id: CLIENT, stock_id: lot.id, qty_kg: 20, rate: 200, date: TODAY }); // dispatch only 20 of 60
    const after = await call('/stock/ready?status=available', admin);
    const still = (after.json || []).find(r => r.id === lot.id);
    check('[#5] partial dispatch (20 of 60) leaves the lot still available', !!still, still ? `remaining=${still.remaining_kg}` : 'lot fully removed');
    check('[#5] partial dispatch decrements remaining_kg (~40 left)', still && Math.abs(Number(still.remaining_kg) - 40) < 0.5, still ? `remaining=${still.remaining_kg}` : 'n/a');
  }

  // ── [SEC] Authorization: dyeing_master is operational-admin, blocked from finance/payroll/accounts ──
  for (const [label, path, method, body] of [
    ['payroll/full',     '/payroll/full?month=6&year=2026', 'GET'],
    ['workers list',     '/workers',                        'GET'],
    ['loans',            '/loans',                          'GET'],
    ['advances list',    '/advances',                       'GET'],
    ['client finance',   '/finance/clients',                'GET'],
    ['settings write',   '/settings',                       'PUT', { foo: 'bar' }],
  ]) {
    const r = await call(path, master, method, body);
    check(`[SEC] dyeing_master DENIED ${label} (403)`, r.status === 403, `status ${r.status}`);
  }
  // master MUST still reach operational endpoints
  const mOps = await call('/orders', master);
  check('[SEC] dyeing_master ALLOWED orders (operational)', mOps.status === 200, `status ${mOps.status}`);

  // ── [SEC] Portal token must not reach staff endpoints ──
  const pw = await call('/warehouses', portal);
  check('[SEC] portal token REJECTED on staff /warehouses', pw.status === 401 || pw.status === 403, `status ${pw.status}`);

  // ── [SEC] Account creation endpoints are not public ──
  const reg = await call('/auth/register', null, 'POST', { name: 'Hacker', phone: '9990001112', pin: '1234', role: 'dyeing_master' });
  check('[SEC] unauthenticated /auth/register BLOCKED', reg.status === 401 || reg.status === 403, `status ${reg.status}`);
  const setup = await fetch(`${BASE}/auth/setup`).then(r => r.status);
  check('[SEC] unauthenticated /auth/setup GET BLOCKED (no user leak)', setup === 403, `status ${setup}`);

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  console.log('Failures above are the live logical gaps. Fix routes, re-run to confirm green.');
  process.exit(fail ? 1 : 0);
})();
