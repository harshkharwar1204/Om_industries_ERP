import { NextRequest, NextResponse } from 'next/server';
import { getToken } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const token = getToken(req);
  if (token) await supabase.from('sessions').delete().eq('token', token);
  return NextResponse.json({ message: 'Logged out' });
}
