'use client';
import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader, Icon, useToast } from '@/components/ui';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function PayrollPage() {
  const now = new Date();
  const [month, setMonth]   = useState(now.getMonth() + 1);
  const [year, setYear]     = useState(now.getFullYear());
  const [rows, setRows]     = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const toast = useToast();

  const generate = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/payroll/hanks?month=${month}&year=${year}`);
      setRows(data);
      setGenerated(true);
      if (!data.length) toast('No approved entries for this period', 'info');
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  };

  const exportXlsx = async () => {
    try {
      const blob = await apiFetch(`/payroll/hanks/export?month=${month}&year=${year}`) as Blob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `payroll-${year}-${String(month).padStart(2,'0')}.xlsx`;
      a.click(); URL.revokeObjectURL(url);
      toast('Excel downloaded');
    } catch (e: any) { toast(e.message, 'error'); }
  };

  const totalGross = rows.reduce((s, r) => s + r.gross_wages, 0);
  const totalNet   = rows.reduce((s, r) => s + r.net_wages, 0);
  const totalAdv   = rows.reduce((s, r) => s + r.total_advances, 0);

  return (
    <div className="page-enter">
      <PageHeader title="Payroll" subtitle="Monthly worker earnings summary" />

      {/* Controls */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
            <div className="form-group">
              <label className="form-label">Month</label>
              <select className="form-select" value={month} onChange={e => { setMonth(+e.target.value); setGenerated(false); }} style={{ minWidth: 120 }}>
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Year</label>
              <input className="form-input" type="number" value={year} onChange={e => { setYear(+e.target.value); setGenerated(false); }} style={{ maxWidth: 100 }} />
            </div>
            <button className="btn btn-primary" onClick={generate} disabled={loading} style={{ gap: 8 }}>
              {loading ? <><div className="loading-spinner loading-spinner-sm" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} /> Calculating…</> : <><Icon name="zap" size={16} /> Generate Payroll</>}
            </button>
            {generated && rows.length > 0 && (
              <button className="btn btn-secondary" onClick={exportXlsx} style={{ gap: 8 }}>
                <Icon name="download" size={16} /> Export Excel
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Summary cards */}
      {generated && rows.length > 0 && (
        <div className="grid-3" style={{ marginBottom: 24 }}>
          <div className="card stat-card">
            <div className="stat-icon" style={{ background: 'var(--info)18', color: 'var(--info)' }}><Icon name="users" size={24} /></div>
            <div className="stat-content">
              <div className="stat-label">Workers</div>
              <div className="stat-value">{rows.length}</div>
            </div>
          </div>
          <div className="card stat-card">
            <div className="stat-icon" style={{ background: 'var(--warning)18', color: 'var(--warning)' }}><Icon name="indian-rupee" size={24} /></div>
            <div className="stat-content">
              <div className="stat-label">Total Advances</div>
              <div className="stat-value">₹{totalAdv.toFixed(0)}</div>
            </div>
          </div>
          <div className="card stat-card">
            <div className="stat-icon" style={{ background: 'var(--success)18', color: 'var(--success)' }}><Icon name="indian-rupee" size={24} /></div>
            <div className="stat-content">
              <div className="stat-label">Total Net Payable</div>
              <div className="stat-value" style={{ color: 'var(--success)' }}>₹{totalNet.toFixed(0)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Payroll table */}
      {generated && (
        <div className="card">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Worker</th><th>Dept</th><th>Entries</th><th>Total kg</th>
                  <th>Gross (₹)</th><th>Advances (₹)</th><th>Net (₹)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any) => (
                  <tr key={r.worker_id}>
                    <td><strong>{r.worker_name}</strong></td>
                    <td className="text-secondary text-sm">{r.department || '—'}</td>
                    <td>{r.approved_entries}</td>
                    <td style={{ fontFamily: 'var(--font-heading)' }}>{r.total_kg} kg</td>
                    <td style={{ fontFamily: 'var(--font-heading)' }}>₹{r.gross_wages}</td>
                    <td style={{ fontFamily: 'var(--font-heading)', color: r.total_advances > 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>
                      {r.total_advances > 0 ? `-₹${r.total_advances}` : '—'}
                    </td>
                    <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--success)' }}>₹{r.net_wages}</td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr style={{ background: 'var(--hover-bg)', fontWeight: 700 }}>
                  <td colSpan={3}><strong>TOTAL</strong></td>
                  <td style={{ fontFamily: 'var(--font-heading)' }}>{rows.reduce((s: number, r: any) => s + r.total_kg, 0).toFixed(2)} kg</td>
                  <td style={{ fontFamily: 'var(--font-heading)' }}>₹{totalGross.toFixed(2)}</td>
                  <td style={{ fontFamily: 'var(--font-heading)', color: 'var(--danger)' }}>-₹{totalAdv.toFixed(2)}</td>
                  <td style={{ fontFamily: 'var(--font-heading)', color: 'var(--success)' }}>₹{totalNet.toFixed(2)}</td>
                </tr>
                {rows.length === 0 && (
                  <tr><td colSpan={7}><div className="empty-state"><Icon name="file-bar-chart" size={40} color="var(--primary-light)" /><p className="empty-state-title">No approved entries this period</p></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
