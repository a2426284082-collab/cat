import React,{lazy,Suspense,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {BrowserRouter,Link,useLocation,useNavigate} from 'react-router-dom';
import {ArrowLeft,ArrowRight,BookOpen,Cat,Check,ChevronRight,GraduationCap,LayoutGrid,MessageSquare,RefreshCw,ShieldCheck,Sparkles,X} from 'lucide-react';
import SalesAI from './components/SalesAI.jsx';
import {CatalogProvider,useCatalog} from './workspace/catalog.jsx';
import {canonicalPath,eligibleClick,workspaceDestination} from './workspace/navigation.js';
import './workspace/workspace.css';

const loaders={
  '/cats/':()=>import('./App.jsx'),'/manuals/':()=>import('./workspace/SupportPage.jsx'),
  '/guide/':()=>import('./learning/BasicsPage.jsx'),'/guide-sales/':()=>import('./learning/MethodsPage.jsx'),'/training/':()=>import('./learning/TrainingPage.jsx'),
};
const Catalog=lazy(loaders['/cats/']),Support=lazy(loaders['/manuals/']),Basics=lazy(loaders['/guide/']),Methods=lazy(loaders['/guide-sales/']),Training=lazy(loaders['/training/']);
const pages=[['/cats/',Catalog],['/manuals/',Support],['/guide/',Basics],['/guide-sales/',Methods],['/training/',Training]];
const nav=[{to:'/cats/',label:'猫源库',hint:'浏览真实在售库存',icon:LayoutGrid},{to:'/assistant/',label:'AI 导购',hint:'选猫、对比与写话术',icon:Sparkles},{to:'/manuals/',label:'销售支持',hint:'规则与实操手册',icon:BookOpen},{to:'/training/',label:'新手带练',hint:'跟着模拟客户练一遍',icon:GraduationCap}];
const titles={'/cats/':'猫源库','/assistant/':'AI 导购','/manuals/':'销售支持','/guide/':'基础与成交手册','/guide-sales/':'销路实操手册','/training/':'新手实战带练'};
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
  const location=useLocation(),navigate=useNavigate(),path=canonicalPath(location.pathname),{cats,loading,error}=useCatalog();
  const visited=useRef(new Set());visited.current.add(path);
  const[command,setCommand]=useState(null),[compare,setCompare]=useState([]),[notice,setNotice]=useState(''),[detail,setDetail]=useState(null);
  const panel=useRef(null),positions=useRef({}),active=useRef(path),restorePending=useRef(false);
  const showAI=path==='/cats/'||path==='/assistant/';
  const aiVisited=useRef(showAI);if(showAI)aiVisited.current=true;
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
  function ask(cat){remember();setDetail(null);setCommand({id:crypto.randomUUID(),mode:'script',prompt:`猫咪编号 #${String(cat.id).replace(/^#+/,'')}，请根据已录入资料介绍优势，生成微信推荐话术`});positions.current['/assistant/']=0;navigate('/assistant/');}
  function toggleCompare(cat){setCompare(items=>{if(items.includes(cat.id))return items.filter(id=>id!==cat.id);if(items.length>=2){setNotice('一次最多对比两只，请先移除一只');return items;}return [...items,cat.id];});}
  function compareCats(){if(compare.length!==2)return;remember();setCommand({id:crypto.randomUUID(),mode:'script',prompt:`客户纠结编号 #${String(compare[0]).replace(/^#+/,'')} 和 #${String(compare[1]).replace(/^#+/,'')}，请对比已知优缺点，生成推荐话术`});positions.current['/assistant/']=0;navigate('/assistant/');}
  return <div className="sales-workspace" onClickCapture={event=>{const anchor=event.target.closest?.('a[href]');if(eligibleClick(event,anchor)&&workspaceDestination(anchor.getAttribute('href'),routeBase))remember();}} onClick={routeClick} onPointerOver={event=>{const href=event.target.closest?.('a[href]')?.getAttribute('href');if(href){const destination=workspaceDestination(href,routeBase);if(destination)preload(canonicalPath(new URL(destination,routeBase).pathname));}}}>
    <header className="workspace-header"><Link className="workspace-brand" to="/cats/"><span><Cat size={24}/></span><div><b>猫咪合作平台</b><small>合作销售工作台</small></div></Link><div className="workspace-breadcrumb"><span>销售工作台</span><ChevronRight size={14}/><b>{titles[path]||'工作区'}</b></div><div className="workspace-header-status"><i className={error?'warning':''}/><span>{loading&&!cats.length?'正在同步猫源':error?'显示最近同步库存':`${cats.length} 只在售猫源`}</span></div></header>
    <div className="workspace-layout"><aside className="workspace-sidebar"><div className="workspace-nav-label">工作区</div><nav aria-label="销售工作台主导航">{nav.map(({to,label,hint,icon:Icon})=><Link key={to} to={to} onFocus={()=>preload(to)} aria-current={primaryRoute(path)===to?'page':undefined}><span className="workspace-nav-icon"><Icon size={19}/></span><span><b>{label}</b><small>{hint}</small></span>{primaryRoute(path)===to&&<i/>}</Link>)}</nav><div className="workspace-sidebar-card"><span><ShieldCheck size={15}/> 真实库存，放心推荐</span><p>先核对编号与资料，再把合适的选择交给客户。</p></div><Link className="workspace-sidebar-help" to="/training/"><GraduationCap size={17}/><span>第一次接待？<small>跟着练一遍</small></span><ArrowRight size={14}/></Link><footer>猫源、话术与学习<br/>在一个工作台里完成</footer></aside>
    <main className="workspace-content" ref={panel}>
      {aiVisited.current&&<div className="workspace-ai-pane" hidden={!showAI} data-active={showAI?'true':undefined}><SalesAI cats={cats} onDetail={setDetail} command={command} active={showAI}/>{path==='/assistant/'&&<div className="workspace-assistant-context"><div><MessageSquare size={19}/><span><b>从客户需求开始，也可以从一只猫开始。</b><small>在猫源卡片上点“写话术”，编号自动带入；选两只加入对比，即可生成对比话术。</small></span></div><Link to="/cats/">继续挑猫 <ArrowRight size={15}/></Link></div>}</div>}
      {pages.map(([route,Component])=>visited.current.has(route)&&<section key={route} className="workspace-pane" data-route={route} data-active={path===route?'true':undefined} hidden={path!==route} aria-label={titles[route]}><PageBoundary><Suspense fallback={<PageSkeleton/>}><Component embedded onAsk={ask} onCompare={toggleCompare} compareIds={compare} onDetail={setDetail}/></Suspense></PageBoundary></section>)}
      {!titles[path]&&<div className="workspace-empty"><h1>这个工作区暂时不存在</h1><Link to="/cats/">返回猫源库</Link></div>}
      {path==='/assistant/'&&<p className="workspace-assistant-note"><ShieldCheck size={13}/> 每次独立生成。输入仅用于选猫和销售话术，发送前请核对实际资料。</p>}
      <footer className="workspace-footer"><span>合作销售专用 · 成交前请确认库存与最终费用</span><Link to="/manuals/">销售支持 <ArrowRight size={12}/></Link></footer>
    </main></div>
    {compare.length>0&&path==='/cats/'&&<div className="workspace-compare" aria-label="猫咪对比栏"><span className="workspace-compare-label">已选 {compare.length}/2</span><div className="workspace-compare-items">{compare.map(id=><span key={id}>#{String(id).replace(/^#+/,'')}<button aria-label={`移除 ${id}`} onClick={()=>setCompare(items=>items.filter(x=>x!==id))}><X size={13}/></button></span>)}</div><button disabled={compare.length!==2} onClick={compareCats}>对比并写话术 <ArrowRight size={15}/></button></div>}
    {notice&&<div className="workspace-notice" role="status"><Check size={16}/>{notice}</div>}
    {detail&&<div className="workspace-detail-overlay" role="presentation" onMouseDown={e=>e.target===e.currentTarget&&setDetail(null)}><div role="dialog" aria-modal="true" aria-label="猫咪销售资料" className="workspace-detail"><button className="workspace-detail-close" aria-label="关闭猫咪资料" onClick={()=>setDetail(null)}><X size={20}/></button>{detail.image&&<img src={detail.image} alt={detail.breed||'在售猫咪'}/>}<small>#{detail.id.replace(/^#+/,'')}</small><h2>{detail.breed||'在售猫咪'} · {detail.color||'花色待补充'}</h2><p>{detail.gender||'性别待确认'} · 月龄：{detail.age||'待补充'} · 疫苗：{detail.vaccine||'待补充'}</p><p className="workspace-detail-description">{detail.description||'描述待补充'}</p><strong>{detail.price==null?'价格待确认':`¥${Number(detail.price).toLocaleString('zh-CN')}`}</strong><button className="workspace-primary" onClick={()=>ask(detail)}><Sparkles size={16}/>用这只猫写话术</button><p className="workspace-detail-note">库存实时变化，成交前请再次核对。</p></div></div>}
  </div>;
}
export function WorkspaceContent(){return <CatalogProvider><Workspace/></CatalogProvider>;}
export default function SalesWorkspace(){return <BrowserRouter><WorkspaceContent/></BrowserRouter>;}
