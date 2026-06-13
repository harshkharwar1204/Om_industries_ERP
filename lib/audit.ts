import { supabase } from '@/lib/supabase';
import type { JWTPayload } from '@/lib/auth';

/**
 * Best-effort audit logger. NEVER throws — auditing must not break a business action.
 * Requires the `audit_log` table (db/migrations/001_audit_log.sql). If the table is
 * absent the insert fails silently and the app keeps working.
 */
export async function logAction(
  actor: JWTPayload | null,
  action: string,
  entity: string,
  entityId: string | number | null,
  summary: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  try {
    await supabase.from('audit_log').insert([{
      actor_id:   actor?.id ?? null,
      actor_name: actor?.name ?? null,
      actor_role: actor?.role ?? null,
      action,
      entity,
      entity_id:  entityId != null ? String(entityId) : null,
      summary,
      meta:       meta ?? null,
    }]);
  } catch {
    // swallow — auditing is non-critical
  }
}
