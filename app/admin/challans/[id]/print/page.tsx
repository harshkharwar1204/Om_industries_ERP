'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';

export default function ChallanPrintPage() {
  const { id } = useParams();
  const [c, setC] = useState<any>(null);
  const [s, setS] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');

  useEffect(() => {
    Promise.all([apiFetch(`/challans/${id}`), apiFetch('/settings')])
      .then(([challan, settings]) => { setC(challan); setS(settings); })
      .catch(e => setErr(e.message));
  }, [id]);

  useEffect(() => { if (c) setTimeout(() => window.print(), 400); }, [c]);

  if (err) return <div style={{ padding: 24 }}>Error: {err}</div>;
  if (!c) return <div style={{ padding: 24 }}>Loading challan…</div>;

  const items: any[] = c.challan_items ?? [];

  return (
    <>
      <style>{`
        @page { size: A5; margin: 5mm 8mm; }
        @media print { .no-print { display: none !important; } body { background: #fff; } }
        .dc { width: 132mm; margin: 0 auto; background: #fff; color: #000;
              font-family: 'Fira Sans', Arial, sans-serif; font-size: 10px; padding: 4mm 0; }
        .dc * { box-sizing: border-box; }
        .dc-h1 { text-align: center; font-size: 18px; font-weight: 800; letter-spacing: 1px; margin: 2px 0; }
        .dc-bless { text-align: center; font-size: 10px; font-weight: 600; }
        .dc-sub { text-align: center; font-size: 9px; line-height: 1.4; }
        .dc-meta { display: flex; justify-content: space-between; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 4px 2px; margin: 6px 0; }
        .dc-table { width: 100%; border-collapse: collapse; }
        .dc-table th, .dc-table td { border: 1px solid #000; padding: 3px 4px; font-size: 9px; }
        .dc-table th { background: #f0f0f0; text-align: center; }
        .dc-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
        .dc-table td.ctr { text-align: center; }
        .dc-foot td { border: none; padding-top: 8px; font-size: 9px; }
        .dc-words { font-style: italic; font-size: 9px; margin: 4px 0; }
        .dc-sign { display: flex; justify-content: space-between; margin-top: 20px; font-size: 9px; }
        .dc-sign div { text-align: center; border-top: 1px solid #000; padding-top: 3px; width: 45%; }
      `}</style>

      <div className="no-print" style={{ textAlign: 'center', padding: 12, background: '#f8fafc' }}>
        <button onClick={() => window.print()} style={{ padding: '8px 20px', background: '#F97316', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Print Challan</button>
      </div>

      <div className="dc">
        <div className="dc-bless">{s.challan_header_blessing || '|| SHREE GANESHAY NAMAH ||'}</div>
        <div className="dc-h1">{s.company_name || 'OM INDUSTRIES'}</div>
        <div className="dc-sub">
          {s.factory_address_line1 || ''}<br />
          {s.factory_address_line2 || ''}<br />
          {s.factory_phone ? `Ph: ${s.factory_phone}` : ''} {s.factory_gstin ? ` · GSTIN: ${s.factory_gstin}` : ''}
        </div>
        <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 11, margin: '4px 0', borderTop: '1px solid #000', borderBottom: '1px solid #000', padding: '2px 0' }}>
          DELIVERY CHALLAN
        </div>

        <div className="dc-meta">
          <div>
            <strong>Party Details:</strong><br />
            {c.clients?.name}<br />
            {c.clients?.address || ''}
            {c.clients?.gstin ? <><br />GSTIN: {c.clients.gstin}</> : null}
          </div>
          <div style={{ textAlign: 'right' }}>
            <strong>Invoice No:</strong> {c.challan_no}<br />
            <strong>Dated:</strong> {new Date(c.date).toLocaleDateString('en-IN')}
          </div>
        </div>

        <table className="dc-table">
          <thead>
            <tr>
              <th>S.N.</th><th>Item Name</th><th>Color</th><th>Cone</th>
              <th>Gr wt</th><th>Tr wt</th><th>Nt wt</th><th>Rate</th><th>Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it.id ?? i}>
                <td className="ctr">{i + 1}</td>
                <td>{it.item_name || '—'}</td>
                <td>{it.color || '—'}</td>
                <td className="ctr">{it.cones ?? '—'}</td>
                <td className="num">{Number(it.gross_kg).toFixed(2)}</td>
                <td className="num">{Number(it.tare_kg).toFixed(2)}</td>
                <td className="num">{Number(it.net_kg).toFixed(2)}</td>
                <td className="num">{Number(it.rate).toFixed(2)}</td>
                <td className="num">{Number(it.amount).toFixed(2)}</td>
              </tr>
            ))}
            <tr style={{ fontWeight: 700 }}>
              <td colSpan={6} style={{ textAlign: 'right' }}>Total</td>
              <td className="num">{Number(c.total_net_kg).toFixed(2)}</td>
              <td></td>
              <td className="num">{Number(c.total_amount).toFixed(2)}</td>
            </tr>
            {Number(c.rounded_off) !== 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'right' }}>Less: Rounded Off (-)</td>
                <td className="num">{Number(c.rounded_off).toFixed(2)}</td>
              </tr>
            )}
            <tr style={{ fontWeight: 800 }}>
              <td colSpan={8} style={{ textAlign: 'right' }}>Grand Total</td>
              <td className="num">{Number(c.grand_total).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div className="dc-words">{c.amount_in_words || ''}</div>
        <div style={{ fontSize: 9 }}>Total Net Weight: <strong>{Number(c.total_net_kg).toFixed(2)} Kgs.</strong></div>

        <div className="dc-sign">
          <div>Receiver's Signature</div>
          <div>For {s.company_name || 'OM INDUSTRIES'}<br />Authorised Signatory</div>
        </div>
      </div>
    </>
  );
}
