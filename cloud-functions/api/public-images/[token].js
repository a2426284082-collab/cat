import { getCatalog, getImage } from '../../_lib/feishu.js';
import { imageAuthorized, saveImagePermissions } from '../../_lib/catalog-edge-cache.js';
const pending=new Map();
async function cacheKey(request,env,token){const scope=JSON.stringify([env.FEISHU_APP_ID,env.FEISHU_APP_SECRET,env.FEISHU_APP_TOKEN,env.FEISHU_TABLE_ID]);const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(scope));const digest=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');const url=new URL(request?.url||'https://media.local');url.pathname=`/.internal-cache/cat-photo/v4/${digest}/${token}`;url.search='';return new Request(url);}
export async function onRequestGet({env,params,request,waitUntil}){
 const token=params?.token??'',none={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 if(!/^[A-Za-z0-9_-]{1,200}$/.test(token))return new Response(null,{status:404,headers:none});
 try{
  // Check the short edge-local authorization snapshot first. A missing snapshot
  // falls back to Feishu; a negative hit must never trigger an image download.
  let allowed=await imageAuthorized(env,request,token);
  if(allowed===null){const catalog=await getCatalog(env);allowed=catalog.imageTokens.has(token);
   if(request)await saveImagePermissions(env,request,catalog.imageTokens,waitUntil);
  }
  if(!allowed)return new Response(null,{status:404,headers:none});
  const key=await cacheKey(request,env,token),cache=globalThis.caches?.default;let result;
  try{result=await cache?.match(key);}catch{}
  if(!result){let work=pending.get(key.url);if(!work){work=getImage(env,token);pending.set(key.url,work);work.finally(()=>pending.delete(key.url)).catch(()=>{});}const {bytes,type}=await work;result=new Response(bytes,{headers:{'Content-Type':type,'Content-Length':String(bytes.byteLength),'Cache-Control':'public, max-age=3600, s-maxage=21600','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, noimageindex'}});if(cache){const save=cache.put(key,result.clone()).catch(()=>{});if(waitUntil)waitUntil(save);else await save;}}
  if(request&&new URL(request.url).searchParams.get('download')==='1'){const headers=new Headers(result.headers),ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/avif':'avif'}[headers.get('content-type')]||'img';const name=(new URL(request.url).searchParams.get('name')||'cat-photo').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,60)||'cat-photo';headers.set('Content-Disposition',`attachment; filename="${name}.${ext}"`);headers.set('Cache-Control','private, no-store');return new Response(result.body,{headers});}
  return result;
  }catch(error){
  // A fixed diagnostic code lets the UI explain failures without leaking tokens,
  // attachment URLs or Feishu credentials.
  const code=['IMAGE_TIMEOUT','IMAGE_NETWORK','IMAGE_UPSTREAM_FAILED','IMAGE_UPSTREAM_NOT_FOUND','IMAGE_TOO_LARGE','IMAGE_UNSUPPORTED'].includes(error?.code)?error.code:'IMAGE_PROXY_FAILED';
  const status=code==='IMAGE_UPSTREAM_NOT_FOUND'?404:code==='IMAGE_TOO_LARGE'?413:code==='IMAGE_UNSUPPORTED'?415:503;
  return new Response(null,{status,headers:{...none,'X-Photo-Error':code}});
 }
}
