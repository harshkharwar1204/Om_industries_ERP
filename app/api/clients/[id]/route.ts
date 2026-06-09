import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireAdmin(req);
    const body = await req.json();
    const { data, error } = await supabase
      .from('clients').update({
        name:             body.name,
        address:          body.address            || null,
        phone:            body.phone?.replace(/\D/g,'') || null,
        gstin:            body.gstin?.trim()      || null,
        state_code:       body.state_code?.trim() || '24',
        dealer_type:      body.dealer_type        || 'registered',
        portal_enabled:   body.portal_enabled     ?? false,
        portal_passcode:  body.portal_passcode?.trim() || null,
      })
      .eq('id', params.id).select().single();
    if (error) throw error;
    return NextResponse.json(data);
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
