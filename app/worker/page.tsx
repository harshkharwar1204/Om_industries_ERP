'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useToast, Icon } from '@/components/ui';

export default function ProductionEntryPage() {
  const [clients, setClients]     = useState<any[]>([]);
  const [qualities, setQualities] = useState<any[]>([]);
  const [form, setForm]           = useState({ client_id: '', quality_id: '', weight_kg: '0' });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess]     = useState('');
  const { user } = useAuth();
  const toast = useToast();

  useEffect(() => {
    Promise.all([apiFetch('/clients'), apiFetch('/qualities')])
      .then(([c, q]) => { setClients(c); setQualities(q); })
      .catch(e => toast(e.message, 'error'));
  }, []);

  const adjust = (delta: number) => {
    setForm(p => ({ ...p, weight_kg: String(Math.max(0, (Number(p.weight_kg) || 0) + delta)) }));
  };

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
      setForm({ client_id: '', quality_id: '', weight_kg: '0' });
      setTimeout(() => setSuccess(''), 4000);
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setSubmitting(false); }
  };

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
      {/* Greeting */}
      <div style={{ paddingBottom: 4 }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 20, marginBottom: 4 }}>
          Hello, {user?.name?.split(' ')[0]} 👋
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{today}</p>
      </div>

      {/* Success banner */}
      {success && (
        <div style={{
          background: 'var(--success-light)', color: '#166534',
          border: '1px solid #86EFAC',
          padding: '14px 16px', borderRadius: 'var(--radius-sm)',
          display: 'flex', alignItems: 'center', gap: 10,
          fontWeight: 500, animation: 'slideUp 200ms ease',
        }}>
          <Icon name="check-circle" size={18} color="var(--success)" />
          {success}
        </div>
      )}

      {/* Entry form */}
      <div className="card">
        <div className="card-body">
          <h3 style={{ marginBottom: 20, fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="factory" size={18} color="var(--accent)" />
            Submit Today's Production
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            <div className="form-group">
              <label className="form-label">Client</label>
              <select className="form-select" value={form.client_id} onChange={e => setForm(p => ({ ...p, client_id: e.target.value }))} style={{ fontSize: 16 }}>
                <option value="">Select party…</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Quality</label>
              <select className="form-select" value={form.quality_id} onChange={e => setForm(p => ({ ...p, quality_id: e.target.value }))} style={{ fontSize: 16 }}>
                <option value="">Select quality…</option>
                {qualities.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Weight (kg)</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button
                  className="btn btn-secondary"
                  style={{ width: 52, height: 52, padding: 0, fontSize: 22, flexShrink: 0 }}
                  onClick={() => adjust(-0.5)}
                  type="button"
                >−</button>
                <input
                  className="form-input"
                  type="number" step="0.5" min="0" value={form.weight_kg}
                  onChange={e => setForm(p => ({ ...p, weight_kg: e.target.value }))}
                  style={{ textAlign: 'center', fontSize: 26, fontWeight: 700, fontFamily: 'var(--font-heading)', height: 56 }}
                  inputMode="decimal"
                />
                <button
                  className="btn btn-secondary"
                  style={{ width: 52, height: 52, padding: 0, fontSize: 22, flexShrink: 0 }}
                  onClick={() => adjust(0.5)}
                  type="button"
                >+</button>
              </div>
            </div>

            <button
              className="btn btn-primary"
              style={{ width: '100%', fontSize: 17, fontWeight: 600, padding: '16px', marginTop: 4, gap: 10 }}
              onClick={submit}
              disabled={submitting}
              type="button"
            >
              {submitting ? (
                <><div className="loading-spinner loading-spinner-sm" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} /> Submitting…</>
              ) : (
                <><Icon name="check" size={18} /> Submit Production</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
