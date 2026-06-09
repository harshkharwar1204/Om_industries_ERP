'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui';

const STATUS_COLORS: Record<string,string> = { pending: '#EAB308', processing: '#2563EB', completed: '#16A34A', cancelled: '#94A3B8' };

function portalFetch(path: string) {
  const token = sessionStorage.getItem('portal_token');
  return fetch(`/api/portal/data?type=${path}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
}

export default function PortalDashboard() {
  const router = useRouter();
  const [client, setClient]   = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [tab, setTab]         = useState<'summary' | 'invoices' | 'orders' | 'ledger'>('summary');
  const [tabData, setTabData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const c = sessionStorage.getItem('portal_client');
    const t = sessionStorage.getItem('portal_token');
    if (!c || !t) { router.replace('/portal'); return; }
    setClient(JSON.parse(c));
    portalFetch('summary').then(d => { setSummary(d); setLoading(false); }).catch(() => { router.replace('/portal'); });
  }, []);

  useEffect(() => {
    if (tab === 'summary') return;
    portalFetch(tab).then(setTabData).catch(() => {});
  }, [tab]);

  const logout = () => { sessionStorage.removeItem('portal_token'); sessionStorage.removeItem('portal_client'); router.replace('/portal'); };

  if (loading) return <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: 32, height: 32, border: '3px solid #E2E8F0', borderTopColor: '#F97316', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /></div>;

  return (
    <div style={{ minHeight: '100dvh', background: '#F8FAFC', paddingBottom: 32 }}>
      {/* Header */}
      <header style={{ background: '#475569', padding: '0 20px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, background: '#F97316', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="archive" size={15} color="#fff" />
          </div>
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, color: '#fff' }}>OM INDUSTRIES</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{client?.name}</span>
          <button onClick={logout} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: 4 }}>
            <Icon name="log-out" size={18} color="rgba(255,255,255,0.6)" />
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 16px' }}>
        {/* KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Outstanding', value: `₹${(summary?.outstanding || 0).toLocaleString('en-IN')}`, color: '#DC2626', icon: 'indian-rupee' },
            { label: 'Invoiced', value: `₹${(summary?.total_invoiced || 0).toLocaleString('en-IN')}`, color: '#2563EB', icon: 'file-text' },
            { label: 'Paid', value: `₹${(summary?.total_paid || 0).toLocaleString('en-IN')}`, color: '#16A34A', icon: 'check-circle' },
          ].map(k => (
            <div key={k.label} style={{ background: '#fff', borderRadius: 12, padding: '14px 12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ width: 32, height: 32, background: k.color + '18', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                <Icon name={k.icon} size={17} color={k.color} />
              </div>
              <div style={{ fontSize: 11, color: '#64748B', marginBottom: 2 }}>{k.label}</div>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '2px solid #E2E8F0', marginBottom: 20, overflowX: 'auto' }}>
          {([['summary','Summary','layout-dashboard'],['invoices','Invoices','truck'],['orders','Orders','clipboard-list'],['ledger','Ledger','file-bar-chart']] as [typeof tab, string, string][]).map(([id, label, icon]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ flex: '0 0 auto', padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: tab === id ? 600 : 400, fontSize: 14, color: tab === id ? '#F97316' : '#64748B', borderBottom: `2px solid ${tab === id ? '#F97316' : 'transparent'}`, marginBottom: -2, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-body)', whiteSpace: 'nowrap' }}>
              <Icon name={icon} size={15} />
              {label}
            </button>
          ))}
        </div>

        {/* Summary tab */}
        {tab === 'summary' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {summary?.recent_dispatches?.length > 0 && (
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid #E2E8F0', fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="truck" size={15} color="#F97316" /> Recent Dispatches
                </div>
                {summary.recent_dispatches.map((d: any) => (
                  <div key={d.invoice_no} style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13, color: '#F97316' }}>{d.invoice_no}</div>
                      <div style={{ fontSize: 12, color: '#64748B' }}>{new Date(d.date).toLocaleDateString('en-IN')}</div>
                    </div>
                    <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: '#16A34A' }}>₹{Number(d.grand_total ?? d.amount).toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>
            )}
            {summary?.recent_orders?.length > 0 && (
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid #E2E8F0', fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="clipboard-list" size={15} color="#2563EB" /> Recent Orders
                </div>
                {summary.recent_orders.map((o: any) => (
                  <div key={o.id} style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{o.po_number || `ORD-${String(o.id).padStart(4,'0')}`}</div>
                      <div style={{ fontSize: 12, color: '#64748B' }}>{o.qty_kg ? `${o.qty_kg} kg` : '—'}</div>
                    </div>
                    <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600, background: STATUS_COLORS[o.status] + '18', color: STATUS_COLORS[o.status], textTransform: 'capitalize' }}>{o.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Invoices tab */}
        {tab === 'invoices' && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            {tabData.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>No invoices found</div>
            ) : tabData.map((d: any) => (
              <div key={d.id} style={{ padding: '14px 16px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, color: '#F97316' }}>{d.invoice_no}</div>
                  <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{new Date(d.date).toLocaleDateString('en-IN')} · {d.qty_kg} kg @ ₹{d.rate}/kg</div>
                  {d.vehicle_no && <div style={{ fontSize: 11, color: '#94A3B8' }}>Vehicle: {d.vehicle_no}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: '#16A34A', fontSize: 15 }}>₹{Number(d.grand_total ?? d.amount).toLocaleString('en-IN')}</div>
                  {(d.total_tax ?? 0) > 0 && <div style={{ fontSize: 11, color: '#2563EB' }}>+₹{Number(d.total_tax).toFixed(0)} tax</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Orders tab */}
        {tab === 'orders' && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            {tabData.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>No orders found</div>
            ) : tabData.map((o: any) => (
              <div key={o.id} style={{ padding: '14px 16px', borderBottom: '1px solid #F1F5F9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{o.po_number || `ORD-${String(o.id).padStart(4,'0')}`}</div>
                    <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{o.items?.name || '—'} · {o.qty_kg ? `${o.qty_kg} kg` : '—'}{o.rate ? ` @ ₹${o.rate}/kg` : ''}</div>
                    {o.delivery_date && <div style={{ fontSize: 11, color: '#94A3B8' }}>Delivery: {new Date(o.delivery_date).toLocaleDateString('en-IN')}</div>}
                  </div>
                  <span style={{ padding: '3px 10px', borderRadius: 9999, fontSize: 12, fontWeight: 600, background: STATUS_COLORS[o.status] + '18', color: STATUS_COLORS[o.status], textTransform: 'capitalize', flexShrink: 0 }}>{o.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Ledger tab */}
        {tab === 'ledger' && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            {tabData.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>No transactions found</div>
            ) : (() => {
              let balance = 0;
              return tabData.map((t: any) => {
                const amt = Number(t.amount);
                balance += t.type === 'debit' ? amt : -amt;
                return (
                  <div key={t.id} style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{t.particulars || t.type}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8' }}>{new Date(t.date).toLocaleDateString('en-IN')}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13, color: t.type === 'debit' ? '#DC2626' : '#16A34A' }}>
                        {t.type === 'debit' ? '+' : '−'}₹{amt.toLocaleString('en-IN')}
                      </div>
                      <div style={{ fontSize: 11, color: balance > 0 ? '#DC2626' : '#16A34A', fontFamily: 'var(--font-heading)' }}>
                        Bal: ₹{Math.abs(balance).toLocaleString('en-IN')}{balance > 0 ? ' due' : ' cr'}
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
