import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet as list } from '../cloud-functions/api/public-cats.js';
import { onRequestGet as image } from '../cloud-functions/api/public-images/[token].js';

const env = { FEISHU_APP_ID: 'test-app', FEISHU_APP_SECRET: 'test-secret', FEISHU_APP_TOKEN: 'test-base', FEISHU_TABLE_ID: 'test-table' };

test('public API filters on server, exposes only allowed fields, and protects images', async () => {
  const previousFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    const target = String(url);
    requests.push({ target, method: options?.method || 'GET' });
    if (target.includes('tenant_access_token')) {
      return Response.json({ code: 0, tenant_access_token: 'test-token', expire: 7200 });
    }
    if (target.includes('/records')) {
      return Response.json({ code: 0, data: { has_more: false, items: [
        { fields: { '猫咪ID': 'CAT001', '状态': '在售', '品种': '英短', '毛色/花色': '金渐层', '性别': '公', '年龄': 4, '价格': 3800, '图片': [{ file_token: 'public_file' }], '视频链接': [{ text: '播放', link: 'https://cdn.example.com/cat.mp4' }], '内部备注': '不要公开' } },
        { fields: { '猫咪ID': 'CAT002', '状态': '下架', '品种': '布偶', '图片': [{ file_token: 'private_file' }], '视频链接': 'https://cdn.example.com/private.mp4' } },
        { fields: { '猫咪ID': 'CAT003', '状态': '在售', '视频链接': 'javascript:alert(1)' } },
      ] } });
    }
    if (target.includes('/medias/public_file/')) return new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/webp' } });
    throw new Error(`unexpected request ${target}`);
  };
  try {
    const result = await list({ env });
    assert.equal(result.status, 200);
    const body = await result.json();
    assert.equal(body.data.length, 2);
    assert.deepEqual(body.data[0], { id: 'CAT001', breed: '英短', color: '金渐层', gender: '公', age: '4', price: 3800, image: '/api/public-images/public_file', video: 'https://cdn.example.com/cat.mp4' });
    assert.equal(body.data[1].video, null);
    assert.equal(JSON.stringify(body).includes('内部备注'), false);
    assert.equal(JSON.stringify(body).includes('private_file'), false);
    assert.equal(JSON.stringify(body).includes('private.mp4'), false);
    const unavailable = await image({ env, params: { token: 'private_file' } });
    assert.equal(unavailable.status, 404);
    const invalid = await image({ env, params: { token: '../private_file' } });
    assert.equal(invalid.status, 404);
    const visible = await image({ env, params: { token: 'public_file' } });
    assert.equal(visible.status, 200);
    assert.equal(visible.headers.get('content-type'), 'image/webp');
    assert.equal(requests.filter(r => r.target.includes('/records')).length, 1); // cache
    assert.equal(requests.some(r => r.target.includes('private_file')), false);
    assert.equal(requests.some(r => r.method === 'PUT' || r.method === 'PATCH'), false);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
