import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    const { data, error } = await supabase.from('colors').select('*').order('name');
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    requireAdmin(req);
    const { name } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Color name required' }, { status: 400 });
    const { data, error } = await supabase
      .from('colors').insert([{ name: name.trim().toUpperCase() }]).select().single();
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Color already exists' }, { status: 409 });
      throw error;
    }
    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
