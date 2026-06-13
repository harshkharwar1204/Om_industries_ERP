import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin, requireWorker, requireAuth } from '@/lib/auth';
import { monthRange } from '@/lib/dates';

export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    const status   = req.nextUrl.searchParams.get('status');
    const workerId = req.nextUrl.searchParams.get('worker_id');
    const month    = req.nextUrl.searchParams.get('month');
    const year     = req.nextUrl.searchParams.get('year');

    let query = supabase
      .from('hanks_production')
      .select('*, erp_users(name), clients(name), qualities(name)')
      .order('created_at', { ascending: false });

    if (status)   query = query.eq('status', status);
    if (workerId) query = query.eq('worker_id', workerId);
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
    const user = requireAuth(req);
    const body = await req.json();
    const { client_id, quality_id, weight_kg, date, order_id } = body;
    if (!client_id || !quality_id || !weight_kg) {
      return NextResponse.json({ error: 'Client, quality and weight required' }, { status: 400 });
    }
    const { data, error } = await supabase
      .from('hanks_production')
      .insert([{
        worker_id: user.id,
        client_id: Number(client_id),
        quality_id: Number(quality_id),
        order_id: order_id ? Number(order_id) : null,
        weight_kg: Number(weight_kg),
        date: date || new Date().toISOString().split('T')[0],
        status: 'pending',
      }])
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
