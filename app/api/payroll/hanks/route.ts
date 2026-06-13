import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireStrictAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    requireStrictAdmin(req);
    const month = req.nextUrl.searchParams.get('month');
    const year  = req.nextUrl.searchParams.get('year');
    if (!month || !year) return NextResponse.json({ error: 'month and year required' }, { status: 400 });

    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const end   = new Date(Number(year), Number(month), 0).toISOString().split('T')[0];

    // Approved production
    const { data: production, error: pErr } = await supabase
      .from('hanks_production')
      .select('worker_id, weight_kg, total_earned, erp_users(name, department)')
      .eq('status', 'approved')
      .gte('date', start)
      .lte('date', end);
    if (pErr) throw pErr;

    // Approved advances
    const { data: advances, error: aErr } = await supabase
      .from('worker_advances')
      .select('worker_id, amount')
      .eq('status', 'approved')
      .gte('created_at', `${start}T00:00:00`)
      .lte('created_at', `${end}T23:59:59`);
    if (aErr) throw aErr;

    // Aggregate by worker
    const workerMap: Record<number, any> = {};

    for (const p of (production ?? [])) {
      const wid = p.worker_id;
      if (!workerMap[wid]) {
        workerMap[wid] = {
          worker_id: wid,
          worker_name: (p as any).erp_users?.name ?? `Worker ${wid}`,
          department: (p as any).erp_users?.department ?? null,
          approved_entries: 0,
          total_kg: 0,
          gross_wages: 0,
          total_advances: 0,
          net_wages: 0,
        };
      }
      workerMap[wid].approved_entries += 1;
      workerMap[wid].total_kg         += Number(p.weight_kg);
      workerMap[wid].gross_wages      += Number(p.total_earned ?? 0);
    }

    for (const a of (advances ?? [])) {
      if (workerMap[a.worker_id]) {
        workerMap[a.worker_id].total_advances += Number(a.amount);
      }
    }

    const rows = Object.values(workerMap).map(r => ({
      ...r,
      total_kg:    Number(r.total_kg.toFixed(2)),
      gross_wages: Number(r.gross_wages.toFixed(2)),
      net_wages:   Number(Math.max(0, r.gross_wages - r.total_advances).toFixed(2)),
    }));

    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
