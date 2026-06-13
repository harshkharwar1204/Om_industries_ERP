'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useToast, Icon } from '@/components/ui';

const STAGE_LABEL: Record<string, string> = { hanks: 'Hanks', dyeing: 'Dyeing', coning: 'Coning' };

// Read-only view of orders relevant to this worker's unit + their live progress.
// Actual work + pay happens by logging production (Entry tab), which moves stock and
// advances the order — not from this screen.
export default function WorkerOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    apiFetch('/orders/assigned').then(setOrders).catch(e => toast(e.message, 'error')).finally(() => setLoading(false));
  }, []);

  const bar = (done: number, total: number) => {
    const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
    return (
      <div style={{ height: 6, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)' }} />
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 8 }}>
      <div>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 20, marginBottom: 4 }}>My Orders</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Orders for your unit · log work in the Entry tab</p>
      </div>

      {loading ? (
        <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><div className="loading-spinner" /></div>
      ) : orders.length === 0 ? (
        <div className="card"><div className="empty-state" style={{ padding: 36 }}>
          <Icon name="box" size={40} color="var(--primary-light)" />
          <p className="empty-state-title" style={{ fontSize: 14 }}>No open orders for your unit</p>
        </div></div>
      ) : orders.map(o => {
        const qty = Number(o.qty_kg ?? 0);
        const stages = [
          { key: 'received_kg', label: 'Hanks', v: Number(o.received_kg ?? 0) },
          { key: 'dyed_kg',     label: 'Dyeing', v: Number(o.dyed_kg ?? 0) },
          { key: 'coned_kg',    label: 'Coning', v: Number(o.coned_kg ?? 0) },
        ];
        return (
          <div key={o.id} className="card">
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{o.clients?.name ?? '—'}</div>
                  <div className="text-secondary text-sm">{o.qualities?.name ?? ''}{o.po_number ? ` · ${o.po_number}` : ''}</div>
                </div>
                <span className="badge" style={{ background: '#DBEAFE', color: 'var(--info)', flexShrink: 0 }}>{qty} kg</span>
              </div>
              {stages.map(s => (
                <div key={s.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)' }}>
                    <span>{s.label}</span><span style={{ fontFamily: 'var(--font-heading)', color: 'var(--text)' }}>{s.v} / {qty} kg</span>
                  </div>
                  {bar(s.v, qty)}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
