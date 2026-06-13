'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast, Icon } from '@/components/ui';

type Tab  = 'phone' | 'google';
type Mode = 'login' | 'register';

const WORKER_ROLES = [
  { value: 'hanks_worker',  label: 'Hanks Worker',   icon: 'factory', color: 'var(--accent)' },
  { value: 'coning_worker', label: 'Coning Worker',  icon: 'box',     color: 'var(--info)' },
  { value: 'dyeing_master', label: 'Dyeing Master',  icon: 'droplets',color: 'var(--primary)' },
];

declare global {
  interface Window {
    google?: { accounts: { id: { initialize: (c: any) => void; prompt: () => void } } };
  }
}

const BLANK_REG = { name: '', phone: '', role: '', department: '' };

// Module-scope so it isn't recreated each render (which would remount inputs and break auto-advance).
function PinRow({ value, refs, onChange, onKey }: { value: string[]; refs: React.RefObject<HTMLInputElement | null>[]; onChange: (i: number, v: string) => void; onKey: (i: number, e: React.KeyboardEvent) => void }) {
  return (
    <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
      {value.map((digit, i) => (
        <input key={i} ref={refs[i]} type="password" inputMode="numeric" maxLength={1} value={digit}
          onChange={e => onChange(i, e.target.value)} onKeyDown={e => onKey(i, e)}
          style={{ width: 60, height: 60, textAlign: 'center', fontSize: 28, fontWeight: 700, border: `2px solid ${digit ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--radius-sm)', background: digit ? 'var(--accent-light)' : 'var(--surface)', outline: 'none', color: 'var(--text)', fontFamily: 'var(--font-heading)', transition: 'border-color 150ms, background 150ms' }}
          onFocus={e => { e.currentTarget.style.boxShadow = '0 0 0 3px rgba(249,115,22,0.18)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onBlur={e => { if (!digit) { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--border)'; } }}
          autoComplete="off" />
      ))}
    </div>
  );
}

export default function LoginPage() {
  const [tab, setTab]         = useState<Tab>('phone');
  const [mode, setMode]       = useState<Mode>('login');
  const [phone, setPhone]     = useState('');
  const [pin, setPin]         = useState(['', '', '', '']);
  const [reg, setReg]         = useState(BLANK_REG);
  const [regPin, setRegPin]   = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [googleReady, setGoogleReady] = useState(false);

  const { login, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const toast  = useToast();

  const pinRefs    = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
  const regPinRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!authLoading && user) {
      router.replace(['admin', 'dyeing_master'].includes(user.role) ? '/admin/dashboard' : '/worker');
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (tab !== 'google' || !CLIENT_ID) return;
    const init = () => {
      if (!window.google) return;
      window.google.accounts.id.initialize({ client_id: CLIENT_ID, callback: handleGoogleCredential, auto_select: false });
      setGoogleReady(true);
    };
    if (window.google) { init(); return; }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true; s.defer = true; s.onload = init;
    document.head.appendChild(s);
  }, [tab, CLIENT_ID]);

  const handleGoogleCredential = async (response: { credential: string }) => {
    setLoading(true); setError('');
    try {
      const res  = await fetch('/api/auth/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential: response.credential }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Sign-in failed'); setLoading(false); return; }
      if (data.isNew) {
        sessionStorage.setItem('google_onboarding', JSON.stringify({ credential: response.credential, profile: data.profile }));
        router.replace('/onboarding'); return;
      }
      localStorage.setItem('erp_token', data.token);
      window.location.href = ['admin', 'dyeing_master'].includes(data.user.role) ? '/admin/dashboard' : '/worker';
    } catch (e: any) { setError(e.message || 'Sign-in failed'); setLoading(false); }
  };

  const handlePinChange = (i: number, v: string, refs: React.RefObject<HTMLInputElement | null>[], setter: (p: string[]) => void, current: string[]) => {
    const digit = v.replace(/\D/g, '').slice(-1);
    const next  = [...current]; next[i] = digit; setter(next);
    if (digit && i < 3) refs[i + 1].current?.focus();
    if (!digit && i > 0) refs[i - 1].current?.focus();
  };

  const handlePinKey = (i: number, e: React.KeyboardEvent, refs: React.RefObject<HTMLInputElement | null>[], current: string[]) => {
    if (e.key === 'Backspace' && !current[i] && i > 0) refs[i - 1].current?.focus();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const pinStr = pin.join('');
    if (!phone || pinStr.length < 4) { setError('Enter phone number and 4-digit PIN'); return; }
    setLoading(true); setError('');
    try {
      const u = await login(phone.trim(), pinStr);
      toast(`Welcome, ${u.name}!`);
      router.replace(['admin', 'dyeing_master'].includes(u.role) ? '/admin/dashboard' : '/worker');
    } catch (err: any) { setError(err.message || 'Login failed'); }
    finally { setLoading(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const pinStr = regPin.join('');
    if (!reg.name.trim())    { setError('Enter your name'); return; }
    if (reg.phone.length < 10) { setError('Enter 10-digit phone number'); return; }
    if (pinStr.length < 4)   { setError('Enter a 4-digit PIN'); return; }
    if (!reg.role)           { setError('Select your role'); return; }
    setLoading(true); setError('');
    try {
      const res  = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...reg, pin: pinStr }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Registration failed'); return; }
      toast(`Account created! Welcome, ${data.user.name}`);
      localStorage.setItem('erp_token', data.token);
      window.location.href = ['admin', 'dyeing_master'].includes(data.user.role) ? '/admin/dashboard' : '/worker';
    } catch (err: any) { setError(err.message || 'Registration failed'); }
    finally { setLoading(false); }
  };

  const switchMode = (m: Mode) => { setMode(m); setError(''); setPin(['','','','']); setRegPin(['','','','']); setPhone(''); setReg(BLANK_REG); };

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'var(--bg)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)', backgroundSize: '24px 24px', opacity: 0.6 }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 400, background: 'var(--surface)', borderRadius: 'var(--radius-lg)', boxShadow: '0 20px 60px rgba(0,0,0,0.12)', border: '1px solid var(--border)', animation: 'slideUp 300ms cubic-bezier(0.34,1.56,0.64,1)', overflow: 'hidden' }}>

        {/* Brand */}
        <div style={{ background: 'var(--primary-dark)', padding: '20px 32px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 48, height: 48, background: 'var(--accent)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(249,115,22,0.4)' }}>
            <Icon name="factory" size={26} color="#fff" />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18, color: '#fff', letterSpacing: '0.04em' }}>OM INDUSTRIES</div>
            <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.85)', marginTop: 2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>ERP System · Hanks Unit</div>
          </div>
        </div>

        {/* Tabs (only shown in login mode) */}
        {mode === 'login' && (
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
            {(['phone', 'google'] as Tab[]).map(t => (
              <button key={t} onClick={() => { setTab(t); setError(''); }}
                style={{ flex: 1, padding: '12px 8px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, fontWeight: tab === t ? 600 : 400, color: tab === t ? 'var(--accent)' : 'var(--text-secondary)', borderBottom: `2px solid ${tab === t ? 'var(--accent)' : 'transparent'}`, marginBottom: -1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontFamily: 'var(--font-body)', transition: 'all 150ms' }}>
                <Icon name={t === 'phone' ? 'phone' : 'user'} size={14} />
                {t === 'phone' ? 'Phone + PIN' : 'Google'}
              </button>
            ))}
          </div>
        )}

        {/* Register mode header */}
        {mode === 'register' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--hover-bg)' }}>
            <button onClick={() => switchMode('login')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: 4, borderRadius: 6 }}>
              <Icon name="chevron-left" size={20} />
            </button>
            <span style={{ fontWeight: 600, fontSize: 15 }}>Create Worker Account</span>
          </div>
        )}

        <div style={{ padding: '20px 24px 24px', maxHeight: '75vh', overflowY: 'auto' }}>
          {error && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'var(--danger-light)', color: 'var(--danger)', padding: '11px 14px', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 500, border: '1px solid #FCA5A5', marginBottom: 16 }}>
              <Icon name="alert-circle" size={15} color="var(--danger)" style={{ flexShrink: 0, marginTop: 1 }} />
              {error}
            </div>
          )}

          {/* ── LOGIN: Phone+PIN ── */}
          {mode === 'login' && tab === 'phone' && (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                <PinRow value={pin} refs={pinRefs} onChange={(i, v) => handlePinChange(i, v, pinRefs, setPin, pin)} onKey={(i, e) => handlePinKey(i, e, pinRefs, pin)} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', fontSize: 16, fontWeight: 600, padding: '14px', gap: 8 }} disabled={loading}>
                {loading ? <><div className="loading-spinner loading-spinner-sm" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} />Signing in…</> : <><Icon name="log-out" size={17} />Sign In</>}
              </button>
              <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                New worker?{' '}
                <button type="button" onClick={() => switchMode('register')} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontSize: 13, padding: 0, fontFamily: 'var(--font-body)' }}>
                  Create account
                </button>
              </p>
            </form>
          )}

          {/* ── LOGIN: Google ── */}
          {mode === 'login' && tab === 'google' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {!CLIENT_ID ? (
                <div style={{ background: 'var(--warning-light)', color: '#92400E', padding: '14px 16px', borderRadius: 'var(--radius-sm)', fontSize: 13, border: '1px solid #FCD34D', textAlign: 'center', lineHeight: 1.6 }}>
                  <strong>NEXT_PUBLIC_GOOGLE_CLIENT_ID</strong> not set. Add to <code>.env</code> and restart.
                </div>
              ) : (
                <>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.5 }}>
                    Sign in with Google. First time? You'll choose your role — Admin or Worker.
                  </p>
                  <button onClick={() => window.google?.accounts.id.prompt()} disabled={loading || !googleReady}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '13px 20px', fontSize: 15, fontWeight: 500, background: '#fff', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: loading || !googleReady ? 'not-allowed' : 'pointer', opacity: loading || !googleReady ? 0.7 : 1, fontFamily: 'var(--font-body)', color: 'var(--text)', transition: 'border-color 150ms', boxShadow: 'var(--shadow-sm)' }}
                    onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.borderColor = '#4285F4'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; }}>
                    {loading ? (
                      <><div className="loading-spinner loading-spinner-sm" style={{ borderTopColor: '#4285F4', borderColor: 'rgba(66,133,244,0.2)' }} />Signing in…</>
                    ) : (
                      <>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        Continue with Google
                      </>
                    )}
                  </button>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>Works for admins and workers</p>
                </>
              )}
            </div>
          )}

          {/* ── REGISTER ── */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input className="form-input" value={reg.name} onChange={e => setReg(p => ({ ...p, name: e.target.value }))} placeholder="Your full name" style={{ fontSize: 16 }} autoComplete="name" />
              </div>
              <div className="form-group">
                <label className="form-label">Mobile Number *</label>
                <div style={{ display: 'flex', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', transition: 'border-color 150ms, box-shadow 150ms' }}
                  onFocusCapture={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 0 3px rgba(249,115,22,0.12)'; }}
                  onBlurCapture={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}>
                  <span style={{ padding: '11px 14px', background: 'var(--hover-bg)', color: 'var(--text-secondary)', fontSize: 15, fontWeight: 600, borderRight: '1px solid var(--border)', whiteSpace: 'nowrap' }}>+91</span>
                  <input type="tel" inputMode="numeric" value={reg.phone} onChange={e => setReg(p => ({ ...p, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))} placeholder="10-digit number"
                    style={{ flex: 1, border: 'none', padding: '11px 14px', fontSize: 16, outline: 'none', fontFamily: 'var(--font-body)', background: 'transparent', color: 'var(--text)' }} autoComplete="tel" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Set 4-Digit PIN *</label>
                <PinRow value={regPin} refs={regPinRefs} onChange={(i, v) => handlePinChange(i, v, regPinRefs, setRegPin, regPin)} onKey={(i, e) => handlePinKey(i, e, regPinRefs, regPin)} />
              </div>
              <div className="form-group">
                <label className="form-label">Your Role *</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {WORKER_ROLES.map(r => (
                    <div key={r.value} onClick={() => setReg(p => ({ ...p, role: r.value, department: r.value === 'dyeing_master' ? 'dyeing' : r.value === 'coning_worker' ? 'coning' : 'hanks' }))}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: `2px solid ${reg.role === r.value ? r.color : 'var(--border)'}`, background: reg.role === r.value ? r.color + '08' : 'var(--surface)', cursor: 'pointer', transition: 'all 150ms' }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: r.color + '15', color: r.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon name={r.icon} size={18} />
                      </div>
                      <span style={{ fontWeight: reg.role === r.value ? 600 : 400, color: reg.role === r.value ? r.color : 'var(--text)', fontSize: 14 }}>{r.label}</span>
                      <div style={{ marginLeft: 'auto', width: 18, height: 18, borderRadius: '50%', border: `2px solid ${reg.role === r.value ? r.color : 'var(--border)'}`, background: reg.role === r.value ? r.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {reg.role === r.value && <Icon name="check" size={10} color="#fff" />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', fontSize: 16, fontWeight: 600, padding: '14px', gap: 8, marginTop: 4 }} disabled={loading}>
                {loading ? <><div className="loading-spinner loading-spinner-sm" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} />Creating account…</> : <><Icon name="check" size={17} />Create Account</>}
              </button>
              <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
                Already have an account?{' '}
                <button type="button" onClick={() => switchMode('login')} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontSize: 13, padding: 0, fontFamily: 'var(--font-body)' }}>
                  Sign in
                </button>
              </p>
            </form>
          )}
        </div>

        <div style={{ textAlign: 'center', padding: '0 24px 16px', fontSize: 12, color: 'var(--primary-light)' }}>
          OM Industries ERP v2.0 · Surat, Gujarat
        </div>
      </div>
    </div>
  );
}
