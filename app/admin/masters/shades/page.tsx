'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader, Modal, ConfirmDialog, useToast, Icon } from '@/components/ui';

interface Shade { id: number; name: string; code: string | null; description: string | null; }
const BLANK = { name: '', code: '', description: '' };

export default function ShadesPage() {
  const [shades, setShades] = useState<Shade[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(false);
  const [editing, setEditing] = useState<Shade | null>(null);
  const [form, setForm]       = useState(BLANK);
  const [delId, setDelId]     = useState<number | null>(null);
  const [search, setSearch]   = useState('');
  const toast = useToast();

  const load = () => apiFetch('/masters/shades').then(setShades).catch(e => toast(e.message, 'error')).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    if (!form.name) { toast('Shade name required', 'error'); return; }
    try {
      if (editing) await apiFetch(`/masters/shades/${editing.id}`, { method: 'PUT', body: JSON.stringify(form) });
      else         await apiFetch('/masters/shades', { method: 'POST', body: JSON.stringify(form) });
      toast(editing ? 'Shade updated' : 'Shade added');
      setModal(false); setEditing(null); setForm(BLANK); load();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  const del = async () => {
    if (!delId) return;
    try { await apiFetch(`/masters/shades/${delId}`, { method: 'DELETE' }); toast('Shade deleted'); load(); }
    catch (e: any) { toast(e.message, 'error'); }
    setDelId(null);
  };

  const filtered = shades.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.code || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="page-enter">
      <PageHeader title="Shades" subtitle={`${shades.length} shades`} icon="palette" iconColor="var(--primary)">
        <button className="btn btn-primary" onClick={() => { setEditing(null); setForm(BLANK); setModal(true); }}>
          <Icon name="plus" size={16} /> Add Shade
        </button>
      </PageHeader>

      <div className="card">
        <div className="card-body" style={{ borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', maxWidth: 280 }}>
            <Icon name="search" size={16} color="var(--text-secondary)" />
            <input style={{ border: 'none', background: 'none', outline: 'none', fontSize: 14, width: '100%' }} placeholder="Search shades…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        {loading ? (
          <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><div className="loading-spinner" /></div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Shade Code</th><th>Shade Name</th><th>Description</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id}>
                    <td className="font-mono text-sm">{s.code || '—'}</td>
                    <td><strong>{s.name}</strong></td>
                    <td className="text-secondary text-sm">{s.description || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(s); setForm({ name: s.name, code: s.code || '', description: s.description || '' }); setModal(true); }}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setDelId(s.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={4}><div className="empty-state"><Icon name="palette" size={40} color="var(--primary-light)" /><p className="empty-state-title">No shades yet</p></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Shade' : 'Add Shade'}
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Shade Name *</label><input className="form-input" value={form.name} onChange={f('name')} placeholder="e.g. Navy Blue Dark" /></div>
            <div className="form-group"><label className="form-label">Shade Code</label><input className="form-input" value={form.code} onChange={f('code')} placeholder="e.g. NB-001" /></div>
          </div>
          <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={form.description} onChange={f('description')} placeholder="Optional notes about this shade" rows={3} /></div>
        </div>
      </Modal>

      <ConfirmDialog open={!!delId} onClose={() => setDelId(null)} onConfirm={del} message="Delete this shade? This cannot be undone." confirmLabel="Delete" danger />
    </div>
  );
}
