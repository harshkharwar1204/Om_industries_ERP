'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader, Modal, useToast, Icon } from '@/components/ui';

interface StockEntry { id: number; date: string; challan_no: string | null; weight_kg: number; bundles: number | null; remaining_weight_kg: number; clients?: { name: string }; qualities?: { name: string }; }
const BLANK = { date: new Date().toISOString().split('T')[0], challan_no: '', client_id: '', quality_id: '', weight_kg: '', bundles: '' };

export default function StockInwardPage() {
  const [entries, setEntries]   = useState<StockEntry[]>([]);
  const [clients, setClients]   = useState<any[]>([]);
  const [qualities, setQualities] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(false);
  const [form, setForm]         = useState(BLANK);
  const [saving, setSaving]     = useState(false);
  const toast = useToast();

  useEffect(() => {
    Promise.all([apiFetch('/stock/inward'), apiFetch('/clients'), apiFetch('/qualities')])
      .then(([s, c, q]) => { setEntries(s); setClients(c); setQualities(q); })
      .catch(e => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  const reload = () => apiFetch('/stock/inward').then(setEntries).catch(e => toast(e.message, 'error'));
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    if (!form.client_id || !form.quality_id || !form.weight_kg) { toast('Client, quality and weight required', 'error'); return; }
    setSaving(true);
    try {
      await apiFetch('/stock/inward', { method: 'POST', body: JSON.stringify(form) });
      toast('Stock entry added');
      setModal(false); setForm(BLANK); reload();
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const totalKg = entries.reduce((s, e) => s + Number(e.remaining_weight_kg), 0);

  return (
    <div className="page-enter">
      <PageHeader title="Stock Inward" subtitle={`${entries.length} entries · ${totalKg.toFixed(1)} kg total remaining`}>
        <button className="btn btn-primary" onClick={() => setModal(true)}>
          <Icon name="plus" size={16} /> New Entry
        </button>
      </PageHeader>

      <div className="card">
        {loading ? (
          <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><div className="loading-spinner" /></div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Challan No.</th><th>Client</th><th>Quality</th><th>Weight (kg)</th><th>Bundles</th><th>Remaining (kg)</th></tr></thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id}>
                    <td className="text-sm">{new Date(e.date).toLocaleDateString('en-IN')}</td>
                    <td className="font-mono text-sm">{e.challan_no || '—'}</td>
                    <td><strong>{e.clients?.name}</strong></td>
                    <td>{e.qualities?.name}</td>
                    <td style={{ fontFamily: 'var(--font-heading)' }}>{e.weight_kg}</td>
                    <td>{e.bundles ?? '—'}</td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: Number(e.remaining_weight_kg) > 0 ? 'var(--success)' : 'var(--text-secondary)' }}>
                        {e.remaining_weight_kg} kg
                      </span>
                    </td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr><td colSpan={7}><div className="empty-state"><Icon name="package-plus" size={40} color="var(--primary-light)" /><p className="empty-state-title">No stock entries yet</p></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="New Stock Inward Entry"
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Entry'}</button></>}>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Date</label><input className="form-input" type="date" value={form.date} onChange={f('date')} /></div>
          <div className="form-group"><label className="form-label">Challan No.</label><input className="form-input" value={form.challan_no} onChange={f('challan_no')} placeholder="Optional" /></div>
          <div className="form-group">
            <label className="form-label">Client *</label>
            <select className="form-select" value={form.client_id} onChange={f('client_id')}>
              <option value="">Select client…</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Quality *</label>
            <select className="form-select" value={form.quality_id} onChange={f('quality_id')}>
              <option value="">Select quality…</option>
              {qualities.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Weight (kg) *</label><input className="form-input" type="number" step="0.01" min="0" value={form.weight_kg} onChange={f('weight_kg')} placeholder="0.00" /></div>
          <div className="form-group"><label className="form-label">Bundles / Bags</label><input className="form-input" type="number" min="0" value={form.bundles} onChange={f('bundles')} placeholder="Optional" /></div>
        </div>
      </Modal>
    </div>
  );
}
