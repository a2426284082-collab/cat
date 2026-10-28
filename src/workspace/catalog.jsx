// ADMIN_CONTROL_PATCH_V1
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
const CatalogContext=createContext(null);
const CACHE_KEY='public-cat-catalog-v2',MAX_AGE=30*60*1000;
function cached(){try{localStorage.removeItem('public-cat-catalog-v1');const value=JSON.parse(localStorage.getItem(CACHE_KEY));return Array.isArray(value?.data)&&Number.isFinite(value.savedAt)&&Date.now()-value.savedAt<MAX_AGE?value:{data:[],savedAt:null};}catch{return{data:[],savedAt:null};}}
export function CatalogProvider({children}){
  const[initial]=useState(cached),[cats,setCats]=useState(initial.data),[lastUpdated,setLastUpdated]=useState(initial.savedAt),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const catsRef=useRef(cats),pending=useRef(null),alive=useRef(false),controller=useRef(null);
  catsRef.current=cats;
  async function refresh({manual=false}={}){
    if(pending.current)return pending.current;
    if(!catsRef.current.length||manual)setLoading(true);
    const aborter=controller.current,requestAbort=new AbortController(),cancel=()=>requestAbort.abort();aborter?.signal.addEventListener('abort',cancel,{once:true});if(aborter?.signal.aborted)requestAbort.abort();const deadline=setTimeout(()=>requestAbort.abort(),12000);
    const job=(async()=>{
      try{
        const response=await fetch('/api/public-cats',{cache:'no-store',signal:requestAbort.signal});
        const body=await response.json();
        if(!response.ok||!body.success||!Array.isArray(body.data))throw new Error();
        if(!alive.current||aborter?.signal.aborted)return;
        if(body.settings)window.dispatchEvent(new CustomEvent('workbench-settings',{detail:body.settings}));
        const savedAt=Date.now();setCats(body.data);setLastUpdated(savedAt);setError('');
        try{localStorage.setItem(CACHE_KEY,JSON.stringify({data:body.data,savedAt}));}catch{}
      }catch(reason){if(!aborter?.signal.aborted&&alive.current)setError(catsRef.current.length?'线上猫源刷新失败，当前显示最近一次成功同步的数据。':'猫源暂时无法读取，请稍后刷新。');}
      finally{clearTimeout(deadline);aborter?.signal.removeEventListener('abort',cancel);if(alive.current&&!aborter?.signal.aborted)setLoading(false);}
    })();
    pending.current=job;
    try{await job;}finally{if(pending.current===job)pending.current=null;}
  }
  useEffect(()=>{
    alive.current=true;controller.current=new AbortController();pending.current=null;refresh();
    const timer=setInterval(()=>{if(!document.hidden)refresh();},5*60*1000);
    return()=>{alive.current=false;controller.current.abort();clearInterval(timer);};
  },[]);
  return <CatalogContext.Provider value={{cats,lastUpdated,loading,error,refresh}}>{children}</CatalogContext.Provider>;
}
export function useCatalog(){const value=useContext(CatalogContext);if(!value)throw new Error('CatalogProvider is required');return value;}
