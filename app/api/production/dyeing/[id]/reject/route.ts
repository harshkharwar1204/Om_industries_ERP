import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import { logAction } from '@/lib/audit';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = requireAdmin(req);

    const { data: batch, error: fErr } = await supabase
      .from('dyeing_production').select('*').eq('id', params.id).single();
    if (fErr || !batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    if (batch.status === 'rejected') return NextResponse.json(batch); // no-op
    // A completed batch already produced dyed_stock + deducted chemicals — can't reject.
    if (batch.status === 'completed') {
      return NextResponse.json({ error: 'Cannot reject a completed batch; use a correction instead' }, { status: 409 });
    }

    // Grey was FIFO-consumed at batch creation. Restore it by returning the consumed
    // weight to the grey pool so the chain stays balanced.
    if (batch.grey_consumed && batch.client_id) {
      const kg = Number(batch.input_kg);
      await supabase.from('grey_stock').insert([{
        client_id:    batch.client_id,
        quality_id:   batch.quality_id,
        order_id:     batch.order_id ?? null,
        weight_kg:    kg,
        remaining_kg: kg,
        date:         batch.date,
      }]);
    }

    const { data, error } = await supabase
      .from('dyeing_production').update({ status: 'rejected' }).eq('id', params.id).select().single();
    if (error) throw error;
    await logAction(actor, 'reject', 'dyeing_production', batch.id,
      `Rejected dyeing batch ${batch.batch_no}${batch.grey_consumed ? ' (restored grey stock)' : ''}`, { batch_no: batch.batch_no, input_kg: batch.input_kg });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
