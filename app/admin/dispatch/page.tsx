'use client';
import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader, Modal, SearchableDropdown, useToast, Icon, InvoiceModal } from '@/components/ui';

interface Dispatch {
  id: number; invoice_no: string; client_id: number;
  qty_kg: number; rate: number; amount: number;
  vehicle_no: string | null; lr_no: string | null; date: string;
  hsn_code: string | null; gst_rate: number | null; tax_inclusive: boolean;
  taxable_value: number | null; cgst_amount: number | null; sgst_amount: number | null;
  igst_amount: number | null; total_tax: number | null; grand_total: number | null;
  clients?: { name: string; state_code: string | null; dealer_type: string | null; phone?: string | null };
  orders?: { po_number: string | null };
  ready_stock?: { weight_kg: number; shade_id?: number | null };
}

const GST_RATES = [0, 5, 12, 18, 28];
const BLANK = {
  client_id: '', order_id: '', stock_id: '', qty_kg: '', rate: '',
  vehicle_no: '', lr_no: '', date: new Date().toISOString().split('T')[0],
  hsn_code: '', gst_rate: '5', tax_inclusive: false,
};

export default function DispatchPage() {
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [clients, setClients]       = useState<any[]>([]);
  const [orders, setOrders]         = useState<any[]>([]);
  const [stock, setStock]           = useState<any[]>([]);
  const [items, setItems]           = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState(false);
  const [form, setForm]             = useState(BLANK);
  const [saving, setSaving]         = useState(false);
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const toast = useToast();

  const load = () => {
    apiFetch('/dispatch')
      .then(setDispatches).catch(e => toast(e.message, 'error')).finally(() => setLoading(false));
  };

  useEffect(() => {
    Promise.all([apiFetch('/clients'), apiFetch('/orders'), apiFetch('/stock/ready?status=available'), apiFetch('/masters/items')])
      .then(([c, o, s, i]) => { setClients(c); setOrders(o); setStock(s); setItems(i); })
      .catch(e => toast(e.message, 'error'));
    load();
  }, []);

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const handleStockChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    const s  = stock.find((s: any) => String(s.id) === id);
    setForm(p => ({ ...p, stock_id: id, qty_kg: s ? String(s.weight_kg) : p.qty_kg }));
    // Try rate lookup when stock changes
    if (form.client_id && id) lookupRate(form.client_id, null, s?.shade_id);
  };

  const handleOrderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    const o  = orders.find((o: any) => String(o.id) === id);
    const cid = o ? String((o as any).client_id) : form.client_id;
    setForm(p => ({ ...p, order_id: id, rate: o?.rate ? String(o.rate) : p.rate, client_id: cid }));
    if (cid && o?.item_id) lookupRate(cid, o.item_id, null);
  };

  const handleClientChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setForm(p => ({ ...p, client_id: e.target.value }));
    if (e.target.value) lookupRate(e.target.value, null, null);
  };

  const lookupRate = useCallback(async (client_id: string, item_id: any, shade_id: any) => {
    if (!client_id) return;
    try {
      const params = new URLSearchParams({ client_id });
      if (item_id)  params.set('item_id',  String(item_id));
      if (shade_id) params.set('shade_id', String(shade_id));
      const res = await apiFetch(`/rates/lookup?${params}`);
      if (res.rate !== null) {
        setForm(p => ({ ...p, rate: String(res.rate) }));
        toast(`Rate auto-filled: ₹${res.rate}/kg`, 'success');
      }
    } catch {} // silent — rate lookup is optional
  }, []);

  // Tax calculation
  const qtyNum   = Number(form.qty_kg)  || 0;
  const rateNum  = Number(form.rate)    || 0;
  const gstRate  = Number(form.gst_rate) || 0;
  const baseAmt  = qtyNum * rateNum;
  const client   = clients.find(c => String(c.id) === form.client_id);
  const noGst    = !gstRate || client?.dealer_type === 'unregistered';
  const intraState = (client?.state_code || '24') === '24';

  let taxable = baseAmt, cgst = 0, sgst = 0, igst = 0, totalTax = 0, grandTotal = baseAmt;
  if (!noGst && baseAmt > 0) {
    if (form.tax_inclusive) {
      taxable = Math.round((baseAmt / (1 + gstRate / 100)) * 100) / 100;
    }
    totalTax = Math.round(taxable * gstRate / 100 * 100) / 100;
    if (intraState) { cgst = totalTax / 2; sgst = totalTax / 2; }
    else             { igst = totalTax; }
    grandTotal = form.tax_inclusive ? baseAmt : taxable + totalTax;
  }

  const save = async () => {
    if (!form.client_id || !form.qty_kg || !form.rate) { toast('Client, qty and rate required', 'error'); return; }
    setSaving(true);
    try {
      await apiFetch('/dispatch', { method: 'POST', body: JSON.stringify(form) });
      toast('Dispatch created + invoice generated');
      setModal(false); setForm(BLANK); load();
      apiFetch('/stock/ready?status=available').then(setStock).catch(() => {});
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const openInvoice = (d: Dispatch) => {
    setInvoiceData({
      invoice_no:     d.invoice_no,
      date:           d.date,
      client_name:    d.clients?.name ?? '—',
      client_gstin:   (d.clients as any)?.gstin,
      client_address: (d.clients as any)?.address,
      qty_kg:         d.qty_kg, rate: d.rate, amount: d.amount,
      hsn_code:       d.hsn_code, gst_rate: d.gst_rate, tax_inclusive: d.tax_inclusive,
      taxable_value:  d.taxable_value, cgst_amount: d.cgst_amount, sgst_amount: d.sgst_amount,
      igst_amount:    d.igst_amount, total_tax: d.total_tax, grand_total: d.grand_total,
      vehicle_no:     d.vehicle_no, lr_no: d.lr_no,
    });
  };

  const wa = async (d: Dispatch) => {
    const phone = d.clients?.phone;
    if (!phone) { toast('No phone on client record — add phone in Clients master', 'error'); return; }
    const msg = `Invoice ${d.invoice_no} for ₹${Number(d.grand_total ?? d.amount).toLocaleString('en-IN')} dispatched. Vehicle: ${d.vehicle_no || 'N/A'}. — OM Industries`;
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    // Log it
    try {
      await apiFetch('/communications', { method: 'POST', body: JSON.stringify({ client_id: (d as any).client_id, type: 'whatsapp', category: 'dispatch_complete', content: msg, amount: d.grand_total ?? d.amount, reference_no: d.invoice_no }) });
    } catch {} // log failure is non-critical
  };

  const totalGrandTotal = dispatches.reduce((s, d) => s + Number(d.grand_total ?? d.amount), 0);

  return (
    <div className="page-enter">
      <PageHeader title="Dispatch" subtitle={`${dispatches.length} dispatches · ₹${totalGrandTotal.toLocaleString('en-IN')} total`} icon="truck" iconColor="var(--warning)">
        <button className="btn btn-primary" onClick={() => { setForm(BLANK); setModal(true); }}>
          <Icon name="plus" size={16} /> New Dispatch
        </button>
      </PageHeader>

      <div className="card">
        {loading ? (
          <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><div className="loading-spinner" /></div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice</th><th>Date</th><th>Client</th><th className="hide-mobile">Order</th>
                  <th className="hide-mobile">Qty (kg)</th><th className="hide-mobile">Rate</th>
                  <th>Taxable</th><th className="hide-mobile">Tax</th><th>Total (₹)</th>
                  <th className="hide-mobile">Vehicle</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {dispatches.map(d => (
                  <tr key={d.id}>
                    <td className="font-mono text-sm" style={{ fontWeight: 700, color: 'var(--accent)' }}>{d.invoice_no}</td>
                    <td className="text-sm">{new Date(d.date).toLocaleDateString('en-IN')}</td>
                    <td><strong>{d.clients?.name}</strong></td>
                    <td className="text-secondary text-sm hide-mobile">{d.orders?.po_number || '—'}</td>
                    <td className="hide-mobile" style={{ fontFamily: 'var(--font-heading)' }}>{d.qty_kg} kg</td>
                    <td className="hide-mobile" style={{ fontFamily: 'var(--font-heading)' }}>₹{d.rate}</td>
                    <td style={{ fontFamily: 'var(--font-heading)' }}>
                      ₹{Number(d.taxable_value ?? d.amount).toLocaleString('en-IN')}
                    </td>
                    <td className="text-sm hide-mobile">
                      {d.total_tax ? (
                        <span style={{ color: 'var(--info)' }}>
                          {d.gst_rate}%{' '}
                          {d.cgst_amount ? `(C+S)` : `(IGST)`}
                          {' '}₹{Number(d.total_tax).toLocaleString('en-IN')}
                        </span>
                      ) : <span className="text-secondary">—</span>}
                    </td>
                    <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--success)' }}>
                      ₹{Number(d.grand_total ?? d.amount).toLocaleString('en-IN')}
                    </td>
                    <td className="text-secondary text-sm hide-mobile">{d.vehicle_no || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" title="Print Invoice" onClick={() => openInvoice(d)}>
                          <Icon name="file-text" size={16} />
                        </button>
                        <button className="btn btn-ghost btn-sm" title="Send WhatsApp" onClick={() => wa(d)} style={{ color: '#25D366' }}>
                          <Icon name="message-circle" size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {dispatches.length === 0 && (
                  <tr><td colSpan={11}><div className="empty-state"><Icon name="truck" size={40} color="var(--primary-light)" /><p className="empty-state-title">No dispatches yet</p></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="New Dispatch"
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Creating…' : 'Create Dispatch'}</button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Client *</label>
              <SearchableDropdown
                options={clients.map(c => ({ label: `${c.name}${c.dealer_type === 'unregistered' ? ' (Unregd)' : ''}`, value: c.id }))}
                value={form.client_id}
                onChange={v => handleClientChange({ target: { value: String(v) } } as any)}
                placeholder="Search client…" />
            </div>
            <div className="form-group">
              <label className="form-label">Date</label>
              <input className="form-input" type="date" value={form.date} onChange={f('date')} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Order Reference</label>
              <select className="form-select" value={form.order_id} onChange={handleOrderChange}>
                <option value="">Select order…</option>
                {orders.filter(o => !form.client_id || String((o as any).client_id) === form.client_id).map(o => (
                  <option key={o.id} value={o.id}>{o.po_number || `ORD-${String(o.id).padStart(4,'0')}`} — {o.clients?.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Stock Lot (Available)</label>
              <select className="form-select" value={form.stock_id} onChange={handleStockChange}>
                <option value="">Select stock…</option>
                {stock.map((s: any) => (
                  <option key={s.id} value={s.id}>Stock #{s.id} — {s.weight_kg} kg</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Qty (kg) *</label>
              <input className="form-input" type="number" step="0.1" min="0" value={form.qty_kg} onChange={f('qty_kg')} inputMode="decimal" />
            </div>
            <div className="form-group">
              <label className="form-label">Rate (₹/kg) *</label>
              <input className="form-input" type="number" step="0.01" min="0" value={form.rate} onChange={f('rate')} inputMode="decimal" />
            </div>
          </div>

          {/* GST Section */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>GST</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">HSN Code</label>
                <input className="form-input" value={form.hsn_code} onChange={f('hsn_code')} placeholder="e.g. 5106" style={{ fontFamily: 'var(--font-heading)' }} />
              </div>
              <div className="form-group">
                <label className="form-label">GST Rate</label>
                <select className="form-select" value={form.gst_rate} onChange={f('gst_rate')}>
                  {GST_RATES.map(r => <option key={r} value={r}>{r === 0 ? 'Nil (0%)' : `${r}%`}</option>)}
                </select>
              </div>
            </div>
            {Number(form.gst_rate) > 0 && client?.dealer_type !== 'unregistered' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginTop: 4 }}>
                <input type="checkbox" checked={form.tax_inclusive} onChange={e => setForm(p => ({ ...p, tax_inclusive: e.target.checked }))} />
                Rate is tax-inclusive (back-calculate taxable amount)
              </label>
            )}
          </div>

          {/* Tax breakdown */}
          {baseAmt > 0 && (
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-secondary">Taxable Value</span>
                <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>₹{taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              {!noGst && (
                <>
                  {cgst > 0 && <><div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="text-secondary">CGST ({gstRate / 2}%)</span><span style={{ color: 'var(--info)' }}>₹{cgst.toFixed(2)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="text-secondary">SGST ({gstRate / 2}%)</span><span style={{ color: 'var(--info)' }}>₹{sgst.toFixed(2)}</span></div></>}
                  {igst > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="text-secondary">IGST ({gstRate}%)</span><span style={{ color: 'var(--info)' }}>₹{igst.toFixed(2)}</span></div>}
                </>
              )}
              {noGst && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>No GST — {client?.dealer_type === 'unregistered' ? 'unregistered dealer' : 'nil rate'}</div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 6, fontWeight: 700, fontSize: 15 }}>
                <span>Grand Total</span>
                <span style={{ fontFamily: 'var(--font-heading)', color: 'var(--success)' }}>₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          )}

          <div className="form-row">
            <div className="form-group"><label className="form-label">Vehicle No.</label><input className="form-input" value={form.vehicle_no} onChange={f('vehicle_no')} placeholder="e.g. GJ-05-AB-1234" /></div>
            <div className="form-group"><label className="form-label">LR / Bilty No.</label><input className="form-input" value={form.lr_no} onChange={f('lr_no')} placeholder="e.g. LR-2026-001" /></div>
          </div>
        </div>
      </Modal>
      <InvoiceModal open={!!invoiceData} onClose={() => setInvoiceData(null)} data={invoiceData} />
    </div>
  );
}
