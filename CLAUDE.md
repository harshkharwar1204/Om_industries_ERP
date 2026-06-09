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

## Post-Phase-2 Fixes & Polish (this session)

- **Mobile-first UI overhaul** — modals are bottom sheets on ≤768px, admin bottom nav changed to Dashboard/Hanks/Attendance/Dispatch/More, page title in mobile topbar, safe-area insets for iPhone X, `.hide-mobile` table column utility
- **Login page redesign** — Google SDK `renderButton` replaced with custom button + `prompt()` (was overflowing mobile). Added full Phone+PIN signup flow (`/api/auth/register`). Login page redirects away if already authenticated (fixes browser back/forward bypass).
- **Shades DB schema fix** — `shades` table existed as recipe-level rows (`recipe_id`, `shade_number`) from original recipe system. Phase 2 `CREATE TABLE shades` silently failed. Fixed via migration: added `name`, `code`, `description` columns. Masters API filters `.is('recipe_id', null)` for master shades; recipe shades have `recipe_id` set.
- **Attendance date bug** — `/api/attendance/route.ts` hardcoded `-31` as end day → `2026-06-31` invalid. Fixed to `new Date(year, month, 0)`.
- **Icon system** — Added missing Lucide icons to `Icon.tsx`: `file-text`, `chevron-left`, `droplets`, `warehouse`, `wallet`, `banknote`, `palette`, `tag`, `bar-chart-3`, `phone`.
- **PageHeader icons** — Added `icon` + `iconColor` props. Updated: Dyeing, Ready Stock, Client Finance, Worker Finance, Shades, Items, Reports pages.
- **StatCard links** — Added `href` prop; all 8 dashboard KPI cards now navigate to their respective pages. Quick Actions section removed.
- **Recipes FK fix** — `ingredients(*)` wildcard triggered auto-embed of `shades` from within ingredients (via `shade_id` FK) → `shades_1.name` alias conflict. Fixed by listing explicit columns.

---

## Known Issues / Tech Debt

- Topbar search input is decorative — no functionality
- Bell icon notifications — decorative
- Worker history has no date/month filter
- Dispatch page shade column: `ready_stock → shades` nested join causes `shades_2.name` Supabase error; workaround is to not join shades in dispatch API
- `shades` table is dual-purpose (recipe shades via `recipe_id` + master shades via `recipe_id IS NULL`) — tech debt from schema collision

---

## Phase 4 — BUILT ✓ (inter-unit transfer chain + Modules 4/6/8 + autocomplete + Excel)

Supabase project: **Color-recipe-pro** `bbprchdwdckqeujhzrtd` (same DB as recipe app).

### Inter-unit transfer chain (now wired end-to-end)
`stock_inward → hanks(Unit2) → grey_stock(Unit1) → dyed_stock(batch) → coning → ready_stock(packed) → challan`.
- Helper `lib/transfer.ts`: `consumePool()` (FIFO from grey/dyed pools), `addOrderProgress()` (fulfillment rollup by client+quality+shade → `orders.received_kg/dyed_kg/coned_kg`, auto-advances status).
- Hanks approve → inserts `grey_stock` + received rollup.
- Dyeing complete → creates `dyed_stock` (batch), deducts `chemicals` (movements ledger), dyed rollup.
- Coning approve → consumes `dyed_stock`, creates `ready_stock` (packed), coned rollup.
- Challan create → marks `ready_stock` dispatched.

### New tables (migrations applied)
`grey_stock`, `dyed_stock`, `chemicals`, `chemical_movements`, `challans`, `challan_items`, `app_settings`. Columns added: `orders.{quality_id,received_kg,dyed_kg,coned_kg}`, `dyeing_production.{client_id,quality_id,recipe_id,batch_no,grey_consumed}`, `coning_production.{dyed_stock_id,shade_id}`, `ready_stock.{client_id,quality_id,batch_no,remaining_kg}`.

### Module 4 Dyeing (full)
`lib/dyecalc.ts` scales recipe ingredients to batch weight (% owf, g/L via MLR, per-kg). New batch form pulls recipe (recipe app `recipes/shades/ingredients`), auto-scales dye weights, weighing checklist gating start, batch_no `B-YYYY-NNN`. Complete passes chemicals→deducted. "Add Correction"→`chemical_movements`. Routes: `dyeing/route.ts` (POST consumes grey), `[id]/approve`, `[id]/correction`.

### Module 6 A5 Delivery Challan
API `app/api/challans/` (+`[id]`). `lib/numToWords.ts` rupees-in-words. Page `app/admin/challans/`. Print `app/admin/challans/[id]/print` — `@page A5`, GANESHAY header, rounding, words, signatures. Header editable at `app/admin/settings` via `app_settings` (`app/api/settings`).

### Module 8 + chemicals
`app/admin/masters/chemicals` (CRUD + restock + low-stock), `app/admin/warehouses` (raw/grey/dyed/packed/chemicals tabs), APIs `masters/chemicals` + `warehouses`. Low-stock banners.

### Type-to-search + Excel
`SearchableDropdown` wired into client/quality on worker hanks+coning, orders (+new Quality field), stock-inward, dispatch, dyeing, challans. Dashboard Month/Year + "Export Excel" → `app/api/export` 6-tab .xlsx (exceljs, SUM formulas, alt row colors, ₹ format).

### Security — RLS HARDENED ✓
- Server client (`lib/supabase.ts`) now uses `SUPABASE_SERVICE_KEY` (service_role, bypasses RLS) with fallback to `SUPABASE_KEY`. **Vercel: add `SUPABASE_SERVICE_KEY` env on first ERP deploy.**
- RLS enabled on all 25 tables; legacy `Allow all USING(true)` policies dropped (had left `erp_users` pin-hashes + `sessions` tokens exposed). Anon key now fully denied (verified: anon query → `[]`). ERP works via service_role server-side.
- `.env` was git-tracked → now in `.gitignore` + `git rm --cached`. (anon key already in history — low risk; rotate service key if chat/transcript shared.)

### Fixed
- **Dyeing completion was broken** — `[id]/approve` wrote non-existent `approved_at` column (400). Added `dyeing_production.approved_at`. End-to-end transfer chain now 20/20 (`scripts/e2e.mjs`).

### ⚠ Open
- Dashboard month filter drives Excel + label; live KPI cards still real-time snapshots.
- Challan factory address/GSTIN are placeholders in `app_settings` — owner fills via Settings page (chose to keep placeholders for now).
- `scripts/e2e.mjs` left test rows in DB (E2E stock inward, challans DC-2026-001/002, test production) — owner chose to keep.

---

## Phase 3 — TO BUILD

### Context & Motivation

Phase 3 was scoped by comparing our ERP against a prototype (`auth-control-center (1)/`) that had a more complete feature set. Key gaps identified:

1. **No rate master** — rates are hardcoded per quality; real factory needs party × item × shade pricing with effective dates
2. **No GST on dispatch** — dispatches have no HSN/GSTIN/tax fields; required for legal invoicing in India
3. **Payroll incomplete** — only hanks wages calculated; daily-wage workers (attendance-based), dyeing workers, coning workers not covered; no payment mode tracking
4. **No WhatsApp notifications** — factory communicates via WhatsApp; dispatch confirmations, payment reminders not automated

### Priority Order

1. **Rate Master** — foundational; unlocks correct payslip auto-calc and dispatch pricing
2. **GST on Dispatch + Client GST fields** — legal compliance for invoicing
3. **Full Payroll** — multi-source wage aggregation, payment tracking
4. **WhatsApp Notifications** — dispatch/invoice links sent to party via WhatsApp

---

### Feature Specs

#### Rate Master
- **Routes**: `GET/POST /api/rates`, `PUT/DELETE /api/rates/[id]`
- **Admin page**: `/admin/masters/rates`
- **Fields**: client_id, item_id, shade_id (nullable = applies to all shades), rate_per_kg, effective_date, notes
- **Logic**: lookup order — most-specific (client+item+shade) → (client+item) → (client only). Most recent effective_date wins.
- **DB table needed**: `rates`

#### GST on Dispatch & Client GST Fields
- **Clients table**: add `gstin TEXT`, `state_code TEXT DEFAULT '24'` (Gujarat), `dealer_type TEXT DEFAULT 'registered'` (registered/unregistered/composition/export)
- **Dispatches table**: add `hsn_code TEXT`, `gst_rate NUMERIC DEFAULT 5`, `tax_inclusive BOOLEAN DEFAULT false`, `taxable_value NUMERIC`, `cgst_amount NUMERIC`, `sgst_amount NUMERIC`, `igst_amount NUMERIC`, `total_tax NUMERIC`, `grand_total NUMERIC`
- **Logic**: intra-state (same state) → CGST + SGST (half each). Inter-state → IGST. Unregistered dealer → no GST. tax_inclusive: back-calculate taxable from gross. Auto-fill from client state_code vs factory state (Gujarat = 24).
- **Dispatch page**: add GST fields to form. Auto-calc on rate+qty change. Show tax breakdown.
- **Client masters page**: add GST fields to create/edit modal.

#### Full Payroll
- **Route**: `GET/POST /api/payroll/full`, `PUT /api/payroll/full/[id]`
- **Admin page**: `/admin/payroll` — replace existing simple page with tabs: Generate | History
- **Generate tab**: select month+year → system auto-aggregates per worker:
  - `hanks_wage` = sum of approved hanks_production entries × quality rate_per_kg
  - `coning_wage` = sum of approved coning_production entries × quality coning_rate_per_kg
  - `dyeing_wage` = manual entry (dyeing workers paid separately per batch)
  - `attendance_wage` = present_days × daily_rate (from worker profile)
  - `gross_wage` = sum of above
  - `advance_deduction` = sum of pending worker_advances
  - `loan_deduction` = sum of loan hapta amounts for active loans
  - `net_wage` = gross - deductions + bonus
- **Payment tracking**: status (pending/paid), payment_mode (cash/bank/upi), payment_date
- **Worker daily_rate**: add `daily_rate NUMERIC` to `erp_users` table; set in workers master page
- **DB table needed**: `payroll`

#### WhatsApp Notifications
- **No external API required** — use `wa.me` deep links (free, no API key)
- **Dispatch page**: "Send WhatsApp" button per dispatch → opens `https://wa.me/91{phone}?text={encoded_message}` with invoice details pre-filled
- **Client Finance page**: "Send Reminder" button → WhatsApp link with outstanding balance
- **Message templates**: Invoice: `"Invoice {inv_no} for ₹{amount} dispatched. Vehicle: {vehicle}. — OM Industries"`. Reminder: `"Dear {name}, your outstanding balance is ₹{amount}. Please arrange payment. — OM Industries"`
- No DB table needed — stateless deep links

---

### New DB Tables Needed (Phase 3)

```sql
-- Run in Supabase SQL editor

CREATE TABLE rates (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  item_id INTEGER REFERENCES items(id),
  shade_id INTEGER REFERENCES shades(id),   -- NULL = all shades
  rate_per_kg NUMERIC NOT NULL,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payroll (
  id SERIAL PRIMARY KEY,
  worker_id INTEGER REFERENCES erp_users(id),
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  hanks_kg NUMERIC DEFAULT 0,
  hanks_wage NUMERIC DEFAULT 0,
  coning_kg NUMERIC DEFAULT 0,
  coning_wage NUMERIC DEFAULT 0,
  dyeing_wage NUMERIC DEFAULT 0,
  present_days NUMERIC DEFAULT 0,
  daily_rate NUMERIC DEFAULT 0,
  attendance_wage NUMERIC DEFAULT 0,
  gross_wage NUMERIC DEFAULT 0,
  advance_deduction NUMERIC DEFAULT 0,
  loan_deduction NUMERIC DEFAULT 0,
  bonus NUMERIC DEFAULT 0,
  net_wage NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending',
  payment_mode TEXT,
  payment_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(worker_id, month, year)
);

-- Column additions (run ALTER TABLE, not CREATE):
ALTER TABLE clients ADD COLUMN IF NOT EXISTS gstin TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS state_code TEXT DEFAULT '24';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS dealer_type TEXT DEFAULT 'registered';

ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS hsn_code TEXT;
ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS gst_rate NUMERIC DEFAULT 5;
ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS tax_inclusive BOOLEAN DEFAULT false;
ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS taxable_value NUMERIC;
ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC;
ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC;
ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS igst_amount NUMERIC;
ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS total_tax NUMERIC;
ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS grand_total NUMERIC;

ALTER TABLE erp_users ADD COLUMN IF NOT EXISTS daily_rate NUMERIC DEFAULT 0;
```

---

### Phase 3 Admin Nav Updates

Add to sidebar (Masters section):
- Rate Master → `/admin/masters/rates`

Payroll page (`/admin/payroll`) upgraded from simple export page to full payroll management.

---

## Phase 3 Build Log

### ✓ Done
- **Rate Master** — API at `app/api/rates/` (GET/POST), `app/api/rates/[id]/` (PUT/DELETE), `app/api/rates/lookup/` (GET — resolves most-specific rate for client+item+shade). Admin page at `app/admin/masters/rates/page.tsx`. Grouped by client, full CRUD. Lookup priority: client+item+shade → client+item → client-only; most-recent effective_date wins.
  - **DB table required**: `rates` ✅ migrated
- **DB migrations applied**: `rates`, `payroll`, GST columns on `dispatches` + `clients`, `daily_rate` on `erp_users`

- **GST on Dispatch** — `app/api/dispatch/route.ts` now calculates CGST/SGST (intra-state) or IGST (inter-state) based on client `state_code`. Supports tax-inclusive rates (back-calc taxable). Unregistered dealers skip GST. Dispatch form shows live tax breakdown. Grand total saved and used for client finance debit entry.
- **Client GST fields** — `clients` table now has `gstin`, `state_code`, `dealer_type`. API updated (POST+PUT). Clients page shows GSTIN, dealer type badge, state code. Modal has radio picker for dealer type.
- **WhatsApp on Dispatch** — each dispatch row has a WhatsApp button (message-circle icon, green). Opens `wa.me/91{phone}?text=...` deep link with invoice details pre-filled.

- **Full Payroll** — New API at `app/api/payroll/full/route.ts` (GET aggregates all wage sources; POST saves/upserts payroll record). Payment update at `app/api/payroll/full/[id]/route.ts` (PUT marks paid with mode+date). Admin page at `app/admin/payroll/page.tsx` — revamped with per-worker rows showing hanks/coning/dyeing/attendance wages + deductions. Inline edit for dyeing wage/bonus. Save All + individual Save. Mark Paid modal with Cash/Bank/UPI mode picker. CSV export.
- **Workers daily_rate** — `erp_users.daily_rate` column added. Workers master page shows ₹/day column, edit modal has daily_rate input. API select + PUT updated. Used by payroll to calculate attendance wages.

- **Client phone + portal** — `clients` table now has `phone`, `portal_enabled`, `portal_passcode`. Clients page updated with phone input and portal toggle. WhatsApp button on dispatch works when phone set.
- **Worker payslip (full)** — New API `app/api/payroll/my/route.ts`: checks saved `payroll` record first (admin-confirmed), falls back to computing from hanks+coning+attendance. Worker payslip page now shows full breakdown: hanks, coning, dyeing, attendance wages + deductions + bonus.
- **Print invoice + QR code** — `components/ui/InvoiceModal.tsx`: renders invoice with GST breakdown. QR code (96px canvas) contains JSON of invoice details. `window.print()` button on modal. Dispatch page has print icon per row.
- **AI Purchase Bill Scanner** — API at `app/api/bills/scan/route.ts`: accepts image upload, sends to Gemini 1.5 Flash vision model, extracts supplier/invoice/items/amounts. Stock inward page has "Scan Bill" button with drag-drop upload, scanning state, extracted data review, and "Use This Data" button auto-fills the form. Requires `GOOGLE_GENAI_API_KEY` env var.
- **Communication log** — API at `app/api/communications/route.ts` (GET/POST). Admin page at `app/admin/communications/page.tsx` (filterable by party/type). WhatsApp button on dispatch now logs each message sent. Added to sidebar.
- **Customer portal** — `/portal` login (phone + passcode). API: `app/api/portal/auth/route.ts` + `app/api/portal/data/route.ts` (JWT with `type:portal` claim). Dashboard at `/portal/dashboard` with Summary/Invoices/Orders/Ledger tabs. Mobile-first layout, no admin sidebar.
- **Reports refresh** — Dispatch report now includes `taxable_value`, `hsn_code`, `gst_rate`, `cgst/sgst/igst`, `total_tax`, `grand_total`. New `payroll` report type added.

### ✅ Phase 3 Complete

All 4 items built:
1. ~~Rate Master~~ ✓
2. ~~GST on Dispatch + Client GST fields~~ ✓
3. ~~Full Payroll~~ ✓
4. ~~WhatsApp deep links~~ ✓ (dispatch page)

Known limitations in Phase 3:
- WhatsApp button on dispatch requires `phone` field on clients table (not currently stored — need to add)
- Rate lookup auto-fill in dispatch requires `/api/rates/lookup` to be called — works only if Rate Master has entries for the client
- Dyeing wage in payroll is manual entry (dyeing master pay structure varies by factory)

---

## Known Issues / Tech Debt

- Topbar search input is decorative — no functionality
- Bell icon notifications — decorative
- Worker history has no date/month filter
- Dispatch page shade column: `ready_stock → shades` nested join causes `shades_2.name` Supabase error; workaround is to not join shades in dispatch API
- `shades` table is dual-purpose (recipe shades via `recipe_id` + master shades via `recipe_id IS NULL`) — tech debt from schema collision
