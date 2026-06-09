import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireAdmin(req);
    const { client_id, item_id, shade_id, rate_per_kg, effective_date, notes } = await req.json();

    const { data, error } = await supabase
      .from('rates')
      .update({
        client_id:      client_id    ? Number(client_id)  : null,
        item_id:        item_id      ? Number(item_id)    : null,
        shade_id:       shade_id     ? Number(shade_id)   : null,
        rate_per_kg:    Number(rate_per_kg),
        effective_date: effective_date,
        notes:          notes?.trim() || null,
      })
      .eq('id', params.id)
      .select('*, clients(name), items(name, unit)')
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireAdmin(req);
    const { error } = await supabase.from('rates').delete().eq('id', params.id);
    if (error) throw error;
    return NextResponse.json({ message: 'Deleted' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
