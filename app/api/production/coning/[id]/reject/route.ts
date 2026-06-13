import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import { logAction } from '@/lib/audit';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = requireAdmin(req);

    const { data: entry, error: fErr } = await supabase
      .from('coning_production').select('id, status, cones_count, output_kg').eq('id', params.id).single();
    if (fErr || !entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    if (entry.status === 'rejected') return NextResponse.json(entry); // no-op
    // An approved coning already consumed dyed stock + created ready stock; cleanly
    // reversing that is non-trivial, so block it (use a correction downstream instead).
    if (entry.status === 'approved') {
      return NextResponse.json({ error: 'Cannot reject an approved coning entry; reverse the ready stock manually' }, { status: 409 });
    }

    const { data, error } = await supabase
      .from('coning_production').update({ status: 'rejected' }).eq('id', params.id).select().single();
    if (error) throw error;
    await logAction(actor, 'reject', 'coning_production', entry.id, 'Rejected coning entry', { cones: entry.cones_count, output_kg: entry.output_kg });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
