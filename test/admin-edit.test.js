import test from 'node:test';
import assert from 'node:assert/strict';
import { changedCatFields } from '../src/admin-edit.js';

test('editing price does not submit untouched optional or text fields', () => {
  const original = { status: '在售', breed: '布偶', price: 600, age: null, costPrice: null, description: '原描述' };
  assert.deepEqual(changedCatFields(original, { ...original, price: '650' }), { price: '650' });
});

test('editing description does not submit empty fields that may not exist in Feishu', () => {
  const original = { status: '在售', price: 600, description: '原描述' };
  assert.deepEqual(changedCatFields(original, { ...original, description: '新描述', supplier: '', supplierOriginalId: '', verificationNote: '' }), { description: '新描述' });
});

test('equivalent number strings and untouched blanks produce no update', () => {
  const original = { price: 600, age: 2, costPrice: null, supplier: undefined };
  assert.deepEqual(changedCatFields(original, { price: '600', age: '2', costPrice: '', supplier: '' }), {});
});

test('multiple real edits, status changes and explicit text clearing are preserved', () => {
  const original = { status: '在售', description: '旧描述', breed: '英短' };
  assert.deepEqual(changedCatFields(original, { ...original, status: '已售', description: '', breed: '布偶' }), { status: '已售', breed: '布偶', description: '' });
});
