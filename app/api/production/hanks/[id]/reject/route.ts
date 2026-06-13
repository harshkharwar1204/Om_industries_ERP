import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireAdmin(req);

    const { data: entry, error: fErr } = await supabase
      .from('hanks_production').select('*').eq('id', params.id).single();
    if (fErr || !entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    if (entry.status === 'rejected') return NextResponse.json(entry); // already rejected, no-op

    // Rejecting a PENDING entry is trivial — nothing moved yet.
    // Rejecting an APPROVED entry must reverse the stock it created, or we leave
    // phantom grey stock + inflated order fulfillment.
    if (entry.status === 'approved') {
      const producedKg = Number(entry.weight_kg);

      // The grey row this entry created. If it's been (partly) consumed by dyeing,
      // we can't cleanly reverse — block and tell the admin to correct downstream first.
      const { data: grey } = await supabase
        .from('grey_stock').select('id, weight_kg, remaining_kg').eq('source_hanks_id', entry.id).maybeSingle();
      if (grey && Number(grey.remaining_kg) < Number(grey.weight_kg)) {
        return NextResponse.json({ error: 'Cannot reject: this grey stock has already been used in dyeing' }, { status: 409 });
      }
      if (grey) await supabase.from('grey_stock').delete().eq('id', grey.id);

      // Restore the raw stock_inward consumed at approval (add back to newest matching lot).
      const { data: lot } = await supabase
        .from('stock_inward').select('id, remaining_weight_kg')
        .eq('client_id', entry.client_id).eq('quality_id', entry.quality_id)
        .order('date', { ascending: false }).limit(1).maybeSingle();
      if (lot) {
        await supabase.from('stock_inward')
          .update({ remaining_weight_kg: Number(lot.remaining_weight_kg) + producedKg }).eq('id', lot.id);
      }

      // Reverse order fulfillment (received_kg) on the linked order.
      if (entry.order_id) {
        const { data: o } = await supabase.from('orders').select('received_kg').eq('id', entry.order_id).maybeSingle();
        if (o) await supabase.from('orders')
          .update({ received_kg: Math.max(0, Number(o.received_kg ?? 0) - producedKg) }).eq('id', entry.order_id);
      }
    }

    const { data, error } = await supabase
      .from('hanks_production').update({ status: 'rejected' }).eq('id', params.id).select().single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
