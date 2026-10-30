import test from 'node:test';
import assert from 'node:assert/strict';
import { pbkdf2Sync } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import worker from '../cloudflare-worker.js';
import { loginProof } from '../src/login-proof.js';

const origin = 'https://cat.example';
const context = { waitUntil() {} };
const request = (path, options) => new Request(`${origin}${path}`, options);
const run = (path, env = {}, options) => worker.fetch(request(path, options), env, context);

test('static homepage stays in the assets service; unknown API never falls back to HTML', async () => {
  let assets = 0;
  const env = { ASSETS: { fetch: async () => { assets++; return new Response('homepage'); } } };
  assert.equal(await (await run('/', env)).text(), 'homepage');
  for (const path of ['/api', '/api/unknown']) {
    const result = await run(path, env);
    assert.equal(result.status, 404);
    assert.equal((await result.json()).success, false);
  }
  assert.equal(assets, 1);
});

test('method handling, unsafe parameters and video ranges are enforced at the new entry', async () => {
  const wrong = await run('/api/admin/login');
  assert.equal(wrong.status, 405);
  assert.equal(wrong.headers.get('allow'), 'POST');
  const malformed = await run('/api/public-images/a%2Fb');
  assert.equal(malformed.status, 400);
  const video = await run('/api/public-videos/video_one', {}, { headers: { Range: 'bytes=0-1,3-4' } });
  assert.equal(video.status, 416);
  const head = await run('/api/admin/session', {}, { method: 'HEAD' });
  assert.equal(head.status, 401);
  assert.equal(await head.text(), '');
});

test('admin and sales-assistant access stay authenticated through the Cloudflare adapter', async () => {
  for (const path of ['/api/admin/cats', '/api/admin/sales', '/api/admin/assistant-logs', '/api/admin/images/test', '/api/assistant/session', '/api/assistant/history']) {
    assert.equal((await run(path)).status, 401, path);
  }
  for (const path of ['/api/admin/cats/record_one', '/api/admin/sales/record_one']) {
    assert.equal((await run(path, {}, { method: 'PATCH', body: '{}' })).status, 401, path);
  }
  assert.equal((await run('/api/assistant/reply', {}, { method: 'POST', body: '{}' })).status, 410);
});

test('existing admin password hashes and cookies work without resetting credentials', async () => {
  const salt = Buffer.from('cloudflare-test-salt');
  const hash = pbkdf2Sync('test-password', salt, 120000, 32, 'sha256');
  const env = { ADMIN_USERNAME: 'test-admin', ADMIN_PASSWORD_HASH: `120000.${salt.toString('base64url')}.${hash.toString('base64url')}`, ADMIN_SESSION_SECRET: 'test-session-secret-at-least-32-characters' };
  const start = await run('/api/admin/challenge', env, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'test-admin' }) });
  const challenge = (await start.json()).data;
  const proof = await loginProof(challenge, 'test-password');
  const login = await run('/api/admin/login', env, { method: 'POST', headers: { Origin: origin, Cookie: start.headers.get('set-cookie').split(';')[0], 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.21' }, body: JSON.stringify({ username: 'test-admin', challenge: challenge.challenge, proof }) });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly; Secure; SameSite=Strict/);
  const session = await run('/api/admin/session', env, { headers: { Cookie: cookie.split(';')[0] } });
  assert.equal(session.status, 200);
  const update = await run('/api/admin/cats/recCloudflare01', env, { method: 'PATCH', headers: { Cookie: cookie.split(';')[0], Origin: origin }, body: 'invalid json' });
  assert.equal(update.status, 400);
  const forged = await run('/api/admin/sales/record_one', env, {
    method: 'PATCH', body: '{}', headers: { Cookie: cookie.split(';')[0], Origin: 'https://other.example', 'X-Forwarded-Host': 'other.example' },
  });
  assert.equal(forged.status, 403);
});

test('public catalogue and video preserve the original same-origin API URLs and partial responses', async () => {
  const previousFetch = globalThis.fetch;
  const env = { FEISHU_APP_ID: 'cf-test', FEISHU_APP_SECRET: 'cf-test', FEISHU_APP_TOKEN: 'cf-base', FEISHU_TABLE_ID: 'cf-table' };
  globalThis.fetch = async (url, options) => {
    const target = String(url);
    if (target.includes('tenant_access_token')) return Response.json({ code: 0, tenant_access_token: 'cf-test-token', expire: 7200 });
    if (target.includes('/records')) return Response.json({ code: 0, data: { has_more: false, items: [{ fields: { '猫咪ID': 'CF001', '状态': '在售', '视频': [{ file_token: 'cf_video', name: 'demo.mp4' }] } }] } });
    if (target.includes('/medias/cf_video/download')) {
      assert.equal(options.headers.Range, 'bytes=2-4');
      return new Response(new Uint8Array([2, 3, 4]), { status: 206, headers: { 'Content-Range': 'bytes 2-4/8' } });
    }
    throw new Error('unexpected upstream request');
  };
  try {
    const cats = await run('/api/public-cats', env);
    assert.equal(cats.status, 200);
    assert.equal((await cats.json()).data[0].videos[0].url, '/api/public-videos/cf_video');
    const video = await run('/api/public-videos/cf_video', env, { headers: { Range: 'bytes=2-4' } });
    assert.equal(video.status, 206);
    assert.equal(video.headers.get('content-range'), 'bytes 2-4/8');
    assert.equal(video.headers.get('content-type'), 'video/mp4');
    assert.deepEqual([...new Uint8Array(await video.arrayBuffer())], [2, 3, 4]);
  } finally { globalThis.fetch = previousFetch; }
});

test('all existing API files are imported; frontend and secrets are not bundled as public files', () => {
  const source = readFileSync(new URL('../cloudflare-worker.js', import.meta.url), 'utf8');
  const files = readdirSync(new URL('../cloud-functions/api/', import.meta.url), { recursive: true }).filter(p => p.endsWith('.js'));
  for (const file of files) assert.ok(source.includes(`./cloud-functions/api/${file}`), file);
  const config = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
  assert.equal(config.main, 'cloudflare-worker.js');
  assert.equal(config.assets.directory, './dist');
  assert.deepEqual(config.assets.run_worker_first, ['/api', '/api/*', '/p', '/p/*', '/baidu_verify_codeva-5BMeKqCfaF.html', '/admin-sales', '/admin-sales/*']);
  assert.equal(config.vars, undefined);
});

test('retired AI marketing image endpoint is unavailable (not an accidental asset fallback)',async()=>{
 const env={ASSETS:{fetch:()=>{throw new Error('API must never be served as a web page');}}};
 for(const method of ['GET','POST']){
  const options=method==='POST'?{method,headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'}:{method};
  const res=await run('/api/marketing-lab',env,options);
  assert.equal(res.status,404);
  assert.equal((await res.json()).message,'接口不存在');
 }
});
