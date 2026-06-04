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

    const client = new OAuth2Client(CLIENT_ID);
    const ticket = await client.verifyIdToken({ idToken: credential, audience: CLIENT_ID });
    const gPayload = ticket.getPayload();
    if (!gPayload?.email) return NextResponse.json({ error: 'No email from Google' }, { status: 401 });

    const { email, name: googleName, sub: googleId } = gPayload;

    // Check if user already exists
    const { data: existing } = await supabase
      .from('erp_users')
      .select('*')
      .or(`email.eq.${email},google_id.eq.${googleId}`)
      .single();

    if (existing) {
      // Existing user — log in directly
      if (!existing.is_active) {
        return NextResponse.json({ error: 'Account deactivated. Contact admin.' }, { status: 403 });
      }
      if (!existing.email || !existing.google_id) {
        await supabase.from('erp_users').update({ email, google_id: googleId }).eq('id', existing.id);
      }
      const tokenPayload = {
        id: existing.id, name: existing.name,
        phone: existing.phone ?? '', role: existing.role, department: existing.department,
      };
      const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '30d' });
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await supabase.from('sessions').insert([{ user_id: existing.id, token, expires_at: expiresAt.toISOString() }]);
      return NextResponse.json({ token, user: tokenPayload, isNew: false });
    }

    // New user — return profile info, let onboarding pick role
    return NextResponse.json({
      isNew: true,
      profile: { name: googleName || email.split('@')[0], email, googleId },
    });
  } catch (e: any) {
    console.error('[google auth]', e.message);
    return NextResponse.json({ error: 'Google sign-in failed: ' + e.message }, { status: 500 });
  }
}
