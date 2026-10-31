import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,ChevronLeft,ChevronRight,Eye,EyeOff,ImageOff,Maximize2,PlayCircle,RefreshCw,Search,SlidersHorizontal,Sparkles,Star,X} from 'lucide-react';
import {catalogOrder,salesDate,readShuffleRound,saveShuffleRound,orderKey,ORDER_STORAGE_KEY} from './workspace/distribution.js';
import SmartImage from './workspace/SmartImage.jsx';
import {useFollowups} from './workspace/followups.jsx';
import {parseAgeMonths} from '../cloud-functions/_lib/sales-demand.js';
import './workspace/catalog-filters.css';
import {parseDemandLocally} from '../cloud-functions/_lib/smart-search.js';
import {WORKSPACE_FEATURES} from './workspace/features.js';
import CatVideoPlayer from './components/CatVideoPlayer.jsx';
import {useCatalog} from './workspace/catalog.jsx';
import {useSalesSession} from './workspace/SalesSession.jsx';
import {displayText,money,normalizeId,shortIdMap,displayedPrice} from './workspace/presentation.js';
const blank={query:'',breed:'',color:'',gender:'',min:'',max:'',minAge:'',maxAge:''};
const age=value=>/^\d+(?:\.\d+)?$/.test(String(value||''))?value+'个月':value||'月龄待确认';
export default function App({embedded=false,onAsk,onCompare,compareIds=[],onDetail,hidePrices=false,customerDisplay={enabled:hidePrices,markup:0},onCustomerDisplay,agentCommand}){
 const {cats,loading,error,lastUpdated,refresh}=useCatalog(),{busy,checking,listingIdentity,user}=useSalesSession();const [filters,setFilters]=useState(blank),[open,setOpen]=useState(false),[priceBasis,setPriceBasis]=useState('customer'),[count,setCount]=useState(12),[video,setVideo]=useState(null),[photo,setPhoto]=useState(null);const more=useRef(null),followups=useFollowups();
 const [day,setDay]=useState(()=>salesDate()),[manual,setManual]=useState(null),[orderRevision,setOrderRevision]=useState(0);
 const currentOrderKey=orderKey(listingIdentity,day),round=manual?.key===currentOrderKey?manual.round:readShuffleRound(listingIdentity,day);
 useEffect(()=>{const updateDay=()=>setDay(salesDate()),storage=e=>{if(e.key===ORDER_STORAGE_KEY){setManual(null);setOrderRevision(v=>v+1);}};const timer=setInterval(updateDay,30000);window.addEventListener('focus',updateDay);window.addEventListener('storage',storage);return()=>{clearInterval(timer);window.removeEventListener('focus',updateDay);window.removeEventListener('storage',storage);};},[]);
 const orderedCats=useMemo(()=>catalogOrder(cats,listingIdentity,day,round),[cats,listingIdentity,day,round,orderRevision]);
 const labels=useMemo(()=>shortIdMap(cats),[cats]),breeds=[...new Set(cats.map(c=>c.breed).filter(Boolean))].sort(),colors=[...new Set(cats.map(c=>c.color).filter(Boolean))].sort();
 const allowWholesale=Boolean(user&&!user.is_guest&&!hidePrices),basis=allowWholesale?priceBasis:'customer';
 const canSeePrices=Boolean(user&&!user.is_guest),markup=user?.is_guest?0:Number(customerDisplay.markup??0);
 useEffect(()=>{if(!canSeePrices)setFilters(old=>({...old,min:'',max:''}));},[canSeePrices]);
 const rangeError=(()=>{
  for(const [low,high,name] of [['min','max','预算'],['minAge','maxAge','月龄']]){
   if([low,high].some(key=>filters[key]!==''&&(!Number.isFinite(Number(filters[key]))||Number(filters[key])<0)))return name+'请输入不小于0的数字';
   if(filters[low]!==''&&filters[high]!==''&&Number(filters[low])>Number(filters[high]))return name+'下限不能高于上限';
  }
  return '';
 })();
 const filtered=useMemo(()=>rangeError?[]:orderedCats.filter(c=>{
  const q=filters.query.trim().toLowerCase(),months=parseAgeMonths(c.age);
  const base=c.price!==null&&c.price!==undefined&&c.price!==''?Number(c.price):NaN;
  const price=Number.isFinite(base)&&base>=0?base+(basis==='customer'?markup:0):null;
  return (!q||[c.id,c.breed,c.color,labels.get(normalizeId(c.id))].some(x=>String(x||'').toLowerCase().includes(q)))
   &&(!filters.breed||c.breed===filters.breed)&&(!filters.color||c.color===filters.color)&&(!filters.gender||c.gender===filters.gender)
   &&(!canSeePrices||filters.min===''||(price!==null&&price>=Number(filters.min)))&&(!canSeePrices||filters.max===''||(price!==null&&price<=Number(filters.max)))
   &&(filters.minAge===''||(months!==null&&months>=Number(filters.minAge)))&&(filters.maxAge===''||(months!==null&&months<=Number(filters.maxAge)));
 }),[orderedCats,filters,labels,basis,markup,rangeError,canSeePrices]);
 useEffect(()=>setCount(12),[filters,listingIdentity,day,round,basis,markup]);useEffect(()=>{if(!more.current||count>=filtered.length||!('IntersectionObserver' in window))return;const observer=new IntersectionObserver(entries=>{if(entries[0]?.isIntersecting)setCount(v=>Math.min(v+12,filtered.length));},{rootMargin:'120px'});observer.observe(more.current);return()=>observer.disconnect();},[count,filtered.length]);
 function reshuffle(){let next=round+1;const old=filtered.map(c=>c.id).join('|'),visible=new Set(filtered.map(c=>c.id));for(let attempt=0;attempt<12;attempt++,next++){const changed=catalogOrder(cats,listingIdentity,day,next).filter(c=>visible.has(c.id)).map(c=>c.id).join('|');if(changed!==old)break;}saveShuffleRound(listingIdentity,day,next);setManual({key:currentOrderKey,round:next});}
 useEffect(()=>{if(!agentCommand?.id)return;if(agentCommand.clear)setFilters(blank);else if(agentCommand.query){const parsed=parseDemandLocally(agentCommand.query,{breeds,colors}).filters;if(Object.values(parsed).some(Boolean)){setFilters(old=>{const next={...old};for(const key of Object.keys(blank))if(parsed[key]!==''&&parsed[key]!=null)next[key]=parsed[key];return next;});setOpen(true);}}if(agentCommand.shuffle)reshuffle();},[agentCommand?.id]);
 const field=(key,value)=>setFilters(old=>({...old,[key]:value})),hasFilters=Object.values(filters).some(value=>value!=='');
 const interval=(low,high,unit)=>low!==''&&high!==''?`${low}–${high}${unit}`:low!==''?`≥${low}${unit}`:`≤${high}${unit}`;
 const chips=[...['breed','gender','color','query'].filter(key=>filters[key]!=='').map(key=>({keys:[key],text:({breed:'品种',gender:'性别',color:'花色',query:'关键词'})[key]+'：'+filters[key]})),
  ...(filters.min!==''||filters.max!==''?[{keys:['min','max'],text:(basis==='customer'?'对客预算':'供货预算')+'：'+interval(filters.min,filters.max,'元')}]:[]),
  ...(filters.minAge!==''||filters.maxAge!==''?[{keys:['minAge','maxAge'],text:'月龄：'+interval(filters.minAge,filters.maxAge,'个月')}]:[])];
 const advancedCount=['query','color','minAge','maxAge'].filter(key=>filters[key]!=='').length;
 const selector=(key,label,items)=><label className={'catalog-filter-field catalog-filter-'+key}><span>{label}</span><select aria-label={label} value={filters[key]} onChange={e=>field(key,e.target.value)}><option value="">{label==='性别'?'不限性别':'全部'+label}</option>{items.map(v=><option key={v} value={v}>{v}</option>)}</select></label>;
 const range=(low,high,label,placeholders)=><fieldset className={'catalog-filter-field catalog-filter-'+low}><legend>{label}</legend><div className="catalog-range-inputs"><input type="number" min="0" step="any" disabled={low==='min'&&!canSeePrices} aria-label={placeholders[0]} value={filters[low]} onChange={e=>field(low,e.target.value)} placeholder={placeholders[0]}/><span aria-hidden="true">—</span><input type="number" min="0" step="any" disabled={low==='min'&&!canSeePrices} aria-label={placeholders[1]} value={filters[high]} onChange={e=>field(high,e.target.value)} placeholder={placeholders[1]}/></div></fieldset>;
 const headerTarget=embedded?document.getElementById('catalog-header-status'):null;
 const stockStatus=<div className="catalog-status"><span><i className={error?'warning':''}/><b>{cats.length}只在售</b><span> · 约15分钟自动检查</span><small>{lastUpdated?' · '+new Intl.DateTimeFormat('zh-CN',{hour:'2-digit',minute:'2-digit'}).format(new Date(lastUpdated)):''}</small></span><button onClick={()=>refresh({manual:true})} disabled={loading}><RefreshCw size={14} className={loading?'animate-spin':''}/>刷新</button><div className="catalog-tools"><button disabled={checking||filtered.length<2} onClick={reshuffle}>🔀 随机换一批</button></div></div>;
 return <div className="workspace-catalog"><div className="workspace-catalog-main">{headerTarget?createPortal(stockStatus,headerTarget):stockStatus}
 <section className={'catalog-filters catalog-filters-always'+(open?' advanced-open':'')} aria-label="猫源筛选">
  <div className="catalog-basic-filters">
   {selector('breed','品种',breeds)}
   {range('min','max','预算范围（元）',['最低价格','最高价格'])}
   {selector('gender','性别',['公','母'])}
   {range('minAge','maxAge','月龄范围（月）',['最小月龄','最大月龄'])}
  </div>
  <div className="catalog-extra-filters" id="catalog-extra-filters" hidden={!open}>
   <label className="catalog-filter-field catalog-search-field"><span>编号 / 关键词</span><span className="catalog-search"><Search size={15}/><input aria-label="编号或关键词" value={filters.query} onChange={e=>field('query',e.target.value)} placeholder="短编号、品种、花色"/></span></label>
   {selector('color','花色',colors)}
  </div>
  <div className="catalog-filter-footer">
   <button className="catalog-more-filters" aria-expanded={open} aria-controls="catalog-extra-filters" onClick={()=>setOpen(v=>!v)}><SlidersHorizontal size={14}/>{open?'收起更多筛选':'更多筛选'}{!open&&advancedCount>0?' · 已设置':''}</button>
   {allowWholesale&&<label className="catalog-price-basis">预算口径<select aria-label="预算价格口径" value={basis} onChange={e=>setPriceBasis(e.target.value)}><option value="customer">对客价（含加价）</option><option value="wholesale">供货价</option></select></label>}
   <button className="catalog-reset" disabled={!hasFilters} onClick={()=>setFilters(blank)}>清空筛选</button>
  </div>
  <p className="catalog-filter-hint">{basis==='wholesale'?'按供货价筛选':allowWholesale?'按对客价筛选，已计入加价 '+money(markup):'合作价格需代理激活后查看；预算需求仍可向AI顾问提问'} · 直接更新结果，不消耗AI次数</p>
  {rangeError&&<p className="catalog-filter-error" role="alert">{rangeError}</p>}
 </section>
 {error&&<p className="sales-ai-error" role="alert">{error}</p>}
 <div className="catalog-filter-summary" aria-live="polite"><b>找到 {filtered.length} 只猫咪</b>{chips.length>0&&<div className="catalog-filter-chips">{chips.map(chip=><button key={chip.keys[0]} aria-label={'移除筛选：'+chip.text} onClick={()=>setFilters(old=>{const next={...old};for(const key of chip.keys)next[key]='';return next;})}>{chip.text}<X size={12} aria-hidden="true"/></button>)}</div>}</div>
 {(loading&&!cats.length||checking)?<div className="catalog-card-grid" role="status" aria-label="正在加载猫咪">{Array.from({length:8},(_,i)=><div key={i} className="catalog-skeleton"/>)}</div>:filtered.length?<div className="catalog-card-grid">{filtered.slice(0,count).map((cat,index)=><CatCard key={cat.id} cat={cat} label={labels.get(normalizeId(cat.id))} allCats={cats} onBookmark={()=>followups.bookmark(cat,cat.price==null?null:Number(cat.price)+(customerDisplay.markup??0))} bookmarked={followups.entries.some(r=>normalizeId(r.catId)===normalizeId(cat.id))} priority={index<4} hidePrices={hidePrices} customerDisplay={customerDisplay} busy={busy} comparing={compareIds.includes(cat.id)} onAsk={action=>onAsk?.(cat,action)} onCompare={()=>onCompare?.(cat)} onDetail={()=>onDetail?.(cat)} onPlay={()=>setVideo(cat)} onPhoto={()=>setPhoto(cat)}/>)}</div>:<div className="workspace-empty">没有符合这些条件的在售猫咪，请调整筛选条件。</div>}
 {count<filtered.length&&<div className="catalog-more" ref={more}><button onClick={()=>setCount(v=>v+12)}>加载更多猫咪（已显示{Math.min(count,filtered.length)}只）</button></div>}
 </div>{video&&<Video cat={video} close={()=>setVideo(null)}/>} {photo&&<Photo cat={photo} close={()=>setPhoto(null)}/>}</div>;
}
function CatCard({cat,label,allCats,onBookmark,bookmarked,priority,hidePrices,customerDisplay,busy,comparing,onAsk,onCompare,onDetail,onPlay,onPhoto}){
 const [menu,setMenu]=useState(false),root=useRef(null);useEffect(()=>setMenu(false),[hidePrices]);useEffect(()=>{if(!menu)return;const outside=e=>{if(!root.current?.contains(e.target))setMenu(false);};const escape=e=>{if(e.key==='Escape')setMenu(false);};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};},[menu]);
 return <article className="workspace-stock-card" aria-label={`${label} ${cat.breed||'在售猫咪'}`}><div className="catalog-photo">{cat.image?<SmartImage src={cat.image} sources={cat.images} priority={priority} width="640" height="480" alt={cat.breed||'在售猫咪'}/>:<div className="catalog-no-photo"><span style={{display:'grid',justifyItems:'center',gap:8,textAlign:'center',fontSize:12}}><ImageOff size={28}/><span>暂无照片，请联系管理员补充</span></span></div>}<b className="catalog-short-id">{label}</b><button className={"catalog-proposal-add"+(comparing?" selected":"")} aria-label={(comparing?"移出":"加入")+"提案车 "+label} aria-pressed={comparing} onClick={onCompare}>{comparing?"✓":"＋"}</button>{WORKSPACE_FEATURES.followups&&!hidePrices&&<button className={`catalog-bookmark${bookmarked?' saved':''}`} aria-label={`收藏/记报价 ${label}`} onClick={onBookmark}><Star size={18} fill={bookmarked?'currentColor':'none'}/></button>}{cat.image&&<button className="catalog-photo-expand" aria-label={`查看${label}大图`} onClick={onPhoto}><Maximize2 size={17}/></button>}{cat.videos?.length>0&&<button className="catalog-video" aria-label={`播放${label}视频`} onClick={onPlay}><PlayCircle size={18}/></button>}</div><div className="catalog-card-body"><h3><span className="catalog-title-id">{label}</span> {cat.breed||'猫咪'} · {cat.color||'花色待补充'}</h3><p>{cat.gender||'性别待确认'} · {age(cat.age)} · 疫苗{cat.vaccine||'待确认'}</p><p className="catalog-description">{displayText(cat.description||'更多资料请联系运营确认。',allCats,hidePrices)}</p><div className="catalog-price"><span>{displayedPrice(cat,customerDisplay)!=null&&<><small>{hidePrices?'售价':'合作底价'}</small><strong>{money(displayedPrice(cat,customerDisplay))}</strong></>}</span><button onClick={onDetail}>查看资料</button></div></div>{!hidePrices&&<details className="catalog-card-tools"><summary className="catalog-more-filters">工具箱</summary><div className="workspace-card-actions" ref={root}><button aria-expanded={menu} disabled={busy} onClick={()=>setMenu(v=>!v)}><Sparkles size={14}/>写话术</button><button aria-pressed={comparing} onClick={onCompare}>{comparing?<Check size={14}/>:<span aria-hidden="true">➕</span>}{comparing?'已选择':'加入对比/拼图'}</button>{menu&&<div className="catalog-script-options" role="group" aria-label={`${label}话术选项`}><button onClick={()=>{setMenu(false);onAsk('praise');}}>夸这只猫骨相甜美</button><button onClick={()=>{setMenu(false);onAsk('price');}}>客户嫌贵保价逼单</button></div>}</div></details>}</article>;
}
function Video({cat,close}){const [i,setI]=useState(0);if(!cat.videos?.length)return null;return <div className="fixed inset-0 z-50 bg-black/85 p-4 grid place-items-center"><div className="w-full max-w-4xl"><div className="mb-3 flex justify-between text-white"><b>{cat.breed} · {cat.id}</b><button onClick={close}><X/></button></div><CatVideoPlayer key={cat.videos[i].url} url={cat.videos[i].url}/>{cat.videos.length>1&&<div className="mt-3 flex gap-2">{cat.videos.map((v,n)=><button key={v.url} onClick={()=>setI(n)} className={`rounded-lg px-3 py-2 text-sm ${i===n?'bg-orange-500 text-white':'bg-white'}`}>视频 {n+1}</button>)}</div>}</div></div>}
function Photo({cat,close}){const images=cat.images?.length?cat.images:[cat.image].filter(Boolean),[i,setI]=useState(0);return <div className="fixed inset-0 z-50 bg-black/90 p-4 flex items-center justify-center"><button className="absolute top-5 right-5 text-white" onClick={close}><X/></button>{images.length?<div className="relative w-full max-w-5xl flex justify-center"><SmartImage src={images[i]} className="max-h-[85vh] object-contain" alt="猫咪大图"/>{images.length>1&&<><button onClick={()=>setI((i-1+images.length)%images.length)} className="absolute left-0 top-1/2 text-white"><ChevronLeft size={35}/></button><button onClick={()=>setI((i+1)%images.length)} className="absolute right-0 top-1/2 text-white"><ChevronRight size={35}/></button></>}</div>:<ImageOff className="text-white"/>}</div>}
