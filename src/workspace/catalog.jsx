import React,{createContext,useContext,useEffect,useMemo,useRef,useState} from 'react';
import {useSalesSession} from './SalesSession.jsx';
const Context=createContext(null),KEY='public-cat-catalog-v3',MAX_AGE=30*60*1000;
// Only a periodic best-effort check. Real-time decisions still require a manual stock check.
export const CATALOG_AUTO_REFRESH_MS=15*60*1000;
const publicRows=rows=>rows.map(c=>({id:c.id,breed:c.breed,color:c.color,gender:c.gender,age:c.age,vaccine:c.vaccine,image:c.image,images:c.images,videos:(c.videos||[]).map(v=>({url:v.url}))}));
function cached(){try{localStorage.removeItem('public-cat-catalog-v1');localStorage.removeItem('public-cat-catalog-v2');const v=JSON.parse(localStorage.getItem(KEY));return Array.isArray(v?.data)&&Date.now()-v.savedAt<MAX_AGE?{cats:publicRows(v.data),savedAt:v.savedAt}:{cats:[],savedAt:null};}catch{return{cats:[],savedAt:null};}}
function catalogFailure(status,body,hasStock){
 const suffix=hasStock?'当前仍显示上次成功同步的猫源，成交前请核对。':'当前无法取得猫源，请稍后再试。';
 const code=body?.code;
 if(status===401||status===403)return '代理登录已失效，请重新登录后刷新。'+suffix;
 if(status===429)return '猫源请求过于频繁，请稍后再刷新。'+suffix;
 if(code==='FEISHU_TIMEOUT'||code==='FEISHU_NETWORK_ERROR')return '飞书猫源连接超时或网络不稳定。'+suffix;
 if(code==='FEISHU_HTTP_ERROR'||code==='FEISHU_API_ERROR'||code==='FEISHU_INVALID_RESPONSE'||code==='FEISHU_TOKEN_MISSING')return '飞书猫源接口暂时异常。'+suffix;
 if(code==='CONFIG_MISSING')return '猫源服务配置缺失，请联系管理员。'+suffix;
 if(status>=500)return '服务器暂时无法读取最新猫源。'+suffix;
 return '猫源读取失败，请重新核对登录状态及网络。'+suffix;
}
export function CatalogProvider({children}){
 const {user,checking}=useSalesSession(),identity=user&&!user.is_guest?`agent:${user.id}`:'public';
 const [initial]=useState(cached),[entry,setEntry]=useState({owner:'public',cats:initial.cats}),[lastUpdated,setLastUpdated]=useState(initial.savedAt),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const alive=useRef(false),generation=useRef(0),controller=useRef(null),pending=useRef(null),rowsRef=useRef(entry.cats),settingsHash=useRef('');rowsRef.current=entry.cats;
 async function refresh({manual=false}={}){
  if(checking)return {ok:false,reason:'正在检查账号'};
  if(pending.current?.owner===identity)return pending.current.promise;
  const version=generation.current,parent=controller.current,abort=new AbortController(),cancel=()=>abort.abort();parent?.signal.addEventListener('abort',cancel,{once:true});if(parent?.signal.aborted)abort.abort();const deadline=setTimeout(()=>abort.abort(),15000);
  if(!rowsRef.current.length||manual)setLoading(true);
  const job=(async()=>{try{
   const response=await fetch(identity==='public'?'/api/public-cats':'/api/agent/catalog'+(manual?'?fresh=1':''),{credentials:'same-origin',cache:'no-store',signal:abort.signal});
   const body=await response.json().catch(()=>({}));
   if(!response.ok||!body.success||!Array.isArray(body.data)){
    if(identity!=='public'&&[401,403].includes(response.status)){setEntry(old=>({owner:'public',cats:publicRows(old.cats)}));window.dispatchEvent(new Event('workspace:session-refresh'));}
    throw Object.assign(new Error('catalog fetch failed'),{status:response.status,body});
   }
   if(!alive.current||parent?.signal.aborted||version!==generation.current)return {ok:false,reason:'请求已取消'};
   if(body.settings){const nextHash=JSON.stringify(body.settings);if(settingsHash.current!==nextHash){settingsHash.current=nextHash;window.dispatchEvent(new CustomEvent('workbench-settings',{detail:body.settings}));}}
   const rows=identity==='public'?publicRows(body.data):body.data;setEntry({owner:identity,cats:rows});setLastUpdated(body.updatedAt?Date.parse(body.updatedAt)||Date.now():Date.now());setError('');
   // Never persist partner prices or unrestricted descriptions to a public/browser cache.
   try{localStorage.setItem(KEY,JSON.stringify({data:publicRows(body.data),savedAt:Date.now()}));}catch{}
   return {ok:true};
  }catch(e){
   if(alive.current&&!parent?.signal.aborted&&version===generation.current){const reason=catalogFailure(e.status||0,e.body,rowsRef.current.length>0);setError(reason);return {ok:false,reason};}
   return {ok:false,reason:'请求已取消'};
  }finally{clearTimeout(deadline);parent?.signal.removeEventListener('abort',cancel);if(alive.current&&!parent?.signal.aborted&&version===generation.current)setLoading(false);}})();
  pending.current={owner:identity,promise:job};try{return await job;}finally{if(pending.current?.promise===job)pending.current=null;}
 }
 useEffect(()=>{
  if(checking)return;alive.current=true;generation.current++;controller.current=new AbortController();pending.current=null;refresh();
  const timer=setInterval(()=>{if(!document.hidden)refresh();},CATALOG_AUTO_REFRESH_MS);
  return()=>{alive.current=false;generation.current++;controller.current.abort();clearInterval(timer);};
 },[identity,checking]);
 const cats=useMemo(()=>entry.owner===identity?entry.cats:publicRows(entry.cats),[entry,identity]);
 return <Context.Provider value={{cats,lastUpdated,loading,error,refresh}}>{children}</Context.Provider>;
}
export function useCatalog(){const value=useContext(Context);if(!value)throw new Error('CatalogProvider is required');return value;}
