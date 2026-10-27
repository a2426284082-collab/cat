import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
const CatalogContext=createContext(null);
const CACHE_KEY='public-cat-catalog-v1',MAX_AGE=24*60*60*1000;
function cached(){try{const value=JSON.parse(localStorage.getItem(CACHE_KEY));return Array.isArray(value?.data)&&Number.isFinite(value.savedAt)&&Date.now()-value.savedAt<MAX_AGE?value:{data:[],savedAt:null};}catch{return{data:[],savedAt:null};}}
export function CatalogProvider({children}){
  const[initial]=useState(cached),[cats,setCats]=useState(initial.data),[lastUpdated,setLastUpdated]=useState(initial.savedAt),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const catsRef=useRef(cats),pending=useRef(null),alive=useRef(false),controller=useRef(null);
  catsRef.current=cats;
  async function refresh({manual=false}={}){
    if(pending.current)return pending.current;
    if(!catsRef.current.length||manual)setLoading(true);
    const aborter=controller.current;
    const job=(async()=>{
      try{
        const response=await fetch('/api/public-cats',{cache:manual?'reload':'default',signal:aborter?.signal});
        const body=await response.json();
        if(!response.ok||!body.success||!Array.isArray(body.data))throw new Error();
        if(!alive.current||aborter?.signal.aborted)return;
        const savedAt=Date.now();setCats(body.data);setLastUpdated(savedAt);setError('');
        try{localStorage.setItem(CACHE_KEY,JSON.stringify({data:body.data,savedAt}));}catch{}
      }catch(reason){if(reason.name!=='AbortError'&&alive.current)setError(catsRef.current.length?'线上猫源刷新失败，当前显示最近一次成功同步的数据。':'猫源暂时无法读取，请稍后刷新。');}
      finally{if(alive.current&&!aborter?.signal.aborted)setLoading(false);}
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
