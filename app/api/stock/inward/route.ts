import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import { monthRange } from '@/lib/dates';

export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    const month = req.nextUrl.searchParams.get('month');
    const year  = req.nextUrl.searchParams.get('year');
    let query = supabase
      .from('stock_inward')
      .select('*, clients(name), qualities(name)')
      .order('date', { ascending: false });
    if (month && year) {
      const { start, end } = monthRange(month, year);
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
    requireAdmin(req);
    const body = await req.json();
    const { date, challan_no, client_id, quality_id, weight_kg, bundles } = body;
    if (!client_id || !quality_id || !weight_kg) {
      return NextResponse.json({ error: 'Client, quality and weight required' }, { status: 400 });
    }
    const { data, error } = await supabase
      .from('stock_inward')
      .insert([{
        date: date || new Date().toISOString().split('T')[0],
        challan_no: challan_no || null,
        client_id: Number(client_id),
        quality_id: Number(quality_id),
        weight_kg: Number(weight_kg),
        remaining_weight_kg: Number(weight_kg),
        bundles: bundles ? Number(bundles) : null,
      }])
      .select('*, clients(name), qualities(name)')
      .single();
    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
