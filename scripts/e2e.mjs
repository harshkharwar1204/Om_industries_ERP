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

const CLIENT = 10, QUALITY = 7, SHADE = 102;
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

async function greyTotal() { const r = await call('/warehouses', admin); return (r.json.grey || []).reduce((s, x) => s + Number(x.remaining_kg), 0); }
async function dyedTotal() { const r = await call('/warehouses', admin); return (r.json.dyed || []).reduce((s, x) => s + Number(x.remaining_kg), 0); }
async function packedTotal() { const r = await call('/warehouses', admin); return (r.json.packed || []).reduce((s, x) => s + Number(x.weight_kg), 0); }

(async () => {
  console.log('\n=== OM INDUSTRIES ERP — end-to-end transfer test ===\n');

  // 0. auth sanity
  const me = await call('/warehouses', admin);
  check('admin token accepted on /warehouses', me.status === 200, `status ${me.status}`);
  if (me.status !== 200) { console.log(JSON.stringify(me.json)); process.exit(1); }

  const grey0 = await greyTotal(), dyed0 = await dyedTotal(), packed0 = await packedTotal();
  console.log(`baseline kg — grey:${grey0} dyed:${dyed0} packed:${packed0}\n`);

  // 1. stock inward (raw yarn)
  const si = await call('/stock/inward', admin, 'POST', { client_id: CLIENT, quality_id: QUALITY, weight_kg: 100, bundles: 5, challan_no: `E2E-${Date.now()}` });
  check('stock inward created', si.status === 201 || si.status === 200, `status ${si.status}`);

  // 2. hanks production (worker)
  const hp = await call('/production/hanks', hanks, 'POST', { client_id: CLIENT, quality_id: QUALITY, weight_kg: 60, date: new Date().toISOString().split('T')[0] });
  check('hanks entry submitted', hp.status === 201 || hp.status === 200, `status ${hp.status}`);
  const hid = hp.json.id;

  // 3. approve hanks -> grey_stock + order received
  const ha = await call(`/production/hanks/${hid}/approve`, admin, 'PUT', {});
  check('hanks approved', ha.status === 200, `status ${ha.status}`);
  const grey1 = await greyTotal();
  check('grey_stock increased by ~60 after hanks approve', Math.abs((grey1 - grey0) - 60) < 0.01, `Δgrey=${(grey1 - grey0).toFixed(2)}`);

  // 4. dyeing batch (consumes grey)
  const db = await call('/production/dyeing', admin, 'POST', { client_id: CLIENT, quality_id: QUALITY, shade_id: SHADE, input_kg: 60, date: new Date().toISOString().split('T')[0] });
  check('dyeing batch started', db.status === 201 || db.status === 200, `status ${db.status}`);
  const did = db.json.id, batchNo = db.json.batch_no;
  check('batch number generated', !!batchNo, batchNo);
  const grey2 = await greyTotal();
  check('grey_stock consumed by dyeing (~ -60)', Math.abs((grey1 - grey2) - 60) < 0.01, `Δgrey=${(grey1 - grey2).toFixed(2)}`);

  // 5. complete dyeing -> dyed_stock
  const dc = await call(`/production/dyeing/${did}/approve`, admin, 'PUT', { output_kg: 58, chemicals: [] });
  check('dyeing completed', dc.status === 200, `status ${dc.status}`);
  const dyed1 = await dyedTotal();
  check('dyed_stock increased by ~58', Math.abs((dyed1 - dyed0) - 58) < 0.01, `Δdyed=${(dyed1 - dyed0).toFixed(2)}`);

  // 6. dyed batch visible to coning
  const ds = await call('/production/dyed-stock', coning);
  const myBatch = (ds.json || []).find(b => b.id);
  check('dyed batch listed for coning worker', Array.isArray(ds.json) && ds.json.length > 0, `${(ds.json || []).length} batches`);
  const dyedStockId = (ds.json || []).find(b => b.batch_no === batchNo)?.id;

  // 7. coning entry (worker, picks batch)
  const cp = await call('/production/coning', coning, 'POST', { dyed_stock_id: dyedStockId, cone_weight_kg: 1.45, cones_count: 40, date: new Date().toISOString().split('T')[0] });
  check('coning entry submitted', cp.status === 201 || cp.status === 200, `status ${cp.status}`);
  const cid = cp.json.id;

  // 8. approve coning -> consume dyed + ready_stock
  const ca = await call(`/production/coning/${cid}/approve`, admin, 'PUT', {});
  check('coning approved', ca.status === 200, `status ${ca.status}`);
  const packed1 = await packedTotal();
  check('ready/packed stock increased (~58kg = 1.45*40)', Math.abs((packed1 - packed0) - 58) < 0.5, `Δpacked=${(packed1 - packed0).toFixed(2)}`);
  const dyed2 = await dyedTotal();
  check('dyed_stock consumed by coning', dyed2 < dyed1, `dyed ${dyed1.toFixed(1)}→${dyed2.toFixed(1)}`);

  // 9. challan from packed stock
  const ready = await call('/stock/ready?status=available', admin);
  const rs = (ready.json || []).find(r => String(r.client_id) === String(CLIENT));
  const chal = await call('/challans', admin, 'POST', { client_id: CLIENT, items: [{ ready_stock_id: rs?.id, item_name: '2/30s Cotton', color: 'Navy Blue', cones: 40, gross_kg: 58.5, tare_kg: 0.5, rate: 220 }] });
  check('challan created', chal.status === 201 || chal.status === 200, `status ${chal.status} ${chal.json.challan_no || ''}`);
  const chId = chal.json.id;

  // 10. challan totals + words
  const cv = await call(`/challans/${chId}`, admin);
  const net = Number(cv.json.total_net_kg), gt = Number(cv.json.grand_total);
  check('challan net wt = gross-tare (58.00)', Math.abs(net - 58) < 0.01, `net=${net}`);
  check('challan amount = net*rate (12760) rounded', Math.abs(gt - Math.round(58 * 220)) < 1, `grand=${gt}`);
  check('rupees-in-words present', typeof cv.json.amount_in_words === 'string' && cv.json.amount_in_words.startsWith('Rupees'), cv.json.amount_in_words);

  // 11. ready stock now dispatched
  const ready2 = await call('/stock/ready?status=available', admin);
  const stillThere = (ready2.json || []).some(r => r.id === rs?.id);
  check('packed stock marked dispatched after challan', !stillThere);

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
