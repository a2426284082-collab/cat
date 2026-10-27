// Test fixture only. Never deploy this file or reuse its sample credentials.
import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { pbkdf2Sync } from 'node:crypto';
import worker from '../../cloudflare-worker.js';
import { makeDB } from '../sales-db.mjs';
import { digest } from '../../cloud-functions/_lib/sales-store.js';
const db=makeDB();
db.sql.prepare('INSERT INTO sales_keys(key_hash,key_hint,sales_name,daily_limit,created_at) VALUES(?,?,?,?,?)').run(digest('A1B2C3D4E5F60718'),'••••-0718','测试销售',20,Math.floor(Date.now()/1000));
const salt=Buffer.from('playwright-sample-salt');
const env={SALES_DB:db,ADMIN_USERNAME:'qa-admin',ADMIN_PASSWORD_HASH:`120000.${salt.toString('base64url')}.${pbkdf2Sync('sample-admin-password',salt,120000,32,'sha256').toString('base64url')}`,ADMIN_SESSION_SECRET:'playwright-only-session-secret-not-for-production',FEISHU_APP_ID:'ui-sample',FEISHU_APP_SECRET:'ui-sample',FEISHU_APP_TOKEN:'ui-sample',FEISHU_TABLE_ID:'ui-sample',DEEPSEEK_API_KEY:'mock-only'};
globalThis.fetch=async(url,options)=>{
  if(String(url).includes('tenant_access_token'))return Response.json({code:0,tenant_access_token:'ui-sample',expire:7200});
  if(String(url).includes('/records'))return Response.json({code:0,data:{has_more:false,items:[
    {fields:{'猫咪ID':'A01','品种':'布偶猫','毛色/花色':'蓝双','性别':'母','年龄':3,'价格':2600,'描述':'圆脸、亲人，喜欢互动','状态':'在售'}},
    {fields:{'猫咪ID':'B02','品种':'英短','毛色/花色':'金渐层','性别':'公','年龄':4,'价格':2200,'描述':'安静、圆脸','状态':'在售'}},
  ]}});
  if(String(url)==='https://api.deepseek.com/chat/completions'){
    const payload=JSON.parse(options.body);
    if(payload.messages.length!==2||payload.thinking?.type!=='disabled')throw new Error('Unsafe model payload');
    return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({matched_ids:['#A01'],reply_text:'#A01 布偶妹妹，圆脸、亲人，2600元。喜欢互动的客户可以先看看它的视频，我再帮你确认具体情况。'})}}],usage:{prompt_tokens:200,completion_tokens:85}});
  }
  throw new Error('Unexpected upstream in UI fixture');
};
const root=resolve('dist');
const types={'.js':'application/javascript','.css':'text/css','.html':'text/html; charset=utf-8','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
  try{
    const base='http://localhost:4178',url=new URL(req.url,base);
    if(url.pathname.startsWith('/api/')){
      const chunks=[];for await(const chunk of req)chunks.push(chunk);
      const request=new Request(url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})});
      const response=await worker.fetch(request,env,{waitUntil(){}});
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    let path=resolve(root,'.'+decodeURIComponent(url.pathname));
    if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403);res.end();return;}
    if(statSync(path).isDirectory())path=resolve(path,'index.html');
    res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream'});res.end(readFileSync(path));
  }catch(e){res.writeHead(500);res.end('Test server failed');}
});
server.listen(4178,'127.0.0.1',()=>console.log('UI fixture ready at http://localhost:4178'));
process.on('SIGTERM',()=>{server.close();db.close();});
