# CLAUDE.md

Guidance for Claude Code working in this repo.

## Commands

```bash
npm run dev      # Next.js dev server (port 3000; auto-bumps if taken)
npm run build    # production build
npm run start    # serve production build
```

No test suite. `scripts/e2e.mjs` is an end-to-end transfer-chain check (mints JWTs, drives the API). Verify changes by running the dev server.

---

## Architecture

**OM INDUSTRIES ERP** — yarn/textile factory management (Surat, Gujarat). Owner/admin: Ravi Jariwala. Next.js 14 App Router (migrated from Express+Vite). All backend is in `app/api/` as Route Handlers. PWA, mobile-first (floor workers on phones).

**Factory flow / inter-unit transfer chain (wired end-to-end):**
`stock_inward → hanks (Unit 2) → grey_stock (Unit 1) → dyed_stock (batch) → coning → ready_stock (packed) → challan`

Stock moves on each approval, FIFO-consuming the previous pool and rolling up order fulfillment. Core logic: `lib/transfer.ts` (`consumePool`, `addOrderProgress`).

### Backend (`app/api/`)
- Auth helpers in `lib/auth.ts`: `requireAuth`, `requireAdmin`, `requireWorker`, `authError`. JWT only (`JWT_SECRET`), no DB session check.
- `lib/supabase.ts` — server-only Supabase singleton. Uses `SUPABASE_SERVICE_KEY` (service_role, bypasses RLS) with fallback to `SUPABASE_KEY`. **Never import into a client component.**
- Domain helpers: `lib/transfer.ts` (stock movement), `lib/dyecalc.ts` (recipe→batch dye scaling), `lib/numToWords.ts` (rupees in words).

### Frontend (`app/`)
- `app/layout.tsx` → `<AuthProvider>` + `<ToastProvider>`. `context/AuthContext.tsx` stores JWT in localStorage (`erp_token`). `lib/api.ts` attaches Bearer token; returns blob for spreadsheet content-type.
- `app/admin/layout.tsx` — sidebar + topbar (functional page-search, mobile too); redirects non-admins. `app/worker/layout.tsx` — mobile bottom-nav. `app/portal/` — customer portal (separate JWT `type:portal`).
- `components/ui/` — Toast, Modal, StatusBadge, Icon (Lucide only), PageHeader, StatCard, **SearchableDropdown** (type-to-search, used for all client/quality fields), InvoiceModal.

### Auth
- **Phone+PIN:** phone + 4-digit PIN → bcrypt → 30-day JWT.
- **Google Sign-In:** GSI → POST `/api/auth/google`; new user → `/onboarding` → POST `/api/auth/complete`.
- Roles: `admin`, `hanks_worker`, `coning_worker`, `dyeing_master`. Workers → `/worker`, admins → `/admin/dashboard`.
- **After auth always use `window.location.href`** (full reload), not `router.replace()` — else `AuthContext` keeps stale `user=null`.

### Database (Supabase — project `Color-recipe-pro` / `bbprchdwdckqeujhzrtd`)
Shares the DB with the legacy recipe app (recipe tables: `recipes`, `shades`, `ingredients`, `colors`). ERP tables include: `erp_users`, `clients`, `qualities`, `items`, `machines`, `chemicals`, `stock_inward`, `hanks_production`, `grey_stock`, `dyeing_production`, `dyed_stock`, `coning_production`, `ready_stock`, `orders`, `dispatches`, `challans`/`challan_items`, `client_transactions`, `worker_advances`, `worker_loans`/`loan_repayments`, `attendance`, `payroll`, `rates`, `app_settings`, `chemical_movements`, `communication_log`, `sessions`.

**Security:** RLS enabled on all 25 tables with **no anon policies** (anon key fully denied). The server works because it uses the service_role key. Only the 4 recipe tables would need anon policies if the legacy recipe app is revived. `.env` is gitignored (untracked).

### Environment (`.env`)
```
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...      # service_role secret — required; used server-side
SUPABASE_KEY=...              # anon (fallback)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
JWT_SECRET=...                # has hardcoded fallback
GOOGLE_CLIENT_ID=...          # Google Sign-In
GOOGLE_GENAI_API_KEY=...      # bill scanner (Gemini)
```
**On first Vercel deploy: add `SUPABASE_SERVICE_KEY`.**

---

## Design System

Reference prototype: `ERP-handoff/erp/project/`.

| Token | Value | Usage |
|---|---|---|
| Primary | `#64748B` | Sidebar, headers |
| Accent | `#F97316` | CTA, active |
| Success / Warning / Danger / Info | `#16A34A` / `#EAB308` / `#DC2626` / `#2563EB` | states |
| Background / Surface / Text | `#F8FAFC` / `#FFFFFF` / `#1E293B` | |

- Headings `Fira Code`; body `Fira Sans`. Min body 16px, min touch target 44×44px.
- **No** dark mode, glassmorphism/blur, animations >300ms, horizontal scroll on mobile, text <14px. Lucide icons only.
- Responsive utilities in `app/globals.css`: `.grid-2/3/4` collapse, `.table-wrap` (scroll), `.form-row` (1col mobile), modals become bottom sheets ≤768px, `.hide-mobile`, `@page A5` for challan print. `.main-content` has a mobile overflow-x guard.

---

## Current State

All four build phases shipped:
- **Phase 1:** auth, hanks production + approval, advances, payroll, stock inward, masters (clients/qualities/workers), color recipes, dashboard.
- **Phase 2:** coning, dyeing, attendance, ready stock, orders, dispatch, client finance, worker loans, reports, worker payslip, new masters (machines/shades/items), stock deduction.
- **Phase 3:** rate master, GST on dispatch + client GST fields, full payroll (multi-source), WhatsApp deep links, AI bill scanner, communication log, customer portal, print invoice + QR.
- **Phase 4:** inter-unit transfer chain, Module 4 dyeing (recipe auto-scale + weighing checklist + chemical inventory + corrections + batch numbers), Module 6 A5 delivery challan (`/admin/challans`, print at `[id]/print`, header editable in `/admin/settings`), Module 8 chemicals master + warehouse views + low-stock alerts, type-to-search everywhere, dashboard month/year filter + 6-tab Excel export (`/api/export`, exceljs). End-to-end verified 20/20.

---

## Gotchas / Tech Debt

- **Supabase FK alias conflict:** joining `shades` alongside other FK embeds throws `shades_N.name does not exist`. Workaround: don't nest the `shades` join (orders, stock/ready, dispatch) — resolve shade names from a locally loaded array. The `recipes` route lists explicit ingredient columns for the same reason.
- **`shades` is dual-purpose:** master shades (`recipe_id IS NULL`) vs recipe shades (`recipe_id` set). Masters API filters `.is('recipe_id', null)`.
- Dashboard month filter drives the Excel export + label; live KPI cards are still real-time snapshots.
- Challan factory address/GSTIN are placeholders in `app_settings` — owner edits via `/admin/settings`.
- Topbar bell removed; topbar search is functional (jumps to admin pages).
- Worker history has no date/month filter.
- The legacy recipe app (`color-recipe-jade`) is dead — ERP has its own `/admin/recipes`.
