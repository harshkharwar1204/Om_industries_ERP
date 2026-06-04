import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { supabase } from '@/lib/supabase';
import { JWT_SECRET } from '@/lib/auth';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;

export async function POST(req: NextRequest) {
  try {
    const { credential, role, department, name } = await req.json();
    if (!credential || !role) return NextResponse.json({ error: 'credential and role required' }, { status: 400 });

    const validRoles = ['admin', 'hanks_worker', 'coning_worker'];
    if (!validRoles.includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 });

    // Re-verify Google credential
    const client = new OAuth2Client(CLIENT_ID);
    const ticket = await client.verifyIdToken({ idToken: credential, audience: CLIENT_ID });
    const gPayload = ticket.getPayload();
    if (!gPayload?.email) return NextResponse.json({ error: 'Invalid credential' }, { status: 401 });

    const { email, name: googleName, sub: googleId } = gPayload;

    // Guard: don't create if already exists
    const { data: existing } = await supabase
      .from('erp_users')
      .select('id')
      .or(`email.eq.${email},google_id.eq.${googleId}`)
      .single();
    if (existing) return NextResponse.json({ error: 'Account already exists. Sign in normally.' }, { status: 409 });

    // Create account
    const { data: user, error } = await supabase
      .from('erp_users')
      .insert([{
        name: name || googleName || email.split('@')[0],
        email,
        google_id: googleId,
        phone: null,
        pin_hash: null,
        role,
        department: department || null,
        is_active: true,
      }])
      .select('*')
      .single();

    if (error) throw error;

    const tokenPayload = {
      id: user.id, name: user.name,
      phone: '', role: user.role, department: user.department,
    };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '30d' });
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await supabase.from('sessions').insert([{ user_id: user.id, token, expires_at: expiresAt.toISOString() }]);

    return NextResponse.json({ token, user: tokenPayload }, { status: 201 });
  } catch (e: any) {
    console.error('[auth/complete]', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
