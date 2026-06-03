'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { StatusBadge, useToast, Icon } from '@/components/ui';

export default function WorkerHistoryPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    apiFetch('/production/hanks/my')
      .then(setEntries)
      .catch(e => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  const totalKg      = entries.reduce((s, e) => s + Number(e.weight_kg), 0);
  const totalEarned  = entries.filter(e => e.status === 'approved').reduce((s, e) => s + Number(e.total_earned ?? 0), 0);
  const pendingCount = entries.filter(e => e.status === 'pending').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
      <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 20 }}>My History</h2>

      {/* Stats */}
      {!loading && entries.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { label: 'Total kg',     value: `${totalKg.toFixed(1)}`, color: 'var(--info)' },
            { label: 'Pending',      value: String(pendingCount),     color: 'var(--warning)' },
            { label: 'Earned (₹)',   value: `₹${totalEarned.toFixed(0)}`, color: 'var(--success)' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: '12px 14px', textAlign: 'center', borderLeft: `3px solid ${s.color}` }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, fontFamily: 'var(--font-heading)', color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="loading-spinner" /></div>
      ) : entries.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Icon name="clipboard-list" size={48} color="var(--primary-light)" />
            <p className="empty-state-title" style={{ marginTop: 12 }}>No entries yet</p>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>Submit your first production entry</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {entries.map(e => (
            <div key={e.id} className="card">
              <div className="card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, fontFamily: 'var(--font-heading)' }}>
                      {new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 3 }}>
                      {e.clients?.name} · {e.qualities?.name}
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--text)' }}>{e.weight_kg}</span>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>kg</span>
                    </div>
                    {e.status === 'approved' && e.total_earned != null && (
                      <div style={{ color: 'var(--success)', fontWeight: 600, fontSize: 14, marginTop: 4 }}>
                        <Icon name="indian-rupee" size={13} style={{ verticalAlign: 'middle', marginRight: 2 }} />
                        Earned: ₹{e.total_earned}
                      </div>
                    )}
                  </div>
                  <StatusBadge status={e.status} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
