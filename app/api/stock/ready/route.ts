import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin, requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    requireAuth(req);
    const status = req.nextUrl.searchParams.get('status');

    let query = supabase
      .from('ready_stock')
      .select('*, stock_inward(challan_no, clients(name)), coning_production(id)')
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
    const { lot_id, coning_id, shade_id, cones, weight_kg, grade, location } = await req.json();
    if (!weight_kg) return NextResponse.json({ error: 'Weight required' }, { status: 400 });

    const { data, error } = await supabase
      .from('ready_stock')
      .insert([{
        lot_id:     lot_id ? Number(lot_id) : null,
        coning_id:  coning_id ? Number(coning_id) : null,
        shade_id:   shade_id ? Number(shade_id) : null,
        cones:      cones ? Number(cones) : null,
        weight_kg:  Number(weight_kg),
        grade:      grade || 'standard',
        location:   location?.trim() || null,
        status:     'available',
      }])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    requireAdmin(req);
    const { id, status, location } = await req.json();
    const update: any = {};
    if (status)   update.status = status;
    if (location) update.location = location;

    const { data, error } = await supabase.from('ready_stock').update(update).eq('id', id).select().single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
