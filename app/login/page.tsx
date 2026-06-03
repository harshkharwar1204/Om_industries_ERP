'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast, Icon } from '@/components/ui';
import { supabaseBrowser } from '@/lib/supabase-browser';

type Tab = 'phone' | 'google';

export default function LoginPage() {
  const [tab, setTab]         = useState<Tab>('phone');
  const [phone, setPhone]     = useState('');
  const [pin, setPin]         = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError]     = useState('');
  const { login } = useAuth();
  const router  = useRouter();
  const toast   = useToast();
  const pinRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

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

  const handleGoogleLogin = async () => {
    setGoogleLoading(true); setError('');
    try {
      const { error } = await supabaseBrowser.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) { setError(error.message); setGoogleLoading(false); }
      // On success, browser redirects to Google — no further action needed here
    } catch (e: any) {
      setError(e.message || 'Google sign-in failed');
      setGoogleLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, background: 'var(--bg)', position: 'relative', overflow: 'hidden',
    }}>
      {/* Background dots */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)', backgroundSize: '24px 24px', opacity: 0.6 }} />

      <div style={{
        position: 'relative', zIndex: 1, width: '100%', maxWidth: 400,
        background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06)',
        border: '1px solid var(--border)',
        animation: 'slideUp 300ms cubic-bezier(0.34,1.56,0.64,1)',
        overflow: 'hidden',
      }}>

        {/* Brand header */}
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
            <button
              key={id}
              onClick={() => { setTab(id); setError(''); }}
              style={{
                flex: 1, padding: '13px 8px', border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: tab === id ? 600 : 400,
                color: tab === id ? 'var(--accent)' : 'var(--text-secondary)',
                borderBottom: `2px solid ${tab === id ? 'var(--accent)' : 'transparent'}`,
                marginBottom: -1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                fontFamily: 'var(--font-body)',
                transition: 'all 150ms',
              }}
            >
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

          {/* — Phone + PIN tab — */}
          {tab === 'phone' && (
            <form onSubmit={handlePhoneLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div className="form-group">
                <label className="form-label">Mobile Number</label>
                <div style={{ display: 'flex', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', transition: 'border-color 150ms, box-shadow 150ms' }}
                  onFocusCapture={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 0 3px rgba(249,115,22,0.12)'; }}
                  onBlurCapture={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}>
                  <span style={{ padding: '11px 14px', background: 'var(--hover-bg)', color: 'var(--text-secondary)', fontSize: 15, fontWeight: 600, borderRight: '1px solid var(--border)', whiteSpace: 'nowrap' }}>+91</span>
                  <input
                    type="tel" inputMode="numeric" value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit number"
                    style={{ flex: 1, border: 'none', padding: '11px 14px', fontSize: 16, outline: 'none', fontFamily: 'var(--font-body)', background: 'transparent', color: 'var(--text)' }}
                    autoComplete="tel"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">4-Digit PIN</label>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                  {pin.map((digit, i) => (
                    <input
                      key={i} ref={pinRefs[i]}
                      type="password" inputMode="numeric" maxLength={1} value={digit}
                      onChange={e => handlePinChange(i, e.target.value)}
                      onKeyDown={e => handlePinKey(i, e)}
                      style={{ width: 60, height: 60, textAlign: 'center', fontSize: 28, fontWeight: 700, border: `2px solid ${digit ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--radius-sm)', background: digit ? 'var(--accent-light)' : 'var(--surface)', outline: 'none', color: 'var(--text)', fontFamily: 'var(--font-heading)', transition: 'border-color 150ms, background 150ms, box-shadow 150ms' }}
                      onFocus={e => { e.currentTarget.style.boxShadow = '0 0 0 3px rgba(249,115,22,0.18)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
                      onBlur={e => { if (!digit) { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--border)'; } }}
                      autoComplete="off"
                    />
                  ))}
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', fontSize: 16, fontWeight: 600, padding: '14px', gap: 8 }} disabled={loading}>
                {loading ? <><div className="loading-spinner loading-spinner-sm" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} /> Signing in…</> : <><Icon name="log-out" size={17} /> Sign In</>}
              </button>
            </form>
          )}

          {/* — Google tab — */}
          {tab === 'google' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.5 }}>
                Sign in with your Google account.<br />
                <span style={{ fontSize: 12 }}>Admin accounts only. Your Google email must be linked to an OM Industries admin profile.</span>
              </p>

              <button
                className="btn btn-secondary"
                style={{ width: '100%', fontSize: 15, fontWeight: 600, padding: '13px', gap: 12, justifyContent: 'center', position: 'relative' }}
                onClick={handleGoogleLogin}
                disabled={googleLoading}
              >
                {googleLoading ? (
                  <><div className="loading-spinner loading-spinner-sm" /> Redirecting to Google…</>
                ) : (
                  <>
                    {/* Google 'G' icon */}
                    <svg width="20" height="20" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Continue with Google
                  </>
                )}
              </button>

              <p style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>
                Workers use the Phone + PIN tab
              </p>
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
