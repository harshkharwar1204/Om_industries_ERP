import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireAdmin(req);
    const body = await req.json();
    const { name, phone, email, role, department } = body;
    const { data, error } = await supabase
      .from('erp_users')
      .update({
        name,
        phone: phone || null,
        email: email || null,
        role,
        department: department || null,
      })
      .eq('id', params.id)
      .select('id, name, phone, email, role, department, is_active')
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
