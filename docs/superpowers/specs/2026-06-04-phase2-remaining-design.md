# Phase 2 Remaining Features Design

**Date**: 2026-06-04  
**Scope**: Client Finance, Worker Loans, Reports, Worker Payslip

---

## 1. Client Finance

**Route**: `GET /api/finance/clients/ledger`, `POST /api/finance/clients/payment`  
**Admin page**: `/admin/finance/clients`

Three tabs on one page:

- **Ledger** — select client → running debit/credit balance table. Columns: Date, Particulars, Debit, Credit, Balance. Balance auto-calculated client-side from `client_transactions` rows ordered by date asc.
- **Collections** — form to record a payment (credit): client_id, date, amount, remarks. POSTs to `/api/finance/clients/payment` which inserts a `credit` row in `client_transactions`.
- **Adjustments** — same form but type = `adjustment`; optional particulars.

DB: `client_transactions` table already exists (Dispatch writes debit rows). No new tables.

---

## 2. Worker Loans

**Routes**: `GET/POST /api/loans`, `POST /api/loans/[id]/hapta`  
**Admin page**: `/admin/finance/workers` (tabs: Advances | Loans)

- **Advances tab** — move existing `/admin/advances` content here (or keep as separate page and link both from Finance nav section)  
- **Loans tab** — table of all worker loans with outstanding balance. "New Loan" modal: worker, loan_amount, hapta_amount (monthly installment). "Record Hapta" button per row → modal to record repayment.

DB tables: `worker_loans`, `loan_repayments`

---

## 3. Reports

**Route**: `GET /api/reports/[type]?from=&to=`  
**Admin page**: `/admin/reports`

Single page, tab-per-report-type:

| Tab | Type param | Source tables | Key columns |
|-----|------------|---------------|-------------|
| Production | `production` | `hanks_production`, `coning_production`, `dyeing_production` | Worker, Date, Kg, Status |
| Stock | `stock` | `stock_inward`, `ready_stock` | Client, Quality, Received, Remaining |
| Dispatch | `dispatch` | `dispatches` + `clients` | Invoice, Client, Qty, Amount |
| Financial Summary | `finance` | `client_transactions` | Client, Total Debit, Total Credit, Balance |
| Worker Performance | `worker-performance` | `hanks_production`, `coning_production`, attendance | Worker, Days Present, Kg produced |
| Party Ledger | `party-ledger` | `client_transactions` | Per-client running ledger |

Each tab: date range picker (from/to) → "Generate" button → table → "Export CSV" button (client-side CSV generation, no server export needed).

---

## 4. Worker Payslip

**Route**: Reuses `GET /api/payroll/hanks/my?month=&year=`  
**Worker page**: `/worker/payslip`  
**Nav**: Add "Payslip" tab to worker bottom nav (5th tab)

UI: month/year selector → card showing:
- Entries count + total kg
- Gross earnings (kg × rate)
- Advances deducted (from `worker_advances` for that month)
- Net payable

---

## Nav Changes

### Admin sidebar — add Finance section

```
Finance:
  - Client Finance  → /admin/finance/clients
  - Worker Loans    → /admin/finance/workers
  - Advances        → /admin/advances  (keep existing page, also link here)
  - Payroll         → /admin/payroll   (keep existing page, also link here)

New top-level:
  - Reports         → /admin/reports
```

### Worker bottom nav — add Payslip

```
Entry | History | Advance | Attend | Payslip
```

---

## Build Order

1. Client Finance (API + page)
2. Worker Loans (API + page)
3. Reports (API + page)
4. Worker Payslip (API + page)
5. Update admin layout nav + worker layout nav
6. Update CLAUDE.md
