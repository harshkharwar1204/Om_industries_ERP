'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useToast, Icon, SearchableDropdown } from '@/components/ui';

/* ── Hanks entry form ── */
function HanksForm({ clients, qualities, orders }: { clients: any[]; qualities: any[]; orders: any[] }) {
  const [form, setForm]         = useState({ client_id: '', quality_id: '', order_id: '', weight_kg: '0' });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess]   = useState('');
  const toast = useToast();

  const adjust = (delta: number) =>
    setForm(p => ({ ...p, weight_kg: String(Math.max(0, (Number(p.weight_kg) || 0) + delta) )}));

  const selectedQuality = qualities.find(q => String(q.id) === form.quality_id);
  const estimatedEarnings = selectedQuality?.hanks_rate_per_kg
    ? (Number(form.weight_kg) * selectedQuality.hanks_rate_per_kg).toFixed(2)
    : null;

  const submit = async () => {
    if (!form.client_id || !form.quality_id) { toast('Select client and quality', 'error'); return; }
    const kg = Number(form.weight_kg);
    if (!kg || kg <= 0) { toast('Enter weight', 'error'); return; }
    setSubmitting(true);
    try {
      await apiFetch('/production/hanks', { method: 'POST', body: JSON.stringify({ ...form, date: new Date().toISOString().split('T')[0] }) });
      const clientName = clients.find(c => String(c.id) === form.client_id)?.name ?? '';
      setSuccess(`${kg} kg submitted for ${clientName} ✓`);
      toast(`${kg} kg submitted for approval`);
      setForm({ client_id: '', quality_id: '', order_id: '', weight_kg: '0' });
      setTimeout(() => setSuccess(''), 4000);
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setSubmitting(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {success && (
        <div style={{ background: 'var(--success-light)', color: '#166534', border: '1px solid #86EFAC', padding: '14px 16px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: 10, fontWeight: 500 }}>
          <Icon name="check-circle" size={18} color="var(--success)" />{success}
        </div>
      )}
      <div className="card">
        <div className="card-body">
          <h3 style={{ marginBottom: 20, fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="factory" size={18} color="var(--accent)" />Submit Today's Production
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Order</label>
              <select className="form-select" value={form.order_id} style={{ fontSize: 16 }}
                onChange={e => {
                  const o = orders.find(x => String(x.id) === e.target.value);
                  setForm(p => ({ ...p, order_id: e.target.value, client_id: o ? String(o.client_id ?? '') : p.client_id, quality_id: o ? String(o.quality_id ?? '') : p.quality_id }));
                }}>
                <option value="">Select order…</option>
                {orders.map(o => <option key={o.id} value={o.id}>{o.clients?.name ?? '—'} · {o.qualities?.name ?? ''} · {o.qty_kg}kg{o.po_number ? ` · ${o.po_number}` : ''}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Client</label>
              <SearchableDropdown options={clients.map(c => ({ label: c.name, value: c.id }))} value={form.client_id} onChange={v => setForm(p => ({ ...p, client_id: String(v) }))} placeholder="Search party…" />
            </div>
            <div className="form-group">
              <label className="form-label">Quality</label>
              <SearchableDropdown options={qualities.map(q => ({ label: q.name, value: q.id }))} value={form.quality_id} onChange={v => setForm(p => ({ ...p, quality_id: String(v) }))} placeholder="Search quality…" />
            </div>
            <div className="form-group">
              <label className="form-label">Weight (kg)</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button className="btn btn-secondary" style={{ width: 52, height: 52, padding: 0, fontSize: 22, flexShrink: 0 }} onClick={() => adjust(-0.5)} type="button">−</button>
                <input className="form-input" type="number" step="0.5" min="0" value={form.weight_kg}
                  onChange={e => setForm(p => ({ ...p, weight_kg: e.target.value }))}
                  style={{ textAlign: 'center', fontSize: 26, fontWeight: 700, fontFamily: 'var(--font-heading)', height: 56 }}
                  inputMode="decimal" />
                <button className="btn btn-secondary" style={{ width: 52, height: 52, padding: 0, fontSize: 22, flexShrink: 0 }} onClick={() => adjust(0.5)} type="button">+</button>
              </div>
            </div>
            {estimatedEarnings && Number(form.weight_kg) > 0 && (
              <div style={{ background: 'var(--success-light)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 500, color: '#166534', fontSize: 14 }}>Estimated Earnings</span>
                <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--success)', fontSize: 18 }}>₹{estimatedEarnings}</span>
              </div>
            )}
            <button className="btn btn-primary" style={{ width: '100%', fontSize: 17, fontWeight: 600, padding: '16px', marginTop: 4, gap: 10 }}
              onClick={submit} disabled={submitting} type="button">
              {submitting ? <><div className="loading-spinner loading-spinner-sm" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} /> Submitting…</> : <><Icon name="check" size={18} /> Submit Production</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Coning entry form ── */
function ConingForm({ clients, qualities, batches }: { clients: any[]; qualities: any[]; batches: any[] }) {
  const [form, setForm]         = useState({ client_id: '', quality_id: '', shade_id: '', dyed_stock_id: '', cone_weight_kg: '1.0', cones_count: '0' });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess]   = useState('');
  const toast = useToast();

  const pickBatch = (id: string) => {
    const b = batches.find(x => String(x.id) === id);
    setForm(p => ({
      ...p,
      dyed_stock_id: id,
      client_id:  b ? String(b.client_id ?? '') : p.client_id,
      quality_id: b ? String(b.quality_id ?? '') : p.quality_id,
      shade_id:   b ? String(b.shade_id ?? '') : p.shade_id,
    }));
  };
  const selectedBatch = batches.find(x => String(x.id) === form.dyed_stock_id);

  const outputKg = (Number(form.cone_weight_kg) * Number(form.cones_count)).toFixed(1);
  const selectedQuality = qualities.find(q => String(q.id) === form.quality_id);
  const estimatedEarnings = selectedQuality?.coning_rate_per_kg
    ? (Number(outputKg) * selectedQuality.coning_rate_per_kg).toFixed(2)
    : null;

  const submit = async () => {
    if (!form.client_id || !form.quality_id) { toast('Select client and quality', 'error'); return; }
    if (!Number(form.cones_count) || Number(form.cones_count) <= 0) { toast('Enter cones count', 'error'); return; }
    setSubmitting(true);
    try {
      await apiFetch('/production/coning', { method: 'POST', body: JSON.stringify({ ...form, date: new Date().toISOString().split('T')[0] }) });
      const clientName = clients.find(c => String(c.id) === form.client_id)?.name ?? '';
      setSuccess(`${form.cones_count} cones (${outputKg} kg) submitted for ${clientName} ✓`);
      toast(`${form.cones_count} cones submitted for approval`);
      setForm({ client_id: '', quality_id: '', shade_id: '', dyed_stock_id: '', cone_weight_kg: '1.0', cones_count: '0' });
      setTimeout(() => setSuccess(''), 4000);
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setSubmitting(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {success && (
        <div style={{ background: 'var(--success-light)', color: '#166534', border: '1px solid #86EFAC', padding: '14px 16px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: 10, fontWeight: 500 }}>
          <Icon name="check-circle" size={18} color="var(--success)" />{success}
        </div>
      )}
      <div className="card">
        <div className="card-body">
          <h3 style={{ marginBottom: 20, fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="box" size={18} color="var(--accent)" />Submit Today's Coning
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Dyed Batch</label>
              <select className="form-select" value={form.dyed_stock_id} onChange={e => pickBatch(e.target.value)} style={{ fontSize: 16 }}>
                <option value="">Select completed batch…</option>
                {batches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.batch_no} — {b.clients?.name ?? '—'} · {b.shades?.name ?? 'shade'} ({Number(b.remaining_kg).toFixed(1)} kg)
                  </option>
                ))}
              </select>
            </div>
            {selectedBatch && (
              <div style={{ background: '#DBEAFE', padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--info)' }}>
                Colour: <strong>{selectedBatch.shades?.name ?? '—'}</strong> · Quality: <strong>{selectedBatch.qualities?.name ?? '—'}</strong>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Client</label>
              <SearchableDropdown options={clients.map(c => ({ label: c.name, value: c.id }))} value={form.client_id} onChange={v => setForm(p => ({ ...p, client_id: String(v) }))} placeholder="Search party…" />
            </div>
            <div className="form-group">
              <label className="form-label">Quality</label>
              <SearchableDropdown options={qualities.map(q => ({ label: q.name, value: q.id }))} value={form.quality_id} onChange={v => setForm(p => ({ ...p, quality_id: String(v) }))} placeholder="Search quality…" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Cone Weight (kg)</label>
                <input className="form-input" type="number" step="0.1" min="0.1" value={form.cone_weight_kg}
                  onChange={e => setForm(p => ({ ...p, cone_weight_kg: e.target.value }))}
                  style={{ textAlign: 'center', fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-heading)', height: 52 }}
                  inputMode="decimal" />
              </div>
              <div className="form-group">
                <label className="form-label">Cones Count</label>
                <input className="form-input" type="number" min="0" value={form.cones_count}
                  onChange={e => setForm(p => ({ ...p, cones_count: e.target.value }))}
                  style={{ textAlign: 'center', fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-heading)', height: 52 }}
                  inputMode="numeric" />
              </div>
            </div>
            {Number(form.cones_count) > 0 && (
              <div style={{ background: '#DBEAFE', padding: '12px 16px', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 500, color: 'var(--info)', fontSize: 14 }}>Total Output</span>
                <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--info)', fontSize: 18 }}>{outputKg} kg</span>
              </div>
            )}
            {estimatedEarnings && Number(form.cones_count) > 0 && (
              <div style={{ background: 'var(--success-light)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 500, color: '#166534', fontSize: 14 }}>Estimated Earnings</span>
                <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--success)', fontSize: 18 }}>₹{estimatedEarnings}</span>
              </div>
            )}
            <button className="btn btn-primary" style={{ width: '100%', fontSize: 17, fontWeight: 600, padding: '16px', marginTop: 4, gap: 10 }}
              onClick={submit} disabled={submitting} type="button">
              {submitting ? <><div className="loading-spinner loading-spinner-sm" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} /> Submitting…</> : <><Icon name="check" size={18} /> Submit Coning</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main worker entry page ── */
export default function ProductionEntryPage() {
  const [clients, setClients]     = useState<any[]>([]);
  const [qualities, setQualities] = useState<any[]>([]);
  const [batches, setBatches]     = useState<any[]>([]);
  const [orders, setOrders]       = useState<any[]>([]);
  const { user } = useAuth();
  const toast = useToast();

  useEffect(() => {
    Promise.all([apiFetch('/clients'), apiFetch('/qualities')])
      .then(([c, q]) => { setClients(c); setQualities(q); })
      .catch(e => toast(e.message, 'error'));
    if (user?.role === 'coning_worker') {
      apiFetch('/production/dyed-stock').then(setBatches).catch(() => {});
    }
    if (user?.role === 'hanks_worker') {
      apiFetch('/orders/assigned').then(setOrders).catch(() => {});
    }
  }, [user?.role]);

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
      <div style={{ paddingBottom: 4 }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 20, marginBottom: 4 }}>
          Hello, {user?.name?.split(' ')[0]} 👋
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{today}</p>
      </div>

      {user?.role === 'coning_worker'
        ? <ConingForm clients={clients} qualities={qualities} batches={batches} />
        : <HanksForm clients={clients} qualities={qualities} orders={orders} />
      }
    </div>
  );
}
