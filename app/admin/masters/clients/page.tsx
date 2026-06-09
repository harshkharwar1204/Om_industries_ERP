'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader, Modal, ConfirmDialog, useToast, Icon } from '@/components/ui';

interface Client {
  id: number; name: string; address: string | null; phone: string | null;
  gstin: string | null; state_code: string | null; dealer_type: string | null;
  portal_enabled: boolean; portal_passcode: string | null;
}

const BLANK = { name: '', address: '', phone: '', gstin: '', state_code: '24', dealer_type: 'registered', portal_enabled: false, portal_passcode: '' };
const DEALER_TYPES = ['registered', 'unregistered', 'composition', 'export'];
const DEALER_LABELS: Record<string, string> = { registered: 'Registered', unregistered: 'Unregistered', composition: 'Composition', export: 'Export' };

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm]       = useState(BLANK);
  const [delId, setDelId]     = useState<number | null>(null);
  const toast = useToast();

  const load = () => apiFetch('/clients').then(setClients).catch(e => toast(e.message, 'error')).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const openEdit = (c: Client) => {
    setEditing(c);
    setForm({ name: c.name, address: c.address || '', phone: c.phone || '', gstin: c.gstin || '', state_code: c.state_code || '24', dealer_type: c.dealer_type || 'registered', portal_enabled: c.portal_enabled ?? false, portal_passcode: c.portal_passcode || '' });
    setModal(true);
  };

  const save = async () => {
    if (!form.name) { toast('Party name required', 'error'); return; }
    try {
      if (editing) await apiFetch(`/clients/${editing.id}`, { method: 'PUT',  body: JSON.stringify(form) });
      else         await apiFetch('/clients',               { method: 'POST', body: JSON.stringify(form) });
      toast(editing ? 'Client updated' : 'Client added');
      setModal(false); setEditing(null); setForm(BLANK); load();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  const del = async () => {
    if (!delId) return;
    try { await apiFetch(`/clients/${delId}`, { method: 'DELETE' }); toast('Client deleted'); load(); }
    catch (e: any) { toast(e.message, 'error'); }
    setDelId(null);
  };

  return (
    <div className="page-enter">
      <PageHeader title="Clients / Parties" subtitle={`${clients.length} parties`} icon="archive" iconColor="var(--primary)">
        <button className="btn btn-primary" onClick={() => { setEditing(null); setForm(BLANK); setModal(true); }}>
          <Icon name="plus" size={16} /> Add Client
        </button>
      </PageHeader>

      <div className="card">
        {loading ? (
          <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><div className="loading-spinner" /></div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>#</th><th>Party Name</th><th>Phone</th><th>GSTIN</th><th>Dealer Type</th><th>Portal</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {clients.map((c, i) => (
                  <tr key={c.id}>
                    <td className="text-secondary text-sm">{i + 1}</td>
                    <td><strong>{c.name}</strong></td>
                    <td className="font-mono text-sm">{c.phone || <span className="text-secondary">—</span>}</td>
                    <td>
                      {c.gstin
                        ? <span style={{ fontFamily: 'var(--font-heading)', fontSize: 12, letterSpacing: '0.04em' }}>{c.gstin}</span>
                        : <span className="text-secondary text-sm">—</span>}
                    </td>
                    <td>
                      <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600, background: c.dealer_type === 'registered' ? 'var(--success-light)' : c.dealer_type === 'export' ? '#DBEAFE' : '#F1F5F9', color: c.dealer_type === 'registered' ? 'var(--success)' : c.dealer_type === 'export' ? 'var(--info)' : 'var(--text-secondary)', textTransform: 'capitalize' }}>
                        {DEALER_LABELS[c.dealer_type || 'registered']}
                      </span>
                    </td>
                    <td>
                      {c.portal_enabled
                        ? <span className="badge badge-approved">Active</span>
                        : <span className="text-secondary text-sm">—</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(c)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setDelId(c.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {clients.length === 0 && (
                  <tr><td colSpan={7}><div className="empty-state"><Icon name="archive" size={40} color="var(--primary-light)" /><p className="empty-state-title">No clients yet</p></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Client' : 'Add Client'}
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Party Name *</label>
            <input className="form-input" value={form.name} onChange={f('name')} placeholder="e.g. Patel Textiles" />
          </div>
          <div className="form-group">
            <label className="form-label">Mobile / WhatsApp Number</label>
            <div style={{ display: 'flex', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
              <span style={{ padding: '10px 12px', background: 'var(--hover-bg)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600, borderRight: '1px solid var(--border)', whiteSpace: 'nowrap' }}>+91</span>
              <input className="form-input" type="tel" inputMode="numeric" value={form.phone} onChange={f('phone')} placeholder="10-digit number" style={{ border: 'none', borderRadius: 0 }} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">GSTIN</label>
              <input className="form-input" value={form.gstin} onChange={f('gstin')} placeholder="e.g. 24AABCP1234A1Z5" style={{ fontFamily: 'var(--font-heading)', fontSize: 14, letterSpacing: '0.04em', textTransform: 'uppercase' }}
                onInput={e => { (e.currentTarget as HTMLInputElement).value = (e.currentTarget as HTMLInputElement).value.toUpperCase(); }} />
            </div>
            <div className="form-group">
              <label className="form-label">State Code</label>
              <input className="form-input" value={form.state_code} onChange={f('state_code')} placeholder="24 (Gujarat)" style={{ fontFamily: 'var(--font-heading)' }} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Dealer Type</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {DEALER_TYPES.map(dt => (
                <label key={dt} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: `1.5px solid ${form.dealer_type === dt ? 'var(--accent)' : 'var(--border)'}`, background: form.dealer_type === dt ? 'var(--accent-light)' : 'var(--surface)', cursor: 'pointer', transition: 'all 150ms', fontSize: 13, fontWeight: form.dealer_type === dt ? 600 : 400 }}>
                  <input type="radio" name="dealer_type" value={dt} checked={form.dealer_type === dt} onChange={() => setForm(p => ({ ...p, dealer_type: dt }))} style={{ display: 'none' }} />
                  {DEALER_LABELS[dt]}
                </label>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Address</label>
            <textarea className="form-textarea" value={form.address} onChange={f('address')} placeholder="City, State" rows={2} />
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Customer Portal</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 12 }}>
              <input type="checkbox" checked={form.portal_enabled} onChange={e => setForm(p => ({ ...p, portal_enabled: e.target.checked }))} />
              <span style={{ fontSize: 14, fontWeight: 500 }}>Enable portal access for this party</span>
            </label>
            {form.portal_enabled && (
              <div className="form-group">
                <label className="form-label">Portal Passcode (4-6 digits)</label>
                <input className="form-input" type="text" inputMode="numeric" value={form.portal_passcode} onChange={f('portal_passcode')} placeholder="e.g. 1234" maxLength={6} style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.1em' }} />
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Party logs in at <strong>/portal</strong> with their phone number + this passcode</div>
              </div>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!delId} onClose={() => setDelId(null)} onConfirm={del} message="Delete this client? This cannot be undone." confirmLabel="Delete" danger />
    </div>
  );
}
