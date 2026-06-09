'use client';
import { useEffect, useState, useRef } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader, Modal, SearchableDropdown, useToast, Icon } from '@/components/ui';

interface StockEntry { id: number; date: string; challan_no: string | null; weight_kg: number; bundles: number | null; remaining_weight_kg: number; clients?: { name: string }; qualities?: { name: string }; }
const BLANK = { date: new Date().toISOString().split('T')[0], challan_no: '', client_id: '', quality_id: '', weight_kg: '', bundles: '' };

export default function StockInwardPage() {
  const [entries, setEntries]     = useState<StockEntry[]>([]);
  const [clients, setClients]     = useState<any[]>([]);
  const [qualities, setQualities] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(false);
  const [form, setForm]           = useState(BLANK);
  const [saving, setSaving]       = useState(false);

  // Bill scanner state
  const [scanModal, setScanModal]   = useState(false);
  const [scanning, setScanning]     = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanPreview, setScanPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  // Bill scanner handlers
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Preview
    const reader = new FileReader();
    reader.onload = ev => setScanPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    // Scan
    setScanning(true); setScanResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const token = typeof window !== 'undefined' ? localStorage.getItem('erp_token') : null;
      const res = await fetch('/api/bills/scan', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Scan failed');
      setScanResult(data.data);
      toast('Bill scanned successfully');
    } catch (err: any) { toast(err.message, 'error'); }
    finally { setScanning(false); }
  };

  const applyScannedData = () => {
    if (!scanResult) return;
    // Try to match supplier to a client
    const matchedClient = clients.find(c =>
      c.name.toLowerCase().includes((scanResult.supplier_name || '').toLowerCase().slice(0, 5)) ||
      (scanResult.supplier_name || '').toLowerCase().includes(c.name.toLowerCase().slice(0, 5))
    );
    // Use first item quantity as weight if unit is weight-based (kg/bags)
    const firstItem = scanResult.items?.[0];
    const isWeightUnit = firstItem?.unit && ['kg', 'kgs', 'kilogram', 'bags', 'bag', 'bale', 'bales'].includes((firstItem.unit || '').toLowerCase());
    const weightKg = firstItem?.quantity && isWeightUnit ? String(firstItem.quantity) : '';
    setForm({
      date:       scanResult.invoice_date || BLANK.date,
      challan_no: scanResult.invoice_no   || '',
      client_id:  matchedClient ? String(matchedClient.id) : '',
      quality_id: '',
      weight_kg:  weightKg,
      bundles:    '',
    });
    setScanModal(false);
    setModal(true);
    if (!matchedClient) toast('Supplier not matched — please select client manually', 'error');
  };

  const totalKg = entries.reduce((s, e) => s + Number(e.remaining_weight_kg), 0);

  return (
    <div className="page-enter">
      <PageHeader title="Stock Inward" subtitle={`${entries.length} entries · ${totalKg.toFixed(1)} kg remaining`} icon="package-plus" iconColor="var(--success)">
        <button className="btn btn-secondary" onClick={() => { setScanModal(true); setScanResult(null); setScanPreview(null); }} style={{ gap: 8 }}>
          <Icon name="zap" size={16} /> Scan Bill
        </button>
        <button className="btn btn-primary" onClick={() => { setForm(BLANK); setModal(true); }}>
          <Icon name="plus" size={16} /> New Entry
        </button>
      </PageHeader>

      <div className="card">
        {loading ? (
          <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><div className="loading-spinner" /></div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Challan No.</th><th>Client</th><th>Quality</th><th>Weight (kg)</th><th className="hide-mobile">Bundles</th><th>Remaining (kg)</th></tr></thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id}>
                    <td className="text-sm">{new Date(e.date).toLocaleDateString('en-IN')}</td>
                    <td className="font-mono text-sm">{e.challan_no || '—'}</td>
                    <td><strong>{e.clients?.name}</strong></td>
                    <td>{e.qualities?.name}</td>
                    <td style={{ fontFamily: 'var(--font-heading)' }}>{e.weight_kg}</td>
                    <td className="hide-mobile">{e.bundles ?? '—'}</td>
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

      {/* Manual entry modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="New Stock Inward Entry"
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Entry'}</button></>}>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Date</label><input className="form-input" type="date" value={form.date} onChange={f('date')} /></div>
          <div className="form-group"><label className="form-label">Challan No.</label><input className="form-input" value={form.challan_no} onChange={f('challan_no')} placeholder="Optional" /></div>
          <div className="form-group">
            <label className="form-label">Client *</label>
            <SearchableDropdown options={clients.map(c => ({ label: c.name, value: c.id }))} value={form.client_id} onChange={v => setForm(p => ({ ...p, client_id: String(v) }))} placeholder="Search client…" />
          </div>
          <div className="form-group">
            <label className="form-label">Quality *</label>
            <SearchableDropdown options={qualities.map(q => ({ label: q.name, value: q.id }))} value={form.quality_id} onChange={v => setForm(p => ({ ...p, quality_id: String(v) }))} placeholder="Search quality…" />
          </div>
          <div className="form-group"><label className="form-label">Weight (kg) *</label><input className="form-input" type="number" step="0.01" min="0" value={form.weight_kg} onChange={f('weight_kg')} placeholder="0.00" inputMode="decimal" /></div>
          <div className="form-group"><label className="form-label">Bundles / Bags</label><input className="form-input" type="number" min="0" value={form.bundles} onChange={f('bundles')} placeholder="Optional" /></div>
        </div>
      </Modal>

      {/* Bill Scanner modal */}
      <Modal open={scanModal} onClose={() => setScanModal(false)} title="Scan Purchase Bill / Challan"
        footer={
          scanResult
            ? <><button className="btn btn-secondary" onClick={() => { setScanResult(null); setScanPreview(null); }}>Re-scan</button><button className="btn btn-primary" onClick={applyScannedData}>Use This Data</button></>
            : <button className="btn btn-secondary" onClick={() => setScanModal(false)}>Cancel</button>
        }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Upload zone */}
          {!scanResult && (
            <div
              onClick={() => fileRef.current?.click()}
              style={{ border: '2px dashed var(--border)', borderRadius: 'var(--radius-md)', padding: '28px 20px', textAlign: 'center', cursor: 'pointer', transition: 'all 150ms', background: scanPreview ? 'var(--hover-bg)' : 'transparent' }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && fileRef.current) { const dt = new DataTransfer(); dt.items.add(f); fileRef.current.files = dt.files; handleFileSelect({ target: fileRef.current } as any); } }}
            >
              {scanning ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <div className="loading-spinner" />
                  <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>AI reading bill…</span>
                </div>
              ) : scanPreview ? (
                <img src={scanPreview} alt="Bill preview" style={{ maxHeight: 200, maxWidth: '100%', borderRadius: 8, objectFit: 'contain' }} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <Icon name="zap" size={36} color="var(--accent)" />
                  <div style={{ fontWeight: 600, fontSize: 15 }}>Take photo or upload bill</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>JPG, PNG, WEBP — challan, invoice, or delivery note</div>
                </div>
              )}
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFileSelect} />

          {/* Extracted results */}
          {scanResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ background: 'var(--success-light)', border: '1px solid #86EFAC', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 13, color: '#166534', display: 'flex', gap: 8, alignItems: 'center' }}>
                <Icon name="check-circle" size={16} color="var(--success)" /> Bill scanned. Verify details and click "Use This Data".
              </div>
              {[
                ['Supplier', scanResult.supplier_name],
                ['GSTIN', scanResult.supplier_gstin],
                ['Invoice/Challan No.', scanResult.invoice_no],
                ['Date', scanResult.invoice_date],
                ['Total Amount', scanResult.total_amount ? `₹${scanResult.total_amount}` : null],
                ['Vehicle No.', scanResult.vehicle_no],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                  <span style={{ fontWeight: 600 }}>{value}</span>
                </div>
              ))}
              {scanResult.items?.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Items</div>
                  {scanResult.items.map((item: any, i: number) => (
                    <div key={i} style={{ fontSize: 13, padding: '5px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{item.description}</span>
                      <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>{item.quantity} {item.unit} @ ₹{item.rate}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '8px 12px', background: 'var(--hover-bg)', borderRadius: 'var(--radius-sm)' }}>
            Powered by Google Gemini AI. Set <code>GOOGLE_GENAI_API_KEY</code> in <code>.env.local</code> to enable.
          </div>
        </div>
      </Modal>
    </div>
  );
}
