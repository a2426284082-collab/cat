// Browser-only exposure distribution. Seeds contain public account IDs, never activation codes.
export const ORDER_STORAGE_KEY='sales-catalog-rounds-v1';
export function hashSeed(value){let h=2166136261;for(const c of String(value)){h^=c.codePointAt(0);h=Math.imul(h,16777619);}h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;return (h^h>>>16)>>>0;}
export function randomFromSeed(value){let state=hashSeed(value);return ()=>{state+=0x6D2B79F5;let n=state;n=Math.imul(n^n>>>15,n|1);n^=n+Math.imul(n^n>>>7,n|61);return ((n^n>>>14)>>>0)/4294967296;};}
export function seededShuffle(items,seed,keyOf){if(keyOf)return items.map(item=>({item,rank:hashSeed(String(seed)+'|'+keyOf(item)),key:keyOf(item)})).sort((a,b)=>a.rank-b.rank||a.key.localeCompare(b.key,'en')).map(row=>row.item);const result=[...items],random=randomFromSeed(seed);for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;}
export function salesDate(now=new Date()){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now),part=key=>parts.find(p=>p.type===key).value;return `${part('year')}-${part('month')}-${part('day')}`;}
const stockId=cat=>String(cat.id||'').replace(/^#+/,'').trim().toUpperCase();
export function catalogOrder(cats,identity,day,round=0,sort='default'){
 const canonical=[...cats].sort((a,b)=>stockId(a).localeCompare(stockId(b),'en'));
 const distributed=seededShuffle(canonical,`${identity}|${day}|${round}`,stockId);
 if(sort==='price-asc'||sort==='price-desc')distributed.sort((a,b)=>{if(a.price==null)return b.price==null?0:1;if(b.price==null)return -1;return sort==='price-asc'?a.price-b.price:b.price-a.price;});
 return distributed;
}
export const orderKey=(identity,day)=>hashSeed(identity).toString(36)+'|'+day;
export function readShuffleRound(identity,day,storage=globalThis.localStorage){try{const rows=JSON.parse(storage.getItem(ORDER_STORAGE_KEY)||'{}'),n=rows[orderKey(identity,day)];return Number.isSafeInteger(n)&&n>=0?n:0;}catch{return 0;}}
export function saveShuffleRound(identity,day,round,storage=globalThis.localStorage){try{let rows;try{rows=JSON.parse(storage.getItem(ORDER_STORAGE_KEY)||'{}');}catch{}if(!rows||typeof rows!=='object'||Array.isArray(rows))rows={};const next=Object.fromEntries(Object.entries(rows).filter(([key,value])=>key.endsWith('|'+day)&&Number.isSafeInteger(value)&&value>=0));next[orderKey(identity,day)]=round;storage.setItem(ORDER_STORAGE_KEY,JSON.stringify(Object.fromEntries(Object.entries(next).slice(-50))));}catch{}}
