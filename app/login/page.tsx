'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast, Icon } from '@/components/ui';

type Tab = 'phone' | 'google';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (el: HTMLElement, opts: any) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export default function LoginPage() {
  const [tab, setTab]         = useState<Tab>('phone');
  const [phone, setPhone]     = useState('');
  const [pin, setPin]         = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const { login } = useAuth();
  const router  = useRouter();
  const toast   = useToast();
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const pinRefs = [
    useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null),
  ];

  const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  // Load & init Google GSI
  useEffect(() => {
    if (tab !== 'google' || !CLIENT_ID) return;

    const initGoogle = () => {
      if (!window.google || !googleBtnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: handleGoogleCredential,
        auto_select: false,
      });
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline', size: 'large', width: 336,
        text: 'continue_with', shape: 'rectangular',
      });
    };

    if (window.google) { initGoogle(); return; }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initGoogle;
    document.head.appendChild(script);
  }, [tab, CLIENT_ID]);

  const handleGoogleCredential = async (response: { credential: string }) => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Sign-in failed'); setLoading(false); return; }
      localStorage.setItem('erp_token', data.token);
      toast(`Welcome, ${data.user.name}!`);
      router.replace(data.user.role === 'admin' ? '/admin/dashboard' : '/worker');
    } catch (e: any) {
      setError(e.message || 'Sign-in failed');
      setLoading(false);
    }
  };

  const handlePinChange = (i: number, v: string) => {
    const digit = v.replace(/\D/g, '').slice(-1);
    const next  = [...pin]; next[i] = digit; setPin(next);
    if (digit && i < 3) pinRefs[i + 1].current?.focus();
    if (!digit && i > 0) pinRefs[i - 1].current?.focus();
  };

  const handlePinKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[i] && i > 0) pinRefs[i - 1].current?.focus();
  };

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const pinStr = pin.join('');
    if (!phone || pinStr.length < 4) { setError('Enter phone number and 4-digit PIN'); return; }
    setLoading(true); setError('');
    try {
      const user = await login(phone.trim(), pinStr);
      toast(`Welcome, ${user.name}!`);
      router.replace(user.role === 'admin' ? '/admin/dashboard' : '/worker');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, background: 'var(--bg)', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)', backgroundSize: '24px 24px', opacity: 0.6 }} />

      <div style={{
        position: 'relative', zIndex: 1, width: '100%', maxWidth: 400,
        background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06)',
        border: '1px solid var(--border)',
        animation: 'slideUp 300ms cubic-bezier(0.34,1.56,0.64,1)',
        overflow: 'hidden',
      }}>

        {/* Brand */}
        <div style={{ background: 'var(--primary-dark)', padding: '24px 32px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 52, height: 52, background: 'var(--accent)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(249,115,22,0.4)' }}>
            <Icon name="factory" size={28} color="#fff" />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 19, color: '#fff', letterSpacing: '0.04em' }}>OM INDUSTRIES</div>
            <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.85)', marginTop: 3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>ERP System · Hanks Unit</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {([['phone', 'phone', 'Phone + PIN'], ['google', 'user', 'Google']] as [Tab, string, string][]).map(([id, icon, label]) => (
            <button key={id} onClick={() => { setTab(id); setError(''); }}
              style={{ flex: 1, padding: '13px 8px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, fontWeight: tab === id ? 600 : 400, color: tab === id ? 'var(--accent)' : 'var(--text-secondary)', borderBottom: `2px solid ${tab === id ? 'var(--accent)' : 'transparent'}`, marginBottom: -1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontFamily: 'var(--font-body)', transition: 'all 150ms' }}>
              <Icon name={icon} size={15} /> {label}
            </button>
          ))}
        </div>

        <div style={{ padding: '24px 32px 28px' }}>
          {/* Error */}
          {error && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'var(--danger-light)', color: 'var(--danger)', padding: '11px 14px', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 500, border: '1px solid #FCA5A5', marginBottom: 18, animation: 'slideUp 200ms ease' }}>
              <Icon name="alert-circle" size={15} color="var(--danger)" style={{ flexShrink: 0, marginTop: 1 }} />
              {error}
            </div>
          )}

          {/* Phone + PIN */}
          {tab === 'phone' && (
            <form onSubmit={handlePhoneLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div className="form-group">
                <label className="form-label">Mobile Number</label>
                <div style={{ display: 'flex', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', transition: 'border-color 150ms, box-shadow 150ms' }}
                  onFocusCapture={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 0 3px rgba(249,115,22,0.12)'; }}
                  onBlurCapture={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}>
                  <span style={{ padding: '11px 14px', background: 'var(--hover-bg)', color: 'var(--text-secondary)', fontSize: 15, fontWeight: 600, borderRight: '1px solid var(--border)', whiteSpace: 'nowrap' }}>+91</span>
                  <input type="tel" inputMode="numeric" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit number"
                    style={{ flex: 1, border: 'none', padding: '11px 14px', fontSize: 16, outline: 'none', fontFamily: 'var(--font-body)', background: 'transparent', color: 'var(--text)' }} autoComplete="tel" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">4-Digit PIN</label>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                  {pin.map((digit, i) => (
                    <input key={i} ref={pinRefs[i]} type="password" inputMode="numeric" maxLength={1} value={digit}
                      onChange={e => handlePinChange(i, e.target.value)} onKeyDown={e => handlePinKey(i, e)}
                      style={{ width: 60, height: 60, textAlign: 'center', fontSize: 28, fontWeight: 700, border: `2px solid ${digit ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--radius-sm)', background: digit ? 'var(--accent-light)' : 'var(--surface)', outline: 'none', color: 'var(--text)', fontFamily: 'var(--font-heading)', transition: 'border-color 150ms, background 150ms, box-shadow 150ms' }}
                      onFocus={e => { e.currentTarget.style.boxShadow = '0 0 0 3px rgba(249,115,22,0.18)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
                      onBlur={e => { if (!digit) { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--border)'; } }}
                      autoComplete="off" />
                  ))}
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', fontSize: 16, fontWeight: 600, padding: '14px', gap: 8 }} disabled={loading}>
                {loading ? <><div className="loading-spinner loading-spinner-sm" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} />Signing in…</> : <><Icon name="log-out" size={17} />Sign In</>}
              </button>
            </form>
          )}

          {/* Google */}
          {tab === 'google' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center' }}>
              {!CLIENT_ID ? (
                <div style={{ background: 'var(--warning-light)', color: '#92400E', padding: '14px 16px', borderRadius: 'var(--radius-sm)', fontSize: 13, border: '1px solid #FCD34D', textAlign: 'center', lineHeight: 1.6 }}>
                  <strong>NEXT_PUBLIC_GOOGLE_CLIENT_ID</strong> not set.<br />
                  Add it to <code>.env</code> and restart the dev server.
                </div>
              ) : (
                <>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.5 }}>
                    Sign in with Google. New users get an admin account automatically. Workers need to be added by admin first.
                  </p>
                  {loading ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-secondary)', fontSize: 14 }}>
                      <div className="loading-spinner loading-spinner-sm" /> Signing in…
                    </div>
                  ) : (
                    <div ref={googleBtnRef} />
                  )}
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Works for admins and workers (if Gmail was set by admin)</p>
                </>
              )}
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', padding: '0 32px 18px', fontSize: 12, color: 'var(--primary-light)' }}>
          OM Industries ERP v2.0 · Surat, Gujarat
        </div>
      </div>
    </div>
  );
}
