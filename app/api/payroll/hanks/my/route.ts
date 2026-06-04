import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user  = requireAuth(req);
    const month = req.nextUrl.searchParams.get('month');
    const year  = req.nextUrl.searchParams.get('year');
    if (!month || !year) return NextResponse.json({ error: 'month and year required' }, { status: 400 });

    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const end   = new Date(Number(year), Number(month), 0).toISOString().split('T')[0];

    const [prodRes, advRes] = await Promise.all([
      supabase.from('hanks_production')
        .select('weight_kg, total_earned, status, date')
        .eq('worker_id', user.id)
        .gte('date', start).lte('date', end),
      supabase.from('worker_advances')
        .select('amount')
        .eq('worker_id', user.id).eq('status', 'approved')
        .gte('created_at', `${start}T00:00:00`).lte('created_at', `${end}T23:59:59`),
    ]);
    if (prodRes.error) throw prodRes.error;
    if (advRes.error) throw advRes.error;

    const approved       = (prodRes.data ?? []).filter(p => p.status === 'approved');
    const total_kg       = approved.reduce((s, p) => s + Number(p.weight_kg), 0);
    const gross_wages    = approved.reduce((s, p) => s + Number(p.total_earned ?? 0), 0);
    const total_advances = (advRes.data ?? []).reduce((s, a) => s + Number(a.amount), 0);

    return NextResponse.json({
      month: Number(month), year: Number(year),
      approved_entries: approved.length,
      total_entries: (prodRes.data ?? []).length,
      total_kg:       Number(total_kg.toFixed(2)),
      gross_wages:    Number(gross_wages.toFixed(2)),
      total_advances: Number(total_advances.toFixed(2)),
      net_wages:      Number(Math.max(0, gross_wages - total_advances).toFixed(2)),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message.includes('required') ? 403 : 401 });
  }
}
