// Local PNG artifacts belong to the signed-in sales identity. D1 stores task
// receipts, not image bytes; only this browser can reopen these images.
const DATABASE='sales-agent-poster-artifacts-v1',STORE='posters',MAX_RECORDS=30,MAX_AGE=30*86400*1000;
const fallback=new Map();
let dbPromise;
function openDatabase(){
 if(!globalThis.indexedDB)return Promise.resolve(null);
 if(!dbPromise)dbPromise=new Promise(resolve=>{
  try{
   const req=indexedDB.open(DATABASE,1);
   req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:'id'});};
   req.onsuccess=()=>{req.result.onversionchange=()=>{req.result.close();dbPromise=null;};resolve(req.result);};
   req.onerror=req.onblocked=()=>resolve(null);
  }catch{resolve(null);}
 });
 return dbPromise;
}
function transact(db,mode,work){return new Promise((resolve,reject)=>{
 try{
  const tx=db.transaction(STORE,mode),store=tx.objectStore(STORE);let value;
  tx.oncomplete=()=>resolve(value);tx.onerror=tx.onabort=()=>reject(tx.error||new Error('本地图片保存失败'));
  const r=work(store);if(r){r.onsuccess=()=>{value=r.result;};r.onerror=()=>{try{tx.abort();}catch{}};}
 }catch(e){reject(e);}
});}
function validateOwner(owner){if(typeof owner!=='string'||!owner.startsWith('sales:'))throw new Error('请先激活销售身份再保存图片');return owner;}
function validateId(id){if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{8,110}$/.test(id))throw new Error('图片成果编号不合法');return id;}
export async function savePosterArtifact({owner,blob,...metadata}){
 validateOwner(owner);
 if(!(blob instanceof Blob)||blob.type!=='image/png'||blob.size<1000)throw new Error('PNG图片内容不完整，无法交付');
 const id=validateId(metadata.id||crypto.randomUUID());
 const row={...metadata,id,owner,blob,createdAt:Date.now()};
 const db=await openDatabase();
 if(db){try{
  await transact(db,'readwrite',store=>store.put(row));
  // Best-effort cleanup; do not fail a successfully persisted image.
  void transact(db,'readonly',store=>store.getAll()).then(rows=>{
   const sorted=(rows||[]).sort((a,b)=>b.createdAt-a.createdAt);
   const stale=sorted.filter((r,i)=>i>=MAX_RECORDS||r.createdAt<Date.now()-MAX_AGE);
   if(stale.length)return transact(db,'readwrite',store=>{for(const r of stale)store.delete(r.id);});
  }).catch(()=>{});
  return {id,persisted:true,bytes:blob.size};
 }catch{/* Allow immediate viewing if browser storage quota is exhausted. */}}
 fallback.set(id,row);while(fallback.size>6)fallback.delete(fallback.keys().next().value);
 return {id,persisted:false,bytes:blob.size};
}
export async function readPosterArtifact({id,owner}){
 validateId(id);validateOwner(owner);
 const cached=fallback.get(id);if(cached?.owner===owner)return cached;
 const db=await openDatabase();if(!db)return null;
 try{const row=await transact(db,'readonly',store=>store.get(id));return row?.owner===owner?row:null;}catch{return null;}
}
