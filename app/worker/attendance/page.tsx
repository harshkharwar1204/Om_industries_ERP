'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useToast, Icon } from '@/components/ui';

const ATT_STATUS = { P: 'Present', H: 'Half Day', A: 'Absent', L: 'Leave' };
const ATT_COLORS: Record<string, string> = { P: '#16A34A', H: '#EAB308', A: '#DC2626', L: '#2563EB' };
const ATT_BG: Record<string, string>     = { P: '#DCFCE7', H: '#FEF9C3', A: '#FEE2E2', L: '#DBEAFE' };

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function WorkerAttendancePage() {
  const [month, setMonth]   = useState(new Date().getMonth() + 1);
  const [year, setYear]     = useState(new Date().getFullYear());
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const toast = useToast();

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    apiFetch(`/attendance?worker_id=${user.id}&month=${month}&year=${year}`)
      .then(setRecords)
      .catch(e => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [user?.id, month, year]);

  const daysInMonth = new Date(year, month, 0).getDate();
  const getStatus = (day: number): string => {
    const d = String(day).padStart(2, '0');
    const m = String(month).padStart(2, '0');
    const rec = records.find(r => r.date === `${year}-${m}-${d}`);
    return rec?.status || '';
  };

  const counts = { P: 0, H: 0, A: 0, L: 0 };
  records.forEach(r => { if (r.status in counts) counts[r.status as keyof typeof counts]++; });
  const totalPresent = counts.P + counts.H * 0.5;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
      <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 20 }}>My Attendance</h2>

      {/* Month selector */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); }}>
          <Icon name="chevron-left" size={18} />
        </button>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 16, flex: 1, textAlign: 'center' }}>{MONTHS[month - 1]} {year}</span>
        <button style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); }}>
          <Icon name="chevron-right" size={18} />
        </button>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {([['P', 'Present'], ['H', 'Half Day'], ['A', 'Absent'], ['L', 'Leave']] as [string, string][]).map(([s, label]) => (
          <div key={s} className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, borderLeft: `3px solid ${ATT_COLORS[s]}` }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: ATT_BG[s], color: ATT_COLORS[s], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, flexShrink: 0 }}>{s}</div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-heading)', color: ATT_COLORS[s] }}>{counts[s as keyof typeof counts]}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Days worked */}
      <div className="card" style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 500, color: 'var(--text-secondary)', fontSize: 14 }}>Days Worked (this month)</span>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 22, color: 'var(--success)' }}>{totalPresent}</span>
      </div>

      {/* Calendar grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><div className="loading-spinner" /></div>
      ) : (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', padding: '4px 0', textTransform: 'uppercase' }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {/* Offset for first day of month */}
            {Array.from({ length: new Date(year, month - 1, 1).getDay() }, (_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const s = getStatus(day);
              const isToday = new Date().getDate() === day && new Date().getMonth() + 1 === month && new Date().getFullYear() === year;
              return (
                <div key={day} style={{
                  aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 8, fontSize: 13, fontWeight: s ? 700 : 400,
                  background: s ? ATT_BG[s] : isToday ? 'var(--accent)10' : 'transparent',
                  color: s ? ATT_COLORS[s] : isToday ? 'var(--accent)' : 'var(--text)',
                  border: isToday ? '2px solid var(--accent)' : `1px solid ${s ? ATT_COLORS[s] + '40' : 'var(--border)'}`,
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{day}</div>
                    {s && <div style={{ fontSize: 9, fontWeight: 700, lineHeight: 1 }}>{s}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
