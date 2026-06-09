// app/api/reports/[type]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: { type: string } }) {
  try {
    requireAdmin(req);
    const from      = req.nextUrl.searchParams.get('from') || '2000-01-01';
    const to        = req.nextUrl.searchParams.get('to')   || '2099-12-31';
    const client_id = req.nextUrl.searchParams.get('client_id');
    const { type }  = params;

    switch (type) {
      case 'production': {
        const [h, c] = await Promise.all([
          supabase.from('hanks_production')
            .select('date, weight_kg, status, total_earned, erp_users(name), clients(name), qualities(name)')
            .gte('date', from).lte('date', to).order('date', { ascending: false }),
          supabase.from('coning_production')
            .select('date, output_kg, status, erp_users(name)')
            .gte('date', from).lte('date', to).order('date', { ascending: false }),
        ]);
        if (h.error) throw h.error;
        if (c.error) throw c.error;
        return NextResponse.json([
          ...(h.data ?? []).map((r: any) => ({ type: 'Hanks', worker: r.erp_users?.name, client: r.clients?.name, quality: r.qualities?.name, date: r.date, kg: r.weight_kg, earned: r.total_earned, status: r.status })),
          ...(c.data ?? []).map((r: any) => ({ type: 'Coning', worker: r.erp_users?.name, client: null, quality: null, date: r.date, kg: r.output_kg, earned: null, status: r.status })),
        ].sort((a, b) => a.date > b.date ? -1 : 1));
      }

      case 'stock': {
        const [inward, ready] = await Promise.all([
          supabase.from('stock_inward').select('date, weight_kg, remaining_weight_kg, clients(name), qualities(name)').order('date', { ascending: false }),
          supabase.from('ready_stock').select('weight_kg, grade, status, shade_id').order('created_at', { ascending: false }),
        ]);
        if (inward.error) throw inward.error;
        if (ready.error) throw ready.error;
        return NextResponse.json({
          inward: (inward.data ?? []).map((r: any) => ({ client: r.clients?.name, quality: r.qualities?.name, date: r.date, received_kg: r.weight_kg, remaining_kg: r.remaining_weight_kg })),
          ready:  (ready.data ?? []).map((r: any) => ({ shade_id: r.shade_id, weight_kg: r.weight_kg, grade: r.grade, status: r.status })),
        });
      }

      case 'dispatch': {
        const { data, error } = await supabase
          .from('dispatches')
          .select('invoice_no, date, qty_kg, rate, amount, taxable_value, gst_rate, cgst_amount, sgst_amount, igst_amount, total_tax, grand_total, vehicle_no, lr_no, hsn_code, clients(name)')
          .gte('date', from).lte('date', to).order('date', { ascending: false });
        if (error) throw error;
        return NextResponse.json((data ?? []).map((r: any) => ({
          invoice:       r.invoice_no,
          date:          r.date,
          client:        r.clients?.name,
          qty_kg:        r.qty_kg,
          rate:          r.rate,
          taxable_value: r.taxable_value ?? r.amount,
          hsn_code:      r.hsn_code,
          gst_rate:      r.gst_rate,
          cgst:          r.cgst_amount ?? 0,
          sgst:          r.sgst_amount ?? 0,
          igst:          r.igst_amount ?? 0,
          total_tax:     r.total_tax ?? 0,
          grand_total:   r.grand_total ?? r.amount,
          vehicle:       r.vehicle_no,
          lr:            r.lr_no,
        })));
      }

      case 'finance': {
        const { data, error } = await supabase
          .from('client_transactions')
          .select('client_id, type, amount, clients(name)')
          .gte('date', from).lte('date', to);
        if (error) throw error;
        const map: Record<number, any> = {};
        for (const t of (data ?? [])) {
          const id = t.client_id;
          if (!map[id]) map[id] = { client: (t as any).clients?.name ?? `Client ${id}`, debit: 0, credit: 0, adjustment: 0 };
          if (t.type === 'debit') map[id].debit += Number(t.amount);
          else if (t.type === 'credit') map[id].credit += Number(t.amount);
          else map[id].adjustment += Number(t.amount);
        }
        return NextResponse.json(Object.values(map).map(r => ({
          ...r,
          debit:      Number(r.debit.toFixed(2)),
          credit:     Number(r.credit.toFixed(2)),
          adjustment: Number(r.adjustment.toFixed(2)),
          balance:    Number((r.debit - r.credit - r.adjustment).toFixed(2)),
        })));
      }

      case 'worker-performance': {
        const [prod, att] = await Promise.all([
          supabase.from('hanks_production')
            .select('worker_id, weight_kg, total_earned, erp_users(name)')
            .eq('status', 'approved').gte('date', from).lte('date', to),
          supabase.from('attendance')
            .select('worker_id, status').gte('date', from).lte('date', to),
        ]);
        if (prod.error) throw prod.error;
        if (att.error) throw att.error;
        const map: Record<number, any> = {};
        for (const p of (prod.data ?? [])) {
          const id = p.worker_id;
          if (!map[id]) map[id] = { worker: (p as any).erp_users?.name, entries: 0, kg: 0, earned: 0, present: 0, halfday: 0 };
          map[id].entries += 1; map[id].kg += Number(p.weight_kg); map[id].earned += Number(p.total_earned ?? 0);
        }
        for (const a of (att.data ?? [])) {
          const id = a.worker_id;
          if (!map[id]) map[id] = { worker: `Worker ${id}`, entries: 0, kg: 0, earned: 0, present: 0, halfday: 0 };
          if (a.status === 'present') map[id].present += 1;
          if (a.status === 'halfday') map[id].halfday += 1;
        }
        return NextResponse.json(Object.values(map));
      }

      case 'party-ledger': {
        if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 });
        const { data, error } = await supabase
          .from('client_transactions')
          .select('date, type, particulars, amount, clients(name)')
          .eq('client_id', Number(client_id))
          .gte('date', from).lte('date', to)
          .order('date', { ascending: true }).order('created_at', { ascending: true });
        if (error) throw error;
        let balance = 0;
        const rows = (data ?? []).map((t: any) => {
          balance += t.type === 'debit' ? Number(t.amount) : -Number(t.amount);
          return { date: t.date, particulars: t.particulars, type: t.type, amount: t.amount, balance };
        });
        return NextResponse.json({ client: (data?.[0] as any)?.clients?.name ?? null, rows });
      }

      case 'payroll': {
        const { data, error } = await supabase
          .from('payroll')
          .select('*, erp_users(name, department)')
          .order('year', { ascending: false })
          .order('month', { ascending: false });
        if (error) throw error;
        return NextResponse.json((data ?? []).map((r: any) => ({
          worker:           r.erp_users?.name,
          department:       r.erp_users?.department,
          month:            r.month,
          year:             r.year,
          hanks_kg:         r.hanks_kg,
          hanks_wage:       r.hanks_wage,
          coning_wage:      r.coning_wage,
          dyeing_wage:      r.dyeing_wage,
          attendance_wage:  r.attendance_wage,
          present_days:     r.present_days,
          bonus:            r.bonus,
          gross_wage:       r.gross_wage,
          advance_deduction:r.advance_deduction,
          loan_deduction:   r.loan_deduction,
          net_wage:         r.net_wage,
          status:           r.status,
          payment_mode:     r.payment_mode,
          payment_date:     r.payment_date,
        })));
      }

      default:
        return NextResponse.json({ error: 'Unknown report type' }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message.includes('required') ? 403 : 500 });
  }
}
