import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Copy,Download,RefreshCw,Shuffle,Sparkles} from 'lucide-react';
import Dialog from './Dialog.jsx';
import {useSalesSession} from './SalesSession.jsx';
import {canvasBlob,generateDesign,marketingDraft,pickMarketingCats,PRICE_TAG_NAMES,randomSeed,renderMarketingCanvas,retailPrice,shufflePhotoOrder,validPrice} from './marketing.js';
import {money,normalizeId,shortIdMap} from './presentation.js';
import {releaseCanvas} from './media.js';
import CommentTips from './CommentTips.jsx';

export default function MarketingStudio({initialCats,initialTemplate='price',allCats,close}){
 const {ask,busy,cooldown,user,epoch}=useSalesSession();
 const [cats,setCats]=useState(initialCats),[design,setDesign]=useState(()=>generateDesign()),[includePrices,setIncludePrices]=useState(initialTemplate!=='sign');
 const [bannerEnabled,setBannerEnabled]=useState(initialTemplate==='sign'),[customBanner,setCustomBanner]=useState(null),[mirrorEnabled,setMirrorEnabled]=useState(true);
 const [height,setHeight]=useState(1080),[markup,setMarkup]=useState(800),[overrides,setOverrides]=useState({}),[shop,setShop]=useState('同城靠谱猫舍'),[city,setCity]=useState(''),[platform,setPlatform]=useState('xhs');
 const [renderState,setRenderState]=useState('loading'),[renderError,setRenderError]=useState(''),[renderRetry,setRenderRetry]=useState(0);
 const [caption,setCaption]=useState(null),[aiError,setAiError]=useState(''),[generating,setGenerating]=useState(false),[copied,setCopied]=useState(false);
 const [exportError,setExportError]=useState(''),[download,setDownload]=useState(null),[note,setNote]=useState(''),[exporting,setExporting]=useState(false);
 const [hasPreview,setHasPreview]=useState(false),[progress,setProgress]=useState(''),[freshExport,setFreshExport]=useState(false);
 const renderTail=useRef(Promise.resolve());
 const template=includePrices?'price':'sign',bannerText=customBanner??`${city}${shop} · 真实在售 · 支持看视频`;
 const exportController=useRef(null),exportLock=useRef(false),visible=useRef(null),readyCanvas=useRef(null),alive=useRef(true),timer=useRef(null),revision=useRef('');
 const labels=useMemo(()=>shortIdMap(allCats),[allCats]);
 const prices=useMemo(()=>Object.fromEntries(cats.map(c=>[c.id,Object.hasOwn(overrides,c.id)?(validPrice(overrides[c.id])?Math.round(Number(overrides[c.id])):null):retailPrice(c,markup)])),[cats,overrides,markup]);
 const options=useMemo(()=>({template,includePrices,design,mirrorEnabled,bannerEnabled,bannerText,height,prices,shop,city,platform}),[template,includePrices,design,mirrorEnabled,bannerEnabled,bannerText,height,prices,shop,city,platform]);
 const fingerprint=JSON.stringify([cats.map(c=>[c.id,c.image,c.price,c.description]),options]);revision.current=fingerprint;
 const captionKey=JSON.stringify([cats.map(c=>c.id),template,prices,shop,city,platform,bannerEnabled,bannerEnabled?bannerText:'']);
 const captionRevision=useRef(captionKey);captionRevision.current=captionKey;
 const draft=useMemo(()=>marketingDraft(cats,options),[cats,options]),currentCaption=caption?.key===captionKey?caption.text:draft;
 const valid=validPrice(markup)&&Number.isInteger(Number(markup))&&Number(markup)<=100000&&(!includePrices||cats.every(c=>validPrice(prices[c.id])&&(c.price==null||prices[c.id]>=Number(c.price))))&&(!bannerEnabled||Boolean(bannerText.trim()));
 useEffect(()=>{setCaption(null);setAiError('');},[epoch]);
 useEffect(()=>{alive.current=true;const display=visible.current;return()=>{releaseCanvas(display);alive.current=false;exportController.current?.abort();clearTimeout(timer.current);releaseCanvas(readyCanvas.current?.canvas);};},[]);
 useEffect(()=>{if(!download)return;return()=>URL.revokeObjectURL(download.url);},[download]);
 useEffect(()=>{
  const abort=new AbortController();exportController.current?.abort();releaseCanvas(readyCanvas.current?.canvas);readyCanvas.current=null;setDownload(null);setRenderState('loading');setRenderError('');setExportError('');setCopied(false);
  if(!valid){setRenderState('error');setRenderError('请核对整数加价、各只猫咪售价与招牌文字；售价不能低于合作底价。');return()=>abort.abort();}
  const wait=setTimeout(()=>{
   const run=async()=>{if(abort.signal.aborted)return;let stage;
    try{stage=document.createElement('canvas');const seed=randomSeed();await renderMarketingCanvas(stage,cats,{...options,seed},{signal:abort.signal,onProgress:(done,total)=>{if(!abort.signal.aborted)setProgress(`照片 ${done}/${total}`);}});if(abort.signal.aborted){releaseCanvas(stage);return;}
     const canvas=visible.current,ctx=canvas?.getContext('2d');if(!ctx)throw new Error('当前浏览器暂不支持图片预览');canvas.width=stage.width;canvas.height=stage.height;ctx.drawImage(stage,0,0);readyCanvas.current={canvas:stage,key:fingerprint,seed};setHasPreview(true);setRenderState('ready');setProgress('');
    }catch(e){releaseCanvas(stage);if(!abort.signal.aborted){setRenderState('error');setRenderError(e.message||'拼图生成失败，请重试');setProgress('');}}
   };
   renderTail.current=renderTail.current.catch(()=>{}).then(run);
  },450);
  return()=>{clearTimeout(wait);abort.abort();};
 },[fingerprint,renderRetry,valid]);
 function changeBatch(){const next=pickMarketingCats(allCats,cats.map(c=>c.id));if(!next.length){setNote('当前至少需要2只有照片的在售猫咪。');return;}setCats(next);setOverrides({});setNote(`已从完整图库重选${next.length}只，优先覆盖不同品种。`);}
 function changeDesign(){let next=generateDesign();for(let i=0;i<5&&next.background===design.background&&next.gap===design.gap&&next.radius===design.radius&&next.tagShape===design.tagShape;i++)next=generateDesign();setDesign(next);}
 function shufflePhotos(){setCats(shufflePhotoOrder(cats));setNote('猫咪格子顺序已打乱，单只售价保持不变。');}
 async function generate(){
  if(generating||!valid)return;const key=captionKey;setGenerating(true);setAiError('');
  try{const response=await ask({mode:'script',action:'marketing',cat_ids:cats.map(c=>normalizeId(c.id)),marketing:{template,platform,city,shop,prices:cats.map(c=>prices[c.id])}});if(alive.current&&captionRevision.current===key)setCaption({key,text:response.reply_text,ai:true});}
  catch(e){if(alive.current&&!e.cancelled)setAiError(e.message);}finally{if(alive.current)setGenerating(false);}
 }
 async function exportPNG(){
  const ready=readyCanvas.current,key=fingerprint;if(exportLock.current||!ready||ready.key!==key)return;
  exportLock.current=true;setExporting(true);setExportError('');const controller=new AbortController();exportController.current=controller;
  let stage=ready.canvas,owned=false;
  try{
   let seed=ready.seed;
   if(freshExport){await renderTail.current.catch(()=>{});if(controller.signal.aborted)return;stage=document.createElement('canvas');owned=true;seed=randomSeed();if(seed===ready.seed)seed=(seed+1)>>>0;await renderMarketingCanvas(stage,cats,{...options,seed},{signal:controller.signal});}
   const blob=await canvasBlob(stage);if(!alive.current||controller.signal.aborted||revision.current!==key){if(owned)releaseCanvas(stage);return;}
   if(owned){const canvas=visible.current;canvas.width=stage.width;canvas.height=stage.height;canvas.getContext('2d').drawImage(stage,0,0);releaseCanvas(ready.canvas);readyCanvas.current={canvas:stage,key,seed};}
   const url=URL.createObjectURL(blob),name=`petcloud-collage-${cats.length}-${height}-${seed.toString(36)}.png`;setDownload({url,name});const anchor=document.createElement('a');anchor.href=url;anchor.download=name;document.body.appendChild(anchor);anchor.click();anchor.remove();
  }catch(e){if(owned)releaseCanvas(stage);if(alive.current&&!controller.signal.aborted)setExportError(e.message);}finally{exportLock.current=false;if(alive.current)setExporting(false);}
 }
 async function copy(){try{await navigator.clipboard.writeText(currentCaption);setCopied(true);clearTimeout(timer.current);timer.current=setTimeout(()=>setCopied(false),2000);}catch{setAiError('复制失败，请在文案框内长按全选复制。');}}
 return <Dialog title="营销拼图与文案" close={close} explicitCloseOnly className="marketing-dialog">
  <div className="marketing-studio"><section className="marketing-visual" aria-label="海报预览与下载">
   <div className="marketing-preview" style={{aspectRatio:`1080 / ${height}`,'--poster-ratio':1080/height}}>
    <canvas ref={visible} aria-label={`${cats.length}图营销海报`} role="img" hidden={!hasPreview}/>
    {renderState!=='ready'&&<div className="marketing-preview-state" role={renderError?'alert':'status'}>{renderError||'正在更新海报…'}{progress&&<small className="poster-progress">{progress}</small>}{renderError&&<button onClick={()=>setRenderRetry(v=>v+1)}>重新加载照片</button>}</div>}
   </div>
   <div className="marketing-export"><button className="workspace-primary" disabled={renderState!=='ready'||exporting} onClick={exportPNG}><Download size={16}/>{exporting?'正在导出…':'下载高清PNG'}</button></div>
   <div className="marketing-procedural-tools" role="group" aria-label="调整排版与选猫"><button aria-label="随机换排版" onClick={changeDesign}>🎲 随机换排版</button><button aria-label="打乱顺序" onClick={shufflePhotos}>🔀 打乱顺序</button><button aria-label="换一批猫" onClick={changeBatch}>🔄 换一批猫</button></div>
   <div className="marketing-design-summary"><i style={{background:design.background}}/>{PRICE_TAG_NAMES[design.tagShape]} · {design.gap===0?'无缝拼接':'留白画框'} · {design.radius===0?'利落直角':'柔和圆角'}</div>
   <small className="marketing-export-meta">1080 × {height} · 本地合成不扣AI次数</small>
   {download&&<a className="marketing-save-link" href={download.url} download={download.name} target="_blank" rel="noreferrer">未自动保存？打开图片后长按保存</a>}
   {exportError&&<p role="alert" className="sales-ai-error">{exportError}</p>}
  </section><section className="marketing-controls" aria-label="海报设置与文案" tabIndex={0}>
   <div className="marketing-settings"><h2>排版与报价</h2>
    <fieldset className="marketing-basics"><legend className="sr-only">海报基础设置</legend>
     <label>导出尺寸<select value={height} onChange={e=>setHeight(Number(e.target.value))}><option value={1080}>1080 × 1080 方图</option><option value={1440}>1080 × 1440 竖图</option></select></label>
     <label>统一加价（元）<input type="number" min="0" max="100000" step="1" value={markup} onChange={e=>{setMarkup(e.target.value);setOverrides({});}}/></label>
     <label className="marketing-check"><input type="checkbox" checked={includePrices} onChange={e=>setIncludePrices(e.target.checked)}/>显示售价标签</label>
     <label className="marketing-check"><input type="checkbox" checked={mirrorEnabled} onChange={e=>setMirrorEnabled(e.target.checked)}/>允许照片随机镜像</label>
    </fieldset>
    <label className="marketing-banner-toggle marketing-check"><input type="checkbox" checked={bannerEnabled} onChange={e=>setBannerEnabled(e.target.checked)}/>叠加猫舍招牌贴纸</label>
    {bannerEnabled&&<div className="marketing-banner-fields"><div className="marketing-fields"><label>所在城市<input maxLength={12} value={city} placeholder="例如：杭州" onChange={e=>setCity(e.target.value)}/></label><label>猫舍 / 店铺名<input maxLength={20} value={shop} onChange={e=>setShop(e.target.value)}/></label></div><label className="marketing-banner-input">招牌文字<textarea maxLength={60} rows={2} value={bannerText} onChange={e=>setCustomBanner(e.target.value)}/></label></div>}
    <details className="marketing-cat-prices" open={includePrices}><summary>已选{cats.length}只 · 单只售价可微调</summary>{cats.map((cat,i)=><label key={cat.id}><span>{i+1}. {labels.get(normalizeId(cat.id))} · {cat.breed}<small>合作底价 {money(cat.price)}</small></span><input aria-label={`${labels.get(normalizeId(cat.id))}海报售价`} type="number" min="0" max="1000000" value={Object.hasOwn(overrides,cat.id)?overrides[cat.id]:prices[cat.id]??''} onChange={e=>setOverrides(old=>({...old,[cat.id]:e.target.value}))}/><span>元</span></label>)}</details>
    {note&&<p className="marketing-note" role="status">{note}</p>}
    <details className="marketing-advanced"><summary>更多出图选项与说明</summary><label className="marketing-check"><input type="checkbox" checked={freshExport} onChange={e=>setFreshExport(e.target.checked)}/>下载时重新微调构图（稍慢）</label><p>默认直接保存预览成品。原图有文字或水印时，可关闭镜像；发图前请核对库存、价格和原图文字。</p></details>
   </div>
   <section className="marketing-copy" aria-label="营销文案">
    <span className="marketing-eyebrow">PHOTO → POST</span><h2>图已排好，配一句好文案</h2><p>基础文案可直接改；AI润色沿用工号配额，每次1次。</p>
    <div className="marketing-platform" role="group" aria-label="发布平台"><button aria-pressed={platform==='xhs'} onClick={()=>setPlatform('xhs')}>小红书 · Emoji与标签</button><button aria-pressed={platform==='moments'} onClick={()=>setPlatform('moments')}>朋友圈 · 自然推荐</button></div>
    <label className="marketing-caption-label" htmlFor="marketing-caption">{caption?.key===captionKey&&caption.ai?'AI种草文案':'基础文案 · 可编辑'}</label>
    <textarea id="marketing-caption" value={currentCaption} onChange={e=>{setCaption({key:captionKey,text:e.target.value,ai:caption?.ai});setCopied(false);}} rows={10} maxLength={1600}/>
    <div className="marketing-copy-actions"><button className="workspace-primary" disabled={busy||generating||cooldown>0||!valid||user?.remaining===0} onClick={generate}><Sparkles size={15}/>{generating?'正在生成…':cooldown?`等待${cooldown}秒`:'AI生成文案（1次）'}</button><button onClick={copy}><Copy size={15}/>{copied?'已复制文案':'复制文案'}</button></div>
    {aiError&&<p role="alert" className="sales-ai-error">{aiError}</p>}<small>改猫咪、改价或改店名后，文案会同步回到基础版；AI生成需再次点击。图片与文案均可先预览，再自行发布。</small>
    <CommentTips/>
   </section>
  </section></div>
 </Dialog>;
}
