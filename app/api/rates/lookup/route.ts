import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

// Returns the most specific, most-recent effective rate for a given client+item+shade combo.
// Specificity order: client+item+shade > client+item > client-only
export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    const client_id = req.nextUrl.searchParams.get('client_id');
    const item_id   = req.nextUrl.searchParams.get('item_id');
    const shade_id  = req.nextUrl.searchParams.get('shade_id');
    const today     = new Date().toISOString().split('T')[0];

    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 });

    const { data, error } = await supabase
      .from('rates')
      .select('id, rate_per_kg, effective_date, item_id, shade_id')
      .eq('client_id', Number(client_id))
      .lte('effective_date', today)
      .order('effective_date', { ascending: false });

    if (error) throw error;
    if (!data?.length) return NextResponse.json({ rate: null });

    // Most specific match wins
    const rows = data as any[];
    const iid = item_id  ? Number(item_id)  : null;
    const sid = shade_id ? Number(shade_id) : null;

    const exact   = rows.find(r => r.item_id === iid  && r.shade_id === sid);
    const itemOnly = rows.find(r => r.item_id === iid  && r.shade_id === null);
    const clientOnly = rows.find(r => r.item_id === null && r.shade_id === null);

    const match = exact ?? itemOnly ?? clientOnly ?? null;
    return NextResponse.json({ rate: match?.rate_per_kg ?? null, matched: match });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
