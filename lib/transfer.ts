import { supabase } from '@/lib/supabase';

/**
 * Inter-unit stock transfer + order fulfillment helpers.
 * Flow: stock_inward -> hanks (Unit2) -> grey_stock (Unit1) -> dyed_stock (batch)
 *       -> coning -> ready_stock (packed) -> challan/dispatch.
 * Order fulfillment is rolled up by client + quality (+ shade where available).
 */

/** FIFO-consume `kg` from a pool table's `remaining_kg`, oldest first. Returns kg actually consumed. */
export async function consumePool(
  table: 'grey_stock' | 'dyed_stock',
  match: Record<string, number | string | null>,
  kg: number
): Promise<number> {
  // Prefer the atomic, row-locked DB function (db/migrations/002_atomic_consume_pool.sql).
  // It eliminates the read-then-write race below. Falls back to JS if not deployed.
  const client_id = (match.client_id ?? null) as number | null;
  const quality_id = (match.quality_id ?? null) as number | null;
  if (client_id != null && !('shade_id' in match)) {
    try {
      const { data, error } = await supabase.rpc('consume_pool', {
        p_table: table, p_client: client_id, p_quality: quality_id, p_kg: Number(kg),
      });
      if (!error && data != null) return Number(data);
    } catch { /* function not deployed — use JS fallback */ }
  }

  let remaining = Number(kg);
  let q = supabase.from(table).select('id, remaining_kg').gt('remaining_kg', 0);
  for (const [k, v] of Object.entries(match)) {
    if (v !== null && v !== undefined) q = q.eq(k, v);
  }
  const { data: rows } = await q.order('date', { ascending: true });
  if (!rows) return 0;
  let consumed = 0;
  for (const row of rows) {
    if (remaining <= 0) break;
    const avail = Number(row.remaining_kg);
    const take = Math.min(avail, remaining);
    const update: any = { remaining_kg: avail - take };
    if (table === 'dyed_stock' && avail - take <= 0) update.status = 'coned';
    await supabase.from(table).update(update).eq('id', row.id);
    remaining -= take;
    consumed += take;
  }
  return consumed;
}

/**
 * Recompute fulfillment columns for matching open orders.
 * Adds `kg` to the given stage column on the oldest matching pending/processing order.
 */
/** Add `kg` to a specific order's stage counter; auto-advance status. Used when production is order-linked. */
export async function bumpOrder(
  orderId: number,
  stage: 'received_kg' | 'dyed_kg' | 'coned_kg',
  kg: number
): Promise<void> {
  if (!orderId || !kg) return;
  const { data: o } = await supabase
    .from('orders').select('id, qty_kg, received_kg, dyed_kg, coned_kg, status').eq('id', orderId).single();
  if (!o) return;
  const newVal = Number((o as any)[stage] ?? 0) + Number(kg);
  const cap = Number(o.qty_kg ?? 0);
  const update: any = { [stage]: newVal };
  if (o.status === 'pending') update.status = 'processing';
  if (stage === 'coned_kg' && cap > 0 && newVal >= cap) update.status = 'completed';
  await supabase.from('orders').update(update).eq('id', orderId);
}

export async function addOrderProgress(
  stage: 'received_kg' | 'dyed_kg' | 'coned_kg',
  match: { client_id?: number | null; quality_id?: number | null; shade_id?: number | null },
  kg: number
): Promise<void> {
  if (!match.client_id || !kg) return;
  let q = supabase
    .from('orders')
    .select('id, qty_kg, received_kg, dyed_kg, coned_kg, status')
    .eq('client_id', match.client_id)
    .in('status', ['pending', 'processing'])
    .order('created_at', { ascending: true });
  if (match.quality_id) q = q.eq('quality_id', match.quality_id);
  if (match.shade_id) q = q.eq('shade_id', match.shade_id);

  const { data: orders } = await q;
  if (!orders || orders.length === 0) return;

  // Apply to the oldest order with remaining capacity for this stage.
  let remaining = Number(kg);
  for (const o of orders) {
    if (remaining <= 0) break;
    const cap = Number(o.qty_kg ?? 0);
    const done = Number((o as any)[stage] ?? 0);
    const room = cap > 0 ? Math.max(cap - done, 0) : remaining;
    const add = cap > 0 ? Math.min(room, remaining) : remaining;
    if (add <= 0) continue;
    const newVal = done + add;
    const update: any = { [stage]: newVal };
    // Auto-advance status: any progress -> processing; coned fully -> completed.
    if (o.status === 'pending') update.status = 'processing';
    if (stage === 'coned_kg' && cap > 0 && newVal >= cap) update.status = 'completed';
    await supabase.from('orders').update(update).eq('id', o.id);
    remaining -= add;
    if (cap <= 0) break; // untracked-qty order absorbs once
  }
}
