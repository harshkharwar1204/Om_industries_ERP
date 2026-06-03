'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { Icon } from '@/components/ui';

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [msg, setMsg] = useState('');
  const router = useRouter();

  useEffect(() => {
    const handle = async () => {
      // Supabase writes the session to the URL hash — get it
      const { data: { session }, error } = await supabaseBrowser.auth.getSession();

      if (error || !session) {
        setStatus('error');
        setMsg(error?.message || 'Google sign-in failed. Try again.');
        return;
      }

      try {
        const res = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: session.access_token }),
        });
        const data = await res.json();
        if (!res.ok) {
          setStatus('error');
          setMsg(data.error || 'Auth failed');
          return;
        }
        localStorage.setItem('erp_token', data.token);
        router.replace(data.user.role === 'admin' ? '/admin/dashboard' : '/worker');
      } catch (e: any) {
        setStatus('error');
        setMsg(e.message || 'Auth failed');
      }
    };

    handle();
  }, [router]);

  if (status === 'error') {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div className="card" style={{ maxWidth: 400, width: '100%', margin: 24 }}>
          <div className="card-body" style={{ textAlign: 'center', padding: 32 }}>
            <Icon name="x-circle" size={48} color="var(--danger)" style={{ marginBottom: 16 }} />
            <h3 style={{ marginBottom: 8 }}>Sign-in failed</h3>
            <p className="text-secondary" style={{ marginBottom: 20, fontSize: 14 }}>{msg}</p>
            <a href="/login" className="btn btn-primary" style={{ display: 'inline-flex' }}>
              Back to Login
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="loading-screen">
      <div className="loading-spinner" />
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 8 }}>Signing you in…</p>
    </div>
  );
}
