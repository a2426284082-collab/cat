import React,{createContext,useContext,useEffect,useRef,useState} from 'react';
import {useSalesSession} from './SalesSession.jsx';
const Context=createContext(null),KEY='public-cat-catalog-v3',MAX_AGE=30*60*1000;
const publicRows=rows=>rows.map(c=>({id:c.id,breed:c.breed,color:c.color,gender:c.gender,age:c.age,vaccine:c.vaccine,image:c.image,images:c.images,videos:(c.videos||[]).map(v=>({url:v.url}))}));
function cached(){try{localStorage.removeItem('public-cat-catalog-v1');localStorage.removeItem('public-cat-catalog-v2');const v=JSON.parse(localStorage.getItem(KEY));return Array.isArray(v?.data)&&Date.now()-v.savedAt<MAX_AGE?{cats:publicRows(v.data),savedAt:v.savedAt}:{cats:[],savedAt:null};}catch{return{cats:[],savedAt:null};}}
export function CatalogProvider({children}){
 const {user,checking}=useSalesSession(),identity=user&&!user.is_guest?`agent:${user.id}`:'public';
 const [initial]=useState(cached),[entry,setEntry]=useState({owner:'public',cats:initial.cats}),[lastUpdated,setLastUpdated]=useState(initial.savedAt),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const alive=useRef(false),generation=useRef(0),controller=useRef(null),pending=useRef(null),rowsRef=useRef(entry.cats);rowsRef.current=entry.cats;
 async function refresh({manual=false}={}){
  if(checking)return;if(pending.current?.owner===identity)return pending.current.promise;
  const version=generation.current,parent=controller.current,abort=new AbortController(),cancel=()=>abort.abort();parent?.signal.addEventListener('abort',cancel,{once:true});if(parent?.signal.aborted)abort.abort();const deadline=setTimeout(()=>abort.abort(),15000);
  if(!rowsRef.current.length||manual)setLoading(true);
  const job=(async()=>{try{
   const response=await fetch(identity==='public'?'/api/public-cats':'/api/agent/catalog'+(manual?'?fresh=1':''),{credentials:'same-origin',cache:'no-store',signal:abort.signal});
   const body=await response.json();if(!response.ok||!body.success||!Array.isArray(body.data)){
    if(identity!=='public'&&[401,403].includes(response.status)){setEntry(old=>({owner:'public',cats:publicRows(old.cats)}));window.dispatchEvent(new Event('workspace:session-refresh'));}
    throw new Error();
   }
   if(!alive.current||parent?.signal.aborted||version!==generation.current)return;
   if(body.settings)window.dispatchEvent(new CustomEvent('workbench-settings',{detail:body.settings}));
   const rows=identity==='public'?publicRows(body.data):body.data;setEntry({owner:identity,cats:rows});setLastUpdated(body.updatedAt?Date.parse(body.updatedAt)||Date.now():Date.now());setError('');
   // Never persist partner prices or unrestricted descriptions to a public/browser cache.
   try{localStorage.setItem(KEY,JSON.stringify({data:publicRows(body.data),savedAt:Date.now()}));}catch{}
  }catch{if(alive.current&&!parent?.signal.aborted&&version===generation.current)setError(rowsRef.current.length?'猫源刷新失败，当前显示最近一次成功同步的资料，请刷新核实。':'猫源暂时无法读取，请稍后刷新。');}
  finally{clearTimeout(deadline);parent?.signal.removeEventListener('abort',cancel);if(alive.current&&!parent?.signal.aborted&&version===generation.current)setLoading(false);}})();
  pending.current={owner:identity,promise:job};try{await job;}finally{if(pending.current?.promise===job)pending.current=null;}
 }
 useEffect(()=>{
  if(checking)return;alive.current=true;generation.current++;controller.current=new AbortController();pending.current=null;refresh();
  const timer=setInterval(()=>{if(!document.hidden)refresh();},5*60*1000);
  return()=>{alive.current=false;generation.current++;controller.current.abort();clearInterval(timer);};
 },[identity,checking]);
 const cats=entry.owner===identity?entry.cats:publicRows(entry.cats);
 return <Context.Provider value={{cats,lastUpdated,loading,error,refresh}}>{children}</Context.Provider>;
}
export function useCatalog(){const value=useContext(Context);if(!value)throw new Error('CatalogProvider is required');return value;}
