'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader, useToast, Icon } from '@/components/ui';

interface CommLog {
  id: number; type: string; category: string; content: string;
  amount: number | null; reference_no: string | null; status: string; created_at: string;
  clients?: { name: string };
}

const CATEGORY_LABELS: Record<string, string> = {
  dispatch_complete:  'Dispatch',
  payment_reminder:  'Payment Reminder',
  invoice_sent:      'Invoice Sent',
  order_ready:       'Order Ready',
  manual:            'Manual',
};

const TYPE_COLORS: Record<string, string> = {
  whatsapp: '#25D366',
  email:    'var(--info)',
  sms:      'var(--primary)',
};

const TYPE_ICONS: Record<string, string> = {
  whatsapp: 'message-circle',
  email:    'send',
  sms:      'phone',
};

export default function CommunicationsPage() {
  const [logs, setLogs]         = useState<CommLog[]>([]);
  const [clients, setClients]   = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filterClient, setFilterClient] = useState('');
  const [filterType, setFilterType]     = useState('');
  const toast = useToast();

  const load = () => {
    apiFetch(`/communications${filterClient ? `?client_id=${filterClient}` : ''}`)
      .then(setLogs).catch(e => toast(e.message, 'error')).finally(() => setLoading(false));
  };

  useEffect(() => {
    apiFetch('/clients').then(setClients).catch(() => {});
    load();
  }, []);

  useEffect(() => { setLoading(true); load(); }, [filterClient]);

  const filtered = filterType ? logs.filter(l => l.type === filterType) : logs;

  return (
    <div className="page-enter">
      <PageHeader title="Communications" subtitle={`${filtered.length} messages logged`} icon="message-circle" iconColor="#25D366" />

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <select className="form-select" value={filterClient} onChange={e => setFilterClient(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="">All Parties</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="form-select" value={filterType} onChange={e => setFilterType(e.target.value)} style={{ maxWidth: 160 }}>
          <option value="">All Types</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="email">Email</option>
          <option value="sms">SMS</option>
        </select>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><div className="loading-spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: 60 }}>
            <Icon name="message-circle" size={40} color="var(--primary-light)" />
            <p className="empty-state-title">No messages logged yet</p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>WhatsApp messages sent from Dispatch will appear here</p>
          </div>
        ) : (
          <div>
            {filtered.map(l => (
              <div key={l.id} style={{ display: 'flex', gap: 14, padding: '14px 16px', borderBottom: '1px solid var(--border)', alignItems: 'flex-start' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: (TYPE_COLORS[l.type] || 'var(--primary)') + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name={TYPE_ICONS[l.type] || 'message-circle'} size={18} color={TYPE_COLORS[l.type] || 'var(--primary)'} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <strong style={{ fontSize: 14 }}>{l.clients?.name || `Client #${(l as any).client_id}`}</strong>
                    <span style={{ padding: '1px 7px', borderRadius: 9999, fontSize: 11, fontWeight: 600, background: 'var(--hover-bg)', color: 'var(--text-secondary)' }}>
                      {CATEGORY_LABELS[l.category] || l.category}
                    </span>
                    {l.reference_no && (
                      <span style={{ fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--accent)', fontWeight: 700 }}>{l.reference_no}</span>
                    )}
                    {l.amount && (
                      <span style={{ fontFamily: 'var(--font-heading)', fontSize: 12, fontWeight: 700, color: 'var(--success)' }}>₹{Number(l.amount).toLocaleString('en-IN')}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, wordBreak: 'break-word' }}>{l.content}</div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {new Date(l.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
