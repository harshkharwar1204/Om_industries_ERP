import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '@/lib/supabase';
import { JWT_SECRET } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { phone, pin } = await req.json();
    if (!phone || !pin) {
      return NextResponse.json({ error: 'Phone and PIN required' }, { status: 400 });
    }

    const { data: user, error } = await supabase
      .from('erp_users')
      .select('*')
      .eq('phone', phone.trim())
      .single();

    if (error || !user) {
      return NextResponse.json({ error: 'Invalid phone number or PIN' }, { status: 401 });
    }
    if (!user.is_active) {
      return NextResponse.json({ error: 'Account deactivated. Contact admin.' }, { status: 403 });
    }

    const valid = await bcrypt.compare(pin, user.pin_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid phone number or PIN' }, { status: 401 });
    }

    const payload = {
      id: user.id, name: user.name, phone: user.phone,
      role: user.role, department: user.department,
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await supabase.from('sessions').insert([{
      user_id: user.id, token, expires_at: expiresAt.toISOString(),
    }]);

    return NextResponse.json({ token, user: payload });
  } catch (e) {
    console.error('Login error:', e);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
