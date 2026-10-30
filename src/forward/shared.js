export const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const money=value=>new Intl.NumberFormat('zh-CN',{maximumFractionDigits:2}).format(value);
export const day=offset=>new Date(Date.now()+8*3600e3+(offset||0)*86400e3).toISOString().slice(0,10);
export const dateLabel=seconds=>new Date((seconds+8*3600)*1000).toISOString().slice(0,10);
export const safeMedia=value=>typeof value==='string'&&/^\/api\/public-(?:images|videos)\/[A-Za-z0-9_-]{1,200}$/.test(value)?value:null;
export async function api(path,{method='GET',body,timeout=30000,signal}={}){
 const abort=new AbortController(),cancel=()=>abort.abort();signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)abort.abort();const timer=setTimeout(()=>abort.abort(),timeout);
 try{const response=await fetch(path,{method,credentials:'same-origin',cache:'no-store',signal:abort.signal,headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{})});const data=await response.json().catch(()=>({}));if(!response.ok||data.success===false)throw Object.assign(new Error(data.message||'请求失败，请稍后重试'),{status:response.status});return data;}
 catch(error){if(error.name==='AbortError')throw new Error('等待响应超时，未自动重试；生成方案时请保留当前内容再点一次。');throw error;}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
}
export function validatePublic(data){
 if(!data||!Array.isArray(data.cats)||data.cats.length<1||data.cats.length>3||!data.advisor||!Number.isFinite(data.expires_at))throw new Error('方案资料不完整');
 for(const cat of data.cats){if(!Number.isFinite(cat.price)||cat.price<0)throw new Error('报价资料无效');if(cat.image&&!safeMedia(cat.image))cat.image=null;cat.videos=(cat.videos||[]).filter(v=>safeMedia(v.url));}
 return data;
}
export const shareCopy=(name,count,url)=>`${name}，我为您整理了${count}只猫咪的资料和对客报价，可以看看哪只更合眼缘。疫苗记录、库存和接猫安排，我们再逐项确认：\n${url}`;
