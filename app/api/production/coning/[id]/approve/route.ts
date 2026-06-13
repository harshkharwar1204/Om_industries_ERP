import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import { addOrderProgress, bumpOrder, consumePool } from '@/lib/transfer';

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

    const conedKgWanted = Number(entry.output_kg);

    // Conservation guard: can't cone more than the dyed stock that actually exists,
    // else ready_stock is created from nothing. Validate BEFORE approving.
    if (entry.dyed_stock_id) {
      const { data: ds } = await supabase.from('dyed_stock').select('remaining_kg').eq('id', entry.dyed_stock_id).maybeSingle();
      const avail = Number(ds?.remaining_kg ?? 0);
      if (conedKgWanted > avail + 0.01) {
        return NextResponse.json({ error: `Only ${avail.toFixed(1)} kg available in this dyed batch` }, { status: 400 });
      }
    } else {
      const { data: pool } = await supabase.from('dyed_stock').select('remaining_kg')
        .eq('client_id', entry.client_id).eq('quality_id', entry.quality_id).gt('remaining_kg', 0);
      const avail = (pool ?? []).reduce((s, r) => s + Number(r.remaining_kg), 0);
      if (conedKgWanted > avail + 0.01) {
        return NextResponse.json({ error: `Only ${avail.toFixed(1)} kg dyed stock available for this party/quality` }, { status: 400 });
      }
    }

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
      order_id:     entry.order_id ?? null,
      batch_no,
      cones:        entry.cones_count,
      weight_kg:    conedKg,
      remaining_kg: conedKg,
      status:       'available',
    }]);

    // Order fulfillment rollup (direct if order-linked, else by match). Completes order when coned >= qty.
    if (entry.order_id) await bumpOrder(entry.order_id, 'coned_kg', conedKg);
    else await addOrderProgress('coned_kg', { client_id: entry.client_id, quality_id: entry.quality_id, shade_id: entry.shade_id }, conedKg);

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
