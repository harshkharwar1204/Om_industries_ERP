// app/api/loans/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireStrictAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    requireStrictAdmin(req);
    const { data, error } = await supabase
      .from('worker_loans')
      .select('*, erp_users(name, department)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message.includes('required') ? 403 : 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    requireStrictAdmin(req);
    const { worker_id, loan_amount, hapta_amount } = await req.json();
    if (!worker_id || !loan_amount || !hapta_amount) {
      return NextResponse.json({ error: 'worker_id, loan_amount, hapta_amount required' }, { status: 400 });
    }
    const { data, error } = await supabase
      .from('worker_loans')
      .insert([{
        worker_id: Number(worker_id),
        loan_amount: Number(loan_amount),
        hapta_amount: Number(hapta_amount),
        outstanding: Number(loan_amount),
        status: 'active',
        date: new Date().toISOString().split('T')[0],
      }])
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message.includes('required') ? 403 : 400 });
  }
}
