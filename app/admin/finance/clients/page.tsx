// app/admin/finance/clients/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader, useToast, Icon } from '@/components/ui';

interface Transaction {
  id: number; client_id: number; date: string; type: string;
  particulars: string; amount: number; created_at: string;
  clients?: { name: string };
}
interface Summary {
  client_id: number; client_name: string;
  total_debit: number; total_credit: number; balance: number;
}
type Tab = 'ledger' | 'collections' | 'adjustments';

const BLANK = { client_id: '', date: new Date().toISOString().split('T')[0], amount: '', particulars: '' };

const tabStyle = (active: boolean) => ({
  padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer',
  fontFamily: 'var(--font-heading)', fontWeight: active ? 700 : 400, fontSize: 14,
  color: active ? 'var(--accent)' : 'var(--text-secondary)',
  borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
  marginBottom: -2, textTransform: 'capitalize' as const,
});

export default function ClientFinancePage() {
  const [tab, setTab]           = useState<Tab>('ledger');
  const [clients, setClients]   = useState<any[]>([]);
  const [summary, setSummary]   = useState<Summary[]>([]);
  const [selected, setSelected] = useState<number | ''>('');
  const [txns, setTxns]         = useState<Transaction[]>([]);
  const [loadingL, setLoadingL] = useState(false);
  const [loadingS, setLoadingS] = useState(true);
  const [form, setForm]         = useState(BLANK);
  const [saving, setSaving]     = useState(false);
  const toast = useToast();

  const loadSummary = () => {
    setLoadingS(true);
    apiFetch('/finance/clients').then(setSummary).catch(e => toast(e.message, 'error')).finally(() => setLoadingS(false));
  };

  const loadLedger = (id: number) => {
    setLoadingL(true);
    apiFetch(`/finance/clients?client_id=${id}`)
      .then(setTxns).catch(e => toast(e.message, 'error')).finally(() => setLoadingL(false));
  };

  useEffect(() => {
    apiFetch('/clients').then(setClients).catch(e => toast(e.message, 'error'));
    loadSummary();
  }, []);

  useEffect(() => {
    if (selected) loadLedger(selected as number);
    else setTxns([]);
  }, [selected]);

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  // Compute running balance client-side
  const ledgerRows = txns.map((t, i) => {
    const prevBal = txns.slice(0, i).reduce((s, r) => s + (r.type === 'debit' ? Number(r.amount) : -Number(r.amount)), 0);
    return { ...t, balance: prevBal + (t.type === 'debit' ? Number(t.amount) : -Number(t.amount)) };
  });

  const submit = async (type: 'credit' | 'adjustment') => {
    if (!form.client_id || !form.amount) { toast('Client and amount required', 'error'); return; }
    setSaving(true);
    try {
      await apiFetch('/finance/clients', { method: 'POST', body: JSON.stringify({ ...form, type }) });
      toast(type === 'credit' ? 'Payment recorded' : 'Adjustment saved');
      setForm(BLANK);
      loadSummary();
      if (selected && String(selected) === form.client_id) loadLedger(Number(form.client_id));
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const totalOutstanding = summary.reduce((s, r) => s + r.balance, 0);

  return (
    <div className="page-enter">
      <PageHeader title="Client Finance" subtitle={`${summary.length} clients · ₹${totalOutstanding.toLocaleString('en-IN')} outstanding`} />

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--border)' }}>
        {(['ledger', 'collections', 'adjustments'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={tabStyle(tab === t)}>{t}</button>
        ))}
      </div>

      {/* Ledger */}
      {tab === 'ledger' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            {loadingS ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="loading-spinner" /></div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Client</th><th>Total Billed</th><th>Total Paid</th><th>Balance Due</th></tr></thead>
                  <tbody>
                    {summary.map(r => (
                      <tr key={r.client_id} onClick={() => setSelected(r.client_id)}
                        style={{ cursor: 'pointer', background: selected === r.client_id ? 'var(--hover-bg)' : undefined }}>
                        <td><strong>{r.client_name}</strong></td>
                        <td style={{ fontFamily: 'var(--font-heading)', color: 'var(--danger)' }}>₹{r.total_debit.toLocaleString('en-IN')}</td>
                        <td style={{ fontFamily: 'var(--font-heading)', color: 'var(--success)' }}>₹{r.total_credit.toLocaleString('en-IN')}</td>
                        <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: r.balance > 0 ? 'var(--warning)' : 'var(--success)' }}>
                          ₹{r.balance.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                    {summary.length === 0 && (
                      <tr><td colSpan={4}><div className="empty-state">
                        <Icon name="wallet" size={40} color="var(--primary-light)" />
                        <p className="empty-state-title">No transactions yet</p>
                      </div></td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {selected && (
            <div className="card">
              <div className="card-body" style={{ borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 15 }}>Ledger — {summary.find(s => s.client_id === selected)?.client_name}</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setSelected('')}>Close</button>
              </div>
              {loadingL ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><div className="loading-spinner" /></div>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead><tr><th>Date</th><th>Particulars</th><th>Debit (₹)</th><th>Credit (₹)</th><th>Balance (₹)</th></tr></thead>
                    <tbody>
                      {ledgerRows.map(r => (
                        <tr key={r.id}>
                          <td className="text-sm">{new Date(r.date).toLocaleDateString('en-IN')}</td>
                          <td>{r.particulars}</td>
                          <td style={{ fontFamily: 'var(--font-heading)', color: r.type === 'debit' ? 'var(--danger)' : undefined }}>
                            {r.type === 'debit' ? `₹${Number(r.amount).toLocaleString('en-IN')}` : '—'}
                          </td>
                          <td style={{ fontFamily: 'var(--font-heading)', color: r.type !== 'debit' ? 'var(--success)' : undefined }}>
                            {r.type !== 'debit' ? `₹${Number(r.amount).toLocaleString('en-IN')}` : '—'}
                          </td>
                          <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, color: r.balance > 0 ? 'var(--warning)' : 'var(--success)' }}>
                            ₹{r.balance.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                      {ledgerRows.length === 0 && (
                        <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 24 }}>No transactions</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Collections */}
      {tab === 'collections' && (
        <div className="card" style={{ maxWidth: 480 }}>
          <div className="card-body">
            <h3 style={{ marginBottom: 20, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="plus-circle" size={16} color="var(--success)" /> Record Payment
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Client *</label>
                <select className="form-select" value={form.client_id} onChange={f('client_id')}>
                  <option value="">Select client…</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Amount (₹) *</label>
                  <input className="form-input" type="number" min="0" step="0.01" value={form.amount} onChange={f('amount')} placeholder="0.00" />
                </div>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input className="form-input" type="date" value={form.date} onChange={f('date')} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Particulars</label>
                <input className="form-input" value={form.particulars} onChange={f('particulars')} placeholder="Cheque #1234, NEFT ref…" />
              </div>
              <button className="btn btn-success" style={{ width: '100%', fontSize: 15 }} onClick={() => submit('credit')} disabled={saving}>
                {saving ? 'Saving…' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjustments */}
      {tab === 'adjustments' && (
        <div className="card" style={{ maxWidth: 480 }}>
          <div className="card-body">
            <h3 style={{ marginBottom: 20, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="sliders-horizontal" size={16} color="var(--info)" /> Add Adjustment
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Client *</label>
                <select className="form-select" value={form.client_id} onChange={f('client_id')}>
                  <option value="">Select client…</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Amount (₹) *</label>
                  <input className="form-input" type="number" min="0" step="0.01" value={form.amount} onChange={f('amount')} placeholder="0.00" />
                </div>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input className="form-input" type="date" value={form.date} onChange={f('date')} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Particulars *</label>
                <input className="form-input" value={form.particulars} onChange={f('particulars')} placeholder="Return / damage deduction…" />
              </div>
              <button className="btn btn-primary" style={{ width: '100%', fontSize: 15 }} onClick={() => submit('adjustment')} disabled={saving}>
                {saving ? 'Saving…' : 'Save Adjustment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
