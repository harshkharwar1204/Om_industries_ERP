// app/admin/finance/workers/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader, Modal, StatusBadge, useToast, Icon } from '@/components/ui';

interface Loan {
  id: number; worker_id: number; loan_amount: number; hapta_amount: number;
  total_paid: number; outstanding: number; status: string; date: string;
  erp_users?: { name: string; department: string | null };
}

type Tab = 'loans' | 'advances';

const BLANK_LOAN  = { worker_id: '', loan_amount: '', hapta_amount: '' };
const BLANK_HAPTA = { amount: '', date: new Date().toISOString().split('T')[0], remarks: '' };

const tabStyle = (active: boolean) => ({
  padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer',
  fontFamily: 'var(--font-heading)', fontWeight: active ? 700 : 400, fontSize: 14,
  color: active ? 'var(--accent)' : 'var(--text-secondary)',
  borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
  marginBottom: -2, textTransform: 'capitalize' as const,
});

export default function WorkerFinancePage() {
  const [tab, setTab]             = useState<Tab>('loans');
  const [loans, setLoans]         = useState<Loan[]>([]);
  const [advances, setAdvances]   = useState<any[]>([]);
  const [workers, setWorkers]     = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [loanModal, setLoanModal] = useState(false);
  const [haptaTarget, setHaptaTarget] = useState<Loan | null>(null);
  const [form, setForm]           = useState(BLANK_LOAN);
  const [haptaForm, setHaptaForm] = useState(BLANK_HAPTA);
  const [saving, setSaving]       = useState(false);
  const [actionId, setActionId]   = useState<number | null>(null);
  const toast = useToast();

  const loadLoans = () => apiFetch('/loans').then(setLoans).catch(e => toast(e.message, 'error'));
  const loadAdvances = () => {
    setLoading(true);
    apiFetch('/advances').then(setAdvances).catch(e => toast(e.message, 'error')).finally(() => setLoading(false));
  };

  useEffect(() => {
    apiFetch('/workers').then(setWorkers).catch(e => toast(e.message, 'error'));
    loadLoans();
    loadAdvances();
  }, []);

  const f  = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value }));
  const hf = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setHaptaForm(p => ({ ...p, [k]: e.target.value }));

  const saveLoan = async () => {
    if (!form.worker_id || !form.loan_amount || !form.hapta_amount) { toast('All fields required', 'error'); return; }
    setSaving(true);
    try {
      await apiFetch('/loans', { method: 'POST', body: JSON.stringify(form) });
      toast('Loan created'); setLoanModal(false); setForm(BLANK_LOAN); loadLoans();
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const recordHapta = async () => {
    if (!haptaTarget || !haptaForm.amount) { toast('Amount required', 'error'); return; }
    setSaving(true);
    try {
      await apiFetch(`/loans/${haptaTarget.id}/hapta`, { method: 'POST', body: JSON.stringify(haptaForm) });
      toast('Repayment recorded'); setHaptaTarget(null); setHaptaForm(BLANK_HAPTA); loadLoans();
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const advanceAction = async (id: number, type: 'approve' | 'reject') => {
    setActionId(id);
    try {
      await apiFetch(`/advances/${id}/${type}`, { method: 'PUT' });
      toast(type === 'approve' ? 'Approved' : 'Rejected'); loadAdvances();
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setActionId(null); }
  };

  const activeLoans     = loans.filter(l => l.status === 'active');
  const totalOutstanding = activeLoans.reduce((s, l) => s + Number(l.outstanding), 0);
  const pendingAdvances = advances.filter(a => a.status === 'pending');

  return (
    <div className="page-enter">
      <PageHeader title="Worker Finance" subtitle={`${activeLoans.length} active loans · ₹${totalOutstanding.toLocaleString('en-IN')} outstanding`} icon="banknote" iconColor="var(--warning)">
        {tab === 'loans' && (
          <button className="btn btn-primary" onClick={() => { setForm(BLANK_LOAN); setLoanModal(true); }}>
            <Icon name="plus" size={16} /> New Loan
          </button>
        )}
      </PageHeader>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--border)' }}>
        <button onClick={() => setTab('loans')} style={tabStyle(tab === 'loans')}>
          Loans {activeLoans.length > 0 && <span className="badge badge-info" style={{ marginLeft: 6 }}>{activeLoans.length}</span>}
        </button>
        <button onClick={() => setTab('advances')} style={tabStyle(tab === 'advances')}>
          Advances {pendingAdvances.length > 0 && <span className="badge badge-pending" style={{ marginLeft: 6 }}>{pendingAdvances.length}</span>}
        </button>
      </div>

      {/* Loans tab */}
      {tab === 'loans' && (
        <div className="card">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Worker</th><th>Loan Amount</th><th>Installment/mo</th><th>Total Paid</th><th>Outstanding</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {loans.map(l => (
                  <tr key={l.id}>
                    <td>
                      <strong>{l.erp_users?.name}</strong>
                      <br /><span className="text-secondary text-sm">{l.erp_users?.department || '—'}</span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-heading)' }}>₹{Number(l.loan_amount).toLocaleString('en-IN')}</td>
                    <td style={{ fontFamily: 'var(--font-heading)' }}>₹{Number(l.hapta_amount).toLocaleString('en-IN')}</td>
                    <td style={{ fontFamily: 'var(--font-heading)', color: 'var(--success)' }}>₹{Number(l.total_paid).toLocaleString('en-IN')}</td>
                    <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: Number(l.outstanding) > 0 ? 'var(--warning)' : 'var(--success)' }}>
                      ₹{Number(l.outstanding).toLocaleString('en-IN')}
                    </td>
                    <td><StatusBadge status={l.status} /></td>
                    <td>
                      {l.status === 'active' && (
                        <button className="btn btn-sm btn-primary"
                          onClick={() => { setHaptaTarget(l); setHaptaForm({ ...BLANK_HAPTA, amount: String(l.hapta_amount) }); }}>
                          Record Hapta
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {loans.length === 0 && (
                  <tr><td colSpan={7}><div className="empty-state">
                    <Icon name="banknote" size={40} color="var(--primary-light)" />
                    <p className="empty-state-title">No loans</p>
                  </div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Advances tab */}
      {tab === 'advances' && (
        <div className="card">
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="loading-spinner" /></div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Worker</th><th>Amount</th><th>Note</th><th>Date</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {advances.map(a => (
                    <tr key={a.id}>
                      <td><strong>{a.erp_users?.name}</strong></td>
                      <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 700 }}>₹{a.amount}</td>
                      <td className="text-secondary text-sm">{a.note || '—'}</td>
                      <td className="text-sm">{new Date(a.created_at).toLocaleDateString('en-IN')}</td>
                      <td><StatusBadge status={a.status} /></td>
                      <td>
                        {a.status === 'pending' && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-success btn-sm" onClick={() => advanceAction(a.id, 'approve')} disabled={actionId === a.id}>
                              <Icon name="check" size={14} /> Approve
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => advanceAction(a.id, 'reject')} disabled={actionId === a.id}>
                              <Icon name="x" size={14} /> Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {advances.length === 0 && (
                    <tr><td colSpan={6}><div className="empty-state">
                      <Icon name="indian-rupee" size={40} color="var(--primary-light)" />
                      <p className="empty-state-title">No advances</p>
                    </div></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* New Loan Modal */}
      <Modal open={loanModal} onClose={() => setLoanModal(false)} title="New Worker Loan"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setLoanModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveLoan} disabled={saving}>{saving ? 'Saving…' : 'Create Loan'}</button>
          </>
        }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Worker *</label>
            <select className="form-select" value={form.worker_id} onChange={f('worker_id')}>
              <option value="">Select worker…</option>
              {workers.map(w => <option key={w.id} value={w.id}>{w.name} ({(w.role ?? '').replace('_', ' ')})</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Loan Amount (₹) *</label>
              <input className="form-input" type="number" min="0" value={form.loan_amount} onChange={f('loan_amount')} placeholder="0" />
            </div>
            <div className="form-group">
              <label className="form-label">Monthly Installment (₹) *</label>
              <input className="form-input" type="number" min="0" value={form.hapta_amount} onChange={f('hapta_amount')} placeholder="0" />
            </div>
          </div>
        </div>
      </Modal>

      {/* Record Hapta Modal */}
      <Modal open={!!haptaTarget} onClose={() => setHaptaTarget(null)}
        title={`Record Repayment — ${haptaTarget?.erp_users?.name ?? ''}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setHaptaTarget(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={recordHapta} disabled={saving}>{saving ? 'Saving…' : 'Record'}</button>
          </>
        }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: '#FEF9C3', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Outstanding: </span>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--warning)' }}>
              ₹{haptaTarget ? Number(haptaTarget.outstanding).toLocaleString('en-IN') : 0}
            </span>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Amount (₹) *</label>
              <input className="form-input" type="number" min="0" value={haptaForm.amount} onChange={hf('amount')} />
            </div>
            <div className="form-group">
              <label className="form-label">Date</label>
              <input className="form-input" type="date" value={haptaForm.date} onChange={hf('date')} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Remarks</label>
            <input className="form-input" value={haptaForm.remarks} onChange={hf('remarks')} placeholder="Optional note…" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
