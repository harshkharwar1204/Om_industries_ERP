import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '@/lib/supabase';
import { JWT_SECRET } from '@/lib/auth';

const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60 * 1000;

async function getThrottle(phone: string) {
  const { data } = await supabase
    .from('login_attempts')
    .select('attempt_count, first_attempt_at, locked_until')
    .eq('phone', phone)
    .maybeSingle();
  return data;
}

async function recordFail(phone: string) {
  const rec = await getThrottle(phone);
  if (!rec) {
    await supabase.from('login_attempts').insert({ phone, attempt_count: 1 });
    return;
  }
  const windowExpired = Date.now() - new Date(rec.first_attempt_at).getTime() > WINDOW_MS;
  if (windowExpired) {
    await supabase.from('login_attempts').update({ attempt_count: 1, first_attempt_at: new Date().toISOString(), locked_until: null }).eq('phone', phone);
    return;
  }
  const count = rec.attempt_count + 1;
  const lockedUntil = count >= MAX_FAILS ? new Date(Date.now() + WINDOW_MS).toISOString() : null;
  await supabase.from('login_attempts').update({ attempt_count: count, locked_until: lockedUntil }).eq('phone', phone);
}

async function clearThrottle(phone: string) {
  await supabase.from('login_attempts').delete().eq('phone', phone);
}

export async function POST(req: NextRequest) {
  try {
    const { phone, pin } = await req.json();
    if (!phone || !pin) {
      return NextResponse.json({ error: 'Phone and PIN required' }, { status: 400 });
    }

    const key = String(phone).trim();
    const rec = await getThrottle(key);

    if (rec?.locked_until && new Date(rec.locked_until) > new Date()) {
      const mins = Math.ceil((new Date(rec.locked_until).getTime() - Date.now()) / 60000);
      return NextResponse.json({ error: `Too many attempts. Try again in ${mins} min.` }, { status: 429 });
    }

    // Reset if window expired
    if (rec && Date.now() - new Date(rec.first_attempt_at).getTime() > WINDOW_MS) {
      await clearThrottle(key);
    }

    const { data: user, error } = await supabase
      .from('erp_users')
      .select('*')
      .eq('phone', phone.trim())
      .single();

    if (error || !user) {
      await recordFail(key);
      return NextResponse.json({ error: 'Invalid phone number or PIN' }, { status: 401 });
    }
    if (!user.is_active) {
      return NextResponse.json({ error: 'Account deactivated. Contact admin.' }, { status: 403 });
    }

    const valid = await bcrypt.compare(pin, user.pin_hash);
    if (!valid) {
      await recordFail(key);
      return NextResponse.json({ error: 'Invalid phone number or PIN' }, { status: 401 });
    }
    await clearThrottle(key);

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
