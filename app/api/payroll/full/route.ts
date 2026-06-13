import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireStrictAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    requireStrictAdmin(req);
    const month = req.nextUrl.searchParams.get('month');
    const year  = req.nextUrl.searchParams.get('year');
    if (!month || !year) return NextResponse.json({ error: 'month and year required' }, { status: 400 });

    const m   = String(month).padStart(2, '0');
    const start = `${year}-${m}-01`;
    const end   = new Date(Number(year), Number(month), 0).toISOString().split('T')[0];

    const [workers, hanks, coning, attendance, advances, loans, savedPayroll] = await Promise.all([
      supabase.from('erp_users').select('id, name, department, role, daily_rate, monthly_salary').neq('role', 'admin').order('name'),
      supabase.from('hanks_production').select('worker_id, weight_kg, total_earned').eq('status', 'approved').gte('date', start).lte('date', end),
      supabase.from('coning_production').select('worker_id, output_kg, qualities(coning_rate_per_kg)').eq('status', 'approved').gte('date', start).lte('date', end),
      supabase.from('attendance').select('worker_id, status').gte('date', start).lte('date', end),
      supabase.from('worker_advances').select('worker_id, amount').eq('status', 'approved').gte('created_at', `${start}T00:00:00`).lte('created_at', `${end}T23:59:59`),
      supabase.from('worker_loans').select('worker_id, hapta_amount').eq('status', 'active'),
      supabase.from('payroll').select('*').eq('month', Number(month)).eq('year', Number(year)),
    ]);

    for (const q of [workers, hanks, coning, attendance, advances, loans, savedPayroll]) {
      if (q.error) throw q.error;
    }

    const savedMap: Record<number, any> = {};
    for (const p of savedPayroll.data ?? []) savedMap[p.worker_id] = p;

    const rows = (workers.data ?? []).map(w => {
      const saved = savedMap[w.id];

      // Hanks wages
      const hanksEntries = (hanks.data ?? []).filter(h => h.worker_id === w.id);
      const hanks_kg     = hanksEntries.reduce((s, h) => s + Number(h.weight_kg), 0);
      const hanks_wage   = hanksEntries.reduce((s, h) => s + Number(h.total_earned ?? 0), 0);

      // Coning wages
      const coningEntries = (coning.data ?? []).filter(c => c.worker_id === w.id);
      const coning_kg     = coningEntries.reduce((s, c) => s + Number(c.output_kg ?? 0), 0);
      const coning_wage   = coningEntries.reduce((s, c) => {
        const rate = (c as any).qualities?.coning_rate_per_kg ?? 0;
        return s + Number(c.output_kg ?? 0) * Number(rate);
      }, 0);

      // Attendance wages
      const attRecords    = (attendance.data ?? []).filter(a => a.worker_id === w.id);
      const present_days  = attRecords.reduce((s, a) => s + (a.status === 'present' ? 1 : a.status === 'halfday' ? 0.5 : 0), 0);
      const daily_rate    = Number(w.daily_rate ?? 0);
      const attendance_wage = present_days * daily_rate;

      // Deductions
      const advance_deduction = (advances.data ?? []).filter(a => a.worker_id === w.id).reduce((s, a) => s + Number(a.amount), 0);
      const loan_deduction    = (loans.data ?? []).filter(l => l.worker_id === w.id).reduce((s, l) => s + Number(l.hapta_amount), 0);

      // Use saved overrides for dyeing_wage and bonus if payroll already saved
      const dyeing_wage = saved ? Number(saved.dyeing_wage ?? 0) : 0;
      const bonus       = saved ? Number(saved.bonus       ?? 0) : 0;

      // Salaried roles (dyeing master): fixed monthly salary, no piece-rate/attendance wage.
      const salaried     = w.role === 'dyeing_master';
      const salary       = salaried ? Number((w as any).monthly_salary ?? 0) : 0;
      const gross_wage   = salaried
        ? salary + bonus
        : hanks_wage + coning_wage + dyeing_wage + attendance_wage + bonus;
      const net_wage    = Math.max(0, gross_wage - advance_deduction - loan_deduction);

      return {
        worker_id: w.id,
        worker_name: w.name,
        department: w.department,
        role: w.role,
        // Computed
        hanks_kg:   Math.round(hanks_kg   * 100) / 100,
        hanks_wage: Math.round(hanks_wage  * 100) / 100,
        coning_kg:  Math.round(coning_kg   * 100) / 100,
        coning_wage:Math.round(coning_wage * 100) / 100,
        dyeing_wage:Math.round(dyeing_wage * 100) / 100,
        present_days, daily_rate,
        salaried, monthly_salary: salary,
        attendance_wage: Math.round(attendance_wage * 100) / 100,
        gross_wage: Math.round(gross_wage  * 100) / 100,
        advance_deduction: Math.round(advance_deduction * 100) / 100,
        loan_deduction:    Math.round(loan_deduction    * 100) / 100,
        bonus,
        net_wage: Math.round(net_wage * 100) / 100,
        // Saved state
        saved_id:      saved?.id         ?? null,
        status:        saved?.status      ?? 'pending',
        payment_mode:  saved?.payment_mode ?? null,
        payment_date:  saved?.payment_date ?? null,
        notes:         saved?.notes        ?? null,
      };
    }).filter(r => r.gross_wage > 0 || r.present_days > 0);

    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: /required|denied|token|unauthor/i.test(e.message) ? 403 : 500 });
  }
}

// Save/update payroll record for a worker-month
export async function POST(req: NextRequest) {
  try {
    requireStrictAdmin(req);
    const { worker_id, month, year, dyeing_wage, bonus, notes } = await req.json();
    if (!worker_id || !month || !year) return NextResponse.json({ error: 'worker_id, month, year required' }, { status: 400 });

    // Re-compute everything fresh
    const m     = String(month).padStart(2, '0');
    const start = `${year}-${m}-01`;
    const end   = new Date(Number(year), Number(month), 0).toISOString().split('T')[0];

    const [worker, hanks, coning, att, adv, loans] = await Promise.all([
      supabase.from('erp_users').select('daily_rate, monthly_salary, role').eq('id', worker_id).single(),
      supabase.from('hanks_production').select('weight_kg, total_earned').eq('worker_id', worker_id).eq('status', 'approved').gte('date', start).lte('date', end),
      supabase.from('coning_production').select('output_kg, qualities(coning_rate_per_kg)').eq('worker_id', worker_id).eq('status', 'approved').gte('date', start).lte('date', end),
      supabase.from('attendance').select('status').eq('worker_id', worker_id).gte('date', start).lte('date', end),
      supabase.from('worker_advances').select('amount').eq('worker_id', worker_id).eq('status', 'approved').gte('created_at', `${start}T00:00:00`).lte('created_at', `${end}T23:59:59`),
      supabase.from('worker_loans').select('hapta_amount').eq('worker_id', worker_id).eq('status', 'active'),
    ]);

    const hanks_kg     = (hanks.data ?? []).reduce((s, h) => s + Number(h.weight_kg), 0);
    const hanks_wage   = (hanks.data ?? []).reduce((s, h) => s + Number(h.total_earned ?? 0), 0);
    const coning_kg    = (coning.data ?? []).reduce((s, c) => s + Number(c.output_kg ?? 0), 0);
    const coning_wage  = (coning.data ?? []).reduce((s, c) => s + Number(c.output_kg ?? 0) * Number((c as any).qualities?.coning_rate_per_kg ?? 0), 0);
    const present_days = (att.data ?? []).reduce((s, a) => s + (a.status === 'present' ? 1 : a.status === 'halfday' ? 0.5 : 0), 0);
    const daily_rate   = Number(worker.data?.daily_rate ?? 0);
    const attendance_wage = present_days * daily_rate;
    const advance_deduction = (adv.data ?? []).reduce((s, a) => s + Number(a.amount), 0);
    const loan_deduction    = (loans.data ?? []).reduce((s, l) => s + Number(l.hapta_amount), 0);
    const dyeingW = Number(dyeing_wage ?? 0);
    const bonusV  = Number(bonus ?? 0);
    const salaried = worker.data?.role === 'dyeing_master';
    const salary   = salaried ? Number(worker.data?.monthly_salary ?? 0) : 0;
    const gross_wage = salaried ? salary + bonusV : hanks_wage + coning_wage + dyeingW + attendance_wage + bonusV;
    const net_wage   = Math.max(0, gross_wage - advance_deduction - loan_deduction);

    const row = {
      worker_id, month: Number(month), year: Number(year),
      hanks_kg, hanks_wage, coning_kg, coning_wage,
      dyeing_wage: dyeingW, present_days, daily_rate, attendance_wage,
      gross_wage, advance_deduction, loan_deduction, bonus: bonusV, net_wage,
    };
    if (notes !== undefined) (row as any).notes = notes;

    const { data, error } = await supabase.from('payroll')
      .upsert([row], { onConflict: 'worker_id,month,year' })
      .select().single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: /required|denied|token|unauthor/i.test(e.message) ? 403 : 400 });
  }
}
