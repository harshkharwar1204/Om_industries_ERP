import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rupeesInWords } from '../lib/numToWords.ts';

test('zero', () => {
  assert.equal(rupeesInWords(0), 'Rupees Zero Only');
});

test('simple thousands', () => {
  assert.equal(rupeesInWords(12760), 'Rupees Twelve Thousand Seven Hundred Sixty Only');
});

test('teens and hundreds', () => {
  assert.equal(rupeesInWords(10864), 'Rupees Ten Thousand Eight Hundred Sixty Four Only');
});

test('lakhs (Indian system)', () => {
  assert.equal(rupeesInWords(125000), 'Rupees One Lakh Twenty Five Thousand Only');
});

test('crore + lakh', () => {
  assert.equal(rupeesInWords(10000000), 'Rupees One Crore Only');
});

test('rounds paise to nearest rupee', () => {
  assert.equal(rupeesInWords(99.6), 'Rupees One Hundred Only');
});
