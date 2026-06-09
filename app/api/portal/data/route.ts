import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'om-industries-erp-secret-2024';

function getPortalClient(req: NextRequest): number {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) throw new Error('Unauthorized');
  const payload = jwt.verify(auth.slice(7), JWT_SECRET) as any;
  if (payload.type !== 'portal') throw new Error('Unauthorized');
  return payload.clientId;
}

export async function GET(req: NextRequest) {
  try {
    const clientId = getPortalClient(req);
    const type = req.nextUrl.searchParams.get('type') || 'summary';

    if (type === 'summary') {
      const [txns, orders, dispatches] = await Promise.all([
        supabase.from('client_transactions').select('type, amount').eq('client_id', clientId),
        supabase.from('orders').select('id, po_number, qty_kg, status, created_at').eq('client_id', clientId).order('created_at', { ascending: false }).limit(5),
        supabase.from('dispatches').select('invoice_no, qty_kg, grand_total, amount, date').eq('client_id', clientId).order('date', { ascending: false }).limit(5),
      ]);

      const txnData = txns.data ?? [];
      const debit   = txnData.filter(t => t.type === 'debit').reduce((s, t) => s + Number(t.amount), 0);
      const credit  = txnData.filter(t => t.type !== 'debit').reduce((s, t) => s + Number(t.amount), 0);

      return NextResponse.json({
        outstanding: Math.max(0, debit - credit),
        total_invoiced: debit,
        total_paid: credit,
        recent_orders:    orders.data ?? [],
        recent_dispatches: dispatches.data ?? [],
      });
    }

    if (type === 'orders') {
      const { data, error } = await supabase
        .from('orders')
        .select('*, items(name, unit)')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return NextResponse.json(data);
    }

    if (type === 'invoices') {
      const { data, error } = await supabase
        .from('dispatches')
        .select('*')
        .eq('client_id', clientId)
        .order('date', { ascending: false });
      if (error) throw error;
      return NextResponse.json(data);
    }

    if (type === 'ledger') {
      const { data, error } = await supabase
        .from('client_transactions')
        .select('*')
        .eq('client_id', clientId)
        .order('date', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 401 });
  }
}
