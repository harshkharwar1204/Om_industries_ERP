import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { ROLE_STAGE } from '@/lib/roleStage';

// Orders assigned to the logged-in worker's department (+ general), still open.
export async function GET(req: NextRequest) {
  try {
    const user = requireAuth(req);
    const stage = ROLE_STAGE[user.role];
    if (!stage) return NextResponse.json({ error: 'Worker role required' }, { status: 403 });

    const { data, error } = await supabase
      .from('orders')
      .select('*, clients(name), qualities(name, hanks_rate_per_kg, coning_rate_per_kg)')
      .in('department', [stage, 'general'])
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: false });
    if (error) throw error;

    // annotate each order with this worker's stage + whether already marked done
    const out = (data ?? []).map((o: any) => ({
      ...o, my_stage: stage,
      my_stage_done: !!o[`${stage}_done_at`],
      my_stage_approved: !!o[`${stage}_approved_at`],
    }));
    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message.includes('required') ? 403 : 500 });
  }
}
