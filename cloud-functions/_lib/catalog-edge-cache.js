// A short-lived, edge-local cache for publicly visible catalog data and photo
// permissions. Unlike the instance-local Feishu cache this is shared by Worker
// isolates in the same colo. Never cache agent-only prices or raw Feishu fields.
const encoder=new TextEncoder();
async function keyFor(env,request,kind){
 if(!request?.url||!env?.FEISHU_APP_ID||!env?.FEISHU_APP_SECRET||!env?.FEISHU_APP_TOKEN||!env?.FEISHU_TABLE_ID)return null;
 const scope=JSON.stringify([env.FEISHU_APP_ID,env.FEISHU_APP_SECRET,env.FEISHU_APP_TOKEN,env.FEISHU_TABLE_ID]);
 const hash=await crypto.subtle.digest('SHA-256',encoder.encode(scope));
 const digest=Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');
 const url=new URL(request.url);url.pathname=`/.internal-cache/catalog/v1/${kind}/${digest}`;url.search='';
 return new Request(url.toString());
}
async function read(env,request,kind){
 const cache=globalThis.caches?.default;if(!cache)return null;
 try{const key=await keyFor(env,request,kind);if(!key)return null;const response=await cache.match(key);return response?.ok?await response.json():null;}catch{return null;}
}
async function write(env,request,kind,value,ttl,waitUntil){
 const cache=globalThis.caches?.default;if(!cache)return;
 try{const key=await keyFor(env,request,kind);if(!key)return;
  const job=cache.put(key,new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json','Cache-Control':`public, max-age=${ttl}`}})).catch(()=>{});
  if(waitUntil)waitUntil(job);else await job;
 }catch{}
}
export function readPublicCatalog(env,request){return read(env,request,'public');}
export function savePublicCatalog(env,request,data,waitUntil){return write(env,request,'public',data,60,waitUntil);}
export async function imageAuthorized(env,request,token){
 const list=await read(env,request,'images');
 if(!list||!Array.isArray(list.tokens))return null; // cache miss, check live catalog
 return list.tokens.includes(token);
}
export function saveImagePermissions(env,request,imageTokens,waitUntil){
 return write(env,request,'images',{tokens:[...imageTokens]},60,waitUntil);
}
