'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader, Modal, ConfirmDialog, SearchableDropdown, useToast, Icon } from '@/components/ui';

interface Order {
  id: number; po_number: string | null; qty_kg: number | null; rate: number | null;
  delivery_date: string | null; priority: string; status: string; created_at: string;
  clients?: { name: string }; shade_id?: number | null; items?: { name: string; unit: string };
}

const BLANK = { client_id: '', quality_id: '', department: 'general', po_number: '', item_id: '', shade_id: '', qty_kg: '', rate: '', delivery_date: '', priority: 'medium' };
const DEPARTMENTS = [
  { v: 'general', label: 'General / All' },
  { v: 'hanks',   label: 'Hanks · Unit 2' },
  { v: 'dyeing',  label: 'Dyeing · Unit 1' },
  { v: 'coning',  label: 'Coning' },
];
const PRIORITIES = ['low','medium','high','urgent'];
const STATUSES   = ['pending','processing','completed','cancelled'];
const PRI_COLORS: Record<string,string> = { low: 'var(--text-secondary)', medium: 'var(--info)', high: 'var(--warning)', urgent: 'var(--danger)' };
const PRI_BG:     Record<string,string> = { low: '#F1F5F9', medium: '#DBEAFE', high: '#FEF9C3', urgent: '#FEE2E2' };
const STA_COLORS: Record<string,string> = { pending: 'var(--warning)', processing: 'var(--info)', completed: 'var(--success)', cancelled: 'var(--text-secondary)' };

export default function OrdersPage() {
  const [orders, setOrders]     = useState<Order[]>([]);
  const [clients, setClients]   = useState<any[]>([]);
  const [items, setItems]       = useState<any[]>([]);
  const [shades, setShades]     = useState<any[]>([]);
  const [qualities, setQualities] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(false);
  const [editing, setEditing]   = useState<Order | null>(null);
  const [form, setForm]         = useState(BLANK);
  const [delId, setDelId]       = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [saving, setSaving]     = useState(false);
  const toast = useToast();

  const load = () => {
    setLoading(true);
    apiFetch(`/orders${statusFilter ? `?status=${statusFilter}` : ''}`)
      .then(setOrders).catch(e => toast(e.message, 'error')).finally(() => setLoading(false));
  };

  useEffect(() => {
    Promise.all([apiFetch('/clients'), apiFetch('/masters/items'), apiFetch('/masters/shades'), apiFetch('/qualities')])
      .then(([c, i, s, q]) => { setClients(c); setItems(i); setShades(s); setQualities(q); })
      .catch(e => toast(e.message, 'error'));
    load();
  }, []);

  useEffect(() => { load(); }, [statusFilter]);

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    if (!form.client_id) { toast('Client required', 'error'); return; }
    setSaving(true);
    try {
      if (editing) await apiFetch(`/orders/${editing.id}`, { method: 'PUT', body: JSON.stringify(form) });
      else         await apiFetch('/orders', { method: 'POST', body: JSON.stringify(form) });
      toast(editing ? 'Order updated' : 'Order created');
      setModal(false); setEditing(null); setForm(BLANK); load();
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const del = async () => {
    if (!delId) return;
    try { await apiFetch(`/orders/${delId}`, { method: 'DELETE' }); toast('Order deleted'); load(); }
    catch (e: any) { toast(e.message, 'error'); }
    setDelId(null);
  };

  const changeStatus = async (id: number, status: string) => {
    try { await apiFetch(`/orders/${id}`, { method: 'PUT', body: JSON.stringify({ status }) }); load(); }
    catch (e: any) { toast(e.message, 'error'); }
  };


  return (
    <div className="page-enter">
      <PageHeader title="Orders" subtitle={`${orders.length} orders`}>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setForm(BLANK); setModal(true); }}>
          <Icon name="plus" size={16} /> New Order
        </button>
      </PageHeader>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {STATUSES.map(s => (
          <button key={s} onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
            className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}
            style={{ gap: 6, textTransform: 'capitalize' }}>
            {s} <span style={{ background: statusFilter === s ? 'rgba(255,255,255,0.3)' : STA_COLORS[s] + '20', color: statusFilter === s ? '#fff' : STA_COLORS[s], padding: '1px 7px', borderRadius: 9999, fontSize: 11, fontWeight: 700 }}>
              {orders.filter(o => o.status === s).length}
            </span>
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><div className="loading-spinner" /></div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>PO No.</th><th>Client</th><th>Unit</th><th className="hide-mobile">Item</th><th className="hide-mobile">Shade</th><th>Qty (kg)</th><th className="hide-mobile">Rate (₹)</th><th className="hide-mobile">Delivery</th><th>Stages</th><th>Priority</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id}>
                    <td className="font-mono text-sm">{o.po_number || `ORD-${String(o.id).padStart(4, '0')}`}</td>
                    <td><strong>{o.clients?.name}</strong></td>
                    <td className="text-sm" style={{ textTransform: 'capitalize' }}>{((o as any).department || 'general').replace('_', ' ')}</td>
                    <td className="text-secondary text-sm hide-mobile">{o.items?.name || '—'}</td>
                    <td className="text-secondary text-sm hide-mobile">{shades.find((s: any) => s.id === o.shade_id)?.name || '—'}</td>
                    <td style={{ fontFamily: 'var(--font-heading)' }}>{o.qty_kg ? `${o.qty_kg} kg` : '—'}</td>
                    <td style={{ fontFamily: 'var(--font-heading)' }} className="hide-mobile">{o.rate ? `₹${o.rate}` : '—'}</td>
                    <td className="text-sm hide-mobile">{o.delivery_date ? new Date(o.delivery_date).toLocaleDateString('en-IN') : '—'}</td>
                    <td style={{ fontSize: 11, whiteSpace: 'nowrap', fontFamily: 'var(--font-heading)' }}>
                      {([['H','received_kg'],['D','dyed_kg'],['C','coned_kg']] as const).map(([lbl, key]) => {
                        const v = Number((o as any)[key] ?? 0);
                        const q = Number(o.qty_kg ?? 0);
                        const full = q > 0 && v >= q;
                        return <span key={lbl} title={key} style={{ marginRight: 7, color: full ? 'var(--success)' : v > 0 ? 'var(--warning)' : 'var(--border-dark)', fontWeight: 700 }}>{lbl}:{v}</span>;
                      })}
                    </td>
                    <td>
                      <span style={{ padding: '3px 10px', borderRadius: 9999, fontSize: 12, fontWeight: 700, background: PRI_BG[o.priority], color: PRI_COLORS[o.priority], textTransform: 'capitalize', ...(o.priority === 'urgent' ? { animation: 'pulse-urgent 1.5s infinite' } : {}) }}>
                        {o.priority}
                      </span>
                    </td>
                    <td>
                      <select className="form-select" value={o.status} onChange={e => changeStatus(o.id, e.target.value)}
                        style={{ minHeight: 32, fontSize: 12, padding: '4px 8px', color: STA_COLORS[o.status], fontWeight: 600 }}>
                        {STATUSES.map(s => <option key={s} value={s} style={{ textTransform: 'capitalize', color: STA_COLORS[s] }}>{s}</option>)}
                      </select>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(o); setForm({ client_id: String((o as any).client_id || ''), quality_id: String((o as any).quality_id || ''), department: (o as any).department || 'general', po_number: o.po_number || '', item_id: String((o as any).item_id || ''), shade_id: String((o as any).shade_id || ''), qty_kg: String(o.qty_kg || ''), rate: String(o.rate || ''), delivery_date: o.delivery_date || '', priority: o.priority }); setModal(true); }}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setDelId(o.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr><td colSpan={12}><div className="empty-state"><Icon name="clipboard-list" size={40} color="var(--primary-light)" /><p className="empty-state-title">No orders yet</p></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Order' : 'New Order'}
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Order'}</button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Client *</label>
              <SearchableDropdown options={clients.map(c => ({ label: c.name, value: c.id }))} value={form.client_id} onChange={v => setForm(p => ({ ...p, client_id: String(v) }))} placeholder="Search client…" />
            </div>
            <div className="form-group">
              <label className="form-label">Quality</label>
              <SearchableDropdown options={qualities.map(q => ({ label: q.name, value: q.id }))} value={form.quality_id} onChange={v => setForm(p => ({ ...p, quality_id: String(v) }))} placeholder="Search quality…" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">PO Number</label><input className="form-input" value={form.po_number} onChange={f('po_number')} placeholder="e.g. PO-2026-001" /></div>
            <div className="form-group">
              <label className="form-label">Industry / Unit</label>
              <select className="form-select" value={form.department} onChange={f('department')}>
                {DEPARTMENTS.map(d => <option key={d.v} value={d.v}>{d.label}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Item</label>
              <select className="form-select" value={form.item_id} onChange={f('item_id')}>
                <option value="">Select item…</option>
                {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Shade</label>
              <select className="form-select" value={form.shade_id} onChange={f('shade_id')}>
                <option value="">Select shade…</option>
                {shades.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Qty (kg)</label><input className="form-input" type="number" step="0.1" min="0" value={form.qty_kg} onChange={f('qty_kg')} placeholder="0.0" /></div>
            <div className="form-group"><label className="form-label">Rate (₹/kg)</label><input className="form-input" type="number" step="0.01" min="0" value={form.rate} onChange={f('rate')} placeholder="0.00" /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Delivery Date</label><input className="form-input" type="date" value={form.delivery_date} onChange={f('delivery_date')} /></div>
            <div className="form-group">
              <label className="form-label">Priority</label>
              <select className="form-select" value={form.priority} onChange={f('priority')}>
                {PRIORITIES.map(p => <option key={p} value={p} style={{ textTransform: 'capitalize' }}>{p}</option>)}
              </select>
            </div>
          </div>
          {form.qty_kg && form.rate && (
            <div style={{ background: 'var(--success-light)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 500, fontSize: 14 }}>Order Value</span>
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--success)' }}>₹{(Number(form.qty_kg) * Number(form.rate)).toLocaleString('en-IN')}</span>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog open={!!delId} onClose={() => setDelId(null)} onConfirm={del} message="Delete this order? This cannot be undone." confirmLabel="Delete" danger />
    </div>
  );
}
