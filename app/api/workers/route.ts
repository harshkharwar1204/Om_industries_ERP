import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    const dept = req.nextUrl.searchParams.get('department');
    let query = supabase
      .from('erp_users')
      .select('id, name, phone, email, role, department, is_active, created_at')
      .order('name');
    if (dept) query = query.eq('department', dept);
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
    const { name, phone, email, pin, role, department } = body;

    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });
    if (!phone && !email) return NextResponse.json({ error: 'Phone or Gmail required' }, { status: 400 });

    let pin_hash: string | null = null;
    if (pin) pin_hash = await bcrypt.hash(String(pin), 10);

    const { data, error } = await supabase
      .from('erp_users')
      .insert([{
        name: name.trim(),
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        pin_hash,
        role: role || 'hanks_worker',
        department: department || null,
        is_active: true,
      }])
      .select('id, name, phone, email, role, department, is_active')
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
