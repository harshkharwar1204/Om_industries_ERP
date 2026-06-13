// Pure GST helpers (extracted from the dispatch route so they can be unit-tested).
export const FACTORY_STATE = '24'; // Gujarat

export interface GstSplit { cgst: number; sgst: number; igst: number; total_tax: number; }

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Split tax into CGST/SGST (intra-state) or IGST (inter-state). */
export function calcGst(taxableValue: number, gstRate: number, clientStateCode: string): GstSplit {
  const tax = round2((taxableValue * gstRate) / 100);
  const intraState = (clientStateCode || FACTORY_STATE) === FACTORY_STATE;
  return intraState
    ? { cgst: tax / 2, sgst: tax / 2, igst: 0, total_tax: tax }
    : { cgst: 0, sgst: 0, igst: tax, total_tax: tax };
}

export interface InvoiceCalc extends GstSplit { taxable_value: number; grand_total: number; }

/**
 * Compute an invoice's taxable value, tax split and grand total.
 * - No GST when rate is 0/falsy or the dealer is unregistered.
 * - tax_inclusive: the base already includes tax → back-calculate the taxable value.
 */
export function computeInvoice(opts: {
  base: number; gstRate: number; taxInclusive: boolean; stateCode: string; unregistered: boolean;
}): InvoiceCalc {
  const { base, gstRate, taxInclusive, stateCode, unregistered } = opts;
  if (!gstRate || unregistered) {
    return { taxable_value: base, cgst: 0, sgst: 0, igst: 0, total_tax: 0, grand_total: base };
  }
  if (taxInclusive) {
    const taxable = round2(base / (1 + gstRate / 100));
    const g = calcGst(taxable, gstRate, stateCode);
    return { taxable_value: taxable, ...g, grand_total: base };
  }
  const g = calcGst(base, gstRate, stateCode);
  return { taxable_value: base, ...g, grand_total: base + g.total_tax };
}
