import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin, requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    const status = req.nextUrl.searchParams.get('status');
    const month  = req.nextUrl.searchParams.get('month');
    const year   = req.nextUrl.searchParams.get('year');

    let query = supabase
      .from('coning_production')
      .select('*, erp_users(name), clients(name), qualities(name)')
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (month && year) {
      const start = `${year}-${String(month).padStart(2, '0')}-01`;
      const end   = `${year}-${String(month).padStart(2, '0')}-31`;
      query = query.gte('date', start).lte('date', end);
    }

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
    let { client_id, quality_id, shade_id, dyed_stock_id, cone_weight_kg, cones_count, quality_check, date } = await req.json();

    // If a dyed batch is picked, auto-fill client/quality/shade from it.
    if (dyed_stock_id) {
      const { data: ds } = await supabase
        .from('dyed_stock').select('client_id, quality_id, shade_id').eq('id', dyed_stock_id).maybeSingle();
      if (ds) { client_id = client_id || ds.client_id; quality_id = quality_id || ds.quality_id; shade_id = shade_id ?? ds.shade_id; }
    }

    if (!client_id || !quality_id || !cone_weight_kg || !cones_count) {
      return NextResponse.json({ error: 'Client, quality, cone weight and count required' }, { status: 400 });
    }

    const output_kg = Number(cone_weight_kg) * Number(cones_count);

    const { data, error } = await supabase
      .from('coning_production')
      .insert([{
        worker_id:      user.id,
        client_id:      Number(client_id),
        quality_id:     Number(quality_id),
        shade_id:       shade_id ? Number(shade_id) : null,
        dyed_stock_id:  dyed_stock_id ? Number(dyed_stock_id) : null,
        cone_weight_kg: Number(cone_weight_kg),
        cones_count:    Number(cones_count),
        output_kg,
        quality_check:  quality_check || 'pass',
        date:           date || new Date().toISOString().split('T')[0],
        status:         'pending',
      }])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
