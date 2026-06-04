'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast, Icon } from '@/components/ui';

const ROLES = [
  { value: 'admin',         label: 'Admin / Manager', desc: 'Full access to dashboard, reports, payroll', icon: 'settings', color: 'var(--primary)' },
  { value: 'hanks_worker',  label: 'Hanks Worker',     desc: 'Submit hanks production entries',          icon: 'factory',  color: 'var(--accent)' },
  { value: 'coning_worker', label: 'Coning Worker',    desc: 'Submit coning production entries',         icon: 'layers',   color: 'var(--info)' },
];

const DEPTS: Record<string, string[]> = {
  admin:         ['hanks', 'coning', 'dyeing'],
  hanks_worker:  ['hanks'],
  coning_worker: ['coning'],
};

export default function OnboardingPage() {
  const [profile, setProfile]     = useState<{ name: string; email: string; googleId: string } | null>(null);
  const [credential, setCredential] = useState('');
  const [role, setRole]           = useState('');
  const [department, setDept]     = useState('');
  const [name, setName]           = useState('');
  const [loading, setLoading]     = useState(false);
  const router = useRouter();
  const toast  = useToast();

  useEffect(() => {
    const raw = sessionStorage.getItem('google_onboarding');
    if (!raw) { router.replace('/login'); return; }
    try {
      const data = JSON.parse(raw);
      setProfile(data.profile);
      setCredential(data.credential);
      setName(data.profile.name || '');
    } catch { router.replace('/login'); }
  }, [router]);

  const handleRoleSelect = (r: string) => {
    setRole(r);
    setDept(DEPTS[r]?.[0] || '');
  };

  const handleSubmit = async () => {
    if (!role) { toast('Select a role', 'error'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential, role, department: department || null, name }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error || 'Failed', 'error'); setLoading(false); return; }
      localStorage.setItem('erp_token', data.token);
      sessionStorage.removeItem('google_onboarding');
      toast(`Welcome, ${data.user.name}!`);
      router.replace(data.user.role === 'admin' ? '/admin/dashboard' : '/worker');
    } catch (e: any) {
      toast(e.message, 'error');
      setLoading(false);
    }
  };

  if (!profile) return <div className="loading-screen"><div className="loading-spinner" /></div>;

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)', backgroundSize: '24px 24px', opacity: 0.6 }} />

      <div style={{ position: 'relative', width: '100%', maxWidth: 480, background: 'var(--surface)', borderRadius: 'var(--radius-lg)', boxShadow: '0 20px 60px rgba(0,0,0,0.12)', border: '1px solid var(--border)', overflow: 'hidden', animation: 'slideUp 300ms cubic-bezier(0.34,1.56,0.64,1)' }}>

        {/* Header */}
        <div style={{ background: 'var(--primary-dark)', padding: '24px 32px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 20, fontWeight: 700, color: '#fff', fontFamily: 'var(--font-heading)' }}>
            {profile.name[0]?.toUpperCase()}
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 17, color: '#fff' }}>Welcome, {profile.name.split(' ')[0]}!</div>
            <div style={{ fontSize: 12, color: 'rgba(148,163,184,0.85)', marginTop: 2 }}>{profile.email}</div>
          </div>
        </div>

        <div style={{ padding: '24px 32px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Name */}
          <div className="form-group">
            <label className="form-label">Your Name</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Full name" />
          </div>

          {/* Role selection */}
          <div>
            <div className="form-label" style={{ marginBottom: 10 }}>Select Your Role *</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ROLES.map(r => (
                <div
                  key={r.value}
                  onClick={() => handleRoleSelect(r.value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px', borderRadius: 'var(--radius-sm)',
                    border: `2px solid ${role === r.value ? r.color : 'var(--border)'}`,
                    background: role === r.value ? r.color + '08' : 'var(--surface)',
                    cursor: 'pointer', transition: 'all 150ms',
                  }}
                >
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: r.color + '15', color: r.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name={r.icon} size={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: role === r.value ? r.color : 'var(--text)' }}>{r.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{r.desc}</div>
                  </div>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${role === r.value ? r.color : 'var(--border)'}`, background: role === r.value ? r.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 150ms' }}>
                    {role === r.value && <Icon name="check" size={11} color="#fff" />}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Department — only show for workers */}
          {role && role !== 'admin' && (
            <div className="form-group" style={{ animation: 'slideUp 200ms ease' }}>
              <label className="form-label">Department</label>
              <select className="form-select" value={department} onChange={e => setDept(e.target.value)}>
                {DEPTS[role]?.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
              </select>
            </div>
          )}

          <button
            className="btn btn-primary"
            style={{ width: '100%', fontSize: 16, fontWeight: 600, padding: '14px', gap: 8 }}
            onClick={handleSubmit}
            disabled={loading || !role}
          >
            {loading ? <><div className="loading-spinner loading-spinner-sm" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} />Creating account…</> : <><Icon name="check" size={17} />Create Account</>}
          </button>
        </div>
      </div>
    </div>
  );
}
