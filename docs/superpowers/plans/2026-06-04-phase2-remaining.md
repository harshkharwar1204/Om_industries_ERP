# Phase 2 Remaining Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Client Finance, Worker Loans, Reports, and Worker Payslip — completing Phase 2 of OM Industries ERP.

**Architecture:** Each feature follows the existing pattern: Next.js Route Handler (`app/api/`) + `'use client'` page (`app/admin/` or `app/worker/`). Auth via `requireAdmin`/`requireAuth` from `lib/auth.ts`. DB via `supabase` singleton from `lib/supabase.ts`. UI via `apiFetch` + shared components from `@/components/ui`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase, Lucide React icons, `@/components/ui` (PageHeader, Modal, useToast, Icon, StatusBadge)

---

## Files to Create / Modify

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `app/api/finance/clients/route.ts` | GET ledger/summary, POST payment/adjustment |
| Create | `app/admin/finance/clients/page.tsx` | 3-tab: Ledger, Collections, Adjustments |
| Create | `app/api/loans/route.ts` | GET all loans, POST new loan |
| Create | `app/api/loans/[id]/hapta/route.ts` | POST record repayment |
| Create | `app/admin/finance/workers/page.tsx` | 2-tab: Loans + Advances |
| Create | `app/api/reports/[type]/route.ts` | GET report data by type + date range |
| Create | `app/admin/reports/page.tsx` | 6-tab reports with CSV export |
| Create | `app/api/payroll/hanks/my/route.ts` | GET worker's own monthly payslip summary |
| Create | `app/worker/payslip/page.tsx` | Worker payslip view |
| Modify | `app/admin/layout.tsx` | Restructure nav to sections, add Finance + Reports |
| Modify | `app/worker/layout.tsx` | Add Payslip tab to bottom nav |
| Modify | `CLAUDE.md` | Move completed items to Done section |

---

## Task 1: Client Finance API

**Files:**
- Create: `app/api/finance/clients/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
// app/api/finance/clients/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    const client_id = req.nextUrl.searchParams.get('client_id');

    if (client_id) {
      const { data, error } = await supabase
        .from('client_transactions')
        .select('*, clients(name)')
        .eq('client_id', Number(client_id))
        .order('date', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return NextResponse.json(data);
    }

    // Summary: debit/credit/balance per client
    const { data, error } = await supabase
      .from('client_transactions')
      .select('client_id, type, amount, clients(name)')
      .order('client_id');
    if (error) throw error;

    const summary: Record<number, any> = {};
    for (const t of (data ?? [])) {
      const id = t.client_id;
      if (!summary[id]) summary[id] = { client_id: id, client_name: (t as any).clients?.name ?? `Client ${id}`, total_debit: 0, total_credit: 0 };
      if (t.type === 'debit') summary[id].total_debit += Number(t.amount);
      else summary[id].total_credit += Number(t.amount);
    }

    return NextResponse.json(Object.values(summary).map(r => ({
      ...r,
      balance: Number((r.total_debit - r.total_credit).toFixed(2)),
      total_debit: Number(r.total_debit.toFixed(2)),
      total_credit: Number(r.total_credit.toFixed(2)),
    })));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message.includes('required') ? 403 : 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    requireAdmin(req);
    const { client_id, date, amount, particulars, type } = await req.json();
    if (!client_id || !amount || !type) return NextResponse.json({ error: 'client_id, amount, type required' }, { status: 400 });
    if (!['credit', 'adjustment'].includes(type)) return NextResponse.json({ error: 'type must be credit or adjustment' }, { status: 400 });

    const { data, error } = await supabase
      .from('client_transactions')
      .insert([{
        client_id: Number(client_id),
        date: date || new Date().toISOString().split('T')[0],
        type,
        particulars: particulars?.trim() || (type === 'credit' ? 'Payment received' : 'Adjustment'),
        amount: Number(amount),
      }])
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
```

- [ ] **Step 2: Verify**

Start dev server (`npm run dev`). Open browser console and run:
```javascript
// Should return 403 (no token)
fetch('/api/finance/clients').then(r => r.json()).then(console.log)
```
Expected: `{ error: "No token" }` or similar auth error. Route is wired up.

- [ ] **Step 3: Commit**

```bash
git add app/api/finance/clients/route.ts
git commit -m "feat: add client finance API (ledger summary + payment/adjustment)"
```

---

## Task 2: Client Finance Admin Page

**Files:**
- Create: `app/admin/finance/clients/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
// app/admin/finance/clients/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader, useToast, Icon } from '@/components/ui';

interface Transaction {
  id: number; client_id: number; date: string; type: string;
  particulars: string; amount: number; created_at: string;
  clients?: { name: string };
}
interface Summary {
  client_id: number; client_name: string;
  total_debit: number; total_credit: number; balance: number;
}
type Tab = 'ledger' | 'collections' | 'adjustments';

const BLANK = { client_id: '', date: new Date().toISOString().split('T')[0], amount: '', particulars: '' };

const tabStyle = (active: boolean) => ({
  padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer',
  fontFamily: 'var(--font-heading)', fontWeight: active ? 700 : 400, fontSize: 14,
  color: active ? 'var(--accent)' : 'var(--text-secondary)',
  borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
  marginBottom: -2, textTransform: 'capitalize' as const,
});

export default function ClientFinancePage() {
  const [tab, setTab]           = useState<Tab>('ledger');
  const [clients, setClients]   = useState<any[]>([]);
  const [summary, setSummary]   = useState<Summary[]>([]);
  const [selected, setSelected] = useState<number | ''>('');
  const [txns, setTxns]         = useState<Transaction[]>([]);
  const [loadingL, setLoadingL] = useState(false);
  const [loadingS, setLoadingS] = useState(true);
  const [form, setForm]         = useState(BLANK);
  const [saving, setSaving]     = useState(false);
  const toast = useToast();

  const loadSummary = () => {
    setLoadingS(true);
    apiFetch('/finance/clients').then(setSummary).catch(e => toast(e.message, 'error')).finally(() => setLoadingS(false));
  };

  const loadLedger = (id: number) => {
    setLoadingL(true);
    apiFetch(`/finance/clients?client_id=${id}`)
      .then(setTxns).catch(e => toast(e.message, 'error')).finally(() => setLoadingL(false));
  };

  useEffect(() => {
    apiFetch('/clients').then(setClients).catch(e => toast(e.message, 'error'));
    loadSummary();
  }, []);

  useEffect(() => {
    if (selected) loadLedger(selected as number);
    else setTxns([]);
  }, [selected]);

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  // Compute running balance client-side
  const ledgerRows = txns.map((t, i) => {
    const prevBal = txns.slice(0, i).reduce((s, r) => s + (r.type === 'debit' ? Number(r.amount) : -Number(r.amount)), 0);
    return { ...t, balance: prevBal + (t.type === 'debit' ? Number(t.amount) : -Number(t.amount)) };
  });

  const submit = async (type: 'credit' | 'adjustment') => {
    if (!form.client_id || !form.amount) { toast('Client and amount required', 'error'); return; }
    setSaving(true);
    try {
      await apiFetch('/finance/clients', { method: 'POST', body: JSON.stringify({ ...form, type }) });
      toast(type === 'credit' ? 'Payment recorded' : 'Adjustment saved');
      setForm(BLANK);
      loadSummary();
      if (selected && String(selected) === form.client_id) loadLedger(Number(form.client_id));
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const totalOutstanding = summary.reduce((s, r) => s + r.balance, 0);

  return (
    <div className="page-enter">
      <PageHeader title="Client Finance" subtitle={`${summary.length} clients · ₹${totalOutstanding.toLocaleString('en-IN')} outstanding`} />

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--border)' }}>
        {(['ledger', 'collections', 'adjustments'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={tabStyle(tab === t)}>{t}</button>
        ))}
      </div>

      {/* Ledger */}
      {tab === 'ledger' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            {loadingS ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="loading-spinner" /></div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Client</th><th>Total Billed</th><th>Total Paid</th><th>Balance Due</th></tr></thead>
                  <tbody>
                    {summary.map(r => (
                      <tr key={r.client_id} onClick={() => setSelected(r.client_id)}
                        style={{ cursor: 'pointer', background: selected === r.client_id ? 'var(--hover-bg)' : undefined }}>
                        <td><strong>{r.client_name}</strong></td>
                        <td style={{ fontFamily: 'var(--font-heading)', color: 'var(--danger)' }}>₹{r.total_debit.toLocaleString('en-IN')}</td>
                        <td style={{ fontFamily: 'var(--font-heading)', color: 'var(--success)' }}>₹{r.total_credit.toLocaleString('en-IN')}</td>
                        <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: r.balance > 0 ? 'var(--warning)' : 'var(--success)' }}>
                          ₹{r.balance.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                    {summary.length === 0 && (
                      <tr><td colSpan={4}><div className="empty-state">
                        <Icon name="wallet" size={40} color="var(--primary-light)" />
                        <p className="empty-state-title">No transactions yet</p>
                      </div></td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {selected && (
            <div className="card">
              <div className="card-body" style={{ borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 15 }}>Ledger — {summary.find(s => s.client_id === selected)?.client_name}</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setSelected('')}>Close</button>
              </div>
              {loadingL ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><div className="loading-spinner" /></div>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead><tr><th>Date</th><th>Particulars</th><th>Debit (₹)</th><th>Credit (₹)</th><th>Balance (₹)</th></tr></thead>
                    <tbody>
                      {ledgerRows.map(r => (
                        <tr key={r.id}>
                          <td className="text-sm">{new Date(r.date).toLocaleDateString('en-IN')}</td>
                          <td>{r.particulars}</td>
                          <td style={{ fontFamily: 'var(--font-heading)', color: r.type === 'debit' ? 'var(--danger)' : undefined }}>
                            {r.type === 'debit' ? `₹${Number(r.amount).toLocaleString('en-IN')}` : '—'}
                          </td>
                          <td style={{ fontFamily: 'var(--font-heading)', color: r.type !== 'debit' ? 'var(--success)' : undefined }}>
                            {r.type !== 'debit' ? `₹${Number(r.amount).toLocaleString('en-IN')}` : '—'}
                          </td>
                          <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, color: r.balance > 0 ? 'var(--warning)' : 'var(--success)' }}>
                            ₹{r.balance.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                      {ledgerRows.length === 0 && (
                        <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 24 }}>No transactions</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Collections */}
      {tab === 'collections' && (
        <div className="card" style={{ maxWidth: 480 }}>
          <div className="card-body">
            <h3 style={{ marginBottom: 20, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="plus-circle" size={16} color="var(--success)" /> Record Payment
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Client *</label>
                <select className="form-select" value={form.client_id} onChange={f('client_id')}>
                  <option value="">Select client…</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Amount (₹) *</label>
                  <input className="form-input" type="number" min="0" step="0.01" value={form.amount} onChange={f('amount')} placeholder="0.00" />
                </div>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input className="form-input" type="date" value={form.date} onChange={f('date')} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Particulars</label>
                <input className="form-input" value={form.particulars} onChange={f('particulars')} placeholder="Cheque #1234, NEFT ref…" />
              </div>
              <button className="btn btn-success" style={{ width: '100%', fontSize: 15 }} onClick={() => submit('credit')} disabled={saving}>
                {saving ? 'Saving…' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjustments */}
      {tab === 'adjustments' && (
        <div className="card" style={{ maxWidth: 480 }}>
          <div className="card-body">
            <h3 style={{ marginBottom: 20, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="sliders-horizontal" size={16} color="var(--info)" /> Add Adjustment
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Client *</label>
                <select className="form-select" value={form.client_id} onChange={f('client_id')}>
                  <option value="">Select client…</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Amount (₹) *</label>
                  <input className="form-input" type="number" min="0" step="0.01" value={form.amount} onChange={f('amount')} placeholder="0.00" />
                </div>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input className="form-input" type="date" value={form.date} onChange={f('date')} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Particulars *</label>
                <input className="form-input" value={form.particulars} onChange={f('particulars')} placeholder="Return / damage deduction…" />
              </div>
              <button className="btn btn-primary" style={{ width: '100%', fontSize: 15 }} onClick={() => submit('adjustment')} disabled={saving}>
                {saving ? 'Saving…' : 'Save Adjustment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Navigate to `/admin/finance/clients` (after nav update in Task 9). Verify:
- Ledger tab shows summary table of all clients with debit/credit/balance
- Click a client row → detailed ledger expands below with running balance
- Dispatch entries already created appear as Debit rows
- Collections tab → select a client, enter amount, submit → success toast, balance updates
- Adjustments tab → same form, saves as type=adjustment

- [ ] **Step 3: Commit**

```bash
git add app/admin/finance/clients/page.tsx
git commit -m "feat: add client finance admin page (ledger, collections, adjustments)"
```

---

## Task 3: Worker Loans API

**Files:**
- Create: `app/api/loans/route.ts`
- Create: `app/api/loans/[id]/hapta/route.ts`

- [ ] **Step 1: Create loans route**

```typescript
// app/api/loans/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    const { data, error } = await supabase
      .from('worker_loans')
      .select('*, erp_users(name, department)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message.includes('required') ? 403 : 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    requireAdmin(req);
    const { worker_id, loan_amount, hapta_amount } = await req.json();
    if (!worker_id || !loan_amount || !hapta_amount) {
      return NextResponse.json({ error: 'worker_id, loan_amount, hapta_amount required' }, { status: 400 });
    }
    const { data, error } = await supabase
      .from('worker_loans')
      .insert([{
        worker_id: Number(worker_id),
        loan_amount: Number(loan_amount),
        hapta_amount: Number(hapta_amount),
        outstanding: Number(loan_amount),
        status: 'active',
        date: new Date().toISOString().split('T')[0],
      }])
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
```

- [ ] **Step 2: Create hapta (repayment) route**

```typescript
// app/api/loans/[id]/hapta/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireAdmin(req);
    const { amount, date, remarks } = await req.json();
    const loanId = Number(params.id);
    if (!amount || Number(amount) <= 0) return NextResponse.json({ error: 'Valid amount required' }, { status: 400 });

    const { data: loan, error: lErr } = await supabase
      .from('worker_loans').select('*').eq('id', loanId).single();
    if (lErr || !loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

    const repayment    = Math.min(Number(amount), Number(loan.outstanding));
    const newTotalPaid = Number(loan.total_paid) + repayment;
    const newOutstanding = Math.max(0, Number(loan.loan_amount) - newTotalPaid);

    await supabase.from('loan_repayments').insert([{
      loan_id: loanId, worker_id: loan.worker_id,
      amount: repayment,
      date: date || new Date().toISOString().split('T')[0],
      remarks: remarks?.trim() || null,
    }]);

    const { data, error } = await supabase
      .from('worker_loans')
      .update({ total_paid: newTotalPaid, outstanding: newOutstanding, status: newOutstanding <= 0 ? 'closed' : 'active' })
      .eq('id', loanId).select().single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/loans/route.ts app/api/loans/[id]/hapta/route.ts
git commit -m "feat: add worker loans API (create loan, record hapta repayment)"
```

---

## Task 4: Worker Finance Admin Page

**Files:**
- Create: `app/admin/finance/workers/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
// app/admin/finance/workers/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader, Modal, StatusBadge, useToast, Icon } from '@/components/ui';

interface Loan {
  id: number; worker_id: number; loan_amount: number; hapta_amount: number;
  total_paid: number; outstanding: number; status: string; date: string;
  erp_users?: { name: string; department: string | null };
}

type Tab = 'loans' | 'advances';

const BLANK_LOAN  = { worker_id: '', loan_amount: '', hapta_amount: '' };
const BLANK_HAPTA = { amount: '', date: new Date().toISOString().split('T')[0], remarks: '' };

const tabStyle = (active: boolean) => ({
  padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer',
  fontFamily: 'var(--font-heading)', fontWeight: active ? 700 : 400, fontSize: 14,
  color: active ? 'var(--accent)' : 'var(--text-secondary)',
  borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
  marginBottom: -2, textTransform: 'capitalize' as const,
});

export default function WorkerFinancePage() {
  const [tab, setTab]             = useState<Tab>('loans');
  const [loans, setLoans]         = useState<Loan[]>([]);
  const [advances, setAdvances]   = useState<any[]>([]);
  const [workers, setWorkers]     = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [loanModal, setLoanModal] = useState(false);
  const [haptaTarget, setHaptaTarget] = useState<Loan | null>(null);
  const [form, setForm]           = useState(BLANK_LOAN);
  const [haptaForm, setHaptaForm] = useState(BLANK_HAPTA);
  const [saving, setSaving]       = useState(false);
  const [actionId, setActionId]   = useState<number | null>(null);
  const toast = useToast();

  const loadLoans = () => apiFetch('/loans').then(setLoans).catch(e => toast(e.message, 'error'));
  const loadAdvances = () => {
    setLoading(true);
    apiFetch('/advances').then(setAdvances).catch(e => toast(e.message, 'error')).finally(() => setLoading(false));
  };

  useEffect(() => {
    apiFetch('/workers').then(setWorkers).catch(e => toast(e.message, 'error'));
    loadLoans();
    loadAdvances();
  }, []);

  const f  = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value }));
  const hf = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setHaptaForm(p => ({ ...p, [k]: e.target.value }));

  const saveLoan = async () => {
    if (!form.worker_id || !form.loan_amount || !form.hapta_amount) { toast('All fields required', 'error'); return; }
    setSaving(true);
    try {
      await apiFetch('/loans', { method: 'POST', body: JSON.stringify(form) });
      toast('Loan created'); setLoanModal(false); setForm(BLANK_LOAN); loadLoans();
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const recordHapta = async () => {
    if (!haptaTarget || !haptaForm.amount) { toast('Amount required', 'error'); return; }
    setSaving(true);
    try {
      await apiFetch(`/loans/${haptaTarget.id}/hapta`, { method: 'POST', body: JSON.stringify(haptaForm) });
      toast('Repayment recorded'); setHaptaTarget(null); setHaptaForm(BLANK_HAPTA); loadLoans();
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const advanceAction = async (id: number, type: 'approve' | 'reject') => {
    setActionId(id);
    try {
      await apiFetch(`/advances/${id}/${type}`, { method: 'PUT' });
      toast(type === 'approve' ? 'Approved' : 'Rejected'); loadAdvances();
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setActionId(null); }
  };

  const activeLoans     = loans.filter(l => l.status === 'active');
  const totalOutstanding = activeLoans.reduce((s, l) => s + Number(l.outstanding), 0);
  const pendingAdvances = advances.filter(a => a.status === 'pending');

  return (
    <div className="page-enter">
      <PageHeader title="Worker Finance" subtitle={`${activeLoans.length} active loans · ₹${totalOutstanding.toLocaleString('en-IN')} outstanding`}>
        {tab === 'loans' && (
          <button className="btn btn-primary" onClick={() => { setForm(BLANK_LOAN); setLoanModal(true); }}>
            <Icon name="plus" size={16} /> New Loan
          </button>
        )}
      </PageHeader>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--border)' }}>
        <button onClick={() => setTab('loans')} style={tabStyle(tab === 'loans')}>
          Loans {activeLoans.length > 0 && <span className="badge badge-info" style={{ marginLeft: 6 }}>{activeLoans.length}</span>}
        </button>
        <button onClick={() => setTab('advances')} style={tabStyle(tab === 'advances')}>
          Advances {pendingAdvances.length > 0 && <span className="badge badge-pending" style={{ marginLeft: 6 }}>{pendingAdvances.length}</span>}
        </button>
      </div>

      {/* Loans tab */}
      {tab === 'loans' && (
        <div className="card">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Worker</th><th>Loan Amount</th><th>Installment/mo</th><th>Total Paid</th><th>Outstanding</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {loans.map(l => (
                  <tr key={l.id}>
                    <td>
                      <strong>{l.erp_users?.name}</strong>
                      <br /><span className="text-secondary text-sm">{l.erp_users?.department || '—'}</span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-heading)' }}>₹{Number(l.loan_amount).toLocaleString('en-IN')}</td>
                    <td style={{ fontFamily: 'var(--font-heading)' }}>₹{Number(l.hapta_amount).toLocaleString('en-IN')}</td>
                    <td style={{ fontFamily: 'var(--font-heading)', color: 'var(--success)' }}>₹{Number(l.total_paid).toLocaleString('en-IN')}</td>
                    <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: Number(l.outstanding) > 0 ? 'var(--warning)' : 'var(--success)' }}>
                      ₹{Number(l.outstanding).toLocaleString('en-IN')}
                    </td>
                    <td><StatusBadge status={l.status} /></td>
                    <td>
                      {l.status === 'active' && (
                        <button className="btn btn-sm btn-primary"
                          onClick={() => { setHaptaTarget(l); setHaptaForm({ ...BLANK_HAPTA, amount: String(l.hapta_amount) }); }}>
                          Record Hapta
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {loans.length === 0 && (
                  <tr><td colSpan={7}><div className="empty-state">
                    <Icon name="banknote" size={40} color="var(--primary-light)" />
                    <p className="empty-state-title">No loans</p>
                  </div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Advances tab */}
      {tab === 'advances' && (
        <div className="card">
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="loading-spinner" /></div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Worker</th><th>Amount</th><th>Note</th><th>Date</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {advances.map(a => (
                    <tr key={a.id}>
                      <td><strong>{a.erp_users?.name}</strong></td>
                      <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 700 }}>₹{a.amount}</td>
                      <td className="text-secondary text-sm">{a.note || '—'}</td>
                      <td className="text-sm">{new Date(a.created_at).toLocaleDateString('en-IN')}</td>
                      <td><StatusBadge status={a.status} /></td>
                      <td>
                        {a.status === 'pending' && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-success btn-sm" onClick={() => advanceAction(a.id, 'approve')} disabled={actionId === a.id}>
                              <Icon name="check" size={14} /> Approve
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => advanceAction(a.id, 'reject')} disabled={actionId === a.id}>
                              <Icon name="x" size={14} /> Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {advances.length === 0 && (
                    <tr><td colSpan={6}><div className="empty-state">
                      <Icon name="indian-rupee" size={40} color="var(--primary-light)" />
                      <p className="empty-state-title">No advances</p>
                    </div></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* New Loan Modal */}
      <Modal open={loanModal} onClose={() => setLoanModal(false)} title="New Worker Loan"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setLoanModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveLoan} disabled={saving}>{saving ? 'Saving…' : 'Create Loan'}</button>
          </>
        }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Worker *</label>
            <select className="form-select" value={form.worker_id} onChange={f('worker_id')}>
              <option value="">Select worker…</option>
              {workers.map(w => <option key={w.id} value={w.id}>{w.name} ({(w.role ?? '').replace('_', ' ')})</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Loan Amount (₹) *</label>
              <input className="form-input" type="number" min="0" value={form.loan_amount} onChange={f('loan_amount')} placeholder="0" />
            </div>
            <div className="form-group">
              <label className="form-label">Monthly Installment (₹) *</label>
              <input className="form-input" type="number" min="0" value={form.hapta_amount} onChange={f('hapta_amount')} placeholder="0" />
            </div>
          </div>
        </div>
      </Modal>

      {/* Record Hapta Modal */}
      <Modal open={!!haptaTarget} onClose={() => setHaptaTarget(null)}
        title={`Record Repayment — ${haptaTarget?.erp_users?.name ?? ''}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setHaptaTarget(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={recordHapta} disabled={saving}>{saving ? 'Saving…' : 'Record'}</button>
          </>
        }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: '#FEF9C3', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Outstanding: </span>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--warning)' }}>
              ₹{haptaTarget ? Number(haptaTarget.outstanding).toLocaleString('en-IN') : 0}
            </span>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Amount (₹) *</label>
              <input className="form-input" type="number" min="0" value={haptaForm.amount} onChange={hf('amount')} />
            </div>
            <div className="form-group">
              <label className="form-label">Date</label>
              <input className="form-input" type="date" value={haptaForm.date} onChange={hf('date')} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Remarks</label>
            <input className="form-input" value={haptaForm.remarks} onChange={hf('remarks')} placeholder="Optional note…" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Navigate to `/admin/finance/workers`. Verify:
- Loans tab shows empty state with "New Loan" button
- Click New Loan → modal opens → fill worker + amounts → create → loan appears in table
- Click "Record Hapta" → pre-fills installment amount → submit → outstanding decreases
- Advances tab shows all advances with approve/reject buttons working

- [ ] **Step 3: Commit**

```bash
git add app/admin/finance/workers/page.tsx
git commit -m "feat: add worker finance admin page (loans + advances tabs)"
```

---

## Task 5: Reports API

**Files:**
- Create: `app/api/reports/[type]/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// app/api/reports/[type]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: { type: string } }) {
  try {
    requireAdmin(req);
    const from      = req.nextUrl.searchParams.get('from') || '2000-01-01';
    const to        = req.nextUrl.searchParams.get('to')   || '2099-12-31';
    const client_id = req.nextUrl.searchParams.get('client_id');
    const { type }  = params;

    switch (type) {
      case 'production': {
        const [h, c] = await Promise.all([
          supabase.from('hanks_production')
            .select('date, weight_kg, status, total_earned, erp_users(name), clients(name), qualities(name)')
            .gte('date', from).lte('date', to).order('date', { ascending: false }),
          supabase.from('coning_production')
            .select('date, output_kg, status, erp_users(name)')
            .gte('date', from).lte('date', to).order('date', { ascending: false }),
        ]);
        if (h.error) throw h.error;
        if (c.error) throw c.error;
        return NextResponse.json([
          ...(h.data ?? []).map((r: any) => ({ type: 'Hanks', worker: r.erp_users?.name, client: r.clients?.name, quality: r.qualities?.name, date: r.date, kg: r.weight_kg, earned: r.total_earned, status: r.status })),
          ...(c.data ?? []).map((r: any) => ({ type: 'Coning', worker: r.erp_users?.name, client: null, quality: null, date: r.date, kg: r.output_kg, earned: null, status: r.status })),
        ].sort((a, b) => a.date > b.date ? -1 : 1));
      }

      case 'stock': {
        const [inward, ready] = await Promise.all([
          supabase.from('stock_inward').select('date, received_weight_kg, remaining_weight_kg, clients(name), qualities(name)').order('date', { ascending: false }),
          supabase.from('ready_stock').select('weight_kg, grade, status, shades(name)').order('created_at', { ascending: false }),
        ]);
        if (inward.error) throw inward.error;
        if (ready.error) throw ready.error;
        return NextResponse.json({
          inward: (inward.data ?? []).map((r: any) => ({ client: r.clients?.name, quality: r.qualities?.name, date: r.date, received_kg: r.received_weight_kg, remaining_kg: r.remaining_weight_kg })),
          ready:  (ready.data ?? []).map((r: any) => ({ shade: r.shades?.name, weight_kg: r.weight_kg, grade: r.grade, status: r.status })),
        });
      }

      case 'dispatch': {
        const { data, error } = await supabase
          .from('dispatches')
          .select('invoice_no, date, qty_kg, rate, amount, vehicle_no, lr_no, clients(name)')
          .gte('date', from).lte('date', to).order('date', { ascending: false });
        if (error) throw error;
        return NextResponse.json((data ?? []).map((r: any) => ({
          invoice: r.invoice_no, date: r.date, client: r.clients?.name,
          qty_kg: r.qty_kg, rate: r.rate, amount: r.amount, vehicle: r.vehicle_no, lr: r.lr_no,
        })));
      }

      case 'finance': {
        const { data, error } = await supabase
          .from('client_transactions')
          .select('client_id, type, amount, clients(name)')
          .gte('date', from).lte('date', to);
        if (error) throw error;
        const map: Record<number, any> = {};
        for (const t of (data ?? [])) {
          const id = t.client_id;
          if (!map[id]) map[id] = { client: (t as any).clients?.name ?? `Client ${id}`, debit: 0, credit: 0 };
          if (t.type === 'debit') map[id].debit += Number(t.amount);
          else map[id].credit += Number(t.amount);
        }
        return NextResponse.json(Object.values(map).map(r => ({ ...r, balance: Number((r.debit - r.credit).toFixed(2)) })));
      }

      case 'worker-performance': {
        const [prod, att] = await Promise.all([
          supabase.from('hanks_production')
            .select('worker_id, weight_kg, total_earned, erp_users(name)')
            .eq('status', 'approved').gte('date', from).lte('date', to),
          supabase.from('attendance')
            .select('worker_id, status').gte('date', from).lte('date', to),
        ]);
        if (prod.error) throw prod.error;
        if (att.error) throw att.error;
        const map: Record<number, any> = {};
        for (const p of (prod.data ?? [])) {
          const id = p.worker_id;
          if (!map[id]) map[id] = { worker: (p as any).erp_users?.name, entries: 0, kg: 0, earned: 0, present: 0, halfday: 0 };
          map[id].entries += 1; map[id].kg += Number(p.weight_kg); map[id].earned += Number(p.total_earned ?? 0);
        }
        for (const a of (att.data ?? [])) {
          const id = a.worker_id;
          if (!map[id]) map[id] = { worker: `Worker ${id}`, entries: 0, kg: 0, earned: 0, present: 0, halfday: 0 };
          if (a.status === 'present') map[id].present += 1;
          if (a.status === 'halfday') map[id].halfday += 1;
        }
        return NextResponse.json(Object.values(map));
      }

      case 'party-ledger': {
        if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 });
        const { data, error } = await supabase
          .from('client_transactions')
          .select('date, type, particulars, amount, clients(name)')
          .eq('client_id', Number(client_id))
          .gte('date', from).lte('date', to)
          .order('date', { ascending: true }).order('created_at', { ascending: true });
        if (error) throw error;
        let balance = 0;
        const rows = (data ?? []).map((t: any) => {
          balance += t.type === 'debit' ? Number(t.amount) : -Number(t.amount);
          return { date: t.date, particulars: t.particulars, type: t.type, amount: t.amount, balance };
        });
        return NextResponse.json({ client: (data?.[0] as any)?.clients?.name ?? null, rows });
      }

      default:
        return NextResponse.json({ error: 'Unknown report type' }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message.includes('required') ? 403 : 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/reports/[type]/route.ts
git commit -m "feat: add reports API (production, stock, dispatch, finance, worker-performance, party-ledger)"
```

---

## Task 6: Reports Admin Page

**Files:**
- Create: `app/admin/reports/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
// app/admin/reports/page.tsx
'use client';
import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader, useToast, Icon } from '@/components/ui';

type ReportType = 'production' | 'stock' | 'dispatch' | 'finance' | 'worker-performance' | 'party-ledger';

const LABELS: Record<ReportType, string> = {
  production: 'Production',
  stock: 'Stock',
  dispatch: 'Dispatch',
  finance: 'Financial Summary',
  'worker-performance': 'Worker Performance',
  'party-ledger': 'Party Ledger',
};

function exportCSV(rows: any[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','));
  const csv = [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename + '.csv'; a.click();
  URL.revokeObjectURL(url);
}

const today       = new Date().toISOString().split('T')[0];
const firstOfMonth = today.slice(0, 7) + '-01';

const tabStyle = (active: boolean) => ({
  padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer',
  fontFamily: 'var(--font-heading)', fontWeight: active ? 700 : 400, fontSize: 13,
  color: active ? 'var(--accent)' : 'var(--text-secondary)',
  borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
  marginBottom: -2, whiteSpace: 'nowrap' as const,
});

function FlatTable({ rows }: { rows: any[] }) {
  if (!rows.length) return <div className="empty-state"><p className="empty-state-title">No data for this period</p></div>;
  const headers = Object.keys(rows[0]);
  const isMoney = (h: string) => ['amount', 'earned', 'debit', 'credit', 'balance', 'rate'].includes(h);
  const isDate  = (h: string) => h === 'date';
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead><tr>{headers.map(h => <th key={h} style={{ textTransform: 'capitalize' }}>{h.replace(/_/g, ' ')}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {headers.map(h => (
                <td key={h} style={{ fontFamily: typeof r[h] === 'number' ? 'var(--font-heading)' : undefined }}>
                  {r[h] == null ? '—'
                    : isDate(h) ? new Date(r[h]).toLocaleDateString('en-IN')
                    : isMoney(h) ? `₹${Number(r[h]).toLocaleString('en-IN')}`
                    : String(r[h])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ReportsPage() {
  const [tab, setTab]         = useState<ReportType>('production');
  const [from, setFrom]       = useState(firstOfMonth);
  const [to, setTo]           = useState(today);
  const [clientId, setClientId] = useState('');
  const [clients, setClients] = useState<any[]>([]);
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleTabChange = (t: ReportType) => {
    setTab(t); setData(null);
    if (t === 'party-ledger' && !clients.length) {
      apiFetch('/clients').then(setClients).catch(() => {});
    }
  };

  const generate = async () => {
    if (tab === 'party-ledger' && !clientId) { toast('Select a client', 'error'); return; }
    setLoading(true); setData(null);
    try {
      let url = `/reports/${tab}?from=${from}&to=${to}`;
      if (tab === 'party-ledger') url += `&client_id=${clientId}`;
      setData(await apiFetch(url));
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  };

  const doExport = () => {
    if (!data) return;
    if (tab === 'stock') { exportCSV(data.inward, `stock-inward-${from}-${to}`); return; }
    if (tab === 'party-ledger') { exportCSV(data.rows, `party-ledger-${from}-${to}`); return; }
    exportCSV(Array.isArray(data) ? data : [], `${tab}-${from}-${to}`);
  };

  const renderResult = () => {
    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="loading-spinner" /></div>;
    if (!data)   return <div className="empty-state"><Icon name="bar-chart-3" size={40} color="var(--primary-light)" /><p className="empty-state-title">Select a range and click Generate</p></div>;

    if (tab === 'stock') return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: 14, marginBottom: 12 }}>Stock Inward</h4>
          <FlatTable rows={data.inward} />
        </div>
        <div>
          <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: 14, marginBottom: 12 }}>Ready Stock</h4>
          <FlatTable rows={data.ready} />
        </div>
      </div>
    );

    if (tab === 'party-ledger') return (
      <div>
        <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: 14, marginBottom: 12 }}>Ledger — {data.client}</h4>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Date</th><th>Particulars</th><th>Debit (₹)</th><th>Credit (₹)</th><th>Balance (₹)</th></tr></thead>
            <tbody>
              {data.rows.map((r: any, i: number) => (
                <tr key={i}>
                  <td className="text-sm">{new Date(r.date).toLocaleDateString('en-IN')}</td>
                  <td>{r.particulars}</td>
                  <td style={{ fontFamily: 'var(--font-heading)', color: r.type === 'debit' ? 'var(--danger)' : undefined }}>{r.type === 'debit' ? `₹${Number(r.amount).toLocaleString('en-IN')}` : '—'}</td>
                  <td style={{ fontFamily: 'var(--font-heading)', color: r.type !== 'debit' ? 'var(--success)' : undefined }}>{r.type !== 'debit' ? `₹${Number(r.amount).toLocaleString('en-IN')}` : '—'}</td>
                  <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, color: r.balance > 0 ? 'var(--warning)' : 'var(--success)' }}>₹{Number(r.balance).toLocaleString('en-IN')}</td>
                </tr>
              ))}
              {data.rows.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 24 }}>No data</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );

    return <FlatTable rows={Array.isArray(data) ? data : []} />;
  };

  return (
    <div className="page-enter">
      <PageHeader title="Reports" subtitle="Generate and export production, finance & stock reports" />

      <div style={{ display: 'flex', gap: 2, marginBottom: 20, flexWrap: 'wrap', borderBottom: '2px solid var(--border)' }}>
        {(Object.keys(LABELS) as ReportType[]).map(t => (
          <button key={t} onClick={() => handleTabChange(t)} style={tabStyle(tab === t)}>{LABELS[t]}</button>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">From</label>
              <input className="form-input" type="date" value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">To</label>
              <input className="form-input" type="date" value={to} onChange={e => setTo(e.target.value)} />
            </div>
            {tab === 'party-ledger' && (
              <div className="form-group" style={{ marginBottom: 0, minWidth: 200 }}>
                <label className="form-label">Client *</label>
                <select className="form-select" value={clientId} onChange={e => setClientId(e.target.value)}>
                  <option value="">Select client…</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            <button className="btn btn-primary" onClick={generate} disabled={loading}>
              <Icon name="play" size={15} /> {loading ? 'Generating…' : 'Generate'}
            </button>
            {data && (
              <button className="btn btn-secondary" onClick={doExport}>
                <Icon name="download" size={15} /> Export CSV
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        {data && !loading && (
          <div className="card-body" style={{ borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14 }}>
              {LABELS[tab]} · {new Date(from).toLocaleDateString('en-IN')} – {new Date(to).toLocaleDateString('en-IN')}
            </span>
          </div>
        )}
        <div style={{ padding: 20 }}>{renderResult()}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Navigate to `/admin/reports`. Verify:
- All 6 tabs switch without error
- Production tab → Generate → shows table of hanks + coning entries
- Dispatch tab → Generate → shows invoice table
- Finance tab → Generate → shows per-client debit/credit/balance summary
- Party Ledger tab → requires client select, shows running balance
- Export CSV → downloads a `.csv` file that opens in Excel/Sheets

- [ ] **Step 3: Commit**

```bash
git add app/admin/reports/page.tsx
git commit -m "feat: add reports admin page (6 report types + CSV export)"
```

---

## Task 7: Worker Payslip API

**Files:**
- Create: `app/api/payroll/hanks/my/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// app/api/payroll/hanks/my/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user  = requireAuth(req);
    const month = req.nextUrl.searchParams.get('month');
    const year  = req.nextUrl.searchParams.get('year');
    if (!month || !year) return NextResponse.json({ error: 'month and year required' }, { status: 400 });

    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const end   = `${year}-${String(month).padStart(2, '0')}-31`;

    const [prodRes, advRes] = await Promise.all([
      supabase.from('hanks_production')
        .select('weight_kg, total_earned, status, date')
        .eq('worker_id', user.id)
        .gte('date', start).lte('date', end),
      supabase.from('worker_advances')
        .select('amount')
        .eq('worker_id', user.id).eq('status', 'approved')
        .gte('created_at', `${start}T00:00:00`).lte('created_at', `${end}T23:59:59`),
    ]);
    if (prodRes.error) throw prodRes.error;
    if (advRes.error) throw advRes.error;

    const approved       = (prodRes.data ?? []).filter(p => p.status === 'approved');
    const total_kg       = approved.reduce((s, p) => s + Number(p.weight_kg), 0);
    const gross_wages    = approved.reduce((s, p) => s + Number(p.total_earned ?? 0), 0);
    const total_advances = (advRes.data ?? []).reduce((s, a) => s + Number(a.amount), 0);

    return NextResponse.json({
      month: Number(month), year: Number(year),
      approved_entries: approved.length,
      total_entries: (prodRes.data ?? []).length,
      total_kg:       Number(total_kg.toFixed(2)),
      gross_wages:    Number(gross_wages.toFixed(2)),
      total_advances: Number(total_advances.toFixed(2)),
      net_wages:      Number(Math.max(0, gross_wages - total_advances).toFixed(2)),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 401 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/payroll/hanks/my/route.ts
git commit -m "feat: add worker payslip API (monthly summary with advances deduction)"
```

---

## Task 8: Worker Payslip Page

**Files:**
- Create: `app/worker/payslip/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
// app/worker/payslip/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useToast, Icon } from '@/components/ui';

interface Payslip {
  month: number; year: number;
  approved_entries: number; total_entries: number;
  total_kg: number; gross_wages: number;
  total_advances: number; net_wages: number;
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function Row({ label, value, color, large }: { label: string; value: string; color?: string; large?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: large ? 15 : 14, fontWeight: large ? 700 : 500, color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontSize: large ? 22 : 17, fontFamily: 'var(--font-heading)', fontWeight: 700, color: color || 'var(--text)' }}>{value}</span>
    </div>
  );
}

export default function WorkerPayslipPage() {
  const now = new Date();
  const [month, setMonth]   = useState(String(now.getMonth() + 1));
  const [year,  setYear]    = useState(String(now.getFullYear()));
  const [slip,  setSlip]    = useState<Payslip | null>(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const load = () => {
    setLoading(true); setSlip(null);
    apiFetch(`/payroll/hanks/my?month=${month}&year=${year}`)
      .then(setSlip).catch(e => toast(e.message, 'error')).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const years = Array.from({ length: 3 }, (_, i) => String(now.getFullYear() - i));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
      <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 20 }}>My Payslip</h2>

      <div className="card">
        <div className="card-body">
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="form-label">Month</label>
              <select className="form-select" value={month} onChange={e => setMonth(e.target.value)}>
                {MONTHS.map((m, i) => <option key={i+1} value={String(i+1)}>{m}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="form-label">Year</label>
              <select className="form-select" value={year} onChange={e => setYear(e.target.value)}>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button className="btn btn-primary" onClick={load} disabled={loading} style={{ whiteSpace: 'nowrap' }}>
              {loading
                ? <div className="loading-spinner loading-spinner-sm" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} />
                : <Icon name="search" size={16} />}
              View
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><div className="loading-spinner" /></div>
      )}

      {!loading && slip && (
        <div className="card" style={{ borderTop: '3px solid var(--accent)' }}>
          <div className="card-body" style={{ borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 16 }}>
              {MONTHS[slip.month - 1]} {slip.year}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
              {slip.approved_entries} approved of {slip.total_entries} entries
            </div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Row label="Total Weight"   value={`${slip.total_kg} kg`} />
            <Row label="Gross Earnings" value={`₹${slip.gross_wages.toLocaleString('en-IN')}`}   color="var(--success)" />
            <Row label="Advances Deducted" value={`−₹${slip.total_advances.toLocaleString('en-IN')}`} color="var(--danger)" />
            <div style={{ height: 1, background: 'var(--border)' }} />
            <Row label="Net Payable"    value={`₹${slip.net_wages.toLocaleString('en-IN')}`}   color="var(--accent)" large />
          </div>
        </div>
      )}

      {!loading && !slip && (
        <div className="card">
          <div className="empty-state">
            <Icon name="file-text" size={40} color="var(--primary-light)" />
            <p className="empty-state-title">Select a month to view payslip</p>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/worker/payslip/page.tsx
git commit -m "feat: add worker payslip page (monthly earnings breakdown)"
```

---

## Task 9: Admin Layout — Nav Sections + Finance + Reports

**Files:**
- Modify: `app/admin/layout.tsx`

- [ ] **Step 1: Replace flat NAV array with sectioned NAV_SECTIONS**

Replace the entire `interface NavItem` declaration and `const NAV` array (lines 8-29) and `const BOTTOM_NAV` (line 31) with:

```typescript
interface NavItem { id: string; label: string; icon: string; href: string; }
interface NavSection { label: string; items: NavItem[]; }

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Production',
    items: [
      { id: 'dashboard',   label: 'Dashboard',          icon: 'layout-dashboard', href: '/admin/dashboard' },
      { id: 'hanks',       label: 'Hanks Production',   icon: 'factory',          href: '/admin/production/hanks' },
      { id: 'conning',     label: 'Conning Production', icon: 'box',              href: '/admin/production/conning' },
      { id: 'dyeing',      label: 'Dyeing Production',  icon: 'droplets',         href: '/admin/production/dyeing' },
      { id: 'ready-stock', label: 'Ready Stock',         icon: 'warehouse',        href: '/admin/ready-stock' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { id: 'stock',    label: 'Stock Inward', icon: 'package-plus',   href: '/admin/stock-inward' },
      { id: 'orders',   label: 'Orders',       icon: 'clipboard-list', href: '/admin/orders' },
      { id: 'dispatch', label: 'Dispatch',     icon: 'truck',          href: '/admin/dispatch' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { id: 'finance-clients', label: 'Client Finance', icon: 'wallet',         href: '/admin/finance/clients' },
      { id: 'finance-workers', label: 'Worker Loans',   icon: 'banknote',       href: '/admin/finance/workers' },
      { id: 'advances',        label: 'Advances',       icon: 'indian-rupee',   href: '/admin/advances' },
      { id: 'payroll',         label: 'Payroll',        icon: 'file-bar-chart', href: '/admin/payroll' },
    ],
  },
  {
    label: 'Masters',
    items: [
      { id: 'workers',   label: 'Workers',   icon: 'users',   href: '/admin/masters/workers' },
      { id: 'clients',   label: 'Clients',   icon: 'archive', href: '/admin/masters/clients' },
      { id: 'qualities', label: 'Qualities', icon: 'layers',  href: '/admin/masters/qualities' },
      { id: 'machines',  label: 'Machines',  icon: 'cpu',     href: '/admin/masters/machines' },
      { id: 'shades',    label: 'Shades',    icon: 'palette', href: '/admin/masters/shades' },
      { id: 'items',     label: 'Items',     icon: 'tag',     href: '/admin/masters/items' },
    ],
  },
  {
    label: 'Other',
    items: [
      { id: 'attendance', label: 'Attendance',    icon: 'calendar-check', href: '/admin/attendance' },
      { id: 'reports',    label: 'Reports',       icon: 'bar-chart-3',    href: '/admin/reports' },
      { id: 'recipes',    label: 'Color Recipes', icon: 'flask-conical',  href: '/admin/recipes' },
    ],
  },
];

const ALL_NAV    = NAV_SECTIONS.flatMap(s => s.items);
const BOTTOM_NAV = [ALL_NAV[0], ALL_NAV[1], ALL_NAV[2], ALL_NAV[3], ALL_NAV[10]];
```

- [ ] **Step 2: Update sidebar nav render**

Replace the `<nav className="sidebar-nav">` block (lines 92-104) with:

```tsx
<nav className="sidebar-nav">
  {NAV_SECTIONS.map(section => (
    <div key={section.label}>
      <div className="sidebar-section-label">{section.label}</div>
      {section.items.map(item => (
        <Link
          key={item.id}
          href={item.href}
          className={`nav-item ${activeId === item.id ? 'active' : ''}`}
        >
          <Icon name={item.icon} size={18} className="nav-icon" />
          {item.label}
        </Link>
      ))}
    </div>
  ))}
</nav>
```

- [ ] **Step 3: Update activeId lookup**

The existing line `const activeId = NAV.find(...)` references the old `NAV`. Replace it with:

```typescript
const activeId = ALL_NAV.find(n => pathname?.startsWith(n.href))?.id ?? 'dashboard';
```

- [ ] **Step 4: Verify**

Navigate to `/admin/dashboard`. Sidebar should show 5 sections: Production, Operations, Finance (with Client Finance + Worker Loans + Advances + Payroll), Masters, Other. All existing links still work. Click Client Finance → goes to `/admin/finance/clients`. Click Reports → goes to `/admin/reports`.

- [ ] **Step 5: Commit**

```bash
git add app/admin/layout.tsx
git commit -m "refactor: restructure admin nav into sections, add Finance + Reports"
```

---

## Task 10: Worker Layout — Add Payslip Tab

**Files:**
- Modify: `app/worker/layout.tsx`

- [ ] **Step 1: Add Payslip to NAV array**

The current NAV array (lines 7-12) has 4 items. Add the 5th:

```typescript
const NAV = [
  { href: '/worker',            icon: 'home',            label: 'Entry' },
  { href: '/worker/history',    icon: 'clipboard-list',  label: 'History' },
  { href: '/worker/advances',   icon: 'indian-rupee',    label: 'Advance' },
  { href: '/worker/attendance', icon: 'calendar-check',  label: 'Attend' },
  { href: '/worker/payslip',    icon: 'file-text',       label: 'Payslip' },
];
```

- [ ] **Step 2: Verify**

Open app as a worker. Bottom nav now shows 5 tabs: Entry, History, Advance, Attend, Payslip. Tap Payslip → loads `/worker/payslip`. Month/year selector works, View button returns payslip data.

- [ ] **Step 3: Commit**

```bash
git add app/worker/layout.tsx
git commit -m "feat: add Payslip tab to worker bottom nav"
```

---

## Task 11: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Move completed items in the Phase 2 Build Log**

In the `### ✓ Done` section, add after the last bullet:

```markdown
- **Client Finance** — API at `app/api/finance/clients/` (GET summary/ledger, POST payment/adjustment). Admin page at `app/admin/finance/clients/page.tsx` (3 tabs: Ledger, Collections, Adjustments).
  - **DB table**: `client_transactions` (already existed; Dispatch writes debit rows)
- **Worker Loans** — API at `app/api/loans/` (GET/POST) + `app/api/loans/[id]/hapta/route.ts` (POST repayment). Admin page at `app/admin/finance/workers/page.tsx` (2 tabs: Loans + Advances).
  - **DB tables required**: run `worker_loans`, `loan_repayments` SQL from Phase 2 section above in Supabase
- **Reports** — API at `app/api/reports/[type]/route.ts` (6 types: production, stock, dispatch, finance, worker-performance, party-ledger; date range filter). Admin page at `app/admin/reports/page.tsx` (CSV export built-in).
- **Worker Payslip** — API at `app/api/payroll/hanks/my/route.ts` (GET monthly summary). Worker page at `app/worker/payslip/page.tsx`. Payslip tab added to worker bottom nav.
- **Admin nav restructured** — sectioned into Production / Operations / Finance / Masters / Other.
```

- [ ] **Step 2: Update the `### 🔲 Next` section**

Replace entire Next section with:

```markdown
### 🔲 Next

**Phase 2 complete.** All features built.

Known tech debt:
- Topbar search is decorative
- Bell icon notifications are decorative
- Worker history has no date/month filter
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: mark Phase 2 complete in CLAUDE.md"
```

---

## Self-Review

**Spec coverage check:**
- Client Finance (Ledger, Collections, Adjustments) ✓ Task 1-2
- Worker Loans (create + hapta) ✓ Task 3-4
- Reports (6 types + CSV) ✓ Task 5-6
- Worker Payslip ✓ Task 7-8
- Admin nav update (Finance section) ✓ Task 9
- Worker nav update (Payslip tab) ✓ Task 10
- CLAUDE.md update ✓ Task 11

**DB tables needed before running:**
- `worker_loans` + `loan_repayments` — run the SQL from CLAUDE.md Phase 2 section in Supabase
- `client_transactions` — already exists (Dispatch creates it)
- All other tables (coning_production, machines, shades, etc.) — already created in earlier Phase 2 work
