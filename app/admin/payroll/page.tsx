'use client';
import { useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader, Modal, useToast, Icon } from '@/components/ui';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const PAYMENT_MODES = ['cash', 'bank', 'upi'];

interface PayrollRow {
  worker_id: number; worker_name: string; department: string | null; role: string;
  hanks_kg: number; hanks_wage: number;
  coning_kg: number; coning_wage: number;
  dyeing_wage: number; present_days: number; daily_rate: number; attendance_wage: number;
  gross_wage: number; advance_deduction: number; loan_deduction: number; bonus: number; net_wage: number;
  saved_id: number | null; status: string; payment_mode: string | null; payment_date: string | null; notes: string | null;
}

export default function PayrollPage() {
  const now = new Date();
  const [tab, setTab]   = useState<'generate' | 'export'>('generate');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());
  const [rows, setRows]   = useState<PayrollRow[]>([]);
  const [loading, setLoading]   = useState(false);
  const [generated, setGenerated] = useState(false);
  const [editRow, setEditRow]   = useState<PayrollRow | null>(null);
  const [editForm, setEditForm] = useState({ dyeing_wage: '', bonus: '', notes: '', payment_mode: 'cash', payment_date: '' });
  const [saving, setSaving]     = useState(false);
  const [payModal, setPayModal] = useState(false);
  const [payRow, setPayRow]     = useState<PayrollRow | null>(null);
  const toast = useToast();

  const generate = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/payroll/full?month=${month}&year=${year}`);
      setRows(data);
      setGenerated(true);
      if (!data.length) toast('No wage-earning workers found for this period');
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }, [month, year]);

  const saveRow = async (row: PayrollRow) => {
    setSaving(true);
    try {
      const saved = await apiFetch('/payroll/full', {
        method: 'POST',
        body: JSON.stringify({ worker_id: row.worker_id, month, year, dyeing_wage: row.dyeing_wage, bonus: row.bonus, notes: row.notes }),
      });
      // Update saved_id in local state so Pay button appears immediately
      setRows(prev => prev.map(r => r.worker_id === row.worker_id ? { ...r, saved_id: saved.id, status: saved.status } : r));
      toast(`${row.worker_name} — payroll saved`);
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      await Promise.all(rows.map(r =>
        apiFetch('/payroll/full', { method: 'POST', body: JSON.stringify({ worker_id: r.worker_id, month, year, dyeing_wage: r.dyeing_wage, bonus: r.bonus, notes: r.notes }) })
      ));
      toast('All payroll records saved');
      generate();
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const openEdit = (r: PayrollRow) => {
    setEditRow(r);
    setEditForm({ dyeing_wage: String(r.dyeing_wage), bonus: String(r.bonus), notes: r.notes || '', payment_mode: r.payment_mode || 'cash', payment_date: r.payment_date || new Date().toISOString().split('T')[0] });
    setEditModal(true);
  };

  const [editModal, setEditModal] = useState(false);
  const applyEdit = () => {
    if (!editRow) return;
    const updated = rows.map(r => {
      if (r.worker_id !== editRow.worker_id) return r;
      const dyeing  = Number(editForm.dyeing_wage) || 0;
      const bonus   = Number(editForm.bonus)       || 0;
      const gross   = r.hanks_wage + r.coning_wage + dyeing + r.attendance_wage + bonus;
      const net     = Math.max(0, gross - r.advance_deduction - r.loan_deduction);
      return { ...r, dyeing_wage: dyeing, bonus, notes: editForm.notes, gross_wage: gross, net_wage: net };
    });
    setRows(updated);
    setEditModal(false);
  };

  const markPaid = async () => {
    if (!payRow?.saved_id) { toast('Save payroll first', 'error'); return; }
    setSaving(true);
    try {
      await apiFetch(`/payroll/full/${payRow.saved_id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'paid', payment_mode: editForm.payment_mode, payment_date: editForm.payment_date }),
      });
      toast(`${payRow.worker_name} — marked paid`);
      setPayModal(false);
      generate();
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const exportCSV = () => {
    const headers = ['Worker','Dept','Hanks kg','Hanks ₹','Coning kg','Coning ₹','Dyeing ₹','Attend Days','Attend ₹','Bonus','Gross ₹','Advances','Loan','Net ₹','Status','Payment Mode','Paid Date'];
    const csvRows = rows.map(r => [r.worker_name, r.department||'', r.hanks_kg, r.hanks_wage, r.coning_kg, r.coning_wage, r.dyeing_wage, r.present_days, r.attendance_wage, r.bonus, r.gross_wage, r.advance_deduction, r.loan_deduction, r.net_wage, r.status, r.payment_mode||'', r.payment_date||''].join(','));
    const csv = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `payroll-${year}-${String(month).padStart(2,'0')}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const totalGross = rows.reduce((s, r) => s + r.gross_wage, 0);
  const totalNet   = rows.reduce((s, r) => s + r.net_wage, 0);
  const totalAdv   = rows.reduce((s, r) => s + r.advance_deduction, 0);
  const paid       = rows.filter(r => r.status === 'paid').length;

  return (
    <div className="page-enter">
      <PageHeader title="Payroll" subtitle={`${MONTHS[month - 1]} ${year}`} icon="file-bar-chart" iconColor="var(--primary)">
        {generated && rows.length > 0 && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={exportCSV} style={{ gap: 8 }}><Icon name="download" size={16} /> CSV</button>
            <button className="btn btn-primary" onClick={saveAll} disabled={saving} style={{ gap: 8 }}>
              <Icon name="check" size={16} /> {saving ? 'Saving…' : 'Save All'}
            </button>
          </div>
        )}
      </PageHeader>

      {/* Month selector */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
            <div className="form-group">
              <label className="form-label">Month</label>
              <select className="form-select" value={month} onChange={e => { setMonth(+e.target.value); setGenerated(false); }} style={{ minWidth: 140 }}>
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Year</label>
              <input className="form-input" type="number" value={year} onChange={e => { setYear(+e.target.value); setGenerated(false); }} style={{ maxWidth: 100 }} />
            </div>
            <button className="btn btn-primary" onClick={generate} disabled={loading} style={{ gap: 8 }}>
              {loading ? <><div className="loading-spinner loading-spinner-sm" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} /> Calculating…</> : <><Icon name="zap" size={16} /> Generate</>}
            </button>
          </div>
        </div>
      </div>

      {/* KPI summary */}
      {generated && rows.length > 0 && (
        <div className="grid-4" style={{ marginBottom: 20 }}>
          {[
            { label: 'Workers', value: rows.length, icon: 'users', color: 'var(--info)' },
            { label: 'Total Gross', value: `₹${totalGross.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, icon: 'indian-rupee', color: 'var(--warning)' },
            { label: 'Deductions', value: `₹${(totalAdv + rows.reduce((s,r) => s+r.loan_deduction,0)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, icon: 'trending-down', color: 'var(--danger)' },
            { label: 'Net Payable', value: `₹${totalNet.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, icon: 'check-circle', color: 'var(--success)' },
          ].map(k => (
            <div key={k.label} className="card stat-card">
              <div className="stat-icon" style={{ background: k.color + '18', color: k.color }}><Icon name={k.icon} size={22} /></div>
              <div className="stat-content"><div className="stat-label">{k.label}</div><div className="stat-value" style={{ fontSize: 20 }}>{k.value}</div></div>
            </div>
          ))}
        </div>
      )}

      {/* Payroll table */}
      {generated && (
        <div className="card">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Worker</th>
                  <th className="hide-mobile" style={{ textAlign: 'right' }}>Hanks ₹</th>
                  <th className="hide-mobile" style={{ textAlign: 'right' }}>Coning ₹</th>
                  <th className="hide-mobile" style={{ textAlign: 'right' }}>Dyeing ₹</th>
                  <th className="hide-mobile" style={{ textAlign: 'right' }}>Attend ₹</th>
                  <th className="hide-mobile" style={{ textAlign: 'right' }}>Bonus</th>
                  <th style={{ textAlign: 'right' }}>Gross ₹</th>
                  <th className="hide-mobile" style={{ textAlign: 'right' }}>Deductions</th>
                  <th style={{ textAlign: 'right' }}>Net ₹</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.worker_id} style={{ opacity: r.status === 'paid' ? 0.65 : 1 }}>
                    <td>
                      <strong>{r.worker_name}</strong>
                      <div className="text-secondary text-xs" style={{ marginTop: 2 }}>{r.department || r.role.replace('_', ' ')}</div>
                    </td>
                    <td className="hide-mobile" style={{ textAlign: 'right', fontFamily: 'var(--font-heading)', fontSize: 13 }}>{r.hanks_wage > 0 ? `₹${r.hanks_wage}` : '—'}</td>
                    <td className="hide-mobile" style={{ textAlign: 'right', fontFamily: 'var(--font-heading)', fontSize: 13 }}>{r.coning_wage > 0 ? `₹${r.coning_wage.toFixed(0)}` : '—'}</td>
                    <td className="hide-mobile" style={{ textAlign: 'right', fontFamily: 'var(--font-heading)', fontSize: 13 }}>{r.dyeing_wage > 0 ? `₹${r.dyeing_wage}` : '—'}</td>
                    <td className="hide-mobile" style={{ textAlign: 'right', fontFamily: 'var(--font-heading)', fontSize: 13 }}>
                      {r.attendance_wage > 0 ? `₹${r.attendance_wage.toFixed(0)}` : '—'}
                      {r.present_days > 0 && <div className="text-secondary" style={{ fontSize: 10 }}>{r.present_days}d × ₹{r.daily_rate}</div>}
                    </td>
                    <td className="hide-mobile" style={{ textAlign: 'right', fontFamily: 'var(--font-heading)', fontSize: 13, color: r.bonus > 0 ? 'var(--success)' : undefined }}>{r.bonus > 0 ? `₹${r.bonus}` : '—'}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-heading)', fontWeight: 700 }}>₹{r.gross_wage.toFixed(0)}</td>
                    <td className="hide-mobile" style={{ textAlign: 'right', fontFamily: 'var(--font-heading)', fontSize: 13, color: (r.advance_deduction + r.loan_deduction) > 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>
                      {(r.advance_deduction + r.loan_deduction) > 0 ? `-₹${(r.advance_deduction + r.loan_deduction).toFixed(0)}` : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--success)', fontSize: 15 }}>₹{r.net_wage.toFixed(0)}</td>
                    <td>
                      {r.status === 'paid'
                        ? <span className="badge badge-approved">Paid {r.payment_mode ? `(${r.payment_mode})` : ''}</span>
                        : r.saved_id
                          ? <span className="badge badge-pending">Saved</span>
                          : <span className="badge badge-grey">Draft</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(r)} title="Edit dyeing wage / bonus">
                          <Icon name="pencil" size={13} />
                        </button>
                        <button className="btn btn-sm" onClick={() => saveRow(r)} disabled={saving}
                          style={{ background: 'var(--info-light)', color: 'var(--info)', border: '1px solid #93C5FD' }}>
                          Save
                        </button>
                        {r.saved_id && r.status !== 'paid' && (
                          <button className="btn btn-success btn-sm" onClick={() => { setPayRow(r); setEditForm(p => ({ ...p, payment_mode: 'cash', payment_date: new Date().toISOString().split('T')[0] })); setPayModal(true); }}
                            style={{ gap: 4 }}>
                            <Icon name="check" size={13} /> Pay
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={11}><div className="empty-state" style={{ padding: 40 }}><Icon name="file-bar-chart" size={40} color="var(--primary-light)" /><p className="empty-state-title">No workers with wages this period</p><p className="text-secondary" style={{ fontSize: 13, marginTop: 4 }}>Make sure production entries are approved and attendance is marked</p></div></td></tr>
                )}
                {rows.length > 0 && (
                  <tr style={{ background: 'var(--hover-bg)', fontWeight: 700 }}>
                    <td><strong>TOTAL</strong> <span className="text-secondary text-sm">({rows.length} workers, {paid} paid)</span></td>
                    <td className="hide-mobile" />
                    <td className="hide-mobile" />
                    <td className="hide-mobile" />
                    <td className="hide-mobile" />
                    <td className="hide-mobile" />
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-heading)' }}>₹{totalGross.toFixed(0)}</td>
                    <td className="hide-mobile" style={{ textAlign: 'right', fontFamily: 'var(--font-heading)', color: 'var(--danger)' }}>-₹{(totalAdv + rows.reduce((s,r) => s+r.loan_deduction,0)).toFixed(0)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-heading)', color: 'var(--success)' }}>₹{totalNet.toFixed(0)}</td>
                    <td /><td />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit dyeing/bonus modal */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title={`Edit — ${editRow?.worker_name}`}
        footer={<><button className="btn btn-secondary" onClick={() => setEditModal(false)}>Cancel</button><button className="btn btn-primary" onClick={applyEdit}>Apply</button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Dyeing Wage (₹)</label>
              <input className="form-input" type="number" step="1" min="0" value={editForm.dyeing_wage} onChange={e => setEditForm(p => ({ ...p, dyeing_wage: e.target.value }))} placeholder="0" inputMode="numeric" />
            </div>
            <div className="form-group">
              <label className="form-label">Bonus (₹)</label>
              <input className="form-input" type="number" step="1" min="0" value={editForm.bonus} onChange={e => setEditForm(p => ({ ...p, bonus: e.target.value }))} placeholder="0" inputMode="numeric" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <input className="form-input" value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional remark" />
          </div>
          {editRow && (
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span className="text-secondary">Hanks + Coning + Attend</span>
                <span style={{ fontFamily: 'var(--font-heading)' }}>₹{(editRow.hanks_wage + editRow.coning_wage + editRow.attendance_wage).toFixed(0)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span className="text-secondary">Dyeing + Bonus</span>
                <span style={{ fontFamily: 'var(--font-heading)' }}>₹{((Number(editForm.dyeing_wage)||0) + (Number(editForm.bonus)||0)).toFixed(0)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span className="text-secondary">Deductions</span>
                <span style={{ fontFamily: 'var(--font-heading)', color: 'var(--danger)' }}>-₹{(editRow.advance_deduction + editRow.loan_deduction).toFixed(0)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 6, fontWeight: 700 }}>
                <span>Net Payable</span>
                <span style={{ fontFamily: 'var(--font-heading)', color: 'var(--success)' }}>
                  ₹{Math.max(0, editRow.hanks_wage + editRow.coning_wage + editRow.attendance_wage + (Number(editForm.dyeing_wage)||0) + (Number(editForm.bonus)||0) - editRow.advance_deduction - editRow.loan_deduction).toFixed(0)}
                </span>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Mark Paid modal */}
      <Modal open={payModal} onClose={() => setPayModal(false)} title={`Mark Paid — ${payRow?.worker_name}`}
        footer={<><button className="btn btn-secondary" onClick={() => setPayModal(false)}>Cancel</button><button className="btn btn-success" onClick={markPaid} disabled={saving}>{saving ? 'Saving…' : 'Confirm Payment'}</button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {payRow && (
            <div style={{ background: 'var(--success-light)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', textAlign: 'center' }}>
              <div className="text-secondary" style={{ fontSize: 13 }}>Net Payable</div>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 28, color: 'var(--success)' }}>₹{payRow.net_wage.toFixed(0)}</div>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Payment Mode</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {PAYMENT_MODES.map(m => (
                <button key={m} type="button"
                  onClick={() => setEditForm(p => ({ ...p, payment_mode: m }))}
                  className={editForm.payment_mode === m ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                  style={{ flex: 1, textTransform: 'capitalize' }}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Payment Date</label>
            <input className="form-input" type="date" value={editForm.payment_date} onChange={e => setEditForm(p => ({ ...p, payment_date: e.target.value }))} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
