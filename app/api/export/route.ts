import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

const HEADER_FILL = 'FF475569';
const ALT_FILL = 'FFF1F5F9';

export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    const month = Number(req.nextUrl.searchParams.get('month'));
    const year  = Number(req.nextUrl.searchParams.get('year'));
    if (!month || !year) return NextResponse.json({ error: 'month and year required' }, { status: 400 });

    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const end   = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
    const inMonth = (q: any) => q.gte('date', start).lte('date', end);

    const [challans, hanks, dyeing, coning, advances] = await Promise.all([
      inMonth(supabase.from('challans').select('challan_no, date, total_net_kg, total_amount, grand_total, clients(name)')).order('date'),
      inMonth(supabase.from('hanks_production').select('date, weight_kg, rate_per_kg, total_earned, status, erp_users(name), clients(name), qualities(name)')).order('date'),
      inMonth(supabase.from('dyeing_production').select('date, batch_no, input_kg, output_kg, loss_pct, status, clients(name), qualities(name), shades(name)')).order('date'),
      inMonth(supabase.from('coning_production').select('date, output_kg, cones_count, rate_per_kg, total_earned, status, erp_users(name), clients(name), qualities(name)')).order('date'),
      supabase.from('worker_advances').select('amount, status, note, created_at, erp_users(name)').gte('created_at', `${start}T00:00:00`).lte('created_at', `${end}T23:59:59`),
    ]);

    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = 'OM INDUSTRIES ERP';

    const styleSheet = (ws: any, totalCols: number) => {
      ws.getRow(1).eachCell((cell: any) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });
      ws.eachRow((row: any, n: number) => {
        if (n > 1 && n % 2 === 0) row.eachCell((c: any) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ALT_FILL } }; });
        if (n > 1) row.eachCell((c: any) => { c.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } }; });
      });
    };
    const money = '#,##0.00';

    // 1. Summary
    const sum = wb.addWorksheet('Summary');
    sum.columns = [{ header: 'Metric', key: 'm', width: 32 }, { header: 'Value', key: 'v', width: 20 }];
    const hk = hanks.data ?? [], dy = dyeing.data ?? [], cn = coning.data ?? [], ch = challans.data ?? [], adv = advances.data ?? [];
    sum.addRow({ m: `Report Month`, v: `${month}/${year}` });
    sum.addRow({ m: 'Hanks Production (kg)', v: hk.reduce((s, r: any) => s + Number(r.weight_kg || 0), 0) });
    sum.addRow({ m: 'Dyeing Output (kg)', v: dy.reduce((s, r: any) => s + Number(r.output_kg || 0), 0) });
    sum.addRow({ m: 'Coning Output (kg)', v: cn.reduce((s, r: any) => s + Number(r.output_kg || 0), 0) });
    sum.addRow({ m: 'Delivery Challans', v: ch.length });
    sum.addRow({ m: 'Challan Amount (₹)', v: ch.reduce((s, r: any) => s + Number(r.grand_total || 0), 0) });
    sum.addRow({ m: 'Advances (₹)', v: adv.reduce((s, r: any) => s + Number(r.amount || 0), 0) });
    styleSheet(sum, 2);

    // 2. Delivery Challans
    const wsc = wb.addWorksheet('Delivery Challans');
    wsc.columns = [
      { header: 'Challan No', key: 'no', width: 16 }, { header: 'Date', key: 'd', width: 12 },
      { header: 'Client', key: 'c', width: 24 }, { header: 'Net Wt (kg)', key: 'nt', width: 14, style: { numFmt: money } },
      { header: 'Amount', key: 'amt', width: 14, style: { numFmt: money } }, { header: 'Grand Total', key: 'gt', width: 14, style: { numFmt: money } },
    ];
    ch.forEach((r: any) => wsc.addRow({ no: r.challan_no, d: r.date, c: r.clients?.name, nt: Number(r.total_net_kg), amt: Number(r.total_amount), gt: Number(r.grand_total) }));
    if (ch.length) { const r = wsc.addRow({ no: 'TOTAL' }); r.getCell('nt').value = { formula: `SUM(D2:D${ch.length + 1})` }; r.getCell('gt').value = { formula: `SUM(F2:F${ch.length + 1})` }; r.font = { bold: true }; }
    styleSheet(wsc, 6);

    // 3. Unit 2 Production (Hanks)
    const wsh = wb.addWorksheet('Unit 2 Production');
    wsh.columns = [
      { header: 'Date', key: 'd', width: 12 }, { header: 'Worker', key: 'w', width: 20 }, { header: 'Client', key: 'c', width: 20 },
      { header: 'Quality', key: 'q', width: 14 }, { header: 'Weight (kg)', key: 'kg', width: 12, style: { numFmt: money } },
      { header: 'Rate', key: 'rt', width: 10, style: { numFmt: money } }, { header: 'Earned', key: 'e', width: 14, style: { numFmt: money } }, { header: 'Status', key: 's', width: 12 },
    ];
    hk.forEach((r: any) => wsh.addRow({ d: r.date, w: r.erp_users?.name, c: r.clients?.name, q: r.qualities?.name, kg: Number(r.weight_kg), rt: Number(r.rate_per_kg || 0), e: Number(r.total_earned || 0), s: r.status }));
    if (hk.length) { const r = wsh.addRow({ d: 'TOTAL' }); r.getCell('kg').value = { formula: `SUM(E2:E${hk.length + 1})` }; r.getCell('e').value = { formula: `SUM(G2:G${hk.length + 1})` }; r.font = { bold: true }; }
    styleSheet(wsh, 8);

    // 4. Unit 1 Dyeing
    const wsd = wb.addWorksheet('Unit 1 Dyeing');
    wsd.columns = [
      { header: 'Date', key: 'd', width: 12 }, { header: 'Batch', key: 'b', width: 14 }, { header: 'Client', key: 'c', width: 20 },
      { header: 'Quality', key: 'q', width: 14 }, { header: 'Shade', key: 'sh', width: 14 },
      { header: 'Input (kg)', key: 'in', width: 12, style: { numFmt: money } }, { header: 'Output (kg)', key: 'out', width: 12, style: { numFmt: money } },
      { header: 'Loss %', key: 'l', width: 10 }, { header: 'Status', key: 's', width: 12 },
    ];
    dy.forEach((r: any) => wsd.addRow({ d: r.date, b: r.batch_no, c: r.clients?.name, q: r.qualities?.name, sh: r.shades?.name, in: Number(r.input_kg || 0), out: Number(r.output_kg || 0), l: Number(r.loss_pct || 0), s: r.status }));
    styleSheet(wsd, 9);

    // 5. Coning Logs
    const wsco = wb.addWorksheet('Coning Logs');
    wsco.columns = [
      { header: 'Date', key: 'd', width: 12 }, { header: 'Worker', key: 'w', width: 20 }, { header: 'Client', key: 'c', width: 20 },
      { header: 'Quality', key: 'q', width: 14 }, { header: 'Cones', key: 'cn', width: 10 }, { header: 'Output (kg)', key: 'kg', width: 12, style: { numFmt: money } },
      { header: 'Rate', key: 'rt', width: 10, style: { numFmt: money } }, { header: 'Earned', key: 'e', width: 14, style: { numFmt: money } }, { header: 'Status', key: 's', width: 12 },
    ];
    cn.forEach((r: any) => wsco.addRow({ d: r.date, w: r.erp_users?.name, c: r.clients?.name, q: r.qualities?.name, cn: r.cones_count, kg: Number(r.output_kg || 0), rt: Number(r.rate_per_kg || 0), e: Number(r.total_earned || 0), s: r.status }));
    if (cn.length) { const r = wsco.addRow({ d: 'TOTAL' }); r.getCell('kg').value = { formula: `SUM(F2:F${cn.length + 1})` }; r.getCell('e').value = { formula: `SUM(H2:H${cn.length + 1})` }; r.font = { bold: true }; }
    styleSheet(wsco, 9);

    // 6. Advances / Payroll
    const wsa = wb.addWorksheet('Advances & Payroll');
    wsa.columns = [
      { header: 'Worker', key: 'w', width: 22 }, { header: 'Amount (₹)', key: 'a', width: 14, style: { numFmt: money } },
      { header: 'Status', key: 's', width: 14 }, { header: 'Note', key: 'n', width: 30 },
    ];
    adv.forEach((r: any) => wsa.addRow({ w: r.erp_users?.name, a: Number(r.amount || 0), s: r.status, n: r.note }));
    if (adv.length) { const r = wsa.addRow({ w: 'TOTAL' }); r.getCell('a').value = { formula: `SUM(B2:B${adv.length + 1})` }; r.font = { bold: true }; }
    styleSheet(wsa, 4);

    const buffer = await wb.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="OM-Industries-${year}-${String(month).padStart(2, '0')}.xlsx"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
