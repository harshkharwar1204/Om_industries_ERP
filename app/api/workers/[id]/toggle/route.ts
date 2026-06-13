import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireStrictAdmin } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireStrictAdmin(req);
    const { data: current, error: fetchErr } = await supabase
      .from('erp_users').select('is_active').eq('id', params.id).single();
    if (fetchErr || !current) return NextResponse.json({ error: 'Worker not found' }, { status: 404 });
    const { data, error } = await supabase
      .from('erp_users').update({ is_active: !current.is_active }).eq('id', params.id)
      .select('id, is_active').single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
