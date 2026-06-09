import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth, requireAdmin } from '@/lib/auth';

// GET all settings as a key->value map (any authed user; used by challan header).
export async function GET(req: NextRequest) {
  try {
    requireAuth(req);
    const { data, error } = await supabase.from('app_settings').select('key, value');
    if (error) throw error;
    const map: Record<string, string> = {};
    (data ?? []).forEach((r: any) => { map[r.key] = r.value; });
    return NextResponse.json(map);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message.includes('required') ? 403 : 500 });
  }
}

// PUT { key: value, ... } — upsert settings (admin only).
export async function PUT(req: NextRequest) {
  try {
    requireAdmin(req);
    const body = await req.json();
    const rows = Object.entries(body).map(([key, value]) => ({ key, value: String(value ?? ''), updated_at: new Date().toISOString() }));
    const { error } = await supabase.from('app_settings').upsert(rows, { onConflict: 'key' });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
