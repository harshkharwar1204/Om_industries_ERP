'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader, Modal, useToast, Icon } from '@/components/ui';

const BLANK = { name: '', code: '', unit: 'g', stock_qty: '', low_threshold: '' };

export default function ChemicalsPage() {
  const [rows, setRows]     = useState<any[]>([]);
  const [loading, setLoad]  = useState(true);
  const [modal, setModal]   = useState(false);
  const [form, setForm]     = useState<any>(BLANK);
  const [restock, setRestock] = useState<any>(null);
  const [addQty, setAddQty] = useState('');
  const toast = useToast();

  const load = () => { setLoad(true); apiFetch('/masters/chemicals').then(setRows).catch(e => toast(e.message, 'error')).finally(() => setLoad(false)); };
  useEffect(() => { load(); }, []);

  const f = (k: string) => (e: any) => setForm((p: any) => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    if (!form.name) { toast('Name required', 'error'); return; }
    try { await apiFetch('/masters/chemicals', { method: 'POST', body: JSON.stringify(form) }); toast('Chemical added'); setModal(false); setForm(BLANK); load(); }
    catch (e: any) { toast(e.message, 'error'); }
  };

  const doRestock = async () => {
    if (!restock || !addQty) return;
    try { await apiFetch('/masters/chemicals', { method: 'PUT', body: JSON.stringify({ id: restock.id, add_qty: addQty }) }); toast('Stock added'); setRestock(null); setAddQty(''); load(); }
    catch (e: any) { toast(e.message, 'error'); }
  };

  const low = rows.filter(r => Number(r.stock_qty) <= Number(r.low_threshold) && Number(r.low_threshold) > 0);

  return (
    <div className="page-enter">
      <PageHeader title="Chemicals & Dyes" subtitle={`${rows.length} items`} icon="flask-conical" iconColor="var(--info)">
        <button className="btn btn-primary" onClick={() => { setForm(BLANK); setModal(true); }}><Icon name="plus" size={16} /> Add Chemical</button>
      </PageHeader>

      {low.length > 0 && (
        <div className="card" style={{ borderLeft: '4px solid var(--danger)', marginBottom: 16 }}>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="alert-circle" size={18} color="var(--danger)" />
            <strong style={{ fontSize: 14 }}>{low.length} chemical{low.length > 1 ? 's' : ''} low on stock:</strong>
            <span className="text-secondary text-sm">{low.map(r => r.name).join(', ')}</span>
          </div>
        </div>
      )}

      <div className="card">
        {loading ? (
          <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><div className="loading-spinner" /></div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Name</th><th className="hide-mobile">Code</th><th>Stock</th><th>Low Threshold</th><th>Actions</th></tr></thead>
              <tbody>
                {rows.map(r => {
                  const isLow = Number(r.stock_qty) <= Number(r.low_threshold) && Number(r.low_threshold) > 0;
                  return (
                    <tr key={r.id}>
                      <td><strong>{r.name}</strong></td>
                      <td className="font-mono text-sm hide-mobile">{r.code || '—'}</td>
                      <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, color: isLow ? 'var(--danger)' : 'var(--text)' }}>{Number(r.stock_qty).toFixed(1)} {r.unit}{isLow ? ' ⚠' : ''}</td>
                      <td className="text-secondary text-sm">{Number(r.low_threshold).toFixed(0)} {r.unit}</td>
                      <td><button className="btn btn-secondary btn-sm" onClick={() => { setRestock(r); setAddQty(''); }}>+ Restock</button></td>
                    </tr>
                  );
                })}
                {rows.length === 0 && <tr><td colSpan={5}><div className="empty-state" style={{ padding: 32 }}><Icon name="flask-conical" size={40} color="var(--primary-light)" /><p className="empty-state-title">No chemicals yet</p></div></td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Add Chemical / Dye"
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>}>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Name *</label><input className="form-input" value={form.name} onChange={f('name')} placeholder="e.g. Red 3BS" /></div>
          <div className="form-group"><label className="form-label">Code</label><input className="form-input" value={form.code} onChange={f('code')} /></div>
          <div className="form-group"><label className="form-label">Unit</label>
            <select className="form-select" value={form.unit} onChange={f('unit')}><option>g</option><option>kg</option><option>l</option><option>ml</option></select>
          </div>
          <div className="form-group"><label className="form-label">Opening Stock</label><input className="form-input" type="number" value={form.stock_qty} onChange={f('stock_qty')} /></div>
          <div className="form-group"><label className="form-label">Low Threshold</label><input className="form-input" type="number" value={form.low_threshold} onChange={f('low_threshold')} /></div>
        </div>
      </Modal>

      <Modal open={!!restock} onClose={() => setRestock(null)} title={`Restock ${restock?.name ?? ''}`}
        footer={<><button className="btn btn-secondary" onClick={() => setRestock(null)}>Cancel</button><button className="btn btn-primary" onClick={doRestock} disabled={!addQty}>Add Stock</button></>}>
        <div className="form-group"><label className="form-label">Quantity to Add ({restock?.unit})</label>
          <input className="form-input" type="number" value={addQty} onChange={e => setAddQty(e.target.value)} style={{ textAlign: 'center', fontSize: 20, fontWeight: 700, height: 52 }} autoFocus />
        </div>
      </Modal>
    </div>
  );
}
