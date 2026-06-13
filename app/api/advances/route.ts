import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireStrictAdmin, requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    requireStrictAdmin(req);
    const status = req.nextUrl.searchParams.get('status');
    let query = supabase
      .from('worker_advances')
      .select('*, erp_users(name, department)')
      .order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message.includes('required') ? 403 : 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = requireAuth(req);
    const { amount, note } = await req.json();
    if (!amount || Number(amount) <= 0) return NextResponse.json({ error: 'Valid amount required' }, { status: 400 });
    const { data, error } = await supabase
      .from('worker_advances')
      .insert([{ worker_id: user.id, amount: Number(amount), note: note || null, status: 'pending' }])
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
