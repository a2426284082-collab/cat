// Local Cloudflare/workerd D1 integration, not a network or live-account test.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { activate, cookie, finish, newKey, reserve, resolveSession } from '../cloud-functions/_lib/sales-store.js';
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("local D1 test")}}',compatibilityDate:'2026-10-15',d1Databases:{SALES_DB:'local-sales-test'}}));
try{
  const db=await mf.getD1Database('SALES_DB');
  const schema=readFileSync(new URL('../migrations/0001_sales_ai.sql',import.meta.url),'utf8');
  for(const sql of schema.split(';').map(x=>x.trim()).filter(Boolean))await db.prepare(sql).run();
  const key=await newKey(db,'本地 D1 集成验证',20),device=crypto.randomUUID(),login=await activate(db,key.key_code,device);
  const row=await resolveSession(db,new Request('https://test',{headers:{Cookie:cookie(login.token)}}),device);
  const results=await Promise.allSettled(Array.from({length:8},()=>reserve(db,row,'script','编号 #A01，客户想看猫')));
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  const won=results.find(x=>x.status==='fulfilled').value;
  await finish(db,won,{status:'success',reply_text:'#A01 可以先看视频',matched_ids:['#A01']});
  assert.equal((await db.prepare('SELECT used_today FROM sales_keys').first()).used_today,1);
  assert.equal((await db.prepare('SELECT used FROM ai_daily_usage').first()).used,1);
  const devs=await Promise.allSettled([activate(db,key.key_code,crypto.randomUUID()),activate(db,key.key_code,crypto.randomUUID())]);
  assert.equal(devs.filter(x=>x.status==='fulfilled').length,1);
  console.log('PASS: actual local Cloudflare D1 migration, activation, two-device cap, atomic quota reservation and audit completion');
}finally{await mf.dispose();}
