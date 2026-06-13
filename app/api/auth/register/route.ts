import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '@/lib/supabase';
import { JWT_SECRET, requireStrictAdmin } from '@/lib/auth';

const WORKER_ROLES = ['hanks_worker', 'coning_worker', 'dyeing_master', 'dyeing_worker'];

export async function POST(req: NextRequest) {
  try {
    // Account creation is admin-only. Previously public -> anyone could self-register
    // as dyeing_master (which passes requireAdmin) and gain operational-admin access.
    requireStrictAdmin(req);
    const { name, phone, pin, role, department } = await req.json();

    if (!name?.trim())  return NextResponse.json({ error: 'Name required' },       { status: 400 });
    if (!phone?.trim()) return NextResponse.json({ error: 'Phone required' },      { status: 400 });
    if (!pin || String(pin).length !== 4) return NextResponse.json({ error: 'PIN must be 4 digits' }, { status: 400 });
    if (!WORKER_ROLES.includes(role))     return NextResponse.json({ error: 'Invalid role' },        { status: 400 });

    const cleanPhone = String(phone).replace(/\D/g, '');
    if (cleanPhone.length !== 10) return NextResponse.json({ error: 'Phone must be 10 digits' }, { status: 400 });

    // Check duplicate
    const { data: existing } = await supabase
      .from('erp_users').select('id').eq('phone', cleanPhone).maybeSingle();
    if (existing) return NextResponse.json({ error: 'Phone number already registered' }, { status: 409 });

    const pin_hash = await bcrypt.hash(String(pin), 10);

    const { data: user, error } = await supabase
      .from('erp_users')
      .insert([{
        name:       name.trim(),
        phone:      cleanPhone,
        pin_hash,
        role,
        department: department || null,
        is_active:  true,
      }])
      .select('id, name, phone, role, department')
      .single();

    if (error) throw error;

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });

    return NextResponse.json({ token, user }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: /required|denied|token|unauthor/i.test(e.message) ? 403 : 400 });
  }
}
