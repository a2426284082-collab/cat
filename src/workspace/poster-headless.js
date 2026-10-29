import {renderMarketingCanvas,canvasBlob,retailPrice,randomSeed} from './marketing.js';
import {releaseCanvas} from './media.js';
import {savePosterArtifact} from './poster-artifacts.js';

export function posterRenderOptions(cats,settings={}){
 const markup=Number(settings.markup??800);
 if(!Number.isFinite(markup)||markup<0||markup>100000)throw new Error('对客加价不合法，请检查报价设置');
 const includePrices=settings.includePrices!==false;
 const prices={};
 for(const cat of cats){
  const price=Object.hasOwn(settings.overrides||{},cat.id)?Number(settings.overrides[cat.id]):retailPrice(cat,markup);
  if(includePrices&&(!Number.isFinite(price)||price<Number(cat.price)||price>1000000))throw new Error(`猫咪 ${cat.id} 的售价无效或低于合作价`);
  prices[cat.id]=price;
 }
 return {template:includePrices?'price':'sign',includePrices,borderless:settings.borderless===true,
  bannerEnabled:settings.bannerEnabled===true,height:settings.height===1440?1440:1080,
  mirrorEnabled:settings.mirrorEnabled!==false,platform:settings.platform||'moments',
  seed:Number.isInteger(settings.designSeed)?settings.designSeed:randomSeed(),prices,
  bannerText:settings.bannerText||'',shop:settings.shop||''};
}
const running=new Map();
export async function renderPosterHeadless({cats,settings,owner,taskId,goalId,signal,onProgress,renderCanvas=renderMarketingCanvas,exportCanvas=canvasBlob}){
 if(!Array.isArray(cats)||cats.length<2||cats.length>9)throw new Error('请选2至9只有照片的猫咪');
 if(new Set(cats.map(c=>c.id)).size!==cats.length)throw new Error('拼图不能包含重复猫咪');
 if(cats.some(c=>(c.status&&c.status!=='在售')||!c.image))throw new Error('猫咪缺少照片或已经不在售，不能生成拼图');
 const options=posterRenderOptions(cats,settings),key=JSON.stringify({owner,taskId,goalId,ids:cats.map(c=>c.id),options});
 if(running.has(key))return running.get(key);
 const work=(async()=>{
  let canvas;
  try{
   if(signal?.aborted)throw new Error('做图任务已取消');
   canvas=document.createElement('canvas');
   onProgress?.({stage:'loading',loaded:0,total:cats.length,label:`正在读取照片 1/${cats.length}`});
   await renderCanvas(canvas,cats,options,{signal,onProgress:(loaded,total)=>{
    onProgress?.(loaded===total?{stage:'composing',loaded,total,label:'照片加载完成，正在合成PNG'}:
     {stage:'loading',loaded,total,label:`正在读取照片 ${loaded+1}/${total}`});
   }});
   if(signal?.aborted)throw new Error('做图任务已取消');
   onProgress?.({stage:'exporting',loaded:cats.length,total:cats.length,label:'正在导出高清PNG'});
   const blob=await exportCanvas(canvas);
   if(signal?.aborted)throw new Error('做图任务已取消');
   const stored=await savePosterArtifact({owner,blob,taskId:taskId||null,goalId:goalId||null,
    catIds:cats.map(c=>c.id),settings:{...settings,designSeed:options.seed},width:canvas.width,height:canvas.height});
   const artifact={id:stored.id,taskId:taskId||null,goalId:goalId||null,catIds:cats.map(c=>c.id),
    width:canvas.width,height:canvas.height,bytes:stored.bytes,persisted:stored.persisted,designSeed:options.seed,mime:'image/png'};
   onProgress?.({stage:'done',loaded:cats.length,total:cats.length,label:stored.persisted?'图片已生成并保存在此浏览器':'图片已生成，浏览器存储失败，请立即下载'});
   return artifact;
  }catch(error){onProgress?.({stage:'error',label:String(error.message||'图片生成失败')});throw error;}
  finally{releaseCanvas(canvas);}
 })();
 running.set(key,work);try{return await work;}finally{running.delete(key);}
}
