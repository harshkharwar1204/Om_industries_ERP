import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = requireAuth(req);
    const month = req.nextUrl.searchParams.get('month');
    const year  = req.nextUrl.searchParams.get('year');

    let query = supabase
      .from('hanks_production')
      .select('*, clients(name), qualities(name)')
      .eq('worker_id', user.id)
      .order('date', { ascending: false });

    if (month && year) {
      const start = `${year}-${String(month).padStart(2, '0')}-01`;
      const end   = `${year}-${String(month).padStart(2, '0')}-31`;
      query = query.gte('date', start).lte('date', end);
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 401 });
  }
}
