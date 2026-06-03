# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Full dev (backend + frontend concurrently)
npm run dev

# Backend only (Express on port 5000)
npm run dev:backend

# Frontend only (Vite dev server)
npm run dev:frontend

# Production build
npm run build
```

No test suite exists. Verify changes by running the dev server.

## Architecture

This is **OM INDUSTRIES ERP** — a yarn/textile factory management system for Surat, Gujarat. It has two distinct subsystems that share the same codebase:

### Two Subsystems

**1. Color Recipe System** (original feature)
- Manage dye color formulas for yarn batches
- Routes: `/api/colors`, `/api/recipes`
- Frontend: `src/components/recipe/`, `src/components/recipe-log/`, `src/components/fundamental-colors/`
- No auth required — open access

**2. ERP System** (newer, role-gated)
- Production tracking, payroll, advances, stock inward for factory workers
- Routes: `/api/auth`, `/api/workers`, `/api/clients`, `/api/qualities`, `/api/stock`, `/api/production`, `/api/advances`, `/api/payroll`
- Frontend: `src/pages/admin/` and `src/pages/worker/`
- Auth required — JWT via phone + PIN login

### Backend (`server/`)

- `server/server.cjs` — Express entry point, registers all routes
- `server/db.cjs` — Supabase client singleton (reads `SUPABASE_URL` + `SUPABASE_KEY` from `.env`)
- `server/middleware/auth.cjs` — JWT middleware: `requireAuth`, `requireAdmin`, `requireWorker`
- `server/routes/*.cjs` — Each resource has its own route file

Backend uses CommonJS (`.cjs`). All routes import `supabase` from `../db.cjs` directly — no ORM.

### Frontend (`src/`)

- `src/App.jsx` — React Router setup; two protected route trees: `/admin/*` and `/worker/*`
- `src/context/AuthContext.jsx` — Global auth state; stores JWT in `localStorage` as `erp_token`
- `src/services/api.js` — Color/recipe API calls (no auth headers)
- `src/services/erpApi.js` — ERP API calls (attaches Bearer token from localStorage)
- `src/pages/admin/` — Admin-only pages (Dashboard, Workers, Production Approval, Payroll, etc.)
- `src/pages/worker/` — Worker-facing pages (Production Entry, History, Advances)
- `src/components/shared/` — Reusable components: `ProtectedRoute`, `Autocomplete`, `Toast`, `StatusBadge`, `MonthFilter`

Frontend uses ES modules. Vite proxies `/api/*` to the Express server in dev.

### Auth Flow

Login: phone + 4-digit PIN → Express hashes PIN with bcrypt, issues 30-day JWT → stored in `localStorage` as `erp_token`.

Roles: `admin`, `hanks_worker`, `coning_worker`, `dyeing_master`. Workers are redirected to `/worker`, admins to `/admin/dashboard`.

### Database (Supabase)

Schema is in `supabase_erp_schema.sql`. Key tables:
- `erp_users` — all users (admins + workers), phone is unique login key
- `hanks_production` — worker production entries with `pending/approved/rejected` status
- `stock_inward` — raw yarn arrivals, tracked per client + quality
- `worker_advances` — salary advance requests
- `sessions` — JWT session store (for logout invalidation)
- `clients`, `qualities` — master data for autocomplete

RLS is enabled but all policies are `USING (true)` — auth enforced entirely at the Express API layer.

### Environment

`.env` needs:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
SUPABASE_URL=...
SUPABASE_KEY=...
JWT_SECRET=...   # optional, defaults to hardcoded fallback
```

### PWA

App is a PWA (`public/manifest.json`, `public/sw.js`). Optimized for mobile — workers use it on phones to submit production entries.
