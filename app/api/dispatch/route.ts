import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    const { data, error } = await supabase
      .from('dispatches')
      .select('*, clients(name), orders(po_number), ready_stock(weight_kg, shade_id)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message.includes('required') ? 403 : 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    requireAdmin(req);
    const body = await req.json();
    const { client_id, order_id, stock_id, qty_kg, rate, vehicle_no, lr_no, date } = body;

    if (!client_id || !qty_kg || !rate) {
      return NextResponse.json({ error: 'Client, qty and rate required' }, { status: 400 });
    }

    // Auto-generate invoice number
    const { count } = await supabase.from('dispatches').select('*', { count: 'exact', head: true });
    const invoiceNo = `INV-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(4, '0')}`;
    const amount = Number(qty_kg) * Number(rate);

    const { data, error } = await supabase
      .from('dispatches')
      .insert([{
        invoice_no:  invoiceNo,
        client_id:   Number(client_id),
        order_id:    order_id ? Number(order_id) : null,
        stock_id:    stock_id ? Number(stock_id) : null,
        qty_kg:      Number(qty_kg),
        rate:        Number(rate),
        amount,
        vehicle_no:  vehicle_no?.trim() || null,
        lr_no:       lr_no?.trim() || null,
        date:        date || new Date().toISOString().split('T')[0],
      }])
      .select()
      .single();

    if (error) throw error;

    // Mark ready stock as dispatched
    if (stock_id) {
      await supabase.from('ready_stock').update({ status: 'dispatched' }).eq('id', stock_id);
    }

    // Create client finance debit entry (they owe us)
    await supabase.from('client_transactions').insert([{
      client_id:    Number(client_id),
      date:         date || new Date().toISOString().split('T')[0],
      type:         'debit',
      particulars:  `Invoice ${invoiceNo}`,
      amount,
      reference_id: data.id,
    }]);

    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
