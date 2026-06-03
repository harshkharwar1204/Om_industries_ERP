# Next.js ERP Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Vite React + Express with a Next.js 14 App Router app using the Claude Design prototype screens, wired to real Supabase data via Next.js API routes.

**Architecture:** App Router with route groups `(admin)` and `(worker)`. All pages are Client Components (interactive). API routes in `app/api/` replace `server/`. Auth is JWT stored in localStorage; middleware does presence-check redirect; full validation happens per API route. Only screens with real backend support are built now (Login, Dashboard, Hanks, Stock Inward, Masters, Advances, Payroll, Recipes).

**Tech Stack:** Next.js 14, React 18, TypeScript (.tsx), Supabase JS v2, bcryptjs, jsonwebtoken, exceljs

**Source designs live in:** `erp/project/` — reference these files when porting each screen.

---

### Task 1: Initialize Next.js, Remove Vite

**Files:**
- Modify: `package.json`
- Create: `next.config.mjs`
- Create: `tsconfig.json`
- Delete: `vite.config.js` (after verified)

- [ ] **Step 1: Install Next.js, remove Vite**

```bash
npm install next@14 react@18 react-dom@18
npm install -D typescript @types/node @types/react @types/react-dom
npm uninstall vite @vitejs/plugin-react
```

- [ ] **Step 2: Update `package.json` scripts**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  }
}
```

- [ ] **Step 3: Create `next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {};
export default nextConfig;
```

- [ ] **Step 4: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "es2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": false,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 5: Create placeholder `app/page.tsx` to confirm Next.js boots**

```tsx
export default function Page() { return <div>Loading...</div>; }
```

- [ ] **Step 6: Run dev server**

```bash
npm run dev
```

Expected: Server starts on http://localhost:3000, no errors.

- [ ] **Step 7: Delete `vite.config.js`**

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: migrate from Vite to Next.js 14"
```

---

### Task 2: Design System CSS + Root Layout

**Files:**
- Create: `app/globals.css`
- Create: `app/layout.tsx`

- [ ] **Step 1: Copy design CSS to `app/globals.css`**

Copy the full contents of `erp/project/styles.css` verbatim into `app/globals.css`.

- [ ] **Step 2: Create `app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'OM INDUSTRIES ERP',
  description: 'OM INDUSTRIES - Hanks Unit Production & Salary ERP, Surat',
  themeColor: '#64748B',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Fira+Sans:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="OM ERP" />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Verify fonts load**

Run `npm run dev`, open http://localhost:3000 — page should use Fira Sans.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css app/layout.tsx
git commit -m "feat: add design system CSS and root layout"
```

---

### Task 3: Lib Files — Supabase, Auth, API Fetch

**Files:**
- Create: `lib/supabase.ts`
- Create: `lib/auth.ts`
- Create: `lib/api.ts`

- [ ] **Step 1: Install server dependencies**

```bash
npm install @supabase/supabase-js bcryptjs jsonwebtoken exceljs
npm install -D @types/bcryptjs @types/jsonwebtoken
```

- [ ] **Step 2: Create `lib/supabase.ts`**

```ts
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_KEY!;

if (!url || !key) throw new Error('Missing Supabase env vars');

export const supabase = createClient(url, key);
```

- [ ] **Step 3: Create `lib/auth.ts`**

```ts
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

export const JWT_SECRET = process.env.JWT_SECRET || 'om-industries-erp-secret-key-2024';

export interface JWTPayload {
  id: number;
  name: string;
  phone: string;
  role: string;
  department: string | null;
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

export function getToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.split(' ')[1];
}

export function requireAuth(req: NextRequest): JWTPayload {
  const token = getToken(req);
  if (!token) throw new Error('No token');
  return verifyToken(token);
}

export function requireAdmin(req: NextRequest): JWTPayload {
  const user = requireAuth(req);
  if (user.role !== 'admin') throw new Error('Admin required');
  return user;
}

export function requireWorker(req: NextRequest): JWTPayload {
  const user = requireAuth(req);
  if (!['hanks_worker', 'coning_worker'].includes(user.role)) throw new Error('Worker required');
  return user;
}
```

- [ ] **Step 4: Create `lib/api.ts` (client-side fetch helper)**

```ts
'use client';

const BASE = '/api';

function headers() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('erp_token') : null;
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export async function apiFetch(url: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE}${url}`, {
    ...options,
    headers: { ...headers(), ...(options.headers as Record<string, string>) },
  });
  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('erp_token');
      window.location.href = '/login';
    }
    throw new Error('Session expired');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  const ct = res.headers.get('content-type');
  if (ct?.includes('spreadsheetml')) return res.blob();
  return res.json();
}
```

- [ ] **Step 5: Ensure `.env` has correct keys**

```
SUPABASE_URL=https://bbprchdwdckqeujhzrtd.supabase.co
SUPABASE_KEY=<anon key>
JWT_SECRET=om-industries-erp-secret-key-2024
```

Note: Next.js server-side env vars do NOT need `VITE_` prefix. Keep `VITE_` vars for any remaining legacy code during transition.

- [ ] **Step 6: Commit**

```bash
git add lib/
git commit -m "feat: add supabase client, auth utilities, api fetch helper"
```

---

### Task 4: Auth Context + Root Page

**Files:**
- Create: `context/AuthContext.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`
- Create: `middleware.ts`

- [ ] **Step 1: Create `context/AuthContext.tsx`**

```tsx
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
      fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
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
      .catch(() => { localStorage.removeItem('erp_token'); })
      .finally(() => setLoading(false));
  }, []);

  const login = async (phone: string, pin: string): Promise<AuthUser> => {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, pin }),
    });
    if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Login failed'); }
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
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
```

- [ ] **Step 2: Update `app/layout.tsx` — wrap body in AuthProvider**

```tsx
import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';

export const metadata: Metadata = {
  title: 'OM INDUSTRIES ERP',
  description: 'OM INDUSTRIES - Hanks Unit Production & Salary ERP, Surat',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Fira+Sans:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="OM ERP" />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Update `app/page.tsx` — root redirect**

```tsx
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function RootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login'); return; }
    router.replace(user.role === 'admin' ? '/admin/dashboard' : '/worker');
  }, [user, loading, router]);

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div className="loading-spinner" />
    </div>
  );
}
```

- [ ] **Step 4: Create `middleware.ts`**

```ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// JWT lives in localStorage, not cookies — middleware can only do a soft check.
// Hard auth validation happens inside each API route via lib/auth.ts.
export function middleware(req: NextRequest) {
  return NextResponse.next();
}

export const config = { matcher: [] };
```

- [ ] **Step 5: Verify**

`npm run dev` → http://localhost:3000 should redirect to `/login` (no token in localStorage).

- [ ] **Step 6: Commit**

```bash
git add context/ middleware.ts app/layout.tsx app/page.tsx
git commit -m "feat: auth context, root redirect, layout provider"
```

---

### Task 5: Auth API Routes

Port `server/routes/auth.cjs` to Next.js route handlers.

**Files:**
- Create: `app/api/auth/login/route.ts`
- Create: `app/api/auth/me/route.ts`
- Create: `app/api/auth/logout/route.ts`

- [ ] **Step 1: Create `app/api/auth/login/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '@/lib/supabase';
import { JWT_SECRET } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { phone, pin } = await req.json();
    if (!phone || !pin) return NextResponse.json({ error: 'Phone and PIN required' }, { status: 400 });

    const { data: user, error } = await supabase
      .from('erp_users').select('*').eq('phone', phone.trim()).single();

    if (error || !user) return NextResponse.json({ error: 'Invalid phone or PIN' }, { status: 401 });
    if (!user.is_active) return NextResponse.json({ error: 'Account deactivated. Contact admin.' }, { status: 403 });

    const valid = await bcrypt.compare(pin, user.pin_hash);
    if (!valid) return NextResponse.json({ error: 'Invalid phone or PIN' }, { status: 401 });

    const payload = { id: user.id, name: user.name, phone: user.phone, role: user.role, department: user.department };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await supabase.from('sessions').insert([{ user_id: user.id, token, expires_at: expiresAt.toISOString() }]);

    return NextResponse.json({ token, user: payload });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create `app/api/auth/me/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const decoded = requireAuth(req);
    const { data: user, error } = await supabase
      .from('erp_users')
      .select('id, name, phone, role, department, is_active')
      .eq('id', decoded.id).single();
    if (error || !user || !user.is_active) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
```

- [ ] **Step 3: Create `app/api/auth/logout/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const token = getToken(req);
  if (token) await supabase.from('sessions').delete().eq('token', token);
  return NextResponse.json({ message: 'Logged out' });
}
```

- [ ] **Step 4: Test login endpoint**

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"YOUR_PHONE","pin":"YOUR_PIN"}'
```

Expected: `{"token":"eyJ...","user":{...}}`

- [ ] **Step 5: Commit**

```bash
git add app/api/auth/
git commit -m "feat: auth API routes (login, me, logout)"
```

---

### Task 6: Core UI Components

Port `erp/project/core.jsx` into typed React modules.

**Files:**
- Create: `components/ui/Icon.tsx`
- Create: `components/ui/Toast.tsx`
- Create: `components/ui/StatusBadge.tsx`
- Create: `components/ui/StatCard.tsx`
- Create: `components/ui/Modal.tsx`
- Create: `components/ui/PageHeader.tsx`
- Create: `components/ui/SearchableDropdown.tsx`
- Create: `components/ui/index.ts`

- [ ] **Step 1: Create `components/ui/Icon.tsx`**

Open `erp/project/core.jsx`. Copy the entire `ICON_PATHS` object and `Icon` function. Convert to a proper module:

```tsx
'use client';

const ICON_PATHS: Record<string, string> = {
  // Paste entire ICON_PATHS from erp/project/core.jsx here
  'layout-dashboard': '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  // ... all other paths ...
};

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function Icon({ name, size = 20, color, strokeWidth = 2, className = '', style = {} }: IconProps) {
  const paths = ICON_PATHS[name];
  if (!paths) return <span style={{ width: size, height: size, display: 'inline-block', ...style }} />;
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color || 'currentColor'} strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round"
      className={className} style={{ flexShrink: 0, ...style }}
      dangerouslySetInnerHTML={{ __html: paths }}
    />
  );
}
```

- [ ] **Step 2: Create `components/ui/Toast.tsx`**

```tsx
'use client';
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Icon } from './Icon';

type ToastType = 'success' | 'error';
interface ToastItem { id: number; msg: string; type: ToastType; }
type AddToast = (msg: string, type?: ToastType) => void;

const ToastCtx = createContext<AddToast>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const addToast = useCallback((msg: string, type: ToastType = 'success') => {
    const id = Date.now();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
  }, []);
  return (
    <ToastCtx.Provider value={addToast}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <Icon name={t.type === 'success' ? 'check-circle' : 'alert-circle'} size={18} color="#fff" />
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() { return useContext(ToastCtx); }
```

- [ ] **Step 3: Create `components/ui/StatusBadge.tsx`**

```tsx
const map: Record<string, string> = {
  pending: 'badge-pending', approved: 'badge-approved', rejected: 'badge-rejected',
  completed: 'badge-completed', running: 'badge-running', available: 'badge-available',
  reserved: 'badge-reserved', dispatched: 'badge-dispatched', urgent: 'badge-urgent',
  cancelled: 'badge-grey', pass: 'badge-approved', reject: 'badge-rejected',
  active: 'badge-approved', inactive: 'badge-grey', maintenance: 'badge-pending',
  processing: 'badge-running', rework: 'badge-pending',
  low: 'badge-grey', medium: 'badge-info', high: 'badge-pending',
};

export function StatusBadge({ status }: { status: string }) {
  const cls = map[(status || '').toLowerCase()] || 'badge-grey';
  return <span className={`badge ${cls}`}>{status}</span>;
}
```

- [ ] **Step 4: Create `components/ui/StatCard.tsx`**

```tsx
import { Icon } from './Icon';

interface Props {
  icon: string;
  label: string;
  value: string | number;
  trend?: string;
  trendDir?: 'up' | 'down';
  color?: string;
}

export function StatCard({ icon, label, value, trend, trendDir, color = 'var(--info)' }: Props) {
  return (
    <div className="card stat-card">
      <div className="stat-icon" style={{ background: color + '15', color }}>
        <Icon name={icon} size={24} />
      </div>
      <div className="stat-content">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {trend && (
          <div className="stat-trend" style={{ color: trendDir === 'up' ? 'var(--success)' : 'var(--danger)' }}>
            <Icon name={trendDir === 'up' ? 'trending-up' : 'trending-down'} size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            {trend}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create `components/ui/Modal.tsx`**

```tsx
'use client';
import { ReactNode } from 'react';
import { Icon } from './Icon';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

export function Modal({ open, onClose, title, children, footer, wide }: Props) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={wide ? { maxWidth: 720 } : {}} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose} style={{ borderRadius: '50%' }}>
            <Icon name="x" size={20} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title = 'Are you sure?', message, confirmLabel = 'Confirm', danger }: {
  open: boolean; onClose: () => void; onConfirm: () => void;
  title?: string; message: string; confirmLabel?: string; danger?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button>
      </>}>
      <p>{message}</p>
    </Modal>
  );
}
```

- [ ] **Step 6: Create `components/ui/PageHeader.tsx`**

```tsx
import { ReactNode } from 'react';

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="text-secondary text-sm" style={{ marginTop: 2 }}>{subtitle}</p>}
      </div>
      <div className="flex-row">{children}</div>
    </div>
  );
}
```

- [ ] **Step 7: Create `components/ui/SearchableDropdown.tsx`**

Copy `SearchableDropdown` component from `erp/project/core.jsx`. Convert:
- Remove `const { useState, useRef, useEffect } = React;`
- Add `'use client';` and `import { useState, useRef, useEffect } from 'react';`
- Add TypeScript interface:

```tsx
'use client';
import { useState, useRef, useEffect } from 'react';
import { Icon } from './Icon';

interface Option { label: string; value: string | number; }

interface Props {
  options: (Option | string)[];
  value: string | number | null;
  onChange: (v: string | number) => void;
  placeholder?: string;
  labelKey?: string;
  valueKey?: string;
}
// ... rest of SearchableDropdown body copied from core.jsx
```

- [ ] **Step 8: Create `components/ui/index.ts`**

```ts
export { Icon } from './Icon';
export { ToastProvider, useToast } from './Toast';
export { StatusBadge } from './StatusBadge';
export { StatCard } from './StatCard';
export { Modal, ConfirmDialog } from './Modal';
export { PageHeader } from './PageHeader';
export { SearchableDropdown } from './SearchableDropdown';
```

- [ ] **Step 9: Add ToastProvider to `app/layout.tsx` body**

```tsx
<AuthProvider>
  <ToastProvider>
    {children}
  </ToastProvider>
</AuthProvider>
```

Add import: `import { ToastProvider } from '@/components/ui';`

- [ ] **Step 10: Commit**

```bash
git add components/
git commit -m "feat: core UI components (Icon, Toast, Modal, StatCard, etc)"
```

---

### Task 7: Login Page

Port `erp/project/login.jsx` to Next.js.

**Files:**
- Create: `app/login/page.tsx`

- [ ] **Step 1: Create `app/login/page.tsx`**

The source is `erp/project/login.jsx`. Conversion rules:
1. Add `'use client';` at top
2. Replace `const { useState } = React;` with `import { useState } from 'react';`
3. Replace `useToast()` with `import { useToast } from '@/components/ui';`
4. Replace mock login with real `useAuth().login()`
5. After successful login redirect based on role

```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || pin.length < 4) { setError('Enter phone and 4-digit PIN'); return; }
    setLoading(true);
    setError('');
    try {
      const user = await login(phone, pin);
      toast('Login successful');
      router.replace(user.role === 'admin' ? '/admin/dashboard' : '/worker');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ background: 'var(--bg)', position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header" style={{ flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8 }}>
          <div style={{ width: 52, height: 52, background: 'var(--accent)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 20 }}>OM</span>
          </div>
          <div>
            <h3 style={{ fontFamily: 'var(--font-heading)' }}>OM INDUSTRIES</h3>
            <p className="text-secondary text-sm">ERP System — Hanks Unit</p>
          </div>
        </div>
        <form className="modal-body" onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && (
              <div style={{ background: 'var(--danger-light)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: 14 }}>
                {error}
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                <span style={{ padding: '10px 14px', background: 'var(--hover-bg)', color: 'var(--text-secondary)', fontSize: 15, borderRight: '1px solid var(--border)' }}>+91</span>
                <input
                  type="tel" inputMode="numeric" value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit number"
                  style={{ flex: 1, border: 'none', padding: '10px 14px', fontSize: 15, outline: 'none', fontFamily: 'var(--font-body)' }}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">4-Digit PIN</label>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                {[0, 1, 2, 3].map(i => (
                  <input
                    key={i}
                    type="password" inputMode="numeric" maxLength={1}
                    value={pin[i] || ''}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g, '');
                      const arr = pin.split('');
                      arr[i] = v;
                      setPin(arr.join('').slice(0, 4));
                      if (v && i < 3) {
                        const next = document.getElementById(`pin-${i + 1}`);
                        next?.focus();
                      }
                    }}
                    id={`pin-${i}`}
                    style={{ width: 56, height: 56, textAlign: 'center', fontSize: 24, fontWeight: 700, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', outline: 'none', fontFamily: 'var(--font-body)' }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="modal-footer" style={{ border: 'none', padding: '16px 0 0' }}>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', fontSize: 16 }} disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Test**

Run `npm run dev`. Navigate to http://localhost:3000/login. Enter a real phone + PIN from your Supabase `erp_users` table. Should redirect to `/admin/dashboard` or `/worker`.

- [ ] **Step 3: Commit**

```bash
git add app/login/
git commit -m "feat: login page with phone + PIN auth"
```

---

### Task 8: Admin Layout (Sidebar + Topbar)

Port `erp/project/layout.jsx` to a Next.js route group layout.

**Files:**
- Create: `app/(admin)/layout.tsx`

- [ ] **Step 1: Create `app/(admin)/layout.tsx`**

Source: `erp/project/layout.jsx`. Conversion:
- Add `'use client';`
- Import from `'react'` and `'next/navigation'`
- Replace prototype's internal routing with `usePathname()` and `useRouter()`
- Wire logout to `useAuth().logout()`
- Define the NAV_ITEMS with `href` paths

```tsx
'use client';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Icon } from '@/components/ui';

interface NavItem {
  id: string;
  label: string;
  icon: string;
  href: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard', href: '/admin/dashboard' },
  { id: 'hanks', label: 'Hanks Production', icon: 'factory', href: '/admin/production/hanks' },
  { id: 'stock-inward', label: 'Stock Inward', icon: 'package-plus', href: '/admin/stock-inward' },
  { id: 'workers', label: 'Workers', icon: 'users', href: '/admin/masters/workers' },
  { id: 'clients', label: 'Clients', icon: 'archive', href: '/admin/masters/clients' },
  { id: 'qualities', label: 'Qualities', icon: 'box', href: '/admin/masters/qualities' },
  { id: 'advances', label: 'Advances', icon: 'indian-rupee', href: '/admin/advances' },
  { id: 'payroll', label: 'Payroll', icon: 'file-bar-chart', href: '/admin/payroll' },
  { id: 'recipes', label: 'Color Recipes', icon: 'flask-conical', href: '/admin/recipes' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  // Auth guard
  if (!user || user.role !== 'admin') {
    if (typeof window !== 'undefined') router.replace('/login');
    return null;
  }

  const activeId = NAV_ITEMS.find(n => pathname.startsWith(n.href))?.id;

  return (
    <div className="app-shell">
      {/* Sidebar backdrop */}
      <div className={`sidebar-backdrop ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <h2>OM INDUSTRIES</h2>
          <small>ERP System</small>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Main Menu</div>
          {NAV_ITEMS.map(item => (
            <Link
              key={item.id}
              href={item.href}
              className={`nav-item ${activeId === item.id ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <Icon name={item.icon} size={20} className="nav-icon" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <strong>{user.name}</strong>
          <span>Admin</span>
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 8, width: '100%', color: 'rgba(255,255,255,0.6)' }}
            onClick={handleLogout}
          >
            <Icon name="log-out" size={16} />
            Logout
          </button>
        </div>
      </aside>

      {/* Topbar */}
      <header className="topbar">
        <div className="topbar-left">
          <button className="topbar-btn hamburger" onClick={() => setSidebarOpen(true)}>
            <Icon name="menu" size={22} />
          </button>
          <div className="topbar-search">
            <Icon name="search" size={16} color="var(--text-secondary)" />
            <input placeholder="Search..." />
          </div>
        </div>
        <div className="topbar-right">
          <button className="topbar-btn">
            <Icon name="bell" size={20} />
          </button>
          <button className="topbar-btn" onClick={handleLogout} title="Logout">
            <Icon name="log-out" size={20} />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="main-content">
        {children}
      </main>

      {/* Bottom nav (mobile) */}
      <nav className="bottom-nav">
        <div className="bottom-nav-inner">
          {NAV_ITEMS.slice(0, 5).map(item => (
            <Link
              key={item.id}
              href={item.href}
              className={`bottom-nav-item ${activeId === item.id ? 'active' : ''}`}
            >
              <Icon name={item.icon} size={22} />
              <span>{item.label.split(' ')[0]}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
```

- [ ] **Step 2: Create placeholder `app/(admin)/dashboard/page.tsx`**

```tsx
export default function DashboardPage() {
  return <h2>Dashboard — coming in next task</h2>;
}
```

- [ ] **Step 3: Test**

Navigate to http://localhost:3000/admin/dashboard. Sidebar + topbar render. Active nav item highlights. Logout works.

- [ ] **Step 4: Commit**

```bash
git add app/\(admin\)/
git commit -m "feat: admin layout with sidebar, topbar, bottom nav"
```

---

### Task 9: ERP Resource API Routes

Port all Express routes from `server/routes/` to Next.js. Each route file follows an identical pattern.

**Pattern — standard CRUD resource:**

```ts
// app/api/<resource>/route.ts  (GET list + POST create)
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    const { data, error } = await supabase.from('<table>').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message.includes('required') ? 403 : 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    requireAdmin(req);
    const body = await req.json();
    const { data, error } = await supabase.from('<table>').insert([body]).select().single();
    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
```

```ts
// app/api/<resource>/[id]/route.ts  (PUT update + DELETE)
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireAdmin(req);
    const body = await req.json();
    const { data, error } = await supabase.from('<table>').update(body).eq('id', params.id).select().single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireAdmin(req);
    const { error } = await supabase.from('<table>').delete().eq('id', params.id);
    if (error) throw error;
    return NextResponse.json({ message: 'Deleted' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
```

**Files to create using this pattern:**

- [ ] **Step 1: Clients routes**
  - `app/api/clients/route.ts` — table: `clients`, GET all (with optional `?q=` search), POST create
  - `app/api/clients/[id]/route.ts` — PUT update, DELETE

  For GET clients, add search: `const q = req.nextUrl.searchParams.get('q'); let query = supabase.from('clients').select('*'); if (q) query = query.ilike('name', \`%${q}%\`);`

- [ ] **Step 2: Qualities routes**
  - `app/api/qualities/route.ts` — table: `qualities`
  - `app/api/qualities/[id]/route.ts`

- [ ] **Step 3: Workers routes** (reference `server/routes/workers.cjs`)
  - `app/api/workers/route.ts` — GET with optional `?department=`, POST create (hash PIN with bcrypt)
  - `app/api/workers/[id]/route.ts` — PUT update
  - `app/api/workers/[id]/pin/route.ts` — PUT reset PIN (bcrypt hash new pin)
  - `app/api/workers/[id]/toggle/route.ts` — PUT toggle `is_active`

  For POST workers, hash PIN before insert:
  ```ts
  import bcrypt from 'bcryptjs';
  // ...
  const pin_hash = await bcrypt.hash(body.pin, 10);
  const { data, error } = await supabase.from('erp_users').insert([{ ...body, pin_hash, role: body.role || 'hanks_worker' }]).select('id,name,phone,role,department,is_active').single();
  ```

- [ ] **Step 4: Stock routes**
  - `app/api/stock/inward/route.ts` — GET (with `?month=&year=`), POST
  - `app/api/stock/summary/route.ts` — GET aggregated stock summary (copy from `server/routes/stock.cjs`)

- [ ] **Step 5: Production routes**
  - `app/api/production/hanks/route.ts` — GET all (admin, with filters), POST submit (worker)
  - `app/api/production/hanks/my/route.ts` — GET worker's own entries (`requireWorker`, filter by `req.user.id`)
  - `app/api/production/hanks/[id]/approve/route.ts` — PUT approve (admin)
  - `app/api/production/hanks/[id]/reject/route.ts` — PUT reject (admin)

  For approve: look up `rate_per_kg` from `qualities` table, calculate `total_earned = weight_kg * rate`, update status + approved_at.

- [ ] **Step 6: Advances routes**
  - `app/api/advances/route.ts` — GET all (admin), POST request (worker)
  - `app/api/advances/my/route.ts` — GET worker's own advances
  - `app/api/advances/[id]/approve/route.ts` — PUT approve
  - `app/api/advances/[id]/reject/route.ts` — PUT reject

- [ ] **Step 7: Payroll routes** (reference `server/routes/payroll.cjs`)
  - `app/api/payroll/hanks/route.ts` — GET payroll summary for month
  - `app/api/payroll/hanks/export/route.ts` — GET returns Excel blob (use exceljs)

- [ ] **Step 8: Colors + Recipes routes** (reference `server/routes/colors.cjs`, `server/routes/recipes.cjs`)
  - `app/api/colors/route.ts`
  - `app/api/colors/[id]/route.ts`
  - `app/api/recipes/route.ts`
  - `app/api/recipes/[id]/route.ts`

- [ ] **Step 9: Test a few routes**

```bash
# Test workers (replace TOKEN with token from login)
curl -H "Authorization: Bearer TOKEN" http://localhost:3000/api/workers
curl -H "Authorization: Bearer TOKEN" http://localhost:3000/api/qualities
```

Expected: JSON arrays from Supabase.

- [ ] **Step 10: Commit**

```bash
git add app/api/
git commit -m "feat: all ERP API routes (workers, clients, qualities, stock, production, advances, payroll, recipes)"
```

---

### Task 10: Admin Dashboard Page

**Files:**
- Modify: `app/(admin)/dashboard/page.tsx`

- [ ] **Step 1: Build dashboard with real stats**

Source: `erp/project/dashboard.jsx`. Replace mock data with real API calls.

```tsx
'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { StatCard, PageHeader } from '@/components/ui';

export default function DashboardPage() {
  const [stats, setStats] = useState({ pendingApprovals: 0, stockSummary: [] as any[] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch('/production/hanks?status=pending'),
      apiFetch('/stock/summary'),
    ]).then(([pending, summary]) => {
      setStats({ pendingApprovals: pending.length, stockSummary: summary });
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={today} />

      <div className="grid-4" style={{ marginBottom: 24 }}>
        <StatCard icon="package-plus" label="Stock Items" value={stats.stockSummary.length} color="var(--info)" />
        <StatCard icon="clock" label="Pending Approvals" value={stats.pendingApprovals} color="var(--warning)" />
        <StatCard icon="factory" label="Hanks Unit" value="Active" color="var(--success)" />
        <StatCard icon="indian-rupee" label="Module" value="Phase 1" color="var(--primary)" />
      </div>

      <div className="card">
        <div className="card-body">
          <h3 style={{ marginBottom: 16 }}>Quick Actions</h3>
          <div className="flex-row" style={{ flexWrap: 'wrap', gap: 12 }}>
            {[
              { label: 'Approve Production', href: '/admin/production/hanks' },
              { label: 'Add Stock', href: '/admin/stock-inward' },
              { label: 'Run Payroll', href: '/admin/payroll' },
              { label: 'Manage Workers', href: '/admin/masters/workers' },
            ].map(a => (
              <a key={a.href} href={a.href} className="btn btn-secondary">{a.label}</a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Navigate to `/admin/dashboard`. Stats load from real data. No console errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(admin\)/dashboard/
git commit -m "feat: admin dashboard with live stats"
```

---

### Task 11: Hanks Production Page

**Files:**
- Create: `app/(admin)/production/hanks/page.tsx`

- [ ] **Step 1: Create page**

Source: `erp/project/hanks.jsx`. The page has two sections: pending approval cards + full production log table.

```tsx
'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader, StatusBadge, Modal, useToast } from '@/components/ui';

interface Production {
  id: number; worker_id: number; client_id: number; quality_id: number;
  date: string; weight_kg: number; status: string; rate_per_kg: number | null;
  total_earned: number | null; erp_users?: { name: string }; clients?: { name: string }; qualities?: { name: string };
}

export default function HanksPage() {
  const [entries, setEntries] = useState<Production[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const toast = useToast();

  const load = () => {
    setLoading(true);
    const qs = statusFilter ? `?status=${statusFilter}` : '';
    apiFetch(`/production/hanks${qs}`)
      .then(setEntries)
      .catch(e => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [statusFilter]);

  const approve = async (id: number) => {
    try {
      await apiFetch(`/production/hanks/${id}/approve`, { method: 'PUT' });
      toast('Approved');
      load();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  const reject = async (id: number) => {
    try {
      await apiFetch(`/production/hanks/${id}/reject`, { method: 'PUT' });
      toast('Rejected');
      load();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  const pending = entries.filter(e => e.status === 'pending');

  return (
    <div>
      <PageHeader title="Hanks Production" subtitle={`${entries.length} total entries`} />

      {/* Pending approvals */}
      {pending.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-body">
            <h3 style={{ marginBottom: 16 }}>Pending Approvals ({pending.length})</h3>
            {pending.map(e => (
              <div key={e.id} className="approval-card">
                <div className="approval-avatar">{(e.erp_users?.name || 'W')[0]}</div>
                <div className="approval-info">
                  <strong>{e.erp_users?.name}</strong>
                  <div className="text-secondary text-sm">{e.clients?.name} • {e.qualities?.name} • {e.weight_kg} kg • {new Date(e.date).toLocaleDateString('en-IN')}</div>
                </div>
                <div className="approval-actions">
                  <button className="btn btn-success btn-sm" onClick={() => approve(e.id)}>Approve</button>
                  <button className="btn btn-danger btn-sm" onClick={() => reject(e.id)}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Production log */}
      <div className="card">
        <div className="card-body">
          <div className="filter-bar" style={{ marginBottom: 16 }}>
            <h3>Production Log</h3>
            <select className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ maxWidth: 160 }}>
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          {loading ? (
            <div className="empty-state"><div className="loading-spinner" /></div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th><th>Worker</th><th>Client</th><th>Quality</th>
                    <th>Weight (kg)</th><th>Rate</th><th>Earned (₹)</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(e => (
                    <tr key={e.id}>
                      <td>{new Date(e.date).toLocaleDateString('en-IN')}</td>
                      <td>{e.erp_users?.name}</td>
                      <td>{e.clients?.name}</td>
                      <td>{e.qualities?.name}</td>
                      <td>{e.weight_kg}</td>
                      <td>{e.rate_per_kg ? `₹${e.rate_per_kg}` : '—'}</td>
                      <td>{e.total_earned ? `₹${e.total_earned}` : '—'}</td>
                      <td><StatusBadge status={e.status} /></td>
                      <td>
                        {e.status === 'pending' && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-success btn-sm" onClick={() => approve(e.id)}>✓</button>
                            <button className="btn btn-danger btn-sm" onClick={() => reject(e.id)}>✗</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {entries.length === 0 && (
                    <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 32 }}>No entries found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

Note: The API query for production entries needs to join related tables. Update `app/api/production/hanks/route.ts` GET to select:
```ts
const { data, error } = await supabase
  .from('hanks_production')
  .select('*, erp_users(name), clients(name), qualities(name)')
  .order('created_at', { ascending: false });
```

- [ ] **Step 2: Verify**

Navigate to `/admin/production/hanks`. Production entries load. Approve/reject buttons work and update status.

- [ ] **Step 3: Commit**

```bash
git add app/\(admin\)/production/
git commit -m "feat: hanks production page with approve/reject"
```

---

### Task 12: Masters Pages (Workers, Clients, Qualities)

**Files:**
- Create: `app/(admin)/masters/workers/page.tsx`
- Create: `app/(admin)/masters/clients/page.tsx`
- Create: `app/(admin)/masters/qualities/page.tsx`

All three pages follow the same pattern: table with Add/Edit modal + Delete confirm.

- [ ] **Step 1: Create `app/(admin)/masters/workers/page.tsx`**

Source: `erp/project/workers-master.jsx`. Pattern:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader, Modal, StatusBadge, useToast } from '@/components/ui';

interface Worker {
  id: number; name: string; phone: string; role: string;
  department: string | null; is_active: boolean;
}

const BLANK = { name: '', phone: '', role: 'hanks_worker', department: 'hanks', pin: '' };

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Worker | null>(null);
  const [form, setForm] = useState(BLANK);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const load = () => apiFetch('/workers').then(setWorkers).catch(e => toast(e.message, 'error')).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      if (editing) {
        await apiFetch(`/workers/${editing.id}`, { method: 'PUT', body: JSON.stringify(form) });
        toast('Worker updated');
      } else {
        await apiFetch('/workers', { method: 'POST', body: JSON.stringify(form) });
        toast('Worker added');
      }
      setModal(false); setEditing(null); setForm(BLANK); load();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  const toggle = async (id: number) => {
    try { await apiFetch(`/workers/${id}/toggle`, { method: 'PUT' }); toast('Status updated'); load(); }
    catch (e: any) { toast(e.message, 'error'); }
  };

  return (
    <div>
      <PageHeader title="Workers" subtitle={`${workers.length} registered`}>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setForm(BLANK); setModal(true); }}>+ Add Worker</button>
      </PageHeader>

      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Name</th><th>Phone</th><th>Role</th><th>Dept</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {workers.map(w => (
                <tr key={w.id} style={w.is_active ? {} : { opacity: 0.5 }}>
                  <td><strong>{w.name}</strong></td>
                  <td>{w.phone}</td>
                  <td>{w.role.replace('_', ' ')}</td>
                  <td>{w.department || '—'}</td>
                  <td><StatusBadge status={w.is_active ? 'active' : 'inactive'} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(w); setForm({ name: w.name, phone: w.phone, role: w.role, department: w.department || 'hanks', pin: '' }); setModal(true); }}>Edit</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => toggle(w.id)}>{w.is_active ? 'Deactivate' : 'Activate'}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Worker' : 'Add Worker'}
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Name</label>
            <input className="form-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input className="form-input" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Role</label>
            <select className="form-select" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
              <option value="hanks_worker">Hanks Worker</option>
              <option value="coning_worker">Coning Worker</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Department</label>
            <select className="form-select" value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))}>
              <option value="hanks">Hanks</option>
              <option value="coning">Coning</option>
              <option value="dyeing">Dyeing</option>
            </select>
          </div>
          {!editing && (
            <div className="form-group">
              <label className="form-label">PIN (4 digits)</label>
              <input className="form-input" type="password" maxLength={4} value={form.pin} onChange={e => setForm(p => ({ ...p, pin: e.target.value }))} />
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: Create `app/(admin)/masters/clients/page.tsx`**

Same pattern as Workers. Fields: name, address. API: `/clients`.

```tsx
'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader, Modal, ConfirmDialog, useToast } from '@/components/ui';

const BLANK = { name: '', address: '' };

export default function ClientsPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(BLANK);
  const [delId, setDelId] = useState<number | null>(null);
  const toast = useToast();

  const load = () => apiFetch('/clients').then(setClients).catch(e => toast(e.message, 'error'));
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      if (editing) await apiFetch(`/clients/${editing.id}`, { method: 'PUT', body: JSON.stringify(form) });
      else await apiFetch('/clients', { method: 'POST', body: JSON.stringify(form) });
      toast(editing ? 'Updated' : 'Added'); setModal(false); setEditing(null); setForm(BLANK); load();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  const del = async () => {
    if (!delId) return;
    try { await apiFetch(`/clients/${delId}`, { method: 'DELETE' }); toast('Deleted'); load(); }
    catch (e: any) { toast(e.message, 'error'); }
    setDelId(null);
  };

  return (
    <div>
      <PageHeader title="Clients" subtitle={`${clients.length} parties`}>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setForm(BLANK); setModal(true); }}>+ Add Client</button>
      </PageHeader>
      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Name</th><th>Address</th><th>Actions</th></tr></thead>
            <tbody>
              {clients.map(c => (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong></td>
                  <td className="text-secondary">{c.address || '—'}</td>
                  <td><div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(c); setForm({ name: c.name, address: c.address || '' }); setModal(true); }}>Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => setDelId(c.id)}>Delete</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Client' : 'Add Client'}
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>}>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Party Name</label><input className="form-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Address</label><input className="form-input" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} /></div>
        </div>
      </Modal>
      <ConfirmDialog open={!!delId} onClose={() => setDelId(null)} onConfirm={del} message="Delete this client?" confirmLabel="Delete" danger />
    </div>
  );
}
```

- [ ] **Step 3: Create `app/(admin)/masters/qualities/page.tsx`**

Same pattern. Fields: name, `hanks_rate_per_kg`, `coning_rate_per_kg`. API: `/qualities`.

```tsx
'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader, Modal, ConfirmDialog, useToast } from '@/components/ui';

const BLANK = { name: '', hanks_rate_per_kg: '', coning_rate_per_kg: '' };

export default function QualitiesPage() {
  const [qualities, setQualities] = useState<any[]>([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(BLANK);
  const [delId, setDelId] = useState<number | null>(null);
  const toast = useToast();

  const load = () => apiFetch('/qualities').then(setQualities).catch(e => toast(e.message, 'error'));
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      if (editing) await apiFetch(`/qualities/${editing.id}`, { method: 'PUT', body: JSON.stringify(form) });
      else await apiFetch('/qualities', { method: 'POST', body: JSON.stringify(form) });
      toast(editing ? 'Updated' : 'Added'); setModal(false); setEditing(null); setForm(BLANK); load();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  return (
    <div>
      <PageHeader title="Qualities" subtitle="Yarn quality types with per-kg rates">
        <button className="btn btn-primary" onClick={() => { setEditing(null); setForm(BLANK); setModal(true); }}>+ Add Quality</button>
      </PageHeader>
      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Quality Name</th><th>Hanks Rate (₹/kg)</th><th>Coning Rate (₹/kg)</th><th>Actions</th></tr></thead>
            <tbody>
              {qualities.map(q => (
                <tr key={q.id}>
                  <td><strong>{q.name}</strong></td>
                  <td>₹{q.hanks_rate_per_kg}</td>
                  <td>₹{q.coning_rate_per_kg}</td>
                  <td><div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(q); setForm({ name: q.name, hanks_rate_per_kg: q.hanks_rate_per_kg, coning_rate_per_kg: q.coning_rate_per_kg }); setModal(true); }}>Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => setDelId(q.id)}>Delete</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Quality' : 'Add Quality'}
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>}>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Quality Name</label><input className="form-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Hanks Rate (₹/kg)</label><input className="form-input" type="number" step="0.01" value={form.hanks_rate_per_kg} onChange={e => setForm(p => ({ ...p, hanks_rate_per_kg: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Coning Rate (₹/kg)</label><input className="form-input" type="number" step="0.01" value={form.coning_rate_per_kg} onChange={e => setForm(p => ({ ...p, coning_rate_per_kg: e.target.value }))} /></div>
        </div>
      </Modal>
      <ConfirmDialog open={!!delId} onClose={() => setDelId(null)} onConfirm={async () => { try { await apiFetch(`/qualities/${delId}`, { method: 'DELETE' }); toast('Deleted'); load(); } catch (e: any) { toast(e.message, 'error'); } setDelId(null); }} message="Delete this quality?" confirmLabel="Delete" danger />
    </div>
  );
}
```

- [ ] **Step 4: Verify all three pages**

Navigate to `/admin/masters/workers`, `/admin/masters/clients`, `/admin/masters/qualities`. Data loads. Add/Edit/Delete works.

- [ ] **Step 5: Commit**

```bash
git add app/\(admin\)/masters/
git commit -m "feat: workers, clients, qualities master pages"
```

---

### Task 13: Stock Inward + Advances + Payroll Pages

**Files:**
- Create: `app/(admin)/stock-inward/page.tsx`
- Create: `app/(admin)/advances/page.tsx`
- Create: `app/(admin)/payroll/page.tsx`

- [ ] **Step 1: Create `app/(admin)/stock-inward/page.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader, Modal, useToast } from '@/components/ui';

const BLANK = { date: new Date().toISOString().split('T')[0], challan_no: '', client_id: '', quality_id: '', weight_kg: '', bundles: '' };

export default function StockInwardPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [qualities, setQualities] = useState<any[]>([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(BLANK);
  const toast = useToast();

  useEffect(() => {
    Promise.all([apiFetch('/stock/inward'), apiFetch('/clients'), apiFetch('/qualities')])
      .then(([stock, c, q]) => { setEntries(stock); setClients(c); setQualities(q); })
      .catch(e => toast(e.message, 'error'));
  }, []);

  const save = async () => {
    try {
      await apiFetch('/stock/inward', { method: 'POST', body: JSON.stringify({ ...form, remaining_weight_kg: form.weight_kg }) });
      toast('Stock entry added');
      setModal(false); setForm(BLANK);
      apiFetch('/stock/inward').then(setEntries);
    } catch (e: any) { toast(e.message, 'error'); }
  };

  const f = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [key]: e.target.value }));

  return (
    <div>
      <PageHeader title="Stock Inward" subtitle="Raw yarn arrivals">
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ New Entry</button>
      </PageHeader>

      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Date</th><th>Challan No.</th><th>Client</th><th>Quality</th><th>Weight (kg)</th><th>Bundles</th><th>Remaining (kg)</th></tr></thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.id}>
                  <td>{new Date(e.date).toLocaleDateString('en-IN')}</td>
                  <td>{e.challan_no || '—'}</td>
                  <td>{e.clients?.name}</td>
                  <td>{e.qualities?.name}</td>
                  <td>{e.weight_kg}</td>
                  <td>{e.bundles || '—'}</td>
                  <td>{e.remaining_weight_kg}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="New Stock Entry"
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>}>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Date</label><input className="form-input" type="date" value={form.date} onChange={f('date')} /></div>
          <div className="form-group"><label className="form-label">Challan No.</label><input className="form-input" value={form.challan_no} onChange={f('challan_no')} /></div>
          <div className="form-group"><label className="form-label">Client</label>
            <select className="form-select" value={form.client_id} onChange={f('client_id')}>
              <option value="">Select client...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Quality</label>
            <select className="form-select" value={form.quality_id} onChange={f('quality_id')}>
              <option value="">Select quality...</option>
              {qualities.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Weight (kg)</label><input className="form-input" type="number" step="0.01" value={form.weight_kg} onChange={f('weight_kg')} /></div>
          <div className="form-group"><label className="form-label">Bundles</label><input className="form-input" type="number" value={form.bundles} onChange={f('bundles')} /></div>
        </div>
      </Modal>
    </div>
  );
}
```

Note: Update `app/api/stock/inward/route.ts` GET to select `*, clients(name), qualities(name)`.

- [ ] **Step 2: Create `app/(admin)/advances/page.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader, StatusBadge, useToast } from '@/components/ui';

export default function AdvancesPage() {
  const [advances, setAdvances] = useState<any[]>([]);
  const toast = useToast();

  const load = () => apiFetch('/advances').then(setAdvances).catch(e => toast(e.message, 'error'));
  useEffect(() => { load(); }, []);

  const approve = async (id: number) => {
    try { await apiFetch(`/advances/${id}/approve`, { method: 'PUT' }); toast('Approved'); load(); }
    catch (e: any) { toast(e.message, 'error'); }
  };

  const reject = async (id: number) => {
    try { await apiFetch(`/advances/${id}/reject`, { method: 'PUT' }); toast('Rejected'); load(); }
    catch (e: any) { toast(e.message, 'error'); }
  };

  return (
    <div>
      <PageHeader title="Advances" subtitle="Worker advance requests" />
      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Worker</th><th>Amount (₹)</th><th>Note</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {advances.map(a => (
                <tr key={a.id}>
                  <td><strong>{a.erp_users?.name}</strong></td>
                  <td>₹{a.amount}</td>
                  <td className="text-secondary">{a.note || '—'}</td>
                  <td>{new Date(a.created_at).toLocaleDateString('en-IN')}</td>
                  <td><StatusBadge status={a.status} /></td>
                  <td>
                    {a.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-success btn-sm" onClick={() => approve(a.id)}>Approve</button>
                        <button className="btn btn-danger btn-sm" onClick={() => reject(a.id)}>Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

Note: Update `app/api/advances/route.ts` GET to select `*, erp_users(name)`.

- [ ] **Step 3: Create `app/(admin)/payroll/page.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader, useToast } from '@/components/ui';

export default function PayrollPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const generate = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/payroll/hanks?month=${month}&year=${year}`);
      setRows(data);
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  };

  const exportExcel = async () => {
    try {
      const blob = await apiFetch(`/payroll/hanks/export?month=${month}&year=${year}`);
      const url = URL.createObjectURL(blob as Blob);
      const a = document.createElement('a');
      a.href = url; a.download = `payroll-${year}-${month}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { toast(e.message, 'error'); }
  };

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div>
      <PageHeader title="Payroll" subtitle="Monthly worker earnings summary" />

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-body">
          <div className="filter-bar">
            <select className="form-select" value={month} onChange={e => setMonth(+e.target.value)}>
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <input className="form-input" type="number" value={year} onChange={e => setYear(+e.target.value)} style={{ maxWidth: 100 }} />
            <button className="btn btn-primary" onClick={generate} disabled={loading}>{loading ? 'Calculating...' : 'Generate'}</button>
            {rows.length > 0 && <button className="btn btn-secondary" onClick={exportExcel}>Export Excel</button>}
          </div>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="card">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Worker</th><th>Dept</th><th>Entries</th><th>Total kg</th>
                  <th>Gross (₹)</th><th>Advances (₹)</th><th>Net (₹)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any) => (
                  <tr key={r.worker_id}>
                    <td><strong>{r.worker_name}</strong></td>
                    <td>{r.department || '—'}</td>
                    <td>{r.approved_entries}</td>
                    <td>{r.total_kg}</td>
                    <td>₹{r.gross_wages}</td>
                    <td>₹{r.total_advances}</td>
                    <td style={{ fontWeight: 700, color: 'var(--success)' }}>₹{r.net_wages}</td>
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
```

- [ ] **Step 4: Commit**

```bash
git add app/\(admin\)/stock-inward/ app/\(admin\)/advances/ app/\(admin\)/payroll/
git commit -m "feat: stock inward, advances, payroll pages"
```

---

### Task 14: Recipes Page

Port the existing color recipes feature from `src/pages/admin/RecipesPage.jsx` + design's `erp/project/attendance-recipes.jsx`.

**Files:**
- Create: `app/(admin)/recipes/page.tsx`

- [ ] **Step 1: Create `app/(admin)/recipes/page.tsx`**

This is a two-panel layout: left = saved recipes log, right = recipe editor with color parts.

```tsx
'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader, useToast } from '@/components/ui';

interface Ingredient { color: string; quantity: string; unit: string; }
interface Shade { name: string; ingredients: Ingredient[]; }
interface Recipe { id?: number; code: string; client: string; notes: string; shades: Shade[]; }

const BLANK_RECIPE: Recipe = { code: '', client: '', notes: '', shades: [{ name: 'Shade 1', ingredients: [{ color: '', quantity: '', unit: 'g' }] }] };

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<any[]>([]);
  const [colors, setColors] = useState<any[]>([]);
  const [editing, setEditing] = useState<Recipe>(BLANK_RECIPE);
  const [search, setSearch] = useState('');
  const toast = useToast();

  useEffect(() => {
    Promise.all([apiFetch('/recipes'), apiFetch('/colors')])
      .then(([r, c]) => { setRecipes(r); setColors(c); })
      .catch(e => toast(e.message, 'error'));
  }, []);

  const load = () => apiFetch('/recipes').then(setRecipes).catch(e => toast(e.message, 'error'));

  const save = async () => {
    if (!editing.code || !editing.client) { toast('Code and client required', 'error'); return; }
    try {
      if ((editing as any).id) await apiFetch(`/recipes/${(editing as any).id}`, { method: 'PUT', body: JSON.stringify(editing) });
      else await apiFetch('/recipes', { method: 'POST', body: JSON.stringify(editing) });
      toast('Recipe saved'); setEditing(BLANK_RECIPE); load();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  const del = async (id: number) => {
    if (!confirm('Delete this recipe?')) return;
    try { await apiFetch(`/recipes/${id}`, { method: 'DELETE' }); toast('Deleted'); load(); }
    catch (e: any) { toast(e.message, 'error'); }
  };

  const filtered = recipes.filter(r =>
    r.code?.toLowerCase().includes(search.toLowerCase()) ||
    r.client?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', gap: 24, height: 'calc(100vh - 130px)' }}>
      {/* Left: Recipe Log */}
      <div className="card" style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="card-body" style={{ borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <h3 style={{ marginBottom: 12 }}>Saved Recipes ({recipes.length})</h3>
          <input className="form-input" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ fontSize: 14 }} />
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: 8 }}>
          {filtered.map(r => (
            <div key={r.id}
              style={{ padding: '10px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 4, border: '1px solid var(--border)', background: (editing as any).id === r.id ? 'var(--accent-light)' : 'white' }}
              onClick={() => setEditing({ ...r, shades: r.shades || [] })}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{r.code}</div>
              <div className="text-secondary text-sm">{r.client} • {r.shades?.length || 0} shade(s)</div>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', marginTop: 4 }} onClick={e => { e.stopPropagation(); del(r.id); }}>Delete</button>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Editor */}
      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="card-body" style={{ borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <PageHeader title={(editing as any).id ? 'Edit Recipe' : 'New Recipe'}>
            <button className="btn btn-secondary" onClick={() => setEditing(BLANK_RECIPE)}>Clear</button>
            <button className="btn btn-primary" onClick={save}>Save Recipe</button>
          </PageHeader>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Recipe Code</label><input className="form-input" value={editing.code} onChange={e => setEditing(p => ({ ...p, code: e.target.value }))} placeholder="e.g. RCP-001" /></div>
            <div className="form-group"><label className="form-label">Client</label><input className="form-input" value={editing.client} onChange={e => setEditing(p => ({ ...p, client: e.target.value }))} /></div>
          </div>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: 24 }}>
          {editing.shades.map((shade, si) => (
            <div key={si} className="card" style={{ marginBottom: 16, border: '1px solid var(--border)' }}>
              <div className="card-body">
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                  <input className="form-input" value={shade.name} onChange={e => setEditing(p => { const s = [...p.shades]; s[si] = { ...s[si], name: e.target.value }; return { ...p, shades: s }; })} style={{ flex: 1, fontWeight: 600 }} />
                  <button className="btn btn-danger btn-sm" onClick={() => setEditing(p => ({ ...p, shades: p.shades.filter((_, i) => i !== si) }))}>Remove Shade</button>
                </div>
                {shade.ingredients.map((ing, ii) => (
                  <div key={ii} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <select className="form-select" style={{ flex: 2 }} value={ing.color} onChange={e => setEditing(p => { const s = [...p.shades]; s[si].ingredients[ii].color = e.target.value; return { ...p, shades: s }; })}>
                      <option value="">Select color...</option>
                      {colors.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                    <input className="form-input" type="number" placeholder="Qty" style={{ width: 80 }} value={ing.quantity} onChange={e => setEditing(p => { const s = [...p.shades]; s[si].ingredients[ii].quantity = e.target.value; return { ...p, shades: s }; })} />
                    <select className="form-select" style={{ width: 70 }} value={ing.unit} onChange={e => setEditing(p => { const s = [...p.shades]; s[si].ingredients[ii].unit = e.target.value; return { ...p, shades: s }; })}>
                      <option>g</option><option>ml</option><option>%</option><option>g/L</option>
                    </select>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setEditing(p => { const s = [...p.shades]; s[si].ingredients = s[si].ingredients.filter((_, i) => i !== ii); return { ...p, shades: s }; })}>✕</button>
                  </div>
                ))}
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(p => { const s = [...p.shades]; s[si].ingredients.push({ color: '', quantity: '', unit: 'g' }); return { ...p, shades: s }; })}>+ Add Chemical</button>
              </div>
            </div>
          ))}
          <button className="btn btn-secondary" onClick={() => setEditing(p => ({ ...p, shades: [...p.shades, { name: `Shade ${p.shades.length + 1}`, ingredients: [{ color: '', quantity: '', unit: 'g' }] }] }))}>+ Add Shade</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Navigate to `/admin/recipes`. Left panel shows saved recipes. Clicking one loads it in editor. Save creates new recipe. Colors from DB populate dropdowns.

- [ ] **Step 3: Commit**

```bash
git add app/\(admin\)/recipes/
git commit -m "feat: color recipes page with two-panel editor"
```

---

### Task 15: Worker Layout + Pages

Port `erp/project/worker-app.jsx` to Next.js worker route group.

**Files:**
- Create: `app/(worker)/layout.tsx`
- Create: `app/(worker)/page.tsx`
- Create: `app/(worker)/history/page.tsx`
- Create: `app/(worker)/advances/page.tsx`

- [ ] **Step 1: Create `app/(worker)/layout.tsx`**

```tsx
'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Icon } from '@/components/ui';

const NAV = [
  { href: '/worker', icon: 'home', label: 'Entry' },
  { href: '/worker/history', icon: 'clipboard-list', label: 'History' },
  { href: '/worker/advances', icon: 'indian-rupee', label: 'Advance' },
];

export default function WorkerLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  if (!user || !['hanks_worker', 'coning_worker'].includes(user.role)) {
    if (typeof window !== 'undefined') router.replace('/login');
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg)', paddingBottom: 72 }}>
      {/* Header */}
      <header style={{ background: 'var(--surface)', padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10, boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 16 }}>
          <Icon name="factory" size={20} color="var(--accent)" />
          OM INDUSTRIES
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{user.name}</span>
          <button onClick={() => { logout(); router.replace('/login'); }}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 6, borderRadius: '50%', display: 'flex' }}>
            <Icon name="log-out" size={20} />
          </button>
        </div>
      </header>

      {/* Content */}
      <main style={{ flex: 1, padding: 20, maxWidth: 600, margin: '0 auto', width: '100%' }}>
        {children}
      </main>

      {/* Bottom Nav */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--surface)', borderTop: '1px solid var(--border)', display: 'flex', zIndex: 50, boxShadow: '0 -2px 10px rgba(0,0,0,0.05)' }}>
        {NAV.map(n => {
          const active = pathname === n.href;
          return (
            <Link key={n.href} href={n.href} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 0', color: active ? 'var(--accent)' : 'var(--text-secondary)', textDecoration: 'none', fontSize: 11, fontWeight: active ? 600 : 400, minHeight: 56 }}>
              <Icon name={n.icon} size={22} />
              {n.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
```

- [ ] **Step 2: Create `app/(worker)/page.tsx` — Production Entry**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui';

export default function ProductionEntryPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [qualities, setQualities] = useState<any[]>([]);
  const [form, setForm] = useState({ client_id: '', quality_id: '', weight_kg: '' });
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuth();
  const toast = useToast();

  useEffect(() => {
    Promise.all([apiFetch('/clients'), apiFetch('/qualities')])
      .then(([c, q]) => { setClients(c); setQualities(q); })
      .catch(e => toast(e.message, 'error'));
  }, []);

  const submit = async () => {
    if (!form.client_id || !form.quality_id || !form.weight_kg) { toast('Fill all fields', 'error'); return; }
    setSubmitting(true);
    try {
      await apiFetch('/production/hanks', { method: 'POST', body: JSON.stringify({ ...form, date: new Date().toISOString().split('T')[0] }) });
      toast(`${form.weight_kg} kg submitted for approval ✓`);
      setForm({ client_id: '', quality_id: '', weight_kg: '' });
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setSubmitting(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ fontFamily: 'var(--font-heading)', marginBottom: 4 }}>Hello, {user?.name} 👋</h2>
        <p className="text-secondary">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      <div className="card">
        <div className="card-body">
          <h3 style={{ marginBottom: 20 }}>Submit Today's Production</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Client</label>
              <select className="form-select" value={form.client_id} onChange={e => setForm(p => ({ ...p, client_id: e.target.value }))}>
                <option value="">Select client...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Quality</label>
              <select className="form-select" value={form.quality_id} onChange={e => setForm(p => ({ ...p, quality_id: e.target.value }))}>
                <option value="">Select quality...</option>
                {qualities.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Weight (kg)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary" style={{ fontSize: 20, padding: '0 20px' }} onClick={() => setForm(p => ({ ...p, weight_kg: String(Math.max(0, +p.weight_kg - 1)) }))}>−</button>
                <input className="form-input" type="number" step="0.5" min="0" value={form.weight_kg} onChange={e => setForm(p => ({ ...p, weight_kg: e.target.value }))} style={{ textAlign: 'center', fontSize: 24, fontWeight: 700 }} />
                <button className="btn btn-secondary" style={{ fontSize: 20, padding: '0 20px' }} onClick={() => setForm(p => ({ ...p, weight_kg: String(+p.weight_kg + 1) }))}>+</button>
              </div>
            </div>
            <button className="btn btn-primary" style={{ fontSize: 16, padding: 16, marginTop: 8 }} onClick={submit} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Production'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `app/(worker)/history/page.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { StatusBadge, useToast } from '@/components/ui';

export default function WorkerHistoryPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    apiFetch('/production/hanks/my')
      .then(setEntries)
      .catch(e => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-heading)', marginBottom: 20 }}>My Production History</h2>
      {loading ? <div className="loading-spinner" style={{ margin: '40px auto', display: 'block' }} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {entries.map(e => (
            <div key={e.id} className="card">
              <div className="card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                    <div className="text-secondary text-sm" style={{ marginTop: 4 }}>{e.clients?.name} • {e.qualities?.name}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, marginTop: 8 }}>{e.weight_kg} kg</div>
                    {e.status === 'approved' && e.total_earned && (
                      <div style={{ color: 'var(--success)', fontWeight: 600, marginTop: 4 }}>Earned: ₹{e.total_earned}</div>
                    )}
                  </div>
                  <StatusBadge status={e.status} />
                </div>
              </div>
            </div>
          ))}
          {entries.length === 0 && <p className="text-secondary" style={{ textAlign: 'center', padding: 40 }}>No production entries yet</p>}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create `app/(worker)/advances/page.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { StatusBadge, useToast } from '@/components/ui';

export default function WorkerAdvancesPage() {
  const [advances, setAdvances] = useState<any[]>([]);
  const [form, setForm] = useState({ amount: '', note: '' });
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  const load = () => apiFetch('/advances/my').then(setAdvances).catch(e => toast(e.message, 'error'));
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.amount) { toast('Enter amount', 'error'); return; }
    setSubmitting(true);
    try {
      await apiFetch('/advances', { method: 'POST', body: JSON.stringify(form) });
      toast('Advance request submitted');
      setForm({ amount: '', note: '' });
      load();
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setSubmitting(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="card-body">
          <h3 style={{ marginBottom: 16 }}>Request Advance</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Amount (₹)</label>
              <input className="form-input" type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="Enter amount" style={{ fontSize: 20, textAlign: 'center' }} />
            </div>
            <div className="form-group">
              <label className="form-label">Reason (optional)</label>
              <input className="form-input" value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} placeholder="Medical, travel, etc." />
            </div>
            <button className="btn btn-primary" style={{ fontSize: 16, padding: 14 }} onClick={submit} disabled={submitting}>
              {submitting ? 'Requesting...' : 'Request Advance'}
            </button>
          </div>
        </div>
      </div>

      <h3 style={{ fontFamily: 'var(--font-heading)' }}>Past Requests</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {advances.map(a => (
          <div key={a.id} className="card">
            <div className="card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>₹{a.amount}</div>
                  <div className="text-secondary text-sm">{new Date(a.created_at).toLocaleDateString('en-IN')} {a.note ? `• ${a.note}` : ''}</div>
                </div>
                <StatusBadge status={a.status} />
              </div>
            </div>
          </div>
        ))}
        {advances.length === 0 && <p className="text-secondary" style={{ textAlign: 'center', padding: 32 }}>No advance requests</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify worker flow**

Login as a worker (phone/PIN). Should go to `/worker`. Submit production entry. Check history. Request advance.

- [ ] **Step 6: Commit**

```bash
git add app/\(worker\)/
git commit -m "feat: worker layout, production entry, history, advances pages"
```

---

### Task 16: Cleanup

Remove old Vite source and Express server.

**Files:**
- Delete: `src/` directory
- Delete: `server/` directory  
- Delete: `vite.config.js` (if not already deleted)

- [ ] **Step 1: Verify all API routes work (smoke test)**

```bash
# Get a token first
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"phone":"PHONE","pin":"PIN"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/workers
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/qualities
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/clients
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/production/hanks
```

Each should return JSON array, no 500 errors.

- [ ] **Step 2: Verify all pages render**

Visit each route manually:
- [ ] `/login` — login form renders, can log in
- [ ] `/admin/dashboard` — stats load
- [ ] `/admin/production/hanks` — entries load, approve/reject work
- [ ] `/admin/stock-inward` — entries load, can add new
- [ ] `/admin/masters/workers` — list loads, add/edit work
- [ ] `/admin/masters/clients` — list loads
- [ ] `/admin/masters/qualities` — list loads
- [ ] `/admin/advances` — list loads
- [ ] `/admin/payroll` — generate works, export downloads xlsx
- [ ] `/admin/recipes` — two-panel loads, save works
- [ ] `/worker` — entry form loads, submit works
- [ ] `/worker/history` — entries show
- [ ] `/worker/advances` — request + history works

- [ ] **Step 3: Remove old source**

```bash
rm -rf src/
rm -rf server/
```

- [ ] **Step 4: Confirm build passes**

```bash
npm run build
```

Expected: Build completes with no errors. Check `.next/` is generated.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: remove old Vite src/ and Express server/ (replaced by Next.js)"
```

---

## Post-Migration Notes

**Future screens** (not yet built, backend doesn't exist yet):
- Dyeing Production, Conning Production, Ready Stock — need new Supabase tables
- Client Finance, Worker Loans — need new tables
- Dispatch — needs `dispatches` table
- Attendance — needs `attendance` table
- Reports — aggregate queries once data exists

**Deployment (Vercel):**
1. Push to GitHub
2. Connect repo to Vercel
3. Set env vars: `SUPABASE_URL`, `SUPABASE_KEY`, `JWT_SECRET`
4. Deploy — Next.js API routes run as serverless functions automatically

**Known API updates needed during Task 9:**
- `production/hanks` GET: add `*, erp_users(name), clients(name), qualities(name)`
- `advances` GET: add `*, erp_users(name)`
- `stock/inward` GET: add `*, clients(name), qualities(name)`
