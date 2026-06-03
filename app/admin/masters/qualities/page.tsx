'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader, Modal, ConfirmDialog, useToast, Icon } from '@/components/ui';

interface Quality { id: number; name: string; hanks_rate_per_kg: number; coning_rate_per_kg: number; }
const BLANK = { name: '', hanks_rate_per_kg: '', coning_rate_per_kg: '' };

export default function QualitiesPage() {
  const [qualities, setQualities] = useState<Quality[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(false);
  const [editing, setEditing]     = useState<Quality | null>(null);
  const [form, setForm]           = useState(BLANK);
  const [delId, setDelId]         = useState<number | null>(null);
  const toast = useToast();

  const load = () => apiFetch('/qualities').then(setQualities).catch(e => toast(e.message, 'error')).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    if (!form.name) { toast('Quality name required', 'error'); return; }
    try {
      if (editing) await apiFetch(`/qualities/${editing.id}`, { method: 'PUT', body: JSON.stringify(form) });
      else         await apiFetch('/qualities', { method: 'POST', body: JSON.stringify(form) });
      toast(editing ? 'Quality updated' : 'Quality added');
      setModal(false); setEditing(null); setForm(BLANK); load();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  const del = async () => {
    if (!delId) return;
    try { await apiFetch(`/qualities/${delId}`, { method: 'DELETE' }); toast('Quality deleted'); load(); }
    catch (e: any) { toast(e.message, 'error'); }
    setDelId(null);
  };

  return (
    <div className="page-enter">
      <PageHeader title="Qualities" subtitle="Yarn quality types with per-kg rates">
        <button className="btn btn-primary" onClick={() => { setEditing(null); setForm(BLANK); setModal(true); }}>
          <Icon name="plus" size={16} /> Add Quality
        </button>
      </PageHeader>

      <div className="card">
        {loading ? (
          <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><div className="loading-spinner" /></div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Quality Name</th><th>Hanks Rate (₹/kg)</th><th>Coning Rate (₹/kg)</th><th>Actions</th></tr></thead>
              <tbody>
                {qualities.map(q => (
                  <tr key={q.id}>
                    <td><strong>{q.name}</strong></td>
                    <td style={{ fontFamily: 'var(--font-heading)', color: 'var(--success)' }}>₹{q.hanks_rate_per_kg}</td>
                    <td style={{ fontFamily: 'var(--font-heading)', color: 'var(--info)' }}>₹{q.coning_rate_per_kg}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(q); setForm({ name: q.name, hanks_rate_per_kg: String(q.hanks_rate_per_kg), coning_rate_per_kg: String(q.coning_rate_per_kg) }); setModal(true); }}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setDelId(q.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {qualities.length === 0 && (
                  <tr><td colSpan={4}><div className="empty-state"><Icon name="box" size={40} color="var(--primary-light)" /><p className="empty-state-title">No qualities yet</p></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Quality' : 'Add Quality'}
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>}>
        <div className="form-row">
          <div className="form-group" style={{ gridColumn: '1 / -1' }}><label className="form-label">Quality Name *</label><input className="form-input" value={form.name} onChange={f('name')} placeholder="e.g. Cotton 2/40s Combed" /></div>
          <div className="form-group"><label className="form-label">Hanks Rate (₹/kg)</label><input className="form-input" type="number" step="0.01" min="0" value={form.hanks_rate_per_kg} onChange={f('hanks_rate_per_kg')} placeholder="0.00" /></div>
          <div className="form-group"><label className="form-label">Coning Rate (₹/kg)</label><input className="form-input" type="number" step="0.01" min="0" value={form.coning_rate_per_kg} onChange={f('coning_rate_per_kg')} placeholder="0.00" /></div>
        </div>
      </Modal>

      <ConfirmDialog open={!!delId} onClose={() => setDelId(null)} onConfirm={del} message="Delete this quality? Active stock/production entries may be affected." confirmLabel="Delete" danger />
    </div>
  );
}
