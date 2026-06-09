import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'om-industries-erp-secret-2024';

export async function POST(req: NextRequest) {
  try {
    const { phone, passcode } = await req.json();
    if (!phone || !passcode) return NextResponse.json({ error: 'Phone and passcode required' }, { status: 400 });

    const cleanPhone = String(phone).replace(/\D/g, '');

    const { data: client, error } = await supabase
      .from('clients')
      .select('id, name, phone, portal_enabled, portal_passcode, gstin, address, dealer_type')
      .eq('phone', cleanPhone)
      .eq('portal_enabled', true)
      .maybeSingle();

    if (error || !client) {
      return NextResponse.json({ error: 'Phone number not found or portal not enabled' }, { status: 401 });
    }

    if (client.portal_passcode !== String(passcode).trim()) {
      return NextResponse.json({ error: 'Invalid passcode' }, { status: 401 });
    }

    const token = jwt.sign({ clientId: client.id, type: 'portal' }, JWT_SECRET, { expiresIn: '7d' });

    return NextResponse.json({
      token,
      client: { id: client.id, name: client.name, phone: client.phone, gstin: client.gstin, address: client.address },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
