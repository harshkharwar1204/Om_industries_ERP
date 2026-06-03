'use client';
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export interface AuthUser {
  id: number;
  name: string;
  phone: string;
  role: string;
  department: string | null;
}

interface AuthCtx {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (phone: string, pin: string) => Promise<AuthUser>;
  logout: () => void;
  isAdmin: boolean;
  isWorker: boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem('erp_token');
    setToken(null);
    setUser(null);
  }, [token]);

  useEffect(() => {
    const stored = localStorage.getItem('erp_token');
    if (!stored) { setLoading(false); return; }
    setToken(stored);
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${stored}` } })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => setUser(d.user))
      .catch(() => { localStorage.removeItem('erp_token'); setToken(null); })
      .finally(() => setLoading(false));
  }, []);

  const login = async (phone: string, pin: string): Promise<AuthUser> => {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, pin }),
    });
    if (!r.ok) {
      const e = await r.json();
      throw new Error(e.error || 'Login failed');
    }
    const d = await r.json();
    localStorage.setItem('erp_token', d.token);
    setToken(d.token);
    setUser(d.user);
    return d.user;
  };

  return (
    <Ctx.Provider value={{
      user, token, loading, login, logout,
      isAdmin: user?.role === 'admin',
      isWorker: ['hanks_worker', 'coning_worker'].includes(user?.role ?? ''),
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
