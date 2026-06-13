import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabase } from '@/lib/supabase';
import { requireStrictAdmin } from '@/lib/auth';
import { logAction } from '@/lib/audit';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = requireStrictAdmin(req);
    const { pin } = await req.json();
    if (!pin) return NextResponse.json({ error: 'PIN required' }, { status: 400 });
    const pin_hash = await bcrypt.hash(String(pin), 10);
    const { error } = await supabase.from('erp_users').update({ pin_hash }).eq('id', params.id);
    if (error) throw error;
    await logAction(actor, 'pin_reset', 'erp_users', params.id, `Reset PIN for worker ${params.id}`);
    return NextResponse.json({ message: 'PIN updated' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
