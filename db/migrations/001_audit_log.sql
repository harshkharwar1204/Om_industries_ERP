-- Migration 001 — audit_log
-- Immutable record of who did what (approvals, dispatches, payroll, account changes).
-- Apply in Supabase SQL editor (project Color-recipe-pro / bbprchdwdckqeujhzrtd).
-- Safe to run repeatedly (idempotent).

create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  actor_id    bigint references public.erp_users(id),
  actor_name  text,
  actor_role  text,
  action      text not null,           -- 'approve' | 'reject' | 'dispatch' | 'payroll_save' | 'worker_update' | ...
  entity      text not null,           -- 'hanks_production' | 'dispatch' | 'payroll' | 'erp_users' | ...
  entity_id   text,
  summary     text,                    -- human-readable one-liner
  meta        jsonb,                   -- structured key fields / before-after
  created_at  timestamptz not null default now()
);

create index if not exists idx_audit_log_entity  on public.audit_log (entity, entity_id);
create index if not exists idx_audit_log_created on public.audit_log (created_at desc);
create index if not exists idx_audit_log_actor   on public.audit_log (actor_id);

-- Match the security posture of all other tables: RLS on, no anon policy.
-- The server uses the service_role key which bypasses RLS.
alter table public.audit_log enable row level security;
