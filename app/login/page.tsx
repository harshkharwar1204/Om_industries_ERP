'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast, Icon } from '@/components/ui';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const pinRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  const handlePinChange = (i: number, v: string) => {
    const digit = v.replace(/\D/g, '').slice(-1);
    const next = [...pin];
    next[i] = digit;
    setPin(next);
    if (digit && i < 3) pinRefs[i + 1].current?.focus();
    if (!digit && i > 0) pinRefs[i - 1].current?.focus();
  };

  const handlePinKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[i] && i > 0) {
      pinRefs[i - 1].current?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pinStr = pin.join('');
    if (!phone || pinStr.length < 4) { setError('Enter phone number and complete 4-digit PIN'); return; }
    setLoading(true);
    setError('');
    try {
      const user = await login(phone.trim(), pinStr);
      toast(`Welcome, ${user.name}!`);
      router.replace(user.role === 'admin' ? '/admin/dashboard' : '/worker');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      background: 'var(--bg)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background texture */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        opacity: 0.6,
      }} />

      {/* Card */}
      <div style={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: 400,
        background: 'var(--surface)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06)',
        border: '1px solid var(--border)',
        animation: 'slideUp 300ms cubic-bezier(0.34,1.56,0.64,1)',
        overflow: 'hidden',
      }}>
        {/* Brand header */}
        <div style={{
          background: 'var(--primary-dark)',
          padding: '28px 32px 24px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 56, height: 56,
            background: 'var(--accent)',
            borderRadius: 'var(--radius-md)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(249,115,22,0.4)',
          }}>
            <Icon name="factory" size={28} color="#fff" />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 20,
              color: '#fff', letterSpacing: '0.04em',
            }}>
              OM INDUSTRIES
            </div>
            <div style={{ fontSize: 12, color: 'rgba(148,163,184,0.85)', marginTop: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              ERP System · Hanks Unit
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '28px 32px 32px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'var(--danger-light)', color: 'var(--danger)',
                padding: '12px 16px', borderRadius: 'var(--radius-sm)',
                fontSize: 14, fontWeight: 500,
                border: '1px solid #FCA5A5',
                animation: 'slideUp 200ms ease',
              }}>
                <Icon name="alert-circle" size={16} color="var(--danger)" style={{ flexShrink: 0 }} />
                {error}
              </div>
            )}

            {/* Phone */}
            <div className="form-group">
              <label className="form-label">Mobile Number</label>
              <div style={{
                display: 'flex', border: '1.5px solid var(--border)',
                borderRadius: 'var(--radius-sm)', overflow: 'hidden',
                transition: 'border-color 150ms, box-shadow 150ms',
              }}
                onFocusCapture={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 0 3px rgba(249,115,22,0.12)'; }}
                onBlurCapture={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
              >
                <span style={{
                  padding: '11px 14px', background: 'var(--hover-bg)',
                  color: 'var(--text-secondary)', fontSize: 15, fontWeight: 600,
                  borderRight: '1px solid var(--border)', whiteSpace: 'nowrap',
                }}>
                  +91
                </span>
                <input
                  type="tel" inputMode="numeric" value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit number"
                  style={{
                    flex: 1, border: 'none', padding: '11px 14px',
                    fontSize: 16, outline: 'none',
                    fontFamily: 'var(--font-body)', background: 'transparent',
                    color: 'var(--text)',
                  }}
                  autoComplete="tel"
                />
              </div>
            </div>

            {/* PIN */}
            <div className="form-group">
              <label className="form-label">4-Digit PIN</label>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                {pin.map((digit, i) => (
                  <input
                    key={i}
                    ref={pinRefs[i]}
                    type="password"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handlePinChange(i, e.target.value)}
                    onKeyDown={e => handlePinKeyDown(i, e)}
                    style={{
                      width: 60, height: 60,
                      textAlign: 'center', fontSize: 28, fontWeight: 700,
                      border: `2px solid ${digit ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-sm)',
                      background: digit ? 'var(--accent-light)' : 'var(--surface)',
                      outline: 'none', color: 'var(--text)',
                      fontFamily: 'var(--font-heading)',
                      transition: 'border-color 150ms, background 150ms, box-shadow 150ms',
                    }}
                    onFocus={e => { e.currentTarget.style.boxShadow = '0 0 0 3px rgba(249,115,22,0.18)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
                    onBlur={e => { if (!digit) { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--border)'; } }}
                    autoComplete="off"
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', fontSize: 16, fontWeight: 600, padding: '14px', marginTop: 4 }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="loading-spinner loading-spinner-sm" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} />
                  Signing in…
                </>
              ) : (
                <>
                  <Icon name="log-out" size={18} />
                  Sign In
                </>
              )}
            </button>
          </div>
        </form>

        <div style={{
          textAlign: 'center', padding: '0 32px 20px',
          fontSize: 12, color: 'var(--primary-light)',
        }}>
          OM Industries ERP v2.0 · Surat, Gujarat
        </div>
      </div>
    </div>
  );
}
