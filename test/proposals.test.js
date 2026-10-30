import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../cloudflare-worker.js';
import {makeDB} from './sales-db.mjs';
import {newKey,activate,cookie,openGuest,nowSeconds} from '../cloud-functions/_lib/sales-store.js';
import {ensureControlTables} from '../cloud-functions/_lib/workbench-control.js';

const origin='https://cats.example',qr='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aPuoAAAAASUVORK5CYII=';
const day=(plus=7)=>new Date(Date.now()+8*3600e3+plus*86400e3).toISOString().slice(0,10);
async function fixture(t){
 const db=makeDB();db.sql.exec(readFileSync(new URL('../migrations/0004_sales_proposals.sql',import.meta.url),'utf8'));await ensureControlTables(db);
 const first=await newKey(db,'代理甲',1),second=await newKey(db,'代理乙',1),a=await activate(db,first.key_code,crypto.randomUUID()),b=await activate(db,second.key_code,crypto.randomUUID()),guest=await openGuest(db,crypto.randomUUID());
 const env={SALES_DB:db,FEISHU_APP_ID:crypto.randomUUID(),FEISHU_APP_SECRET:'secret',FEISHU_APP_TOKEN:'base',FEISHU_TABLE_ID:'table'};
 let unavailable=false,rows=[{fields:{'猫咪ID':'A1','状态':'在售','品种':'布偶','性别':'母','年龄':3,'价格':1200,'描述':'内部供货1200不得外传','疫苗':'两针','图片':[{file_token:'photo_a'}],'视频':[{file_token:'video_a',name:'内部底价1200.mp4'}]}},{fields:{'猫咪ID':'A2','状态':'在售','品种':'英短','价格':900,'图片':[{file_token:'photo_b'}]}}];
 const oldFetch=globalThis.fetch;let models=0,reads=0;
 globalThis.fetch=async url=>{if(String(url).includes('deepseek')){models++;throw new Error('Must not call model');}if(String(url).includes('tenant_access_token'))return Response.json({code:0,tenant_access_token:'token',expire:7200});if(String(url).includes('/records')){reads++;if(unavailable)throw new Error('Upstream failure with secret');return Response.json({code:0,data:{items:rows,has_more:false}});}throw new Error('Unexpected upstream');};
 t.after(()=>{globalThis.fetch=oldFetch;db.close();});
 const run=(path,{method='GET',body,auth=a,headers={}}={})=>worker.fetch(new Request(origin+path,{method,headers:{'CF-Connecting-IP':'192.0.2.77',...(body?{Origin:origin,'Content-Type':'application/json'}:{}),...(auth?{Cookie:cookie(auth.token).split(';')[0]}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})}),env,{waitUntil(){}});
 const save=async(auth=a,extra={})=>{const res=await run('/api/agent/profile',{method:'PUT',auth,body:{name:auth===a?'小满':'小李',brand:'选猫工作室',wechat:'demo-agent',default_markup:600,...extra}});assert.equal(res.status,200,await res.clone().text());return (await res.json()).data;};
 const input=()=>({customer_name:'李女士',note:'客户可见的话',expires:day(),items:[{id:'A1',price:1800},{id:'A2',price:1500}],request_key:crypto.randomUUID()});
 const create=async(body=input(),auth=a)=>{const res=await run('/api/agent/proposals',{method:'POST',body,auth});assert.equal(res.status,201,await res.clone().text());return (await res.json()).data;};
 return {db,env,a,b,guest,run,save,input,create,first,rows,models:()=>models,reads:()=>reads,setDown:v=>{unavailable=v;}};
}

test('activated agents create real random links without AI quota/cooldown and customers read a strict price snapshot',async t=>{
 const f=await fixture(t);await f.save();f.db.sql.exec('UPDATE ai_settings SET enabled=0;UPDATE sales_keys SET used_today=daily_limit,last_call_timestamp=9999999999');
 const before=(await f.db.prepare('SELECT id,used_today,last_call_timestamp FROM sales_keys ORDER BY id').all()).results;
 const quote=await f.create({...f.input(),owner_id:999,base:1,wechat:'forged',items:[{id:'A1',price:1800,base:1},{id:'A2',price:1500}]});assert.match(quote.url,/^\/p\/[A-Za-z0-9_-]{24}$/);
 const res=await f.run('/api/proposals/'+quote.id,{auth:null});assert.equal(res.status,200);assert.match(res.headers.get('cache-control'),/no-store/);const data=(await res.json()).data;
 assert.equal(data.advisor.wechat,'demo-agent');assert.equal(data.cats[0].price,1800);assert.equal(data.cats[0].stock,'available');assert.ok(data.inventory_checked_at);
 const text=JSON.stringify(data);assert.doesNotMatch(text,/1200|内部|forged|owner_id|request_key|costPrice|default_markup|进货/);assert.deepEqual(data.cats[0].videos,[{url:'/api/public-videos/video_a'}]);
 f.rows[0].fields['价格']=9900;const later=(await(await f.run('/api/proposals/'+quote.id,{auth:null})).json()).data;assert.equal(later.cats[0].price,1800);assert.doesNotMatch(JSON.stringify(later),/9900/);
 assert.deepEqual((await f.db.prepare('SELECT id,used_today,last_call_timestamp FROM sales_keys ORDER BY id').all()).results,before);assert.equal(f.models(),0);
});
test('anonymous catalog never returns partner prices, descriptions, or attachment filenames; agent catalog requires activated identity',async t=>{
 const f=await fixture(t);const publicData=await(await f.run('/api/public-cats',{auth:null})).json();assert.doesNotMatch(JSON.stringify(publicData),/1200|900|内部|price|description|name/);
 assert.equal((await f.run('/api/agent/catalog',{auth:null})).status,401);assert.equal((await f.run('/api/agent/catalog',{auth:f.guest})).status,403);
 const agentData=await(await f.run('/api/agent/catalog')).json();assert.equal(agentData.data[0].price,1200);
});
test('guests cannot create or save profiles; cross-origin mutations and foreign revocation are refused',async t=>{
 const f=await fixture(t);await f.save();
 assert.equal((await f.run('/api/agent/proposals',{method:'POST',auth:f.guest,body:f.input()})).status,403);
 assert.equal((await f.run('/api/agent/profile',{method:'PUT',auth:f.guest,body:{}})).status,403);
 assert.equal((await f.run('/api/agent/proposals',{method:'POST',body:f.input(),headers:{Origin:'https://other.example'}})).status,403);
 const quote=await f.create();assert.equal((await f.run(`/api/agent/proposals/${quote.id}/revoke`,{method:'POST',auth:f.b,body:{}})).status,404);
 assert.deepEqual((await(await f.run('/api/agent/proposals',{auth:f.b})).json()).data,[]);
 assert.equal((await f.run('/api/proposals/'+quote.id,{auth:null})).status,200);
 assert.equal((await f.run(`/api/agent/proposals/${quote.id}/revoke`,{method:'POST',body:{}})).status,200);
 assert.equal((await f.run('/api/proposals/'+quote.id,{auth:null})).status,410);
});
test('QR keeps original bytes, old proposals keep the original advisor snapshot, revoke and expiry also block QR access',async t=>{
 const f=await fixture(t);const profile=await f.save(f.a,{qr_data:qr});assert.ok(profile.qr_url);const quote=await f.create();
 const data=(await(await f.run('/api/proposals/'+quote.id,{auth:null})).json()).data;const image=await f.run(data.advisor.qr_url,{auth:null});assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/png');assert.deepEqual(new Uint8Array(await image.arrayBuffer()),Uint8Array.from(atob(qr.split(',')[1]),c=>c.charCodeAt(0)));
 await f.save(f.a,{name:'新称呼',wechat:'new-id',qr_data:null});const old=(await(await f.run('/api/proposals/'+quote.id,{auth:null})).json()).data;assert.equal(old.advisor.wechat,'demo-agent');assert.equal(old.advisor.name,'小满');assert.equal((await f.run(data.advisor.qr_url,{auth:null})).status,200);
 assert.equal((await f.run(profile.qr_url,{auth:f.b})).status,404);
 f.db.sql.exec(`UPDATE sales_proposals SET expires_at=${nowSeconds()-1}`);assert.equal((await f.run(data.advisor.qr_url,{auth:null})).status,410);
});
test('fresh stock rejects a sold cat at creation; later stock is live, failed stock checks are explicit unknown',async t=>{
 const f=await fixture(t);await f.save();const quote=await f.create();f.rows[0].fields['状态']='已售';
 const sold=(await(await f.run('/api/proposals/'+quote.id,{auth:null})).json()).data;assert.equal(sold.cats[0].stock,'unavailable');assert.equal(sold.cats[0].price,1800);
 assert.equal((await f.run('/api/agent/proposals',{method:'POST',body:f.input()})).status,409);
 f.setDown(true);const unknown=(await(await f.run('/api/proposals/'+quote.id,{auth:null})).json()).data;assert.equal(unknown.cats[0].stock,'unknown');assert.equal(unknown.inventory_checked_at,null);
 assert.equal((await f.run('/api/agent/proposals',{method:'POST',body:f.input()})).status,503);
});
test('a changed upstream partner price requires reconfirmation and revocation during a stock read wins',async t=>{
 const f=await fixture(t);await f.save();const checked={...f.input(),items:[{id:'A1',price:1800,expected_base:1100}]};assert.equal((await f.run('/api/agent/proposals',{method:'POST',body:checked})).status,409);
 const quote=await f.create();const fetch=globalThis.fetch;globalThis.fetch=async(url,options)=>{if(String(url).includes('/records'))await f.db.prepare('UPDATE sales_proposals SET revoked_at=? WHERE id=?').bind(nowSeconds(),quote.id).run();return fetch(url,options);};
 assert.equal((await f.run('/api/proposals/'+quote.id,{auth:null})).status,410);
});
test('idempotent concurrent submission stores one quote, changed retry body fails and disabled agents invalidate public links',async t=>{
 const f=await fixture(t);await f.save();const body=f.input();const quotes=await Promise.all([f.create(body),f.create(body)]);assert.equal(quotes[0].id,quotes[1].id);assert.equal((await f.db.prepare('SELECT count(*) AS n FROM sales_proposals').first()).n,1);
 assert.equal((await f.run('/api/agent/proposals',{method:'POST',body:{...body,customer_name:'新客户'}})).status,409);
 f.db.sql.exec(`UPDATE sales_keys SET status=0 WHERE id=${f.first.id}`);assert.equal((await f.run('/api/proposals/'+quotes[0].id,{auth:null})).status,404);assert.equal((await f.run('/api/agent/proposals')).status,401);
});
test('invalid money, duplicate cats, bad dates and forged QR are rejected; HEAD never returns a response body',async t=>{
 const f=await fixture(t);await f.save();for(const patch of [{items:[{id:'A1',price:-1}]},{items:[{id:'A1',price:1},{id:'A1',price:2}]},{expires:'2026-99-99'},{items:[{id:'A1',price:1.001}]}])assert.equal((await f.run('/api/agent/proposals',{method:'POST',body:{...f.input(),...patch}})).status,400);
 assert.equal((await f.run('/api/agent/profile',{method:'PUT',body:{name:'甲',brand:'乙',wechat:'wx',qr_data:'data:image/png;base64,'+btoa('<svg>fake</svg>')}})).status,400);
 const quote=await f.create();const response=await f.run('/api/proposals/'+quote.id,{method:'HEAD',auth:null});assert.equal(response.status,200);assert.equal(await response.text(),'');
});
test('short path is served by the standalone customer entry and never redirects to the workbench',async t=>{
 const f=await fixture(t);let requested;f.env.ASSETS={fetch:async request=>{requested=new URL(request.url).pathname;return new Response('<html>customer page</html>',{headers:{'Content-Type':'text/html'}});}};
 const res=await f.run('/p/abcdefghijklmnopqrstuvwx',{auth:null});assert.equal(res.status,200);assert.equal(requested,'/p/');assert.equal(res.headers.get('referrer-policy'),'no-referrer');assert.equal(res.headers.get('cache-control'),'no-store');
});
