import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import {makeDB} from './sales-db.mjs';
import {newKey,activate,cookie} from '../cloud-functions/_lib/sales-store.js';
import worker from '../cloudflare-worker.js';

const origin='https://actual.example';
async function waitFor(condition){for(let i=0;i<200;i++){if(condition())return;await new Promise(r=>setTimeout(r,10));}throw new Error('Timed out waiting for UI');}
async function bundle(file){return (await build({entryPoints:[new URL('../src/forward/'+file,import.meta.url).pathname],bundle:true,write:false,platform:'browser',format:'iife',loader:{'.css':'empty'}})).outputFiles[0].text;}
test('real agent page → D1 profile and quote → anonymous customer page → revoke, without AI calls',async t=>{
 const db=makeDB();db.sql.exec(readFileSync(new URL('../migrations/0004_sales_proposals.sql',import.meta.url),'utf8'));const key=await newKey(db,'林小满',1),device=crypto.randomUUID(),login=await activate(db,key.key_code,device);
 db.sql.exec('UPDATE ai_settings SET enabled=0;UPDATE sales_keys SET used_today=daily_limit,last_call_timestamp=9999999999');
 const env={SALES_DB:db,FEISHU_APP_ID:crypto.randomUUID(),FEISHU_APP_SECRET:'secret',FEISHU_APP_TOKEN:'base',FEISHU_TABLE_ID:'table'},old=globalThis.fetch;let models=0;
 globalThis.fetch=async url=>{if(String(url).includes('deepseek')){models++;throw new Error('Unexpected model');}if(String(url).includes('tenant_access_token'))return Response.json({code:0,tenant_access_token:'token',expire:7200});if(String(url).includes('/records'))return Response.json({code:0,data:{has_more:false,items:[{fields:{'猫咪ID':'U1','状态':'在售','品种':'布偶','价格':1200,'性别':'母','年龄':3,'疫苗':'两针','图片':[{file_token:'photo_1'}]}},{fields:{'猫咪ID':'U2','状态':'在售','品种':'英短','价格':900}}]}});throw new Error('Unexpected upstream');};
 const windows=[];t.after(()=>{windows.forEach(w=>w.close());db.close();globalThis.fetch=old;});
 function page(path,agent=false){const dom=new JSDOM(agent?'<div id="forward-app"></div><div id="forward-toast"></div><dialog id="forward-modal"></dialog>':'<main id="proposal-app"></main><dialog id="contact-modal"></dialog><div id="proposal-toast"></div>',{url:origin+path,runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window;windows.push(w);if(agent)w.localStorage.setItem('sales-device-id',device);w.scrollTo=()=>{};w.crypto.randomUUID=()=>crypto.randomUUID();w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};w.fetch=async(path,options={})=>worker.fetch(new Request(origin+path,{method:options.method||'GET',headers:{Origin:origin,...options.headers,'CF-Connecting-IP':'192.0.2.45',...(agent?{Cookie:cookie(login.token).split(';')[0]}:{})},...(options.body?{body:options.body}:{})}),env,{waitUntil(){}});return w;}
 const a=page('/forward/',true);a.eval(await bundle('agent.js'));await waitFor(()=>a.document.querySelector('[data-action="pick"]'));
 a.document.querySelector('[data-action="pick"][data-id="U1"]').click();a.document.querySelector('[data-action="pick"][data-id="U2"]').click();a.document.querySelector('[data-action="configure"]').click();
 const form=a.document.querySelector('#proposal-form');form.elements.customer.value='李女士';form.elements.brand.value='小满选猫';form.elements.wechat.value='wx-agent';form.elements['price-U1'].value='1800';form.dispatchEvent(new a.Event('submit',{bubbles:true,cancelable:true}));
 await waitFor(()=>a.document.querySelector('.share-url'));const url=new URL(a.document.querySelector('.share-url').value);assert.match(url.pathname,/^\/p\/[A-Za-z0-9_-]{24}$/);assert.equal((await db.prepare('SELECT count(*) AS n FROM sales_proposals').first()).n,1);assert.equal((await db.prepare('SELECT wechat FROM sales_agent_profiles').first()).wechat,'wx-agent');
 const c=page(url.pathname);c.eval(await bundle('customer.js'));await waitFor(()=>c.document.querySelectorAll('.proposal-cat').length===2);assert.ok(c.document.querySelector('h1').textContent.includes('李女士'));assert.ok(c.document.querySelector('.stock-available'));assert.doesNotMatch(c.document.querySelector('#proposal-app').textContent,/1200|供货|预计价差/);
 c.document.querySelector('[data-action="contact"]').click();assert.ok(c.document.querySelector('#contact-modal').open);assert.ok(c.document.querySelector('.wechat-copy').textContent.includes('wx-agent'));
 a.document.querySelector('[data-action="history"]').click();await waitFor(()=>a.document.querySelector('[data-action="revoke"]'));a.document.querySelector('[data-action="revoke"]').click();a.document.querySelector('[data-action="confirm-revoke"]').click();await waitFor(()=>a.document.querySelector('[data-action="revoke"]')?.disabled);
 c.dispatchEvent(new c.Event('focus'));await waitFor(()=>c.document.querySelector('.error-page'));assert.equal(c.document.querySelector('#contact-modal').open,false);assert.ok(c.document.querySelector('.error-page').textContent.includes('撤回'));assert.equal(models,0);assert.equal((await db.prepare('SELECT used_today FROM sales_keys WHERE id=?').bind(key.id).first()).used_today,1);
});
