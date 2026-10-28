import React,{useEffect,useRef,useState} from 'react';
import {getPreviewBlob,isInlineImage} from './media.js';
export default function SmartImage({src,alt='',priority=false,retryable=true,className='',...props}){
 const root=useRef(null),forcedAttempt=useRef(-1),[near,setNear]=useState(priority||!('IntersectionObserver' in window)),[retry,setRetry]=useState(0),[image,setImage]=useState(''),[error,setError]=useState(false);
 useEffect(()=>{if(priority||!('IntersectionObserver' in window)){setNear(true);return;}const observer=new IntersectionObserver(rows=>setNear(Boolean(rows[0]?.isIntersecting)),{rootMargin:'200px'});observer.observe(root.current);return()=>observer.disconnect();},[src,priority]);
 useEffect(()=>{const reset=()=>setRetry(n=>n+1);window.addEventListener('cat-media-reset',reset);return()=>window.removeEventListener('cat-media-reset',reset);},[]);
 useEffect(()=>{setImage('');setError(false);if(!src||!near)return;const abort=new AbortController();let url;
  if(isInlineImage(src)){setImage(src);return()=>abort.abort();}
  getPreviewBlob(src,{signal:abort.signal,force:retry>0&&forcedAttempt.current!==retry}).then(blob=>{if(!abort.signal.aborted){url=URL.createObjectURL(blob);setImage(url);}}).catch(e=>{if(e.name!=='AbortError'&&!abort.signal.aborted)setError(true);});
  forcedAttempt.current=retry;
  return()=>{abort.abort();if(url)URL.revokeObjectURL(url);};
 },[src,near,retry]);
 return <span ref={root} className={`smart-image ${className}`}>{image&&!error?<img {...props} src={image} alt={alt} decoding="async" onError={()=>setError(true)}/>:error?retryable?<button className="photo-retry" type="button" onClick={e=>{e.stopPropagation();setRetry(n=>n+1);}}>照片加载失败<br/><span>点击重试</span></button>:<span className="photo-unavailable">照片待加载</span>:<span className="photo-loading" role="status" aria-label="照片加载中"/>}</span>;
}
