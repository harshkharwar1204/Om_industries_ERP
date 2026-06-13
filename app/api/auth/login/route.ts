import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '@/lib/supabase';
import { JWT_SECRET } from '@/lib/auth';

// Brute-force throttle: a 4-digit PIN is only 10k combos. Lock a phone after
// MAX_FAILS failures within WINDOW_MS. In-memory (per server instance) — good
// enough for a single-node deploy; swap for a table/Redis if scaled out.
const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; first: number }>();
function throttleState(key: string) {
  const now = Date.now();
  const rec = attempts.get(key);
  if (rec && now - rec.first > WINDOW_MS) { attempts.delete(key); return null; }
  return rec ?? null;
}
function recordFail(key: string) {
  const now = Date.now();
  const rec = throttleState(key);
  if (rec) { rec.count += 1; } else { attempts.set(key, { count: 1, first: now }); }
}

export async function POST(req: NextRequest) {
  try {
    const { phone, pin } = await req.json();
    if (!phone || !pin) {
      return NextResponse.json({ error: 'Phone and PIN required' }, { status: 400 });
    }

    const key = String(phone).trim();
    const rec = throttleState(key);
    if (rec && rec.count >= MAX_FAILS) {
      const mins = Math.ceil((WINDOW_MS - (Date.now() - rec.first)) / 60000);
      return NextResponse.json({ error: `Too many attempts. Try again in ${mins} min.` }, { status: 429 });
    }

    const { data: user, error } = await supabase
      .from('erp_users')
      .select('*')
      .eq('phone', phone.trim())
      .single();

    if (error || !user) {
      recordFail(key);
      return NextResponse.json({ error: 'Invalid phone number or PIN' }, { status: 401 });
    }
    if (!user.is_active) {
      return NextResponse.json({ error: 'Account deactivated. Contact admin.' }, { status: 403 });
    }

    const valid = await bcrypt.compare(pin, user.pin_hash);
    if (!valid) {
      recordFail(key);
      return NextResponse.json({ error: 'Invalid phone number or PIN' }, { status: 401 });
    }
    attempts.delete(key); // success clears the counter

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
