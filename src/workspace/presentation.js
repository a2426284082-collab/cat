export const normalizeId=value=>String(value||'').replace(/^#+\s*/,'').trim().toUpperCase();
const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function shortIdMap(cats){
 const groups=new Map(),result=new Map();
 for(const cat of cats){const full=normalizeId(cat.id),suffix=full.match(/\d{3,}$/)?.[0]?.slice(-3)||full;const key='#'+suffix;if(!groups.has(key))groups.set(key,[]);if(!groups.get(key).includes(full))groups.get(key).push(full);}
 for(const [label,ids] of groups)ids.sort().forEach((id,i)=>result.set(id,ids.length===1?label:`${label}-${i+1}`));
 return result;
}
export function displayText(value,cats,hidePrices=false){
 let text=String(value??'');const ids=shortIdMap(cats);
 for(const full of [...ids.keys()].sort((a,b)=>b.length-a.length))text=text.replace(new RegExp(`(?<![A-Za-z0-9_-])#?${escape(full)}(?![A-Za-z0-9_-])`,'gi'),ids.get(full));
 if(hidePrices){
  text=text.replace(/(?:合作)?底价(?:已隐藏)?[：:\s]*|价格已隐藏|价格不展示|截图模式/g,'');
  text=text.replace(/[零一二三四五六七八九十百千万两]+(?:元|块(?:钱)?)/g,'');
  text=text.replace(/[¥￥]\s*[\d,]+(?:\.\d+)?|\d[\d,]*(?:\.\d+)?\s*(?:元|块(?:钱)?)/g,'');
  for(const price of new Set(cats.map(c=>c.price).filter(x=>x!=null))){for(const amount of [String(price),Number(price).toLocaleString('zh-CN')])text=text.replace(new RegExp(`(?<![#\\dA-Za-z_-])${escape(amount)}(?![\\dA-Za-z_-])`,'g'),'');}
 }
 return text;
}
export const money=value=>value==null?'价格待确认':`¥${Math.round(Number(value)).toLocaleString('zh-CN')}`;
// Client-facing display is presentation only; original stock IDs/prices stay intact.
export const priceSettings=value=>({enabled:value?.enabled===true,markup:Number.isInteger(Number(value?.markup))&&Number(value.markup)>=0&&Number(value.markup)<=100000?Number(value.markup):800});
export function displayedPrice(cat,settings){if(!settings?.enabled)return cat.price;if(settings.markup===0||cat.price==null)return null;return Number(cat.price)+settings.markup;}
