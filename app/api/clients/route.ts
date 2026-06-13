import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
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
    // Never expose the portal passcode (hash or otherwise); expose only a boolean.
    const redacted = (data ?? []).map(({ portal_passcode, ...rest }: any) => ({ ...rest, has_passcode: !!portal_passcode }));
    return NextResponse.json(redacted);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message.includes('required') ? 403 : 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    requireAdmin(req);
    const { name, address, phone, gstin, state_code, dealer_type, portal_enabled, portal_passcode } = await req.json();
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });
    const pass = portal_passcode?.trim();
    const { data, error } = await supabase
      .from('clients').insert([{
        name:             name.trim(),
        address:          address?.trim()          || null,
        phone:            phone?.replace(/\D/g,'') || null,
        gstin:            gstin?.trim()            || null,
        state_code:       state_code?.trim()       || '24',
        dealer_type:      dealer_type              || 'registered',
        portal_enabled:   portal_enabled           ?? false,
        portal_passcode:  pass ? await bcrypt.hash(pass, 10) : null,
      }])
      .select().single();
    if (error) throw error;
    const { portal_passcode: _pc, ...safe } = data as any;
    return NextResponse.json({ ...safe, has_passcode: !!data.portal_passcode }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
