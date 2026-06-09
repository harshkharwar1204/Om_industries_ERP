'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader, Modal, ConfirmDialog, useToast, Icon } from '@/components/ui';

interface Item { id: number; name: string; code: string | null; unit: string; description: string | null; }
const BLANK = { name: '', code: '', unit: 'kg', description: '' };
const UNITS = ['kg', 'pcs', 'meters', 'cones'];

export default function ItemsPage() {
  const [items, setItems]   = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]   = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm]     = useState(BLANK);
  const [delId, setDelId]   = useState<number | null>(null);
  const toast = useToast();

  const load = () => apiFetch('/masters/items').then(setItems).catch(e => toast(e.message, 'error')).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    if (!form.name) { toast('Item name required', 'error'); return; }
    try {
      if (editing) await apiFetch(`/masters/items/${editing.id}`, { method: 'PUT', body: JSON.stringify(form) });
      else         await apiFetch('/masters/items', { method: 'POST', body: JSON.stringify(form) });
      toast(editing ? 'Item updated' : 'Item added');
      setModal(false); setEditing(null); setForm(BLANK); load();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  const del = async () => {
    if (!delId) return;
    try { await apiFetch(`/masters/items/${delId}`, { method: 'DELETE' }); toast('Item deleted'); load(); }
    catch (e: any) { toast(e.message, 'error'); }
    setDelId(null);
  };

  return (
    <div className="page-enter">
      <PageHeader title="Items / Yarn Types" subtitle={`${items.length} items`} icon="tag" iconColor="var(--primary)">
        <button className="btn btn-primary" onClick={() => { setEditing(null); setForm(BLANK); setModal(true); }}>
          <Icon name="plus" size={16} /> Add Item
        </button>
      </PageHeader>

      <div className="card">
        {loading ? (
          <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><div className="loading-spinner" /></div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Item Code</th><th>Item Name</th><th>Unit</th><th>Description</th><th>Actions</th></tr></thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id}>
                    <td className="font-mono text-sm">{item.code || '—'}</td>
                    <td><strong>{item.name}</strong></td>
                    <td><span style={{ padding: '2px 8px', borderRadius: 9999, background: 'var(--bg)', border: '1px solid var(--border)', fontSize: 12, fontWeight: 600 }}>{item.unit}</span></td>
                    <td className="text-secondary text-sm">{item.description || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(item); setForm({ name: item.name, code: item.code || '', unit: item.unit, description: item.description || '' }); setModal(true); }}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setDelId(item.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr><td colSpan={5}><div className="empty-state"><Icon name="layers" size={40} color="var(--primary-light)" /><p className="empty-state-title">No items yet</p></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Item' : 'Add Item'}
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Item Name *</label><input className="form-input" value={form.name} onChange={f('name')} placeholder="e.g. Cotton 2/40s Combed" /></div>
            <div className="form-group"><label className="form-label">Item Code</label><input className="form-input" value={form.code} onChange={f('code')} placeholder="e.g. CTN-240C" /></div>
          </div>
          <div className="form-group">
            <label className="form-label">Unit</label>
            <select className="form-select" value={form.unit} onChange={f('unit')}>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={form.description} onChange={f('description')} placeholder="Optional description" rows={3} /></div>
        </div>
      </Modal>

      <ConfirmDialog open={!!delId} onClose={() => setDelId(null)} onConfirm={del} message="Delete this item? This cannot be undone." confirmLabel="Delete" danger />
    </div>
  );
}
