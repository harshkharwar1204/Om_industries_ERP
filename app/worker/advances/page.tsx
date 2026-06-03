'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { StatusBadge, useToast, Icon } from '@/components/ui';

export default function WorkerAdvancesPage() {
  const [advances, setAdvances]   = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [form, setForm]           = useState({ amount: '', note: '' });
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  const load = () => apiFetch('/advances/my').then(setAdvances).catch(e => toast(e.message, 'error')).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.amount || Number(form.amount) <= 0) { toast('Enter valid amount', 'error'); return; }
    setSubmitting(true);
    try {
      await apiFetch('/advances', { method: 'POST', body: JSON.stringify(form) });
      toast('Advance request submitted');
      setForm({ amount: '', note: '' });
      load();
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setSubmitting(false); }
  };

  const approved = advances.filter(a => a.status === 'approved');
  const totalApproved = approved.reduce((s, a) => s + Number(a.amount), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
      <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 20 }}>Salary Advance</h2>

      {approved.length > 0 && (
        <div className="card" style={{ padding: 16, borderLeft: '3px solid var(--warning)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <Icon name="indian-rupee" size={22} color="var(--warning)" />
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Advances Approved</div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-heading)', color: 'var(--warning)', marginTop: 2 }}>₹{totalApproved}</div>
          </div>
        </div>
      )}

      {/* Request form */}
      <div className="card">
        <div className="card-body">
          <h3 style={{ marginBottom: 18, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="indian-rupee" size={16} color="var(--accent)" /> Request Advance
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Amount (₹) *</label>
              <input
                className="form-input"
                type="number" inputMode="numeric" min="0" value={form.amount}
                onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                placeholder="Enter amount"
                style={{ fontSize: 22, textAlign: 'center', fontWeight: 700, fontFamily: 'var(--font-heading)', height: 56 }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Reason (optional)</label>
              <input
                className="form-input"
                value={form.note}
                onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
                placeholder="Medical, travel, etc."
              />
            </div>
            <button
              className="btn btn-primary"
              style={{ width: '100%', fontSize: 16, padding: 14, gap: 8 }}
              onClick={submit}
              disabled={submitting}
              type="button"
            >
              {submitting ? (
                <><div className="loading-spinner loading-spinner-sm" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} /> Requesting…</>
              ) : (
                <><Icon name="plus" size={17} /> Request Advance</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* History */}
      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 16 }}>Past Requests</h3>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><div className="loading-spinner" /></div>
      ) : advances.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Icon name="indian-rupee" size={40} color="var(--primary-light)" />
            <p className="empty-state-title" style={{ marginTop: 12 }}>No requests yet</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {advances.map(a => (
            <div key={a.id} className="card">
              <div className="card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 20, fontFamily: 'var(--font-heading)' }}>₹{a.amount}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 3 }}>
                      {new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {a.note ? ` · ${a.note}` : ''}
                    </div>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
