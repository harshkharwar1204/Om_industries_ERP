import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    const status = req.nextUrl.searchParams.get('status');

    let query = supabase
      .from('orders')
      .select('*, clients(name), items(name, unit)')
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
    requireAdmin(req);
    const { client_id, quality_id, po_number, item_id, shade_id, qty_kg, rate, delivery_date, priority } = await req.json();
    if (!client_id) return NextResponse.json({ error: 'Client required' }, { status: 400 });

    const { data, error } = await supabase
      .from('orders')
      .insert([{
        client_id:     Number(client_id),
        quality_id:    quality_id ? Number(quality_id) : null,
        po_number:     po_number?.trim() || null,
        item_id:       item_id ? Number(item_id) : null,
        shade_id:      shade_id ? Number(shade_id) : null,
        qty_kg:        qty_kg ? Number(qty_kg) : null,
        rate:          rate ? Number(rate) : null,
        delivery_date: delivery_date || null,
        priority:      priority || 'medium',
        status:        'pending',
      }])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
