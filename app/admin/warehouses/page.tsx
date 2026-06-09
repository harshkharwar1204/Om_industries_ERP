'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader, useToast, Icon } from '@/components/ui';

const sum = (rows: any[], key: string) => rows.reduce((s, r) => s + Number(r[key] ?? 0), 0);

export default function WarehousesPage() {
  const [data, setData] = useState<any>({ raw: [], grey: [], dyed: [], packed: [], chemicals: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'raw' | 'grey' | 'dyed' | 'packed' | 'chemicals'>('raw');
  const toast = useToast();

  useEffect(() => { apiFetch('/warehouses').then(setData).catch(e => toast(e.message, 'error')).finally(() => setLoading(false)); }, []);

  const lowChem = data.chemicals.filter((c: any) => Number(c.stock_qty) <= Number(c.low_threshold) && Number(c.low_threshold) > 0);

  const TABS = [
    { id: 'raw', label: 'Unit 2 — Raw Yarn', kg: sum(data.raw, 'remaining_weight_kg'), count: data.raw.length, color: 'var(--primary)' },
    { id: 'grey', label: 'Unit 1 — Grey Stock', kg: sum(data.grey, 'remaining_kg'), count: data.grey.length, color: 'var(--warning)' },
    { id: 'dyed', label: 'Dyed Stock', kg: sum(data.dyed, 'remaining_kg'), count: data.dyed.length, color: 'var(--info)' },
    { id: 'packed', label: 'Packed (Ready)', kg: sum(data.packed, 'weight_kg'), count: data.packed.length, color: 'var(--success)' },
    { id: 'chemicals', label: 'Chemicals', kg: null, count: data.chemicals.length, color: 'var(--accent)' },
  ] as const;

  if (loading) return <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><div className="loading-spinner" /></div>;

  return (
    <div className="page-enter">
      <PageHeader title="Warehouses" subtitle="Stock across all units" icon="warehouse" iconColor="var(--accent)" />

      {lowChem.length > 0 && (
        <div className="card" style={{ borderLeft: '4px solid var(--danger)', marginBottom: 16 }}>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Icon name="alert-circle" size={18} color="var(--danger)" />
            <strong style={{ fontSize: 14 }}>Low stock:</strong>
            <span className="text-secondary text-sm">{lowChem.map((c: any) => `${c.name} (${Number(c.stock_qty).toFixed(0)}${c.unit})`).join(', ')}</span>
          </div>
        </div>
      )}

      <div className="grid-4" style={{ marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t.id} className="card stat-card" onClick={() => setTab(t.id)}
            style={{ cursor: 'pointer', border: tab === t.id ? `2px solid ${t.color}` : '1px solid var(--border)', textAlign: 'left' }}>
            <div className="stat-icon" style={{ background: `${t.color}18`, color: t.color }}><Icon name="warehouse" size={22} /></div>
            <div className="stat-content">
              <div className="stat-label">{t.label}</div>
              <div className="stat-value" style={{ fontSize: 20 }}>{t.kg != null ? `${t.kg.toFixed(1)} kg` : `${t.count}`}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="card">
        <div className="table-wrap">
          {tab === 'chemicals' ? (
            <table className="data-table"><thead><tr><th>Name</th><th>Stock</th><th>Low Threshold</th></tr></thead>
              <tbody>{data.chemicals.map((c: any) => {
                const isLow = Number(c.stock_qty) <= Number(c.low_threshold) && Number(c.low_threshold) > 0;
                return <tr key={c.id}><td><strong>{c.name}</strong></td><td style={{ fontFamily: 'var(--font-heading)', color: isLow ? 'var(--danger)' : 'var(--text)' }}>{Number(c.stock_qty).toFixed(1)} {c.unit}</td><td className="text-secondary text-sm">{Number(c.low_threshold).toFixed(0)} {c.unit}</td></tr>;
              })}{data.chemicals.length === 0 && <tr><td colSpan={3}><div className="empty-state" style={{ padding: 28 }}><p className="empty-state-title">Empty</p></div></td></tr>}</tbody>
            </table>
          ) : (
            <table className="data-table">
              <thead><tr>
                <th>{tab === 'raw' ? 'Challan' : tab === 'dyed' || tab === 'packed' ? 'Batch' : 'Date'}</th>
                <th>Client</th><th>Quality</th>{(tab === 'dyed' || tab === 'packed') && <th>Shade</th>}<th>Weight</th>{tab === 'packed' && <th>Cones</th>}
              </tr></thead>
              <tbody>
                {data[tab].map((r: any) => (
                  <tr key={r.id}>
                    <td className="font-mono text-sm">{tab === 'raw' ? (r.challan_no || `#${r.id}`) : (tab === 'dyed' || tab === 'packed') ? (r.batch_no || `#${r.id}`) : new Date(r.date).toLocaleDateString('en-IN')}</td>
                    <td><strong>{r.clients?.name ?? '—'}</strong></td>
                    <td className="text-sm">{r.qualities?.name ?? '—'}</td>
                    {(tab === 'dyed' || tab === 'packed') && <td>{r.shades?.name ?? '—'}</td>}
                    <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>{Number(tab === 'raw' ? r.remaining_weight_kg : tab === 'packed' ? r.weight_kg : r.remaining_kg).toFixed(1)} kg</td>
                    {tab === 'packed' && <td>{r.cones ?? '—'}</td>}
                  </tr>
                ))}
                {data[tab].length === 0 && <tr><td colSpan={6}><div className="empty-state" style={{ padding: 28 }}><Icon name="warehouse" size={36} color="var(--primary-light)" /><p className="empty-state-title">Empty</p></div></td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
