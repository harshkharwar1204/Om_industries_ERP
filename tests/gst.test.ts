import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcGst, computeInvoice } from '../lib/gst.ts';

test('intra-state splits into equal CGST + SGST', () => {
  const g = calcGst(1000, 18, '24');
  assert.equal(g.cgst, 90);
  assert.equal(g.sgst, 90);
  assert.equal(g.igst, 0);
  assert.equal(g.total_tax, 180);
});

test('inter-state uses IGST only', () => {
  const g = calcGst(1000, 18, '27');
  assert.equal(g.cgst, 0);
  assert.equal(g.sgst, 0);
  assert.equal(g.igst, 180);
  assert.equal(g.total_tax, 180);
});

test('missing state code defaults to factory state (intra)', () => {
  const g = calcGst(500, 12, '');
  assert.equal(g.igst, 0);
  assert.equal(g.total_tax, 60);
});

test('no GST when rate is zero', () => {
  const inv = computeInvoice({ base: 1000, gstRate: 0, taxInclusive: false, stateCode: '24', unregistered: false });
  assert.equal(inv.total_tax, 0);
  assert.equal(inv.grand_total, 1000);
});

test('unregistered dealer pays no GST even with a rate', () => {
  const inv = computeInvoice({ base: 1000, gstRate: 18, taxInclusive: false, stateCode: '24', unregistered: true });
  assert.equal(inv.total_tax, 0);
  assert.equal(inv.grand_total, 1000);
});

test('exclusive: grand total = base + tax', () => {
  const inv = computeInvoice({ base: 1000, gstRate: 18, taxInclusive: false, stateCode: '24', unregistered: false });
  assert.equal(inv.taxable_value, 1000);
  assert.equal(inv.total_tax, 180);
  assert.equal(inv.grand_total, 1180);
});

test('inclusive: grand total stays equal to base, taxable is back-calculated', () => {
  const inv = computeInvoice({ base: 1180, gstRate: 18, taxInclusive: true, stateCode: '24', unregistered: false });
  assert.equal(inv.grand_total, 1180);
  assert.equal(inv.taxable_value, 1000);
  assert.equal(inv.total_tax, 180);
});
