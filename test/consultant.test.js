import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cloudflare-worker.js';
import {makeDB} from './sales-db.mjs';
import {newKey,activate,cookie,openGuest} from '../cloud-functions/_lib/sales-store.js';
import {handbookEntries} from '../cloud-functions/_lib/sales-handbook-data.js';
import {validateHandbookAnswer} from '../cloud-functions/_lib/consultant-model.js';

const origin='https://consultant.example';
const deal=handbookEntries.find(entry=>entry.id==='basic-deal');
const plan={action:'handbook',handbook_ids:[deal.id],handbook_question:'付款后如何核实库存和下单安排'};
const answer={reply:'先核对猫咪编号、库存和费用，再按手册的收款下单流程处理。具体这笔款项和发货状态，需要联系负责人核实。',citations:[{id:deal.id,quote:'销售自己向客户收款'}],needs_confirmation:true};

async function fixture(t,{guest=false,replies=[plan,answer],onModel}={}){
 const db=makeDB(),device=crypto.randomUUID();let login;
 if(guest)login=await openGuest(db,device);
 else login=await activate(db,(await newKey(db,'顾问AI测试',20)).key_code,device);
 const key=(await db.prepare('SELECT * FROM sales_keys').first()),env={SALES_DB:db,DEEPSEEK_API_KEY:'test-only',FEISHU_APP_ID:crypto.randomUUID(),FEISHU_APP_SECRET:'test',FEISHU_APP_TOKEN:'test',FEISHU_TABLE_ID:'test'};
 const original=globalThis.fetch,calls=[];let stockCalls=0;
 globalThis.fetch=async(url,options)=>{
  if(String(url).includes('api.deepseek.com')){
   const payload=JSON.parse(options.body);calls.push(payload);await onModel?.(calls.length,db);
   const reply=typeof replies[calls.length-1]==='function'?await replies[calls.length-1](payload):replies[calls.length-1];
   if(reply instanceof Response)return reply;
   return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(reply)}}],usage:{prompt_tokens:calls.length*100,completion_tokens:calls.length*20}});
  }
  if(String(url).includes('tenant_access_token')){stockCalls++;return Response.json({code:0,tenant_access_token:'test',expire:7200});}
  if(String(url).includes('/records')){stockCalls++;return Response.json({code:0,data:{has_more:false,items:[600,800].map((price,i)=>({fields:{'猫咪ID':'F'+i,'品种':'布偶猫','性别':'母','年龄':3,'价格':price,'状态':'在售'}}))}});}
  throw new Error('Unexpected upstream');
 };
 t.after(()=>{globalThis.fetch=original;db.close();});
 const ask=(prompt,extra={},auth=true)=>worker.fetch(new Request(origin+'/api/ai/ask',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.34',...(auth?{Cookie:cookie(login.token).split(';')[0]}:{})},body:JSON.stringify({mode:'match',action:'cat_only',device_id:device,prompt,...extra})}),env,{waitUntil(){}});
 return {db,key,env,calls,ask,stockCalls:()=>stockCalls};
}

for(const guest of [false,true])test(`${guest?'guest':'seller'} colloquial question always reaches AI, retrieves actual sections and gets an AI-written answer`,async t=>{
 const f=await fixture(t,{guest}),question='客人说钱已经给了，那边又没动静，我该咋接？';
 const response=await f.ask(question,{cat_context:{cat_ids:['STALE'],need:'之前看中的那只'},conversation:[{role:'user',text:'客人想订之前那只猫'},{role:'assistant',text:'请先确认库存。'}]});
 assert.equal(response.status,200);const body=await response.json();
 assert.equal(body.data.kind,'handbook');assert.equal(body.data.used_ai,true);assert.equal(body.data.model_calls,2);assert.equal(body.user.used_today,1);
 assert.equal(body.data.reply_text,answer.reply);assert.equal(body.data.sources[0].href,deal.href);assert.equal(f.stockCalls(),0);assert.equal(Object.hasOwn(body.data,'cat_context'),false);
 const first=JSON.parse(f.calls[0].messages[1].content),second=JSON.parse(f.calls[1].messages[1].content);
 assert.equal(first.request,question.normalize('NFKC'));assert.equal(first.recent_dialogue.length,2);assert.ok(first.handbook_index.some(row=>row.id===deal.id));
 assert.equal(second.handbook_sections[0].text,deal.text);assert.equal(second.understood_question,plan.handbook_question);assert.ok(f.calls.every(call=>call.response_format.type==='json_object'));
 const logs=await f.db.prepare('SELECT charged,input_tokens,output_tokens FROM ai_call_logs').all();assert.deepEqual(logs.results,[{charged:1,input_tokens:300,output_tokens:60}]);
});

test('mixed request selects real stock and answers the policy question in the same turn',async t=>{
 const request='找两只1500元以内的布偶，另外客人让我先垫钱该怎么办？';
 const f=await fixture(t,{replies:[{...plan,action:'mixed',inventory_action:'search',inventory_request:'找两只1500元以内的布偶'},answer]});
 const response=await f.ask(request,{cat_context:{markup:800}});assert.equal(response.status,200);const body=await response.json();
 assert.deepEqual(body.data.matched_ids,['#F0']);assert.match(body.data.reply_text,/1400/);assert.ok(body.data.reply_text.includes(answer.reply));assert.equal(body.data.model_calls,2);assert.equal(body.user.used_today,1);assert.ok(body.data.sources.length);assert.equal(body.data.cat_context.need,'找两只1500元以内的布偶');
});

test('AI can extract nonadjacent inventory clauses around a policy question without requiring a fixed user wording',async t=>{
 const f=await fixture(t,{replies:[{...plan,action:'mixed',inventory_action:'search',inventory_parts:['先挑两只布偶','预算1500元以内']},answer]});
 const response=await f.ask('先挑两只布偶。对了钱得先给谁啊？预算1500元以内。',{cat_context:{markup:800}});assert.equal(response.status,200);const body=await response.json();assert.deepEqual(body.data.matched_ids,['#F0']);assert.ok(body.data.reply_text.includes(answer.reply));assert.equal(body.data.model_calls,2);
});

test('a model-selected handbook question with no matching source still gets an honest AI clarification',async t=>{
 const f=await fixture(t,{replies:[{action:'handbook',handbook_ids:[],handbook_question:'未记录的特殊安排'},{reply:'当前资料没有写明这项安排，需要向负责人核实。你方便补充具体情况吗？',citations:[],needs_confirmation:true}]});
 const response=await f.ask('那种特殊情况也算吗？');assert.equal(response.status,200);const body=await response.json();assert.equal(body.data.needs_confirmation,true);assert.deepEqual(body.data.sources,[]);assert.equal(body.data.model_calls,2);
});

test('invalid model plans fail visibly without a keyword/template fallback or automatic retry',async t=>{
 const f=await fixture(t,{replies:[{action:'execute_shell'}]});const response=await f.ask('售后怎么处理？');assert.equal(response.status,502);const body=await response.json();assert.equal(body.success,false);assert.equal(body.user.used_today,1);assert.equal(f.calls.length,1);assert.equal(f.stockCalls(),0);
});

test('an AI capability reply cannot bypass source retrieval to make a policy promise',async t=>{
 const f=await fixture(t,{replies:[{action:'help',reply:'合作无需支付押金，保证可以退款。'}]});
 const response=await f.ask('我还不太放心，能解释一下吗？');assert.equal(response.status,502);assert.equal(f.calls.length,1);assert.equal(f.stockCalls(),0);
});

test('a typed conversational reset is model-interpreted rather than locally keyword-matched',async t=>{
 const f=await fixture(t,{replies:[{action:'reset',reply:'好的，已清空上一位客户的选猫条件。你可以告诉我这位客户的需求。'}]});
 const response=await f.ask('换个客户重新来吧',{cat_context:{cat_ids:['STALE'],need:'旧需求'}});assert.equal(response.status,200);const body=await response.json();assert.equal(body.data.used_ai,true);assert.equal(body.data.model_calls,1);assert.equal(body.data.reset_context,true);assert.deepEqual(body.data.cat_context.cat_ids,[]);assert.equal(f.stockCalls(),0);
});

test('fabricated citations and invented refund terms are rejected after the actual two model calls',async t=>{
 const f=await fixture(t,{replies:[plan,{reply:'付款后保证30天无条件退款。',citations:[{id:deal.id,quote:'销售自己向客户收款'}],needs_confirmation:false}]});
 const response=await f.ask('人家担心买完反悔怎么办？');assert.equal(response.status,502);assert.equal(f.calls.length,2);assert.equal((await response.json()).user.used_today,1);
 assert.throws(()=>validateHandbookAnswer({...answer,citations:[{id:deal.id,quote:'本单保证随时退钱'}]},[deal]),/原文/);
 assert.throws(()=>validateHandbookAnswer({...answer,citations:[{id:'FAKE',quote:'销售自己向客户收款'}]},[deal]),/原文/);
});

test('no quota, disabled AI and missing keys do not pretend to answer through static handbook matching',async t=>{
 const f=await fixture(t);f.db.sql.exec("UPDATE sales_keys SET used_today=daily_limit,last_call_date=date('now','+8 hours')");
 assert.equal((await f.ask('合作需要押金吗？')).status,429);assert.equal(f.calls.length,0);
 f.db.sql.exec('UPDATE sales_keys SET used_today=0;UPDATE ai_settings SET enabled=0');assert.equal((await f.ask('客人钱已经给了，该咋接？')).status,503);assert.equal(f.calls.length,0);
 f.db.sql.exec('UPDATE ai_settings SET enabled=1');delete f.env.DEEPSEEK_API_KEY;assert.equal((await f.ask('合作需要押金吗？')).status,503);assert.equal(f.calls.length,0);
});

test('revocation between understanding and grounded answering prevents the second model call',async t=>{
 const f=await fixture(t,{onModel:async(n,db)=>{if(n===1)await db.prepare('UPDATE sales_keys SET status=0').run();}});
 assert.equal((await f.ask('售后怎么处理？')).status,401);assert.equal(f.calls.length,1);assert.equal((await f.db.prepare('SELECT used_today FROM sales_keys').first()).used_today,1);
});

test('concurrent consultant submissions reserve one turn, even when that turn needs two model calls',async t=>{
 const f=await fixture(t,{onModel:async()=>new Promise(resolve=>setTimeout(resolve,8))});
 const results=await Promise.all([f.ask('客人说钱给了，我该咋接？'),f.ask('客人说钱给了，我该咋接？')]);assert.deepEqual(results.map(row=>row.status).sort(),[200,429]);assert.equal(f.calls.length,2);assert.equal((await f.db.prepare('SELECT used_today FROM sales_keys').first()).used_today,1);
});
