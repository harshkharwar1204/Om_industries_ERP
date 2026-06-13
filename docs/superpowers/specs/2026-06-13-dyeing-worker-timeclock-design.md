# Dyeing Worker Time-Clock — Design Spec

**Date:** 2026-06-13
**Project:** OM INDUSTRIES ERP
**Status:** Approved design, pre-implementation

## Problem

Dyeing-house workers are paid by **time on site**, not piece-rate, unlike hanks/coning workers (per-kg) and the dyeing_master (monthly salary). Rate is **flat ₹40/hour**. Owner needs proof a worker was physically at the dyeing house for the hours claimed — verified by a selfie and GPS geofence at clock-in and clock-out.

## Where the dyeing house sits in the factory flow

```
stock_inward → hanks (Unit 2) → grey_stock (Unit 1) → dyeing/dyed_stock (DYEING HOUSE) → coning → ready_stock → challan
```

- Hanks production = Unit 2 (separate building, not affected).
- **Dyeing house** = the `dyeing_production` / `dyed_stock` stage (Module 4).
- The **dyeing_master** supervises and logs dyeing batches (recipe, chemicals, batch no) — salaried, does NOT clock hours.
- The **dyeing_worker** (NEW role) is the physical labour dyeing yarn in that building — paid ₹40/hr for time on site.

**Decoupling (critical):** the time-clock is a *payroll* mechanism only. It does NOT touch the stock transfer chain, dyed_stock, or production records. Production (what got dyed) and attendance (who was present, how long) are independent.

## Scope decisions (locked)

| Decision | Choice |
|---|---|
| Identity + presence verification | Login (phone+PIN, identity already known) + selfie photo (audit proof) + GPS geofence. NO ML face recognition. |
| Geofence config | Single dyeing-house location + radius, set once in Settings. |
| Rate & rounding | Flat ₹40/hr global (in app_settings). Worked time rounded to nearest 15 min. |
| Worker category | New `dyeing_worker` role (applies to new and existing workers reassigned to it). |
| Anti-fraud (mid-shift) | **v1: clock in/out selfie+GPS only**, honor system between. True silent 30-min background GPS tracking is NOT buildable on a PWA (browser stops background JS on lock/close) → deferred to a future native-app phase. |

## Data model

### New role
- Allow `dyeing_worker` wherever role is validated: role CHECK constraint on `erp_users`, `app/api/auth/register/route.ts`, `lib/auth.ts`, `lib/roleStage.ts` (no production stage — exclude or map to none), login redirect logic.

### New table `time_logs`
```
id              bigint pk
worker_id       bigint fk -> erp_users
date            date            -- = clock_in calendar day, for payroll month grouping
clock_in_at     timestamptz not null
clock_out_at    timestamptz     -- null while status='open'
in_lat          double precision
in_lng          double precision
out_lat         double precision
out_lng         double precision
in_selfie_url   text            -- storage path
out_selfie_url  text
worked_minutes  int             -- filled on clock-out, rounded to nearest 15
status          text            -- 'open' | 'closed'
created_at      timestamptz default now()
```
- Index: `(worker_id, date)`. Partial unique guard so a worker has at most one `status='open'` log at a time.
- RLS: enabled, no anon policy (consistent with the other 25 tables; server uses service_role).

### `app_settings` new keys
- `dyeing_house_lat`, `dyeing_house_lng` (double, nullable until owner sets)
- `geofence_radius_m` (default 100)
- `hourly_rate` (default 40)

### Selfie storage
- Supabase Storage **private bucket `attendance-selfies`**.
- Path convention: `{worker_id}/{time_log_id}-{in|out}.jpg`.
- Server uploads the base64/blob frame received from the client; stores the returned path in `time_logs`. Admin views fetch via signed URL.

## API — `app/api/timeclock/route.ts` (+ helpers)

All endpoints server-side verify the JWT. Geofence check is **server-side** (never trust client distance).

- **`POST /api/timeclock` `{action:'in', lat, lng, selfie}`** (worker)
  1. requireAuth, ensure role = dyeing_worker.
  2. Reject if an `open` log already exists for the worker.
  3. Compute haversine distance vs configured dyeing-house coords. If `> geofence_radius_m` → 422 `"Outside dyeing house range"`.
  4. Upload selfie → `in_selfie_url`.
  5. Insert log `status='open'`, `clock_in_at=now()`, `date=today`.

- **`POST /api/timeclock` `{action:'out', lat, lng, selfie}`** (worker)
  1. Find worker's `open` log; 404 if none.
  2. Geofence check (same as above).
  3. Upload selfie → `out_selfie_url`.
  4. `clock_out_at=now()`; `worked_minutes = round((clock_out_at - clock_in_at)/min / 15) * 15`; `status='closed'`.

- **`GET /api/timeclock?scope=today`** (worker) → worker's current open/closed log for today.
- **`GET /api/timeclock?month=&year=`** (admin) → all logs in range with worker name + signed selfie URLs.

Geofence settings missing (owner hasn't set location) → clock-in returns a clear error: `"Dyeing house location not configured — ask admin"`.

Haversine helper lives in `lib/geo.ts`.

## Worker screen — `/worker` (role = dyeing_worker)

`app/worker/page.tsx` already branches by role. Add a `DyeingClockCard`:
- On load, `GET ?scope=today`.
- **No open log:** large **Clock In** button. On tap → request camera (capture one frame) + `navigator.geolocation.getCurrentPosition` → POST `in`. Show live "At dyeing house ✓ / Out of range ✗" hint from the returned result.
- **Open log:** running timer since `clock_in_at`, **Clock Out** button (same selfie+GPS flow). On success show "Worked Xh Ym today · ₹N".
- **Closed log today:** read-only summary.
- Errors (out of range, no GPS permission, camera denied) shown as toast + inline.

## Payroll integration — `app/api/payroll/full/route.ts`

- Add `time_logs` to the parallel fetch (closed logs in month).
- For `role='dyeing_worker'`: `dyeing_wage = (Σ worked_minutes / 60) × hourly_rate(from app_settings)`. Computed, not manually entered. Remove/hide the manual dyeing_wage input box for these workers in the admin payroll UI.
- For `dyeing_master`: unchanged (monthly salary).
- For hanks/coning: unchanged (piece-rate).
- `present_days` for dyeing_worker = count of distinct dates with a closed log (for display/attendance parity).

## Admin views

- **Settings** (`/admin/settings`): "Dyeing House Location" block — **Use my current location** button (fills lat/lng from owner's browser), manual lat/lng inputs, radius (m), hourly rate. Saved to app_settings.
- **Time-clock log** (admin, e.g. under Attendance or new `/admin/timeclock`): month filter; table of worker, date, in/out times, hours, in/out selfie thumbnails (signed URLs), map link (`https://maps.google.com/?q=lat,lng`) per clock point for audit.

## Out of scope (future / native phase)
- Silent background GPS tracking every 30 min (requires native app — Capacitor/React Native).
- Random mid-shift re-verification prompts.
- ML face recognition.
- Multiple geofenced sites.
- Per-worker variable hourly rates.

## Testing / verification
- No automated suite in repo. Verify via dev server:
  - Owner sets dyeing-house location in Settings.
  - dyeing_worker logs in → Clock In inside range succeeds, outside range rejected.
  - Clock Out computes rounded minutes.
  - Payroll month shows dyeing_wage = hours × 40.
  - Selfies viewable in admin log.
- Optionally extend `scripts/e2e.mjs` to mint a dyeing_worker JWT and drive clock in/out (geofence with a stubbed location).
