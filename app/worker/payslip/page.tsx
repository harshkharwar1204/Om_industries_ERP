'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useToast, Icon } from '@/components/ui';

interface Payslip {
  month: number; year: number;
  approved_entries: number; total_entries: number;
  total_kg: number; gross_wages: number;
  total_advances: number; net_wages: number;
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function Row({ label, value, color, large }: { label: string; value: string; color?: string; large?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: large ? 15 : 14, fontWeight: large ? 700 : 500, color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontSize: large ? 22 : 17, fontFamily: 'var(--font-heading)', fontWeight: 700, color: color || 'var(--text)' }}>{value}</span>
    </div>
  );
}

export default function WorkerPayslipPage() {
  const now = new Date();
  const [month, setMonth]   = useState(String(now.getMonth() + 1));
  const [year,  setYear]    = useState(String(now.getFullYear()));
  const [slip,  setSlip]    = useState<Payslip | null>(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const load = () => {
    setLoading(true); setSlip(null);
    apiFetch(`/payroll/hanks/my?month=${month}&year=${year}`)
      .then(setSlip).catch(e => toast(e.message, 'error')).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const years = Array.from({ length: 3 }, (_, i) => String(now.getFullYear() - i));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
      <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 20 }}>My Payslip</h2>

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
            <button className="btn btn-primary" onClick={load} disabled={loading} style={{ whiteSpace: 'nowrap' }}>
              {loading
                ? <div className="loading-spinner loading-spinner-sm" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} />
                : <Icon name="search" size={16} />}
              View
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><div className="loading-spinner" /></div>
      )}

      {!loading && slip && (
        <div className="card" style={{ borderTop: '3px solid var(--accent)' }}>
          <div className="card-body" style={{ borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 16 }}>
              {MONTHS[slip.month - 1]} {slip.year}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
              {slip.approved_entries} approved of {slip.total_entries} entries
            </div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Row label="Total Weight"      value={`${slip.total_kg} kg`} />
            <Row label="Gross Earnings"    value={`₹${slip.gross_wages.toLocaleString('en-IN')}`}      color="var(--success)" />
            <Row label="Advances Deducted" value={`−₹${slip.total_advances.toLocaleString('en-IN')}`} color="var(--danger)" />
            <div style={{ height: 1, background: 'var(--border)' }} />
            <Row label="Net Payable"       value={`₹${slip.net_wages.toLocaleString('en-IN')}`}       color="var(--accent)" large />
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
