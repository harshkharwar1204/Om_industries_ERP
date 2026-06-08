# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Dev server (Next.js on port 3000)
npm run dev

# Production build
npm run build

# Start production server
npm run start
```

No test suite exists. Verify changes by running the dev server.

---

## Architecture

This is **OM INDUSTRIES ERP** — a yarn/textile factory management system for Surat, Gujarat.

> **Migration note**: App was fully migrated from Express + Vite/React to **Next.js 14 App Router** (commit `a8addcc`). The old `server/` and `src/` directories are gone. All backend logic is now in `app/api/` as Next.js Route Handlers.

### Factory Process Flow

Raw yarn received → **Hanks Production** → **Dyeing** → **Conning** → **Ready Stock** → **Dispatch** → **Client Finance**

### Backend (`app/api/`)

All routes are Next.js Route Handlers (TypeScript). Auth helpers in `lib/auth.ts`:
- `requireAuth(req)` — verifies JWT, returns `JWTPayload`
- `requireAdmin(req)` — requires `role === 'admin'`
- `requireWorker(req)` — requires `hanks_worker` or `coning_worker`
- `authError(msg)` — returns 401/403 response

Supabase client singleton in `lib/supabase.ts` (reads `SUPABASE_URL` + `SUPABASE_KEY`).

### Frontend (`app/`)

- `app/layout.tsx` — Root layout wraps everything in `<AuthProvider>` + `<ToastProvider>`
- `context/AuthContext.tsx` — Global auth state; stores JWT in `localStorage` as `erp_token`
- `lib/api.ts` — All API calls (attaches Bearer token from localStorage for authed routes)
- `app/admin/layout.tsx` — Admin layout with sidebar + topbar; redirects non-admins
- `app/worker/layout.tsx` — Worker layout; redirects non-workers
- `app/login/page.tsx` — Phone+PIN login + Google Sign-In button
- `app/onboarding/page.tsx` — Role selection for new Google sign-ins
- `components/ui/` — Shared UI components (Toast, Modal, StatusBadge, Icon, PageHeader, StatCard, etc.)

### Auth Flow

**Phone+PIN**: phone + 4-digit PIN → bcrypt verify → 30-day JWT → stored as `erp_token` in localStorage

**Google Sign-In**:
1. Google GSI returns `credential` token to frontend
2. POST `/api/auth/google` — verifies token with `google-auth-library`
3. **Existing user** → issues JWT, returns `{ token, user, isNew: false }`
4. **New user** → returns `{ isNew: true, profile }` — redirected to `/onboarding`
5. POST `/api/auth/complete` — creates account with chosen role, issues JWT
6. After auth: `window.location.href = '...'` (full reload) — required so `AuthContext` re-reads token

**Important**: `router.replace()` after Google auth keeps `user=null` (stale closure). Always use `window.location.href` for post-auth redirects.

Roles: `admin`, `hanks_worker`, `coning_worker`, `dyeing_master`
- Workers redirect to `/worker`
- Admins redirect to `/admin/dashboard`

### Database (Supabase)

Schema is in `supabase_erp_schema.sql`. Existing tables:
- `erp_users` — all users; `phone` unique; `email` + `google_id` for Google auth
- `hanks_production` — worker production entries with `pending/approved/rejected` status
- `stock_inward` — raw yarn arrivals, `remaining_weight_kg` tracked
- `worker_advances` — salary advance requests
- `sessions` — JWT session store
- `clients`, `qualities` — master data

RLS enabled, all policies `USING (true)` — auth enforced at API layer only.

`GET /api/workers` excludes admins.
`GET /api/clients` and `GET /api/qualities` allow any authenticated user (workers need these for dropdowns).

### Environment

`.env.local` needs:
```
SUPABASE_URL=...
SUPABASE_KEY=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
JWT_SECRET=...              # optional, has hardcoded fallback
GOOGLE_CLIENT_ID=...        # required for Google Sign-In
```

### PWA

App is a PWA (`public/manifest.json`, `public/sw.js`). Optimized for mobile — workers use it on phones.

---

## Design System

Reference prototype in `ERP-handoff/erp/project/` — pixel-perfect designs for all screens.

### Color Tokens

| Token | Value | Usage |
|---|---|---|
| Primary | `#64748B` | Sidebar, headers |
| Accent | `#F97316` | CTA buttons, active states |
| Success | `#16A34A` | Approved, positive |
| Warning | `#EAB308` | Pending states |
| Danger | `#DC2626` | Rejected, delete |
| Info | `#2563EB` | Links, badges |
| Background | `#F8FAFC` | Page bg |
| Surface | `#FFFFFF` | Cards, modals |
| Text | `#1E293B` | Body text |
| Text Secondary | `#64748B` | Labels, captions |

### Typography
- Headings: `Fira Code` (monospace, weights 500/600/700)
- Body: `Fira Sans` (weights 300/400/500/600)
- Min body: 16px. Min touch target: 44×44px.

### Rules
- NO dark mode (factory workers in sunlight need light UI)
- NO glassmorphism/blur (cheap phone performance)
- NO animations > 300ms
- NO horizontal scroll on mobile
- NO text < 14px
- Use Lucide React icons only

---

## Phase 1 — BUILT ✓

| Module | Routes | Pages |
|---|---|---|
| Auth | `/api/auth/*` | `/login`, `/onboarding` |
| Hanks Production | `/api/production/hanks/*` | `/admin/production/hanks`, `/worker` |
| Worker History | `/api/production/hanks/my` | `/worker/history` |
| Advances | `/api/advances/*` | `/admin/advances`, `/worker/advances` |
| Payroll | `/api/payroll/hanks` + export | `/admin/payroll` |
| Stock Inward | `/api/stock/inward`, `/api/stock/summary` | `/admin/stock-inward` |
| Masters | `/api/clients/*`, `/api/qualities/*`, `/api/workers/*` | `/admin/masters/clients`, `/admin/masters/qualities`, `/admin/masters/workers` |
| Color Recipes | `/api/colors/*`, `/api/recipes/*` | `/admin/recipes` |
| Dashboard | — | `/admin/dashboard` |

---

## Phase 2 — TO BUILD

Design reference for all screens: `ERP-handoff/erp/project/`

### Remaining (not yet built)
1. **Client Finance** — `app/api/finance/clients/` + `app/admin/finance/clients/` — ledger, payment collections, adjustments
2. **Worker Loans** — `app/api/loans/` + sub-tab in worker finance admin page
3. **Reports** — `app/api/reports/[type]/` + `app/admin/reports/` — 6 report types + export
4. **Worker Payslip** — `app/worker/payslip/` — worker sees own monthly pay breakdown

### Priority Order (original)
10. **New Masters** (Machines, Shades/Items — needed by Dyeing)
11. **Worker payslip** (worker sees own monthly earnings)
12. **Stock deduction** (approved production should reduce `remaining_weight_kg`)

---

### Feature Specs

#### Coning Production
- **Route**: `GET/POST /api/production/coning`
- **Admin page**: `/admin/production/conning`
- **Worker page**: `/worker` already handles hanks — need separate flow for coning_worker role showing coning form
- **Fields**: lot_id, party (auto-fill), shade (auto-fill), cone_weight_kg, cones_count, output_kg (auto), quality (Pass/Reject)
- **DB table needed**: `coning_production` (lot_id, worker_id, date, cone_weight_kg, cones_count, output_kg, quality, status)
- **Design ref**: `ERP-handoff/erp/project/conning-stock.jsx`

#### Dyeing Production
- **Route**: `GET/POST /api/production/dyeing`, approve/reject endpoints
- **Admin page**: `/admin/production/dyeing`
- **Fields**: lot_id, shade_id, recipe_id, machine_id, operator_id (dyeing_master), input_kg, output_kg, loss_pct (auto-calc), status
- **DB tables needed**: `dyeing_production`, `machines` (master), `shades` (master)
- **Design ref**: `ERP-handoff/erp/project/dyeing.jsx`

#### Attendance
- **Routes**: `GET/POST /api/attendance`
- **Admin page**: `/admin/attendance` — grid of all workers, mark Present/HalfDay/Absent/Leave per day, "Save All" button
- **Worker page**: `/worker/attendance` — calendar view (P/H/A/L per day)
- **DB table needed**: `attendance` (worker_id, date, status: present/halfday/absent/leave)
- **Design ref**: `ERP-handoff/erp/project/attendance-recipes.jsx`

#### Ready Stock
- **Route**: `GET /api/stock/ready`
- **Admin page**: `/admin/ready-stock`
- **Auto-populated** from approved coning entries
- **Fields**: lot_id, party, shade, cones, weight_kg, grade (A/Standard/B), location, status (Available/Reserved/Dispatched)
- **DB table needed**: `ready_stock`
- **Design ref**: `ERP-handoff/erp/project/conning-stock.jsx`

#### Orders
- **Routes**: `GET/POST /api/orders`, `GET/PUT /api/orders/[id]`
- **Admin page**: `/admin/orders`
- **Fields**: party_id, po_number, item, shade_id, qty_kg, rate, delivery_date, priority (Low/Medium/High/Urgent)
- **Status flow**: Pending → Processing → Completed / Cancelled
- **DB table needed**: `orders`
- **Design ref**: `ERP-handoff/erp/project/operations.jsx`

#### Dispatch
- **Routes**: `GET/POST /api/dispatch`
- **Admin page**: `/admin/dispatch`
- **Fields**: invoice_no (auto: INV-YYYY-NNN), party_id, order_id, stock_id, qty_kg, rate, amount (auto), vehicle_no, lr_no
- **On save**: marks ready_stock status = Dispatched, creates client finance debit entry
- **DB table needed**: `dispatches`
- **Design ref**: `ERP-handoff/erp/project/operations.jsx`

#### Client Finance
- **Routes**: `GET /api/finance/clients/ledger`, `POST /api/finance/clients/payment`
- **Admin page**: `/admin/finance/clients`
- **Three sub-tabs**: Ledger (running balance per party), Collections (record payments), Adjustments
- **DB table needed**: `client_transactions` (party_id, date, type: debit/credit, particulars, amount)
- **Design ref**: `ERP-handoff/erp/project/finance.jsx`

#### Worker Loans
- **Routes**: `GET/POST /api/loans`, `POST /api/loans/[id]/hapta`
- **Admin page**: sub-tab in `/admin/finance/workers` (alongside existing advances)
- **Fields**: worker_id, loan_amount, hapta_amount (installment), total_paid, outstanding
- **DB tables needed**: `worker_loans`, `loan_repayments`
- **Design ref**: `ERP-handoff/erp/project/finance.jsx`

#### New Masters
- **Machines**: `GET/POST /api/masters/machines` → `/admin/masters/machines`
  - Fields: name, code, capacity, type (HTHP/Jigger/SoftFlow/Winch), status (Active/Inactive/Maintenance)
  - DB: `machines` table
- **Shades**: `GET/POST /api/masters/shades` → `/admin/masters/shades`
  - Fields: name, code, description
  - DB: `shades` table
- **Items**: `GET/POST /api/masters/items` → `/admin/masters/items`
  - Fields: name, code, unit, description
  - DB: `items` table
- **Design ref**: `ERP-handoff/erp/project/masters.jsx`

#### Reports
- **Route**: `GET /api/reports/[type]`
- **Admin page**: `/admin/reports`
- **Report types**: Production, Stock, Dispatch, Financial Summary, Worker Performance, Party Ledger
- Each: date range filter + table + Excel export
- **Design ref**: `ERP-handoff/erp/project/reports-settings.jsx`

#### Worker Payslip
- **Route**: `GET /api/payroll/hanks/my?month=&year=`
- **Worker page**: `/worker/payslip`
- Shows worker's own monthly breakdown: entries, kg, gross, advances deducted, net

#### Stock Deduction Fix
- When admin **approves** a `hanks_production` entry, deduct `weight_kg` from `stock_inward.remaining_weight_kg` for matching client + quality (FIFO — oldest lot first)
- Currently NOT implemented — `remaining_weight_kg` never decreases

---

### New DB Tables Needed (Phase 2)

```sql
-- Run in Supabase SQL editor
CREATE TABLE machines (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  capacity TEXT,
  type TEXT,  -- HTHP, Jigger, SoftFlow, Winch
  status TEXT DEFAULT 'active',  -- active, inactive, maintenance
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE shades (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE items (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  unit TEXT DEFAULT 'kg',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE dyeing_production (
  id SERIAL PRIMARY KEY,
  lot_id INTEGER REFERENCES stock_inward(id),
  shade_id INTEGER REFERENCES shades(id),
  machine_id INTEGER REFERENCES machines(id),
  operator_id INTEGER REFERENCES erp_users(id),
  input_kg NUMERIC NOT NULL,
  output_kg NUMERIC,
  loss_pct NUMERIC GENERATED ALWAYS AS (
    CASE WHEN input_kg > 0 THEN ROUND((input_kg - output_kg) / input_kg * 100, 2) ELSE 0 END
  ) STORED,
  status TEXT DEFAULT 'pending',  -- pending, running, completed, rework, rejected
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE coning_production (
  id SERIAL PRIMARY KEY,
  lot_id INTEGER REFERENCES stock_inward(id),
  worker_id INTEGER REFERENCES erp_users(id),
  cone_weight_kg NUMERIC,
  cones_count INTEGER,
  output_kg NUMERIC,
  quality TEXT DEFAULT 'pass',  -- pass, reject
  status TEXT DEFAULT 'pending',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ready_stock (
  id SERIAL PRIMARY KEY,
  lot_id INTEGER REFERENCES stock_inward(id),
  coning_id INTEGER REFERENCES coning_production(id),
  shade_id INTEGER REFERENCES shades(id),
  cones INTEGER,
  weight_kg NUMERIC,
  grade TEXT DEFAULT 'standard',  -- a_grade, standard, b_grade
  location TEXT,
  status TEXT DEFAULT 'available',  -- available, reserved, dispatched
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id),
  po_number TEXT,
  item_id INTEGER REFERENCES items(id),
  shade_id INTEGER REFERENCES shades(id),
  qty_kg NUMERIC,
  rate NUMERIC,
  delivery_date DATE,
  priority TEXT DEFAULT 'medium',  -- low, medium, high, urgent
  status TEXT DEFAULT 'pending',   -- pending, processing, completed, cancelled
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE dispatches (
  id SERIAL PRIMARY KEY,
  invoice_no TEXT UNIQUE,
  client_id INTEGER REFERENCES clients(id),
  order_id INTEGER REFERENCES orders(id),
  stock_id INTEGER REFERENCES ready_stock(id),
  qty_kg NUMERIC,
  rate NUMERIC,
  amount NUMERIC,
  vehicle_no TEXT,
  lr_no TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE client_transactions (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id),
  date DATE NOT NULL,
  type TEXT NOT NULL,  -- debit, credit
  particulars TEXT,
  amount NUMERIC NOT NULL,
  reference_id INTEGER,  -- dispatch id or payment id
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE worker_loans (
  id SERIAL PRIMARY KEY,
  worker_id INTEGER REFERENCES erp_users(id),
  loan_amount NUMERIC NOT NULL,
  hapta_amount NUMERIC NOT NULL,  -- monthly installment
  total_paid NUMERIC DEFAULT 0,
  outstanding NUMERIC,
  status TEXT DEFAULT 'active',   -- active, closed
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE loan_repayments (
  id SERIAL PRIMARY KEY,
  loan_id INTEGER REFERENCES worker_loans(id),
  worker_id INTEGER REFERENCES erp_users(id),
  amount NUMERIC NOT NULL,
  date DATE NOT NULL,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE attendance (
  id SERIAL PRIMARY KEY,
  worker_id INTEGER REFERENCES erp_users(id),
  date DATE NOT NULL,
  status TEXT NOT NULL,  -- present, halfday, absent, leave
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(worker_id, date)
);
```

---

### Phase 2 Admin Nav Updates

Add to sidebar in `app/admin/layout.tsx`:
```
Production:
  - Hanks Production (existing)
  - Dyeing Production (new)
  - Conning Production (new)
  - Ready Stock (new)

Operations:
  - Stock Inward (existing)
  - Orders (new)
  - Dispatch (new)

Finance:
  - Advances (existing, move here)
  - Worker Loans (new)
  - Payroll (existing, move here)
  - Client Finance (new)

Masters (add):
  - Machines (new)
  - Shades (new)
  - Items (new)

New top-level:
  - Attendance (new)
  - Reports (new)
```

### Phase 2 Worker App Updates

Add to worker bottom nav:
- Attendance tab → `/worker/attendance`
- Payslip tab → `/worker/payslip`

Worker production entry (`/worker/page.tsx`) needs:
- Show estimated earnings preview (weight × rate) before submit
- Route coning_worker role to coning form instead of hanks form
- Route dyeing_master role to dyeing form

---

## Phase 2 Build Log

### ✓ Done
- **Stock deduction fix** — `approve` endpoint now FIFO-deducts `remaining_weight_kg` from `stock_inward` on hanks approval (`app/api/production/hanks/[id]/approve/route.ts`)
- **Coning Production** — API at `app/api/production/coning/` (GET/POST, my, approve, reject). Admin page at `app/admin/production/conning/page.tsx`. Worker page routes by role: `coning_worker` sees coning form, `hanks_worker` sees hanks form. Estimated earnings preview added to both forms. Admin nav updated with Conning link.
  - **DB table required**: run `coning_production` SQL from Phase 2 section above in Supabase
- **New Masters (Machines, Shades, Items)** — APIs at `app/api/masters/{machines,shades,items}/`. Admin pages at `app/admin/masters/{machines,shades,items}/page.tsx`. Added to sidebar nav.
  - **DB tables required**: run `machines`, `shades`, `items` SQL from Phase 2 section above in Supabase
- **Dyeing Production** — API at `app/api/production/dyeing/` (GET/POST, approve with output_kg, reject). Admin page at `app/admin/production/dyeing/page.tsx`. Loss % auto-calculated. Admin can complete batch by entering output_kg.
  - **DB table required**: run `dyeing_production` SQL from Phase 2 section above in Supabase

- **Attendance** — API at `app/api/attendance/route.ts` (GET with date/worker_id/month+year filter, POST bulk upsert). Admin page at `app/admin/attendance/page.tsx` (daily card view + monthly grid). Worker page at `app/worker/attendance/page.tsx` (calendar view, read-only). Worker bottom nav + admin sidebar both updated.
  - **DB table required**: run `attendance` SQL from Phase 2 section above in Supabase
- **Ready Stock** — API at `app/api/stock/ready/route.ts` (GET with status filter, POST new entry, PATCH update status). Admin page at `app/admin/ready-stock/page.tsx`. Stats cards, searchable table, Add Entry modal.
  - **DB table required**: run `ready_stock` SQL from Phase 2 section above in Supabase
- **Orders + Dispatch** — APIs at `app/api/orders/` and `app/api/dispatch/route.ts`. Admin pages at `app/admin/orders/page.tsx` and `app/admin/dispatch/page.tsx`. Dispatch auto-generates invoice numbers and creates `client_transactions` debit entries.
  - **DB tables required**: run `orders`, `dispatches` SQL from Phase 2 section above in Supabase
- **Client Finance** — API at `app/api/finance/clients/route.ts` (GET ledger/summary, POST payment/adjustment). Admin page at `app/admin/finance/clients/page.tsx` (3 tabs: Ledger, Collections, Adjustments).
  - **DB table**: `client_transactions` already existed; Dispatch writes debit rows
- **Worker Loans** — API at `app/api/loans/route.ts` (GET/POST) + `app/api/loans/[id]/hapta/route.ts` (POST repayment). Admin page at `app/admin/finance/workers/page.tsx` (2 tabs: Loans + Advances).
  - **DB tables required**: run `worker_loans`, `loan_repayments` SQL from Phase 2 section above in Supabase
- **Reports** — API at `app/api/reports/[type]/route.ts` (6 types: production, stock, dispatch, finance, worker-performance, party-ledger; date range filter). Admin page at `app/admin/reports/page.tsx` (CSV export built-in, client-side generation).
- **Worker Payslip** — API at `app/api/payroll/hanks/my/route.ts` (GET monthly summary with advances deduction). Worker page at `app/worker/payslip/page.tsx`. Payslip tab added to worker bottom nav.
- **Admin nav restructured** — Sidebar now has 5 sections: Production / Operations / Finance / Masters / Other. Finance section links to Client Finance, Worker Loans, Advances, Payroll.
- **Dashboard revamped** — `app/admin/dashboard/page.tsx`. 8 KPI cards (pending approvals split by type, pending orders, client outstanding, today's dispatch amount, ready stock kg, loan outstanding, attendance today, workers). Auto-refresh every 30s with manual refresh + timestamp. Recent dispatches table. 6 quick actions. Pending approval alert banner with direct approve links.

### Bug Fixes (post-build)
- **Payslip date range** — `app/api/payroll/hanks/my/route.ts`: end date now uses `new Date(year, month, 0)` to get actual last day of month (was hardcoded `–31`)
- **Stock report column** — `app/api/reports/[type]/route.ts`: `stock_inward` query used nonexistent `received_weight_kg`; fixed to `weight_kg`
- **Finance report adjustments** — `app/api/reports/[type]/route.ts`: finance summary now tracks `debit`, `credit`, `adjustment` as separate columns; `balance = debit - credit - adjustment`
- **Client ledger UI adjustments** — `app/admin/finance/clients/page.tsx`: adjustment type now renders in blue with `(adj)` tag, distinct from credit
- **Hapta race condition** — `app/api/loans/[id]/hapta/route.ts`: after inserting repayment, recomputes `total_paid` via SUM of all `loan_repayments` rows (not stale in-memory value)
- **Shades FK alias conflict** — Supabase PostgREST throws `column shades_1.name does not exist` when `shades` is joined alongside other FK relationships. Fixed by removing `shades(name)` join from `orders`, `stock/ready`, and `dispatch` APIs; pages look up shade name from locally loaded shades array instead.

### 🔲 Next

**Phase 2 complete.** All features built and tested.

Known tech debt:
- Topbar search is decorative
- Bell icon notifications are decorative
- Worker history has no date/month filter
- Dispatch page: shade name not shown in table (removed to fix Supabase FK alias conflict)

---

## Known Issues / Tech Debt

- Topbar search input is decorative — no functionality
- Bell icon notifications — decorative
- Worker history has no date/month filter
- Dispatch page shade column: `ready_stock → shades` nested join causes `shades_2.name` Supabase error; workaround is to not join shades in dispatch API
