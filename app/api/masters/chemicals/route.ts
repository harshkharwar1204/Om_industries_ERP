import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth, requireAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    requireAuth(req);
    const { data, error } = await supabase.from('chemicals').select('*').order('name');
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message.includes('required') ? 403 : 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    requireAdmin(req);
    const { name, code, unit, stock_qty, low_threshold } = await req.json();
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });
    const { data, error } = await supabase.from('chemicals').insert([{
      name: name.trim(), code: code?.trim() || null, unit: unit || 'g',
      stock_qty: Number(stock_qty || 0), low_threshold: Number(low_threshold || 0),
    }]).select().single();
    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    requireAdmin(req);
    const { id, name, code, unit, stock_qty, low_threshold, add_qty } = await req.json();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const update: any = {};
    if (name != null) update.name = name.trim();
    if (code != null) update.code = code?.trim() || null;
    if (unit != null) update.unit = unit;
    if (low_threshold != null) update.low_threshold = Number(low_threshold);

    if (add_qty != null) {
      // Restock: increment + log a movement.
      const { data: cur } = await supabase.from('chemicals').select('stock_qty').eq('id', id).single();
      update.stock_qty = Number(cur?.stock_qty ?? 0) + Number(add_qty);
      await supabase.from('chemical_movements').insert([{ chemical_id: id, qty: Number(add_qty), type: 'in', note: 'Restock' }]);
    } else if (stock_qty != null) {
      update.stock_qty = Number(stock_qty);
    }

    const { data, error } = await supabase.from('chemicals').update(update).eq('id', id).select().single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
