import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireStrictAdmin } from '@/lib/auth';
import { logAction } from '@/lib/audit';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = requireStrictAdmin(req);
    const { data: current, error: fetchErr } = await supabase
      .from('erp_users').select('is_active').eq('id', params.id).single();
    if (fetchErr || !current) return NextResponse.json({ error: 'Worker not found' }, { status: 404 });
    const { data, error } = await supabase
      .from('erp_users').update({ is_active: !current.is_active }).eq('id', params.id)
      .select('id, is_active').single();
    if (error) throw error;
    // Revoke all active sessions when deactivating
    if (!data.is_active) {
      await supabase.from('sessions').delete().eq('user_id', params.id);
    }
    await logAction(actor, data.is_active ? 'activate' : 'deactivate', 'erp_users', params.id, `${data.is_active ? 'Activated' : 'Deactivated'} worker ${params.id}`);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
