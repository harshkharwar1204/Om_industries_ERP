'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader, StatusBadge, useToast, Icon } from '@/components/ui';

interface Entry {
  id: number; worker_id: number; date: string;
  cone_weight_kg: number; cones_count: number; output_kg: number;
  quality_check: string; status: string;
  rate_per_kg: number | null; total_earned: number | null;
  erp_users?: { name: string }; clients?: { name: string }; qualities?: { name: string };
}

export default function ConningPage() {
  const [entries, setEntries]     = useState<Entry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [statusFilter, setStatus] = useState('');
  const [actionId, setActionId]   = useState<number | null>(null);
  const toast = useToast();

  const load = (s = statusFilter) => {
    setLoading(true);
    apiFetch(`/production/coning${s ? `?status=${s}` : ''}`)
      .then(setEntries)
      .catch(e => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [statusFilter]);

  const action = async (id: number, type: 'approve' | 'reject') => {
    setActionId(id);
    try {
      await apiFetch(`/production/coning/${id}/${type}`, { method: 'PUT' });
      toast(type === 'approve' ? 'Approved ✓' : 'Rejected');
      load();
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setActionId(null); }
  };

  const pending = entries.filter(e => e.status === 'pending');
  const totalCones = entries.reduce((s, e) => s + Number(e.cones_count), 0);
  const totalKg    = entries.reduce((s, e) => s + Number(e.output_kg), 0);

  return (
    <div className="page-enter">
      <PageHeader title="Conning Production" subtitle={`${entries.length} entries`} />

      {/* Stats */}
      <div className="grid-3" style={{ marginBottom: 24 }}>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: '#DBEAFE', color: 'var(--info)' }}><Icon name="box" size={24} /></div>
          <div className="stat-content"><div className="stat-label">Total Cones</div><div className="stat-value">{totalCones.toLocaleString('en-IN')}</div></div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: 'var(--success)18', color: 'var(--success)' }}><Icon name="package" size={24} /></div>
          <div className="stat-content"><div className="stat-label">Total Output (kg)</div><div className="stat-value">{totalKg.toFixed(1)}</div></div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: 'var(--warning)18', color: 'var(--warning)' }}><Icon name="clock" size={24} /></div>
          <div className="stat-content"><div className="stat-label">Pending</div><div className="stat-value">{pending.length}</div></div>
        </div>
      </div>

      {/* Pending approvals */}
      {pending.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-body" style={{ borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--warning)', animation: 'pulse-urgent 1.5s ease-in-out infinite' }} />
            <h3 style={{ fontSize: 16 }}>Pending Approvals</h3>
            <span className="badge badge-pending">{pending.length}</span>
          </div>
          {pending.map(e => (
            <div key={e.id} className="approval-card">
              <div className="approval-avatar">{(e.erp_users?.name ?? 'W')[0]}</div>
              <div className="approval-info">
                <div style={{ fontWeight: 600, fontSize: 15 }}>{e.erp_users?.name}</div>
                <div className="text-secondary text-sm" style={{ marginTop: 2 }}>
                  {e.clients?.name} · {e.qualities?.name} ·{' '}
                  <strong style={{ color: 'var(--text)' }}>{e.cones_count} cones</strong> ·{' '}
                  <strong style={{ color: 'var(--text)' }}>{e.output_kg} kg</strong> ·{' '}
                  {new Date(e.date).toLocaleDateString('en-IN')}
                </div>
              </div>
              <div className="approval-actions">
                <button className="btn btn-success btn-sm" onClick={() => action(e.id, 'approve')} disabled={actionId === e.id} style={{ gap: 6 }}>
                  <Icon name="check" size={14} /> Approve
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => action(e.id, 'reject')} disabled={actionId === e.id} style={{ gap: 6 }}>
                  <Icon name="x" size={14} /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Log */}
      <div className="card">
        <div className="card-body" style={{ borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <h3 style={{ fontSize: 16 }}>Production Log</h3>
          <select className="form-select" value={statusFilter} onChange={e => setStatus(e.target.value)} style={{ maxWidth: 160, minHeight: 38, fontSize: 14 }}>
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        {loading ? (
          <div style={{ padding: '40px 20px', display: 'flex', justifyContent: 'center' }}><div className="loading-spinner" /></div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th><th>Worker</th><th>Client</th><th>Quality</th>
                  <th>Cone Wt</th><th>Cones</th><th>Output (kg)</th>
                  <th>Quality Check</th><th>Rate</th><th>Earned</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id}>
                    <td className="text-sm">{new Date(e.date).toLocaleDateString('en-IN')}</td>
                    <td><strong>{e.erp_users?.name}</strong></td>
                    <td>{e.clients?.name}</td>
                    <td>{e.qualities?.name}</td>
                    <td style={{ fontFamily: 'var(--font-heading)' }}>{e.cone_weight_kg} kg</td>
                    <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>{e.cones_count}</td>
                    <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>{e.output_kg} kg</td>
                    <td><StatusBadge status={e.quality_check} /></td>
                    <td>{e.rate_per_kg ? `₹${e.rate_per_kg}` : '—'}</td>
                    <td style={{ color: e.total_earned ? 'var(--success)' : undefined, fontWeight: e.total_earned ? 600 : 400 }}>
                      {e.total_earned ? `₹${e.total_earned}` : '—'}
                    </td>
                    <td><StatusBadge status={e.status} /></td>
                    <td>
                      {e.status === 'pending' && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-success btn-sm" style={{ width: 32, height: 32, padding: 0, minHeight: 32 }} onClick={() => action(e.id, 'approve')} disabled={actionId === e.id} title="Approve"><Icon name="check" size={14} /></button>
                          <button className="btn btn-danger btn-sm" style={{ width: 32, height: 32, padding: 0, minHeight: 32 }} onClick={() => action(e.id, 'reject')} disabled={actionId === e.id} title="Reject"><Icon name="x" size={14} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr><td colSpan={12}>
                    <div className="empty-state" style={{ padding: '32px 24px' }}>
                      <Icon name="box" size={40} color="var(--primary-light)" />
                      <p className="empty-state-title" style={{ marginTop: 12 }}>No conning entries</p>
                    </div>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
