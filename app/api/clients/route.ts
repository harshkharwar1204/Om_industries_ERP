import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin, requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    requireAuth(req);
    const q = req.nextUrl.searchParams.get('q');
    let query = supabase.from('clients').select('*').order('name');
    if (q) query = query.ilike('name', `%${q}%`);
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message.includes('required') ? 403 : 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    requireAdmin(req);
    const { name, address, phone, gstin, state_code, dealer_type, portal_enabled, portal_passcode } = await req.json();
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });
    const { data, error } = await supabase
      .from('clients').insert([{
        name:             name.trim(),
        address:          address?.trim()          || null,
        phone:            phone?.replace(/\D/g,'') || null,
        gstin:            gstin?.trim()            || null,
        state_code:       state_code?.trim()       || '24',
        dealer_type:      dealer_type              || 'registered',
        portal_enabled:   portal_enabled           ?? false,
        portal_passcode:  portal_passcode?.trim()  || null,
      }])
      .select().single();
    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
