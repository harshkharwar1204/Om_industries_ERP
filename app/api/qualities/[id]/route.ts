import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireAdmin(req);
    const { name, hanks_rate_per_kg, coning_rate_per_kg } = await req.json();
    const { data, error } = await supabase
      .from('qualities')
      .update({ name, hanks_rate_per_kg: Number(hanks_rate_per_kg), coning_rate_per_kg: Number(coning_rate_per_kg) })
      .eq('id', params.id).select().single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireAdmin(req);
    const { error } = await supabase.from('qualities').delete().eq('id', params.id);
    if (error) throw error;
    return NextResponse.json({ message: 'Deleted' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
