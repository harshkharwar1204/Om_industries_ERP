import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireAdmin(req);
    const { status, payment_mode, payment_date, notes, dyeing_wage, bonus } = await req.json();

    const update: any = {};
    if (status       !== undefined) update.status       = status;
    if (payment_mode !== undefined) update.payment_mode = payment_mode;
    if (payment_date !== undefined) update.payment_date = payment_date;
    if (notes        !== undefined) update.notes        = notes;
    if (dyeing_wage  !== undefined) update.dyeing_wage  = Number(dyeing_wage);
    if (bonus        !== undefined) update.bonus        = Number(bonus);

    // If marking paid, record today as payment date if not provided
    if (status === 'paid' && !update.payment_date) {
      update.payment_date = new Date().toISOString().split('T')[0];
    }

    const { data, error } = await supabase.from('payroll').update(update).eq('id', params.id).select().single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
