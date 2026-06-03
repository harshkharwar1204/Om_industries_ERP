import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { supabase } from '@/lib/supabase';
import { JWT_SECRET } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { access_token } = await req.json();
    if (!access_token) return NextResponse.json({ error: 'No access token' }, { status: 400 });

    // Verify the Supabase access token and get user info
    const { data: sbUser, error: sbErr } = await supabase.auth.getUser(access_token);
    if (sbErr || !sbUser.user) {
      return NextResponse.json({ error: 'Invalid Google session' }, { status: 401 });
    }

    const email = sbUser.user.email;
    if (!email) return NextResponse.json({ error: 'No email from Google' }, { status: 401 });

    // Look up admin in erp_users by email
    const { data: user, error } = await supabase
      .from('erp_users')
      .select('*')
      .eq('email', email)
      .eq('role', 'admin')
      .single();

    if (error || !user) {
      // Auto-create admin if this is the first Google login and no email-matched user exists
      // Check if they're in erp_users at all (by Google UID)
      const { data: byUid } = await supabase
        .from('erp_users')
        .select('*')
        .eq('google_id', sbUser.user.id)
        .single();

      if (!byUid) {
        return NextResponse.json({
          error: `No admin account found for ${email}. Ask your administrator to link your Google account.`,
        }, { status: 403 });
      }

      if (!byUid.is_active) return NextResponse.json({ error: 'Account deactivated' }, { status: 403 });

      const payload = { id: byUid.id, name: byUid.name, phone: byUid.phone ?? '', role: byUid.role, department: byUid.department };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await supabase.from('sessions').insert([{ user_id: byUid.id, token, expires_at: expiresAt.toISOString() }]);
      return NextResponse.json({ token, user: payload });
    }

    if (!user.is_active) return NextResponse.json({ error: 'Account deactivated' }, { status: 403 });

    // Update email/google_id if not already set
    await supabase.from('erp_users').update({ email, google_id: sbUser.user.id }).eq('id', user.id);

    const payload = { id: user.id, name: user.name, phone: user.phone ?? '', role: user.role, department: user.department };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await supabase.from('sessions').insert([{ user_id: user.id, token, expires_at: expiresAt.toISOString() }]);

    return NextResponse.json({ token, user: payload });
  } catch (e: any) {
    console.error('[google auth]', e);
    return NextResponse.json({ error: 'Auth failed' }, { status: 500 });
  }
}
