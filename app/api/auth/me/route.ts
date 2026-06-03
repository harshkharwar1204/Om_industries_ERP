import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const decoded = requireAuth(req);
    const { data: user, error } = await supabase
      .from('erp_users')
      .select('id, name, phone, role, department, is_active')
      .eq('id', decoded.id)
      .single();

    if (error || !user || !user.is_active) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
