import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabase } from '@/lib/supabase';
import { requireStrictAdmin } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { admins } = await req.json();

    const { data: existing } = await supabase
      .from('erp_users').select('id').eq('role', 'admin').limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'Admin accounts already exist' }, { status: 400 });
    }

    if (!Array.isArray(admins) || admins.length === 0) {
      return NextResponse.json({ error: 'Provide admins array with name, phone, pin' }, { status: 400 });
    }

    const results: any[] = [];
    for (const admin of admins) {
      if (!admin.name || !admin.phone || !admin.pin) continue;
      const pin_hash = await bcrypt.hash(String(admin.pin), 10);
      const { data, error } = await supabase
        .from('erp_users')
        .insert([{ name: admin.name.trim(), phone: admin.phone.trim(), pin_hash, role: 'admin', is_active: true }])
        .select('id, name, phone, role').single();
      results.push(error ? { name: admin.name, error: error.message } : { name: admin.name, id: data.id, status: 'created' });
    }

    return NextResponse.json({ message: 'Admin setup complete', results }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  // Was public — leaked every user's name/phone/role. Admin-only now.
  try {
    requireStrictAdmin(req);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 });
  }
  const { data, error } = await supabase
    .from('erp_users').select('id, name, phone, role').order('created_at');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data, count: data?.length ?? 0 });
}
