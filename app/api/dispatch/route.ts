import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

const FACTORY_STATE = '24'; // Gujarat

function calcGst(taxableValue: number, gstRate: number, clientStateCode: string) {
  const tax = Math.round((taxableValue * gstRate / 100) * 100) / 100;
  const intraState = (clientStateCode || '24') === FACTORY_STATE;
  return intraState
    ? { cgst: tax / 2, sgst: tax / 2, igst: 0, total_tax: tax }
    : { cgst: 0, sgst: 0, igst: tax, total_tax: tax };
}

export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    const { data, error } = await supabase
      .from('dispatches')
      .select('*, clients(name, state_code, dealer_type, phone), orders(po_number), ready_stock(weight_kg, shade_id)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message.includes('required') ? 403 : 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    requireAdmin(req);
    const body = await req.json();
    const { client_id, order_id, stock_id, qty_kg, rate, vehicle_no, lr_no, date,
            hsn_code, gst_rate, tax_inclusive } = body;

    if (!client_id || !qty_kg || !rate) {
      return NextResponse.json({ error: 'Client, qty and rate required' }, { status: 400 });
    }

    // Validate dispatch quantity against available ready stock BEFORE creating the
    // invoice — otherwise a 20kg dispatch wiped the whole lot with no remaining_kg check.
    let stockRow: { id: number; remaining_kg: number } | null = null;
    if (stock_id) {
      const { data: rs } = await supabase
        .from('ready_stock').select('id, remaining_kg, status').eq('id', stock_id).maybeSingle();
      if (!rs) return NextResponse.json({ error: 'Ready stock lot not found' }, { status: 404 });
      if (rs.status === 'dispatched') return NextResponse.json({ error: 'Lot already fully dispatched' }, { status: 409 });
      if (Number(qty_kg) > Number(rs.remaining_kg) + 0.001) {
        return NextResponse.json({ error: `Only ${rs.remaining_kg} kg available in this lot` }, { status: 400 });
      }
      stockRow = { id: rs.id, remaining_kg: Number(rs.remaining_kg) };
    }

    // Get client state for GST calc
    const { data: client } = await supabase.from('clients').select('state_code, dealer_type').eq('id', client_id).single();

    // Auto-generate invoice number
    const { count } = await supabase.from('dispatches').select('*', { count: 'exact', head: true });
    const invoiceNo = `INV-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(4, '0')}`;

    const qtyNum  = Number(qty_kg);
    const rateNum = Number(rate);
    const baseAmount = qtyNum * rateNum;
    const gstRateNum = Number(gst_rate) || 0;
    const isUnregistered = client?.dealer_type === 'unregistered';

    let taxableValue: number, cgst: number, sgst: number, igst: number, total_tax: number, grand_total: number;

    if (!gstRateNum || isUnregistered) {
      // No GST
      taxableValue = baseAmount;
      cgst = 0; sgst = 0; igst = 0; total_tax = 0;
      grand_total = baseAmount;
    } else if (tax_inclusive) {
      // Back-calculate taxable from gross
      taxableValue = Math.round((baseAmount / (1 + gstRateNum / 100)) * 100) / 100;
      const gstAmounts = calcGst(taxableValue, gstRateNum, client?.state_code || '24');
      cgst = gstAmounts.cgst; sgst = gstAmounts.sgst; igst = gstAmounts.igst; total_tax = gstAmounts.total_tax;
      grand_total = baseAmount; // amount already includes tax
    } else {
      taxableValue = baseAmount;
      const gstAmounts = calcGst(taxableValue, gstRateNum, client?.state_code || '24');
      cgst = gstAmounts.cgst; sgst = gstAmounts.sgst; igst = gstAmounts.igst; total_tax = gstAmounts.total_tax;
      grand_total = taxableValue + total_tax;
    }

    const { data, error } = await supabase
      .from('dispatches')
      .insert([{
        invoice_no:    invoiceNo,
        client_id:     Number(client_id),
        order_id:      order_id ? Number(order_id) : null,
        stock_id:      stock_id ? Number(stock_id) : null,
        qty_kg:        qtyNum,
        rate:          rateNum,
        amount:        baseAmount,          // base taxable (pre-tax or gross if inclusive)
        vehicle_no:    vehicle_no?.trim()  || null,
        lr_no:         lr_no?.trim()       || null,
        date:          date || new Date().toISOString().split('T')[0],
        hsn_code:      hsn_code?.trim()    || null,
        gst_rate:      gstRateNum          || null,
        tax_inclusive: tax_inclusive        ?? false,
        taxable_value: taxableValue,
        cgst_amount:   cgst,
        sgst_amount:   sgst,
        igst_amount:   igst,
        total_tax,
        grand_total,
      }])
      .select()
      .single();

    if (error) throw error;

    // Decrement the lot; only flag fully dispatched when nothing remains (partial dispatch supported).
    if (stockRow) {
      const left = Math.max(0, stockRow.remaining_kg - qtyNum);
      await supabase.from('ready_stock')
        .update({ remaining_kg: left, status: left <= 0.001 ? 'dispatched' : 'available' })
        .eq('id', stockRow.id);
    }

    // Create client finance debit entry (grand_total = what client owes)
    await supabase.from('client_transactions').insert([{
      client_id:    Number(client_id),
      date:         date || new Date().toISOString().split('T')[0],
      type:         'debit',
      particulars:  `Invoice ${invoiceNo}`,
      amount:       grand_total,
      reference_id: data.id,
    }]);

    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
