'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader, Modal, ConfirmDialog, useToast, Icon } from '@/components/ui';

interface Rate {
  id: number;
  client_id: number;
  item_id: number | null;
  shade_id: number | null;
  rate_per_kg: number;
  effective_date: string;
  notes: string | null;
  clients?: { name: string };
  items?: { name: string; unit: string };
}

const BLANK = { client_id: '', item_id: '', shade_id: '', rate_per_kg: '', effective_date: new Date().toISOString().split('T')[0], notes: '' };

export default function RatesPage() {
  const [rates, setRates]     = useState<Rate[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [items, setItems]     = useState<any[]>([]);
  const [shades, setShades]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(false);
  const [editing, setEditing] = useState<Rate | null>(null);
  const [form, setForm]       = useState(BLANK);
  const [delId, setDelId]     = useState<number | null>(null);
  const [saving, setSaving]   = useState(false);
  const [filterClient, setFilterClient] = useState('');
  const toast = useToast();

  const load = () => {
    setLoading(true);
    apiFetch(`/rates${filterClient ? `?client_id=${filterClient}` : ''}`)
      .then(setRates).catch(e => toast(e.message, 'error')).finally(() => setLoading(false));
  };

  useEffect(() => {
    Promise.all([apiFetch('/clients'), apiFetch('/masters/items'), apiFetch('/masters/shades')])
      .then(([c, i, s]) => { setClients(c); setItems(i); setShades(s); })
      .catch(e => toast(e.message, 'error'));
    load();
  }, []);

  useEffect(() => { load(); }, [filterClient]);

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const openEdit = (r: Rate) => {
    setEditing(r);
    setForm({
      client_id:      String(r.client_id),
      item_id:        r.item_id  ? String(r.item_id)  : '',
      shade_id:       r.shade_id ? String(r.shade_id) : '',
      rate_per_kg:    String(r.rate_per_kg),
      effective_date: r.effective_date,
      notes:          r.notes || '',
    });
    setModal(true);
  };

  const save = async () => {
    if (!form.client_id || !form.rate_per_kg) { toast('Client and rate required', 'error'); return; }
    setSaving(true);
    try {
      if (editing) await apiFetch(`/rates/${editing.id}`, { method: 'PUT',  body: JSON.stringify(form) });
      else         await apiFetch('/rates',                { method: 'POST', body: JSON.stringify(form) });
      toast(editing ? 'Rate updated' : 'Rate added');
      setModal(false); setEditing(null); setForm(BLANK); load();
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const del = async () => {
    if (!delId) return;
    try { await apiFetch(`/rates/${delId}`, { method: 'DELETE' }); toast('Rate deleted'); load(); }
    catch (e: any) { toast(e.message, 'error'); }
    setDelId(null);
  };

  // Group rates by client for display
  const grouped = clients
    .filter(c => !filterClient || String(c.id) === filterClient)
    .map(c => ({ client: c, rates: rates.filter(r => r.client_id === c.id) }))
    .filter(g => g.rates.length > 0);

  const shadeName = (id: number | null) => id ? (shades.find(s => s.id === id)?.name ?? `#${id}`) : null;

  return (
    <div className="page-enter">
      <PageHeader title="Rate Master" subtitle={`${rates.length} rates across ${new Set(rates.map(r => r.client_id)).size} clients`} icon="indian-rupee" iconColor="var(--success)">
        <button className="btn btn-primary" onClick={() => { setEditing(null); setForm(BLANK); setModal(true); }}>
          <Icon name="plus" size={16} /> Add Rate
        </button>
      </PageHeader>

      {/* Info banner */}
      <div style={{ background: 'var(--info-light)', border: '1px solid #93C5FD', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 20, fontSize: 13, color: '#1E40AF', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <Icon name="alert-circle" size={15} color="#2563EB" style={{ flexShrink: 0, marginTop: 1 }} />
        Rate lookup priority: <strong>Client + Item + Shade</strong> → <strong>Client + Item</strong> → <strong>Client only</strong>. Most recent effective date wins. Leave Item/Shade blank for a catch-all rate.
      </div>

      {/* Filter */}
      <div style={{ marginBottom: 16 }}>
        <select className="form-select" value={filterClient} onChange={e => setFilterClient(e.target.value)} style={{ maxWidth: 260 }}>
          <option value="">All Clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><div className="loading-spinner" /></div>
      ) : rates.length === 0 ? (
        <div className="card">
          <div className="empty-state" style={{ padding: 60 }}>
            <Icon name="indian-rupee" size={40} color="var(--primary-light)" />
            <p className="empty-state-title">No rates configured</p>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>Add rates per client to enable auto-fill on dispatch and payslip</p>
          </div>
        </div>
      ) : grouped.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {grouped.map(({ client, rates: cRates }) => (
            <div key={client.id} className="card">
              <div className="card-body" style={{ borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--success)18', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name="archive" size={16} />
                </div>
                <h3 style={{ fontSize: 15 }}>{client.name}</h3>
                <span className="badge badge-info" style={{ marginLeft: 4 }}>{cRates.length} rate{cRates.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Item</th><th>Shade</th>
                      <th style={{ textAlign: 'right' }}>Rate (₹/kg)</th>
                      <th>Effective From</th><th>Notes</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cRates.map(r => (
                      <tr key={r.id}>
                        <td>{r.items?.name ?? <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>All items</span>}</td>
                        <td>{shadeName(r.shade_id) ?? <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>All shades</span>}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--success)', fontSize: 15 }}>₹{Number(r.rate_per_kg).toLocaleString('en-IN')}</td>
                        <td className="text-sm">{new Date(r.effective_date).toLocaleDateString('en-IN')}</td>
                        <td className="text-secondary text-sm">{r.notes || '—'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => openEdit(r)}>Edit</button>
                            <button className="btn btn-danger btn-sm" onClick={() => setDelId(r.id)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Client</th><th>Item</th><th>Shade</th><th style={{ textAlign: 'right' }}>Rate (₹/kg)</th><th>Effective From</th><th>Notes</th><th>Actions</th></tr></thead>
              <tbody>
                {rates.map(r => (
                  <tr key={r.id}>
                    <td><strong>{r.clients?.name}</strong></td>
                    <td>{r.items?.name ?? <span className="text-secondary" style={{ fontStyle: 'italic' }}>All items</span>}</td>
                    <td>{shadeName(r.shade_id) ?? <span className="text-secondary" style={{ fontStyle: 'italic' }}>All shades</span>}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--success)' }}>₹{Number(r.rate_per_kg).toLocaleString('en-IN')}</td>
                    <td className="text-sm">{new Date(r.effective_date).toLocaleDateString('en-IN')}</td>
                    <td className="text-secondary text-sm">{r.notes || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(r)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setDelId(r.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Rate' : 'Add Rate'}
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Rate'}</button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Client *</label>
            <select className="form-select" value={form.client_id} onChange={f('client_id')}>
              <option value="">Select client…</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Item <span className="text-secondary text-sm">(leave blank = all items)</span></label>
              <select className="form-select" value={form.item_id} onChange={f('item_id')}>
                <option value="">All items</option>
                {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Shade <span className="text-secondary text-sm">(leave blank = all shades)</span></label>
              <select className="form-select" value={form.shade_id} onChange={f('shade_id')}>
                <option value="">All shades</option>
                {shades.map(s => <option key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ''}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Rate (₹/kg) *</label>
              <input className="form-input" type="number" step="0.01" min="0" value={form.rate_per_kg} onChange={f('rate_per_kg')} placeholder="e.g. 45.00" inputMode="decimal" />
            </div>
            <div className="form-group">
              <label className="form-label">Effective From</label>
              <input className="form-input" type="date" value={form.effective_date} onChange={f('effective_date')} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <input className="form-input" value={form.notes} onChange={f('notes')} placeholder="Optional note" />
          </div>
          {form.client_id && form.rate_per_kg && (
            <div style={{ background: 'var(--success-light)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: 13, color: '#166534' }}>
              <strong>{clients.find(c => String(c.id) === form.client_id)?.name}</strong>
              {form.item_id ? ` · ${items.find(i => String(i.id) === form.item_id)?.name}` : ' · All items'}
              {form.shade_id ? ` · ${shades.find(s => String(s.id) === form.shade_id)?.name}` : ' · All shades'}
              {' → '}
              <strong>₹{Number(form.rate_per_kg).toLocaleString('en-IN')}/kg</strong>
              {' from '}{form.effective_date ? new Date(form.effective_date).toLocaleDateString('en-IN') : '—'}
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog open={!!delId} onClose={() => setDelId(null)} onConfirm={del} message="Delete this rate? This cannot be undone." confirmLabel="Delete" danger />
    </div>
  );
}
