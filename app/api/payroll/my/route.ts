import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { monthRange } from '@/lib/dates';

export async function GET(req: NextRequest) {
  try {
    const user  = requireAuth(req);
    const month = req.nextUrl.searchParams.get('month');
    const year  = req.nextUrl.searchParams.get('year');
    if (!month || !year) return NextResponse.json({ error: 'month and year required' }, { status: 400 });

    // Check for a saved payroll record first (admin-generated + saved)
    const { data: saved } = await supabase
      .from('payroll')
      .select('*')
      .eq('worker_id', user.id)
      .eq('month', Number(month))
      .eq('year', Number(year))
      .maybeSingle();

    if (saved) {
      return NextResponse.json({
        source: 'saved',
        month: Number(month), year: Number(year),
        hanks_kg: saved.hanks_kg, hanks_wage: saved.hanks_wage,
        coning_kg: saved.coning_kg, coning_wage: saved.coning_wage,
        dyeing_wage: saved.dyeing_wage,
        present_days: saved.present_days, daily_rate: saved.daily_rate, attendance_wage: saved.attendance_wage,
        gross_wage: saved.gross_wage,
        advance_deduction: saved.advance_deduction,
        loan_deduction: saved.loan_deduction,
        bonus: saved.bonus,
        net_wage: saved.net_wage,
        status: saved.status,
        payment_mode: saved.payment_mode,
        payment_date: saved.payment_date,
      });
    }

    // Fallback: compute from raw data (not yet saved by admin)
    const m     = String(month).padStart(2, '0');
    const start = `${year}-${m}-01`;
    const end   = monthRange(month!, year!).end;

    const [workerRes, hanks, coning, att, adv, loans] = await Promise.all([
      supabase.from('erp_users').select('daily_rate').eq('id', user.id).single(),
      supabase.from('hanks_production').select('weight_kg, total_earned').eq('worker_id', user.id).eq('status', 'approved').gte('date', start).lte('date', end),
      supabase.from('coning_production').select('output_kg, qualities(coning_rate_per_kg)').eq('worker_id', user.id).eq('status', 'approved').gte('date', start).lte('date', end),
      supabase.from('attendance').select('status').eq('worker_id', user.id).gte('date', start).lte('date', end),
      supabase.from('worker_advances').select('amount').eq('worker_id', user.id).eq('status', 'approved').gte('created_at', `${start}T00:00:00`).lte('created_at', `${end}T23:59:59`),
      supabase.from('worker_loans').select('hapta_amount').eq('worker_id', user.id).eq('status', 'active'),
    ]);

    const hanks_kg    = (hanks.data ?? []).reduce((s, h) => s + Number(h.weight_kg), 0);
    const hanks_wage  = (hanks.data ?? []).reduce((s, h) => s + Number(h.total_earned ?? 0), 0);
    const coning_kg   = (coning.data ?? []).reduce((s, c) => s + Number(c.output_kg ?? 0), 0);
    const coning_wage = (coning.data ?? []).reduce((s, c) => s + Number(c.output_kg ?? 0) * Number((c as any).qualities?.coning_rate_per_kg ?? 0), 0);
    const present_days = (att.data ?? []).reduce((s, a) => s + (a.status === 'present' ? 1 : a.status === 'halfday' ? 0.5 : 0), 0);
    const daily_rate   = Number(workerRes.data?.daily_rate ?? 0);
    const attendance_wage = present_days * daily_rate;
    const advance_deduction = (adv.data ?? []).reduce((s, a) => s + Number(a.amount), 0);
    const loan_deduction    = (loans.data ?? []).reduce((s, l) => s + Number(l.hapta_amount), 0);
    const gross_wage = hanks_wage + coning_wage + attendance_wage;
    const net_wage   = Math.max(0, gross_wage - advance_deduction - loan_deduction);

    return NextResponse.json({
      source: 'computed',
      month: Number(month), year: Number(year),
      hanks_kg: Math.round(hanks_kg * 100) / 100, hanks_wage: Math.round(hanks_wage * 100) / 100,
      coning_kg: Math.round(coning_kg * 100) / 100, coning_wage: Math.round(coning_wage * 100) / 100,
      dyeing_wage: 0, present_days, daily_rate, attendance_wage: Math.round(attendance_wage * 100) / 100,
      gross_wage: Math.round(gross_wage * 100) / 100,
      advance_deduction: Math.round(advance_deduction * 100) / 100,
      loan_deduction: Math.round(loan_deduction * 100) / 100,
      bonus: 0,
      net_wage: Math.round(net_wage * 100) / 100,
      status: 'pending', payment_mode: null, payment_date: null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message.includes('required') ? 403 : 401 });
  }
}
