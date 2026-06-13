import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth, requireRole } from '@/lib/auth';
import { consumePool } from '@/lib/transfer';

export async function GET(req: NextRequest) {
  try {
    requireRole(req, ['admin', 'dyeing_master']);
    const status = req.nextUrl.searchParams.get('status');

    let query = supabase
      .from('dyeing_production')
      .select('*, erp_users(name), machines(name), shades(name), clients(name), qualities(name), stock_inward(challan_no)')
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
    const { client_id, quality_id, shade_id, recipe_id, machine_id, lot_id, input_kg, date, order_id } = await req.json();

    if (!input_kg) return NextResponse.json({ error: 'Batch weight (input kg) required' }, { status: 400 });

    // Generate batch number: B-YYYY-NNN
    const year = new Date().getFullYear();
    const { count } = await supabase
      .from('dyeing_production')
      .select('id', { count: 'exact', head: true })
      .gte('date', `${year}-01-01`);
    const batch_no = `B-${year}-${String((count ?? 0) + 1).padStart(3, '0')}`;

    const { data, error } = await supabase
      .from('dyeing_production')
      .insert([{
        client_id:   client_id ? Number(client_id) : null,
        quality_id:  quality_id ? Number(quality_id) : null,
        shade_id:    shade_id ? Number(shade_id) : null,
        recipe_id:   recipe_id ? Number(recipe_id) : null,
        machine_id:  machine_id ? Number(machine_id) : null,
        lot_id:      lot_id ? Number(lot_id) : null,
        order_id:    order_id ? Number(order_id) : null,
        operator_id: user.id,
        input_kg:    Number(input_kg),
        batch_no,
        status:      'running',
        date:        date || new Date().toISOString().split('T')[0],
      }])
      .select()
      .single();

    if (error) throw error;

    // Inter-unit transfer: consume Unit 1 grey stock for this batch (FIFO by client+quality).
    if (client_id) {
      const consumed = await consumePool(
        'grey_stock',
        { client_id: Number(client_id), quality_id: quality_id ? Number(quality_id) : null },
        Number(input_kg)
      );
      await supabase.from('dyeing_production').update({ grey_consumed: consumed > 0 }).eq('id', data.id);
    }

    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
