'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader, Modal, SearchableDropdown, useToast, Icon } from '@/components/ui';

interface Line {
  ready_stock_id: number | null; item_name: string; color: string;
  cones: string; gross_kg: string; tare_kg: string; rate: string;
}

export default function ChallansPage() {
  const [challans, setChallans] = useState<any[]>([]);
  const [clients, setClients]   = useState<any[]>([]);
  const [qualities, setQualities] = useState<any[]>([]);
  const [shades, setShades]     = useState<any[]>([]);
  const [readyStock, setReady]  = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(false);
  const [clientId, setClientId] = useState<any>('');
  const [date, setDate]         = useState(new Date().toISOString().split('T')[0]);
  const [lines, setLines]       = useState<Line[]>([]);
  const [saving, setSaving]     = useState(false);
  const toast = useToast();

  const load = () => {
    setLoading(true);
    apiFetch('/challans').then(setChallans).catch(e => toast(e.message, 'error')).finally(() => setLoading(false));
  };

  useEffect(() => {
    Promise.all([apiFetch('/clients'), apiFetch('/qualities'), apiFetch('/masters/shades'), apiFetch('/stock/ready?status=available')])
      .then(([c, q, s, r]) => { setClients(c); setQualities(q); setShades(s); setReady(r); })
      .catch(e => toast(e.message, 'error'));
    load();
  }, []);

  const shadeName = (id: number | null) => shades.find(s => s.id === id)?.name ?? '';
  const qualityName = (id: number | null) => qualities.find(q => q.id === id)?.name ?? '';

  const availableForClient = readyStock.filter(r => String(r.client_id) === String(clientId));

  const openNew = () => { setClientId(''); setDate(new Date().toISOString().split('T')[0]); setLines([]); setModal(true); };

  const toggleRow = (r: any) => {
    setLines(prev => {
      const exists = prev.find(l => l.ready_stock_id === r.id);
      if (exists) return prev.filter(l => l.ready_stock_id !== r.id);
      return [...prev, {
        ready_stock_id: r.id,
        item_name: qualityName(r.quality_id),
        color: shadeName(r.shade_id),
        cones: r.cones != null ? String(r.cones) : '',
        gross_kg: r.weight_kg != null ? String(r.weight_kg) : '',
        tare_kg: '',
        rate: '',
      }];
    });
  };

  const setLine = (i: number, k: keyof Line, v: string) =>
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [k]: v } : l));

  const net = (l: Line) => Math.max(Number(l.gross_kg || 0) - Number(l.tare_kg || 0), 0);
  const amount = (l: Line) => Math.round(net(l) * Number(l.rate || 0) * 100) / 100;
  const totalAmt = lines.reduce((s, l) => s + amount(l), 0);
  const totalNet = lines.reduce((s, l) => s + net(l), 0);

  const save = async () => {
    if (!clientId) { toast('Select client', 'error'); return; }
    if (lines.length === 0) { toast('Select at least one packed item', 'error'); return; }
    setSaving(true);
    try {
      const res = await apiFetch('/challans', { method: 'POST', body: JSON.stringify({
        client_id: clientId, date,
        items: lines.map(l => ({ ...l, net_kg: net(l) })),
      }) });
      toast('Challan created ✓'); setModal(false); load();
      window.open(`/admin/challans/${res.id}/print`, '_blank');
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="page-enter">
      <PageHeader title="Delivery Challans" subtitle={`${challans.length} issued`} icon="file-text" iconColor="var(--accent)">
        <button className="btn btn-primary" onClick={openNew}><Icon name="plus" size={16} /> New Challan</button>
      </PageHeader>

      <div className="card">
        {loading ? (
          <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><div className="loading-spinner" /></div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Challan No</th><th>Client</th><th>Date</th><th>Net Wt</th><th>Grand Total</th><th>Actions</th></tr></thead>
              <tbody>
                {challans.map(c => (
                  <tr key={c.id}>
                    <td className="font-mono text-sm" style={{ fontWeight: 700, color: 'var(--accent)' }}>{c.challan_no}</td>
                    <td><strong>{c.clients?.name ?? '—'}</strong></td>
                    <td className="text-sm">{new Date(c.date).toLocaleDateString('en-IN')}</td>
                    <td style={{ fontFamily: 'var(--font-heading)' }}>{Number(c.total_net_kg).toFixed(2)} kg</td>
                    <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>₹{Number(c.grand_total).toLocaleString('en-IN')}</td>
                    <td>
                      <a className="btn btn-secondary btn-sm" href={`/admin/challans/${c.id}/print`} target="_blank" rel="noreferrer" style={{ gap: 4 }}>
                        <Icon name="file-text" size={13} /> Print
                      </a>
                    </td>
                  </tr>
                ))}
                {challans.length === 0 && (
                  <tr><td colSpan={6}><div className="empty-state" style={{ padding: 32 }}><Icon name="file-text" size={40} color="var(--primary-light)" /><p className="empty-state-title">No challans yet</p></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="New Delivery Challan"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Create & Print'}</button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Client / Party *</label>
              <SearchableDropdown options={clients.map(c => ({ label: c.name, value: c.id }))} value={clientId} onChange={v => { setClientId(v); setLines([]); }} placeholder="Search party…" />
            </div>
            <div className="form-group"><label className="form-label">Date</label><input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          </div>

          {clientId && (
            <div>
              <div className="form-label" style={{ marginBottom: 8 }}>Available packed stock — tick to add</div>
              {availableForClient.length === 0 ? (
                <div className="text-secondary text-sm" style={{ padding: '8px 0' }}>No packed stock for this client.</div>
              ) : (
                <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  {availableForClient.map(r => {
                    const on = lines.some(l => l.ready_stock_id === r.id);
                    return (
                      <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: on ? 'var(--accent-light)' : 'transparent' }}>
                        <input type="checkbox" checked={on} onChange={() => toggleRow(r)} style={{ width: 18, height: 18 }} />
                        <span style={{ flex: 1, fontSize: 14 }}>{r.batch_no || `#${r.id}`} · {shadeName(r.shade_id) || '—'} · {qualityName(r.quality_id) || ''}</span>
                        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>{Number(r.weight_kg).toFixed(1)} kg</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {lines.length > 0 && (
            <div className="table-wrap" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
              <table className="data-table" style={{ fontSize: 13 }}>
                <thead><tr><th>Item</th><th>Color</th><th>Cone</th><th>Gr</th><th>Tr</th><th>Nt</th><th>Rate</th><th>Amt</th></tr></thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i}>
                      <td><input className="form-input" style={{ minHeight: 34, minWidth: 90 }} value={l.item_name} onChange={e => setLine(i, 'item_name', e.target.value)} /></td>
                      <td><input className="form-input" style={{ minHeight: 34, minWidth: 80 }} value={l.color} onChange={e => setLine(i, 'color', e.target.value)} /></td>
                      <td><input className="form-input" type="number" style={{ minHeight: 34, width: 56 }} value={l.cones} onChange={e => setLine(i, 'cones', e.target.value)} /></td>
                      <td><input className="form-input" type="number" step="0.01" style={{ minHeight: 34, width: 64 }} value={l.gross_kg} onChange={e => setLine(i, 'gross_kg', e.target.value)} /></td>
                      <td><input className="form-input" type="number" step="0.01" style={{ minHeight: 34, width: 64 }} value={l.tare_kg} onChange={e => setLine(i, 'tare_kg', e.target.value)} /></td>
                      <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>{net(l).toFixed(2)}</td>
                      <td><input className="form-input" type="number" step="0.01" style={{ minHeight: 34, width: 64 }} value={l.rate} onChange={e => setLine(i, 'rate', e.target.value)} /></td>
                      <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>₹{amount(l).toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border-dark)', fontWeight: 700 }}>
                    <td colSpan={5} style={{ textAlign: 'right' }}>Total</td>
                    <td style={{ fontFamily: 'var(--font-heading)' }}>{totalNet.toFixed(2)}</td>
                    <td></td>
                    <td style={{ fontFamily: 'var(--font-heading)' }}>₹{totalAmt.toFixed(0)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
