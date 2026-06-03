'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { StatCard, PageHeader, Icon } from '@/components/ui';
import Link from 'next/link';

const QUICK_ACTIONS = [
  { label: 'Approve Production', href: '/admin/production/hanks', icon: 'check-circle', color: 'var(--success)' },
  { label: 'Add Stock',          href: '/admin/stock-inward',      icon: 'package-plus', color: 'var(--info)' },
  { label: 'Run Payroll',        href: '/admin/payroll',           icon: 'indian-rupee', color: 'var(--accent)' },
  { label: 'Manage Workers',     href: '/admin/masters/workers',   icon: 'users',        color: 'var(--primary)' },
];

export default function DashboardPage() {
  const [pending, setPending]   = useState(0);
  const [stock, setStock]       = useState<any[]>([]);
  const [workers, setWorkers]   = useState(0);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch('/production/hanks?status=pending'),
      apiFetch('/stock/summary'),
      apiFetch('/workers'),
    ]).then(([p, s, w]) => {
      setPending(Array.isArray(p) ? p.length : 0);
      setStock(Array.isArray(s) ? s : []);
      setWorkers(Array.isArray(w) ? w.length : 0);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const totalStockKg = stock.reduce((s, i) => s + Number(i.remaining_weight_kg ?? 0), 0);

  return (
    <div className="page-enter">
      <PageHeader title="Dashboard" subtitle={today} />

      {/* KPI cards */}
      <div className="grid-4" style={{ marginBottom: 28 }}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card" style={{ padding: 20 }}>
              <div className="skeleton skeleton-card" style={{ height: 70 }} />
            </div>
          ))
        ) : (
          <>
            <StatCard icon="clock"        label="Pending Approvals"  value={pending}                   color="var(--warning)"  trend={pending > 0 ? `${pending} waiting` : undefined} trendDir="down" />
            <StatCard icon="package-plus" label="Stock Items Active"  value={stock.length}              color="var(--info)" />
            <StatCard icon="layers"       label="Total Stock (kg)"    value={`${totalStockKg.toFixed(1)} kg`} color="var(--success)" />
            <StatCard icon="users"        label="Workers Registered"  value={workers}                   color="var(--primary)" />
          </>
        )}
      </div>

      {/* Quick actions */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-body">
          <h3 style={{ marginBottom: 16, fontSize: 16 }}>Quick Actions</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {QUICK_ACTIONS.map(a => (
              <Link
                key={a.href}
                href={a.href}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 16px',
                  border: '1.5px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface)',
                  textDecoration: 'none', color: 'var(--text)',
                  fontWeight: 500, fontSize: 14,
                  transition: 'all 150ms ease',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = a.color; (e.currentTarget as HTMLAnchorElement).style.background = a.color + '08'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLAnchorElement).style.background = 'var(--surface)'; }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 8, background: a.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', color: a.color, flexShrink: 0 }}>
                  <Icon name={a.icon} size={18} />
                </div>
                {a.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Recent stock */}
      {stock.length > 0 && (
        <div className="card">
          <div className="card-body" style={{ borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: 16 }}>Active Stock</h3>
            <Link href="/admin/stock-inward" className="btn btn-ghost btn-sm">View all →</Link>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Client</th><th>Quality</th><th>Remaining (kg)</th><th>Date</th></tr>
              </thead>
              <tbody>
                {stock.slice(0, 6).map((s: any) => (
                  <tr key={s.id}>
                    <td><strong>{s.clients?.name}</strong></td>
                    <td>{s.qualities?.name}</td>
                    <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>{s.remaining_weight_kg} kg</td>
                    <td className="text-secondary text-sm">{new Date(s.date).toLocaleDateString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
