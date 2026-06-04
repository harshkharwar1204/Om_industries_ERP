// app/admin/reports/page.tsx
'use client';
import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader, useToast, Icon } from '@/components/ui';

type ReportType = 'production' | 'stock' | 'dispatch' | 'finance' | 'worker-performance' | 'party-ledger';

const LABELS: Record<ReportType, string> = {
  production: 'Production',
  stock: 'Stock',
  dispatch: 'Dispatch',
  finance: 'Financial Summary',
  'worker-performance': 'Worker Performance',
  'party-ledger': 'Party Ledger',
};

function exportCSV(rows: any[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','));
  const csv = [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename + '.csv'; a.click();
  URL.revokeObjectURL(url);
}

const today        = new Date().toISOString().split('T')[0];
const firstOfMonth = today.slice(0, 7) + '-01';

const tabStyle = (active: boolean) => ({
  padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer',
  fontFamily: 'var(--font-heading)', fontWeight: active ? 700 : 400, fontSize: 13,
  color: active ? 'var(--accent)' : 'var(--text-secondary)',
  borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
  marginBottom: -2, whiteSpace: 'nowrap' as const,
});

function FlatTable({ rows }: { rows: any[] }) {
  if (!rows.length) return <div className="empty-state"><p className="empty-state-title">No data for this period</p></div>;
  const headers = Object.keys(rows[0]);
  const isMoney = (h: string) => ['amount', 'earned', 'debit', 'credit', 'balance', 'rate'].includes(h);
  const isDate  = (h: string) => h === 'date';
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead><tr>{headers.map(h => <th key={h} style={{ textTransform: 'capitalize' }}>{h.replace(/_/g, ' ')}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {headers.map(h => (
                <td key={h} style={{ fontFamily: typeof r[h] === 'number' ? 'var(--font-heading)' : undefined }}>
                  {r[h] == null ? '—'
                    : isDate(h) ? new Date(r[h]).toLocaleDateString('en-IN')
                    : isMoney(h) ? `₹${Number(r[h]).toLocaleString('en-IN')}`
                    : String(r[h])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ReportsPage() {
  const [tab, setTab]           = useState<ReportType>('production');
  const [from, setFrom]         = useState(firstOfMonth);
  const [to, setTo]             = useState(today);
  const [clientId, setClientId] = useState('');
  const [clients, setClients]   = useState<any[]>([]);
  const [data, setData]         = useState<any>(null);
  const [loading, setLoading]   = useState(false);
  const toast = useToast();

  const handleTabChange = (t: ReportType) => {
    setTab(t); setData(null);
    if (t === 'party-ledger' && !clients.length) {
      apiFetch('/clients').then(setClients).catch(() => {});
    }
  };

  const generate = async () => {
    if (tab === 'party-ledger' && !clientId) { toast('Select a client', 'error'); return; }
    setLoading(true); setData(null);
    try {
      let url = `/reports/${tab}?from=${from}&to=${to}`;
      if (tab === 'party-ledger') url += `&client_id=${clientId}`;
      setData(await apiFetch(url));
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  };

  const doExport = () => {
    if (!data) return;
    if (tab === 'stock') { exportCSV(data.inward, `stock-inward-${from}-${to}`); return; }
    if (tab === 'party-ledger') { exportCSV(data.rows, `party-ledger-${from}-${to}`); return; }
    exportCSV(Array.isArray(data) ? data : [], `${tab}-${from}-${to}`);
  };

  const renderResult = () => {
    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="loading-spinner" /></div>;
    if (!data)   return <div className="empty-state"><Icon name="bar-chart-3" size={40} color="var(--primary-light)" /><p className="empty-state-title">Select a range and click Generate</p></div>;

    if (tab === 'stock') return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: 14, marginBottom: 12 }}>Stock Inward</h4>
          <FlatTable rows={data.inward} />
        </div>
        <div>
          <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: 14, marginBottom: 12 }}>Ready Stock</h4>
          <FlatTable rows={data.ready} />
        </div>
      </div>
    );

    if (tab === 'party-ledger') return (
      <div>
        <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: 14, marginBottom: 12 }}>Ledger — {data.client}</h4>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Date</th><th>Particulars</th><th>Debit (₹)</th><th>Credit (₹)</th><th>Balance (₹)</th></tr></thead>
            <tbody>
              {data.rows.map((r: any, i: number) => (
                <tr key={i}>
                  <td className="text-sm">{new Date(r.date).toLocaleDateString('en-IN')}</td>
                  <td>{r.particulars}</td>
                  <td style={{ fontFamily: 'var(--font-heading)', color: r.type === 'debit' ? 'var(--danger)' : undefined }}>{r.type === 'debit' ? `₹${Number(r.amount).toLocaleString('en-IN')}` : '—'}</td>
                  <td style={{ fontFamily: 'var(--font-heading)', color: r.type !== 'debit' ? 'var(--success)' : undefined }}>{r.type !== 'debit' ? `₹${Number(r.amount).toLocaleString('en-IN')}` : '—'}</td>
                  <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, color: r.balance > 0 ? 'var(--warning)' : 'var(--success)' }}>₹{Number(r.balance).toLocaleString('en-IN')}</td>
                </tr>
              ))}
              {data.rows.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 24 }}>No data</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );

    return <FlatTable rows={Array.isArray(data) ? data : []} />;
  };

  return (
    <div className="page-enter">
      <PageHeader title="Reports" subtitle="Generate and export production, finance & stock reports" />

      <div style={{ display: 'flex', gap: 2, marginBottom: 20, flexWrap: 'wrap', borderBottom: '2px solid var(--border)' }}>
        {(Object.keys(LABELS) as ReportType[]).map(t => (
          <button key={t} onClick={() => handleTabChange(t)} style={tabStyle(tab === t)}>{LABELS[t]}</button>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">From</label>
              <input className="form-input" type="date" value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">To</label>
              <input className="form-input" type="date" value={to} onChange={e => setTo(e.target.value)} />
            </div>
            {tab === 'party-ledger' && (
              <div className="form-group" style={{ marginBottom: 0, minWidth: 200 }}>
                <label className="form-label">Client *</label>
                <select className="form-select" value={clientId} onChange={e => setClientId(e.target.value)}>
                  <option value="">Select client…</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            <button className="btn btn-primary" onClick={generate} disabled={loading}>
              <Icon name="play" size={15} /> {loading ? 'Generating…' : 'Generate'}
            </button>
            {data && (
              <button className="btn btn-secondary" onClick={doExport}>
                <Icon name="download" size={15} /> Export CSV
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        {data && !loading && (
          <div className="card-body" style={{ borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14 }}>
              {LABELS[tab]} · {new Date(from).toLocaleDateString('en-IN')} – {new Date(to).toLocaleDateString('en-IN')}
            </span>
          </div>
        )}
        <div style={{ padding: 20 }}>{renderResult()}</div>
      </div>
    </div>
  );
}
