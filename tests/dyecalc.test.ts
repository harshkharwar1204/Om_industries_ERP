import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scaleRecipe } from '../lib/dyecalc.ts';

test('percent (owf): grams = batchKg * 10 * qty', () => {
  const [line] = scaleRecipe([{ color_name: 'Red', quantity: 2, unit: '%' }], 50);
  assert.equal(line.total, 1000); // 50 * 10 * 2
  assert.equal(line.display, '1000 g');
});

test('g/l uses liquor litres = batchKg * mlr', () => {
  const [line] = scaleRecipe([{ color_name: 'Salt', quantity: 5, unit: 'g/l' }], 10, 8);
  assert.equal(line.total, 400); // 5 * 10 * 8
});

test('default unit is per-kg of yarn', () => {
  const [line] = scaleRecipe([{ color_name: 'X', quantity: 3, unit: 'g' }], 12);
  assert.equal(line.total, 36); // 3 * 12
});

test('ml unit reports ml display', () => {
  const [line] = scaleRecipe([{ color_name: 'Acid', quantity: 2, unit: 'ml' }], 10);
  assert.equal(line.display, '20 ml');
});

test('empty / zero inputs are safe', () => {
  assert.deepEqual(scaleRecipe([], 50), []);
  const [line] = scaleRecipe([{ color_name: 'X', quantity: 'bad', unit: '%' }], 0);
  assert.equal(line.total, 0);
});
