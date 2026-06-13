import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireStrictAdmin } from '@/lib/auth';

// Audit trail viewer — admin only. Filterable by entity/action/actor.
export async function GET(req: NextRequest) {
  try {
    requireStrictAdmin(req);
    const entity = req.nextUrl.searchParams.get('entity');
    const action = req.nextUrl.searchParams.get('action');
    const actor  = req.nextUrl.searchParams.get('actor_id');
    const limit  = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 200), 500);

    let query = supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (entity) query = query.eq('entity', entity);
    if (action) query = query.eq('action', action);
    if (actor)  query = query.eq('actor_id', actor);

    const { data, error } = await query;
    if (error) {
      // Table not yet created — return empty list rather than 500 so the page renders.
      if (/relation .*audit_log.* does not exist/i.test(error.message)) {
        return NextResponse.json({ rows: [], migrationPending: true });
      }
      throw error;
    }
    return NextResponse.json({ rows: data ?? [], migrationPending: false });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: /required|denied|token|unauthor/i.test(e.message) ? 403 : 500 });
  }
}
