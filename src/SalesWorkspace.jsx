import React,{lazy,Suspense,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {BrowserRouter,Link,useLocation,useNavigate} from 'react-router-dom';
import {ArrowLeft,ArrowRight,BookOpen,Cat,Check,ChevronRight,GraduationCap,LayoutGrid,MessageSquare,RefreshCw,ShieldCheck,Sparkles,X} from 'lucide-react';
import SalesAI,{AIResult} from './components/SalesAI.jsx';
import {SalesSessionProvider,SalesAccount,useSalesSession} from './workspace/SalesSession.jsx';
import Dialog from './workspace/Dialog.jsx';
import {displayText,money,normalizeId,shortIdMap,priceSettings,displayedPrice} from './workspace/presentation.js';
import {CatalogProvider,useCatalog} from './workspace/catalog.jsx';
import {canonicalPath,eligibleClick,workspaceDestination} from './workspace/navigation.js';
import './workspace/workspace.css';
import './workspace/workflow.css';
import './workspace/theme.css';
import MarketingStudio from './workspace/MarketingStudio.jsx';
import {pickMarketingCats} from './workspace/marketing.js';
import './workspace/marketing.css';

const loaders={
  '/cats/':()=>import('./App.jsx'),'/manuals/':()=>import('./workspace/SupportPage.jsx'),
  '/guide/':()=>import('./learning/BasicsPage.jsx'),'/guide-sales/':()=>import('./learning/MethodsPage.jsx'),'/training/':()=>import('./learning/TrainingPage.jsx'),
};
const Catalog=lazy(loaders['/cats/']),Support=lazy(loaders['/manuals/']),Basics=lazy(loaders['/guide/']),Methods=lazy(loaders['/guide-sales/']),Training=lazy(loaders['/training/']);
const pages=[['/cats/',Catalog],['/manuals/',Support],['/guide/',Basics],['/guide-sales/',Methods],['/training/',Training]];
const nav=[{to:'/cats/',label:'在售猫源库',hint:'输入需求挑猫，卡片直接写话术',icon:LayoutGrid},{to:'/manuals/',label:'销冠手册与售后',hint:'合作规则、销路教程与售后',icon:BookOpen},{to:'/training/',label:'新手模拟带练',hint:'用模拟客户练一遍接单流程',icon:GraduationCap}];
const titles={'/cats/':'在售猫源库','/manuals/':'销冠手册与售后','/guide/':'基础与成交手册','/guide-sales/':'销路实操手册','/training/':'新手模拟带练'};
const primaryRoute=path=>['/guide/','/guide-sales/'].includes(path)?'/manuals/':path;
function preload(path){if(navigator.connection?.saveData)return;loaders[path]?.().catch(()=>{});}
class PageBoundary extends React.Component{
  constructor(props){super(props);this.state={failed:false};}
  static getDerivedStateFromError(){return{failed:true};}
  componentDidCatch(){console.warn('workspace_page_failed');}
  render(){return this.state.failed?<div className="workspace-empty" role="alert"><h2>这个页面暂时没能打开</h2><p>已打开的其他工作区仍可继续使用。</p><button type="button" onClick={()=>window.location.reload()}>刷新此页面</button></div>:this.props.children;}
}
function PageSkeleton(){return <div className="workspace-loading" role="status"><span/><div/><div/><p>正在打开工作区…</p></div>;}
function Workspace(){
  const location=useLocation(),navigate=useNavigate(),rawPath=canonicalPath(location.pathname),path=rawPath==='/assistant/'?'/cats/':rawPath,{cats}=useCatalog();
  const {ask,busy,cooldown,user,epoch}=useSalesSession(),labels=shortIdMap(cats);
  const visited=useRef(new Set());visited.current.add(path);
  const [compare,setCompare]=useState([]),[notice,setNotice]=useState(''),[detail,setDetail]=useState(null),[job,setJob]=useState(null);
  const [customerDisplay,setCustomerDisplay]=useState(()=>{try{const saved=localStorage.getItem('sales-customer-display');return saved?priceSettings(JSON.parse(saved)):priceSettings({enabled:localStorage.getItem('sales-hide-prices')==='1',markup:localStorage.getItem('sales-hide-prices')==='1'?0:800});}catch{return priceSettings({});}});
  const [marketing,setMarketing]=useState(null);
  const hidePrices=customerDisplay.enabled;
  const panel=useRef(null),positions=useRef({}),active=useRef(path),restorePending=useRef(false);
  useEffect(()=>{if(rawPath==='/assistant/')navigate('/cats/'+location.search+location.hash,{replace:true});},[rawPath]);
  useEffect(()=>{setJob(null);setDetail(null);setCompare([]);setMarketing(null);},[epoch]);
  function privacy(value){const next=priceSettings(value);setCustomerDisplay(next);if(next.enabled&&!customerDisplay.enabled){setJob(null);}try{localStorage.setItem('sales-customer-display',JSON.stringify(next));localStorage.removeItem('sales-hide-prices');}catch{}}
  function openMarketing(template='price',ids){
    const selected=ids?ids.map(id=>cats.find(c=>c.id===id)).filter(Boolean):pickMarketingCats(cats);
    if(ids&&selected.length!==ids.length){setNotice('已选猫咪库存有变化，请刷新并重新选择');return;}
    if(selected.length<2||selected.length>9){setNotice('拼图需要2至9只有照片的在售猫咪，请继续选猫');return;}
    if(selected.some(c=>!c.image)){setNotice('所选猫咪有缺少照片的，请替换后再生成');return;}
    setMarketing({cats:selected,template,key:crypto.randomUUID()});
  }
  const routeOrigin=window.location.origin==='null'?'https://workspace-preview.local':window.location.origin;
  const routeBase=routeOrigin+location.pathname+location.search+location.hash;
  function remember(){positions.current[active.current]=window.scrollY||0;}
  function restore(){
    const current=path;
    if(current!==active.current)return;
    const pane=panel.current?.querySelector('[data-active="true"]');
    if(location.hash&&pane){
      let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}
      const target=[pane,...pane.querySelectorAll('[id]')].find(el=>el.id===id);
      if(target){target._setOpen?.(true);if(target.classList.contains('method')&&!target.classList.contains('is-open'))target.querySelector('.method-toggle')?.click();target.scrollIntoView({block:'start',behavior:'instant'});restorePending.current=false;return;}
    }
    window.scrollTo({top:positions.current[current]||0,left:0,behavior:'instant'});restorePending.current=false;
  }
  useLayoutEffect(()=>{
    active.current=path;restorePending.current=true;
    setDetail(null);
    document.title=`${titles[path]||'销售工作台'} · 猫咪合作平台`;
    const frame=requestAnimationFrame(restore);
    return()=>cancelAnimationFrame(frame);
  },[path,location.hash]);
  useEffect(()=>{
    const scroll=()=>{if(!restorePending.current)remember();};
    const pop=()=>{remember();restorePending.current=true;};
    const ready=()=>requestAnimationFrame(restore);
    window.addEventListener('scroll',scroll,{passive:true});window.addEventListener('popstate',pop);window.addEventListener('workspace:content-ready',ready);
    return()=>{window.removeEventListener('scroll',scroll);window.removeEventListener('popstate',pop);window.removeEventListener('workspace:content-ready',ready);};
  },[path,location.hash]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),2600);return()=>clearTimeout(timer);},[notice]);
  function routeClick(event){
    if(event.defaultPrevented)return;
    const anchor=event.target.closest?.('a[href]');
    if(!eligibleClick(event,anchor))return;
    const destination=workspaceDestination(anchor.getAttribute('href'),routeBase);
    if(!destination)return;
    event.preventDefault();remember();
    const same=destination===location.pathname+location.search+location.hash;
    if(same){window.scrollTo({top:0,behavior:'smooth'});return;}
    navigate(destination);
  }
  async function runScript(ids,action){
    const id=crypto.randomUUID();setDetail(null);setJob({id,ids,action,loading:true,result:null,error:''});
    try{const result=await ask({mode:'script',action,cat_ids:ids.map(normalizeId),hide_prices:hidePrices});setJob(current=>current?.id===id?{...current,loading:false,result}:current);}
    catch(e){setJob(current=>current?.id===id?(e.cancelled?null:{...current,loading:false,error:e.message}):current);}
  }
  function toggleCompare(cat){setCompare(items=>{if(items.includes(cat.id))return items.filter(id=>id!==cat.id);if(items.length>=9){setNotice('最多选择9只，请先移除一只');return items;}return [...items,cat.id];});}
  return <div className={`sales-workspace workflow-workspace${hidePrices?' customer-view':''}`} onClickCapture={event=>{const anchor=event.target.closest?.('a[href]');if(eligibleClick(event,anchor)&&workspaceDestination(anchor.getAttribute('href'),routeBase))remember();}} onClick={routeClick} onPointerOver={event=>{const href=event.target.closest?.('a[href]')?.getAttribute('href');if(href){const destination=workspaceDestination(href,routeBase);if(destination)preload(canonicalPath(new URL(destination,routeBase).pathname));}}}>
    <header className="workspace-header"><Link className="workspace-brand" to="/cats/"><span><Cat size={24}/></span><div><b>猫咪合作平台</b><small>合作销售工作台</small></div></Link><div className="workspace-breadcrumb"><span>销售工作台</span><ChevronRight size={14}/><b>{titles[path]||'工作区'}</b></div></header>
    <div className="workspace-layout"><aside className="workspace-sidebar"><div className="workspace-nav-label">工作区</div><nav aria-label="销售工作台主导航">{nav.map(({to,label,hint,icon:Icon})=><Link key={to} to={to} onFocus={()=>preload(to)} aria-current={primaryRoute(path)===to?'page':undefined}><span className="workspace-nav-icon"><Icon size={19}/></span><span><b>{label}</b><small>{hint}</small></span></Link>)}</nav><SalesAccount/></aside>
    <main className="workspace-content" ref={panel}>
      {visited.current.has('/cats/')&&<div className="workspace-ai-pane" hidden={path!=='/cats/'}><SalesAI cats={cats} onDetail={setDetail} hidePrices={hidePrices} customerDisplay={customerDisplay} onMarketing={openMarketing}/></div>}
      {pages.map(([route,Component])=>visited.current.has(route)&&<section key={route} className="workspace-pane" data-route={route} data-active={path===route?'true':undefined} hidden={path!==route} aria-label={titles[route]}><PageBoundary><Suspense fallback={<PageSkeleton/>}><Component embedded onAsk={(cat,action)=>runScript([cat.id],action)} onCompare={toggleCompare} compareIds={compare} onDetail={setDetail} hidePrices={hidePrices} customerDisplay={customerDisplay} onCustomerDisplay={privacy}/></Suspense></PageBoundary></section>)}
      {!titles[path]&&<div className="workspace-empty"><h1>这个工作区暂时不存在</h1><Link to="/cats/">返回猫源库</Link></div>}
      <footer className="workspace-footer"><span>合作销售专用 · 成交前请确认库存与最终费用</span></footer>
    </main></div>
    {compare.length>=1&&path==='/cats/'&&!hidePrices&&<div className="workspace-compare" aria-label="选猫操作台"><span className="workspace-compare-label">已选{compare.length}只 · {compare.map(id=>labels.get(normalizeId(id))).join(' 与 ')}</span><div className="workspace-compare-items">{compare.map(id=><button key={id} aria-label={`移除${labels.get(normalizeId(id))}`} onClick={()=>setCompare(items=>items.filter(x=>x!==id))}><X size={13}/>{labels.get(normalizeId(id))}</button>)}</div>{compare.length===2&&<button disabled={busy} onClick={()=>runScript(compare,'compare')}>⚖️ AI生成双猫对比逼单话术</button>}{compare.length>=2&&compare.length<=9?<button onClick={()=>openMarketing('price',compare)}>🖼️ 一键合成为报价拼图/小红书海报</button>:<span className="compare-hint">选2只可对比，2至9只均可拼图</span>}<button className="basket-clear" onClick={()=>setCompare([])}>清空</button></div>}
    {marketing&&<MarketingStudio key={marketing.key} initialCats={marketing.cats} initialTemplate={marketing.template} allCats={cats} close={()=>setMarketing(null)}/>}
    {notice&&<div className="workspace-notice" role="status"><Check size={16}/>{notice}</div>}
    {detail&&<Dialog title={hidePrices?'猫咪资料':'猫咪销售资料'} close={()=>setDetail(null)}><div className="workflow-cat-detail">{detail.image&&<img src={detail.image} alt={detail.breed||'在售猫咪'}/>}<b className="workflow-detail-id">{labels.get(normalizeId(detail.id))}</b><h2>{detail.breed} · {detail.color}</h2><p>{detail.gender} · 月龄{detail.age||'待确认'} · 疫苗{detail.vaccine||'待确认'}</p><p>{displayText(detail.description,cats,hidePrices)}</p>{displayedPrice(detail,customerDisplay)!=null&&<strong>{hidePrices?'售价 ':'合作底价 '}{money(displayedPrice(detail,customerDisplay))}</strong>}{!hidePrices&&<div><button disabled={busy} onClick={()=>runScript([detail.id],'praise')}>夸这只猫骨相甜美</button><button disabled={busy} onClick={()=>runScript([detail.id],'price')}>客户嫌贵保价逼单</button></div>}<small>库存实时变化，成交前请再次核对。</small></div></Dialog>}
    {job&&<Dialog title={job.action==='compare'?'双猫对比话术':'猫咪推荐话术'} close={()=>setJob(null)}><div className="workflow-script-result"><p className="workflow-script-ids">{job.ids.map(id=>labels.get(normalizeId(id))).join(' · ')}</p>{job.loading?<p role="status">{busy?'正在生成微信话术…':'请先完成销售激活…'}</p>:job.error?<><p role="alert" className="sales-ai-error">{job.error}</p><button className="workspace-primary" disabled={busy||cooldown>0||user?.remaining===0} onClick={()=>runScript(job.ids,job.action)}>{cooldown?`请等待${cooldown}秒`:'重新生成'}</button></>:<AIResult result={job.result} cats={cats} hidePrices={hidePrices} customerDisplay={customerDisplay} onDetail={cat=>{setJob(null);setDetail(cat);}}/>}</div></Dialog>}
  </div>;
}
export function WorkspaceContent(){return <SalesSessionProvider><CatalogProvider><Workspace/></CatalogProvider></SalesSessionProvider>;}
export default function SalesWorkspace(){return <BrowserRouter><WorkspaceContent/></BrowserRouter>;}
