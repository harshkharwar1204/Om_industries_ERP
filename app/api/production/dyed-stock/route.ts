import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

// Available dyed batches — used by coning workers to pick a batch, and warehouse views.
export async function GET(req: NextRequest) {
  try {
    requireAuth(req);
    const all = req.nextUrl.searchParams.get('all');
    let query = supabase
      .from('dyed_stock')
      .select('*, clients(name), qualities(name), shades(name)')
      .order('date', { ascending: false });
    if (!all) query = query.gt('remaining_kg', 0);
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message.includes('required') ? 403 : 500 });
  }
}
