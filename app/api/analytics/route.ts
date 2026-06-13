import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireStrictAdmin } from '@/lib/auth';

const DAY = 86400000;
const ageDays = (d: string | null) => d ? Math.floor((Date.now() - new Date(d).getTime()) / DAY) : 0;

function agingBuckets(rows: { remaining_kg: number; when: string | null }[]) {
  const b = { fresh_0_7: 0, days_8_30: 0, days_31_60: 0, over_60: 0 };
  for (const r of rows) {
    const kg = Number(r.remaining_kg) || 0;
    const a = ageDays(r.when);
    if (a <= 7) b.fresh_0_7 += kg;
    else if (a <= 30) b.days_8_30 += kg;
    else if (a <= 60) b.days_31_60 += kg;
    else b.over_60 += kg;
  }
  for (const k of Object.keys(b) as (keyof typeof b)[]) b[k] = Math.round(b[k] * 10) / 10;
  return b;
}

export async function GET(req: NextRequest) {
  try {
    requireStrictAdmin(req);

    // last 6 calendar months window
    const now = new Date();
    const windowStart = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split('T')[0];

    const [orders, clientsRes, grey, dyed, ready, txns, hanks, coning, dispatches] = await Promise.all([
      supabase.from('orders').select('id, qty_kg, rate, coned_kg, status, clients(name), qualities(name)').in('status', ['pending', 'processing', 'completed']),
      supabase.from('clients').select('id, name'),
      supabase.from('grey_stock').select('remaining_kg, date').gt('remaining_kg', 0),
      supabase.from('dyed_stock').select('remaining_kg, date').gt('remaining_kg', 0),
      supabase.from('ready_stock').select('remaining_kg, weight_kg, created_at').eq('status', 'available'),
      supabase.from('client_transactions').select('client_id, type, amount, date'),
      supabase.from('hanks_production').select('weight_kg, date').eq('status', 'approved').gte('date', windowStart),
      supabase.from('coning_production').select('output_kg, date').eq('status', 'approved').gte('date', windowStart),
      supabase.from('dispatches').select('grand_total, date').gte('date', windowStart),
    ]);
    for (const q of [orders, clientsRes, grey, dyed, ready, txns, hanks, coning, dispatches]) {
      if (q.error) throw q.error;
    }

    // ── Order economics (revenue + fulfillment; not true profit — no per-unit cost captured) ──
    const orderEconomics = (orders.data ?? []).map((o: any) => {
      const qty = Number(o.qty_kg) || 0;
      const rate = Number(o.rate) || 0;
      const value = qty * rate;
      const coned = Number(o.coned_kg) || 0;
      return {
        id: o.id,
        client: o.clients?.name ?? '—',
        quality: o.qualities?.name ?? '—',
        qty_kg: qty, rate, order_value: Math.round(value),
        coned_kg: coned,
        fulfilled_pct: qty > 0 ? Math.min(100, Math.round((coned / qty) * 100)) : 0,
        status: o.status,
      };
    }).sort((a, b) => b.order_value - a.order_value);

    // ── Stock aging ──
    const stockAging = {
      grey:  agingBuckets((grey.data ?? []).map((r: any) => ({ remaining_kg: r.remaining_kg, when: r.date }))),
      dyed:  agingBuckets((dyed.data ?? []).map((r: any) => ({ remaining_kg: r.remaining_kg, when: r.date }))),
      ready: agingBuckets((ready.data ?? []).map((r: any) => ({ remaining_kg: r.remaining_kg ?? r.weight_kg, when: r.created_at }))),
    };

    // ── Outstanding (receivables) aging by client ──
    const nameById: Record<number, string> = {};
    for (const c of clientsRes.data ?? []) nameById[c.id] = c.name;
    const agg: Record<number, { balance: number; oldestDebit: string | null }> = {};
    for (const t of txns.data ?? []) {
      const id = t.client_id;
      if (!agg[id]) agg[id] = { balance: 0, oldestDebit: null };
      const amt = Number(t.amount) || 0;
      agg[id].balance += t.type === 'debit' ? amt : -amt;
      if (t.type === 'debit' && (!agg[id].oldestDebit || t.date < agg[id].oldestDebit!)) agg[id].oldestDebit = t.date;
    }
    const outstanding = Object.entries(agg)
      .map(([id, v]) => ({ client: nameById[Number(id)] ?? `#${id}`, balance: Math.round(v.balance), oldest_days: v.balance > 0 ? ageDays(v.oldestDebit) : 0 }))
      .filter(o => o.balance > 0)
      .sort((a, b) => b.balance - a.balance);
    const totalOutstanding = outstanding.reduce((s, o) => s + o.balance, 0);

    // ── 6-month trends ──
    const monthKey = (d: string) => d.slice(0, 7); // YYYY-MM
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`);
    }
    const trendMap: Record<string, { hanks_kg: number; coned_kg: number; revenue: number }> = {};
    for (const m of months) trendMap[m] = { hanks_kg: 0, coned_kg: 0, revenue: 0 };
    for (const h of hanks.data ?? []) { const m = monthKey(h.date); if (trendMap[m]) trendMap[m].hanks_kg += Number(h.weight_kg) || 0; }
    for (const c of coning.data ?? []) { const m = monthKey(c.date); if (trendMap[m]) trendMap[m].coned_kg += Number(c.output_kg) || 0; }
    for (const d of dispatches.data ?? []) { const m = monthKey(d.date); if (trendMap[m]) trendMap[m].revenue += Number(d.grand_total) || 0; }
    const trends = months.map(m => ({
      month: m,
      hanks_kg: Math.round(trendMap[m].hanks_kg),
      coned_kg: Math.round(trendMap[m].coned_kg),
      revenue: Math.round(trendMap[m].revenue),
    }));

    return NextResponse.json({ orderEconomics, stockAging, outstanding, totalOutstanding, trends });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: /required|denied|token|unauthor/i.test(e.message) ? 403 : 500 });
  }
}
