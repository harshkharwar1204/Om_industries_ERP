import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin, requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    requireAuth(req);
    const { data, error } = await supabase.from('items').select('*').order('name');
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message.includes('required') ? 403 : 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    requireAdmin(req);
    const { name, code, unit, description } = await req.json();
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });
    const { data, error } = await supabase
      .from('items')
      .insert([{ name: name.trim(), code: code?.trim() || null, unit: unit || 'kg', description: description?.trim() || null }])
      .select().single();
    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
