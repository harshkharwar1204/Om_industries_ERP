import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    const month = req.nextUrl.searchParams.get('month');
    const year  = req.nextUrl.searchParams.get('year');
    if (!month || !year) return NextResponse.json({ error: 'month and year required' }, { status: 400 });

    // Fetch payroll data from own route
    const base = req.nextUrl.origin;
    const token = req.headers.get('authorization');
    const payrollRes = await fetch(`${base}/api/payroll/hanks?month=${month}&year=${year}`, {
      headers: { Authorization: token! },
    });
    const rows = await payrollRes.json();
    if (!Array.isArray(rows)) return NextResponse.json({ error: 'Failed to generate payroll' }, { status: 500 });

    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(`Payroll ${month}-${year}`);

    ws.columns = [
      { header: 'Worker Name', key: 'worker_name', width: 22 },
      { header: 'Department',  key: 'department',   width: 14 },
      { header: 'Entries',     key: 'approved_entries', width: 10 },
      { header: 'Total KG',    key: 'total_kg',     width: 12 },
      { header: 'Gross (₹)',   key: 'gross_wages',  width: 14 },
      { header: 'Advances (₹)',key: 'total_advances',width: 14 },
      { header: 'Net (₹)',     key: 'net_wages',    width: 14 },
    ];

    // Header style
    ws.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } };
      cell.alignment = { horizontal: 'center' };
    });

    rows.forEach((r: any) => ws.addRow(r));

    // Totals row
    ws.addRow({
      worker_name: 'TOTAL',
      department: '',
      approved_entries: rows.reduce((s: number, r: any) => s + r.approved_entries, 0),
      total_kg:    rows.reduce((s: number, r: any) => s + r.total_kg, 0).toFixed(2),
      gross_wages: rows.reduce((s: number, r: any) => s + r.gross_wages, 0).toFixed(2),
      total_advances: rows.reduce((s: number, r: any) => s + r.total_advances, 0).toFixed(2),
      net_wages: rows.reduce((s: number, r: any) => s + r.net_wages, 0).toFixed(2),
    });
    const totalRow = ws.lastRow!;
    totalRow.eachCell(cell => { cell.font = { bold: true }; });

    const buffer = await wb.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="payroll-${year}-${month}.xlsx"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
