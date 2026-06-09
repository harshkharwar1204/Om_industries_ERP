import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import { addOrderProgress, consumePool } from '@/lib/transfer';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireAdmin(req);

    const { data: entry, error: fetchErr } = await supabase
      .from('coning_production')
      .select('*, qualities(coning_rate_per_kg)')
      .eq('id', params.id)
      .single();

    if (fetchErr || !entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    if (entry.status === 'approved') return NextResponse.json({ error: 'Already approved' }, { status: 400 });

    const rate = entry.qualities?.coning_rate_per_kg ?? 0;
    const total_earned = Number(entry.output_kg) * Number(rate);

    const { data, error } = await supabase
      .from('coning_production')
      .update({ status: 'approved', rate_per_kg: rate, total_earned, approved_at: new Date().toISOString() })
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;

    const conedKg = Number(entry.output_kg);

    // Resolve batch number from linked dyed stock (if any).
    let batch_no: string | null = null;
    if (entry.dyed_stock_id) {
      const { data: ds } = await supabase.from('dyed_stock').select('batch_no').eq('id', entry.dyed_stock_id).maybeSingle();
      batch_no = ds?.batch_no ?? null;
    }

    // Transfer: consume dyed stock (by batch if linked, else FIFO by client+quality).
    if (entry.dyed_stock_id) {
      const { data: ds } = await supabase.from('dyed_stock').select('remaining_kg').eq('id', entry.dyed_stock_id).single();
      if (ds) {
        const left = Math.max(Number(ds.remaining_kg) - conedKg, 0);
        await supabase.from('dyed_stock').update({ remaining_kg: left, status: left <= 0 ? 'coned' : 'available' }).eq('id', entry.dyed_stock_id);
      }
    } else {
      await consumePool('dyed_stock', { client_id: entry.client_id, quality_id: entry.quality_id }, conedKg);
    }

    // Transfer: create finished packed stock (ready stock).
    await supabase.from('ready_stock').insert([{
      coning_id:    entry.id,
      client_id:    entry.client_id,
      quality_id:   entry.quality_id,
      shade_id:     entry.shade_id,
      batch_no,
      cones:        entry.cones_count,
      weight_kg:    conedKg,
      remaining_kg: conedKg,
      status:       'available',
    }]);

    // Order fulfillment rollup.
    await addOrderProgress('coned_kg', { client_id: entry.client_id, quality_id: entry.quality_id, shade_id: entry.shade_id }, conedKg);

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
