import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    const client_id = req.nextUrl.searchParams.get('client_id');

    let query = supabase
      .from('rates')
      .select('*, clients(name), items(name, unit)')
      .order('effective_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (client_id) query = query.eq('client_id', client_id);

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
    const { client_id, item_id, shade_id, rate_per_kg, effective_date, notes } = await req.json();

    if (!client_id || !rate_per_kg) {
      return NextResponse.json({ error: 'Client and rate required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('rates')
      .insert([{
        client_id:      Number(client_id),
        item_id:        item_id    ? Number(item_id)  : null,
        shade_id:       shade_id   ? Number(shade_id) : null,
        rate_per_kg:    Number(rate_per_kg),
        effective_date: effective_date || new Date().toISOString().split('T')[0],
        notes:          notes?.trim() || null,
      }])
      .select('*, clients(name), items(name, unit)')
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
