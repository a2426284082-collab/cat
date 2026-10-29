import React,{useEffect,useState} from 'react';
import {readPosterArtifact} from './poster-artifacts.js';
export default function PosterResultCard({artifact,owner,onEdit}){
 const [preview,setPreview]=useState(null),[error,setError]=useState('');
 useEffect(()=>{
  let active=true,url=null;
  setPreview(null);setError('');
  readPosterArtifact({id:artifact.id,owner}).then(row=>{
   if(!active)return;
   if(!row?.blob){setError('本浏览器中找不到原图文件。请恢复任务重新生成；其他设备无法读取此浏览器的图片。');return;}
   url=URL.createObjectURL(row.blob);setPreview(url);
  }).catch(()=>{if(active)setError('图片读取失败，请恢复任务重新生成。');});
  return()=>{active=false;if(url)URL.revokeObjectURL(url);};
 },[artifact.id,owner]);
 const filename=`petcloud-${artifact.catIds?.length||'cats'}-${artifact.id.slice(0,8)}.png`;
 return <section className="agent-poster-artifact" aria-label="真实生成的拼图成果">
  <b>已生成拼图 · {artifact.width} × {artifact.height}</b>
  {preview?<img src={preview} alt="已生成的真实猫咪拼图PNG预览" className="agent-poster-artifact-image"/>:<p role={error?'alert':'status'}>{error||'正在从浏览器读取已生成的拼图…'}</p>}
  {!artifact.persisted&&<small>图片仅保留在当前页面会话。请立即下载，刷新后可能无法恢复。</small>}
  <div className="agent-poster-artifact-actions">
   {preview&&<a href={preview} download={filename}>下载高清PNG</a>}
   {onEdit&&<button type="button" onClick={onEdit}>打开编辑器手动修改</button>}
  </div>
  <small>图片已生成不代表已下载到设备；请点击下载后确认保存。</small>
 </section>;
}
