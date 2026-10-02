import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestDelete, onRequestGet } from '../cloud-functions/api/assistant/history.js';
import { sessionCookie } from '../cloud-functions/_lib/assistant-auth.js';
import { usageFor } from '../cloud-functions/_lib/assistant-store.js';
test('delete is authenticated, seller-scoped, persistent and preserves quota', async () => {
  const env = { ASSISTANT_SESSION_SECRET: 'x'.repeat(40), FEISHU_APP_ID: 'history-test', FEISHU_APP_SECRET: 'test', FEISHU_APP_TOKEN: 'test', FEISHU_TABLE_ID: 'cats', FEISHU_AI_LOG_TABLE_ID: 'logs', FEISHU_SALES_TABLE_ID: 'sales' };
  const rows = ['S1','S2'].map((id,i) => ({ record_id:`rec${i}`, fields:{'销售ID':id,'对话ID':'chat_12345678','客户问题':'客户问题','建议回复':'建议回复','时间':new Date().toISOString(),'月份':new Date().toISOString().slice(0,7)} }));
  const original = global.fetch;
  global.fetch = async (url, options = {}) => {
    let data;
    if (String(url).includes('/auth/')) return Response.json({code:0,tenant_access_token:'test',expire:7200});
    if(options.method === 'PUT') { const row = rows.find(r => String(url).endsWith(r.record_id)); Object.assign(row.fields, JSON.parse(options.body).fields); data={record:row}; }
    else data = {items:rows,has_more:false};
    return Response.json({code:0,data});
  };
  try {
    const request = (authenticated=true) => new Request('https://test/api/assistant/history', {method:'DELETE',headers:authenticated?{cookie:sessionCookie(env,{salesId:'S1',recordId:'seller1'}).split(';')[0]}:{},body:JSON.stringify({conversationId:'chat_12345678'})});
    assert.equal((await onRequestDelete({env,request:request(false)})).status,401);
    assert.equal(await usageFor(env,'S1'),1);
    assert.equal((await onRequestDelete({env,request:request()})).status,200);
    assert.equal(rows[0].fields['客户问题'],'');
    assert.equal(rows[1].fields['客户问题'],'客户问题');
    assert.equal(await usageFor(env,'S1'),1);
    assert.equal((await (await onRequestGet({env,request:request()})).json()).data.length,0);
    assert.equal((await onRequestDelete({env,request:request()})).status,200);
  } finally { global.fetch=original; }
});
