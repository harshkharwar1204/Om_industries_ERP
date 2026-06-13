'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader, useToast, Icon } from '@/components/ui';

interface Row {
  id: number; actor_name: string | null; actor_role: string | null;
  action: string; entity: string; entity_id: string | null;
  summary: string | null; created_at: string;
}

const ACTION_COLOR: Record<string, string> = {
  approve: 'var(--success)', reject: 'var(--danger)', dispatch: 'var(--info)',
  payroll_save: 'var(--accent)', pin_reset: 'var(--warning)', deactivate: 'var(--danger)', activate: 'var(--success)',
};

export default function AuditPage() {
  const [rows, setRows]       = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [entity, setEntity]   = useState('');
  const [search, setSearch]   = useState('');
  const toast = useToast();

  const load = () => {
    setLoading(true);
    apiFetch(`/audit${entity ? `?entity=${entity}` : ''}`)
      .then((d: any) => { setRows(d.rows ?? []); setPending(!!d.migrationPending); })
      .catch(e => toast(e.message, 'error')).finally(() => setLoading(false));
  };
  useEffect(load, [entity]);

  const entities = Array.from(new Set(rows.map(r => r.entity)));
  const filtered = rows.filter(r => !search ||
    (r.summary || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.actor_name || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="page-enter">
      <PageHeader title="Audit Trail" subtitle="Who did what, and when" icon="history" iconColor="var(--accent)" />

      {pending && (
        <div className="card" style={{ marginBottom: 16, borderLeft: '3px solid var(--warning)' }}>
          <div className="card-body" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Icon name="alert-triangle" size={18} color="var(--warning)" />
            <span className="text-sm">Audit logging is active, but the <code>audit_log</code> table isn’t created yet. Run <code>db/migrations/001_audit_log.sql</code> in Supabase to start capturing history.</span>
          </div>
        </div>
      )}

      <div className="filter-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', flex: 1, maxWidth: 280 }}>
          <Icon name="search" size={16} color="var(--text-secondary)" />
          <input style={{ border: 'none', background: 'none', outline: 'none', fontSize: 14, width: '100%' }} placeholder="Search action or person…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-select" value={entity} onChange={e => setEntity(e.target.value)} style={{ maxWidth: 200 }}>
          <option value="">All areas</option>
          {entities.map(en => <option key={en} value={en}>{en}</option>)}
        </select>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><div className="loading-spinner" /></div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Area</th><th>Details</th></tr></thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id}>
                    <td className="text-sm" style={{ whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleString('en-IN')}</td>
                    <td><strong>{r.actor_name || '—'}</strong>{r.actor_role && <span className="text-secondary text-xs"> · {r.actor_role}</span>}</td>
                    <td><span className="badge" style={{ background: (ACTION_COLOR[r.action] || 'var(--primary)') + '18', color: ACTION_COLOR[r.action] || 'var(--primary)' }}>{r.action}</span></td>
                    <td className="text-sm text-secondary">{r.entity}{r.entity_id ? ` #${r.entity_id}` : ''}</td>
                    <td className="text-sm">{r.summary || '—'}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5}><div className="empty-state" style={{ padding: '32px 24px' }}><Icon name="history" size={40} color="var(--primary-light)" /><p className="empty-state-title" style={{ marginTop: 12 }}>No audit entries yet</p></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
