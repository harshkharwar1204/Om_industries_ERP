import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireRole } from '@/lib/auth';
import { addOrderProgress, bumpOrder } from '@/lib/transfer';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireRole(req, ['admin', 'dyeing_master']);
    const body = await req.json().catch(() => ({}));
    const output_kg = body.output_kg;
    const chemicals: { name: string; qty: number }[] = Array.isArray(body.chemicals) ? body.chemicals : [];

    const { data: batch } = await supabase
      .from('dyeing_production')
      .select('*')
      .eq('id', params.id)
      .single();
    if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    // Idempotency guard: a completed batch already created dyed_stock + deducted
    // chemicals + rolled up the order. Re-approving would double everything.
    if (batch.status === 'completed') return NextResponse.json({ error: 'Batch already approved' }, { status: 400 });

    // Conservation guard: dyed output can't exceed the grey input fed into the batch.
    if (output_kg != null && Number(output_kg) > Number(batch.input_kg) + 0.01) {
      return NextResponse.json({ error: `Output (${output_kg} kg) cannot exceed batch input (${batch.input_kg} kg)` }, { status: 400 });
    }

    const update: any = { status: 'completed', approved_at: new Date().toISOString() };
    if (output_kg != null) update.output_kg = Number(output_kg);

    const { data, error } = await supabase
      .from('dyeing_production')
      .update(update)
      .eq('id', params.id)
      .select()
      .single();
    if (error) throw error;

    const dyedKg = Number(output_kg ?? batch.output_kg ?? batch.input_kg);

    // Transfer: create finished dyed stock for this batch.
    await supabase.from('dyed_stock').insert([{
      batch_no:     batch.batch_no || `B-${batch.id}`,
      client_id:    batch.client_id,
      quality_id:   batch.quality_id,
      shade_id:     batch.shade_id,
      dyeing_id:    batch.id,
      order_id:     batch.order_id ?? null,
      weight_kg:    dyedKg,
      remaining_kg: dyedKg,
      status:       'available',
      date:         batch.date,
    }]);

    // Deduct chemicals from inventory (match by name, case-insensitive).
    for (const c of chemicals) {
      const qty = Number(c.qty);
      if (!c.name || !qty) continue;
      const { data: chem } = await supabase
        .from('chemicals').select('id, stock_qty').ilike('name', c.name).limit(1).maybeSingle();
      if (!chem) continue;
      await supabase.from('chemical_movements').insert([{
        chemical_id: chem.id, dyeing_id: batch.id, qty, type: 'out',
        note: `Batch ${batch.batch_no}`,
      }]);
      await supabase.from('chemicals').update({ stock_qty: Number(chem.stock_qty) - qty }).eq('id', chem.id);
    }

    // Order fulfillment rollup (direct if order-linked, else by match).
    if (batch.order_id) await bumpOrder(batch.order_id, 'dyed_kg', dyedKg);
    else await addOrderProgress('dyed_kg', { client_id: batch.client_id, quality_id: batch.quality_id, shade_id: batch.shade_id }, dyedKg);

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
