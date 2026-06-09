'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader, Modal, StatusBadge, SearchableDropdown, useToast, Icon } from '@/components/ui';
import { scaleRecipe } from '@/lib/dyecalc';

interface Entry {
  id: number; date: string; input_kg: number; output_kg: number | null; loss_pct: number | null;
  status: string; batch_no: string | null; recipe_id: number | null; shade_id: number | null;
  client_id: number | null; quality_id: number | null;
  erp_users?: { name: string }; machines?: { name: string }; shades?: { name: string };
  clients?: { name: string }; qualities?: { name: string };
}

const BLANK = {
  client_id: '', quality_id: '', recipe_id: '', recipe_shade_id: '', machine_id: '',
  input_kg: '', date: new Date().toISOString().split('T')[0],
};

export default function DyeingPage() {
  const [entries, setEntries]     = useState<Entry[]>([]);
  const [clients, setClients]     = useState<any[]>([]);
  const [qualities, setQualities] = useState<any[]>([]);
  const [recipes, setRecipes]     = useState<any[]>([]);
  const [machines, setMachines]   = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(false);
  const [form, setForm]           = useState<any>(BLANK);
  const [mlr, setMlr]             = useState(8);
  const [checked, setChecked]     = useState<Record<number, boolean>>({});
  const [statusFilter, setStatus] = useState('');
  const [actionId, setActionId]   = useState<number | null>(null);
  const [outputModal, setOutputModal] = useState<Entry | null>(null);
  const [outputKg, setOutputKg]   = useState('');
  const [corrModal, setCorrModal] = useState<Entry | null>(null);
  const [corr, setCorr]           = useState({ chemical_name: '', qty: '', note: '' });
  const [saving, setSaving]       = useState(false);
  const toast = useToast();

  const load = (s = statusFilter) => {
    setLoading(true);
    apiFetch(`/production/dyeing${s ? `?status=${s}` : ''}`)
      .then(setEntries).catch(e => toast(e.message, 'error')).finally(() => setLoading(false));
  };

  useEffect(() => {
    Promise.all([apiFetch('/clients'), apiFetch('/qualities'), apiFetch('/recipes'), apiFetch('/masters/machines')])
      .then(([c, q, r, m]) => { setClients(c); setQualities(q); setRecipes(r); setMachines(m); })
      .catch(e => toast(e.message, 'error'));
    load();
  }, []);

  useEffect(() => { load(); }, [statusFilter]);

  const selectedRecipe = recipes.find(r => String(r.id) === String(form.recipe_id));
  const recipeShades: any[] = selectedRecipe?.shades ?? [];
  const selectedShade = recipeShades.find(s => String(s.id) === String(form.recipe_shade_id));
  const ingredients: any[] = selectedShade?.ingredients ?? [];
  const dyeLines = form.input_kg ? scaleRecipe(ingredients, Number(form.input_kg), mlr) : [];
  const needsMlr = ingredients.some(i => (i.unit || '').toLowerCase().includes('g/l'));
  const allChecked = dyeLines.length > 0 && dyeLines.every((_, i) => checked[i]);

  const openAdd = () => { setForm(BLANK); setChecked({}); setMlr(8); setModal(true); };

  const save = async () => {
    if (!form.client_id) { toast('Client required', 'error'); return; }
    if (!form.input_kg)  { toast('Batch weight required', 'error'); return; }
    setSaving(true);
    try {
      await apiFetch('/production/dyeing', { method: 'POST', body: JSON.stringify({
        client_id: form.client_id, quality_id: form.quality_id,
        shade_id: form.recipe_shade_id || null, recipe_id: form.recipe_id || null,
        machine_id: form.machine_id, input_kg: form.input_kg, date: form.date,
      }) });
      toast('Dyeing batch started ✓');
      setModal(false); setForm(BLANK); load();
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  // Recompute the chemical list for a batch at completion time.
  const chemicalsForBatch = (e: Entry) => {
    const rec = recipes.find(r => String(r.id) === String(e.recipe_id));
    const sh = rec?.shades?.find((s: any) => String(s.id) === String(e.shade_id));
    if (!sh) return [];
    return scaleRecipe(sh.ingredients ?? [], Number(e.input_kg), mlr).map(l => ({ name: l.name, qty: l.total }));
  };

  const complete = async () => {
    if (!outputModal || !outputKg) return;
    setActionId(outputModal.id);
    try {
      await apiFetch(`/production/dyeing/${outputModal.id}/approve`, {
        method: 'PUT',
        body: JSON.stringify({ output_kg: outputKg, chemicals: chemicalsForBatch(outputModal) }),
      });
      toast('Batch completed → dyed stock ✓'); load();
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setActionId(null); setOutputModal(null); }
  };

  const reject = async (id: number) => {
    setActionId(id);
    try { await apiFetch(`/production/dyeing/${id}/reject`, { method: 'PUT', body: '{}' }); toast('Batch rejected'); load(); }
    catch (e: any) { toast(e.message, 'error'); }
    finally { setActionId(null); }
  };

  const saveCorrection = async () => {
    if (!corrModal || !corr.chemical_name || !corr.qty) { toast('Chemical and qty required', 'error'); return; }
    try {
      await apiFetch(`/production/dyeing/${corrModal.id}/correction`, { method: 'POST', body: JSON.stringify(corr) });
      toast('Correction recorded'); setCorrModal(null); setCorr({ chemical_name: '', qty: '', note: '' });
    } catch (e: any) { toast(e.message, 'error'); }
  };

  const pending = entries.filter(e => e.status === 'pending' || e.status === 'running');

  return (
    <div className="page-enter">
      <PageHeader title="Dyeing Production" subtitle={`${entries.length} batches · Unit 1`} icon="droplets" iconColor="var(--info)">
        <button className="btn btn-primary" onClick={openAdd}><Icon name="plus" size={16} /> New Batch</button>
      </PageHeader>

      <div className="grid-3" style={{ marginBottom: 24 }}>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: 'var(--warning)18', color: 'var(--warning)' }}><Icon name="clock" size={24} /></div>
          <div className="stat-content"><div className="stat-label">Running</div><div className="stat-value">{pending.length}</div></div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: 'var(--success)18', color: 'var(--success)' }}><Icon name="check-circle" size={24} /></div>
          <div className="stat-content"><div className="stat-label">Total Input (kg)</div><div className="stat-value">{entries.reduce((s, e) => s + Number(e.input_kg), 0).toFixed(1)}</div></div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: '#DBEAFE', color: 'var(--info)' }}><Icon name="droplets" size={24} /></div>
          <div className="stat-content"><div className="stat-label">Avg Loss %</div><div className="stat-value">
            {(() => { const done = entries.filter(e => e.loss_pct != null); return done.length ? (done.reduce((s, e) => s + Number(e.loss_pct), 0) / done.length).toFixed(1) + '%' : '—'; })()}
          </div></div>
        </div>
      </div>

      <div className="card">
        <div className="card-body" style={{ borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <h3 style={{ fontSize: 16 }}>Dyeing Log</h3>
          <select className="form-select" value={statusFilter} onChange={e => setStatus(e.target.value)} style={{ maxWidth: 160, minHeight: 38, fontSize: 14 }}>
            <option value="">All Status</option><option value="running">Running</option><option value="completed">Completed</option><option value="rejected">Rejected</option>
          </select>
        </div>
        {loading ? (
          <div style={{ padding: '40px 20px', display: 'flex', justifyContent: 'center' }}><div className="loading-spinner" /></div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr>
                <th>Batch</th><th>Date</th><th>Client</th><th>Quality</th><th>Shade</th><th className="hide-mobile">Machine</th>
                <th>Input</th><th>Output</th><th>Loss %</th><th>Status</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id}>
                    <td className="font-mono text-sm" style={{ fontWeight: 700, color: 'var(--accent)' }}>{e.batch_no || `B-${e.id}`}</td>
                    <td className="text-sm">{new Date(e.date).toLocaleDateString('en-IN')}</td>
                    <td><strong>{e.clients?.name || '—'}</strong></td>
                    <td className="text-sm">{e.qualities?.name || '—'}</td>
                    <td>{e.shades?.name || '—'}</td>
                    <td className="text-secondary text-sm hide-mobile">{e.machines?.name || '—'}</td>
                    <td style={{ fontFamily: 'var(--font-heading)' }}>{e.input_kg}</td>
                    <td style={{ fontFamily: 'var(--font-heading)' }}>{e.output_kg != null ? e.output_kg : '—'}</td>
                    <td style={{ color: e.loss_pct != null && Number(e.loss_pct) > 5 ? 'var(--danger)' : 'var(--success)', fontWeight: 600, fontFamily: 'var(--font-heading)' }}>{e.loss_pct != null ? `${e.loss_pct}%` : '—'}</td>
                    <td><StatusBadge status={e.status} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {(e.status === 'pending' || e.status === 'running') && (<>
                          <button className="btn btn-success btn-sm" style={{ gap: 4 }} onClick={() => { setOutputModal(e); setOutputKg(e.output_kg?.toString() || ''); }} disabled={actionId === e.id}><Icon name="check" size={13} /> Complete</button>
                          <button className="btn btn-danger btn-sm" style={{ width: 32, height: 32, padding: 0, minHeight: 32 }} onClick={() => reject(e.id)} disabled={actionId === e.id} title="Reject"><Icon name="x" size={13} /></button>
                        </>)}
                        {e.status === 'completed' && (
                          <button className="btn btn-ghost btn-sm" style={{ gap: 4, color: 'var(--info)' }} onClick={() => setCorrModal(e)}><Icon name="plus" size={13} /> Correction</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr><td colSpan={11}><div className="empty-state" style={{ padding: '32px 24px' }}><Icon name="flask-conical" size={40} color="var(--primary-light)" /><p className="empty-state-title">No dyeing batches</p></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New batch modal — recipe-driven floor calculator */}
      <Modal open={modal} onClose={() => setModal(false)} title="New Dyeing Batch"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || (dyeLines.length > 0 && !allChecked)}>
            {saving ? 'Starting…' : 'Start Batch'}
          </button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Client / Party *</label>
              <SearchableDropdown options={clients.map(c => ({ label: c.name, value: c.id }))} value={form.client_id} onChange={v => setForm((p: any) => ({ ...p, client_id: v }))} placeholder="Search party…" />
            </div>
            <div className="form-group">
              <label className="form-label">Quality / Count</label>
              <SearchableDropdown options={qualities.map(q => ({ label: q.name, value: q.id }))} value={form.quality_id} onChange={v => setForm((p: any) => ({ ...p, quality_id: v }))} placeholder="Search quality…" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Recipe (Colour)</label>
              <SearchableDropdown options={recipes.map(r => ({ label: `${r.code}${r.client ? ` — ${r.client}` : ''}`, value: r.id }))} value={form.recipe_id} onChange={v => setForm((p: any) => ({ ...p, recipe_id: v, recipe_shade_id: '' }))} placeholder="Search recipe…" />
            </div>
            <div className="form-group">
              <label className="form-label">Shade No.</label>
              <select className="form-select" value={form.recipe_shade_id} onChange={e => setForm((p: any) => ({ ...p, recipe_shade_id: e.target.value }))} disabled={!recipeShades.length}>
                <option value="">{recipeShades.length ? 'Select shade…' : 'Pick recipe first'}</option>
                {recipeShades.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Batch Weight (kg) *</label><input className="form-input" type="number" step="0.1" min="0" value={form.input_kg} onChange={e => setForm((p: any) => ({ ...p, input_kg: e.target.value }))} placeholder="Total batch weight" /></div>
            <div className="form-group"><label className="form-label">Machine</label>
              <select className="form-select" value={form.machine_id} onChange={e => setForm((p: any) => ({ ...p, machine_id: e.target.value }))}>
                <option value="">Select machine…</option>
                {machines.filter(m => m.status === 'active').map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Date</label><input className="form-input" type="date" value={form.date} onChange={e => setForm((p: any) => ({ ...p, date: e.target.value }))} /></div>
            {needsMlr && (
              <div className="form-group"><label className="form-label">Liquor Ratio (1:?)</label><input className="form-input" type="number" step="0.5" min="1" value={mlr} onChange={e => setMlr(Number(e.target.value) || 8)} /></div>
            )}
          </div>

          {/* Auto-scaled dye checklist */}
          {dyeLines.length > 0 ? (
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', background: 'var(--bg)', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14 }}>
                <Icon name="flask-conical" size={15} color="var(--info)" /> Dye Weighing Checklist — {form.input_kg} kg batch
              </div>
              {dyeLines.map((l, i) => (
                <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderTop: '1px solid var(--border)', cursor: 'pointer', background: checked[i] ? 'var(--success-light)' : 'transparent' }}>
                  <input type="checkbox" checked={!!checked[i]} onChange={e => setChecked(p => ({ ...p, [i]: e.target.checked }))} style={{ width: 20, height: 20, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{l.name}</span>
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15 }}>{l.display}</span>
                </label>
              ))}
              <div style={{ padding: '8px 14px', fontSize: 12, color: 'var(--text-secondary)', borderTop: '1px solid var(--border)' }}>
                {allChecked ? '✓ All dyes weighed & added' : 'Tick each dye after weighing to start the batch.'}
              </div>
            </div>
          ) : form.recipe_shade_id && form.input_kg ? (
            <div className="text-secondary text-sm" style={{ padding: '8px 0' }}>No chemicals in this recipe shade.</div>
          ) : null}
        </div>
      </Modal>

      {/* Complete modal */}
      <Modal open={!!outputModal} onClose={() => setOutputModal(null)} title="Complete Batch"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setOutputModal(null)}>Cancel</button>
          <button className="btn btn-success" onClick={complete} disabled={!outputKg || actionId === outputModal?.id}><Icon name="check" size={16} /> Mark Complete</button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ padding: '12px 16px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', fontSize: 14 }}>
            <strong>Batch:</strong> {outputModal?.batch_no} &nbsp;·&nbsp; <strong>Input:</strong> {outputModal?.input_kg} kg
          </div>
          <div className="form-group">
            <label className="form-label">Output (kg) *</label>
            <input className="form-input" type="number" step="0.1" min="0" value={outputKg} onChange={e => setOutputKg(e.target.value)} style={{ textAlign: 'center', fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-heading)', height: 56 }} placeholder="0.0" autoFocus />
          </div>
          {outputKg && outputModal && (
            <div style={{ background: ((outputModal.input_kg - Number(outputKg)) / outputModal.input_kg * 100) > 5 ? '#FEE2E2' : 'var(--success-light)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 500, fontSize: 14 }}>Loss %</span>
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700 }}>{((outputModal.input_kg - Number(outputKg)) / outputModal.input_kg * 100).toFixed(1)}%</span>
            </div>
          )}
          <div className="text-secondary text-sm">On complete: dyed stock created for this batch, chemicals deducted from inventory, order progress updated.</div>
        </div>
      </Modal>

      {/* Correction modal */}
      <Modal open={!!corrModal} onClose={() => setCorrModal(null)} title="Add Dye Correction"
        footer={<><button className="btn btn-secondary" onClick={() => setCorrModal(null)}>Cancel</button><button className="btn btn-primary" onClick={saveCorrection}>Save</button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group"><label className="form-label">Chemical / Dye Name *</label><input className="form-input" value={corr.chemical_name} onChange={e => setCorr(p => ({ ...p, chemical_name: e.target.value }))} placeholder="e.g. Red 3BS" /></div>
          <div className="form-group"><label className="form-label">Extra Qty (g) *</label><input className="form-input" type="number" step="0.1" value={corr.qty} onChange={e => setCorr(p => ({ ...p, qty: e.target.value }))} placeholder="Extra grams used" /></div>
          <div className="form-group"><label className="form-label">Note</label><input className="form-input" value={corr.note} onChange={e => setCorr(p => ({ ...p, note: e.target.value }))} placeholder="Reason (optional)" /></div>
        </div>
      </Modal>
    </div>
  );
}
