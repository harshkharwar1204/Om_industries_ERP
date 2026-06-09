'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader, Modal, useToast, Icon } from '@/components/ui';

interface StockItem {
  id: number; cones: number | null; weight_kg: number; grade: string; location: string | null; status: string;
  stock_inward?: { challan_no: string | null; clients?: { name: string } };
  shade_id?: number | null;
  created_at: string;
}

const BLANK = { lot_id: '', shade_id: '', coning_id: '', cones: '', weight_kg: '', grade: 'standard', location: '' };
const GRADES = ['a_grade', 'standard', 'b_grade'];
const GRADE_LABELS: Record<string, string> = { a_grade: 'A Grade', standard: 'Standard', b_grade: 'B Grade' };
const GRADE_COLORS: Record<string, string> = { a_grade: 'var(--success)', standard: 'var(--info)', b_grade: 'var(--warning)' };
const STATUS_COLORS: Record<string, string> = { available: 'var(--success)', reserved: 'var(--warning)', dispatched: 'var(--text-secondary)' };

export default function ReadyStockPage() {
  const [stock, setStock]         = useState<StockItem[]>([]);
  const [lots, setLots]           = useState<any[]>([]);
  const [shades, setShades]       = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(false);
  const [form, setForm]           = useState(BLANK);
  const [saving, setSaving]       = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch]       = useState('');
  const toast = useToast();

  const load = () => {
    apiFetch(`/stock/ready${statusFilter ? `?status=${statusFilter}` : ''}`)
      .then(setStock).catch(e => toast(e.message, 'error')).finally(() => setLoading(false));
  };

  useEffect(() => {
    Promise.all([apiFetch('/stock/inward'), apiFetch('/masters/shades')])
      .then(([l, s]) => { setLots(l); setShades(s); })
      .catch(e => toast(e.message, 'error'));
    load();
  }, []);

  useEffect(() => { load(); }, [statusFilter]);

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    if (!form.weight_kg) { toast('Weight required', 'error'); return; }
    setSaving(true);
    try {
      await apiFetch('/stock/ready', { method: 'POST', body: JSON.stringify(form) });
      toast('Stock entry added');
      setModal(false); setForm(BLANK); load();
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const filtered = stock.filter(s =>
    !search ||
    (s.stock_inward?.clients?.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (shades.find(sh => sh.id === s.shade_id)?.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.location || '').toLowerCase().includes(search.toLowerCase())
  );

  const available = stock.filter(s => s.status === 'available');
  const totalAvailKg    = available.reduce((sum, s) => sum + Number(s.weight_kg), 0);
  const totalAvailCones = available.reduce((sum, s) => sum + Number(s.cones || 0), 0);

  return (
    <div className="page-enter">
      <PageHeader title="Ready Stock" subtitle="Finished goods warehouse" icon="warehouse" iconColor="var(--accent)">
        <button className="btn btn-primary" onClick={() => { setForm(BLANK); setModal(true); }}>
          <Icon name="plus" size={16} /> Add Entry
        </button>
      </PageHeader>

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: 'var(--success)18', color: 'var(--success)' }}><Icon name="package" size={24} /></div>
          <div className="stat-content"><div className="stat-label">Available (kg)</div><div className="stat-value">{totalAvailKg.toFixed(1)}</div></div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: '#DBEAFE', color: 'var(--info)' }}><Icon name="box" size={24} /></div>
          <div className="stat-content"><div className="stat-label">Available Cones</div><div className="stat-value">{totalAvailCones.toLocaleString('en-IN')}</div></div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: 'var(--warning)18', color: 'var(--warning)' }}><Icon name="clock" size={24} /></div>
          <div className="stat-content"><div className="stat-label">Reserved</div><div className="stat-value">{stock.filter(s => s.status === 'reserved').length}</div></div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: '#F1F5F9', color: 'var(--primary)' }}><Icon name="truck" size={24} /></div>
          <div className="stat-content"><div className="stat-label">Dispatched</div><div className="stat-value">{stock.filter(s => s.status === 'dispatched').length}</div></div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', flex: 1, maxWidth: 280 }}>
          <Icon name="search" size={16} color="var(--text-secondary)" />
          <input style={{ border: 'none', background: 'none', outline: 'none', fontSize: 14, width: '100%' }} placeholder="Search party, shade, location…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ maxWidth: 160, minHeight: 38 }}>
          <option value="">All Status</option>
          <option value="available">Available</option>
          <option value="reserved">Reserved</option>
          <option value="dispatched">Dispatched</option>
        </select>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><div className="loading-spinner" /></div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>#</th><th>Party</th><th>Shade</th><th style={{ textAlign: 'right' }}>Cones</th><th style={{ textAlign: 'right' }}>Weight (kg)</th><th>Grade</th><th>Location</th><th>Date</th><th>Status</th></tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.id} style={s.status === 'dispatched' ? { opacity: 0.5 } : {}}>
                    <td className="text-secondary text-sm">{i + 1}</td>
                    <td><strong>{s.stock_inward?.clients?.name || '—'}</strong></td>
                    <td>{(() => { const sh = shades.find(sh => sh.id === s.shade_id); return sh ? <>{sh.name}{sh.code ? <span className="text-secondary text-sm"> ({sh.code})</span> : ''}</> : '—'; })()}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-heading)', fontWeight: 600 }}>{s.cones ?? '—'}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-heading)', fontWeight: 700 }}>{s.weight_kg} kg</td>
                    <td>
                      <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 12, fontWeight: 600, background: GRADE_COLORS[s.grade] + '18', color: GRADE_COLORS[s.grade] }}>
                        {GRADE_LABELS[s.grade] || s.grade}
                      </span>
                    </td>
                    <td className="text-secondary text-sm">{s.location || '—'}</td>
                    <td className="text-sm">{new Date(s.created_at).toLocaleDateString('en-IN')}</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 9999, fontSize: 12, fontWeight: 600, background: STATUS_COLORS[s.status] + '18', color: STATUS_COLORS[s.status], textTransform: 'capitalize' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_COLORS[s.status] }} />{s.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={9}><div className="empty-state"><Icon name="package" size={40} color="var(--primary-light)" /><p className="empty-state-title">No ready stock</p></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Add Ready Stock Entry"
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Entry'}</button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Stock Lot</label>
              <select className="form-select" value={form.lot_id} onChange={f('lot_id')}>
                <option value="">Select lot…</option>
                {lots.map(l => <option key={l.id} value={l.id}>{l.challan_no || `Lot #${l.id}`} — {l.clients?.name}</option>)}
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
            <div className="form-group"><label className="form-label">Cones</label><input className="form-input" type="number" min="0" value={form.cones} onChange={f('cones')} placeholder="Number of cones" /></div>
            <div className="form-group"><label className="form-label">Weight (kg) *</label><input className="form-input" type="number" step="0.1" min="0" value={form.weight_kg} onChange={f('weight_kg')} placeholder="Total weight" /></div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Grade</label>
              <select className="form-select" value={form.grade} onChange={f('grade')}>
                {GRADES.map(g => <option key={g} value={g}>{GRADE_LABELS[g]}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Location</label><input className="form-input" value={form.location} onChange={f('location')} placeholder="e.g. Rack A-1" /></div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
