import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import { addOrderProgress } from '@/lib/transfer';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireAdmin(req);

    // Fetch entry + quality rate
    const { data: entry, error: fetchErr } = await supabase
      .from('hanks_production')
      .select('*, qualities(hanks_rate_per_kg)')
      .eq('id', params.id)
      .single();

    if (fetchErr || !entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    if (entry.status === 'approved') return NextResponse.json({ error: 'Already approved' }, { status: 400 });

    const rate = entry.qualities?.hanks_rate_per_kg ?? 0;
    const total_earned = Number(entry.weight_kg) * Number(rate);

    // Approve the entry
    const { data, error } = await supabase
      .from('hanks_production')
      .update({ status: 'approved', rate_per_kg: rate, total_earned, approved_at: new Date().toISOString() })
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;

    // FIFO stock deduction — oldest matching stock first
    let remaining = Number(entry.weight_kg);
    const { data: stockRows } = await supabase
      .from('stock_inward')
      .select('id, remaining_weight_kg')
      .eq('client_id', entry.client_id)
      .eq('quality_id', entry.quality_id)
      .gt('remaining_weight_kg', 0)
      .order('date', { ascending: true });

    if (stockRows && stockRows.length > 0) {
      for (const row of stockRows) {
        if (remaining <= 0) break;
        const available = Number(row.remaining_weight_kg);
        const deduct = Math.min(available, remaining);
        await supabase
          .from('stock_inward')
          .update({ remaining_weight_kg: available - deduct })
          .eq('id', row.id);
        remaining -= deduct;
      }
    }

    // Inter-unit transfer: finished hanks become Unit 1 raw grey stock.
    const producedKg = Number(entry.weight_kg);
    await supabase.from('grey_stock').insert([{
      client_id:       entry.client_id,
      quality_id:      entry.quality_id,
      weight_kg:       producedKg,
      remaining_kg:    producedKg,
      source_hanks_id: entry.id,
      date:            entry.date,
    }]);

    // Order fulfillment: count toward received weight.
    await addOrderProgress('received_kg', { client_id: entry.client_id, quality_id: entry.quality_id }, producedKg);

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
