'use client';
import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { StatCard, PageHeader, Icon } from '@/components/ui';
import Link from 'next/link';

const QUICK_ACTIONS = [
  { label: 'Approve Hanks',    href: '/admin/production/hanks',    icon: 'factory',        color: 'var(--accent)' },
  { label: 'Approve Coning',   href: '/admin/production/conning',  icon: 'box',            color: 'var(--info)' },
  { label: 'Add Stock',        href: '/admin/stock-inward',        icon: 'package-plus',   color: 'var(--success)' },
  { label: 'New Dispatch',     href: '/admin/dispatch',            icon: 'truck',          color: 'var(--warning)' },
  { label: 'Client Finance',   href: '/admin/finance/clients',     icon: 'wallet',         color: 'var(--primary)' },
  { label: 'Reports',          href: '/admin/reports',             icon: 'bar-chart-3',    color: 'var(--danger)' },
];

interface Stats {
  pendingHanks: number;
  pendingConing: number;
  pendingOrders: number;
  readyStockKg: number;
  readyStockCount: number;
  outstandingBalance: number;
  activeLoans: number;
  totalLoanOutstanding: number;
  presentToday: number;
  absentToday: number;
  totalWorkers: number;
  recentDispatches: any[];
  stockInward: any[];
  todayDispatchAmt: number;
}

const EMPTY: Stats = {
  pendingHanks: 0, pendingConing: 0, pendingOrders: 0,
  readyStockKg: 0, readyStockCount: 0,
  outstandingBalance: 0, activeLoans: 0, totalLoanOutstanding: 0,
  presentToday: 0, absentToday: 0, totalWorkers: 0,
  recentDispatches: [], stockInward: [], todayDispatchAmt: 0,
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const todayStr = new Date().toISOString().split('T')[0];

  const load = useCallback(async () => {
    try {
      const [hanks, coning, orders, ready, financeSummary, loans, attendance, dispatches, workers] = await Promise.all([
        apiFetch('/production/hanks?status=pending').catch(() => []),
        apiFetch('/production/coning?status=pending').catch(() => []),
        apiFetch('/orders?status=pending').catch(() => []),
        apiFetch('/stock/ready?status=available').catch(() => []),
        apiFetch('/finance/clients').catch(() => []),
        apiFetch('/loans').catch(() => []),
        apiFetch(`/attendance?date=${todayStr}`).catch(() => []),
        apiFetch('/dispatch').catch(() => []),
        apiFetch('/workers').catch(() => []),
      ]);

      const readyArr    = Array.isArray(ready) ? ready : [];
      const finArr      = Array.isArray(financeSummary) ? financeSummary : [];
      const loansArr    = Array.isArray(loans) ? loans : [];
      const attArr      = Array.isArray(attendance) ? attendance : [];
      const dispArr     = Array.isArray(dispatches) ? dispatches : [];
      const workersArr  = Array.isArray(workers) ? workers : [];

      const todayDisp = dispArr.filter((d: any) => d.date === todayStr);

      setStats({
        pendingHanks:         Array.isArray(hanks) ? hanks.length : 0,
        pendingConing:        Array.isArray(coning) ? coning.length : 0,
        pendingOrders:        Array.isArray(orders) ? orders.length : 0,
        readyStockKg:         readyArr.reduce((s: number, r: any) => s + Number(r.weight_kg ?? 0), 0),
        readyStockCount:      readyArr.length,
        outstandingBalance:   finArr.reduce((s: number, r: any) => s + Number(r.balance ?? 0), 0),
        activeLoans:          loansArr.filter((l: any) => l.status === 'active').length,
        totalLoanOutstanding: loansArr.filter((l: any) => l.status === 'active').reduce((s: number, l: any) => s + Number(l.outstanding ?? 0), 0),
        presentToday:         attArr.filter((a: any) => a.status === 'present' || a.status === 'halfday').length,
        absentToday:          attArr.filter((a: any) => a.status === 'absent').length,
        totalWorkers:         workersArr.length,
        recentDispatches:     dispArr.slice(0, 5),
        stockInward:          [],
        todayDispatchAmt:     todayDisp.reduce((s: number, d: any) => s + Number(d.amount ?? 0), 0),
      });
      setLastRefresh(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [todayStr]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const pendingTotal = stats.pendingHanks + stats.pendingConing;

  return (
    <div className="page-enter">
      <PageHeader title="Dashboard" subtitle={today}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => { setLoading(true); load(); }}
          style={{ gap: 6, color: 'var(--text-secondary)', fontSize: 12 }}
        >
          <Icon name="refresh-cw" size={13} />
          {loading ? 'Refreshing…' : `Updated ${lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`}
        </button>
      </PageHeader>

      {/* KPI row 1 — Production & Finance */}
      <div className="grid-4" style={{ marginBottom: 16 }}>
        {loading && stats.pendingHanks === 0 ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card" style={{ padding: 20 }}><div className="skeleton skeleton-card" style={{ height: 70 }} /></div>
          ))
        ) : (
          <>
            <StatCard
              icon="clock"
              label="Pending Approvals"
              value={pendingTotal}
              color="var(--warning)"
              trend={pendingTotal > 0 ? `${stats.pendingHanks} hanks · ${stats.pendingConing} coning` : 'All clear'}
              trendDir={pendingTotal > 0 ? 'down' : 'up'}
            />
            <StatCard
              icon="clipboard-list"
              label="Pending Orders"
              value={stats.pendingOrders}
              color="var(--info)"
              trend={stats.pendingOrders > 0 ? `${stats.pendingOrders} awaiting` : 'None pending'}
              trendDir={stats.pendingOrders > 0 ? 'down' : 'up'}
            />
            <StatCard
              icon="wallet"
              label="Client Outstanding"
              value={`₹${stats.outstandingBalance.toLocaleString('en-IN')}`}
              color="var(--danger)"
              trend={stats.activeLoans > 0 ? `${stats.activeLoans} active loans` : undefined}
            />
            <StatCard
              icon="truck"
              label="Today's Dispatches"
              value={`₹${stats.todayDispatchAmt.toLocaleString('en-IN')}`}
              color="var(--success)"
              trend={`${stats.recentDispatches.filter((d: any) => d.date === todayStr).length} invoices today`}
            />
          </>
        )}
      </div>

      {/* KPI row 2 — Stock & Attendance */}
      <div className="grid-4" style={{ marginBottom: 28 }}>
        {loading && stats.pendingHanks === 0 ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card" style={{ padding: 20 }}><div className="skeleton skeleton-card" style={{ height: 70 }} /></div>
          ))
        ) : (
          <>
            <StatCard
              icon="warehouse"
              label="Ready Stock"
              value={`${stats.readyStockKg.toFixed(1)} kg`}
              color="var(--accent)"
              trend={`${stats.readyStockCount} lots available`}
            />
            <StatCard
              icon="banknote"
              label="Loan Outstanding"
              value={`₹${stats.totalLoanOutstanding.toLocaleString('en-IN')}`}
              color="var(--warning)"
              trend={stats.activeLoans > 0 ? `${stats.activeLoans} active loans` : 'No active loans'}
            />
            <StatCard
              icon="calendar-check"
              label="Present Today"
              value={stats.presentToday}
              color="var(--success)"
              trend={`${stats.absentToday} absent · ${stats.totalWorkers} total`}
              trendDir={stats.absentToday > 0 ? 'down' : 'up'}
            />
            <StatCard
              icon="users"
              label="Workers"
              value={stats.totalWorkers}
              color="var(--primary)"
            />
          </>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Recent Dispatches */}
        <div className="card">
          <div className="card-body" style={{ borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="truck" size={15} color="var(--accent)" /> Recent Dispatches
            </h3>
            <Link href="/admin/dispatch" className="btn btn-ghost btn-sm">View all →</Link>
          </div>
          {stats.recentDispatches.length === 0 ? (
            <div className="empty-state" style={{ padding: 32 }}>
              <Icon name="truck" size={32} color="var(--primary-light)" />
              <p className="empty-state-title" style={{ fontSize: 13 }}>No dispatches yet</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Invoice</th><th>Client</th><th>Amt (₹)</th><th>Date</th></tr></thead>
                <tbody>
                  {stats.recentDispatches.map((d: any) => (
                    <tr key={d.id}>
                      <td className="font-mono text-sm" style={{ fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-heading)' }}>{d.invoice_no}</td>
                      <td><strong>{d.clients?.name ?? '—'}</strong></td>
                      <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, color: 'var(--success)' }}>
                        ₹{Number(d.amount).toLocaleString('en-IN')}
                      </td>
                      <td className="text-secondary text-sm">{new Date(d.date).toLocaleDateString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card">
          <div className="card-body" style={{ borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: 15 }}>Quick Actions</h3>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {QUICK_ACTIONS.map(a => (
                <Link
                  key={a.href}
                  href={a.href}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 14px',
                    border: '1.5px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface)',
                    textDecoration: 'none', color: 'var(--text)',
                    fontWeight: 500, fontSize: 13,
                    transition: 'all 150ms ease',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = a.color; (e.currentTarget as HTMLAnchorElement).style.background = a.color + '10'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLAnchorElement).style.background = 'var(--surface)'; }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: a.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name={a.icon} size={16} color={a.color} />
                  </div>
                  {a.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Pending approvals alert */}
      {pendingTotal > 0 && (
        <div className="card" style={{ borderLeft: '4px solid var(--warning)', marginBottom: 24 }}>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--warning)', animation: 'pulse-urgent 1.5s ease-in-out infinite', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <strong style={{ fontSize: 14 }}>{pendingTotal} production {pendingTotal === 1 ? 'entry' : 'entries'} awaiting approval</strong>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                {stats.pendingHanks > 0 && `${stats.pendingHanks} hanks`}
                {stats.pendingHanks > 0 && stats.pendingConing > 0 && ' · '}
                {stats.pendingConing > 0 && `${stats.pendingConing} coning`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {stats.pendingHanks > 0 && <Link href="/admin/production/hanks" className="btn btn-warning btn-sm">Approve Hanks</Link>}
              {stats.pendingConing > 0 && <Link href="/admin/production/conning" className="btn btn-warning btn-sm">Approve Coning</Link>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
