import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { rupeesInWords } from '@/lib/numToWords';

// Admin + Dyeing Master can create challans.
export async function GET(req: NextRequest) {
  try {
    requireAuth(req);
    const { data, error } = await supabase
      .from('challans')
      .select('*, clients(name)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message.includes('required') ? 403 : 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    requireAuth(req);
    const { client_id, date, notes, items } = await req.json();
    if (!client_id) return NextResponse.json({ error: 'Client required' }, { status: 400 });
    if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ error: 'At least one item required' }, { status: 400 });

    // Auto-increment challan number: DC-YYYY-NNN
    const year = new Date().getFullYear();
    const { count } = await supabase
      .from('challans').select('id', { count: 'exact', head: true })
      .gte('date', `${year}-01-01`);
    const challan_no = `DC-${year}-${String((count ?? 0) + 1).padStart(3, '0')}`;

    // Compute line + totals
    const lines = items.map((it: any) => {
      const net = it.net_kg != null ? Number(it.net_kg) : (Number(it.gross_kg || 0) - Number(it.tare_kg || 0));
      const amount = Math.round(net * Number(it.rate || 0) * 100) / 100;
      return {
        ready_stock_id: it.ready_stock_id ? Number(it.ready_stock_id) : null,
        item_name: it.item_name || null,
        color: it.color || null,
        cones: it.cones ? Number(it.cones) : null,
        gross_kg: Number(it.gross_kg || 0),
        tare_kg: Number(it.tare_kg || 0),
        net_kg: Math.round(net * 100) / 100,
        rate: Number(it.rate || 0),
        amount,
      };
    });

    const total_net_kg = Math.round(lines.reduce((s, l) => s + l.net_kg, 0) * 100) / 100;
    const total_amount = Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
    const grand_total = Math.round(total_amount);
    const rounded_off = Math.round((grand_total - total_amount) * 100) / 100;

    const { data: challan, error: cErr } = await supabase
      .from('challans')
      .insert([{
        challan_no, client_id: Number(client_id),
        date: date || new Date().toISOString().split('T')[0],
        total_net_kg, total_amount, rounded_off, grand_total,
        amount_in_words: rupeesInWords(grand_total),
        notes: notes?.trim() || null,
      }])
      .select().single();
    if (cErr) throw cErr;

    // Insert items + mark/consume the ready_stock rows
    for (const l of lines) {
      await supabase.from('challan_items').insert([{ ...l, challan_id: challan.id }]);
      if (l.ready_stock_id) {
        await supabase.from('ready_stock').update({ status: 'dispatched' }).eq('id', l.ready_stock_id);
      }
    }

    return NextResponse.json(challan, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
