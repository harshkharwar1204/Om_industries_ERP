import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

// Record extra grams of dye used on a batch (Module 4 "Add Correction").
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireAdmin(req);
    const { chemical_name, qty, note } = await req.json();
    const amount = Number(qty);
    if (!chemical_name || !amount) return NextResponse.json({ error: 'Chemical and qty required' }, { status: 400 });

    const { data: chem } = await supabase
      .from('chemicals').select('id, stock_qty').ilike('name', chemical_name).limit(1).maybeSingle();

    const { data, error } = await supabase.from('chemical_movements').insert([{
      chemical_id: chem?.id ?? null,
      dyeing_id:   Number(params.id),
      qty:         amount,
      type:        'correction',
      note:        note?.trim() || 'Extra dye correction',
    }]).select().single();
    if (error) throw error;

    if (chem) {
      await supabase.from('chemicals').update({ stock_qty: Number(chem.stock_qty) - amount }).eq('id', chem.id);
    }
    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
