'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useToast, Icon } from '@/components/ui';

interface Payslip {
  source: 'saved' | 'computed';
  month: number; year: number;
  hanks_kg: number; hanks_wage: number;
  coning_kg: number; coning_wage: number;
  dyeing_wage: number;
  present_days: number; daily_rate: number; attendance_wage: number;
  gross_wage: number;
  advance_deduction: number; loan_deduction: number; bonus: number;
  net_wage: number;
  status: string; payment_mode: string | null; payment_date: string | null;
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function Row({ label, value, sub, color, bold }: { label: string; value: string; sub?: string; color?: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <span style={{ fontSize: 14, fontWeight: bold ? 600 : 400, color: 'var(--text-secondary)' }}>{label}</span>
        {sub && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>{sub}</div>}
      </div>
      <span style={{ fontSize: bold ? 18 : 15, fontFamily: 'var(--font-heading)', fontWeight: 700, color: color || 'var(--text)' }}>{value}</span>
    </div>
  );
}

export default function WorkerPayslipPage() {
  const now = new Date();
  const { user } = useAuth();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year,  setYear]  = useState(String(now.getFullYear()));
  const [slip,  setSlip]  = useState<Payslip | null>(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const load = () => {
    setLoading(true); setSlip(null);
    apiFetch(`/payroll/my?month=${month}&year=${year}`)
      .then(setSlip).catch(e => toast(e.message, 'error')).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const years = Array.from({ length: 3 }, (_, i) => String(now.getFullYear() - i));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
      <div>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 20, marginBottom: 2 }}>My Payslip</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{user?.name}</p>
      </div>

      <div className="card">
        <div className="card-body">
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="form-label">Month</label>
              <select className="form-select" value={month} onChange={e => setMonth(e.target.value)}>
                {MONTHS.map((m, i) => <option key={i+1} value={String(i+1)}>{m}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="form-label">Year</label>
              <select className="form-select" value={year} onChange={e => setYear(e.target.value)}>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button className="btn btn-primary" onClick={load} disabled={loading}>
              {loading ? <div className="loading-spinner loading-spinner-sm" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} /> : <Icon name="search" size={16} />}
            </button>
          </div>
        </div>
      </div>

      {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><div className="loading-spinner" /></div>}

      {!loading && slip && (
        <div className="card" style={{ borderTop: `3px solid ${slip.status === 'paid' ? 'var(--success)' : 'var(--accent)'}` }}>
          {/* Header */}
          <div className="card-body" style={{ borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 16 }}>{MONTHS[slip.month - 1]} {slip.year}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                {slip.source === 'saved' ? 'Admin-confirmed payslip' : 'Estimated (not yet finalized by admin)'}
              </div>
            </div>
            {slip.status === 'paid' && (
              <div style={{ textAlign: 'right' }}>
                <span className="badge badge-approved">Paid</span>
                {slip.payment_mode && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, textTransform: 'capitalize' }}>{slip.payment_mode}{slip.payment_date ? ` · ${new Date(slip.payment_date).toLocaleDateString('en-IN')}` : ''}</div>}
              </div>
            )}
          </div>

          {/* Earnings breakdown */}
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12, borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Earnings</div>
            {slip.hanks_wage > 0 && <Row label="Hanks Production" sub={`${slip.hanks_kg} kg`} value={`₹${slip.hanks_wage.toLocaleString('en-IN')}`} color="var(--success)" />}
            {slip.coning_wage > 0 && <Row label="Coning Production" sub={`${slip.coning_kg} kg`} value={`₹${slip.coning_wage.toFixed(0)}`} color="var(--success)" />}
            {slip.dyeing_wage > 0 && <Row label="Dyeing" value={`₹${slip.dyeing_wage}`} color="var(--success)" />}
            {slip.attendance_wage > 0 && <Row label="Attendance Wage" sub={`${slip.present_days} days × ₹${slip.daily_rate}/day`} value={`₹${slip.attendance_wage.toFixed(0)}`} color="var(--success)" />}
            {slip.bonus > 0 && <Row label="Bonus" value={`₹${slip.bonus}`} color="var(--success)" />}
            {(slip.hanks_wage + slip.coning_wage + slip.dyeing_wage + slip.attendance_wage + slip.bonus) === 0 && (
              <div style={{ color: 'var(--text-secondary)', fontSize: 13, textAlign: 'center', padding: '8px 0' }}>No approved entries this month</div>
            )}
          </div>

          {/* Deductions */}
          {(slip.advance_deduction + slip.loan_deduction) > 0 && (
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12, borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Deductions</div>
              {slip.advance_deduction > 0 && <Row label="Salary Advances" value={`−₹${slip.advance_deduction.toLocaleString('en-IN')}`} color="var(--danger)" />}
              {slip.loan_deduction > 0 && <Row label="Loan Instalment" value={`−₹${slip.loan_deduction.toLocaleString('en-IN')}`} color="var(--danger)" />}
            </div>
          )}

          {/* Net */}
          <div className="card-body" style={{ background: slip.status === 'paid' ? 'var(--success-light)' : 'var(--accent-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Net Payable</span>
              <span style={{ fontSize: 28, fontFamily: 'var(--font-heading)', fontWeight: 700, color: slip.status === 'paid' ? 'var(--success)' : 'var(--accent)' }}>
                ₹{slip.net_wage.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>
      )}

      {!loading && !slip && (
        <div className="card">
          <div className="empty-state">
            <Icon name="file-text" size={40} color="var(--primary-light)" />
            <p className="empty-state-title">Select a month to view payslip</p>
          </div>
        </div>
      )}
    </div>
  );
}
