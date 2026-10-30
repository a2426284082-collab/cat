import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet as list} from '../cloud-functions/api/public-cats.js';
import {onRequestGet as image} from '../cloud-functions/api/public-images/[token].js';

const env={FEISHU_APP_ID:'fastpath-id',FEISHU_APP_SECRET:'fastpath-secret-private',FEISHU_APP_TOKEN:'fastpath-app',FEISHU_TABLE_ID:'fastpath-table'};

test('public edge snapshot skips a duplicate Feishu scan, manual refresh bypasses it and keeps agent fields out',async()=>{
 const saved={fetch:globalThis.fetch,caches:globalThis.caches},cacheMap=new Map();let reads=0;
 globalThis.caches={default:{
  async match(key){const row=cacheMap.get(key.url);return row?new Response(row.body,{headers:row.headers}):undefined;},
  async put(key,value){cacheMap.set(key.url,{body:await value.text(),headers:Object.fromEntries(value.headers)});},
 }};
 globalThis.fetch=async url=>{
  if(String(url).includes('tenant_access_token'))return Response.json({code:0,tenant_access_token:'fastpath-token',expire:7200});
  if(String(url).includes('/records')){reads++;return Response.json({code:0,data:{has_more:false,items:[{fields:{'猫咪ID':'F'+reads,'状态':'在售','品种':'布偶','价格':1599,'描述':'内部价格不可公开','图片':[{file_token:'imgfast'}]}}]}});}
  if(String(url).includes('/medias/imgfast/'))return new Response(Uint8Array.from([255,216,255]),{headers:{'Content-Type':'image/jpeg'}});
  throw Error('unexpected fetch');
 };
 const request=new Request('https://cats.example/api/public-cats');
 try{
  const first=await list({env,request});assert.equal(first.status,200);assert.equal(reads,1);
  const second=await list({env,request});assert.equal(second.status,200);assert.equal(reads,1);
  assert.equal((await second.json()).data[0].id,'F1');
  const stored=[...cacheMap.values()].map(x=>x.body).join('');
  assert.doesNotMatch(stored,/内部价格不可公开|1599|fastpath-secret-private/);
  assert.ok([...cacheMap.keys()].every(k=>!k.includes(env.FEISHU_APP_SECRET)));
  const forbidden=await image({env,params:{token:'not-in-stock'},request:new Request('https://cats.example/api/public-images/not-in-stock')});
  assert.equal(forbidden.status,404);
  const photo=await image({env,params:{token:'imgfast'},request:new Request('https://cats.example/api/public-images/imgfast')});
  assert.equal(photo.status,200);
  const fresh=await list({env,request:new Request('https://cats.example/api/public-cats?fresh=1')});
  assert.equal(fresh.status,200);assert.equal(reads,2);assert.equal((await fresh.json()).data[0].id,'F2');
 }finally{globalThis.fetch=saved.fetch;globalThis.caches=saved.caches;}
});

test('a transient 429 during a read is retried once without retrying unsafe writes',async()=>{
 const saved=globalThis.fetch;let reads=0;
 const scope={...env,FEISHU_APP_ID:'retry-isolated'};
 globalThis.fetch=async url=>{
  if(String(url).includes('tenant_access_token'))return Response.json({code:0,tenant_access_token:'retry-token',expire:7200});
  if(String(url).includes('/records'))return ++reads===1?new Response(null,{status:429}):Response.json({code:0,data:{items:[],has_more:false}});
  throw Error('unexpected upstream');
 };
 try{const result=await list({env:scope});assert.equal(result.status,200);assert.equal(reads,2);}finally{globalThis.fetch=saved;}
});
