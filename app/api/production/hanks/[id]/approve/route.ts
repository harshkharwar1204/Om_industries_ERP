import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireAdmin(req);

    // Fetch entry + quality rate
    const { data: entry, error: fetchErr } = await supabase
      .from('hanks_production')
      .select('*, qualities(hanks_rate_per_kg)')
      .eq('id', params.id)
      .single();

    if (fetchErr || !entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });

    const rate = entry.qualities?.hanks_rate_per_kg ?? 0;
    const total_earned = Number(entry.weight_kg) * Number(rate);

    const { data, error } = await supabase
      .from('hanks_production')
      .update({ status: 'approved', rate_per_kg: rate, total_earned, approved_at: new Date().toISOString() })
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
