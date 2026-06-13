'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader, useToast, Icon } from '@/components/ui';

interface Data {
  orderEconomics: { id: number; client: string; quality: string; qty_kg: number; rate: number; order_value: number; coned_kg: number; fulfilled_pct: number; status: string }[];
  stockAging: Record<'grey' | 'dyed' | 'ready', { fresh_0_7: number; days_8_30: number; days_31_60: number; over_60: number }>;
  outstanding: { client: string; balance: number; oldest_days: number }[];
  totalOutstanding: number;
  trends: { month: string; hanks_kg: number; coned_kg: number; revenue: number }[];
}

const inr = (n: number) => '₹' + n.toLocaleString('en-IN');
const MONTH_LBL = (m: string) => new Date(m + '-01').toLocaleDateString('en-IN', { month: 'short' });

export default function AnalyticsPage() {
  const [data, setData]       = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    apiFetch('/analytics').then(setData).catch(e => toast(e.message, 'error')).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 60, display: 'flex', justifyContent: 'center' }}><div className="loading-spinner" /></div>;
  if (!data) return <div className="page-enter"><PageHeader title="Analytics" /><div className="empty-state">No data</div></div>;

  const maxRev = Math.max(1, ...data.trends.map(t => t.revenue));
  const maxKg  = Math.max(1, ...data.trends.map(t => Math.max(t.hanks_kg, t.coned_kg)));

  const AgingRow = ({ label, b }: { label: string; b: Data['stockAging']['grey'] }) => {
    const total = b.fresh_0_7 + b.days_8_30 + b.days_31_60 + b.over_60;
    const seg = [
      { v: b.fresh_0_7, c: 'var(--success)', t: '0–7d' },
      { v: b.days_8_30, c: 'var(--info)', t: '8–30d' },
      { v: b.days_31_60, c: 'var(--warning)', t: '31–60d' },
      { v: b.over_60, c: 'var(--danger)', t: '60d+' },
    ];
    return (
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
          <strong style={{ textTransform: 'capitalize' }}>{label}</strong>
          <span className="text-secondary">{total.toFixed(0)} kg{b.over_60 > 0 ? <span style={{ color: 'var(--danger)' }}> · {b.over_60.toFixed(0)}kg aging</span> : ''}</span>
        </div>
        <div style={{ display: 'flex', height: 20, borderRadius: 6, overflow: 'hidden', background: 'var(--hover-bg)' }}>
          {seg.map((s, i) => s.v > 0 && (
            <div key={i} title={`${s.t}: ${s.v.toFixed(1)}kg`} style={{ width: `${(s.v / total) * 100}%`, background: s.c }} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="page-enter">
      <PageHeader title="Analytics" subtitle="Owner insights" icon="bar-chart-3" iconColor="var(--accent)" />

      {/* Top stats */}
      <div className="grid-3" style={{ marginBottom: 24 }}>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}><Icon name="indian-rupee" size={24} /></div>
          <div className="stat-content"><div className="stat-label">Total Outstanding</div><div className="stat-value">{inr(data.totalOutstanding)}</div></div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: 'var(--success-light)', color: 'var(--success)' }}><Icon name="trending-up" size={24} /></div>
          <div className="stat-content"><div className="stat-label">Revenue (6 mo)</div><div className="stat-value">{inr(data.trends.reduce((s, t) => s + t.revenue, 0))}</div></div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: '#DBEAFE', color: 'var(--info)' }}><Icon name="clipboard-list" size={24} /></div>
          <div className="stat-content"><div className="stat-label">Open Orders</div><div className="stat-value">{data.orderEconomics.filter(o => o.status !== 'completed').length}</div></div>
        </div>
      </div>

      {/* Trends */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-body">
          <h3 style={{ fontSize: 16, marginBottom: 18 }}>6-Month Trend</h3>
          <div style={{ display: 'flex', gap: 18, alignItems: 'flex-end', height: 180, padding: '0 4px' }}>
            {data.trends.map(t => (
              <div key={t.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 4, width: '100%', justifyContent: 'center' }}>
                  <div title={`Revenue ${inr(t.revenue)}`} style={{ width: '34%', height: `${(t.revenue / maxRev) * 100}%`, minHeight: 2, background: 'var(--accent)', borderRadius: '4px 4px 0 0' }} />
                  <div title={`Hanks ${t.hanks_kg}kg`} style={{ width: '34%', height: `${(t.hanks_kg / maxKg) * 100}%`, minHeight: 2, background: 'var(--primary-light)', borderRadius: '4px 4px 0 0' }} />
                  <div title={`Coned ${t.coned_kg}kg`} style={{ width: '34%', height: `${(t.coned_kg / maxKg) * 100}%`, minHeight: 2, background: 'var(--info)', borderRadius: '4px 4px 0 0' }} />
                </div>
                <span className="text-xs text-secondary">{MONTH_LBL(t.month)}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 14, fontSize: 12, flexWrap: 'wrap' }}>
            <Legend c="var(--accent)" t="Revenue" /><Legend c="var(--primary-light)" t="Hanks kg" /><Legend c="var(--info)" t="Coned kg" />
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 24, alignItems: 'start' }}>
        {/* Stock aging */}
        <div className="card">
          <div className="card-body">
            <h3 style={{ fontSize: 16, marginBottom: 16 }}>Stock Aging <span className="text-secondary text-sm">(unsold by age)</span></h3>
            <AgingRow label="grey" b={data.stockAging.grey} />
            <AgingRow label="dyed" b={data.stockAging.dyed} />
            <AgingRow label="ready" b={data.stockAging.ready} />
          </div>
        </div>

        {/* Outstanding */}
        <div className="card">
          <div className="card-body" style={{ paddingBottom: 4 }}>
            <h3 style={{ fontSize: 16, marginBottom: 4 }}>Receivables Aging</h3>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Party</th><th style={{ textAlign: 'right' }}>Outstanding</th><th style={{ textAlign: 'right' }}>Oldest</th></tr></thead>
              <tbody>
                {data.outstanding.slice(0, 8).map((o, i) => (
                  <tr key={i}>
                    <td><strong>{o.client}</strong></td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-heading)' }}>{inr(o.balance)}</td>
                    <td style={{ textAlign: 'right', color: o.oldest_days > 60 ? 'var(--danger)' : o.oldest_days > 30 ? 'var(--warning)' : 'var(--text-secondary)', fontWeight: o.oldest_days > 60 ? 600 : 400 }}>{o.oldest_days}d</td>
                  </tr>
                ))}
                {data.outstanding.length === 0 && <tr><td colSpan={3}><div className="empty-state" style={{ padding: 24 }}><p>No outstanding dues</p></div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Order economics */}
      <div className="card">
        <div className="card-body" style={{ paddingBottom: 4 }}>
          <h3 style={{ fontSize: 16 }}>Order Economics <span className="text-secondary text-sm">(value &amp; fulfillment — revenue, not net profit)</span></h3>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Party</th><th>Quality</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>Value</th><th>Fulfilled</th><th>Status</th></tr></thead>
            <tbody>
              {data.orderEconomics.slice(0, 12).map(o => (
                <tr key={o.id}>
                  <td><strong>{o.client}</strong></td>
                  <td className="text-sm">{o.quality}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-heading)' }}>{o.qty_kg}kg</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-heading)', fontWeight: 600 }}>{inr(o.order_value)}</td>
                  <td style={{ minWidth: 120 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 6, background: 'var(--hover-bg)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${o.fulfilled_pct}%`, height: '100%', background: o.fulfilled_pct >= 100 ? 'var(--success)' : 'var(--accent)' }} />
                      </div>
                      <span className="text-xs text-secondary">{o.fulfilled_pct}%</span>
                    </div>
                  </td>
                  <td><span className={`badge badge-${o.status === 'completed' ? 'approved' : o.status === 'processing' ? 'running' : 'pending'}`}>{o.status}</span></td>
                </tr>
              ))}
              {data.orderEconomics.length === 0 && <tr><td colSpan={6}><div className="empty-state" style={{ padding: 24 }}><p>No orders</p></div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Legend({ c, t }: { c: string; t: string }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: c }} />{t}</span>;
}
