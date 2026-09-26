import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet as list } from '../cloud-functions/api/public-cats.js';
import { onRequestGet as image } from '../cloud-functions/api/public-images/[token].js';
import { onRequestGet as video } from '../cloud-functions/api/public-videos/[token].js';

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
        { fields: { '猫咪ID': 'CAT001', '状态': '在售', '品种': '英短', '毛色/花色': '金渐层', '性别': '公', '年龄': 4, '疫苗': [{ text: '已接种两针' }], '描述': [{ text: '性格亲人' }, { text: '，活泼好动' }], '价格': 3800, '图片': [{ file_token: 'public_file' }, { file_token: 'second_file' }], '视频': [{ file_token: 'video_one', name: '玩耍.mp4' }, { file_token: 'video_two', name: '睡觉.webm' }, { file_token: 'ignored_file', name: '私密文档.pdf' }], '内部备注': '不要公开' } },
        { fields: { '猫咪ID': 'CAT002', '状态': '下架', '品种': '布偶', '图片': [{ file_token: 'private_file' }], '视频': [{ file_token: 'private_video', name: '不公开.mp4' }] } },
        { fields: { '猫咪ID': 'CAT003', '状态': '在售', '视频': [{ file_token: 'invalid_video', name: '未知.exe' }] } },
      ] } });
    }
    if (target.includes('/medias/public_file/')) return new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/webp' } });
    if (target.includes('/medias/second_file/')) return new Response(new Uint8Array([4, 5, 6]), { headers: { 'Content-Type': 'image/webp' } });
    if (target.includes('/medias/video_one/')) {
      const match = /^bytes=(\d+)-(\d+)$/.exec(options?.headers?.Range ?? '');
      const start = Number(match?.[1]);
      const end = Math.min(Number(match?.[2]), 19);
      if (start >= 20) return new Response(null, { status: 416 });
      return new Response(new Uint8Array(end - start + 1), { status: 206, headers: { 'Content-Range': `bytes ${start}-${end}/20`, 'Content-Type': 'application/octet-stream' } });
    }
    if (target.includes('/medias/video_two/')) return new Response(new Uint8Array([1, 2, 3, 4, 5]), { status: 200, headers: { 'Content-Length': '5' } });
    throw new Error(`unexpected request ${target}`);
  };
  try {
    const result = await list({ env });
    assert.equal(result.status, 200);
    const body = await result.json();
    assert.equal(body.data.length, 2);
    assert.deepEqual(body.data[0], { id: 'CAT001', breed: '英短', color: '金渐层', gender: '公', age: '4', vaccine: '已接种两针', description: '性格亲人，活泼好动', price: 3800, image: '/api/public-images/public_file', images: ['/api/public-images/public_file', '/api/public-images/second_file'], videos: [{ name: '玩耍.mp4', url: '/api/public-videos/video_one' }, { name: '睡觉.webm', url: '/api/public-videos/video_two' }] });
    assert.deepEqual(body.data[1].videos, []);
    assert.equal(body.data[1].price, null);
    assert.equal(JSON.stringify(body).includes('内部备注'), false);
    assert.equal(JSON.stringify(body).includes('private_file'), false);
    assert.equal(JSON.stringify(body).includes('private_video'), false);
    const unavailable = await image({ env, params: { token: 'private_file' } });
    assert.equal(unavailable.status, 404);
    const invalid = await image({ env, params: { token: '../private_file' } });
    assert.equal(invalid.status, 404);
    const visible = await image({ env, params: { token: 'public_file' } });
    assert.equal(visible.status, 200);
    assert.equal(visible.headers.get('content-type'), 'image/webp');
    const second = await image({ env, params: { token: 'second_file' } });
    assert.equal(second.status, 200);
    const unavailableVideo = await video({ env, params: { token: 'private_video' }, request: new Request('https://example.com/api/public-videos/private_video') });
    assert.equal(unavailableVideo.status, 404);
    const invalidRange = await video({ env, params: { token: 'video_one' }, request: new Request('https://example.com/api/public-videos/video_one', { headers: { Range: 'bytes=0-1,3-4' } }) });
    assert.equal(invalidRange.status, 416);
    const playable = await video({ env, params: { token: 'video_one' }, request: new Request('https://example.com/api/public-videos/video_one', { headers: { Range: 'bytes=5-' } }) });
    assert.equal(playable.status, 206);
    assert.equal(playable.headers.get('content-range'), 'bytes 5-19/20');
    assert.equal(playable.headers.get('content-type'), 'video/mp4');
    const fullFileInsteadOfRange = await video({ env, params: { token: 'video_two' }, request: new Request('https://example.com/api/public-videos/video_two', { headers: { Range: 'bytes=2-3' } }) });
    assert.equal(fullFileInsteadOfRange.status, 206);
    assert.equal(fullFileInsteadOfRange.headers.get('content-range'), 'bytes 2-3/5');
    assert.deepEqual([...new Uint8Array(await fullFileInsteadOfRange.arrayBuffer())], [3, 4]);
    assert.equal(requests.filter(r => r.target.includes('/records')).length, 1); // cache
    assert.equal(requests.some(r => r.target.includes('private_file')), false);
    assert.equal(requests.some(r => r.target.includes('private_video')), false);
    assert.equal(requests.some(r => r.method === 'PUT' || r.method === 'PATCH'), false);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
