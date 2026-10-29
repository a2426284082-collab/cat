import React,{useEffect,useMemo,useRef,useState} from 'react';
import {getPreviewBlob,isInlineImage} from './media.js';

// A cat may have several Feishu attachments. A broken primary image should not
// blank the card if another image of the SAME cat is still available.
export default function SmartImage({src,sources,alt='',priority=false,retryable=true,className='',...props}){
 const root=useRef(null),[near,setNear]=useState(priority||!('IntersectionObserver' in window)),[retry,setRetry]=useState(0),[image,setImage]=useState(''),[error,setError]=useState('');
 const candidatesKey=JSON.stringify([src,...(Array.isArray(sources)?sources:[])]);
 const candidates=useMemo(()=>[...new Set(JSON.parse(candidatesKey).filter(Boolean))].slice(0,8),[candidatesKey]);
 useEffect(()=>{if(priority||!('IntersectionObserver' in window)){setNear(true);return;}const observer=new IntersectionObserver(rows=>setNear(Boolean(rows[0]?.isIntersecting)),{rootMargin:'200px'});observer.observe(root.current);return()=>observer.disconnect();},[candidatesKey,priority]);
 useEffect(()=>{const reset=()=>setRetry(n=>n+1);window.addEventListener('cat-media-reset',reset);return()=>window.removeEventListener('cat-media-reset',reset);},[]);
 useEffect(()=>{
  setImage('');setError('');
  if(!candidates.length||!near){if(!candidates.length)setError('没有可用照片');return;}
  const abort=new AbortController();let url,lastError;
  const run=async()=>{
   for(const candidate of candidates){
    if(abort.signal.aborted)return;
    try{
     if(isInlineImage(candidate)){setImage(candidate);return;}
     const blob=await getPreviewBlob(candidate,{signal:abort.signal,force:retry>0});
     if(abort.signal.aborted)return;
     url=URL.createObjectURL(blob);setImage(url);return;
    }catch(e){
     lastError=e;
     // Some network timeouts are reported as AbortError by fetch even when
     // the component did not cancel the operation. Only the own signal is final.
     if(abort.signal.aborted)return;
    }
   }
   if(!abort.signal.aborted)setError(lastError?.code==='PHOTO_MISSING'?'飞书照片已失效，请联系管理员更换':lastError?.code==='PHOTO_TOO_LARGE'?'照片文件太大，请联系管理员更换':'照片暂时无法读取');
  };
  void run();
  return()=>{abort.abort();if(url)URL.revokeObjectURL(url);};
 },[candidatesKey,near,retry]);
 return <span ref={root} className={`smart-image ${className}`}>{image&&!error?<img {...props} src={image} alt={alt} decoding="async" onError={()=>setError('图片无法显示')}/>:error?retryable?<button className="photo-retry" type="button" onClick={e=>{e.stopPropagation();setRetry(n=>n+1);}}>{error}<br/><span>点击重试</span></button>:<span className="photo-unavailable">照片暂时无法加载</span>:<span className="photo-loading" role="status" aria-label="照片加载中"/>}</span>;
}
