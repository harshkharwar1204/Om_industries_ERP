'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader, useToast, Icon } from '@/components/ui';

const ATT_STATUS = { P: 'Present', H: 'Half Day', A: 'Absent', L: 'Leave' };
const ATT_COLORS: Record<string, string> = { P: '#16A34A', H: '#EAB308', A: '#DC2626', L: '#2563EB' };
const ATT_BG: Record<string, string>     = { P: '#DCFCE7', H: '#FEF9C3', A: '#FEE2E2', L: '#DBEAFE' };

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function AttendancePage() {
  const [view, setView]         = useState<'daily' | 'monthly'>('daily');
  const [date, setDate]         = useState(new Date().toISOString().split('T')[0]);
  const [month, setMonth]       = useState(new Date().getMonth() + 1);
  const [year, setYear]         = useState(new Date().getFullYear());
  const [workers, setWorkers]   = useState<any[]>([]);
  const [att, setAtt]           = useState<Record<number, string>>({});
  const [monthData, setMonthData] = useState<any[]>([]);
  const [saving, setSaving]     = useState(false);
  const [loading, setLoading]   = useState(true);
  const toast = useToast();

  // Load workers once
  useEffect(() => {
    apiFetch('/workers').then(w => { setWorkers(w); }).catch(e => toast(e.message, 'error'));
  }, []);

  // Load existing attendance for selected date
  useEffect(() => {
    if (!workers.length) return;
    setLoading(true);
    apiFetch(`/attendance?date=${date}`)
      .then(records => {
        const map: Record<number, string> = {};
        // Default all to Present
        workers.forEach((w: any) => { map[w.id] = 'P'; });
        records.forEach((r: any) => { map[r.worker_id] = r.status; });
        setAtt(map);
      })
      .catch(e => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [date, workers.length]);

  // Load monthly data
  useEffect(() => {
    if (view !== 'monthly' || !workers.length) return;
    apiFetch(`/attendance?month=${month}&year=${year}`)
      .then(setMonthData)
      .catch(e => toast(e.message, 'error'));
  }, [view, month, year, workers.length]);

  const saveAll = async () => {
    setSaving(true);
    try {
      const records = workers.map((w: any) => ({ worker_id: w.id, status: att[w.id] || 'P' }));
      await apiFetch('/attendance', { method: 'POST', body: JSON.stringify({ date, records }) });
      toast(`Attendance saved for ${new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`);
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const counts = { P: 0, H: 0, A: 0, L: 0 };
  workers.forEach((w: any) => { const s = att[w.id] || 'P'; if (s in counts) counts[s as keyof typeof counts]++; });

  // Build monthly grid per worker
  const daysInMonth = new Date(year, month, 0).getDate();

  const getMonthStatus = (workerId: number, day: number): string => {
    const d = String(day).padStart(2, '0');
    const m = String(month).padStart(2, '0');
    const rec = monthData.find(r => r.worker_id === workerId && r.date === `${year}-${m}-${d}`);
    return rec?.status || '';
  };

  return (
    <div className="page-enter">
      <PageHeader title="Attendance" subtitle="Daily marking for all workers">
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={`btn ${view === 'daily' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('daily')} style={{ gap: 6 }}>
            <Icon name="calendar-check" size={16} /> Daily
          </button>
          <button className={`btn ${view === 'monthly' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('monthly')} style={{ gap: 6 }}>
            <Icon name="file-bar-chart" size={16} /> Monthly
          </button>
        </div>
      </PageHeader>

      {view === 'daily' && (
        <>
          {/* Date picker + summary */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="calendar-check" size={20} color="var(--accent)" />
              <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} style={{ minHeight: 40, fontSize: 15, maxWidth: 180 }} />
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {(Object.entries(counts) as [string, number][]).map(([s, c]) => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: ATT_BG[s], color: ATT_COLORS[s], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>{s}</div>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{c}</span>
                </div>
              ))}
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="loading-spinner" /></div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 24 }}>
                {workers.map((w: any) => {
                  const status = att[w.id] || 'P';
                  const initials = w.name.split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase();
                  return (
                    <div key={w.id} className="card" style={{ padding: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--accent)20', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>{initials}</div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 15 }}>{w.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{w.department || w.role?.replace('_', ' ')}</div>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                        {(Object.entries(ATT_STATUS) as [string, string][]).map(([code, label]) => (
                          <button key={code} onClick={() => setAtt(p => ({ ...p, [w.id]: code }))}
                            style={{ padding: '8px 4px', borderRadius: 'var(--radius-sm)', border: `2px solid ${status === code ? ATT_COLORS[code] : 'var(--border)'}`, background: status === code ? ATT_BG[code] : 'transparent', color: ATT_COLORS[code], fontSize: 11, fontWeight: status === code ? 700 : 400, cursor: 'pointer', transition: 'all 0.15s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                            <span style={{ fontSize: 15, fontWeight: 700 }}>{code}</span>
                            <span style={{ fontSize: 10 }}>{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              {workers.length > 0 && (
                <div style={{ position: 'sticky', bottom: 16, display: 'flex', justifyContent: 'center' }}>
                  <button className="btn btn-primary" style={{ padding: '14px 48px', fontSize: 16, boxShadow: 'var(--shadow-lg)', gap: 10 }} onClick={saveAll} disabled={saving}>
                    {saving ? <><div className="loading-spinner loading-spinner-sm" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} /> Saving…</> : <><Icon name="check-circle" size={20} /> Save All Attendance</>}
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {view === 'monthly' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <select className="form-select" value={month} onChange={e => setMonth(Number(e.target.value))} style={{ maxWidth: 120 }}>
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <input className="form-input" type="number" value={year} onChange={e => setYear(Number(e.target.value))} style={{ maxWidth: 90 }} />
            <div style={{ display: 'flex', gap: 12, marginLeft: 'auto' }}>
              {(Object.entries(ATT_COLORS) as [string, string][]).map(([s, c]) => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                  <div style={{ width: 14, height: 14, borderRadius: 3, background: ATT_BG[s], border: `1px solid ${c}` }} />
                  <span>{s} — {ATT_STATUS[s as keyof typeof ATT_STATUS]}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={{ minWidth: 160, position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 1 }}>Worker</th>
                  {Array.from({ length: daysInMonth }, (_, i) => (
                    <th key={i + 1} style={{ textAlign: 'center', minWidth: 36, fontSize: 12 }}>{i + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {workers.map((w: any) => (
                  <tr key={w.id}>
                    <td style={{ position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 1 }}><strong style={{ fontSize: 13 }}>{w.name}</strong></td>
                    {Array.from({ length: daysInMonth }, (_, i) => {
                      const s = getMonthStatus(w.id, i + 1);
                      return (
                        <td key={i + 1} style={{ textAlign: 'center', padding: '4px 2px' }}>
                          {s ? (
                            <div style={{ width: 28, height: 28, borderRadius: 6, background: ATT_BG[s], color: ATT_COLORS[s], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, margin: '0 auto' }}>{s}</div>
                          ) : <span style={{ color: 'var(--border)' }}>–</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
