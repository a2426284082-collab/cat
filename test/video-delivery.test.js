import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cloudflare-worker.js';

let counter = 0;
function setup() {
  const id = `direct-${++counter}`;
  const env = { FEISHU_APP_ID: id, FEISHU_APP_SECRET: 'never-expose-secret', FEISHU_APP_TOKEN: `${id}-base`, FEISHU_TABLE_ID: `${id}-table` };
  const calls = { links: 0, downloads: 0, records: 0 };
  let mode = 'ok';
  const link = 'https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=signed-test';
  const mock = async (input, options) => {
    const url = new URL(String(input));
    if (url.pathname.includes('tenant_access_token')) return Response.json({ code: 0, tenant_access_token: 'never-expose-tenant-token', expire: 7200 });
    if (url.pathname.endsWith('/records')) {
      calls.records++;
      return Response.json({ code: 0, data: { has_more: false, items: [
        { fields: { '猫咪ID': 'DIRECT1', '状态': '在售', '视频': [{ file_token: 'public_video', name: '猫咪.mp4' }] } },
        { fields: { '猫咪ID': 'HIDDEN1', '状态': '下架', '视频': [{ file_token: 'private_video', name: '内部.mp4' }] } },
      ] } });
    }
    if (url.pathname.endsWith('/batch_get_tmp_download_url')) {
      calls.links++;
      assert.equal(url.searchParams.get('file_tokens'), 'public_video');
      assert.equal(options.headers.Authorization, 'Bearer never-expose-tenant-token');
      if (mode === 'denied') return Response.json({ code: 99991672, msg: 'permission denied' });
      if (mode === 'timeout') throw new Error('upstream timed out');
      if (mode === 'missing') return Response.json({ code: 0, data: { tmp_download_urls: [] } });
      const urls = {
        ok: link,
        http: 'http://internal-api-drive-stream.feishu.cn/file',
        hostile: 'https://feishu.cn.evil.example/file',
        credentials: 'https://secret:password@internal-api-drive-stream.feishu.cn/file',
      };
      return Response.json({ code: 0, data: { tmp_download_urls: [{ file_token: 'public_video', tmp_download_url: urls[mode] }] } });
    }
    if (url.pathname.endsWith('/public_video/download')) {
      calls.downloads++;
      assert.equal(options.headers.Range, 'bytes=2-4');
      return new Response(new Uint8Array([2, 3, 4]), { status: 206, headers: { 'Content-Range': 'bytes 2-4/9' } });
    }
    throw new Error('unexpected upstream request');
  };
  const run = (path = '/api/public-videos/public_video', method = 'GET') => worker.fetch(new Request(`https://cats.example${path}`, { method, headers: { Range: 'bytes=2-4' } }), env, { waitUntil() {} });
  return { env, calls, mock, run, link, setMode(value) { mode = value; } };
}

async function withMock(run) {
  const fetch = globalThis.fetch;
  const cache = globalThis.caches;
  const now = Date.now;
  try { await run(); }
  finally { globalThis.fetch = fetch; globalThis.caches = cache; Date.now = now; }
}

test('direct delivery returns only a temporary redirect and no video bytes or app credentials', () => withMock(async () => {
  const f = setup(); globalThis.fetch = f.mock;
  const response = await f.run();
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), f.link);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(await response.text(), '');
  assert.doesNotMatch(JSON.stringify([...response.headers]), /never-expose/);
  assert.equal(f.calls.downloads, 0);
  assert.equal((await f.run(undefined, 'HEAD')).status, 302);
  assert.equal(f.calls.links, 1);
}));

test('simultaneous plays share one link request; a cached link refreshes after an hour', () => withMock(async () => {
  const f = setup(); globalThis.fetch = f.mock;
  let now = Date.now(); Date.now = () => now;
  const responses = await Promise.all(Array.from({ length: 12 }, () => f.run()));
  assert.ok(responses.every(r => r.status === 302));
  assert.equal(f.calls.links, 1);
  now += 59 * 60 * 1000;
  await f.run(); assert.equal(f.calls.links, 1);
  now += 2 * 60 * 1000;
  await f.run(); assert.equal(f.calls.links, 2);
}));

test('hidden or unknown videos never request a temporary URL', () => withMock(async () => {
  const f = setup(); globalThis.fetch = f.mock;
  assert.equal((await f.run('/api/public-videos/private_video')).status, 404);
  assert.equal((await f.run('/api/public-videos/unknown')).status, 404);
  assert.equal(f.calls.links, 0); assert.equal(f.calls.downloads, 0);
}));

test('browser fallback and runtime rollback preserve byte ranges without getting links', () => withMock(async () => {
  const f = setup(); globalThis.fetch = f.mock;
  const response = await f.run('/api/public-videos/public_video?delivery=proxy');
  assert.equal(response.status, 206);
  assert.equal(response.headers.get('content-range'), 'bytes 2-4/9');
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [2, 3, 4]);
  f.env.FEISHU_VIDEO_DELIVERY = 'proxy';
  assert.equal((await f.run()).status, 206);
  assert.equal(f.calls.links, 0); assert.equal(f.calls.downloads, 2);
}));

test('denied or timed-out link acquisition falls back and retries after a short cooldown', () => withMock(async () => {
  for (const mode of ['denied', 'timeout', 'missing']) {
    const f = setup(); globalThis.fetch = f.mock; f.setMode(mode);
    let now = Date.now(); Date.now = () => now;
    assert.equal((await f.run()).status, 206);
    assert.equal((await f.run()).status, 206);
    assert.equal(f.calls.links, 1);
    now += 31_000; f.setMode('ok');
    assert.equal((await f.run()).status, 302);
    assert.equal(f.calls.links, 2);
  }
}));

test('unsafe redirect targets fail closed to the original video proxy', () => withMock(async () => {
  for (const mode of ['http', 'hostile', 'credentials']) {
    const f = setup(); globalThis.fetch = f.mock; f.setMode(mode);
    const response = await f.run();
    assert.equal(response.status, 206);
    assert.equal(response.headers.get('location'), null);
  }
}));

test('shared edge cache survives new module instances and never mixes application credentials', () => withMock(async () => {
  const f = setup(); globalThis.fetch = f.mock;
  const stored = new Map();
  globalThis.caches = { default: {
    async match(key) { return stored.get(key.url)?.clone(); },
    async put(key, response) { stored.set(key.url, response.clone()); },
  } };
  const one = await import('../cloud-functions/_lib/video-links.js?isolate=one');
  const two = await import('../cloud-functions/_lib/video-links.js?isolate=two');
  assert.equal(await one.getTemporaryVideoLink(f.env, 'public_video', 'https://cats.example/api/public-videos/public_video'), f.link);
  assert.equal(await two.getTemporaryVideoLink(f.env, 'public_video', 'https://cats.example/api/public-videos/public_video'), f.link);
  assert.equal(f.calls.links, 1);
  const changed = { ...f.env, FEISHU_APP_SECRET: 'rotated-secret' };
  assert.equal(await two.getTemporaryVideoLink(changed, 'public_video', 'https://cats.example/api/public-videos/public_video'), f.link);
  assert.equal(f.calls.links, 2);
  assert.equal(stored.size, 2);
  assert.ok([...stored.keys()].every(key => !key.includes('never-expose') && !key.includes('rotated-secret')));
}));

test('shared cache errors do not prevent direct playback', () => withMock(async () => {
  const f = setup(); globalThis.fetch = f.mock;
  globalThis.caches = { default: { async match() { throw new Error('cache disabled'); }, async put() { throw new Error('cache unavailable'); } } };
  assert.equal((await f.run()).status, 302);
}));
