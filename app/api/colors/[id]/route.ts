import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireAdmin(req);
    const { name, oldName } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Color name required' }, { status: 400 });
    const colorName = name.trim().toUpperCase();
    const { data, error } = await supabase
      .from('colors').update({ name: colorName }).eq('id', params.id).select().single();
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Color already exists' }, { status: 409 });
      throw error;
    }
    if (oldName) {
      await supabase.from('ingredients').update({ color_name: colorName }).eq('color_name', oldName);
    }
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireAdmin(req);
    const { error } = await supabase.from('colors').delete().eq('id', params.id);
    if (error) throw error;
    return NextResponse.json({ message: 'Color deleted' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
