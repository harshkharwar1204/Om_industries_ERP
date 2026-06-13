import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabase } from '@/lib/supabase';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/lib/auth';

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

    // Passcodes are stored bcrypt-hashed. Legacy plaintext values are compared
    // directly and silently upgraded to a hash on first successful login.
    const stored = String(client.portal_passcode ?? '');
    const entered = String(passcode).trim();
    const isHashed = stored.startsWith('$2');
    const ok = isHashed ? await bcrypt.compare(entered, stored) : stored === entered;
    if (!ok) {
      return NextResponse.json({ error: 'Invalid passcode' }, { status: 401 });
    }
    if (!isHashed) {
      // lazy migrate plaintext -> hash
      await supabase.from('clients').update({ portal_passcode: await bcrypt.hash(entered, 10) }).eq('id', client.id);
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
