// app/api/loans/[id]/hapta/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireAdmin(req);
    const { amount, date, remarks } = await req.json();
    const loanId = Number(params.id);
    if (!amount || Number(amount) <= 0) return NextResponse.json({ error: 'Valid amount required' }, { status: 400 });

    const { data: loan, error: lErr } = await supabase
      .from('worker_loans').select('*').eq('id', loanId).single();
    if (lErr || !loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

    const repayment    = Math.min(Number(amount), Number(loan.outstanding));
    const newTotalPaid = Number(loan.total_paid) + repayment;
    const newOutstanding = Math.max(0, Number(loan.loan_amount) - newTotalPaid);

    await supabase.from('loan_repayments').insert([{
      loan_id: loanId, worker_id: loan.worker_id,
      amount: repayment,
      date: date || new Date().toISOString().split('T')[0],
      remarks: remarks?.trim() || null,
    }]);

    const { data, error } = await supabase
      .from('worker_loans')
      .update({ total_paid: newTotalPaid, outstanding: newOutstanding, status: newOutstanding <= 0 ? 'closed' : 'active' })
      .eq('id', loanId).select().single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message.includes('required') ? 403 : 400 });
  }
}
