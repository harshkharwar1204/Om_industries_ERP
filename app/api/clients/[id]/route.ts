import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireAdmin(req);
    const body = await req.json();
    const update: any = {
      name:             body.name,
      address:          body.address            || null,
      phone:            body.phone?.replace(/\D/g,'') || null,
      gstin:            body.gstin?.trim()      || null,
      state_code:       body.state_code?.trim() || '24',
      dealer_type:      body.dealer_type        || 'registered',
      portal_enabled:   body.portal_enabled     ?? false,
    };
    // Only touch the passcode when a new one is supplied (blank = keep existing);
    // store it hashed.
    const pass = body.portal_passcode?.trim();
    if (pass) update.portal_passcode = await bcrypt.hash(pass, 10);
    const { data, error } = await supabase
      .from('clients').update(update).eq('id', params.id).select().single();
    if (error) throw error;
    const { portal_passcode: _pc, ...safe } = data as any;
    return NextResponse.json({ ...safe, has_passcode: !!data.portal_passcode });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireAdmin(req);
    const { error } = await supabase.from('clients').delete().eq('id', params.id);
    if (error) throw error;
    return NextResponse.json({ message: 'Deleted' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
