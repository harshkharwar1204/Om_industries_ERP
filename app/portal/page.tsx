'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui';

export default function PortalLoginPage() {
  const [phone,    setPhone]    = useState('');
  const [passcode, setPasscode] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const router = useRouter();

  useEffect(() => {
    const token = sessionStorage.getItem('portal_token');
    if (token) router.replace('/portal/dashboard');
  }, []);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res  = await fetch('/api/portal/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, passcode }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Login failed'); return; }
      sessionStorage.setItem('portal_token',  data.token);
      sessionStorage.setItem('portal_client', JSON.stringify(data.client));
      router.replace('/portal/dashboard');
    } catch (err: any) { setError(err.message || 'Login failed'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: '#F8FAFC', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(#E2E8F0 1px, transparent 1px)', backgroundSize: '24px 24px', opacity: 0.6 }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 380, background: '#fff', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.1)', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <div style={{ background: '#475569', padding: '24px 28px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 48, height: 48, background: '#F97316', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="archive" size={26} color="#fff" />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18, color: '#fff', letterSpacing: '0.04em' }}>OM INDUSTRIES</div>
            <div style={{ fontSize: 12, color: 'rgba(148,163,184,0.85)', marginTop: 2 }}>Customer Portal</div>
          </div>
        </div>

        <form onSubmit={login} style={{ padding: '24px 28px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, border: '1px solid #FCA5A5' }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: '#64748B' }}>Registered Mobile Number</label>
            <div style={{ display: 'flex', border: '1.5px solid #E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
              <span style={{ padding: '11px 12px', background: '#F8FAFC', color: '#64748B', fontWeight: 600, borderRight: '1px solid #E2E8F0', fontSize: 14 }}>+91</span>
              <input type="tel" inputMode="numeric" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g,'').slice(0,10))} placeholder="10-digit number"
                style={{ flex: 1, border: 'none', padding: '11px 14px', fontSize: 16, outline: 'none', background: 'transparent', color: '#1E293B' }} autoComplete="tel" />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: '#64748B' }}>Passcode</label>
            <input type="password" inputMode="numeric" value={passcode} onChange={e => setPasscode(e.target.value.slice(0,6))} placeholder="Your access passcode"
              style={{ padding: '11px 14px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 18, fontFamily: 'var(--font-heading)', letterSpacing: '0.2em', outline: 'none', color: '#1E293B', textAlign: 'center' }} autoComplete="current-password" />
          </div>
          <button type="submit" disabled={loading}
            style={{ width: '100%', padding: '14px', background: '#F97316', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 16, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {loading ? 'Signing in…' : <><Icon name="log-out" size={17} color="#fff" /> View My Account</>}
          </button>
          <p style={{ textAlign: 'center', fontSize: 12, color: '#94A3B8' }}>Contact OM Industries for portal access</p>
        </form>
      </div>
    </div>
  );
}
