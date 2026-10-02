import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDemandLocally, parseDemand } from '../cloud-functions/_lib/smart-search.js';
import { onRequestPost } from '../cloud-functions/api/smart-search.js';

const catalog = { breeds: ['布偶猫', '英短', '缅因猫'], colors: ['金渐层', '蓝双', '海双'] };

test('local smart search extracts common customer demand without AI', () => {
  const result = parseDemandLocally('想找一只两三个月的布偶妹妹，预算1500以内，可以发杭州吗', catalog);
  assert.equal(result.filters.breed, '布偶猫');
  assert.equal(result.filters.gender, '母');
  assert.equal(result.filters.minAge, '2');
  assert.equal(result.filters.maxAge, '3');
  assert.equal(result.filters.max, '1500');
  assert.equal(result.filters.city, '杭州');
});

test('common demand avoids model request', async () => {
  const result = await parseDemand({ DEEPSEEK_API_KEY: 'unused', DEEPSEEK_MODEL: 'unused' }, { text: '找英短弟弟，三个月，预算一千五左右', ...catalog });
  assert.equal(result.usedAI, false);
  assert.equal(result.filters.breed, '英短');
  assert.equal(result.filters.gender, '公');
});

test('public endpoint validates input and returns filter JSON', async () => {
  const request = new Request('https://example.com/api/smart-search', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.10' }, body: JSON.stringify({ text: '布偶妹妹两个月，1500以内', ...catalog }) });
  const response = await onRequestPost({ env: {}, request });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.filters.breed, '布偶猫');
});
