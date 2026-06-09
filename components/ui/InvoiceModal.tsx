'use client';
import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface InvoiceData {
  invoice_no: string;
  date: string;
  client_name: string;
  client_gstin?: string | null;
  client_address?: string | null;
  qty_kg: number;
  rate: number;
  hsn_code?: string | null;
  gst_rate?: number | null;
  taxable_value?: number | null;
  cgst_amount?: number | null;
  sgst_amount?: number | null;
  igst_amount?: number | null;
  total_tax?: number | null;
  grand_total?: number | null;
  amount: number;
  vehicle_no?: string | null;
  lr_no?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  data: InvoiceData | null;
}

const FACTORY = {
  name: 'OM INDUSTRIES',
  address: 'Surat, Gujarat - 395001',
  gstin: '',
  state: 'Gujarat (24)',
  phone: '',
};

export function InvoiceModal({ open, onClose, data }: Props) {
  const qrRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!open || !data || !qrRef.current) return;
    const qrData = JSON.stringify({
      inv: data.invoice_no,
      dt:  data.date,
      to:  data.client_name,
      gstin: data.client_gstin || '',
      amt: data.grand_total ?? data.amount,
      hsn: data.hsn_code || '',
    });
    QRCode.toCanvas(qrRef.current, qrData, { width: 96, margin: 1, color: { dark: '#1E293B', light: '#FFFFFF' } });
  }, [open, data]);

  if (!open || !data) return null;

  const grandTotal = data.grand_total ?? data.amount;
  const taxable    = data.taxable_value ?? data.amount;
  const hasTax     = (data.gst_rate ?? 0) > 0 && (data.total_tax ?? 0) > 0;

  return (
    <>
      {/* Overlay */}
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
          {/* Action bar */}
          <div style={{ padding: '12px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Invoice Preview</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#F97316', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                🖨 Print
              </button>
              <button onClick={onClose} style={{ padding: '8px 14px', border: '1px solid #E2E8F0', borderRadius: 8, cursor: 'pointer', background: '#fff', fontSize: 13 }}>
                Close
              </button>
            </div>
          </div>

          {/* Invoice content — this is what gets printed */}
          <div id="invoice-print" style={{ padding: '28px 32px', fontFamily: 'Arial, sans-serif', fontSize: 13, color: '#1E293B', lineHeight: 1.5 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, paddingBottom: 16, borderBottom: '2px solid #1E293B' }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '0.05em', color: '#F97316' }}>{FACTORY.name}</div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{FACTORY.address}</div>
                {FACTORY.gstin && <div style={{ fontSize: 11, color: '#64748B' }}>GSTIN: {FACTORY.gstin}</div>}
                {FACTORY.phone && <div style={{ fontSize: 11, color: '#64748B' }}>Ph: {FACTORY.phone}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#1E293B' }}>TAX INVOICE</div>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4, fontFamily: 'monospace', letterSpacing: '0.06em' }}>{data.invoice_no}</div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Date: {new Date(data.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
              </div>
            </div>

            {/* Party details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Bill To</div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{data.client_name}</div>
                {data.client_address && <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{data.client_address}</div>}
                {data.client_gstin && <div style={{ fontSize: 11, color: '#64748B', marginTop: 2, fontFamily: 'monospace' }}>GSTIN: {data.client_gstin}</div>}
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Transport</div>
                {data.vehicle_no && <div style={{ fontSize: 12 }}>Vehicle: <strong>{data.vehicle_no}</strong></div>}
                {data.lr_no      && <div style={{ fontSize: 12 }}>LR No: <strong>{data.lr_no}</strong></div>}
                {!data.vehicle_no && !data.lr_no && <div style={{ fontSize: 12, color: '#94A3B8' }}>—</div>}
              </div>
            </div>

            {/* Items table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
              <thead>
                <tr style={{ background: '#F1F5F9' }}>
                  {['#', 'Description', 'HSN', 'Qty (kg)', 'Rate (₹)', 'Amount (₹)'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: h === '#' || h === 'Qty (kg)' || h === 'Rate (₹)' || h === 'Amount (₹)' ? 'right' : 'left', fontSize: 11, fontWeight: 700, color: '#475569', border: '1px solid #E2E8F0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #E2E8F0', fontSize: 12 }}>1</td>
                  <td style={{ padding: '10px', border: '1px solid #E2E8F0', fontWeight: 600 }}>Yarn / Hanks</td>
                  <td style={{ padding: '10px', border: '1px solid #E2E8F0', fontFamily: 'monospace', fontSize: 12 }}>{data.hsn_code || '—'}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #E2E8F0', fontFamily: 'monospace' }}>{data.qty_kg}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #E2E8F0', fontFamily: 'monospace' }}>₹{data.rate}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #E2E8F0', fontFamily: 'monospace', fontWeight: 700 }}>₹{taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>

            {/* Tax summary */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24 }}>
              {/* QR code */}
              <div style={{ textAlign: 'center' }}>
                <canvas ref={qrRef} style={{ display: 'block' }} />
                <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 4 }}>Scan for invoice details</div>
              </div>

              {/* Totals */}
              <div style={{ flex: 1, maxWidth: 260 }}>
                <table style={{ width: '100%', fontSize: 12 }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '4px 8px', color: '#64748B' }}>Taxable Value</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>₹{taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    {hasTax && data.cgst_amount && data.cgst_amount > 0 && (
                      <>
                        <tr>
                          <td style={{ padding: '4px 8px', color: '#64748B' }}>CGST ({(data.gst_rate ?? 0) / 2}%)</td>
                          <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>₹{data.cgst_amount?.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '4px 8px', color: '#64748B' }}>SGST ({(data.gst_rate ?? 0) / 2}%)</td>
                          <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>₹{data.sgst_amount?.toFixed(2)}</td>
                        </tr>
                      </>
                    )}
                    {hasTax && (data.igst_amount ?? 0) > 0 && (
                      <tr>
                        <td style={{ padding: '4px 8px', color: '#64748B' }}>IGST ({data.gst_rate}%)</td>
                        <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>₹{data.igst_amount?.toFixed(2)}</td>
                      </tr>
                    )}
                    {!hasTax && (
                      <tr><td colSpan={2} style={{ padding: '4px 8px', color: '#94A3B8', fontSize: 11 }}>No GST (Nil / Unregistered)</td></tr>
                    )}
                    <tr style={{ borderTop: '2px solid #1E293B' }}>
                      <td style={{ padding: '8px 8px 4px', fontWeight: 800, fontSize: 14 }}>Grand Total</td>
                      <td style={{ padding: '8px 8px 4px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, fontSize: 16 }}>₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div style={{ marginTop: 32, paddingTop: 12, borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94A3B8' }}>
              <span>This is a computer-generated invoice.</span>
              <span>For {FACTORY.name} — {FACTORY.state}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Print styles — injected into head */}
      <style>{`
        @media print {
          body > *:not(#invoice-print-root) { display: none !important; }
          #invoice-print { display: block !important; padding: 20px !important; }
          .modal-overlay, button { display: none !important; }
        }
      `}</style>
    </>
  );
}
