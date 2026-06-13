import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireStrictAdmin, requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    requireAuth(req);
    const date       = req.nextUrl.searchParams.get('date');
    const worker_id  = req.nextUrl.searchParams.get('worker_id');
    const month      = req.nextUrl.searchParams.get('month');
    const year       = req.nextUrl.searchParams.get('year');

    let query = supabase
      .from('attendance')
      .select('*, erp_users(name, department, role)')
      .order('date', { ascending: false });

    if (date)      query = query.eq('date', date);
    if (worker_id) query = query.eq('worker_id', worker_id);
    if (month && year) {
      const start = `${year}-${String(month).padStart(2, '0')}-01`;
      const end   = new Date(Number(year), Number(month), 0).toISOString().split('T')[0];
      query = query.gte('date', start).lte('date', end);
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message.includes('required') ? 403 : 500 });
  }
}

// Bulk upsert attendance for a date
export async function POST(req: NextRequest) {
  try {
    requireStrictAdmin(req);
    const { date, records } = await req.json();
    // records: [{ worker_id, status }]
    if (!date || !Array.isArray(records)) {
      return NextResponse.json({ error: 'date and records required' }, { status: 400 });
    }

    const rows = records.map((r: { worker_id: number; status: string }) => ({
      worker_id: r.worker_id,
      date,
      status: r.status,
    }));

    const { data, error } = await supabase
      .from('attendance')
      .upsert(rows, { onConflict: 'worker_id,date' })
      .select();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
