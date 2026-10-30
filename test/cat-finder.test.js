import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cloudflare-worker.js';
import {makeDB} from './sales-db.mjs';
import {activate,cookie,newKey} from '../cloud-functions/_lib/sales-store.js';
import {executeCatOnly} from '../cloud-functions/_lib/cat-only-agent.js';

const origin='https://finder.example';
async function fixture(t,{guest=false,plan={action:'search',matched_ids:['FABRICATED'],price:1}}={}) {
  const db=makeDB(),device=crypto.randomUUID();
  const env={SALES_DB:db,DEEPSEEK_API_KEY:'fixture-only',FEISHU_APP_ID:crypto.randomUUID(),FEISHU_APP_SECRET:'fixture',FEISHU_APP_TOKEN:'fixture',FEISHU_TABLE_ID:'fixture'};
  let session,models=0;
  if(guest){
    const res=await worker.fetch(new Request(origin+'/api/ai/guest',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({device_id:device})}),env,{waitUntil(){}});
    assert.equal(res.status,200);session=res.headers.get('set-cookie').split(';')[0];
  }else{
    const key=await newKey(db,'找猫回归',20),login=await activate(db,key.key_code,device);session=cookie(login.token).split(';')[0];
  }
  const prior=globalThis.fetch;
  globalThis.fetch=async url=>{
    if(String(url).includes('tenant_access_token'))return Response.json({code:0,tenant_access_token:'fixture',expire:7200});
    if(String(url).includes('/records'))return Response.json({code:0,data:{has_more:false,items:[600,800].map((price,i)=>({fields:{'猫咪ID':'F'+i,'品种':'布偶猫','性别':'母','年龄':3,'价格':price,'状态':'在售'}}))}});
    if(String(url).includes('api.deepseek.com')){models++;return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(plan)}}]});}
    throw new Error('Unexpected upstream');
  };
  t.after(()=>{globalThis.fetch=prior;db.close();});
  const ask=body=>worker.fetch(new Request(origin+'/api/ai/ask',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:session,'CF-Connecting-IP':'192.0.2.51'},body:JSON.stringify({device_id:device,mode:'match',action:'cat_only',...body})}),env,{waitUntil(){}});
  return {db,env,ask,models:()=>models};
}

test('current finder filters by customer price and ignores inventory facts invented by the intent model',async t=>{
  const f=await fixture(t);
  const res=await f.ask({prompt:'找两只1500元以内的布偶母猫',cat_context:{markup:800}});
  assert.equal(res.status,200);const body=await res.json();
  assert.deepEqual(body.data.matched_ids,['#F0']);assert.match(body.data.reply_text,/1400/);
  assert.doesNotMatch(body.data.reply_text,/FABRICATED/);assert.equal(body.user.used_today,1);assert.equal(f.models(),1);
  assert.equal((await f.ask({prompt:'再找一只布偶猫'})).status,429);assert.equal(f.models(),1);
});

test('free guest cannot forge markup or expose internal prices or invoke marketing copy',async t=>{
  const f=await fixture(t,{guest:true});
  const res=await f.ask({prompt:'找两只1500元以内的布偶母猫',hide_prices:false,cat_context:{markup:99999}});
  assert.equal(res.status,200);const body=await res.json();
  assert.equal(body.data.matched_ids.length,2);assert.match(body.data.reply_text,/价格已隐藏/);
  assert.doesNotMatch(body.data.reply_text,/¥|600|800|99999/);
  const blocked=await f.ask({mode:'script',action:'marketing',cat_ids:['F0','F1']});
  assert.equal(blocked.status,403);assert.equal(f.models(),1);
});

test('free-form artwork requests are understood by AI and do not execute any artwork tool',async t=>{
  const f=await fixture(t,{plan:{action:'unsupported',reply:'这里可以帮你选猫和查合作资料；做图请使用旁边的手动工具。'}}),res=await f.ask({prompt:'帮我生成图片和朋友圈文案'});
  assert.equal(res.status,200);const body=await res.json();assert.equal(body.data.used_ai,true);
  assert.match(body.data.reply_text,/手动工具/);assert.equal(body.user.used_today,1);assert.equal(f.models(),1);
});

test('replacing only the second cat preserves other slots and excludes the replaced cat',()=>{
  const catalog=[600,900,500,1000].map((price,i)=>({id:'R'+i,breed:'布偶猫',gender:'母',age:3,price,status:'在售'}));
  const result=executeCatOnly({prompt:'只换第二只，找更便宜的替代猫',catalog,context:{cat_ids:['R0','R1','R3'],need:'找三只2000元以内的布偶母猫',markup:800}});
  assert.deepEqual(result.cat_context.cat_ids,['R0','R2','R3']);assert.ok(result.cat_context.excluded_ids.includes('R1'));
});
