import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../cloudflare-worker.js';

const path = '/baidu_verify_codeva-5BMeKqCfaF.html';
const token = readFileSync(new URL(`../public${path}`, import.meta.url), 'utf8');
const env = { ASSETS: { fetch() { throw new Error('Assets would redirect HTML URLs'); } } };

test('Baidu verification returns the original file directly on both public hosts', async () => {
  const config = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
  assert.ok(config.assets.run_worker_first.includes(path));
  assert.equal(config.keep_vars, true);
  for (const host of ['petcloud88.top', 'www.petcloud88.top']) {
    const response = await worker.fetch(new Request(`https://${host}${path}`), env, {});
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('location'), null);
    assert.equal(await response.text(), token);
  }
});

test('verification supports HEAD, rejects writes and leaves other static URLs unchanged', async () => {
  const head = await worker.fetch(new Request(`https://www.petcloud88.top${path}`, { method: 'HEAD' }), env, {});
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  const post = await worker.fetch(new Request(`https://petcloud88.top${path}`, { method: 'POST' }), env, {});
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('allow'), 'GET, HEAD');
  for (const url of ['/', '/cats/', '/admin/', `${path}extra`]) {
    const response = await worker.fetch(new Request(`https://petcloud88.top${url}`), {
      ASSETS: { fetch: request => new Response(new URL(request.url).pathname) },
    }, {});
    assert.equal(await response.text(), url);
  }
});
