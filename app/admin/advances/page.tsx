'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader, StatusBadge, useToast, Icon } from '@/components/ui';

export default function AdvancesPage() {
  const [advances, setAdvances] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('');
  const [actionId, setActionId] = useState<number | null>(null);
  const toast = useToast();

  const load = (s = filter) => {
    setLoading(true);
    apiFetch(`/advances${s ? `?status=${s}` : ''}`)
      .then(setAdvances).catch(e => toast(e.message, 'error')).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [filter]);

  const action = async (id: number, type: 'approve' | 'reject') => {
    setActionId(id);
    try {
      await apiFetch(`/advances/${id}/${type}`, { method: 'PUT' });
      toast(type === 'approve' ? 'Advance approved' : 'Advance rejected');
      load();
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setActionId(null); }
  };

  const pending = advances.filter(a => a.status === 'pending');

  return (
    <div className="page-enter">
      <PageHeader title="Advances" subtitle={`${advances.length} requests · ${pending.length} pending`} />

      {pending.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-body" style={{ borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--warning)', animation: 'pulse-urgent 1.5s ease-in-out infinite' }} />
            <h3 style={{ fontSize: 16 }}>Pending Requests</h3>
            <span className="badge badge-pending">{pending.length}</span>
          </div>
          {pending.map(a => (
            <div key={a.id} className="approval-card">
              <div className="approval-avatar">{(a.erp_users?.name ?? 'W')[0]}</div>
              <div className="approval-info">
                <div style={{ fontWeight: 600 }}>{a.erp_users?.name}</div>
                <div className="text-secondary text-sm">
                  <strong style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>₹{a.amount}</strong>
                  {a.note ? ` · ${a.note}` : ''} · {new Date(a.created_at).toLocaleDateString('en-IN')}
                </div>
              </div>
              <div className="approval-actions">
                <button className="btn btn-success btn-sm" onClick={() => action(a.id, 'approve')} disabled={actionId === a.id} style={{ gap: 6 }}>
                  <Icon name="check" size={14} /> Approve
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => action(a.id, 'reject')} disabled={actionId === a.id} style={{ gap: 6 }}>
                  <Icon name="x" size={14} /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-body" style={{ borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <h3 style={{ fontSize: 16 }}>All Requests</h3>
          <select className="form-select" value={filter} onChange={e => setFilter(e.target.value)} style={{ maxWidth: 160, minHeight: 38, fontSize: 14 }}>
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        {loading ? (
          <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><div className="loading-spinner" /></div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Worker</th><th>Dept</th><th>Amount (₹)</th><th>Note</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {advances.map(a => (
                  <tr key={a.id}>
                    <td><strong>{a.erp_users?.name}</strong></td>
                    <td className="text-secondary text-sm">{a.erp_users?.department || '—'}</td>
                    <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 700 }}>₹{a.amount}</td>
                    <td className="text-secondary text-sm">{a.note || '—'}</td>
                    <td className="text-sm">{new Date(a.created_at).toLocaleDateString('en-IN')}</td>
                    <td><StatusBadge status={a.status} /></td>
                    <td>
                      {a.status === 'pending' && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-success btn-sm" style={{ width: 32, height: 32, padding: 0, minHeight: 32 }} onClick={() => action(a.id, 'approve')} disabled={actionId === a.id}><Icon name="check" size={14} /></button>
                          <button className="btn btn-danger btn-sm" style={{ width: 32, height: 32, padding: 0, minHeight: 32 }} onClick={() => action(a.id, 'reject')} disabled={actionId === a.id}><Icon name="x" size={14} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {advances.length === 0 && (
                  <tr><td colSpan={7}><div className="empty-state"><Icon name="indian-rupee" size={40} color="var(--primary-light)" /><p className="empty-state-title">No advance requests</p></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
