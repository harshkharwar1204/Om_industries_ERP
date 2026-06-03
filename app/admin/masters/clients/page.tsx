'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader, Modal, ConfirmDialog, useToast, Icon } from '@/components/ui';

interface Client { id: number; name: string; address: string | null; }
const BLANK = { name: '', address: '' };

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

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    if (!form.name) { toast('Party name required', 'error'); return; }
    try {
      if (editing) await apiFetch(`/clients/${editing.id}`, { method: 'PUT', body: JSON.stringify(form) });
      else         await apiFetch('/clients', { method: 'POST', body: JSON.stringify(form) });
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
      <PageHeader title="Clients / Parties" subtitle={`${clients.length} parties`}>
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
              <thead><tr><th>#</th><th>Party Name</th><th>Address</th><th>Actions</th></tr></thead>
              <tbody>
                {clients.map((c, i) => (
                  <tr key={c.id}>
                    <td className="text-secondary text-sm">{i + 1}</td>
                    <td><strong>{c.name}</strong></td>
                    <td className="text-secondary text-sm">{c.address || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(c); setForm({ name: c.name, address: c.address || '' }); setModal(true); }}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setDelId(c.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {clients.length === 0 && (
                  <tr><td colSpan={4}><div className="empty-state"><Icon name="archive" size={40} color="var(--primary-light)" /><p className="empty-state-title">No clients yet</p></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Client' : 'Add Client'}
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group"><label className="form-label">Party Name *</label><input className="form-input" value={form.name} onChange={f('name')} placeholder="e.g. Patel Textiles" /></div>
          <div className="form-group"><label className="form-label">Address</label><textarea className="form-textarea" value={form.address} onChange={f('address')} placeholder="City, State" rows={3} /></div>
        </div>
      </Modal>

      <ConfirmDialog open={!!delId} onClose={() => setDelId(null)} onConfirm={del} message="Delete this client? This cannot be undone." confirmLabel="Delete" danger />
    </div>
  );
}
