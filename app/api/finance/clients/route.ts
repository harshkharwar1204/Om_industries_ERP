import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireStrictAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    requireStrictAdmin(req);
    const client_id = req.nextUrl.searchParams.get('client_id');

    if (client_id) {
      const { data, error } = await supabase
        .from('client_transactions')
        .select('*, clients(name)')
        .eq('client_id', Number(client_id))
        .order('date', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return NextResponse.json(data);
    }

    // Summary: debit/credit/balance per client
    const { data, error } = await supabase
      .from('client_transactions')
      .select('client_id, type, amount, clients(name)')
      .order('client_id');
    if (error) throw error;

    const summary: Record<number, any> = {};
    for (const t of (data ?? [])) {
      const id = t.client_id;
      if (!summary[id]) summary[id] = { client_id: id, client_name: (t as any).clients?.name ?? `Client ${id}`, total_debit: 0, total_credit: 0 };
      if (t.type === 'debit') summary[id].total_debit += Number(t.amount);
      else summary[id].total_credit += Number(t.amount);
    }

    return NextResponse.json(Object.values(summary).map(r => ({
      ...r,
      balance: Number((r.total_debit - r.total_credit).toFixed(2)),
      total_debit: Number(r.total_debit.toFixed(2)),
      total_credit: Number(r.total_credit.toFixed(2)),
    })));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message.includes('required') ? 403 : 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    requireStrictAdmin(req);
    const { client_id, date, amount, particulars, type } = await req.json();
    if (!client_id || !amount || !type) return NextResponse.json({ error: 'client_id, amount, type required' }, { status: 400 });
    if (!['credit', 'adjustment'].includes(type)) return NextResponse.json({ error: 'type must be credit or adjustment' }, { status: 400 });

    const { data, error } = await supabase
      .from('client_transactions')
      .insert([{
        client_id: Number(client_id),
        date: date || new Date().toISOString().split('T')[0],
        type,
        particulars: particulars?.trim() || (type === 'credit' ? 'Payment received' : 'Adjustment'),
        amount: Number(amount),
      }])
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message.includes('required') ? 403 : 400 });
  }
}
