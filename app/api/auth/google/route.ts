import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { supabase } from '@/lib/supabase';
import { JWT_SECRET } from '@/lib/auth';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;

export async function POST(req: NextRequest) {
  try {
    const { credential } = await req.json();
    if (!credential) return NextResponse.json({ error: 'No credential' }, { status: 400 });
    if (!CLIENT_ID) return NextResponse.json({ error: 'GOOGLE_CLIENT_ID not configured' }, { status: 500 });

    // Verify Google ID token
    const client = new OAuth2Client(CLIENT_ID);
    const ticket = await client.verifyIdToken({ idToken: credential, audience: CLIENT_ID });
    const gPayload = ticket.getPayload();
    if (!gPayload?.email) return NextResponse.json({ error: 'No email from Google' }, { status: 401 });

    const { email, name: googleName, sub: googleId, picture } = gPayload;

    // Look up existing user by email or google_id
    const { data: existing } = await supabase
      .from('erp_users')
      .select('*')
      .or(`email.eq.${email},google_id.eq.${googleId}`)
      .single();

    let user = existing;

    if (!user) {
      // Auto-create admin account on first Google sign-in
      const { data: created, error: createErr } = await supabase
        .from('erp_users')
        .insert([{
          name: googleName || email.split('@')[0],
          email,
          google_id: googleId,
          phone: null,
          pin_hash: '',           // no PIN for Google-auth admins
          role: 'admin',
          department: null,
          is_active: true,
        }])
        .select('*')
        .single();

      if (createErr) {
        console.error('[google auth] create user error:', createErr.message);
        return NextResponse.json({ error: 'Failed to create account: ' + createErr.message }, { status: 500 });
      }
      user = created;
    } else {
      if (!user.is_active) return NextResponse.json({ error: 'Account deactivated. Contact admin.' }, { status: 403 });
      // Keep email + google_id in sync
      if (!user.email || !user.google_id) {
        await supabase.from('erp_users').update({ email, google_id: googleId }).eq('id', user.id);
      }
    }

    const tokenPayload = {
      id: user.id,
      name: user.name,
      phone: user.phone ?? '',
      role: user.role,
      department: user.department,
    };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '30d' });
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await supabase.from('sessions').insert([{ user_id: user.id, token, expires_at: expiresAt.toISOString() }]);

    return NextResponse.json({ token, user: tokenPayload, isNew: !existing });
  } catch (e: any) {
    console.error('[google auth]', e.message);
    return NextResponse.json({ error: 'Google sign-in failed: ' + e.message }, { status: 500 });
  }
}
