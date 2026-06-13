import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthRange } from '../lib/dates.ts';

test('30-day month ends on the 30th (not invalid 31)', () => {
  assert.deepEqual(monthRange(4, 2026), { start: '2026-04-01', end: '2026-04-30' });
});

test('February (non-leap) ends on the 28th', () => {
  assert.deepEqual(monthRange(2, 2026), { start: '2026-02-01', end: '2026-02-28' });
});

test('February (leap) ends on the 29th', () => {
  assert.equal(monthRange(2, 2024).end, '2024-02-29');
});

test('31-day month ends on the 31st', () => {
  assert.equal(monthRange(1, 2026).end, '2026-01-31');
});

test('accepts string inputs and zero-pads the month', () => {
  assert.deepEqual(monthRange('6', '2026'), { start: '2026-06-01', end: '2026-06-30' });
});
