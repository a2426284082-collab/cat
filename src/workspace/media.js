// A single bounded decode queue prevents a photo grid and a poster from decoding dozens of originals together.
const VERSION='media-v4',DB_NAME='cat-preview-media-v4',TTL=24*3600*1000,MAX_BYTES=12*1024*1024,MAX_CACHE_BYTES=16*1024*1024;
const memory=new Map(),pending=new Map(),queue=[];let working=0,generation=0,dbPromise,decodeTail=Promise.resolve(),persistTail=Promise.resolve();
const aborted=()=>new DOMException('已取消','AbortError');
export const isInlineImage=url=>/^data:image\/(?:png|jpeg|webp|gif|svg\+xml)[;,]|^blob:/i.test(String(url));
export function photoURL(value){const u=new URL(value,globalThis.location?.origin||'https://preview.local');if(u.origin!==(globalThis.location?.origin||'https://preview.local')||!/^\/api\/public-images\/[a-z0-9_-]{1,200}$/i.test(u.pathname))throw new Error('请使用当前猫源库照片');u.search='?media_v=4';return u.href;}
async function db(){if(!globalThis.indexedDB)return null;if(!dbPromise)dbPromise=new Promise(resolve=>{let settled=false;const request=indexedDB.open(DB_NAME,1),finish=value=>{if(!settled){settled=true;resolve(value);}};request.onupgradeneeded=()=>request.result.createObjectStore('photos',{keyPath:'key'});request.onsuccess=()=>{if(settled){request.result.close();return;}request.result.onversionchange=()=>request.result.close();finish(request.result);};request.onerror=request.onblocked=()=>finish(null);setTimeout(()=>finish(null),1200);});return dbPromise;}
async function bounded(promise,ms,fallback=null){let timer;try{return await Promise.race([promise,new Promise(resolve=>timer=setTimeout(()=>resolve(fallback),ms))]);}finally{clearTimeout(timer);}}
async function stored(key){try{const database=await db();if(!database)return null;return await bounded(new Promise(resolve=>{const tx=database.transaction('photos'),req=tx.objectStore('photos').get(key);req.onsuccess=()=>resolve(req.result?.until>Date.now()&&req.result?.blob?.size?req.result.blob:null);req.onerror=()=>resolve(null);}),800);}catch{return null;}}
function persist(key,blob,version){
 const save=async()=>{try{
  const database=await db();if(!database||version!==generation)return;
  const rows=await bounded(new Promise(resolve=>{const req=database.transaction('photos').objectStore('photos').getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>resolve(null);}),1000);
  if(!rows||version!==generation)return;
  const next=rows.filter(r=>r.key!==key&&r.until>Date.now()&&r.blob?.size).sort((a,b)=>b.at-a.at);let bytes=blob.size;const keep=new Set([key]);
  for(const row of next)if(keep.size<36&&bytes+row.blob.size<=MAX_CACHE_BYTES){keep.add(row.key);bytes+=row.blob.size;}
  await bounded(new Promise(resolve=>{const tx=database.transaction('photos','readwrite'),store=tx.objectStore('photos');for(const row of rows)if(!keep.has(row.key))store.delete(row.key);store.put({key,blob,at:Date.now(),until:Date.now()+TTL});tx.oncomplete=tx.onerror=tx.onabort=()=>resolve();}),1000);
 }catch{}};
 persistTail=persistTail.catch(()=>{}).then(save);return persistTail;
}
function remember(key,blob){memory.delete(key);memory.set(key,{blob,until:Date.now()+TTL});let bytes=[...memory.values()].reduce((n,row)=>n+row.blob.size,0);while(memory.size>32||bytes>MAX_CACHE_BYTES){const old=memory.keys().next().value;bytes-=memory.get(old).blob.size;memory.delete(old);}return blob;}
function smallCanvas(source,maxEdge=960){const width=source.naturalWidth||source.width,height=source.naturalHeight||source.height;if(!width||!height)throw new Error('照片尺寸无效');const ratio=Math.min(1,maxEdge/Math.max(width,height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*ratio));canvas.height=Math.max(1,Math.round(height*ratio));try{const ctx=canvas.getContext('2d');if(!ctx)throw new Error('当前浏览器不支持图片处理');ctx.drawImage(source,0,0,canvas.width,canvas.height);return canvas;}catch(e){releaseCanvas(canvas);throw e;}}
function imageFromBlob(blob,signal){return new Promise((resolve,reject)=>{const image=new Image(),url=URL.createObjectURL(blob);const timer=setTimeout(()=>finish(new Error('照片解码超时')),12000),abort=()=>finish(aborted());function finish(error){clearTimeout(timer);signal?.removeEventListener('abort',abort);image.onload=image.onerror=null;if(error){image.src='';URL.revokeObjectURL(url);reject(error);}else{image.close=()=>{image.src='';URL.revokeObjectURL(url);};resolve(image);}}image.onload=()=>finish();image.onerror=()=>finish(new Error('照片无法解码，请重新加载'));if(signal?.aborted){finish(aborted());return;}signal?.addEventListener('abort',abort,{once:true});image.src=url;});}
export async function decodePreview(blob,{signal}={}){
 if(signal?.aborted)throw aborted();
 if(globalThis.createImageBitmap){
  let bitmap,timer,pendingBitmap;
  try{
   pendingBitmap=createImageBitmap(blob,{resizeWidth:960,resizeQuality:'medium'});
   // Rare browser bitmap decoder hangs must not block every queued photo.
   bitmap=await Promise.race([pendingBitmap,new Promise((_,reject)=>{timer=setTimeout(()=>reject(photoError('PHOTO_DECODE_TIMEOUT','照片解码超时，请重试')),15000);})]);
   if(signal?.aborted){bitmap.close();throw aborted();}
   if(bitmap.width*bitmap.height>4000000){bitmap.close();throw new Error('照片比例过大，请更换素材');}
   return bitmap;
  }catch(e){
   bitmap?.close();
   if(e?.code==='PHOTO_DECODE_TIMEOUT')void pendingBitmap?.then(late=>late?.close?.(),()=>{});
   if(signal?.aborted||e.name==='AbortError')throw aborted();
  }finally{clearTimeout(timer);}
 }
 return imageFromBlob(blob,signal);
}
// Server media may take longer on a cold cache. A timeout is a failed request,
// NOT a user cancellation; the caller must show an actionable error rather than spin forever.
const PHOTO_ATTEMPTS=2,PHOTO_FETCH_TIMEOUT_MS=27000;
function photoError(code,message){return Object.assign(new Error(message),{code});}
function abortWait(ms,signal){return new Promise((resolve,reject)=>{
 if(signal.aborted){reject(aborted());return;}
 const timer=setTimeout(done,ms);
 function done(){signal.removeEventListener('abort',cancel);resolve();}
 function cancel(){clearTimeout(timer);signal.removeEventListener('abort',cancel);reject(aborted());}
 signal.addEventListener('abort',cancel,{once:true});
});}
async function downloadPhoto(url,signal,attempt){
 const controller=new AbortController();
 const onAbort=()=>controller.abort(aborted());
 signal.addEventListener('abort',onAbort,{once:true});
 const timer=setTimeout(()=>controller.abort(photoError('PHOTO_TIMEOUT','照片读取超时，请点击重试')),PHOTO_FETCH_TIMEOUT_MS);
 try{
  let response;
  try{response=await fetch(url,{signal:controller.signal,cache:attempt?'reload':'default',credentials:'same-origin'});}
  catch(e){if(signal.aborted)throw aborted();if(controller.signal.aborted)throw photoError('PHOTO_TIMEOUT','照片读取超时，请点击重试');throw photoError('PHOTO_NETWORK','照片网络连接失败，请点击重试');}
  if(!response.ok){
   const issue=response.headers.get('x-photo-error');
   if(response.status===404||issue==='IMAGE_UPSTREAM_NOT_FOUND')throw photoError('PHOTO_MISSING','这张飞书照片已经失效，请联系管理员重新上传或使用该猫的其他照片');
   if(response.status===413)throw photoError('PHOTO_TOO_LARGE','这张原图过大，请更换或压缩图片');
   throw photoError('PHOTO_SERVER',`照片服务器暂时不可用（${response.status}），请点击重试`);
  }
  if(Number(response.headers.get('content-length'))>MAX_BYTES)throw photoError('PHOTO_TOO_LARGE','原图过大，请更换压缩后的照片');
  let blob;
  try{blob=await response.blob();}
  catch(e){if(signal.aborted)throw aborted();if(controller.signal.aborted)throw photoError('PHOTO_TIMEOUT','照片传输超时，请点击重试');throw photoError('PHOTO_NETWORK','照片下载中断，请点击重试');}
  if(!blob.size||blob.size>MAX_BYTES||!blob.type.startsWith('image/'))throw photoError('PHOTO_INVALID','照片格式或大小无效，请联系管理员核对图片');
  return blob;
 }finally{clearTimeout(timer);signal.removeEventListener('abort',onAbort);}
}
async function thumbnail(url,signal){
 let last;
 for(let attempt=0;attempt<PHOTO_ATTEMPTS;attempt++){
  if(signal.aborted)throw aborted();
  try{
   const blob=await downloadPhoto(url,signal,attempt);
   let release;const previous=decodeTail;decodeTail=new Promise(resolve=>release=resolve);
   await previous;
   try{
    if(signal.aborted)throw aborted();
    const image=await decodePreview(blob,{signal});let canvas;
    try{canvas=smallCanvas(image);}finally{image.close?.();}
    if(signal.aborted){releaseCanvas(canvas);throw aborted();}
    try{return await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(photoError('PHOTO_DECODE','照片压缩失败，请重新加载')),'image/jpeg',.82));}
    finally{releaseCanvas(canvas);}
   }finally{release();}
  }catch(e){
   if(signal.aborted)throw aborted();
   last=e?.name==='AbortError'?photoError('PHOTO_TIMEOUT','照片处理超时，请点击重试'):e;
   if(['PHOTO_MISSING','PHOTO_TOO_LARGE','PHOTO_INVALID'].includes(last?.code))break;
   if(attempt+1<PHOTO_ATTEMPTS)await abortWait(250*(attempt+1),signal);
  }
 }
 throw last||photoError('PHOTO_UNAVAILABLE','照片暂时无法读取，请点击重试');
}
async function drain(){if(working>=2)return;working++;try{while(queue.length){const job=queue.shift();try{if(job.controller.signal.aborted)throw aborted();const cached=job.force?null:await stored(job.key);if(job.controller.signal.aborted)throw aborted();const blob=cached||await thumbnail(job.key,job.controller.signal);if(job.version!==generation||job.controller.signal.aborted)throw aborted();remember(job.key,blob);if(!cached)void persist(job.key,blob,job.version);job.resolve(blob);}catch(e){job.reject(e);}finally{if(pending.get(job.key)===job)pending.delete(job.key);}}}finally{working--;if(queue.length)void drain();}}
export function getPreviewBlob(src,{signal,force=false}={}){let key;try{key=photoURL(src);}catch(e){return Promise.reject(e);}if(signal?.aborted)return Promise.reject(aborted());const hit=memory.get(key);if(!force&&hit?.until>Date.now())return Promise.resolve(hit.blob);let job=pending.get(key);if(job?.controller.signal.aborted){pending.delete(key);job=null;}if(!job){job={key,force,version:generation,controller:new AbortController(),clients:0};job.promise=new Promise((resolve,reject)=>{job.resolve=resolve;job.reject=reject;});job.promise.catch(()=>{});pending.set(key,job);queue.push(job);}job.clients++;const result=new Promise((resolve,reject)=>{let done=false;const finish=(error,blob)=>{if(done)return;done=true;signal?.removeEventListener('abort',abort);job.clients--;if(job.clients===0&&pending.get(key)===job)job.controller.abort();error?reject(error):resolve(blob);};const abort=()=>finish(aborted());signal?.addEventListener('abort',abort,{once:true});job.promise.then(blob=>finish(null,blob),error=>finish(error));});void drain();return result;}
export async function loadPreparedImage(src,{signal,force=false}={}){const blob=await getPreviewBlob(src,{signal,force});return decodePreview(blob,{signal});}
export async function clearPreviewCache(){generation++;for(const job of pending.values())job.controller.abort();memory.clear();try{const database=await db();if(database)await bounded(new Promise(resolve=>{const tx=database.transaction('photos','readwrite');tx.objectStore('photos').clear();tx.oncomplete=tx.onerror=tx.onabort=()=>resolve();}),1200);}catch{}globalThis.window?.dispatchEvent(new CustomEvent('cat-media-reset'));}
export function releaseCanvas(canvas){if(canvas)canvas.width=canvas.height=1;}
export const mediaLimits={decodedQueue:1,networkQueue:2,maxEdge:960,maxEntries:32,maxBytes:MAX_CACHE_BYTES,version:VERSION};
