'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader, Modal, ConfirmDialog, StatusBadge, useToast, Icon } from '@/components/ui';

interface Worker { id: number; name: string; phone: string; role: string; department: string | null; is_active: boolean; }
const BLANK = { name: '', phone: '', role: 'hanks_worker', department: 'hanks', pin: '' };

export default function WorkersPage() {
  const [workers, setWorkers]   = useState<Worker[]>([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(false);
  const [editing, setEditing]   = useState<Worker | null>(null);
  const [form, setForm]         = useState(BLANK);
  const [pinReset, setPinReset] = useState<{ id: number; pin: string } | null>(null);
  const toast = useToast();

  const load = () => apiFetch('/workers').then(setWorkers).catch(e => toast(e.message, 'error')).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

  const openAdd  = () => { setEditing(null); setForm(BLANK); setModal(true); };
  const openEdit = (w: Worker) => { setEditing(w); setForm({ name: w.name, phone: w.phone, role: w.role, department: w.department || 'hanks', pin: '' }); setModal(true); };

  const save = async () => {
    if (!form.name || !form.phone) { toast('Name and phone required', 'error'); return; }
    try {
      if (editing) {
        await apiFetch(`/workers/${editing.id}`, { method: 'PUT', body: JSON.stringify(form) });
        toast('Worker updated');
      } else {
        if (form.pin.length < 4) { toast('4-digit PIN required', 'error'); return; }
        await apiFetch('/workers', { method: 'POST', body: JSON.stringify(form) });
        toast('Worker added');
      }
      setModal(false); setEditing(null); setForm(BLANK); load();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  const toggle = async (id: number) => {
    try { await apiFetch(`/workers/${id}/toggle`, { method: 'PUT' }); toast('Status updated'); load(); }
    catch (e: any) { toast(e.message, 'error'); }
  };

  const resetPin = async () => {
    if (!pinReset || pinReset.pin.length < 4) { toast('4-digit PIN required', 'error'); return; }
    try {
      await apiFetch(`/workers/${pinReset.id}/pin`, { method: 'PUT', body: JSON.stringify({ pin: pinReset.pin }) });
      toast('PIN reset successfully'); setPinReset(null);
    } catch (e: any) { toast(e.message, 'error'); }
  };

  return (
    <div className="page-enter">
      <PageHeader title="Workers" subtitle={`${workers.length} registered`}>
        <button className="btn btn-primary" onClick={openAdd}>
          <Icon name="plus" size={16} /> Add Worker
        </button>
      </PageHeader>

      <div className="card">
        {loading ? (
          <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><div className="loading-spinner" /></div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Name</th><th>Phone</th><th>Role</th><th>Dept</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {workers.map(w => (
                  <tr key={w.id} style={!w.is_active ? { opacity: 0.55 } : {}}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary-dark)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                          {w.name[0]}
                        </div>
                        <strong>{w.name}</strong>
                      </div>
                    </td>
                    <td className="font-mono text-sm">{w.phone}</td>
                    <td>{w.role.replace('_', ' ')}</td>
                    <td>{w.department || '—'}</td>
                    <td><StatusBadge status={w.is_active ? 'active' : 'inactive'} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(w)}>Edit</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setPinReset({ id: w.id, pin: '' })} title="Reset PIN">
                          <Icon name="refresh-cw" size={14} />
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => toggle(w.id)} title={w.is_active ? 'Deactivate' : 'Activate'}>
                          <Icon name={w.is_active ? 'x-circle' : 'check-circle'} size={14} color={w.is_active ? 'var(--danger)' : 'var(--success)'} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {workers.length === 0 && (
                  <tr><td colSpan={6}>
                    <div className="empty-state"><Icon name="users" size={40} color="var(--primary-light)" /><p className="empty-state-title">No workers yet</p></div>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Worker' : 'Add Worker'}
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>}>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Full Name *</label><input className="form-input" value={form.name} onChange={f('name')} placeholder="e.g. Ramesh Kumar" /></div>
          <div className="form-group"><label className="form-label">Phone *</label><input className="form-input" type="tel" inputMode="numeric" value={form.phone} onChange={f('phone')} placeholder="10-digit number" /></div>
          <div className="form-group">
            <label className="form-label">Role</label>
            <select className="form-select" value={form.role} onChange={f('role')}>
              <option value="hanks_worker">Hanks Worker</option>
              <option value="coning_worker">Coning Worker</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Department</label>
            <select className="form-select" value={form.department ?? 'hanks'} onChange={f('department')}>
              <option value="hanks">Hanks</option>
              <option value="coning">Coning</option>
              <option value="dyeing">Dyeing</option>
            </select>
          </div>
          {!editing && (
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">4-Digit PIN *</label>
              <input className="form-input" type="password" inputMode="numeric" maxLength={4} value={form.pin} onChange={f('pin')} placeholder="e.g. 1234" />
            </div>
          )}
        </div>
      </Modal>

      {/* PIN reset modal */}
      <Modal open={!!pinReset} onClose={() => setPinReset(null)} title="Reset PIN"
        footer={<><button className="btn btn-secondary" onClick={() => setPinReset(null)}>Cancel</button><button className="btn btn-primary" onClick={resetPin}>Reset PIN</button></>}>
        <div className="form-group">
          <label className="form-label">New 4-Digit PIN</label>
          <input className="form-input" type="password" inputMode="numeric" maxLength={4}
            value={pinReset?.pin ?? ''} onChange={e => setPinReset(p => p ? { ...p, pin: e.target.value.replace(/\D/g, '').slice(0, 4) } : null)}
            placeholder="Enter new PIN" style={{ fontSize: 20, textAlign: 'center', letterSpacing: 8 }} />
        </div>
      </Modal>
    </div>
  );
}
