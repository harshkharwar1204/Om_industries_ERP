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
    if (!CLIENT_ID) return NextResponse.json({ error: 'Google Client ID not configured on server' }, { status: 500 });

    // Verify the Google ID token
    const client = new OAuth2Client(CLIENT_ID);
    const ticket = await client.verifyIdToken({ idToken: credential, audience: CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload?.email) return NextResponse.json({ error: 'No email from Google' }, { status: 401 });

    const { email, name: googleName, sub: googleId } = payload;

    // Find admin by email or google_id
    let { data: user } = await supabase
      .from('erp_users')
      .select('*')
      .or(`email.eq.${email},google_id.eq.${googleId}`)
      .eq('role', 'admin')
      .single();

    if (!user) {
      return NextResponse.json({
        error: `No admin account for ${email}. Ask admin to link your Google account.`,
      }, { status: 403 });
    }

    if (!user.is_active) return NextResponse.json({ error: 'Account deactivated' }, { status: 403 });

    // Persist email + google_id if not set
    if (!user.email || !user.google_id) {
      await supabase.from('erp_users').update({ email, google_id: googleId }).eq('id', user.id);
    }

    const tokenPayload = {
      id: user.id, name: user.name || googleName || email,
      phone: user.phone ?? '', role: user.role, department: user.department,
    };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '30d' });
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await supabase.from('sessions').insert([{ user_id: user.id, token, expires_at: expiresAt.toISOString() }]);

    return NextResponse.json({ token, user: tokenPayload });
  } catch (e: any) {
    console.error('[google auth]', e.message);
    return NextResponse.json({ error: 'Google sign-in failed: ' + e.message }, { status: 500 });
  }
}
