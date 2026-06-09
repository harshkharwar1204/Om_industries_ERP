import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    const client_id = req.nextUrl.searchParams.get('client_id');
    let query = supabase
      .from('communication_log')
      .select('*, clients(name)')
      .order('created_at', { ascending: false })
      .limit(200);
    if (client_id) query = query.eq('client_id', Number(client_id));
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
    const { client_id, type = 'whatsapp', category, content, amount, reference_no } = await req.json();
    if (!client_id || !category || !content) {
      return NextResponse.json({ error: 'client_id, category and content required' }, { status: 400 });
    }
    const { data, error } = await supabase
      .from('communication_log')
      .insert([{ client_id: Number(client_id), type, category, content, amount: amount || null, reference_no: reference_no || null, status: 'sent' }])
      .select().single();
    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
