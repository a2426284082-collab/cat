// Actual local workerd/D1 adapter. No live Cloudflare account or Feishu writes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {newKey,activate,cookie} from '../cloud-functions/_lib/sales-store.js';
import {handleProposals} from '../cloud-functions/_lib/proposals-api.js';
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("proposal D1")}}',compatibilityDate:'2026-10-15',d1Databases:{SALES_DB:'proposal-local-check'}}));
const old=globalThis.fetch;
try{
 const db=await mf.getD1Database('SALES_DB');
 async function migrate(file){const text=readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8').replace(/^--.*$/gm,'');for(const sql of text.split(';').map(x=>x.trim()).filter(Boolean))await db.prepare(sql).run();}
 await migrate('0001_sales_ai.sql');await migrate('0004_sales_proposals.sql');await migrate('0004_sales_proposals.sql');
 const key=await newKey(db,'D1代理',1),device=crypto.randomUUID(),login=await activate(db,key.key_code,device),env={SALES_DB:db,FEISHU_APP_ID:crypto.randomUUID(),FEISHU_APP_SECRET:'test',FEISHU_APP_TOKEN:'test',FEISHU_TABLE_ID:'test'};
 globalThis.fetch=async(url,options)=>{if(String(url).includes('tenant_access_token'))return Response.json({code:0,tenant_access_token:'test',expire:7200});if(String(url).includes('open.feishu.cn'))return Response.json({code:0,data:{has_more:false,items:[{fields:{'猫咪ID':'D1-CAT','状态':'在售','价格':1200}}]}});return old(url,options);};
 const run=(path,method='GET',body,auth=true)=>handleProposals({env,request:new Request('https://d1.test'+path,{method,headers:{Origin:'https://d1.test','Content-Type':'application/json',...(auth?{Cookie:cookie(login.token)}:{})},...(body?{body:JSON.stringify(body)}:{})})});
 const qr='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aPuoAAAAASUVORK5CYII=';
 const saved=await run('/api/agent/profile','PUT',{name:'小满',brand:'D1工作室',wechat:'wx',default_markup:600,qr_data:qr,device_id:device});assert.equal(saved.status,200,await saved.clone().text());
 const body={customer_name:'李女士',note:'',expires:new Date(Date.now()+8*3600e3+7*86400e3).toISOString().slice(0,10),items:[{id:'D1-CAT',price:1800}],request_key:crypto.randomUUID(),device_id:device};
 const responses=await Promise.all([run('/api/agent/proposals','POST',body),run('/api/agent/proposals','POST',body)]);assert.ok(responses.every(r=>r.status===201));const first=(await responses[0].json()).data,second=(await responses[1].json()).data;assert.equal(first.id,second.id);
 const publicData=(await(await run('/api/proposals/'+first.id,'GET',null,false)).json()).data;assert.equal(publicData.cats[0].price,1800);
 const image=await run(publicData.advisor.qr_url,'GET',null,false);assert.equal(image.status,200);assert.equal(new Uint8Array(await image.arrayBuffer()).length,68);
 assert.equal((await db.prepare('SELECT count(*) AS n FROM sales_proposals').first()).n,1);assert.equal((await db.prepare('SELECT used_today FROM sales_keys WHERE id=?').bind(key.id).first()).used_today,0);
 await run(`/api/agent/proposals/${first.id}/revoke`,'POST',{device_id:device});assert.equal((await run('/api/proposals/'+first.id,'GET',null,false)).status,410);
 console.log('PASS: actual local D1 additive migration, original QR BLOB, atomic idempotent quote creation, public retail-only read, quota independence and revocation');
}finally{globalThis.fetch=old;await mf.dispose();}
