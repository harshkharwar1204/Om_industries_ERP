import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

// Module 8: split-warehouse snapshot across all units.
export async function GET(req: NextRequest) {
  try {
    requireAuth(req);

    const [raw, grey, dyed, packed, chemicals] = await Promise.all([
      supabase.from('stock_inward').select('id, weight_kg, remaining_weight_kg, challan_no, clients(name), qualities(name)').gt('remaining_weight_kg', 0),
      supabase.from('grey_stock').select('id, weight_kg, remaining_kg, date, clients(name), qualities(name)').gt('remaining_kg', 0),
      supabase.from('dyed_stock').select('id, batch_no, weight_kg, remaining_kg, status, clients(name), qualities(name), shades(name)').gt('remaining_kg', 0),
      supabase.from('ready_stock').select('id, batch_no, weight_kg, cones, status, clients(name), qualities(name), shades(name)').eq('status', 'available'),
      supabase.from('chemicals').select('id, name, unit, stock_qty, low_threshold'),
    ]);

    return NextResponse.json({
      raw: raw.data ?? [],
      grey: grey.data ?? [],
      dyed: dyed.data ?? [],
      packed: packed.data ?? [],
      chemicals: chemicals.data ?? [],
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message.includes('required') ? 403 : 500 });
  }
}
