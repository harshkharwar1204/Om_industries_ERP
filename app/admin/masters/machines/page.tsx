'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader, Modal, ConfirmDialog, StatusBadge, useToast, Icon } from '@/components/ui';

interface Machine { id: number; name: string; code: string | null; capacity: string | null; type: string | null; status: string; }
const BLANK = { name: '', code: '', capacity: '', type: '', status: 'active' };
const TYPES = ['HTHP', 'Jigger', 'Soft Flow', 'Winch'];
const STATUSES = ['active', 'inactive', 'maintenance'];

export default function MachinesPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(false);
  const [editing, setEditing]   = useState<Machine | null>(null);
  const [form, setForm]         = useState(BLANK);
  const [delId, setDelId]       = useState<number | null>(null);
  const toast = useToast();

  const load = () => apiFetch('/masters/machines').then(setMachines).catch(e => toast(e.message, 'error')).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    if (!form.name) { toast('Machine name required', 'error'); return; }
    try {
      if (editing) await apiFetch(`/masters/machines/${editing.id}`, { method: 'PUT', body: JSON.stringify(form) });
      else         await apiFetch('/masters/machines', { method: 'POST', body: JSON.stringify(form) });
      toast(editing ? 'Machine updated' : 'Machine added');
      setModal(false); setEditing(null); setForm(BLANK); load();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  const del = async () => {
    if (!delId) return;
    try { await apiFetch(`/masters/machines/${delId}`, { method: 'DELETE' }); toast('Machine deleted'); load(); }
    catch (e: any) { toast(e.message, 'error'); }
    setDelId(null);
  };

  const statusColor: Record<string, string> = { active: 'var(--success)', inactive: 'var(--text-secondary)', maintenance: 'var(--warning)' };

  return (
    <div className="page-enter">
      <PageHeader title="Machines" subtitle={`${machines.length} machines`}>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setForm(BLANK); setModal(true); }}>
          <Icon name="plus" size={16} /> Add Machine
        </button>
      </PageHeader>

      <div className="card">
        {loading ? (
          <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><div className="loading-spinner" /></div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Code</th><th>Machine Name</th><th>Type</th><th>Capacity</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {machines.map(m => (
                  <tr key={m.id}>
                    <td className="font-mono text-sm">{m.code || '—'}</td>
                    <td><strong>{m.name}</strong></td>
                    <td className="text-secondary text-sm">{m.type || '—'}</td>
                    <td className="text-secondary text-sm">{m.capacity || '—'}</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 9999, fontSize: 12, fontWeight: 600, background: statusColor[m.status] + '18', color: statusColor[m.status], textTransform: 'capitalize' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor[m.status] }} />{m.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(m); setForm({ name: m.name, code: m.code || '', capacity: m.capacity || '', type: m.type || '', status: m.status }); setModal(true); }}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setDelId(m.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {machines.length === 0 && (
                  <tr><td colSpan={6}><div className="empty-state"><Icon name="cpu" size={40} color="var(--primary-light)" /><p className="empty-state-title">No machines yet</p></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Machine' : 'Add Machine'}
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Machine Name *</label><input className="form-input" value={form.name} onChange={f('name')} placeholder="e.g. HTHP Machine 1" /></div>
            <div className="form-group"><label className="form-label">Code</label><input className="form-input" value={form.code} onChange={f('code')} placeholder="e.g. MC-01" /></div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-select" value={form.type} onChange={f('type')}>
                <option value="">Select type…</option>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Capacity</label><input className="form-input" value={form.capacity} onChange={f('capacity')} placeholder="e.g. 500 kg" /></div>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {STATUSES.map(s => (
                <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: `2px solid ${form.status === s ? statusColor[s] : 'var(--border)'}`, background: form.status === s ? statusColor[s] + '18' : 'transparent', fontWeight: form.status === s ? 600 : 400, fontSize: 13, transition: 'all 0.15s', textTransform: 'capitalize' }}>
                  <input type="radio" name="status" value={s} checked={form.status === s} onChange={() => setForm(p => ({ ...p, status: s }))} style={{ display: 'none' }} />{s}
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!delId} onClose={() => setDelId(null)} onConfirm={del} message="Delete this machine? This cannot be undone." confirmLabel="Delete" danger />
    </div>
  );
}
