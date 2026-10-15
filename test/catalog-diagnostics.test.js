import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { onRequestGet } from '../cloud-functions/api/public-cats.js';

let serial = 0;
const secret = 'must-not-leak-anywhere';
const environment = () => ({ FEISHU_APP_ID: `diagnostics-${++serial}`, FEISHU_APP_SECRET: secret, FEISHU_APP_TOKEN: 'sensitive-base-id', FEISHU_TABLE_ID: 'sensitive-table-id' });
async function scenario(env, fetch) {
  const savedFetch = globalThis.fetch, savedWarn = console.warn;
  const warnings = [];
  globalThis.fetch = fetch;
  console.warn = (...parts) => warnings.push(parts.join(' '));
  try {
    const response = await onRequestGet({ env });
    const body = await response.json();
    assert.doesNotMatch(JSON.stringify({ body, warnings }), /must-not-leak-anywhere|sensitive-base-id|sensitive-table-id|Bearer|open\.feishu/);
    return { response, body, warnings };
  } finally { globalThis.fetch = savedFetch; console.warn = savedWarn; }
}
const authSuccess = () => Response.json({ code: 0, tenant_access_token: secret, expire: 7200 });

test('missing runtime variables are reported by name without contacting Feishu or disclosing values', async () => {
  const result = await scenario({ FEISHU_APP_ID: 'configured', FEISHU_APP_SECRET: secret }, () => { throw new Error('unexpected fetch'); });
  assert.equal(result.response.status, 502);
  assert.equal(result.body.code, 'CONFIG_MISSING');
  assert.deepEqual(result.body.missing, ['FEISHU_APP_TOKEN', 'FEISHU_TABLE_ID']);
  assert.equal(result.warnings.length, 1);
  assert.equal(result.response.headers.get('cache-control'), 'no-store');
});

test('Feishu API rejection identifies auth stage and numeric code but drops upstream message', async () => {
  const result = await scenario(environment(), () => Response.json({ code: 10003, msg: secret }));
  assert.equal(result.body.code, 'FEISHU_API_ERROR');
  assert.equal(result.body.stage, 'auth');
  assert.equal(result.body.feishuCode, 10003);
});

test('record permission or rate failure identifies records stage and upstream HTTP status', async () => {
  const result = await scenario(environment(), url => String(url).includes('/auth/') ? authSuccess() : new Response(secret, { status: 429 }));
  assert.equal(result.body.code, 'FEISHU_HTTP_ERROR');
  assert.equal(result.body.stage, 'records');
  assert.equal(result.body.upstreamStatus, 429);
});

test('network timeout and transport failures have distinct safe diagnostics', async () => {
  for (const [name, code] of [['TimeoutError', 'FEISHU_TIMEOUT'], ['Error', 'FEISHU_NETWORK_ERROR']]) {
    const result = await scenario(environment(), () => { throw Object.assign(new Error(secret), { name }); });
    assert.equal(result.body.code, code);
    assert.equal(result.body.stage, 'auth');
  }
});

test('unexpected upstream content is handled without returning HTML or internal text', async () => {
  const result = await scenario(environment(), () => new Response(`<html>${secret}</html>`));
  assert.equal(result.body.code, 'FEISHU_INVALID_RESPONSE');
});

test('successful catalogue loading does not request temporary media links', async () => {
  let calls = 0;
  const result = await scenario(environment(), url => {
    calls++;
    if (String(url).includes('/auth/')) return authSuccess();
    assert.match(String(url), /\/records/);
    return Response.json({ code: 0, data: { has_more: false, items: [{ fields: { '猫咪ID': 'VALID', '状态': '在售', '视频': [{ file_token: 'clip', name: '猫咪.mp4' }] } }] } });
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.success, true);
  assert.equal(result.body.data[0].id, 'VALID');
  assert.equal(calls, 2);
  assert.deepEqual(result.warnings, []);
});

test('Cloudflare deployments preserve variables entered in the dashboard and contain no secret values', () => {
  const configuration = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
  assert.equal(configuration.keep_vars, true);
  assert.equal(configuration.vars, undefined);
});
